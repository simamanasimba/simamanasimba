"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { FinanceDashboard, ExpenseCategory } from "@/lib/types";
import { useLang } from "@/lib/i18n";
import { SpendBreakdownModal, type SpendBreakdownRow } from "@/components/SpendBreakdownModal";

type Drilldown = "media" | "influencer" | "member" | null;

/** Total/Influencer/Media/Member/Meeting/Operational/Administrative spend + pending-payment count
 * — every category counted exactly once (see FinanceDashboard's own doc comment), each of the
 * per-beneficiary tiles clickable through to a highest-first breakdown that links straight into
 * that one beneficiary's own payment history, for auditing. Shared across the Payments page, the
 * Reports page, and the Dashboard's Finance-role view. */
export function FinanceStatCards({ organizationId }: { organizationId: string }) {
  const { t } = useLang();
  const [drilldown, setDrilldown] = useState<Drilldown>(null);

  const { data: dashboard } = useQuery({
    queryKey: ["finance-dashboard", organizationId],
    queryFn: () => api.get<FinanceDashboard>(`/api/v1/organizations/${organizationId}/payments/finance-dashboard`),
  });
  const { data: expenseTotals } = useQuery({
    queryKey: ["expense-totals", organizationId],
    queryFn: () => api.get<Record<ExpenseCategory, number>>(`/api/v1/organizations/${organizationId}/expenses/totals`),
  });

  const mediaRows: SpendBreakdownRow[] = (dashboard?.spendByMediaHost ?? []).map((r) => ({ id: r.mediaHostId, name: r.name, amount: r.amount }));
  const influencerRows: SpendBreakdownRow[] = (dashboard?.spendByInfluencer ?? []).map((r) => ({ id: r.influencerId, name: r.name, amount: r.amount }));
  const memberRows: SpendBreakdownRow[] = (dashboard?.spendByMember ?? []).map((r) => ({ id: r.memberId, name: r.name, amount: r.amount }));

  const mediaSpend = mediaRows.reduce((sum, r) => sum + r.amount, 0);
  const influencerSpend = influencerRows.reduce((sum, r) => sum + r.amount, 0);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-8">
        <div className="rounded-xl border border-line/60 bg-card px-3.5 py-2.5 shadow-card"><p className="text-xs text-muted">{t("totalSpend")}</p><p className="nums text-lg font-bold text-ink">{(dashboard?.totalSpend ?? 0).toLocaleString()}</p></div>
        <button type="button" onClick={() => setDrilldown("influencer")} className="rounded-xl border border-line/60 bg-card px-3.5 py-2.5 text-left shadow-card transition hover:-translate-y-0.5 hover:shadow-lg">
          <p className="text-xs text-muted">{t("influencerSpendLabel")}</p>
          <p className="nums text-lg font-bold text-ink">{influencerSpend.toLocaleString()}</p>
        </button>
        <button type="button" onClick={() => setDrilldown("media")} className="rounded-xl border border-line/60 bg-card px-3.5 py-2.5 text-left shadow-card transition hover:-translate-y-0.5 hover:shadow-lg">
          <p className="text-xs text-muted">{t("mediaSpendLabel")}</p>
          <p className="nums text-lg font-bold text-ink">{mediaSpend.toLocaleString()}</p>
        </button>
        <button type="button" onClick={() => setDrilldown("member")} className="rounded-xl border border-line/60 bg-card px-3.5 py-2.5 text-left shadow-card transition hover:-translate-y-0.5 hover:shadow-lg">
          <p className="text-xs text-muted">{t("leaderSpendLabel")}</p>
          <p className="nums text-lg font-bold text-ink">{(dashboard?.leaderSpend ?? 0).toLocaleString()}</p>
        </button>
        <div className="rounded-xl border border-line/60 bg-card px-3.5 py-2.5 shadow-card" title={t("meetingCostsHint")}>
          <p className="text-xs text-muted">{t("meetingCostsLabel")}</p>
          <p className="nums text-lg font-bold text-ink">{(dashboard?.meetingSpend ?? 0).toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-line/60 bg-card px-3.5 py-2.5 shadow-card"><p className="text-xs text-muted">{t("operationalSpendLabel")}</p><p className="nums text-lg font-bold text-ink">{(expenseTotals?.OPERATIONAL ?? dashboard?.operationalSpend ?? 0).toLocaleString()}</p></div>
        <div className="rounded-xl border border-line/60 bg-card px-3.5 py-2.5 shadow-card"><p className="text-xs text-muted">{t("administrativeSpendLabel")}</p><p className="nums text-lg font-bold text-ink">{(expenseTotals?.ADMINISTRATIVE ?? dashboard?.administrativeSpend ?? 0).toLocaleString()}</p></div>
        <div className="rounded-xl border border-line/60 bg-card px-3.5 py-2.5 shadow-card"><p className="text-xs text-muted">{t("pendingPayments")}</p><p className="nums text-lg font-bold text-ink">{dashboard?.pendingCount ?? 0}</p></div>
      </div>

      {drilldown === "media" && (
        <SpendBreakdownModal title={t("mediaSpendLabel")} rows={mediaRows} hrefFor={(id) => `/org/${organizationId}/media-hosts/${id}/payments`} onClose={() => setDrilldown(null)} />
      )}
      {drilldown === "influencer" && (
        <SpendBreakdownModal title={t("influencerSpendLabel")} rows={influencerRows} hrefFor={(id) => `/org/${organizationId}/influencers/${id}/payments`} onClose={() => setDrilldown(null)} />
      )}
      {drilldown === "member" && (
        <SpendBreakdownModal title={t("leaderSpendLabel")} rows={memberRows} hrefFor={(id) => `/org/${organizationId}/members/${id}`} onClose={() => setDrilldown(null)} />
      )}
    </>
  );
}
