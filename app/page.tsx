"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { addToHistory, clearHistory, loadHistory, type HistoryItem } from "@/lib/history";
import Turnstile from "@/components/Turnstile";
import SafeThumb from "@/components/SafeThumb";

// After this long in the "loading" state, show a note that the source
// server seems slow rather than leaving the person staring at a silent
// spinner wondering if the app is stuck.
const SLOW_NOTICE_MS = 4000;

type ParseResult = {
  title: string;
  author: string;
  durationSec: number;
  thumbnail: string;
  noWatermarkUrl?: string;
  watermarkUrl?: string;
  images?: string[];
  musicUrl?: string;
};

/**
 * Cross-origin URLs ignore the <a download> attribute on mobile browsers,
 * so real downloads are routed through our own /api/download proxy, which
 * sets a Content-Disposition header that forces a save instead of opening
 * the file inline.
 */
// Mirrors the check in app/api/parse/route.ts — validating here too lets
// us reject an obviously-wrong link instantly, without a round trip to
// the server just to get the same rejection back.
const TIKTOK_URL_PATTERN = /tiktok\.com|vt\.tiktok|vm\.tiktok/;

// Mirrors the same env check Turnstile.tsx does internally: Turnstile is
// only actually rendered (and therefore only actually gates anything)
// when a site key is configured. Without this check the submit button
// would stay permanently disabled in local dev / on deployments that
// haven't set up Cloudflare yet, since turnstileToken would never get set.
const TURNSTILE_REQUIRED = !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

function downloadHref(sourceUrl: string, filename: string) {
  return `/api/download?url=${encodeURIComponent(sourceUrl)}&filename=${encodeURIComponent(filename)}`;
}

