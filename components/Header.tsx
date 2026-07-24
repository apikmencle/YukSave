"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { useTheme } from "@/lib/theme/ThemeContext";
import type { Lang } from "@/lib/i18n/translations";

const LANG_OPTIONS: { value: Lang; label: string; short: string }[] = [
  { value: "id", label: "Bahasa Indonesia", short: "ID" },
  { value: "en", label: "English", short: "EN" },
];

export default function Header() {
  const { lang, setLang, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  const [langOpen, setLangOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close either dropdown when clicking outside it.
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Close either dropdown on Escape — keyboard-only users had no way to
  // dismiss it otherwise, since the outside-click handler above only
  // fires on mouse input.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setLangOpen(false);
        setMenuOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <header className="w-full border-b border-tape">
      <div className="max-w-3xl mx-auto flex items-center justify-between gap-2.5 px-6 py-4">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/logo.svg" alt="YukSave" width={36} height={36} priority />
          <span className="font-display text-lg text-ink tracking-tight">
            YukSave
          </span>
        </Link>

        <div className="flex items-center gap-1.5">
          {/* Language dropdown */}
          <div className="relative" ref={langRef}>
            <button
              type="button"
              onClick={() => setLangOpen((v) => !v)}
              aria-haspopup="listbox"
              aria-expanded={langOpen}
              aria-label={t.header.langLabel}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm font-mono font-medium text-ink-soft hover:text-ink hover:bg-tape/40 transition-colors"
            >
              {LANG_OPTIONS.find((o) => o.value === lang)?.short}
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`transition-transform ${langOpen ? "rotate-180" : ""}`}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {langOpen && (
              <div
                role="listbox"
                className="absolute right-0 mt-1.5 w-40 bg-surface border border-tape rounded-xl shadow-[3px_3px_0_0_rgb(var(--color-ink))] overflow-hidden z-20"
              >
                {LANG_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={lang === opt.value}
                    onClick={() => {
                      setLang(opt.value);
                      setLangOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2.5 text-sm flex items-center justify-between hover:bg-paper transition-colors ${
                      lang === opt.value
                        ? "text-ink font-semibold"
                        : "text-ink-soft"
                    }`}
                  >
                    {opt.label}
                    {lang === opt.value && (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Dark mode toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={
              theme === "dark" ? t.header.themeToLight : t.header.themeToDark
            }
            className="p-2 rounded-lg text-ink-soft hover:text-ink hover:bg-tape/40 transition-colors"
          >
            {theme === "dark" ? (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="4.5" />
                <path d="M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
              </svg>
            ) : (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20.5 14.5a8.5 8.5 0 11-11-11 6.8 6.8 0 0011 11z" />
              </svg>
            )}
          </button>

          {/* Hamburger nav menu */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label={t.header.menuAria}
              className="p-2 rounded-lg text-ink-soft hover:text-ink hover:bg-tape/40 transition-colors"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {menuOpen ? (
                  <path d="M6 6l12 12M18 6L6 18" />
                ) : (
                  <path d="M3 6h18M3 12h18M3 18h18" />
                )}
              </svg>
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-1.5 w-52 bg-surface border border-tape rounded-xl shadow-[3px_3px_0_0_rgb(var(--color-ink))] overflow-hidden z-20"
              >
                <p className="px-3.5 pt-3 pb-1.5 text-[11px] font-mono uppercase tracking-widest text-ink-soft">
                  {t.header.menuTitle}
                </p>
                <Link
                  href="/#cara-pakai"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="block px-3.5 py-2.5 text-sm text-ink-soft hover:text-ink hover:bg-paper transition-colors"
                >
                  {t.header.navCaraPakai}
                </Link>
                <Link
                  href="/privacy"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="block px-3.5 py-2.5 text-sm text-ink-soft hover:text-ink hover:bg-paper transition-colors"
                >
                  {t.footer.privacy}
                </Link>
                <Link
                  href="/terms"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="block px-3.5 py-2.5 text-sm text-ink-soft hover:text-ink hover:bg-paper transition-colors"
                >
                  {t.footer.terms}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
