import { ImageResponse } from "next/og";

// Matches opengraph-image.tsx: force the edge runtime so this renders via
// WASM (satori + resvg-wasm) instead of Node's native resvg/sharp path.
// Without this, Next.js defaults apple-icon to the Node.js runtime, which
// tries to load a native sharp/resvg binary for the host platform —
// there's no prebuilt one for Termux's android-arm64, so it crashes with
// "Could not load the sharp module" instead of rendering the icon.
export const runtime = "edge";

// Next.js's `icon.svg` convention (see app/icon.svg) covers browser tab
// favicons, but iOS Safari's "Add to Home Screen" ignores SVG favicons
// entirely and falls back to a screenshot of the page instead — it needs
// a real apple-icon route. This mirrors app/icon.svg's mark (rec-dot +
// down-arrow + base line) rendered at Apple's standard 180x180 size.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1B2430",
          borderRadius: 40,
        }}
      >
        <svg width="112" height="112" viewBox="0 0 40 40" fill="none">
          <circle cx="14" cy="14" r="4" fill="#FF4B3E" />
          <path
            d="M20 12v11.5m0 0l-4.5-4.5M20 23.5l4.5-4.5"
            stroke="#EDEDE7"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect x="10" y="27" width="20" height="2.5" rx="1.25" fill="#EDEDE7" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
