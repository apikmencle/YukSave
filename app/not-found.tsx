import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <p className="font-mono text-xs tracking-widest uppercase text-ink-soft mb-3">
        404
      </p>
      <h1 className="font-display text-3xl text-ink mb-3">
        Halaman tidak ditemukan
      </h1>
      <p className="text-ink-soft mb-6">
        Sepertinya halaman yang kamu cari sudah dipindah atau tidak ada.
      </p>
      <Link
        href="/"
        className="px-5 py-2.5 rounded-lg bg-ink text-white text-sm font-medium hover:bg-ink/90"
      >
        Kembali ke Beranda
      </Link>
    </main>
  );
}
