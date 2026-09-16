"use client";

import { Modal } from "@/components/Modal";
import { useLang } from "@/lib/i18n";
import type { FinanceDashboard } from "@/lib/types";

/** The "what actually made up that number" drill-down behind the Member spend tile — leader
 * payments, meeting costs (budgets), and media/influencer engagement costs are three very
 * different kinds of spend that happen to all touch members/the community, so this breaks them
 * back out instead of leaving Finance to guess what's inside the combined total. */
export function MemberSpendDetailModal({ breakdown, onClose }: { breakdown: FinanceDashboard["memberSpendBreakdown"]; onClose: () => void }) {
  const { t } = useLang();
  const total = breakdown.leaderPayments + breakdown.meetingCosts + breakdown.mediaEngagementCosts;
  const rows: Array<{ label: string; value: number }> = [
    { label: t("leaderSpendLabel"), value: breakdown.leaderPayments },
    { label: t("meetingCostsLabel"), value: breakdown.meetingCosts },
    { label: t("mediaEngagementCostsLabel"), value: breakdown.mediaEngagementCosts },
  ];

  return (
    <Modal title={t("memberSpendLabel")} onClose={onClose}>
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between rounded-xl border border-line/60 bg-surface px-4 py-3">
            <span className="text-sm font-medium text-ink">{r.label}</span>
            <span className="nums text-sm font-bold text-ink">{r.value.toLocaleString()}</span>
          </div>
        ))}
        <div className="flex items-center justify-between border-t border-line pt-3">
          <span className="text-sm font-semibold text-ink">{t("totalLabel")}</span>
          <span className="nums text-lg font-bold text-brand-700">{total.toLocaleString()}</span>
        </div>
        <p className="text-xs text-muted">{t("meetingCostsHint")}</p>
      </div>
    </Modal>
  );
}
