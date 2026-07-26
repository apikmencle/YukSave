import type { Metadata } from "next";
import Link from "next/link";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://yuksave.example.com";
const PAGE_PATH = "/panduan/download-tiktok-tanpa-watermark-iphone";

export const metadata: Metadata = {
  title: "Cara Download Video TikTok Tanpa Watermark di iPhone — YukSave",
  description:
    "Panduan lengkap download video TikTok tanpa watermark langsung di iPhone, tanpa install aplikasi tambahan. Gratis dan hasil HD dalam hitungan detik.",
  alternates: {
    canonical: `${SITE_URL}${PAGE_PATH}`,
  },
  openGraph: {
    title: "Cara Download Video TikTok Tanpa Watermark di iPhone",
    description:
      "Panduan lengkap download video TikTok tanpa watermark langsung di iPhone, tanpa install aplikasi tambahan.",
    locale: "id_ID",
    type: "article",
    url: `${SITE_URL}${PAGE_PATH}`,
  },
};

const steps = [
  {
    title: "Buka aplikasi TikTok di iPhone",
    body: "Cari video yang ingin kamu simpan seperti biasa.",
  },
  {
    title: "Tap ikon Share (panah keluar)",
    body: "Ikon ini ada di sisi kanan video, lalu pilih \u201cCopy Link\u201d dari menu yang muncul.",
  },
  {
    title: "Buka Safari (atau browser lain) dan kunjungi YukSave",
    body: "Tempel (paste) link yang sudah disalin ke kotak input di halaman utama YukSave.",
  },
  {
    title: "Tap tombol Download",
    body: "YukSave akan memproses link dan menampilkan preview video tanpa watermark, siap diunduh.",
  },
  {
    title: "Simpan ke galeri iPhone",
    body: "Setelah file terunduh, Safari akan menyimpannya otomatis \u2014 buka app Files atau Photos untuk melihatnya.",
  },
];

const faqs = [
  {
    q: "Kenapa video hasil download tidak otomatis masuk ke Photos di iPhone?",
    a: "Tergantung pengaturan Safari kamu. Buka app Files \u2192 folder Downloads untuk menemukan file yang baru diunduh, lalu bisa dipindah manual ke Photos kalau perlu.",
  },
  {
    q: "Apakah cara ini juga berlaku untuk iPad?",
    a: "Ya, langkahnya sama persis karena iPad juga menjalankan Safari dan aplikasi TikTok dengan menu Share yang serupa.",
  },
  {
    q: "Apakah perlu install aplikasi pihak ketiga di App Store?",
    a: "Tidak perlu. YukSave berjalan langsung di browser, dan Apple sendiri cukup ketat soal aplikasi downloader di App Store, jadi cara berbasis browser ini lebih praktis dan aman.",
  },
];

export default function DownloadTiktokIphonePage() {
  return (
    <main className="min-h-screen px-6 py-16 max-w-2xl mx-auto">
      <nav aria-label="Breadcrumb" className="mb-6">
        <Link href="/" className="text-sm text-ink-soft hover:text-ink underline">
          &larr; Kembali ke Beranda
        </Link>
      </nav>

      <h1 className="font-display text-2xl sm:text-3xl text-ink mb-4 leading-tight">
        Cara Download Video TikTok Tanpa Watermark di iPhone
      </h1>

      <p className="text-sm text-ink-soft leading-relaxed mb-8">
        Mau simpan video TikTok favorit ke iPhone tanpa logo watermark yang
        mengganggu? Kamu tidak perlu install aplikasi apa pun dari App Store.
        Cukup lewat browser Safari, prosesnya kurang dari satu menit. Berikut
        langkah lengkapnya.
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
          Sudah siap coba sekarang? Tempel link TikTok kamu langsung di halaman
          utama.
        </p>
        <Link
          href="/"
          className="inline-block px-6 py-3 rounded-xl bg-rec text-white font-body font-semibold hover:bg-rec-dark transition-colors"
        >
          Download Video TikTok Sekarang
        </Link>
      </div>

      <section aria-labelledby="faq-heading" className="mb-10">
        <h2 id="faq-heading" className="font-display text-xl text-ink mb-4">
          Pertanyaan seputar download TikTok di iPhone
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
        Penasaran kenapa TikTok menambahkan watermark sejak awal? Baca{" "}
        <Link
          href="/panduan/apa-itu-watermark-tiktok"
          className="text-ink underline hover:text-rec"
        >
          penjelasan lengkapnya di sini
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
            name: "Cara Download Video TikTok Tanpa Watermark di iPhone",
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
