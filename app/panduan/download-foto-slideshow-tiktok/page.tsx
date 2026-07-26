import type { Metadata } from "next";
import Link from "next/link";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://yuksave.example.com";
const PAGE_PATH = "/panduan/download-foto-slideshow-tiktok";

export const metadata: Metadata = {
  title: "Cara Download Foto Slideshow TikTok — YukSave",
  description:
    "Panduan download semua foto dari postingan slideshow TikTok satu per satu, tanpa watermark dan tanpa install aplikasi. Gratis dan cepat.",
  alternates: {
    canonical: `${SITE_URL}${PAGE_PATH}`,
  },
  openGraph: {
    title: "Cara Download Foto Slideshow TikTok",
    description:
      "Panduan download semua foto dari postingan slideshow TikTok satu per satu, tanpa watermark dan tanpa install aplikasi.",
    locale: "id_ID",
    type: "article",
    url: `${SITE_URL}${PAGE_PATH}`,
  },
};

const steps = [
  {
    title: "Buka postingan slideshow di TikTok",
    body: "Slideshow adalah postingan berisi beberapa foto berurutan (biasanya diiringi musik), bukan video biasa.",
  },
  {
    title: "Tap ikon Share, lalu Copy Link",
    body: "Sama seperti video biasa, ikon Share ada di sisi kanan postingan.",
  },
  {
    title: "Tempel link di YukSave",
    body: "Buka halaman utama YukSave, lalu paste link slideshow ke kotak input.",
  },
  {
    title: "Pilih foto yang mau diunduh",
    body: "YukSave otomatis mendeteksi postingan sebagai slideshow dan menampilkan setiap foto satu per satu untuk diunduh, bukan sebagai satu file video.",
  },
  {
    title: "Download audio latar (opsional)",
    body: "Kalau slideshow itu punya musik latar, tombol \u201cDownload Audio (MP3)\u201d juga akan muncul supaya kamu bisa simpan musiknya terpisah.",
  },
];

const faqs = [
  {
    q: "Apa bedanya slideshow dengan video TikTok biasa?",
    a: "Slideshow adalah kumpulan foto yang diputar berurutan dengan musik latar, sedangkan video biasa adalah rekaman video utuh. Karena strukturnya beda, downloader perlu mendeteksi dan memisahkan tiap foto, tidak bisa disatukan jadi satu file video begitu saja.",
  },
  {
    q: "Bisa download semua foto sekaligus atau harus satu-satu?",
    a: "Di YukSave, setiap foto ditampilkan sebagai item terpisah yang bisa diunduh satu per satu. Ini supaya kamu bisa pilih foto tertentu saja kalau tidak butuh semuanya.",
  },
  {
    q: "Apakah hasil fotonya full resolusi atau terkompresi?",
    a: "YukSave mengambil foto langsung dari server TikTok, jadi kualitasnya sama seperti versi yang diunggah pembuatnya, tanpa kompresi tambahan dari pihak downloader.",
  },
];

export default function DownloadSlideshowTiktokPage() {
  return (
    <main className="min-h-screen px-6 py-16 max-w-2xl mx-auto">
      <nav aria-label="Breadcrumb" className="mb-6">
        <Link href="/" className="text-sm text-ink-soft hover:text-ink underline">
          &larr; Kembali ke Beranda
        </Link>
      </nav>

      <h1 className="font-display text-2xl sm:text-3xl text-ink mb-4 leading-tight">
        Cara Download Foto Slideshow TikTok
      </h1>

      <p className="text-sm text-ink-soft leading-relaxed mb-8">
        Postingan TikTok tidak selalu berupa video &mdash; banyak juga yang
        berbentuk slideshow foto dengan musik latar. Berikut cara menyimpan
        semua foto dari slideshow tersebut ke galeri, tanpa watermark dan
        tanpa install aplikasi tambahan.
      </p>

      <section aria-labelledby="langkah-heading" className="mb-10">
        <h2 id="langkah-heading" className="font-display text-xl text-ink mb-4">
          Langkah-langkah
        </h2>
        <ol className="space-y-4">
          {steps.map((step, i) => (
            <li
              key={step.title}
              className="bg-surface border border-tape rounded-xl p-4"
            >
              <p className="font-semibold text-sm text-ink mb-1">
                {i + 1}. {step.title}
              </p>
              <p className="text-sm text-ink-soft">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <div className="bg-surface border-2 border-ink rounded-2xl p-5 text-center mb-10 shadow-[6px_6px_0_0_rgb(var(--color-ink))]">
        <p className="text-sm text-ink-soft mb-3">
          Sudah siap coba sekarang? Tempel link slideshow TikTok kamu langsung
          di halaman utama.
        </p>
        <Link
          href="/"
          className="inline-block px-6 py-3 rounded-xl bg-rec text-white font-body font-semibold hover:bg-rec-dark transition-colors"
        >
          Download Sekarang
        </Link>
      </div>

      <section aria-labelledby="faq-heading" className="mb-10">
        <h2 id="faq-heading" className="font-display text-xl text-ink mb-4">
          Pertanyaan seputar download slideshow TikTok
        </h2>
        <div className="space-y-4">
          {faqs.map((item) => (
            <div key={item.q}>
              <p className="font-semibold text-sm text-ink">{item.q}</p>
              <p className="text-sm text-ink-soft">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      <p className="text-sm text-ink-soft mb-6">
        Butuh musik latar dari slideshow ini secara terpisah? Lihat panduan{" "}
        <Link
          href="/panduan/download-audio-musik-tiktok-mp3"
          className="text-ink underline hover:text-rec"
        >
          cara ambil audio TikTok jadi MP3
        </Link>
        .
      </p>

      <p className="text-xs text-ink-soft border-t border-tape pt-6">
        Untuk penggunaan pribadi &mdash; hormati hak cipta kreator asli.
      </p>

      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "HowTo",
            name: "Cara Download Foto Slideshow TikTok",
            step: steps.map((step) => ({
              "@type": "HowToStep",
              name: step.title,
              text: step.body,
            })),
          }),
        }}
      />
    </main>
  );
}
