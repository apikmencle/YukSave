/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Keep this in sync with ALLOWED_HOST_SUFFIXES in
    // app/api/download/route.ts — that list is the source of truth for
    // which TikTok CDN hosts we trust; this just needs to match it so
    // <Image> can actually render thumbnails from all of them.
    remotePatterns: [
      { protocol: "https", hostname: "**.tiktokcdn.com" },
      { protocol: "https", hostname: "**.tiktokcdn-us.com" },
      { protocol: "https", hostname: "**.tiktokcdn-sg.com" },
      { protocol: "https", hostname: "**.tiktokcdn-eu.com" },
      { protocol: "https", hostname: "**.ibytedtos.com" },
      { protocol: "https", hostname: "**.ibyteimg.com" },
      { protocol: "https", hostname: "**.muscdn.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            // Only takes effect once deployed on HTTPS (all real hosts).
            // Content-Security-Policy itself is set per-request in
            // middleware.ts, since it needs a fresh nonce each time.
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
