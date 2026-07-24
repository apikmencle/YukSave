"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string;
    };
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

/**
 * Cloudflare Turnstile widget — bot-abuse protection for the download
 * form. Deliberately optional: if NEXT_PUBLIC_TURNSTILE_SITE_KEY isn't
 * set (e.g. local dev, or before you've created a Cloudflare site key),
 * this renders nothing and the form works exactly as before. The server
 * side (app/api/parse/route.ts) mirrors this — it only checks the token
 * if TURNSTILE_SECRET_KEY is configured.
 */
export default function Turnstile({ onToken }: { onToken: (token: string | null) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!SITE_KEY || !containerRef.current) return;

    function renderWidget() {
      if (!window.turnstile || !containerRef.current) return;
      window.turnstile.render(containerRef.current, {
        sitekey: SITE_KEY,
        callback: (token: string) => onToken(token),
        "expired-callback": () => onToken(null),
        "error-callback": () => onToken(null),
      });
    }

    if (window.turnstile) {
      renderWidget();
      return;
    }

    // Strict Mode (React 19, development only) runs this effect twice in
    // a row — without this guard that would inject the Cloudflare script
    // tag twice and could double-render the widget into the container.
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://challenges.cloudflare.com/turnstile/v0/api.js"]'
    );
    if (existing) {
      existing.addEventListener("load", renderWidget);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    script.async = true;
    script.defer = true;
    script.onload = renderWidget;
    document.head.appendChild(script);
    // Not cleaned up on unmount on purpose — Turnstile's script is safe
    // to leave loaded for the lifetime of the page.
  }, [onToken]);

  if (!SITE_KEY) return null;

  return <div ref={containerRef} className="mt-3" />;
}
