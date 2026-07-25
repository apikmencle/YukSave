export type TikTokParseResult = {
  title: string;
  author: string;
  durationSec: number;
  thumbnail: string;
  /** Present for video posts. Absent for photo/slideshow posts. */
  noWatermarkUrl?: string;
  watermarkUrl?: string;
  /** Present for photo/slideshow posts — one URL per image. */
  images?: string[];
  /** Audio-only download link (for "convert to MP3"), when available. */
  musicUrl?: string;
};

type Parser = {
  name: string;
  run: (url: string) => Promise<TikTokParseResult>;
};

const PARSER_TIMEOUT_MS = 6000;
const REDIRECT_RESOLVE_TIMEOUT_MS = 4000;

/**
 * Every upstream call in this file goes through this wrapper. Without it,
 * a single slow/hanging third-party endpoint (tikwm, tiklydown, or the
 * short-link redirect resolver) can stall the whole request until the
 * platform's own function timeout kills it — the user just sees a spinner
 * for 10s+ with no useful error. Aborting early lets the parser chain
 * fail fast and move to the next fallback instead.
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

const SHORT_LINK_PATTERN = /^https?:\/\/(vt|vm)\.tiktok\.com\//i;
const VIDEO_ID_PATTERN = /\/video\/(\d+)/;
const PHOTO_ID_PATTERN = /\/photo\/(\d+)/;

/**
 * TikTok links come in several equivalent shapes (short vt./vm. redirects,
 * full www.tiktok.com URLs with tracking query params, mobile share links,
 * etc). Using the raw string as-is for caching and stats means the same
 * video can appear as several different cache keys, which quietly tanks
 * the cache-hit rate. This resolves short links to their final destination
 * and extracts a stable `video/<id>` or `photo/<id>` key when possible,
 * falling back to the resolved (or original) URL if the pattern isn't found.
 *
 * Best-effort by design: if the redirect fetch fails or times out, we fall
 * back to the original URL rather than failing the whole request — a
 * cache miss is a minor cost, but blocking parsing on this would not be.
 */
export async function canonicalizeTikTokUrl(url: string): Promise<string> {
  let finalUrl = url;

  if (SHORT_LINK_PATTERN.test(url)) {
    try {
      const res = await fetchWithTimeout(
        url,
        { method: "HEAD", redirect: "follow", headers: { "User-Agent": "Mozilla/5.0" } },
        REDIRECT_RESOLVE_TIMEOUT_MS
      );
      if (res.url) finalUrl = res.url;
    } catch {
      // Redirect resolution failed/timed out — proceed with the original
      // short URL. Parsing still works; only cache dedup is affected.
    }
  }

  const match = finalUrl.match(VIDEO_ID_PATTERN) ?? finalUrl.match(PHOTO_ID_PATTERN);
  return match ? match[0] : finalUrl;
}

const TIKWM_RETRY_ATTEMPTS = 2;
const TIKWM_RETRY_DELAY_MS = 400;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * tikwm is the first (free, no-key) parser in the chain — a transient
 * hiccup on their end (a 5xx, a dropped connection, a momentary
 * rate-limit) would otherwise skip straight to a paid/keyed fallback
 * (RapidAPI, ScrapeCreators) for something a quick retry could have
 * absorbed for free. Only retries failures that fail fast (connection
 * refused, immediate 5xx) — a timeout already burned the full
 * PARSER_TIMEOUT_MS budget, so retrying it risks stacking two full
 * timeouts and blowing past the platform's own function timeout. An
 * application-level "video not found" (json.code !== 0, handled below,
 * not here) is also deliberately not retried — a second attempt can't
 * fix a genuinely bad/private/deleted URL.
 */
