"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download } from "lucide-react";
import { api } from "@/lib/api";
import type { Payment } from "@/lib/types";
import { RequireAccess } from "@/components/RequireAccess";
import { LoadingWord } from "@/components/LoadingWord";
import { escapeCsv, downloadCsv } from "@/lib/csv";
import { useLang } from "@/lib/i18n";

/** Finance's on-demand review list for Payment.isConditional — every posting-agreement payment
 * recorded despite the week/campaign missing its target. Nothing here is excluded from any other
 * spend total (see FinanceStatCards); this is purely an additional lens for auditing. */
export default function ConditionalPaymentsPage() {
  const { organizationId } = useParams<{ organizationId: string }>();
  const { t } = useLang();

  const { data: payments } = useQuery({
    queryKey: ["conditional-payments", organizationId],
    queryFn: () => api.get<Payment[]>(`/api/v1/organizations/${organizationId}/payments/conditional`),
  });

  function beneficiaryName(p: Payment): string {
    return p.mediaHost?.name ?? p.influencer?.name ?? "—";
  }

  function beneficiaryHref(p: Payment): string {
    if (p.mediaHostId) return `/org/${organizationId}/media-hosts/${p.mediaHostId}/payments`;
    if (p.influencerId) return `/org/${organizationId}/influencers/${p.influencerId}/payments`;
    return "#";
  }

  function onExport() {
    const rows = payments ?? [];
    const header = ["Beneficiary", "Payment date", "Amount paid", "Reason", "Paid by"];
    const lines = [header.map(escapeCsv).join(",")];
    for (const p of rows) {
      lines.push(
        [beneficiaryName(p), p.paymentDate.slice(0, 10), p.paidAmount ?? p.amount, p.conditionalReason ?? "", p.createdByName ?? ""].map(escapeCsv).join(","),
      );
    }
    downloadCsv("conditional-payments.csv", lines.join("\n"));
  }

  return (
    <RequireAccess area="finance">
      <div className="space-y-6">
        <Link href={`/org/${organizationId}/finance`} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-brand">
          <ArrowLeft size={15} /> {t("backToListCta")}
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-extrabold text-ink">{t("conditionalPaymentsTitle")}</h1>
            <p className="mt-1 max-w-xl text-sm text-muted">{t("conditionalPaymentsHint")}</p>
          </div>
          {payments && payments.length > 0 && (
            <button type="button" onClick={onExport} className="btn-secondary text-sm"><Download size={14} /> {t("exportAllCta")}</button>
          )}
        </div>

        {!payments ? (
          <LoadingWord />
        ) : payments.length === 0 ? (
          <p className="card text-muted">{t("conditionalPaymentsEmpty")}</p>
        ) : (
          <div className="card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-2.5">{t("nameLabel")}</th>
                  <th className="px-4 py-2.5">{t("paymentDateLabel")}</th>
                  <th className="px-4 py-2.5 text-right">{t("amountLabel")}</th>
                  <th className="px-4 py-2.5">{t("reasonColLabel")}</th>
                  <th className="px-4 py-2.5">{t("paidByColLabel")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-brand-50/40">
                    <td className="px-4 py-2.5">
                      <Link href={beneficiaryHref(p)} className="font-medium text-brand hover:underline">{beneficiaryName(p)}</Link>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted">{p.paymentDate.slice(0, 10)}</td>
                    <td className="nums px-4 py-2.5 text-right font-semibold text-ink">{(p.paidAmount ?? p.amount).toLocaleString()}</td>
                    <td className="max-w-xs px-4 py-2.5 text-sm text-ink">{p.conditionalReason ?? "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-muted">{p.createdByName ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </RequireAccess>
  );
}
