import type { Metadata } from "next";
import Link from "next/link";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://yuksave.example.com";
const PAGE_PATH = "/panduan/download-audio-musik-tiktok-mp3";

export const metadata: Metadata = {
  title: "Cara Ambil Audio/Musik TikTok Jadi MP3 — YukSave",
  description:
    "Panduan mengambil audio atau musik dari video TikTok dan menyimpannya sebagai file MP3, gratis dan tanpa install aplikasi tambahan.",
  alternates: {
    canonical: `${SITE_URL}${PAGE_PATH}`,
  },
  openGraph: {
    title: "Cara Ambil Audio/Musik TikTok Jadi MP3",
    description:
      "Panduan mengambil audio atau musik dari video TikTok dan menyimpannya sebagai file MP3, gratis dan tanpa install aplikasi tambahan.",
    locale: "id_ID",
    type: "article",
    url: `${SITE_URL}${PAGE_PATH}`,
  },
};

const steps = [
  {
    title: "Buka video TikTok yang musiknya ingin kamu simpan",
    body: "Bisa video biasa maupun postingan slideshow, keduanya bisa punya audio yang bisa diambil terpisah.",
  },
  {
    title: "Tap ikon Share, lalu Copy Link",
    body: "Ikon Share ada di sisi kanan video atau slideshow.",
  },
  {
    title: "Tempel link di YukSave",
    body: "Buka halaman utama YukSave, lalu paste link video ke kotak input.",
  },
  {
    title: "Cari tombol \u201cDownload Audio (MP3)\u201d",
    body: "Kalau video tersebut punya audio yang bisa diambil terpisah, tombol ini akan muncul di samping tombol download video.",
  },
  {
    title: "Simpan file MP3",
    body: "Tap tombol tersebut, file MP3 akan otomatis terunduh dan bisa diputar lewat aplikasi musik apa pun di HP kamu.",
  },
];

const faqs = [
  {
    q: "Kenapa tombol Download Audio tidak muncul di beberapa video?",
    a: "Beberapa video menggunakan audio original milik kreator sendiri (bukan lagu dari library musik TikTok) yang kadang tidak selalu bisa diekstrak terpisah tergantung bagaimana video itu diunggah.",
  },
  {
    q: "Apakah hasil MP3-nya full durasi lagu aslinya?",
    a: "Tidak. Hasilnya hanya sepanjang potongan audio yang dipakai di video TikTok tersebut, bukan lagu utuh dari awal sampai akhir.",
  },
  {
    q: "Apakah legal menyimpan musik TikTok untuk didengarkan sendiri?",
    a: "Untuk didengarkan pribadi umumnya tidak masalah. Yang perlu dihindari adalah menggunakan potongan musik itu secara komersial atau mengklaimnya sebagai milik sendiri, karena hak cipta lagu tetap ada pada pemilik aslinya.",
  },
];

export default function DownloadAudioTiktokPage() {
  return (
    <main className="min-h-screen px-6 py-16 max-w-2xl mx-auto">
      <nav aria-label="Breadcrumb" className="mb-6">
        <Link href="/" className="text-sm text-ink-soft hover:text-ink underline">
          &larr; Kembali ke Beranda
        </Link>
      </nav>

      <h1 className="font-display text-2xl sm:text-3xl text-ink mb-4 leading-tight">
        Cara Ambil Audio/Musik TikTok Jadi MP3
      </h1>

      <p className="text-sm text-ink-soft leading-relaxed mb-8">
        Suka dengan musik atau audio dari sebuah video TikTok dan ingin
        menyimpannya terpisah sebagai file MP3? Berikut cara mengambilnya,
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
          Sudah siap coba sekarang? Tempel link video TikTok kamu langsung di
          halaman utama.
        </p>
        <Link
          href="/"
          className="inline-block px-6 py-3 rounded-xl bg-rec text-white font-body font-semibold hover:bg-rec-dark transition-colors"
        >
          Ambil Audio Sekarang
        </Link>
      </div>

      <section aria-labelledby="faq-heading" className="mb-10">
        <h2 id="faq-heading" className="font-display text-xl text-ink mb-4">
          Pertanyaan seputar ambil audio TikTok
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
        Butuh mengambil semua foto dari postingan slideshow juga? Lihat
        panduan{" "}
        <Link
          href="/panduan/download-foto-slideshow-tiktok"
          className="text-ink underline hover:text-rec"
        >
          cara download foto slideshow TikTok
        </Link>
        .
      </p>

      <p className="text-xs text-ink-soft border-t border-tape pt-6">
        Untuk penggunaan pribadi &mdash; hormati hak cipta pemilik musik dan
        kreator asli.
      </p>

      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "HowTo",
            name: "Cara Ambil Audio/Musik TikTok Jadi MP3",
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
