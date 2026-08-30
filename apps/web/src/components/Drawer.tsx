"use client";

import { useLang } from "@/lib/i18n";

/** A right-side sliding panel for quick inspection without navigating away — same onClose
 * contract as Modal so call sites can choose whichever fits (Modal for forms/dialogs that need
 * full attention, Drawer for "peek at this row's detail" without losing your place in a list). */
export function Drawer({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  const { t } = useLang();
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/40">
      <div onClick={onClose} className="absolute inset-0" />
      <div className={`relative flex h-full w-full flex-col bg-white shadow-lg animate-fade-in ${wide ? "max-w-xl" : "max-w-md"}`}>
        <div className="flex shrink-0 items-center justify-between border-b border-line px-6 py-4">
          <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
          <button onClick={onClose} className="text-muted hover:text-ink" aria-label={t("close")}>✕</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