async function fetchTikwm(url: string): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= TIKWM_RETRY_ATTEMPTS; attempt++) {
    try {
      const res = await fetchWithTimeout(
        `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`,
        { headers: { "User-Agent": "Mozilla/5.0" } },
        PARSER_TIMEOUT_MS
      );
      if (!res.ok) throw new Error(`tikwm request failed: HTTP ${res.status}`);
      return res;
    } catch (err) {
      lastErr = err;
      const isTimeout = err instanceof Error && err.name === "AbortError";
      if (isTimeout || attempt >= TIKWM_RETRY_ATTEMPTS) break;
      await sleep(TIKWM_RETRY_DELAY_MS);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("tikwm request failed");
}

/**
 * Parser #1: tikwm.com public endpoint.
 * Free, no key required, but rate-limited and can change without notice.
 */
async function parseWithTikwm(url: string): Promise<TikTokParseResult> {
  const res = await fetchTikwm(url);

  const json = await res.json();
  if (json.code !== 0 || !json.data) throw new Error("tikwm parse failed");

  const d = json.data;
  const images: string[] | undefined =
    Array.isArray(d.images) && d.images.length > 0 ? d.images : undefined;

  // Photo/slideshow posts: tikwm still fills `play`/`wmplay`, but those point
  // to an audio-only container (music domain), not a real video. Checking
  // `images` first avoids misreading a photo post as a video post.
  if (images) {
    return {
      title: d.title ?? "Foto TikTok",
      author: d.author?.unique_id ?? "unknown",
      durationSec: 0,
      thumbnail: d.cover,
      images,
      musicUrl: d.music || undefined,
    };
  }

  if (!d.play) {
    throw new Error("tikwm parse failed: no video or images in response");
  }

  return {
    title: d.title ?? "Video TikTok",
    author: d.author?.unique_id ?? "unknown",
    durationSec: d.duration ?? 0,
    thumbnail: d.cover,
    noWatermarkUrl: d.play,
    watermarkUrl: d.wmplay,
    musicUrl: d.music || undefined,
  };
}

/**
 * Parser #2: tiklydown.eu.org public endpoint.
 * Used as fallback when tikwm is down or rate-limits us.
 *
 * NOTE: this is an unofficial third-party API. The field paths below
 * (`video.noWatermark`, `title`, `author.uniqueId`) match the shape
 * used by other public wrapper packages built on the same underlying
 * service (e.g. the `tiklydown()` helper in
 * github.com/MRHRTZ/Tiktok-Scraper-Without-Watermark), which is the best
 * confirmation available without hitting the live endpoint directly
 * (api.tiklydown.eu.org disallows automated/robots access, so it can't be
 * probed from a script or CI). Treat this as reasonably likely correct,
 * not verified — do one real manual request before relying on it in
 * production: open
 * https://api.tiklydown.eu.org/api/download?url=<a-tiktok-url>
 * in a browser and compare against the field paths below. If they don't
 * match, thrown errors now name the specific field that was missing
 * (see below) so a mismatch is obvious in the Vercel logs rather than
 * silently returning a broken result.
 */
async function parseWithTiklydown(url: string): Promise<TikTokParseResult> {
  const res = await fetchWithTimeout(
    `https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(url)}`,
    { headers: { Accept: "application/json" } },
    PARSER_TIMEOUT_MS
  );
  if (!res.ok) throw new Error(`tiklydown request failed: HTTP ${res.status}`);

  const json = await res.json();
  if (!json || typeof json !== "object") {
    throw new Error("tiklydown parse failed: response was not a JSON object");
  }

  const video = json.video ?? json;
  const author = json.author ?? {};

  const images: string[] | undefined =
    Array.isArray(json.images) && json.images.length > 0
      ? json.images
      : undefined;

  if (images) {
    return {
      title: json.title ?? "Foto TikTok",
      author: author.uniqueId ?? author.nickname ?? "unknown",
      durationSec: 0,
      thumbnail: json.cover ?? video?.cover ?? "",
      images,
      musicUrl: json.music?.playUrl ?? undefined,
    };
  }

  const noWatermarkUrl: string | undefined =
    video?.noWatermark ?? video?.play ?? video?.url ?? json.noWatermark;

  if (!noWatermarkUrl) {
    throw new Error(
      "tiklydown parse failed: none of video.noWatermark, video.play, " +
        "video.url, or json.noWatermark were present — response shape may " +
        "have changed, see the field-mapping note above parseWithTiklydown"
    );
  }

  return {
    title: json.title ?? "Video TikTok",
    author: author.uniqueId ?? author.nickname ?? "unknown",
    durationSec: video?.duration ?? json.duration ?? 0,
    thumbnail: json.cover ?? video?.cover ?? "",
    noWatermarkUrl,
    watermarkUrl: video?.watermark ?? undefined,
    musicUrl: json.music?.playUrl ?? undefined,
  };
}

/**
 * Parser #3 (currently NOT in parserChain — see note below): example
 * RapidAPI integration. Left in place as a starting point if you later
 * pick a specific TikTok scraper listing on RapidAPI, but API_URL below
 * is a placeholder host, not a real subscribed endpoint — replace it
 * (and verify the field mapping against that provider's actual response)
 * before wiring this back into parserChain.
 */
async function parseWithRapidApi(url: string): Promise<TikTokParseResult> {
  // Ganti endpoint dan API Key ini dengan layanan yang Anda pilih di RapidAPI
  const API_URL = `https://tiktok-scraper-api.p.rapidapi.com/fetch?url=${encodeURIComponent(url)}`;
  const API_KEY = process.env.RAPIDAPI_KEY || "";

  if (!API_KEY) {
    throw new Error("RapidAPI fallback dilewati: API Key belum dikonfigurasi.");
  }

  const res = await fetchWithTimeout(
    API_URL,
    {
      headers: {
        "X-RapidAPI-Key": API_KEY,
        // Host disesuaikan dengan layanan spesifik yang disewa
        "X-RapidAPI-Host": "tiktok-scraper-api.p.rapidapi.com"
      }
    },
    PARSER_TIMEOUT_MS
  );

  if (!res.ok) throw new Error(`RapidAPI request failed: HTTP ${res.status}`);

  const json = await res.json();
  const data = json.data;

  if (!data) throw new Error("RapidAPI parse failed: struktur response tidak valid");

  const images: string[] | undefined = Array.isArray(data.images) && data.images.length > 0 
    ? data.images 
    : undefined;

  if (images) {
    return {
      title: data.title ?? "Foto TikTok",
      author: data.author?.unique_id ?? "unknown",
      durationSec: 0,
      thumbnail: data.cover,
      images,
      musicUrl: data.music || undefined,
    };
  }

  return {
    title: data.title ?? "Video TikTok",
    author: data.author?.unique_id ?? "unknown",
    durationSec: data.duration ?? 0,
    thumbnail: data.cover,
    noWatermarkUrl: data.play,
    watermarkUrl: data.wmplay,
    musicUrl: data.music || undefined,
  };
}

/**
 * Parser #4 (optional): ScrapeCreators' TikTok Video Info API.
 * https://docs.scrapecreators.com/v2/tiktok/video
 *
 * Unlike tikwm/tiklydown, this is a documented, paid API (1 credit per
 * request, free trial credits available) — not an anonymous scraper that
 * can silently change shape or go down. Only active when
 * SCRAPECREATORS_API_KEY is set (see parserChain below); without it,
 * this function is simply never called and the app behaves exactly as
 * before. Get a key at https://scrapecreators.com.
 *
 * Field mapping verified against ScrapeCreators' own published example
 * response (fetched 2026-07-24, not just inferred from a wrapper lib):
 * - no-watermark URL: aweme_detail.video.download_no_watermark_addr.url_list[0],
 *   falling back to aweme_detail.video.play_addr.url_list[0] when
 *   has_watermark is false (per their docs' explicit field note)
 * - watermarked URL: aweme_detail.video.download_addr.url_list[0]
 * - duration: aweme_detail.video.duration is in MILLISECONDS, hence /1000
 * - this endpoint does not appear to cover photo/slideshow posts (no
 *   `images` field in their documented response) — if tikwm is down AND
 *   the link is a photo post, this fallback will correctly report
 *   "no video or images", not silently mishandle it.
 */
async function parseWithScrapeCreators(url: string): Promise<TikTokParseResult> {
  const apiKey = process.env.SCRAPECREATORS_API_KEY;
  if (!apiKey) throw new Error("SCRAPECREATORS_API_KEY not configured");

  const res = await fetchWithTimeout(
    `https://api.scrapecreators.com/v2/tiktok/video?url=${encodeURIComponent(url)}`,
    { headers: { "x-api-key": apiKey } },
    PARSER_TIMEOUT_MS
  );
  if (!res.ok) throw new Error(`scrapecreators request failed: HTTP ${res.status}`);

  const json = await res.json();
  if (!json?.success || !json?.aweme_detail) {
    throw new Error("scrapecreators parse failed: no aweme_detail in response");
  }

  const aweme = json.aweme_detail;
  const video = aweme.video ?? {};

  const noWatermarkUrl: string | undefined =
    video.download_no_watermark_addr?.url_list?.[0] ??
    (video.has_watermark === false ? video.play_addr?.url_list?.[0] : undefined);

  if (!noWatermarkUrl) {
    throw new Error(
      "scrapecreators parse failed: neither download_no_watermark_addr nor " +
        "a watermark-free play_addr was present — likely a photo/slideshow " +
        "post, which this endpoint doesn't cover"
    );
  }

  return {
    title: aweme.desc || "Video TikTok",
    author: aweme.author?.unique_id ?? aweme.author?.nickname ?? "unknown",
    durationSec: Math.round((video.duration ?? 0) / 1000),
    thumbnail:
      video.cover?.url_list?.[0] ?? video.origin_cover?.url_list?.[0] ?? "",
    noWatermarkUrl,
    watermarkUrl: video.download_addr?.url_list?.[0] ?? undefined,
    musicUrl: aweme.music?.play_url?.url_list?.[0] ?? undefined,
  };
}

// tiklydown is intentionally NOT in the active chain below. Verified broken
// on 2026-07-24: its TLS certificate's subjectAltName doesn't cover
// api.tiklydown.eu.org — confirmed independently via `curl -v` (SSL error
// 60) and Chrome (NET::ERR_CERT_COMMON_NAME_INVALID), so this is a real
// server-side misconfiguration on their end, not a local network issue.
// Every request to it currently fails at the TLS handshake, before any
// application logic runs — so keeping it "active" would only add a wasted
// ~6s timeout at exactly the moment a fallback is needed most (when tikwm
// is already down). The parseWithTiklydown function itself is left in
// place in case their cert gets fixed later, but do NOT re-add it to
// parserChain without re-running the curl check above first.
// Its replacement as fallback #2 is parseWithScrapeCreators below — a
// documented, paid API with verified, unambiguous field names instead of
// a guessed HTTP response shape. It's a no-op (throws immediately) unless
// SCRAPECREATORS_API_KEY is set, so leaving it in the chain is safe even
// before you've signed up.
//
// parseWithRapidApi is intentionally NOT in the chain below — its
// API_URL is still a placeholder host (see the note above that function),
// not a real subscribed RapidAPI listing. Wire it back in only after
// you've picked a specific provider and verified the field mapping
// against their real response, same discipline as the other parsers
// in this file.
const parserChain: Parser[] = [
  { name: "tikwm", run: parseWithTikwm },
  { name: "scrapecreators", run: parseWithScrapeCreators },
];

// Keep this referenced so it doesn't trip an unused-export/dead-code lint
// rule while it's parked out of the chain above.
void parseWithRapidApi;

// Keep this referenced so it doesn't trip an unused-export/dead-code lint
// rule while it's parked out of the chain above.
void parseWithTiklydown;

export async function parseTikTokUrl(url: string): Promise<TikTokParseResult> {
  let lastError: unknown;

  for (const parser of parserChain) {
    try {
      return await parser.run(url);
    } catch (err) {
      lastError =
        err instanceof Error && err.name === "AbortError"
          ? new Error(`${parser.name} timed out after ${PARSER_TIMEOUT_MS}ms`)
          : err;
      // Log each individual failure, not just the last one thrown at the
      // end of the chain — otherwise if e.g. tikwm fails for a reason
      // unrelated to scrapecreators (which then succeeds), that first
      // failure vanishes with no trace even though it's exactly the kind
      // of thing worth noticing (rate limit? upstream shape change?).
      console.warn(
        `[tiktok-parser] ${parser.name} failed, trying next:`,
        lastError instanceof Error ? lastError.message : lastError
      );
      // try next parser in the chain
    }
  }

  console.error(
    "[tiktok-parser] all parsers exhausted:",
    lastError instanceof Error ? lastError.message : "unknown error"
  );
  throw new Error(
    `Semua parser gagal. Terakhir: ${
      lastError instanceof Error ? lastError.message : "unknown error"
    }`
  );
}
