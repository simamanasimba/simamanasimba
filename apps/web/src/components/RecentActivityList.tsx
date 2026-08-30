"use client";

import { useState } from "react";
import Link from "next/link";
import { useLang } from "@/lib/i18n";
import { PAYMENT_PROGRESS_LABEL_KEYS, PAYMENT_PROGRESS_BADGE } from "@/lib/paymentProgress";
import { PaymentDetailModal } from "@/components/PaymentDetailModal";
import type { Influencer2CampaignListItem, Payment } from "@/lib/types";

type Row =
  | { kind: "campaign"; date: string; item: Influencer2CampaignListItem }
  | { kind: "payment"; date: string; payment: Payment };

const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-amber-50 text-warning",
  PROCESSING: "bg-blue-50 text-info",
  PAID: "bg-green-50 text-success",
  REJECTED: "bg-brand-50 text-brand-700",
  CANCELLED: "bg-surface text-muted",
};

/** One chronological "what happened with this person" list — campaigns AND payments merged and
 * sorted most-recent-first, instead of two separate lists that force a viewer to cross-reference
 * "is this campaign the one that got paid." A payment only shows up here on its own row when it
 * has no linked Influencer 2 campaign at all (e.g. recorded before that system existed) — every
 * other payment's status already shows right on its campaign's own row. */
export function RecentActivityList({
  organizationId,
  campaignItems,
  orphanPayments,
  viewAllCampaignsHref,
  viewAllPaymentsHref,
}: {
  organizationId: string;
  campaignItems: Influencer2CampaignListItem[];
  orphanPayments: Payment[];
  viewAllCampaignsHref: string;
  viewAllPaymentsHref: string;
}) {
  const { t } = useLang();
  const [viewingPayment, setViewingPayment] = useState<Payment | null>(null);

  const rows: Row[] = [
    ...campaignItems.map((item): Row => ({ kind: "campaign", date: item.campaign.createdAt, item })),
    ...orphanPayments.map((payment): Row => ({ kind: "payment", date: payment.paymentDate, payment })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="card overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{t("recentActivityTitle")}</h2>
        <div className="flex items-center gap-3">
          <Link href={viewAllCampaignsHref} className="text-sm font-medium text-brand hover:underline">{t("viewAllCampaignsCta")}</Link>
          <Link href={viewAllPaymentsHref} className="text-sm font-medium text-brand hover:underline">{t("paymentHistoryCta")}</Link>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-6 text-muted">{t("noInfluencer2Campaigns")}</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-2.5">{t("influencer2CampaignColLabel")}</th>
                <th className="px-5 py-2.5">{t("amountLabel")}</th>
                <th className="px-5 py-2.5">{t("statusColLabel")}</th>
                <th className="px-5 py-2.5">{t("dateLabel")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((row) =>
                row.kind === "campaign" ? (
                  <tr key={`c-${row.item.campaign.id}`}>
                    <td className="max-w-[220px] truncate px-5 py-2.5 font-medium text-ink">
                      <Link href={`/org/${organizationId}/influencer2/${row.item.campaign.id}`} className="text-brand hover:underline">{row.item.campaign.name}</Link>
                    </td>
                    <td className="nums px-5 py-2.5 text-ink">{row.item.campaign.totalTzs != null ? row.item.campaign.totalTzs.toLocaleString() : "—"}</td>
                    <td className="px-5 py-2.5">
                      <span className={`badge ${PAYMENT_PROGRESS_BADGE[row.item.campaign.paymentProgress ?? "UNPAID"]}`}>
                        {t(PAYMENT_PROGRESS_LABEL_KEYS[row.item.campaign.paymentProgress ?? "UNPAID"])}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-muted">{new Date(row.date).toLocaleDateString()}</td>
                  </tr>
                ) : (
                  <tr key={`p-${row.payment.id}`} className="cursor-pointer hover:bg-brand-50/40" onClick={() => setViewingPayment(row.payment)}>
                    <td className="px-5 py-2.5 font-medium text-ink">{t("paymentHistoryCta")}</td>
                    <td className="nums px-5 py-2.5 text-ink">{Number(row.payment.amount).toLocaleString()}</td>
                    <td className="px-5 py-2.5">
                      <span className={`badge ${STATUS_BADGE[row.payment.status] ?? "bg-surface text-muted"}`}>{row.payment.status}</span>
                    </td>
                    <td className="px-5 py-2.5 text-muted">{new Date(row.date).toLocaleDateString()}</td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}

      {viewingPayment && (
        <PaymentDetailModal organizationId={organizationId} payment={viewingPayment} onClose={() => setViewingPayment(null)} />
      )}
    </div>
  );
}
