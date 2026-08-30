"use client";

import { useLang } from "@/lib/i18n";

export function Modal({
  title,
  onClose,
  children,
  footer,
  wide,
  xl,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Rendered outside the scrolling body, pinned to the bottom of the modal — for a long form's
   * Cancel/Save row, so it stays reachable without scrolling all the way down. */
  footer?: React.ReactNode;
  wide?: boolean;
  /** Extra-wide — for forms with several dense multi-column sections. */
  xl?: boolean;
}) {
  const { t } = useLang();
  const width = xl ? "max-w-4xl" : wide ? "max-w-2xl" : "max-w-lg";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4 py-6">
      <div className={`flex max-h-[90vh] min-h-0 w-full flex-col rounded-xl bg-white p-6 shadow-lg ${width}`}>
        <div className="mb-4 flex shrink-0 items-center justify-between">
          <h2 className="text-lg font-bold text-ink">{title}</h2>
          <button onClick={onClose} className="text-muted hover:text-ink" aria-label={t("close")}>✕</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {children}
        </div>
        {footer && <div className="shrink-0 pt-4">{footer}</div>}
      </div>
    </div>
  );
}
