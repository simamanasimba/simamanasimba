"use client";

import { useState } from "react";
import { useLang } from "@/lib/i18n";
import { PAYMENT_STATUS_LABEL_KEYS, PAYMENT_STATUS_BADGE } from "@/lib/paymentStatusDisplay";
import { PaymentDetailModal } from "@/components/PaymentDetailModal";
import { TableSearchInput } from "@/components/TableSearchInput";
import type { Payment } from "@/lib/types";

/** Shared between the media-host/influencer profile pages' Finance-facing inline view and their
 * dedicated "Total Spend" payments subpages — same table, four call sites. Clicking a row opens
 * PaymentDetailModal — the one place a receipt can be viewed or (even for an already-PAID
 * payment) uploaded/replaced. */
export function PaymentHistoryTable({ organizationId, payments }: { organizationId: string; payments: Payment[] }) {
  const { t } = useLang();
  const [viewing, setViewing] = useState<Payment | null>(null);
  const [search, setSearch] = useState("");

  const q = search.trim().toLowerCase();
  const filtered = q
    ? payments.filter((p) =>
        [p.method, p.bankTransactionRef ?? p.mobileMoneyTransactionId ?? p.referenceNumber, p.status, p.weekLabel, new Date(p.paymentDate).toLocaleDateString()].some((f) =>
          (f ?? "").toLowerCase().includes(q),
        ),
      )
    : payments;

  return (
    <div className="card overflow-hidden p-0">
      <h2 className="px-5 pt-5 text-sm font-semibold uppercase tracking-wide text-muted">{t("paymentHistoryTitle")}</h2>
      {payments.length === 0 ? (
        <p className="px-5 py-6 text-muted">{t("noPaymentHistoryYet")}</p>
      ) : (
        <>
          <div className="px-5 pt-3">
            <TableSearchInput value={search} onChange={setSearch} placeholder={t("searchGenericPlaceholder")} />
          </div>
          {filtered.length === 0 ? (
            <p className="px-5 py-6 text-muted">{t("noSearchResults")}</p>
          ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-2.5">{t("paymentDateLabel")}</th>
                <th className="px-5 py-2.5">{t("amountLabel")}</th>
                <th className="px-5 py-2.5">{t("weekColLabel")}</th>
                <th className="px-5 py-2.5">{t("paymentMethodLabel")}</th>
                <th className="px-5 py-2.5">{t("referenceNumberLabel")}</th>
                <th className="px-5 py-2.5">{t("paymentStatusLabel")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((p) => (
                <tr key={p.id} onClick={() => setViewing(p)} className="cursor-pointer hover:bg-brand-50/40">
                  <td className="px-5 py-2.5 font-medium text-ink">{new Date(p.paymentDate).toLocaleDateString()}</td>
                  <td className="nums px-5 py-2.5">{p.currency} {p.amount.toLocaleString()}</td>
                  <td className="px-5 py-2.5 text-muted">{p.weekLabel ?? "—"}</td>
                  <td className="px-5 py-2.5 text-muted">{p.method ?? "—"}</td>
                  <td className="px-5 py-2.5 text-muted">{p.bankTransactionRef ?? p.mobileMoneyTransactionId ?? p.referenceNumber ?? "—"}</td>
                  <td className="px-5 py-2.5">
                    <span className={`badge ${PAYMENT_STATUS_BADGE[p.status]}`}>{t(PAYMENT_STATUS_LABEL_KEYS[p.status])}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
          )}
        </>
      )}

      {viewing && (
        <PaymentDetailModal organizationId={organizationId} payment={viewing} onClose={() => setViewing(null)} />
      )}
    </div>
  );
}
