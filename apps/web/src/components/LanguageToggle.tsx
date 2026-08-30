"use client";

import { useLang } from "@/lib/i18n";

export function LanguageToggle() {
  const { lang, setLang } = useLang();
  return (
    <div className="flex items-center rounded-full border border-line bg-white p-0.5 text-xs font-semibold shadow-sm">
      <button
        onClick={() => setLang("en")}
        className={`rounded-full px-3 py-1.5 transition ${lang === "en" ? "bg-brand-gradient text-white" : "text-muted hover:text-ink"}`}
      >
        EN
      </button>
      <button
        onClick={() => setLang("sw")}
        className={`rounded-full px-3 py-1.5 transition ${lang === "sw" ? "bg-brand-gradient text-white" : "text-muted hover:text-ink"}`}
      >
        SW
      </button>
    </div>
  );
}
