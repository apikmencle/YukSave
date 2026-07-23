import { NextRequest, NextResponse } from "next/server";
import { parseTikTokUrl, canonicalizeTikTokUrl } from "@/lib/parsers/tiktok";
import { getSupabaseServerClient } from "@/lib/supabase";
import { hashIp, getClientIp } from "@/lib/ip";

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_PER_MINUTE = 10;

/**
 * Verifies a Cloudflare Turnstile token. Deliberately a no-op (returns
 * true) when TURNSTILE_SECRET_KEY isn't set, so this feature stays fully
 * optional — enabling it is just a matter of setting the env var, without
 * a code change or breaking environments that haven't set it up yet.
 */
async function verifyTurnstile(token: string | undefined, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;

  try {
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ secret, response: token, remoteip: ip }),
      }
    );
    const data = await res.json();
    return data.success === true;
  } catch {
    // If Cloudflare's endpoint itself is unreachable, fail closed —
    // better to briefly block downloads than to silently disable the
    // check we just paid a network round-trip for.
    return false;
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const url = body?.url as string | undefined;
  const turnstileToken = body?.turnstileToken as string | undefined;

  if (!url || !/tiktok\.com|vt\.tiktok|vm\.tiktok/.test(url)) {
    return NextResponse.json(
      { code: "invalid_url", message: "Link TikTok tidak valid." },
      { status: 400 }
    );
  }

  const ip = getClientIp(req.headers);
  const ipHash = hashIp(ip);

  if (!(await verifyTurnstile(turnstileToken, ip))) {
    return NextResponse.json(
      {
        code: "verification_failed",
        message: "Verifikasi keamanan gagal. Coba lagi.",
      },
      { status: 403 }
    );
  }

  const supabase = getSupabaseServerClient();

  // Rate limiting: count requests from this IP hash in the last minute
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
  const { count } = await supabase
    .from("downloads")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", oneMinuteAgo);

  if ((count ?? 0) >= RATE_LIMIT_PER_MINUTE) {
    return NextResponse.json(
      {
        code: "rate_limited",
        message: "Terlalu banyak permintaan. Coba lagi sebentar.",
      },
      { status: 429 }
    );
  }

  // Same video can arrive as several equivalent URLs (short links, tracking
  // params, etc) — canonicalize first so they all hit the same cache entry.
  const canonicalUrl = await canonicalizeTikTokUrl(url);

  // Check cache
  const { data: cached } = await supabase
    .from("downloads")
    .select("result, created_at")
    .eq("source_url", canonicalUrl)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (
    cached &&
    Date.now() - new Date(cached.created_at).getTime() < CACHE_TTL_MS
  ) {
    return NextResponse.json(cached.result);
  }

  try {
    const result = await parseTikTokUrl(url);

    await supabase.from("downloads").insert({
      source_url: canonicalUrl,
      ip_hash: ipHash,
      result,
    });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      {
        code: "parse_failed",
        message:
          "Gagal memproses link ini. Server sumber mungkin sedang bermasalah, coba lagi nanti.",
      },
      { status: 502 }
    );
  }
}
