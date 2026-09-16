"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Payment, FinanceDashboard, ExpenseCategory } from "@/lib/types";
import { useLang } from "@/lib/i18n";
import { MemberSpendDetailModal } from "@/components/MemberSpendDetailModal";

/** Total/Influencer/Media/Member/Operational/Administrative spend + pending-payment count — the
 * numbers Finance said matter, with no charts. Shared across the Payments page, the Reports page,
 * and the Dashboard's Finance-role view. */
export function FinanceStatCards({ organizationId }: { organizationId: string }) {
  const { t } = useLang();
  const [showMemberSpend, setShowMemberSpend] = useState(false);

  const { data: payments } = useQuery({
    queryKey: ["payments", organizationId],
    queryFn: () => api.get<Payment[]>(`/api/v1/organizations/${organizationId}/payments`),
  });
  const { data: dashboard } = useQuery({
    queryKey: ["finance-dashboard", organizationId],
    queryFn: () => api.get<FinanceDashboard>(`/api/v1/organizations/${organizationId}/payments/finance-dashboard`),
  });
  const { data: expenseTotals } = useQuery({
    queryKey: ["expense-totals", organizationId],
    queryFn: () => api.get<Record<ExpenseCategory, number>>(`/api/v1/organizations/${organizationId}/expenses/totals`),
  });

  const paidPayments = (payments ?? []).filter((p) => p.status === "PAID");
  const influencerSpend = paidPayments.filter((p) => p.beneficiaryType === "INFLUENCER").reduce((sum, p) => sum + Number(p.amount), 0);
  const mediaSpend = paidPayments.filter((p) => p.beneficiaryType === "MEDIA_HOST").reduce((sum, p) => sum + Number(p.amount), 0);
  const breakdown = dashboard?.memberSpendBreakdown ?? { leaderPayments: 0, meetingCosts: 0, mediaEngagementCosts: 0 };
  const memberSpend = breakdown.leaderPayments + breakdown.meetingCosts + breakdown.mediaEngagementCosts;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
        <div className="rounded-xl border border-line/60 bg-card px-3.5 py-2.5 shadow-card"><p className="text-xs text-muted">{t("totalSpend")}</p><p className="nums text-lg font-bold text-ink">{(dashboard?.totalSpend ?? 0).toLocaleString()}</p></div>
        <div className="rounded-xl border border-line/60 bg-card px-3.5 py-2.5 shadow-card"><p className="text-xs text-muted">{t("influencerSpendLabel")}</p><p className="nums text-lg font-bold text-ink">{influencerSpend.toLocaleString()}</p></div>
        <div className="rounded-xl border border-line/60 bg-card px-3.5 py-2.5 shadow-card"><p className="text-xs text-muted">{t("mediaSpendLabel")}</p><p className="nums text-lg font-bold text-ink">{mediaSpend.toLocaleString()}</p></div>
        <button
          type="button"
          onClick={() => setShowMemberSpend(true)}
          className="rounded-xl border border-line/60 bg-card px-3.5 py-2.5 text-left shadow-card transition hover:-translate-y-0.5 hover:shadow-lg"
        >
          <p className="text-xs text-muted">{t("memberSpendLabel")}</p>
          <p className="nums text-lg font-bold text-ink">{memberSpend.toLocaleString()}</p>
        </button>
        <div className="rounded-xl border border-line/60 bg-card px-3.5 py-2.5 shadow-card"><p className="text-xs text-muted">{t("operationalSpendLabel")}</p><p className="nums text-lg font-bold text-ink">{(expenseTotals?.OPERATIONAL ?? 0).toLocaleString()}</p></div>
        <div className="rounded-xl border border-line/60 bg-card px-3.5 py-2.5 shadow-card"><p className="text-xs text-muted">{t("administrativeSpendLabel")}</p><p className="nums text-lg font-bold text-ink">{(expenseTotals?.ADMINISTRATIVE ?? 0).toLocaleString()}</p></div>
        <div className="rounded-xl border border-line/60 bg-card px-3.5 py-2.5 shadow-card"><p className="text-xs text-muted">{t("pendingPayments")}</p><p className="nums text-lg font-bold text-ink">{dashboard?.pendingCount ?? 0}</p></div>
      </div>

      {showMemberSpend && <MemberSpendDetailModal breakdown={breakdown} onClose={() => setShowMemberSpend(false)} />}
    </>
  );
}
