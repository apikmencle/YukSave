import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { hashIp, getClientIp } from "@/lib/ip";

// Only proxy known TikTok CDN / mirror hostnames — this route fetches
// whatever URL it's given, so an open allowlist would make it an
// SSRF-style proxy for arbitrary sites.
//
// This list was written against tikwm's output. If you enable the
// RapidAPI or ScrapeCreators fallbacks in lib/parsers/tiktok.ts, check
// what CDN hostnames THEY return once you've picked a real provider —
// if they mirror through something not in this list, every download
// coming from that fallback will silently 403 here even though parsing
// succeeded. Don't widen this by guessing; add the exact hostname you
// observe.
const ALLOWED_HOST_SUFFIXES = [
  "tiktokcdn.com",
  "tiktokcdn-us.com",
  "tiktokcdn-sg.com",
  "tiktokcdn-eu.com",
  "ibytedtos.com",
  "ibyteimg.com",
  "muscdn.com",
  // tikwm's `wmplay` (watermarked) field commonly points straight at
  // TikTok's original Akamai-hosted CDN instead of through one of the
  // domains above — the no-watermark `play` field doesn't, which is why
  // this was missed until someone actually clicked "download with
  // watermark". Observed 2026-07-27 via a live "Host not allowed" 403.
  "akamaized.net",
  "tiktokv.us",
];

// Higher than /api/parse's limit on purpose: a single legitimate result
// (e.g. a photo slideshow) can fire several of these in quick succession
// via handleDownloadAllPhotos in app/page.tsx. This still caps the
// bandwidth-cost abuse case — hammering this proxy directly with a
// previously-seen CDN URL, bypassing /api/parse entirely.
const RATE_LIMIT_PER_MINUTE = 30;

function isAllowedHost(hostname: string): boolean {
  return ALLOWED_HOST_SUFFIXES.some(
    (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`)
  );
}

/**
 * Video/photo titles can contain emoji and other non-Latin1 characters,
 * which Node throws on if used directly in an HTTP header value. We build
 * an ASCII-safe fallback filename for `filename=`, and a properly
 * percent-encoded UTF-8 version for `filename*=` (RFC 5987) so browsers
 * that support it still show the full original name.
 */
function buildContentDisposition(rawFilename: string): string {
  const asciiSafe =
    rawFilename
      .replace(/[^\x20-\x7E]/g, "") // strip anything outside printable ASCII
      .replace(/["\\]/g, "") // strip quote/backslash which would break the header
      .trim()
      .slice(0, 100) || "yuksave-download";

  const utf8Encoded = encodeURIComponent(rawFilename);

  return `attachment; filename="${asciiSafe}"; filename*=UTF-8''${utf8Encoded}`;
}

export async function GET(req: NextRequest) {
  const targetUrl = req.nextUrl.searchParams.get("url");
  const filename = req.nextUrl.searchParams.get("filename") ?? "yuksave-download";

  if (!targetUrl) {
    return NextResponse.json({ message: "Missing url" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return NextResponse.json({ message: "Invalid url" }, { status: 400 });
  }

  if (!isAllowedHost(parsed.hostname)) {
    // Both parsers (tikwm and the tiklydown fallback) are expected to
    // return links pointing at TikTok's own CDN, so this should be rare.
    // If it does happen — e.g. tiklydown starts returning a mirror host
    // we haven't allowlisted — log it so it shows up in Vercel logs
    // instead of silently 403ing with no trace of which host it was.
    console.warn(`[api/download] rejected disallowed host: ${parsed.hostname}`);
    return NextResponse.json({ message: "Host not allowed" }, { status: 403 });
  }

  const ip = getClientIp(req.headers);
  const ipHash = hashIp(ip);
  const supabase = getSupabaseServerClient();

  // This proxy streams real bandwidth (video/photo bytes), unlike
  // /api/parse which only returns JSON — so unlike parse, we log the hit
  // (and check the limit) up front, before doing any work, rather than
  // only after a successful fetch. Otherwise a burst of requests that
  // arrive faster than Supabase round-trips could all slip through
  // before any of them get counted.
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
  const { count } = await supabase
    .from("download_proxy_hits")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", oneMinuteAgo);

  if ((count ?? 0) >= RATE_LIMIT_PER_MINUTE) {
    return NextResponse.json(
      { message: "Terlalu banyak permintaan. Coba lagi sebentar." },
      { status: 429 }
    );
  }

  // Fire-and-forget: logging the hit shouldn't block or fail the actual
  // download if Supabase is briefly unavailable.
  supabase
    .from("download_proxy_hits")
    .insert({ ip_hash: ipHash })
    .then(({ error }) => {
      if (error) console.warn("[api/download] failed to log rate-limit hit:", error.message);
    });

  try {
    // Only guards against the upstream never responding at all — once
    // headers come back we let the body stream for as long as it takes,
    // so this won't cut off large videos on a slow connection.
    const controller = new AbortController();
    const connectTimer = setTimeout(() => controller.abort(), 15000);
    const upstream = await fetch(parsed.toString(), {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: controller.signal,
    }).finally(() => clearTimeout(connectTimer));

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { message: "Gagal mengambil file dari sumber." },
        { status: 502 }
      );
    }

    const contentType =
      upstream.headers.get("content-type") ?? "application/octet-stream";

    return new NextResponse(upstream.body, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": buildContentDisposition(filename),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    // Log the real reason server-side (Vercel function logs) only — the
    // client only needs to know it failed, not upstream hostnames, abort
    // reasons, or other internals that a raw err.message could expose.
    console.error(
      "[api/download] fetch failed:",
      err instanceof Error ? err.message : err
    );
    return NextResponse.json(
      { message: "Terjadi kesalahan saat menyiapkan file untuk diunduh." },
      { status: 500 }
    );
  }
}
