"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import type { Payment } from "@/lib/types";
import { PAYMENT_STATUS_LABEL_KEYS, PAYMENT_STATUS_BADGE } from "@/lib/paymentStatusDisplay";
import { PaymentDetailModal } from "@/components/PaymentDetailModal";
import { RequireAccess } from "@/components/RequireAccess";
import { TableSearchInput } from "@/components/TableSearchInput";
import { useLang } from "@/lib/i18n";

/** Reached by clicking the "Today's payments" card on the Finance dashboard — the full detail
 * list that card used to show inline before it was collapsed down to just a total. */
export default function TodaysPaymentsPage() {
  const { organizationId } = useParams<{ organizationId: string }>();
  const { t } = useLang();
  const [viewing, setViewing] = useState<Payment | null>(null);

  const { data: payments } = useQuery({
    queryKey: ["payments", organizationId, "PAID"],
    queryFn: () => api.get<Payment[]>(`/api/v1/organizations/${organizationId}/payments?status=PAID`),
  });

  const today = new Date().toISOString().slice(0, 10);
  const todaysPayments = useMemo(() => (payments ?? []).filter((p) => p.paymentDate.slice(0, 10) === today), [payments, today]);
  const todaysTotal = todaysPayments.reduce((sum, p) => sum + Number(p.paidAmount ?? p.amount), 0);

  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();
  const filteredPayments = q
    ? todaysPayments.filter((p) =>
        [p.mediaHost?.name, p.influencer?.name, p.method, p.bankTransactionRef, p.mobileMoneyTransactionId, p.referenceNumber].some((f) =>
          (f ?? "").toLowerCase().includes(q),
        ),
      )
    : todaysPayments;

  return (
    <RequireAccess area="finance">
      <div className="space-y-6">
        <Link href={`/org/${organizationId}/finance`} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-brand">
          <ArrowLeft size={15} /> {t("backToListCta")}
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-extrabold text-ink">{t("todaysPaymentsTitle")}</h1>
            <p className="text-sm text-muted">{t("todaysPaymentsHelp")}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted">{t("totalLabel")}</p>
            <p className="nums text-2xl font-bold text-ink">{todaysPayments[0]?.currency ?? "TZS"} {todaysTotal.toLocaleString()}</p>
          </div>
        </div>

        {todaysPayments.length === 0 ? (
          <p className="card text-muted">{t("noPaymentsToday")}</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <TableSearchInput value={search} onChange={setSearch} placeholder={t("searchGenericPlaceholder")} />
            </div>
            {filteredPayments.length === 0 ? (
              <p className="card text-muted">{t("noSearchResults")}</p>
            ) : (
          <div className="card overflow-hidden p-0">
            <div className="max-h-[560px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-surface text-left text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="whitespace-nowrap px-4 py-2.5">{t("beneficiaryLabel")}</th>
                    <th className="whitespace-nowrap px-4 py-2.5">{t("paymentMethodLabel")}</th>
                    <th className="whitespace-nowrap px-4 py-2.5">{t("amountLabel")}</th>
                    <th className="whitespace-nowrap px-4 py-2.5">{t("referenceNumberLabel")}</th>
                    <th className="whitespace-nowrap px-4 py-2.5">{t("paymentStatusLabel")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filteredPayments.map((p) => (
                    <tr key={p.id} onClick={() => setViewing(p)} className="cursor-pointer hover:bg-brand-50/40">
                      <td className="px-4 py-2.5 font-medium text-ink">{p.mediaHost?.name ?? p.influencer?.name ?? "—"}</td>
                      <td className="px-4 py-2.5 text-muted">{p.method ?? "—"}</td>
                      <td className="nums px-4 py-2.5">{p.currency} {p.amount.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-muted">{p.bankTransactionRef ?? p.mobileMoneyTransactionId ?? p.referenceNumber ?? "—"}</td>
                      <td className="px-4 py-2.5">
                        <span className={`badge ${PAYMENT_STATUS_BADGE[p.status]}`}>{t(PAYMENT_STATUS_LABEL_KEYS[p.status])}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
            )}
          </>
        )}

        {viewing && <PaymentDetailModal organizationId={organizationId} payment={viewing} onClose={() => setViewing(null)} />}
      </div>
    </RequireAccess>
  );
}
