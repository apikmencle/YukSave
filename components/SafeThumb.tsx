"use client";

import { useState } from "react";
import Image from "next/image";

/**
 * TikTok CDN thumbnail/photo URLs are signed with an expiry
 * (`x-expires=...`). Once that passes — e.g. someone reopens an old
 * entry from download history — the URL 404s. Plain <img> would just
 * show the browser's broken-image icon; this swaps in a neutral
 * placeholder instead so the layout doesn't look broken.
 *
 * Uses next/image with `unoptimized` rather than plain <img>: this
 * still gets next/image's built-in lazy-loading and layout stability
 * (no CLS while the image loads), without routing every request
 * through Vercel's Image Optimization API. That matters here because
 * every signed URL is unique per request (the signature/expiry never
 * repeats), so the optimizer could never reuse a cached variant —
 * every single thumbnail view would count as a fresh optimization,
 * which is billed separately from bandwidth. Turn `unoptimized` off
 * later if that box is empty and the CDN's own images are already an
 * appropriate size.
 */
export default function SafeThumb({
  src,
  alt,
  className,
  sizes,
}: {
  src: string;
  alt: string;
  className?: string;
  /** Passed straight to next/image; required whenever fill is used
   * with a container whose width isn't fixed (e.g. a grid column). */
  sizes?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    return (
      <div
        className={`${className ?? ""} flex items-center justify-center bg-tape/30 text-ink-soft`}
        aria-label={alt}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="M21 15l-5-5-6 6" />
        </svg>
      </div>
    );
  }

  return (
    <div className={`${className ?? ""} relative overflow-hidden`}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes ?? "96px"}
        className="object-cover"
        onError={() => setFailed(true)}
        unoptimized
      />
    </div>
  );
}
