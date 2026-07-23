"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
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
        className="px-5 py-2.5 rounded-lg bg-ink text-white text-sm font-medium hover:bg-ink/90"
      >
        Coba Lagi
      </button>
    </main>
  );
}
