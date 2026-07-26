import type { Metadata } from "next";
import Link from "next/link";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://yuksave.example.com";
const PAGE_PATH = "/panduan/apa-itu-watermark-tiktok";

export const metadata: Metadata = {
  title: "Apa Itu Watermark TikTok? Alasan dan Cara Menghilangkannya — YukSave",
  description:
    "Watermark TikTok adalah logo dan username yang otomatis ditempel di video saat diunduh. Ini alasan TikTok menambahkannya dan cara menghilangkannya secara legal untuk pemakaian pribadi.",
  alternates: {
    canonical: `${SITE_URL}${PAGE_PATH}`,
  },
  openGraph: {
    title: "Apa Itu Watermark TikTok? Alasan dan Cara Menghilangkannya",
    description:
      "Watermark TikTok adalah logo dan username yang otomatis ditempel di video saat diunduh. Ini alasan TikTok menambahkannya dan cara menghilangkannya.",
    locale: "id_ID",
    type: "article",
    url: `${SITE_URL}${PAGE_PATH}`,
  },
};

const faqs = [
  {
    q: "Apakah watermark TikTok bisa dihilangkan permanen dari video aslinya?",
    a: "Tidak. Watermark ditempel oleh TikTok saat video diunduh lewat aplikasi resmi, bukan bagian permanen dari file video di server mereka. Karena itu, mengambil video langsung dari server sebelum watermark ditambahkan menghasilkan file yang bersih tanpa perlu edit apa pun.",
  },
  {
    q: "Apakah legal mengunduh video TikTok tanpa watermark?",
    a: "Untuk pemakaian pribadi (disimpan sendiri, ditonton ulang, bukan diklaim sebagai karya sendiri atau disebarluaskan untuk keuntungan) umumnya tidak masalah. Yang perlu dihindari adalah mengunggah ulang video orang lain sebagai kontenmu sendiri tanpa izin atau kredit \u2014 itu tetap pelanggaran hak cipta terlepas dari ada-tidaknya watermark.",
  },
  {
    q: "Kenapa beberapa aplikasi downloader lain hasilnya masih ada watermark?",
    a: "Beberapa layanan hanya mengunduh video versi yang sudah dipublikasikan (sudah ada watermark-nya), bukan mengambil dari sumber sebelum watermark ditambahkan. Itu bedanya dengan layanan yang mengakses versi mentah langsung dari server.",
  },
];

export default function ApaItuWatermarkTiktokPage() {
  return (
    <main className="min-h-screen px-6 py-16 max-w-2xl mx-auto">
      <nav aria-label="Breadcrumb" className="mb-6">
        <Link href="/" className="text-sm text-ink-soft hover:text-ink underline">
          &larr; Kembali ke Beranda
        </Link>
      </nav>

      <h1 className="font-display text-2xl sm:text-3xl text-ink mb-4 leading-tight">
        Apa Itu Watermark TikTok? Alasan dan Cara Menghilangkannya
      </h1>

      <p className="text-sm text-ink-soft leading-relaxed mb-8">
        Pernah download video TikTok terus muncul logo dan username kecil di
        pojok yang menutupi sebagian gambar? Itulah watermark. Yuk kenalan
        lebih jauh apa fungsinya, kenapa TikTok menambahkannya, dan bagaimana
        cara mendapatkan video tanpa watermark tersebut secara sah untuk
        pemakaian pribadi.
      </p>

      <section className="mb-8">
        <h2 className="font-display text-xl text-ink mb-3">
          Apa itu watermark TikTok?
        </h2>
        <p className="text-sm text-ink-soft leading-relaxed">
          Watermark TikTok adalah logo bulat berlogo not musik TikTok beserta
          username pembuat video, yang otomatis ditempelkan di video begitu
          diunduh lewat aplikasi TikTok resmi. Biasanya posisinya bergerak
          atau berpindah-pindah di sekitar tepi video supaya tidak mudah
          ditutupi atau dipotong.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="font-display text-xl text-ink mb-3">
          Kenapa TikTok menambahkan watermark?
        </h2>
        <ul className="space-y-2 text-sm text-ink-soft list-disc list-inside">
          <li>
            <span className="font-semibold text-ink">Identitas kreator</span>{" "}
            &mdash; supaya siapa pun yang melihat video (walau sudah dibagikan
            ke platform lain) tahu siapa pembuat aslinya.
          </li>
          <li>
            <span className="font-semibold text-ink">Branding TikTok</span>{" "}
            &mdash; setiap video yang dibagikan ulang otomatis jadi promosi
            gratis untuk aplikasi TikTok itu sendiri.
          </li>
          <li>
            <span className="font-semibold text-ink">Mencegah klaim sepihak</span>{" "}
            &mdash; watermark mempersulit orang lain mengklaim video sebagai
            karya sendiri di platform lain.
          </li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="font-display text-xl text-ink mb-3">
          Apakah menghilangkan watermark melanggar aturan?
        </h2>
        <p className="text-sm text-ink-soft leading-relaxed">
          Untuk disimpan dan ditonton sendiri, umumnya tidak masalah. Yang
          jadi pelanggaran adalah kalau video hasil unduhan diunggah ulang ke
          platform lain seolah-olah itu karya sendiri, tanpa kredit ke
          kreator aslinya. Watermark memang salah satu cara TikTok melindungi
          kreatornya, jadi tetap hormati hak cipta pembuat video aslinya
          siapa pun mereka.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="font-display text-xl text-ink mb-3">
          Cara mendapatkan video TikTok tanpa watermark
        </h2>
        <p className="text-sm text-ink-soft leading-relaxed mb-3">
          Caranya sederhana: tempel link video TikTok di YukSave, lalu unduh.
          YukSave mengambil video langsung dari server TikTok sebelum
          watermark ditambahkan, jadi hasilnya otomatis bersih tanpa perlu
          proses edit tambahan.
        </p>
        <p className="text-sm text-ink-soft leading-relaxed">
          Kalau kamu pakai iPhone atau Android, ada langkah lebih detail di
          panduan{" "}
          <Link
            href="/panduan/download-tiktok-tanpa-watermark-iphone"
            className="text-ink underline hover:text-rec"
          >
            download TikTok tanpa watermark di iPhone
          </Link>{" "}
          atau{" "}
          <Link
            href="/panduan/download-tiktok-tanpa-watermark-android"
            className="text-ink underline hover:text-rec"
          >
            download TikTok tanpa watermark di Android
          </Link>
          .
        </p>
      </section>

      <div className="bg-surface border-2 border-ink rounded-2xl p-5 text-center mb-10 shadow-[6px_6px_0_0_rgb(var(--color-ink))]">
        <p className="text-sm text-ink-soft mb-3">
          Coba sekarang, tempel link TikTok kamu di halaman utama.
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
          Pertanyaan seputar watermark TikTok
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

      <p className="text-xs text-ink-soft border-t border-tape pt-6">
        Untuk penggunaan pribadi &mdash; hormati hak cipta kreator asli.
      </p>

      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqs.map((item) => ({
              "@type": "Question",
              name: item.q,
              acceptedAnswer: {
                "@type": "Answer",
                text: item.a,
              },
            })),
          }),
        }}
      />
    </main>
  );
}
