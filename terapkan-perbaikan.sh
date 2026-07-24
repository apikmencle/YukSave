#!/usr/bin/env bash
# Jalankan script ini dari root folder project YukSave (folder yang ada
# package.json-nya). Script ini menimpa 4 file dengan versi yang sudah
# diperbaiki. Aman dijalankan berkali-kali (idempotent).
set -e

if [ ! -f "package.json" ]; then
  echo "Error: jalankan script ini dari root folder YukSave (tempat package.json berada)."
  exit 1
fi

mkdir -p lib/parsers app components

# 1) lib/parsers/tiktok.ts — retry dengan backoff untuk tikwm + catatan tiklydown terbaru
cat > lib/parsers/tiktok.ts << 'YUKSAVE_EOF'
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
YUKSAVE_EOF

# 2) app/layout.tsx — tambah Twitter Card + canonical URL
cat > app/layout.tsx << 'YUKSAVE_EOF'
import type { Metadata } from "next";
import { headers } from "next/headers";
import { Archivo_Black, Inter, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import Header from "@/components/Header";
import Providers from "@/components/providers/Providers";
import "./globals.css";

const archivoBlack = Archivo_Black({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
});
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

// Runs before React hydrates so the correct theme class is on <html>
// before first paint, avoiding a light/dark flash on load.
const themeInitScript = `
(function () {
  try {
    var stored = window.localStorage.getItem("yuksave-theme");
    var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    var isDark = stored ? stored === "dark" : prefersDark;
    if (isDark) document.documentElement.classList.add("dark");
  } catch (e) {}
})();
`;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://yuksave.example.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "YukSave — Download Video TikTok Tanpa Watermark Gratis",
  description:
    "Download video TikTok tanpa watermark, gratis dan cepat. Tempel link TikTok, dapatkan video HD tanpa logo dalam hitungan detik. Tanpa aplikasi, tanpa login.",
  keywords: [
    "download tiktok tanpa watermark",
    "download video tiktok",
    "tiktok downloader",
    "hapus watermark tiktok",
    "simpan video tiktok",
  ],
  openGraph: {
    title: "YukSave — Download Video TikTok Tanpa Watermark",
    description:
      "Tempel link TikTok, dapatkan video HD tanpa watermark dalam hitungan detik. Gratis, tanpa aplikasi.",
    locale: "id_ID",
    type: "website",
    url: SITE_URL,
  },
  twitter: {
    // Without this block, links shared on Twitter/X fall back to a plain
    // text link instead of a rich card — the openGraph tags above aren't
    // enough on their own, X reads its own twitter:* tags first.
    card: "summary_large_image",
    title: "YukSave — Download Video TikTok Tanpa Watermark",
    description:
      "Tempel link TikTok, dapatkan video HD tanpa watermark dalam hitungan detik. Gratis, tanpa aplikasi.",
  },
  alternates: {
    canonical: SITE_URL,
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Set by proxy.ts per-request; lets this inline script pass the
  // 'script-src ... nonce-<value>' CSP directive instead of needing
  // 'unsafe-inline' (which would defeat the point of having a CSP at all).
  // headers() is async as of Next.js 15+.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang="id"
      suppressHydrationWarning
      className={`${archivoBlack.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <script
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
      </head>
      <body className="font-body">
        <Providers>
          <Header />
          {children}
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
YUKSAVE_EOF

# 3) components/Header.tsx — tambah Escape key untuk menutup dropdown
cat > components/Header.tsx << 'YUKSAVE_EOF'
"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { useTheme } from "@/lib/theme/ThemeContext";
import type { Lang } from "@/lib/i18n/translations";

const LANG_OPTIONS: { value: Lang; label: string; short: string }[] = [
  { value: "id", label: "Bahasa Indonesia", short: "ID" },
  { value: "en", label: "English", short: "EN" },
];

export default function Header() {
  const { lang, setLang, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  const [langOpen, setLangOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close either dropdown when clicking outside it.
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Close either dropdown on Escape — keyboard-only users had no way to
  // dismiss it otherwise, since the outside-click handler above only
  // fires on mouse input.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setLangOpen(false);
        setMenuOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <header className="w-full border-b border-tape">
      <div className="max-w-3xl mx-auto flex items-center justify-between gap-2.5 px-6 py-4">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/logo.svg" alt="YukSave" width={36} height={36} priority />
          <span className="font-display text-lg text-ink tracking-tight">
            YukSave
          </span>
        </Link>

        <div className="flex items-center gap-1.5">
          {/* Language dropdown */}
          <div className="relative" ref={langRef}>
            <button
              type="button"
              onClick={() => setLangOpen((v) => !v)}
              aria-haspopup="listbox"
              aria-expanded={langOpen}
              aria-label={t.header.langLabel}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm font-mono font-medium text-ink-soft hover:text-ink hover:bg-tape/40 transition-colors"
            >
              {LANG_OPTIONS.find((o) => o.value === lang)?.short}
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`transition-transform ${langOpen ? "rotate-180" : ""}`}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {langOpen && (
              <div
                role="listbox"
                className="absolute right-0 mt-1.5 w-40 bg-surface border border-tape rounded-xl shadow-[3px_3px_0_0_rgb(var(--color-ink))] overflow-hidden z-20"
              >
                {LANG_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={lang === opt.value}
                    onClick={() => {
                      setLang(opt.value);
                      setLangOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2.5 text-sm flex items-center justify-between hover:bg-paper transition-colors ${
                      lang === opt.value
                        ? "text-ink font-semibold"
                        : "text-ink-soft"
                    }`}
                  >
                    {opt.label}
                    {lang === opt.value && (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Dark mode toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={
              theme === "dark" ? t.header.themeToLight : t.header.themeToDark
            }
            className="p-2 rounded-lg text-ink-soft hover:text-ink hover:bg-tape/40 transition-colors"
          >
            {theme === "dark" ? (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="4.5" />
                <path d="M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
              </svg>
            ) : (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20.5 14.5a8.5 8.5 0 11-11-11 6.8 6.8 0 0011 11z" />
              </svg>
            )}
          </button>

          {/* Hamburger nav menu */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label={t.header.menuAria}
              className="p-2 rounded-lg text-ink-soft hover:text-ink hover:bg-tape/40 transition-colors"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {menuOpen ? (
                  <path d="M6 6l12 12M18 6L6 18" />
                ) : (
                  <path d="M3 6h18M3 12h18M3 18h18" />
                )}
              </svg>
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-1.5 w-52 bg-surface border border-tape rounded-xl shadow-[3px_3px_0_0_rgb(var(--color-ink))] overflow-hidden z-20"
              >
                <p className="px-3.5 pt-3 pb-1.5 text-[11px] font-mono uppercase tracking-widest text-ink-soft">
                  {t.header.menuTitle}
                </p>
                <Link
                  href="/#cara-pakai"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="block px-3.5 py-2.5 text-sm text-ink-soft hover:text-ink hover:bg-paper transition-colors"
                >
                  {t.header.navCaraPakai}
                </Link>
                <Link
                  href="/privacy"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="block px-3.5 py-2.5 text-sm text-ink-soft hover:text-ink hover:bg-paper transition-colors"
                >
                  {t.footer.privacy}
                </Link>
                <Link
                  href="/terms"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="block px-3.5 py-2.5 text-sm text-ink-soft hover:text-ink hover:bg-paper transition-colors"
                >
                  {t.footer.terms}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
YUKSAVE_EOF

# 4) components/Turnstile.tsx — cegah duplikasi script di React Strict Mode (dev)
cat > components/Turnstile.tsx << 'YUKSAVE_EOF'
"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string;
    };
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

/**
 * Cloudflare Turnstile widget — bot-abuse protection for the download
 * form. Deliberately optional: if NEXT_PUBLIC_TURNSTILE_SITE_KEY isn't
 * set (e.g. local dev, or before you've created a Cloudflare site key),
 * this renders nothing and the form works exactly as before. The server
 * side (app/api/parse/route.ts) mirrors this — it only checks the token
 * if TURNSTILE_SECRET_KEY is configured.
 */
export default function Turnstile({ onToken }: { onToken: (token: string | null) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!SITE_KEY || !containerRef.current) return;

    function renderWidget() {
      if (!window.turnstile || !containerRef.current) return;
      window.turnstile.render(containerRef.current, {
        sitekey: SITE_KEY,
        callback: (token: string) => onToken(token),
        "expired-callback": () => onToken(null),
        "error-callback": () => onToken(null),
      });
    }

    if (window.turnstile) {
      renderWidget();
      return;
    }

    // Strict Mode (React 19, development only) runs this effect twice in
    // a row — without this guard that would inject the Cloudflare script
    // tag twice and could double-render the widget into the container.
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://challenges.cloudflare.com/turnstile/v0/api.js"]'
    );
    if (existing) {
      existing.addEventListener("load", renderWidget);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    script.async = true;
    script.defer = true;
    script.onload = renderWidget;
    document.head.appendChild(script);
    // Not cleaned up on unmount on purpose — Turnstile's script is safe
    // to leave loaded for the lifetime of the page.
  }, [onToken]);

  if (!SITE_KEY) return null;

  return <div ref={containerRef} className="mt-3" />;
}
YUKSAVE_EOF

echo ""
echo "Selesai. 4 file sudah diperbarui:"
echo "  - lib/parsers/tiktok.ts"
echo "  - app/layout.tsx"
echo "  - components/Header.tsx"
echo "  - components/Turnstile.tsx"
echo ""
echo "Cek dulu sebelum commit:"
echo "  git diff"
echo ""
echo "Kalau sudah oke:"
echo "  git add -A && git commit -m 'fix: retry tikwm, SEO metadata, a11y dropdown, guard turnstile script'"
