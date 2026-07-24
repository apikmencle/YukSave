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
 * tikwm is currently the ONLY parser in the active chain (see the note
 * above `parserChain` below) — a transient hiccup on their end (a 5xx, a
 * dropped connection, a momentary rate-limit) now fails the whole request
 * with no other parser to fall back to. A short retry absorbs exactly
 * that class of failure without adding real cost: it only fires when the
 * first attempt already failed, and skips retrying failures that a retry
 * can't fix (a genuinely invalid/private/deleted TikTok URL, which tikwm
 * reports via `json.code !== 0` rather than a network-level failure).
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
      // A non-ok HTTP status (5xx, 429, etc.) is worth retrying — an
      // application-level "video not found" comes back as res.ok with
      // json.code !== 0, which we deliberately do NOT retry (see below).
      if (!res.ok) throw new Error(`tikwm request failed: HTTP ${res.status}`);
      return res;
    } catch (err) {
      lastErr = err;
      // A timeout (AbortError) already burned the full PARSER_TIMEOUT_MS
      // budget — retrying it would risk stacking two full timeouts and
      // blowing past the platform's own function timeout (10s on
      // Vercel's default/hobby tier). Only retry failures that fail
      // fast (connection refused, DNS error, an immediate 5xx), where a
      // second attempt is cheap enough to be worth it.
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
  // Not retried on purpose: json.code !== 0 means tikwm understood the
  // request and rejected it (bad/private/deleted video), not a transient
  // failure — retrying would just waste ~6s before failing the same way.
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
// parserChain without re-running the curl check above first. Until then,
// this app effectively has NO fallback parser — find and verify a real
// working replacement before relying on this in production.
//
// UPDATE (also 2026-07-24, same day): a web-fetch against
// https://api.tiklydown.eu.org/ from a *different* network path (not
// Vercel/Node, no TLS pinning info available) succeeded and returned
// their normal docs page — which contradicts the curl/Chrome finding
// above. This is NOT strong enough evidence to re-enable it (different
// client, different DNS/CDN edge, possibly different cert-validation
// behavior) — it just means the earlier "broken" finding is worth
// re-running with a fresh `curl -v https://api.tiklydown.eu.org/api/download?url=...`
// from the actual deploy environment before trusting either result. Also
// note /swagger.json on that host now blocks automated fetches (robots
// disallow), so re-verify the field-mapping comment on
// parseWithTiklydown by hand too if you do re-enable it — don't assume
// the shape documented there is still current.
const parserChain: Parser[] = [{ name: "tikwm", run: parseWithTikwm }];

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
      // try next parser in the chain
    }
  }

  throw new Error(
    `Semua parser gagal. Terakhir: ${
      lastError instanceof Error ? lastError.message : "unknown error"
    }`
  );
}