export default function HomePage() {
  const { t } = useLanguage();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [slow, setSlow] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [zippingPhotos, setZippingPhotos] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const slowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);

  // Load on mount only — this is on-device data, never fetched from our
  // API, so there's nothing to keep in sync with the server.
  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  // Scroll the result panel into view once it appears, so the person
  // doesn't have to manually scroll down after tapping download —
  // especially useful on mobile where the result renders below the fold.
  useEffect(() => {
    if (result) {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [result]);

  function handleCancel() {
    abortRef.current?.abort();
  }

  function handleReuseHistory(item: HistoryItem) {
    setUrl(item.url);
    setError(null);
  }

  function handleClearHistory() {
    clearHistory();
    setHistory([]);
  }

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text.trim());
        setError(null);
      }
    } catch {
      // Clipboard API needs a secure context + user permission; if it's
      // blocked (older browser, permission denied, etc.) just let the
      // person paste manually instead of failing silently forever.
      setError(t.form.pasteFailed);
    }
  }

  async function handleDownloadAllPhotos() {
    if (!result?.images || result.images.length === 0) return;
    setZippingPhotos(true);
    try {
      // Dynamic import: jszip is only needed for this one action, no
      // reason to add it to the main bundle everyone downloads.
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();

      // Fetch every photo through our own /api/download proxy — same
      // origin, so no CORS problem — rather than the TikTok CDN
      // directly, which wouldn't let client-side JS read the bytes.
      // Each fetch is checked for res.ok before reading the body: without
      // this, a failed proxy request (expired signed URL, host rejected,
      // upstream timeout) still returns a response — just a JSON error
      // body instead of image bytes — and .blob() happily wraps that too.
      // That silently produced a "successful" zip containing a corrupt
      // file (JSON text saved as .jpg) with no indication anything failed.
      const blobs = await Promise.all(
        result.images.map(async (imgUrl) => {
          const res = await fetch(downloadHref(imgUrl, "photo.jpg"));
          if (!res.ok) {
            throw new Error(`Gagal mengunduh salah satu foto (HTTP ${res.status})`);
          }
          return res.blob();
        })
      );
      blobs.forEach((blob, i) => {
        zip.file(`${result.title || "yuksave"}-${i + 1}.jpg`, blob);
      });

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const zipUrl = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = zipUrl;
      a.download = `${result.title || "yuksave"}.zip`;
      a.click();
      URL.revokeObjectURL(zipUrl);
    } catch (err) {
      console.error("[handleDownloadAllPhotos] failed:", err instanceof Error ? err.message : err);
      setError(t.form.errorGeneric);
    } finally {
      setZippingPhotos(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setSlow(false);

    if (!url.trim()) {
      setError(t.form.errorEmpty);
      return;
    }
    if (!TIKTOK_URL_PATTERN.test(url)) {
      setError(t.apiErrors.invalid_url);
      return;
    }
    // Belt-and-suspenders: the submit button is already disabled while
    // this is true, but a stale click event (e.g. Enter key fired just
    // before the widget finished loading) could still reach here.
    if (TURNSTILE_REQUIRED && !turnstileToken) {
      setError(t.form.turnstilePending);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    slowTimerRef.current = setTimeout(() => setSlow(true), SLOW_NOTICE_MS);

    setLoading(true);
    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, turnstileToken }),
        signal: controller.signal,
      });
      const data = await res.json();

      if (!res.ok) {
        const code = data?.code as keyof typeof t.apiErrors | undefined;
        setError((code && t.apiErrors[code]) ?? t.form.errorGeneric);
        return;
      }
      setResult(data);
      setHistory(
        addToHistory({
          url,
          title: data.title,
          author: data.author,
          thumbnail: data.thumbnail,
        })
      );
    } catch (err) {
      // A user-triggered cancel isn't an error worth showing red text for.
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(t.form.errorConnection);
    } finally {
      if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
      setSlow(false);
      setLoading(false);
      abortRef.current = null;
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center px-6 py-16">
      {/* Hero */}
      <div className="w-full max-w-xl text-center mb-10">
        <div className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full border border-ink/15 bg-surface/40">
          <span className="w-2.5 h-2.5 rounded-full bg-rec rec-dot" />
          <span className="font-mono text-xs tracking-widest uppercase text-ink-soft">
            {t.hero.badge}
          </span>
        </div>
        <h1 className="font-display text-4xl sm:text-5xl leading-tight text-ink">
          {t.hero.title1}
          <br />
          {t.hero.title2}
        </h1>
        <p className="mt-4 text-ink-soft text-base">{t.hero.subtitle}</p>
      </div>

      {/* Cassette-style input */}
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-xl bg-surface border-2 border-ink rounded-2xl p-4 sm:p-5 shadow-[6px_6px_0_0_rgb(var(--color-ink))]"
      >
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t.form.placeholder}
              className="w-full font-mono text-sm pl-4 pr-11 py-3 rounded-xl border border-tape bg-paper focus:outline-none focus:ring-2 focus:ring-rec"
              disabled={loading}
            />
            <button
              type="button"
              onClick={handlePaste}
              disabled={loading}
              aria-label={t.form.pasteAria}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 rounded-lg text-ink-soft hover:text-ink hover:bg-tape/40 transition-colors disabled:opacity-50"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="7" y="4" width="10" height="16" rx="2" />
                <path d="M9 4V3a1 1 0 011-1h4a1 1 0 011 1v1" />
                <path d="M9 11h6M9 15h4" />
              </svg>
            </button>
          </div>
          <button
            type="submit"
            disabled={loading || (TURNSTILE_REQUIRED && !turnstileToken)}
            className="px-6 py-3 rounded-xl bg-rec text-white font-body font-semibold hover:bg-rec-dark transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading && (
              <svg
                className="animate-spin"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeOpacity="0.3"
                />
                <path
                  d="M21 12a9 9 0 00-9-9"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            )}
            {loading ? t.form.processing : t.form.download}
          </button>
          {loading && (
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-3 rounded-xl border border-ink/20 text-ink-soft text-sm font-medium hover:bg-paper transition-colors"
            >
              {t.form.cancel}
            </button>
          )}
        </div>
        <Turnstile onToken={setTurnstileToken} />
        {error && (
          <p className="mt-3 text-sm text-rec-dark font-medium" role="alert">
            {error}
          </p>
        )}
        {loading && slow && (
          <p className="mt-3 text-sm text-ink-soft" role="status">
            {t.form.slowNotice}
          </p>
        )}
      </form>

      {/* Feature showcase: video / foto / mp3 */}
      <div className="w-full max-w-xl grid grid-cols-3 gap-3 mt-6">
        <div className="bg-surface border border-tape rounded-xl p-4 text-center">
          <svg
            className="mx-auto mb-1.5 text-ink"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="5" width="14" height="14" rx="2" />
            <path d="M17 9.5l4-2.5v10l-4-2.5" />
          </svg>
          <p className="text-xs font-semibold text-ink">
            {t.features.video.title}
          </p>
          <p className="text-xs text-ink-soft mt-0.5">
            {t.features.video.desc}
          </p>
        </div>
        <div className="bg-surface border border-tape rounded-xl p-4 text-center">
          <svg
            className="mx-auto mb-1.5 text-ink"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5-6 6" />
            <path d="M9 21l4-4" />
          </svg>
          <p className="text-xs font-semibold text-ink">
            {t.features.photo.title}
          </p>
          <p className="text-xs text-ink-soft mt-0.5">
            {t.features.photo.desc}
          </p>
        </div>
        <div className="bg-surface border border-tape rounded-xl p-4 text-center">
          <svg
            className="mx-auto mb-1.5 text-ink"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 18V5l10-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="16" cy="16" r="3" />
          </svg>
          <p className="text-xs font-semibold text-ink">
            {t.features.audio.title}
          </p>
          <p className="text-xs text-ink-soft mt-0.5">
            {t.features.audio.desc}
          </p>
        </div>
      </div>

      {/* Empty state: ajakan sebelum ada hasil apapun */}
      {!loading && !result && !error && (
        <div className="w-full max-w-xl mt-8 flex flex-col items-center text-center px-6">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-ink-soft mb-2 -translate-y-1"
          >
            <path d="M12 19V5M12 5l-5 5M12 5l5 5" />
          </svg>
          <p className="text-sm text-ink-soft">{t.emptyState.hint}</p>
        </div>
      )}

      {/* Skeleton loading panel */}
      {loading && (
        <div className="w-full max-w-xl mt-8 bg-surface border-2 border-ink rounded-2xl p-5">
          <div className="flex gap-4">
            <div className="skeleton w-24 h-32 rounded-lg shrink-0" />
            <div className="flex-1 space-y-2.5 py-1">
              <div className="skeleton h-4 rounded w-3/4" />
              <div className="skeleton h-3 rounded w-1/3" />
              <div className="skeleton h-3 rounded w-1/4" />
              <div className="flex gap-2 mt-4">
                <div className="skeleton h-9 rounded-lg w-36" />
                <div className="skeleton h-9 rounded-lg w-24" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Result panel */}
      {!loading && result && (
        <div
          ref={resultRef}
          className="w-full max-w-xl mt-8 bg-surface border-2 border-ink rounded-2xl p-5 scroll-mt-6"
        >
          <div className="flex gap-4">
            {!result.images && (result.noWatermarkUrl || result.watermarkUrl) ? (
              <video
  src={result.noWatermarkUrl || result.watermarkUrl}
  poster={result.thumbnail}
  controls
  controlsList="nodownload noplaybackrate nofullscreen"
  disablePictureInPicture
  playsInline
  preload="none"
  onContextMenu={(e) => e.preventDefault()}
  className="w-24 h-32 object-cover rounded-lg border border-tape bg-black shrink-0"
/>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-body font-semibold text-ink truncate">
                {result.title}
              </p>
              <p className="text-sm text-ink-soft">@{result.author}</p>
              {!result.images && (
                <p className="font-mono text-xs tape-counter text-ink-soft mt-1">
                  {String(Math.floor(result.durationSec / 60)).padStart(2, "0")}:
                  {String(result.durationSec % 60).padStart(2, "0")}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {result.noWatermarkUrl && (
                  <a
                    href={downloadHref(result.noWatermarkUrl, `${result.title}.mp4`)}
                    className="px-4 py-2 rounded-lg bg-ink text-paper text-sm font-medium hover:bg-ink/90"
                  >
                    {t.result.downloadNoWatermark}
                  </a>
                )}
                {result.watermarkUrl && (
                  <a
                    href={downloadHref(result.watermarkUrl, `${result.title}-wm.mp4`)}
                    className="px-4 py-2 rounded-lg border border-ink/20 text-ink text-sm font-medium hover:bg-paper"
                  >
                    {t.result.downloadWithWatermark}
                  </a>
                )}
                {result.musicUrl && (
                  <a
                    href={downloadHref(result.musicUrl, `${result.title}.mp3`)}
                    className="px-4 py-2 rounded-lg border border-ink/20 text-ink text-sm font-medium hover:bg-paper"
                  >
                    {t.result.downloadAudio}
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Slideshow foto: satu link download per gambar */}
          {result.images && result.images.length > 0 && (
            <div className="mt-4 pt-4 border-t border-tape">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-ink">
                  {t.result.slideshowCount(result.images.length)}
                </p>
                <button
                  type="button"
                  onClick={handleDownloadAllPhotos}
                  disabled={zippingPhotos}
                  className="px-3 py-1.5 rounded-lg bg-ink text-paper text-xs font-medium hover:bg-ink/90 disabled:opacity-60 flex items-center gap-1.5"
                >
                  {zippingPhotos && (
                    <svg
                      className="animate-spin"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        cx="12"
                        cy="12"
                        r="9"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeOpacity="0.3"
                      />
                      <path
                        d="M21 12a9 9 0 00-9-9"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                      />
                    </svg>
                  )}
                  {zippingPhotos
                    ? t.result.zippingPhotos
                    : t.result.downloadAllPhotos}
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {result.images.map((imgUrl, i) => (
                  <div
                    key={imgUrl}
                    className="rounded-lg overflow-hidden border border-tape"
                  >
                    <SafeThumb
                      src={imgUrl}
                      alt={t.result.photoAlt(i + 1)}
                      className="w-full h-24"
                      sizes="(min-width: 640px) 192px, 33vw"
                    />
                    <a
                      href={downloadHref(imgUrl, `${result.title}-${i + 1}.jpg`)}
                      className="block text-center py-1.5 text-xs font-medium text-paper bg-ink hover:bg-ink/90"
                    >
                      {t.result.download}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Download history — stored only in this browser (localStorage),
          never sent to our server. Purely a convenience list. */}
      {history.length > 0 && (
        <div className="w-full max-w-xl mt-10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-lg text-ink">{t.history.heading}</h2>
            <button
              type="button"
              onClick={handleClearHistory}
              className="text-xs text-ink-soft hover:text-ink underline"
            >
              {t.history.clear}
            </button>
          </div>
          <div className="space-y-2">
            {history.map((item) => (
              <div
                key={item.url}
                className="flex items-center gap-3 bg-surface border border-tape rounded-xl p-2.5"
              >
                <SafeThumb
                  src={item.thumbnail}
                  alt={item.title}
                  className="w-10 h-12 rounded-md border border-tape shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{item.title}</p>
                  <p className="text-xs text-ink-soft">@{item.author}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleReuseHistory(item)}
                  className="shrink-0 px-3 py-1.5 rounded-lg border border-ink/20 text-ink text-xs font-medium hover:bg-paper"
                >
                  {t.history.reuse}
                </button>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-soft">{t.history.disclaimer}</p>
        </div>
      )}

      {/* SEO content: how-to + FAQ */}
      <section id="cara-pakai" className="w-full max-w-xl mt-16">
        <h2 className="font-display text-xl text-ink mb-4">
          {t.howTo.heading}
        </h2>
        <ol className="space-y-2 text-sm text-ink-soft list-decimal list-inside">
          {t.howTo.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>

        <h2 className="font-display text-xl text-ink mt-10 mb-4">
          {t.faq.heading}
        </h2>
        <div className="space-y-4">
          {t.faq.items.map((item) => (
            <div key={item.q}>
              <p className="font-semibold text-sm text-ink">{item.q}</p>
              <p className="text-sm text-ink-soft">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="panduan-heading" className="w-full max-w-xl mt-16">
        <p className="font-mono text-[11px] tracking-wider text-ink-soft uppercase mb-1.5">
          Seri Panduan
        </p>
        <h2 id="panduan-heading" className="font-display text-xl text-ink mb-5">
          Panduan &amp; Tips
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/panduan/download-tiktok-tanpa-watermark-iphone"
            className="group flex items-start gap-3 bg-surface border border-tape rounded-xl p-4 transition-all duration-150 hover:border-ink hover:-translate-y-0.5 hover:shadow-[4px_4px_0_0_rgb(var(--color-ink))]"
          >
            <svg
              className="shrink-0 mt-0.5 text-ink"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="7" y="2" width="10" height="20" rx="2" />
              <line x1="11" y1="18" x2="13" y2="18" />
            </svg>
            <span className="flex-1">
              <span className="block text-sm font-semibold text-ink">
                Download tanpa watermark di iPhone
              </span>
              <span className="block text-xs text-ink-soft mt-0.5">
                Lewat Safari, tanpa install apa pun.
              </span>
            </span>
            <svg
              className="shrink-0 mt-1 text-ink-soft transition-transform group-hover:translate-x-0.5 group-hover:text-rec"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>

          <Link
            href="/panduan/download-tiktok-tanpa-watermark-android"
            className="group flex items-start gap-3 bg-surface border border-tape rounded-xl p-4 transition-all duration-150 hover:border-ink hover:-translate-y-0.5 hover:shadow-[4px_4px_0_0_rgb(var(--color-ink))]"
          >
            <svg
              className="shrink-0 mt-0.5 text-ink"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="6" y="2" width="12" height="20" rx="2" />
              <line x1="10" y1="18" x2="14" y2="18" />
            </svg>
            <span className="flex-1">
              <span className="block text-sm font-semibold text-ink">
                Download tanpa watermark di Android
              </span>
              <span className="block text-xs text-ink-soft mt-0.5">
                Lewat Chrome, tanpa APK tambahan.
              </span>
            </span>
            <svg
              className="shrink-0 mt-1 text-ink-soft transition-transform group-hover:translate-x-0.5 group-hover:text-rec"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>

          <Link
            href="/panduan/apa-itu-watermark-tiktok"
            className="group flex items-start gap-3 bg-surface border border-tape rounded-xl p-4 transition-all duration-150 hover:border-ink hover:-translate-y-0.5 hover:shadow-[4px_4px_0_0_rgb(var(--color-ink))]"
          >
            <svg
              className="shrink-0 mt-0.5 text-ink"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="9" />
              <line x1="12" y1="11" x2="12" y2="16" />
              <circle cx="12" cy="7.5" r="0.9" fill="currentColor" stroke="none" />
            </svg>
            <span className="flex-1">
              <span className="block text-sm font-semibold text-ink">
                Apa itu watermark TikTok?
              </span>
              <span className="block text-xs text-ink-soft mt-0.5">
                Kenapa logo itu muncul, dan kapan boleh dihilangkan.
              </span>
            </span>
            <svg
              className="shrink-0 mt-1 text-ink-soft transition-transform group-hover:translate-x-0.5 group-hover:text-rec"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>

          <Link
            href="/panduan/download-foto-slideshow-tiktok"
            className="group flex items-start gap-3 bg-surface border border-tape rounded-xl p-4 transition-all duration-150 hover:border-ink hover:-translate-y-0.5 hover:shadow-[4px_4px_0_0_rgb(var(--color-ink))]"
          >
            <svg
              className="shrink-0 mt-0.5 text-ink"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="6" width="14" height="14" rx="2" />
              <path d="M7 2h14v14" />
            </svg>
            <span className="flex-1">
              <span className="block text-sm font-semibold text-ink">
                Download foto slideshow
              </span>
              <span className="block text-xs text-ink-soft mt-0.5">
                Simpan tiap foto satu per satu, langsung dari server.
              </span>
            </span>
            <svg
              className="shrink-0 mt-1 text-ink-soft transition-transform group-hover:translate-x-0.5 group-hover:text-rec"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>

          <Link
            href="/panduan/download-audio-musik-tiktok-mp3"
            className="group flex items-start gap-3 bg-surface border border-tape rounded-xl p-4 transition-all duration-150 hover:border-ink hover:-translate-y-0.5 hover:shadow-[4px_4px_0_0_rgb(var(--color-ink))] sm:col-span-2"
          >
            <svg
              className="shrink-0 mt-0.5 text-ink"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 18V5l11-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="17" cy="16" r="3" />
            </svg>
            <span className="flex-1">
              <span className="block text-sm font-semibold text-ink">
                Ambil audio/musik jadi MP3
              </span>
              <span className="block text-xs text-ink-soft mt-0.5">
                Simpan musik dari video TikTok sebagai file terpisah.
              </span>
            </span>
            <svg
              className="shrink-0 mt-1 text-ink-soft transition-transform group-hover:translate-x-0.5 group-hover:text-rec"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
        </div>
      </section>

      <footer className="w-full max-w-xl mt-16 pt-6 border-t border-tape text-center">
        <p className="text-xs text-ink-soft">{t.footer.note}</p>
        <div className="mt-3 flex items-center justify-center gap-3 text-xs">
          <Link href="/privacy" className="text-ink-soft hover:text-ink underline">
            {t.footer.privacy}
          </Link>
          <span className="text-tape">&middot;</span>
          <Link href="/terms" className="text-ink-soft hover:text-ink underline">
            {t.footer.terms}
          </Link>
        </div>
        <p className="mt-4 font-mono text-xs text-ink-soft">
          &copy; {new Date().getFullYear()} YukSave
        </p>
      </footer>
    </main>
  );
}
