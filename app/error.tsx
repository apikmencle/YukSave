"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // This boundary only catches client-render crashes — react-dom itself
  // doesn't log them anywhere on its own once an error boundary swallows
  // them. Vercel's function logs only see server-side throws, so without
  // this, a crash here would be completely invisible: no console entry,
  // no Vercel log line, nothing — just a user silently landing on this
  // screen with zero trace of what broke.
  useEffect(() => {
    console.error("[app/error] client render crashed:", error.message, error.digest ? `(digest: ${error.digest})` : "");
  }, [error]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <p className="font-mono text-xs tracking-widest uppercase text-rec-dark mb-3">
        Terjadi Kesalahan
      </p>
      <h1 className="font-display text-2xl text-ink mb-3">
        Ada yang tidak beres
      </h1>
      <p className="text-ink-soft mb-6 max-w-sm">
        Coba muat ulang halaman ini. Kalau masalah berlanjut, coba lagi
        beberapa saat lagi.
      </p>
      <button
        onClick={reset}
        className="px-5 py-2.5 rounded-lg bg-ink text-paper text-sm font-medium hover:bg-ink/90"
      >
        Coba Lagi
      </button>
    </main>
  );
}
