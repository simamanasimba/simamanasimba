"use client";

import Link from "next/link";
import { Modal } from "@/components/Modal";
import { useLang } from "@/lib/i18n";

export interface SpendBreakdownRow {
  id: string | null;
  name: string;
  amount: number;
}

/** The "what actually made up that number" drill-down behind a spend tile — highest first, each
 * row linking straight to that one beneficiary's own payment history for auditing, so "how did we
 * get to this total" is never more than one more click away. Shared by the Media/Influencer/
 * Member spend tiles; each just passes its own rows and link builder. */
export function SpendBreakdownModal({
  title,
  rows,
  hrefFor,
  onClose,
}: {
  title: string;
  rows: SpendBreakdownRow[];
  hrefFor: (id: string) => string;
  onClose: () => void;
}) {
  const { t } = useLang();
  const sorted = [...rows].sort((a, b) => b.amount - a.amount);
  const total = rows.reduce((sum, r) => sum + r.amount, 0);

  return (
    <Modal title={title} onClose={onClose}>
      <div className="space-y-2">
        {sorted.length === 0 ? (
          <p className="text-sm text-muted">{t("noSpendYet")}</p>
        ) : (
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {sorted.map((r) =>
              r.id ? (
                <Link
                  key={r.id}
                  href={hrefFor(r.id)}
                  className="flex items-center justify-between rounded-xl border border-line/60 bg-surface px-4 py-3 transition hover:border-brand-200 hover:bg-brand-50/40"
                >
                  <span className="text-sm font-medium text-ink">{r.name}</span>
                  <span className="nums text-sm font-bold text-ink">{r.amount.toLocaleString()}</span>
                </Link>
              ) : (
                <div key={r.name} className="flex items-center justify-between rounded-xl border border-line/60 bg-surface px-4 py-3">
                  <span className="text-sm font-medium text-ink">{r.name}</span>
                  <span className="nums text-sm font-bold text-ink">{r.amount.toLocaleString()}</span>
                </div>
              ),
            )}
          </div>
        )}
        <div className="flex items-center justify-between border-t border-line pt-3">
          <span className="text-sm font-semibold text-ink">{t("totalLabel")}</span>
          <span className="nums text-lg font-bold text-brand-700">{total.toLocaleString()}</span>
        </div>
      </div>
    </Modal>
  );
}
