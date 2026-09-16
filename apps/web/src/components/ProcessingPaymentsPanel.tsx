"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { MarkPaidModal } from "@/components/MarkPaidModal";
import type { Payment } from "@/lib/types";
import { paymentBeneficiaryName } from "@/lib/paymentProgress";

/** Finance's own queue: payments an admin has already approved ("Pending Payment" — authorized,
 * money not yet sent) show here so Finance can record how it was actually paid and confirm.
 * Marking paid is the one action that flips the linked campaign to PAID (see
 * PaymentsService.markPaid). */
export function ProcessingPaymentsPanel({ organizationId }: { organizationId: string }) {
  const showPageHref = (p: Payment) =>
    p.influencerId
      ? `/org/${organizationId}/influencers/${p.influencerId}`
      : p.mediaHostId
        ? `/org/${organizationId}/media-hosts/${p.mediaHostId}`
        : p.memberId
          ? `/org/${organizationId}/members/${p.memberId}`
          : null;
  const { t } = useLang();
  const queryClient = useQueryClient();
  const [marking, setMarking] = useState<Payment | null>(null);

  const { data: processing } = useQuery({
    queryKey: ["payments", organizationId, "PROCESSING"],
    queryFn: () => api.get<Payment[]>(`/api/v1/organizations/${organizationId}/payments?status=PROCESSING`),
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["payments", organizationId] });
    queryClient.invalidateQueries({ queryKey: ["finance-dashboard", organizationId] });
  }

  return (
    <div className="card flex h-full flex-col space-y-3">
      <div>
        <h2 className="font-display text-lg font-bold text-ink">{t("processingPaymentsTitle")}</h2>
        <p className="text-xs text-muted">{t("processingPaymentsHelp")}</p>
      </div>
      {(processing?.length ?? 0) === 0 ? (
        <p className="text-sm text-muted">{t("noProcessingPayments")}</p>
      ) : (
        <div className="flex-1 overflow-y-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="whitespace-nowrap px-4 py-2.5">{t("beneficiaryLabel")}</th>
                <th className="whitespace-nowrap px-4 py-2.5">{t("amountLabel")}</th>
                <th className="whitespace-nowrap px-4 py-2.5">{t("approvedByLabel")}</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(processing ?? []).map((p) => {
                const href = showPageHref(p);
                return (
                  <tr key={p.id} onClick={() => setMarking(p)} className="cursor-pointer hover:bg-brand-50/40">
                    <td className="px-4 py-2.5 font-medium text-ink">
                      {href ? (
                        <Link href={href} onClick={(e) => e.stopPropagation()} className="hover:underline">
                          {paymentBeneficiaryName(p)}
                        </Link>
                      ) : (
                        paymentBeneficiaryName(p)
                      )}
                    </td>
                    <td className="nums px-4 py-2.5">{p.currency} {p.amount.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-muted">{p.approvedByName ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right">
                      <button onClick={(e) => { e.stopPropagation(); setMarking(p); }} className="btn-primary text-sm">
                        <CheckCircle2 size={14} /> {t("markPaidCta")}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {marking && (
        <MarkPaidModal
          organizationId={organizationId}
          payment={marking}
          onClose={() => setMarking(null)}
          onDone={() => { setMarking(null); refresh(); }}
        />
      )}
    </div>
  );
}
