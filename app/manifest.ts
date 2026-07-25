import type { MetadataRoute } from "next";

// Next.js auto-generates /manifest.webmanifest from this file and links
// it in <head> — no manual <link rel="manifest"> needed. Without it,
// "Add to Home Screen" on Android/Chrome falls back to a bare bookmark
// (page title + generic icon) instead of showing YukSave's name and mark
// like an installed app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "YukSave — Download Video TikTok Tanpa Watermark",
    short_name: "YukSave",
    description:
      "Download video, foto slideshow, dan audio TikTok tanpa watermark, gratis dan cepat.",
    start_url: "/",
    display: "standalone",
    background_color: "#EDEDE7",
    theme_color: "#1B2430",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
