"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { FinanceDashboard, ExpenseCategory } from "@/lib/types";
import { useLang } from "@/lib/i18n";

/** Total/Influencer/Media/Leader/Meeting/Operational/Administrative spend + pending-payment count
 * — every category counted exactly once (see FinanceDashboard's own doc comment). The four
 * per-beneficiary tiles (Influencer/Media/Leader/Meeting) each link to a full spend-detail page
 * (not a popup — Finance needs to review and export these, not just glance at them) with a
 * highest-first breakdown by individual, each row linking straight into that one beneficiary's
 * own payment history for auditing. Shared across the Payments page, the Reports page, and the
 * Dashboard's Finance-role view. */
export function FinanceStatCards({ organizationId }: { organizationId: string }) {
  const { t } = useLang();

  const { data: dashboard } = useQuery({
    queryKey: ["finance-dashboard", organizationId],
    queryFn: () => api.get<FinanceDashboard>(`/api/v1/organizations/${organizationId}/payments/finance-dashboard`),
  });
  const { data: expenseTotals } = useQuery({
    queryKey: ["expense-totals", organizationId],
    queryFn: () => api.get<Record<ExpenseCategory, number>>(`/api/v1/organizations/${organizationId}/expenses/totals`),
  });

  const mediaSpend = (dashboard?.spendByMediaHost ?? []).reduce((sum, r) => sum + r.amount, 0);
  const influencerSpend = (dashboard?.spendByInfluencer ?? []).reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-8">
      <div className="rounded-xl border border-line/60 bg-card px-3.5 py-2.5 shadow-card"><p className="text-xs text-muted">{t("totalSpend")}</p><p className="nums text-lg font-bold text-ink">{(dashboard?.totalSpend ?? 0).toLocaleString()}</p></div>
      <Link href={`/org/${organizationId}/finance/spend/influencer`} className="rounded-xl border border-line/60 bg-card px-3.5 py-2.5 shadow-card transition hover:-translate-y-0.5 hover:shadow-lg">
        <p className="text-xs text-muted">{t("influencerSpendLabel")}</p>
        <p className="nums text-lg font-bold text-ink">{influencerSpend.toLocaleString()}</p>
      </Link>
      <Link href={`/org/${organizationId}/finance/spend/media`} className="rounded-xl border border-line/60 bg-card px-3.5 py-2.5 shadow-card transition hover:-translate-y-0.5 hover:shadow-lg">
        <p className="text-xs text-muted">{t("mediaSpendLabel")}</p>
        <p className="nums text-lg font-bold text-ink">{mediaSpend.toLocaleString()}</p>
      </Link>
      <Link href={`/org/${organizationId}/finance/spend/member`} className="rounded-xl border border-line/60 bg-card px-3.5 py-2.5 shadow-card transition hover:-translate-y-0.5 hover:shadow-lg">
        <p className="text-xs text-muted">{t("leaderSpendLabel")}</p>
        <p className="nums text-lg font-bold text-ink">{(dashboard?.leaderSpend ?? 0).toLocaleString()}</p>
      </Link>
      <Link href={`/org/${organizationId}/finance/spend/meeting`} className="rounded-xl border border-line/60 bg-card px-3.5 py-2.5 shadow-card transition hover:-translate-y-0.5 hover:shadow-lg" title={t("meetingCostsHint")}>
        <p className="text-xs text-muted">{t("meetingCostsLabel")}</p>
        <p className="nums text-lg font-bold text-ink">{(dashboard?.meetingSpend ?? 0).toLocaleString()}</p>
      </Link>
      <div className="rounded-xl border border-line/60 bg-card px-3.5 py-2.5 shadow-card"><p className="text-xs text-muted">{t("operationalSpendLabel")}</p><p className="nums text-lg font-bold text-ink">{(expenseTotals?.OPERATIONAL ?? dashboard?.operationalSpend ?? 0).toLocaleString()}</p></div>
      <div className="rounded-xl border border-line/60 bg-card px-3.5 py-2.5 shadow-card"><p className="text-xs text-muted">{t("administrativeSpendLabel")}</p><p className="nums text-lg font-bold text-ink">{(expenseTotals?.ADMINISTRATIVE ?? dashboard?.administrativeSpend ?? 0).toLocaleString()}</p></div>
      <div className="rounded-xl border border-line/60 bg-card px-3.5 py-2.5 shadow-card"><p className="text-xs text-muted">{t("pendingPayments")}</p><p className="nums text-lg font-bold text-ink">{dashboard?.pendingCount ?? 0}</p></div>
    </div>
  );
}
