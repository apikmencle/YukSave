import type { Metadata, Viewport } from "next";
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

// JSON-LD structured data — gives Google an explicit, machine-readable
// description of what this site is, instead of relying purely on text
// inference. Deliberately does NOT include aggregateRating/review fields:
// those would need to reflect real user ratings actually collected
// somewhere, and fabricating them is a Google Search spam violation that
// risks a manual action, not just "ignored" — the honest, fields-you-can-
// actually-back-up version below is the safe one.
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "YukSave",
  url: SITE_URL,
  description:
    "Download video, foto slideshow, dan audio TikTok tanpa watermark, gratis dan cepat, langsung dari browser tanpa aplikasi.",
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "IDR",
  },
};

// FAQPage schema — mirrors the FAQ copy rendered in app/page.tsx
// (lib/i18n/translations.ts, "id" locale, which is the default/server-
// rendered language). Keep this in sync if that copy changes: Google
// penalizes FAQ schema that doesn't match visible on-page content.
const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Apakah YukSave benar-benar gratis?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Ya, download video TikTok tanpa watermark di YukSave gratis sepenuhnya, tanpa batas jumlah download dan tanpa perlu login.",
      },
    },
    {
      "@type": "Question",
      name: "Apakah perlu install aplikasi?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Tidak. YukSave berjalan langsung di browser HP atau komputer, tidak perlu instalasi apapun.",
      },
    },
    {
      "@type": "Question",
      name: "Kenapa hasil downloadnya tidak ada watermark?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "YukSave mengambil versi video langsung dari server TikTok sebelum watermark ditambahkan, sehingga hasilnya bersih.",
      },
    },
    {
      "@type": "Question",
      name: "Bisa download foto slideshow atau audio saja?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Bisa. Kalau link yang kamu tempel berupa postingan foto slideshow, YukSave akan menampilkan setiap foto untuk diunduh satu per satu. Kalau videonya punya audio yang bisa diambil terpisah, tombol \u201cDownload Audio (MP3)\u201d akan muncul juga.",
      },
    },
  ],
};

export const viewport: Viewport = {
  // Matches --color-paper in both themes (app/globals.css). Mobile
  // browsers use this to tint their own chrome (status bar / address
  // bar), so it should track light/dark instead of staying one fixed
  // color regardless of the site's own theme.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#EDEDE7" },
    { media: "(prefers-color-scheme: dark)", color: "#12161D" },
  ],
};

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
        <script
          type="application/ld+json"
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <script
          type="application/ld+json"
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
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
