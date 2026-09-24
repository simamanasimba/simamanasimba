"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";
import { isSuperAdmin } from "@/lib/permissions";
import { PAYMENT_STATUS_LABEL_KEYS, PAYMENT_STATUS_BADGE } from "@/lib/paymentStatusDisplay";
import { useLang } from "@/lib/i18n";
import type { Payment } from "@/lib/types";

/** Reconciliation: answers "I have 5 payments but only 4 weeks" — every real payment for this
 * beneficiary that isn't accounted for by any week/folder/campaign evaluation, so it's invisible
 * to the Weeks/Campaigns table above even though it's real money on record. Not necessarily a
 * bug — could be a legitimate general/ad-hoc payment — but it's exactly what needs a human look,
 * and the only reliable way to spot a genuine leftover duplicate. Renders nothing when the list is
 * empty, so it never adds clutter to a beneficiary whose payments all reconcile cleanly. Super
 * Admin only, same as every other reconciliation/audit tool this session added. */
export function UnlinkedPaymentsPanel({
  organizationId,
  mediaHostId,
  influencerId,
  myRole,
}: {
  organizationId: string;
  mediaHostId?: string;
  influencerId?: string;
  myRole: string | undefined | null;
}) {
  const { t } = useLang();
  const beneficiaryQuery = mediaHostId ? `mediaHostId=${mediaHostId}` : `influencerId=${influencerId}`;
  const { data: payments } = useQuery({
    queryKey: ["unlinked-payments", organizationId, mediaHostId, influencerId],
    queryFn: () => api.get<Payment[]>(`/api/v1/organizations/${organizationId}/payments/unlinked?${beneficiaryQuery}`),
    enabled: isSuperAdmin(myRole),
  });

  if (!payments || payments.length === 0) return null;

  return (
    <div className="card space-y-3 border-warning/40 bg-warning/5">
      <div className="flex items-center gap-2">
        <AlertTriangle size={16} className="text-warning" />
        <div>
          <h3 className="font-semibold text-ink">{t("unlinkedPaymentsTitle")}</h3>
          <p className="text-xs text-muted">{t("unlinkedPaymentsHint")}</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="py-1.5 pr-3">{t("paymentDateLabel")}</th>
              <th className="py-1.5 pr-3">{t("amountLabel")}</th>
              <th className="py-1.5 pr-3">{t("paymentMethodLabel")}</th>
              <th className="py-1.5 pr-3">{t("descriptionLabel")}</th>
              <th className="py-1.5 pr-3">{t("paymentStatusLabel")}</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className="border-b border-line/60">
                <td className="py-1.5 pr-3 font-medium text-ink">{new Date(p.paymentDate).toLocaleDateString()}</td>
                <td className="py-1.5 pr-3 nums">{p.currency} {(p.paidAmount ?? p.amount).toLocaleString()}</td>
                <td className="py-1.5 pr-3 text-muted">{p.method ?? "—"}</td>
                <td className="py-1.5 pr-3 text-muted">{p.description ?? "—"}</td>
                <td className="py-1.5 pr-3">
                  <span className={`badge ${PAYMENT_STATUS_BADGE[p.status]}`}>{t(PAYMENT_STATUS_LABEL_KEYS[p.status])}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
