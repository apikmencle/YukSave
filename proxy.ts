import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// TikTok CDN hosts our images/media are allowed to load from — keep this
// in sync with ALLOWED_HOST_SUFFIXES in app/api/download/route.ts and
// remotePatterns in next.config.js (three places, same list, because CSP,
// the download proxy allowlist, and next/image all need it independently).
const CDN_HOSTS = [
  "*.tiktokcdn.com",
  "*.tiktokcdn-us.com",
  "*.tiktokcdn-sg.com",
  "*.tiktokcdn-eu.com",
  "*.ibytedtos.com",
  "*.ibyteimg.com",
  "*.muscdn.com",
  "*.akamaized.net",
  "*.tiktokv.us",
]
  .map((h) => `https://${h}`)
  .join(" ");

// NOTE: as of Next.js 16, this file must be named `proxy.ts` and export a
// function named `proxy` — the `middleware.ts` / `export function
// middleware` convention used in Next.js ≤15 was renamed in v16.0.0
// (Next.js still accepts `middleware.ts` for now with a console warning,
// but it's deprecated and slated for removal, and mixing the two — e.g.
// leaving a stray `middleware.ts` around — means Next.js silently ignores
// whichever one it doesn't recognize). Confirm the CSP header is actually
// being sent after any change here: `curl -I` your deployed URL and check
// for `content-security-policy`.
export function proxy(req: NextRequest) {
  // Proxy defaults to the Node.js runtime as of Next.js 16 (previously
  // Edge-only), and Node has had the Web Crypto API globally available
  // since Node 19 — so crypto.randomUUID() works here either way without
  // a separate "crypto" import.
  const nonce = crypto.randomUUID();

  // Next.js dev mode (both Turbopack and Webpack) relies on eval() for
  // Hot Module Reload / Fast Refresh — without 'unsafe-eval' the browser
  // blocks it and the entire client bundle fails silently (page renders
  // from SSR, but no JS ever runs, so nothing is interactive). Production
  // builds don't use eval() at all, so this stays strict where it matters.
  const scriptSrc =
    process.env.NODE_ENV === "development"
      ? `script-src 'self' 'unsafe-eval' 'nonce-${nonce}' https://challenges.cloudflare.com`
      : `script-src 'self' 'nonce-${nonce}' https://challenges.cloudflare.com`;

  const csp = [
    `default-src 'self'`,
    // challenges.cloudflare.com: only needed if Turnstile is enabled
    // (components/Turnstile.tsx), harmless to always allow since the
    // widget itself is a no-op when NEXT_PUBLIC_TURNSTILE_SITE_KEY unset.
    scriptSrc,
    `style-src 'self' 'unsafe-inline'`, // Tailwind's generated styles are inline; no reliable way to nonce them
    `img-src 'self' data: ${CDN_HOSTS}`,
    `media-src 'self' ${CDN_HOSTS}`,
    `connect-src 'self' https://challenges.cloudflare.com`,
    `frame-src https://challenges.cloudflare.com`,
    `frame-ancestors 'self'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `object-src 'none'`,
  ].join("; ");

  // Forward the nonce to the request so a Server Component (app/layout.tsx)
  // can read it via next/headers and apply it to the inline theme script.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  // Skip static assets and image optimization files — no need to run
  // proxy (or attach CSP) for those.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
