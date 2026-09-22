"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Receipt } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { useLang } from "@/lib/i18n";
import type { PostingAgreementReadyForPayment } from "@/lib/types";

/** Finance's own queue, pulled straight from every agreement in the org rather than requiring a
 * visit to each host's/influencer's own page: every completed week that met its posting/
 * engagement target and hasn't been turned into a payment ticket yet. */
export function ReadyForPaymentPanel({ organizationId, canPay }: { organizationId: string; canPay: boolean }) {
  const { t } = useLang();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [actingId, setActingId] = useState<string | null>(null);

  const { data: rows } = useQuery({
    queryKey: ["posting-agreements", organizationId, "ready-for-payment"],
    queryFn: () => api.get<PostingAgreementReadyForPayment[]>(`/api/v1/organizations/${organizationId}/posting-agreements/ready-for-payment`),
  });

  async function createTicket(row: PostingAgreementReadyForPayment) {
    setActingId(row.evaluationId);
    try {
      await api.post(`/api/v1/organizations/${organizationId}/posting-agreements/evaluations/${row.evaluationId}/create-ticket`, {});
      showToast("success", t("paymentApprovedToast"));
      queryClient.invalidateQueries({ queryKey: ["posting-agreements", organizationId, "ready-for-payment"] });
      queryClient.invalidateQueries({ queryKey: ["payments", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["finance-dashboard", organizationId] });
    } catch (err) {
      showToast("error", err instanceof ApiError ? err.message : t("failedCreateTicket"));
    } finally {
      setActingId(null);
    }
  }

  const beneficiaryHref = (row: PostingAgreementReadyForPayment) =>
    row.beneficiaryType === "MEDIA_HOST"
      ? `/org/${organizationId}/media-hosts/${row.beneficiaryId}`
      : `/org/${organizationId}/influencers/${row.beneficiaryId}`;

  return (
    <div className="card space-y-3">
      <div>
        <h2 className="font-display text-lg font-bold text-ink">{t("readyForPaymentTitle")}</h2>
        <p className="text-xs text-muted">{t("readyForPaymentHint")}</p>
      </div>
      {(rows?.length ?? 0) === 0 ? (
        <p className="text-sm text-muted">{t("readyForPaymentEmpty")}</p>
      ) : (
        <div className="max-h-[420px] overflow-y-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="whitespace-nowrap px-4 py-2.5">{t("beneficiaryLabel")}</th>
                <th className="whitespace-nowrap px-4 py-2.5">{t("readyForPaymentGroupColLabel")}</th>
                <th className="whitespace-nowrap px-4 py-2.5">{t("actualPostsLabel")}</th>
                <th className="whitespace-nowrap px-4 py-2.5">{t("metricTotalEngagement")}</th>
                <th className="whitespace-nowrap px-4 py-2.5">{t("amountLabel")}</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(rows ?? []).map((row) => (
                <tr key={row.evaluationId}>
                  <td className="px-4 py-2.5 font-medium text-ink">
                    <Link href={beneficiaryHref(row)} className="hover:underline">{row.beneficiaryName}</Link>
                  </td>
                  <td className="px-4 py-2.5 text-muted">
                    <span className="font-medium text-ink">{row.groupLabel}</span>
                    {row.periodStart && row.periodEnd && (
                      <span className="ml-1 text-xs">({row.periodStart.slice(0, 10)} – {row.periodEnd.slice(0, 10)})</span>
                    )}
                  </td>
                  <td className="nums px-4 py-2.5">{row.actualPostCount}</td>
                  <td className="nums px-4 py-2.5">{row.actualEngagement.toLocaleString()}</td>
                  <td className="nums px-4 py-2.5 font-semibold text-ink">{row.currency} {row.weeklyAmount.toLocaleString()}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right">
                    {canPay && (
                      <button disabled={actingId === row.evaluationId} onClick={() => createTicket(row)} className="btn-primary !py-1.5 text-xs">
                        <Receipt size={13} /> {t("createTicketCta")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
