import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getSupabaseServerClient } from "@/lib/supabase";
import { hashIp, getClientIp } from "@/lib/ip";

const COOKIE_NAME = "yuksave_admin";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function sign(value: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

/**
 * Constant-time string comparison. We hash both sides first so the
 * comparison buffers are always equal length regardless of the input
 * (raw length differences would otherwise leak via timingSafeEqual itself).
 */
function safeStringsEqual(a: string, b: string): boolean {
  const digestA = crypto.createHash("sha256").update(a).digest();
  const digestB = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(digestA, digestB);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const password = body?.password as string | undefined;

  const adminPassword = process.env.ADMIN_PASSWORD;
  const secret = process.env.ADMIN_SESSION_SECRET;

  if (!adminPassword || !secret) {
    return NextResponse.json(
      { message: "Admin belum dikonfigurasi di server." },
      { status: 500 }
    );
  }

  const ip = getClientIp(req.headers);
  const ipHash = hashIp(ip);
  const supabase = getSupabaseServerClient();

  // Lockout: block this IP if it has too many recent failed attempts,
  // persisted in Supabase so the limit holds across serverless instances.
  const windowStart = new Date(Date.now() - LOCKOUT_WINDOW_MS).toISOString();
  const { count: recentFailures } = await supabase
    .from("admin_login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .eq("success", false)
    .gte("created_at", windowStart);

  if ((recentFailures ?? 0) >= MAX_FAILED_ATTEMPTS) {
    return NextResponse.json(
      { message: "Terlalu banyak percobaan login. Coba lagi nanti." },
      { status: 429 }
    );
  }

  const passwordOk = !!password && safeStringsEqual(password, adminPassword);

  await supabase
    .from("admin_login_attempts")
    .insert({ ip_hash: ipHash, success: passwordOk });

  if (!passwordOk) {
    return NextResponse.json(
      { message: "Password salah." },
      { status: 401 }
    );
  }

  const expires = Date.now() + SESSION_TTL_MS;
  const payload = `${expires}`;
  const signature = sign(payload, secret);
  const cookieValue = `${payload}.${signature}`;

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  // Clearing via maxAge 0 rather than res.cookies.delete() — delete()
  // doesn't reliably send the Set-Cookie needed to unset an httpOnly
  // cookie in the browser on every Next.js version, this does.
  res.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return res;
}
