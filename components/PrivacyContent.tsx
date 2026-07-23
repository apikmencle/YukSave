"use client";

import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function PrivacyContent() {
  const { t } = useLanguage();

  return (
    <main className="min-h-screen px-6 py-16 max-w-2xl mx-auto">
      <h1 className="font-display text-3xl text-ink mb-6">
        {t.privacy.title}
      </h1>
      <div className="space-y-5 text-sm text-ink-soft leading-relaxed">
        {/* Static date from translations, not new Date(): avoids a server
            (UTC) vs browser (local timezone) hydration mismatch, and
            actually reflects when this text was last revised. */}
        <p>
          {t.privacy.lastUpdated}: {t.privacy.lastUpdatedDate}
        </p>

        {t.privacy.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="font-semibold text-ink mb-1">{section.heading}</h2>
            <p>{section.body}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
