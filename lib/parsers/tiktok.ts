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

/**
 * Parser #1: tikwm.com public endpoint.
 * Free, no key required, but rate-limited and can change without notice.
 */
async function parseWithTikwm(url: string): Promise<TikTokParseResult> {
  const res = await fetchWithTimeout(
    `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`,
    { headers: { "User-Agent": "Mozilla/5.0" } },
    PARSER_TIMEOUT_MS
  );
  if (!res.ok) throw new Error("tikwm request failed");

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

const parserChain: Parser[] = [
  { name: "tikwm", run: parseWithTikwm },
  { name: "tiklydown", run: parseWithTiklydown },
];

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
