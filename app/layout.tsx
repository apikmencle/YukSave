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
