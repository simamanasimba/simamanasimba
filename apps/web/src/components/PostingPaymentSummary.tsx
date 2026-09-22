"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import type { Influencer2Folder, Payment, PostingAgreement, PostingAgreementWeek } from "@/lib/types";

/** One beneficiary's money picture at a glance: everything owed but not yet paid (agreement
 * weeks/campaigns that met their target but have no ticket yet, plus tickets already created but
 * still PENDING/PROCESSING) next to everything already PAID. Reads the same week/folder/payment
 * data PostingAgreementCard, PostingFoldersPanel and the payment-history page already show
 * individually — this just adds the totals up in one place instead of making Finance do it by
 * hand. */
export function PostingPaymentSummary({
  organizationId,
  mediaHostId,
  influencerId,
}: {
  organizationId: string;
  mediaHostId?: string;
  influencerId?: string;
}) {
  const { t } = useLang();
  const beneficiaryQuery = mediaHostId ? `mediaHostId=${mediaHostId}` : `influencerId=${influencerId}`;

  const { data: agreements } = useQuery({
    queryKey: ["posting-agreements", organizationId, mediaHostId, influencerId],
    queryFn: () => api.get<PostingAgreement[]>(`/api/v1/organizations/${organizationId}/posting-agreements?${beneficiaryQuery}`),
  });
  const agreement = agreements?.[0];

  const { data: weeks } = useQuery({
    queryKey: ["posting-agreement-weeks", organizationId, agreement?.id],
    queryFn: () => api.get<PostingAgreementWeek[]>(`/api/v1/organizations/${organizationId}/posting-agreements/${agreement!.id}/weeks`),
    enabled: Boolean(agreement),
  });

  const { data: folders } = useQuery({
    queryKey: ["influencer2-folders", organizationId, mediaHostId, influencerId],
    queryFn: () => api.get<Influencer2Folder[]>(`/api/v1/organizations/${organizationId}/influencer2/folders?${beneficiaryQuery}`),
  });

  const { data: payments } = useQuery({
    queryKey: ["payments", organizationId, "beneficiary", mediaHostId, influencerId],
    queryFn: () => api.get<Payment[]>(`/api/v1/organizations/${organizationId}/payments?${beneficiaryQuery}`),
  });

  const pendingByCurrency = new Map<string, number>();
  const paidByCurrency = new Map<string, number>();
  const add = (map: Map<string, number>, currency: string, amount: number) => map.set(currency, (map.get(currency) ?? 0) + amount);

  if (agreement) {
    for (const w of weeks ?? []) {
      if (w.evaluation?.targetMet && !w.evaluation.paymentId) add(pendingByCurrency, agreement.currency, agreement.weeklyAmount);
    }
    for (const f of folders ?? []) {
      if (f.evaluation?.targetMet && !f.evaluation.paymentId) add(pendingByCurrency, agreement.currency, agreement.weeklyAmount);
    }
  }
  for (const p of payments ?? []) {
    const amount = p.paidAmount ?? p.amount;
    if (p.status === "PAID") add(paidByCurrency, p.currency, amount);
    else if (p.status === "PENDING" || p.status === "PROCESSING") add(pendingByCurrency, p.currency, amount);
  }

  if (pendingByCurrency.size === 0 && paidByCurrency.size === 0) return null;

  return (
    <div className="card grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <p className="text-xs text-muted">{t("totalPendingPaymentLabel")}</p>
        {pendingByCurrency.size === 0 ? (
          <p className="nums text-lg font-bold text-ink">—</p>
        ) : (
          [...pendingByCurrency.entries()].map(([currency, total]) => (
            <p key={currency} className="nums text-lg font-bold text-brand-700">{currency} {total.toLocaleString()}</p>
          ))
        )}
      </div>
      <div>
        <p className="text-xs text-muted">{t("totalAlreadyPaidLabel")}</p>
        {paidByCurrency.size === 0 ? (
          <p className="nums text-lg font-bold text-ink">—</p>
        ) : (
          [...paidByCurrency.entries()].map(([currency, total]) => (
            <p key={currency} className="nums text-lg font-bold text-success">{currency} {total.toLocaleString()}</p>
          ))
        )}
      </div>
    </div>
  );
}
