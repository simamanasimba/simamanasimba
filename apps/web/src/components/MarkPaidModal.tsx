"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Modal } from "@/components/Modal";
import { useLang } from "@/lib/i18n";
import { PAYMENT_METHODS, type Payment, type PaymentMethod } from "@/lib/types";

const METHOD_LABEL_KEYS: Record<PaymentMethod, "paymentMethodCash" | "paymentMethodBankTransfer" | "paymentMethodCheque" | "paymentMethodMobileMoney" | "paymentMethodCard" | "paymentMethodOnlinePayment"> = {
  CASH: "paymentMethodCash",
  BANK_TRANSFER: "paymentMethodBankTransfer",
  CHEQUE: "paymentMethodCheque",
  MOBILE_MONEY: "paymentMethodMobileMoney",
  CARD: "paymentMethodCard",
  ONLINE_PAYMENT: "paymentMethodOnlinePayment",
};

/** Finance's own final step for a payment an admin already approved ("Pending Payment") — this
 * is where the actual method/reference for the money that was sent gets recorded, and the
 * payment (and its linked campaign) finally becomes PAID. */
export function MarkPaidModal({
  organizationId,
  payment,
  onClose,
  onDone,
}: {
  organizationId: string;
  payment: Payment;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useLang();
  const [method, setMethod] = useState<PaymentMethod>((payment.method as PaymentMethod) || "CASH");
  const [referenceNumber, setReferenceNumber] = useState(payment.referenceNumber ?? "");
  const [paidAmount, setPaidAmount] = useState(String(payment.amount));
  const [varianceNote, setVarianceNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountDiffers = Number(paidAmount) !== payment.amount;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (amountDiffers && !varianceNote.trim()) {
      setError(t("amountVarianceRequired"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.patch(`/api/v1/organizations/${organizationId}/payments/${payment.id}/mark-paid`, {
        method,
        referenceNumber: referenceNumber || undefined,
        paidAmount: Number(paidAmount),
        varianceNote: amountDiffers ? varianceNote.trim() : undefined,
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("failedMarkPaid"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={t("markPaidCta")} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm">
            <p className="text-xs text-muted">{t("approvedAmountLabel")}</p>
            <p className="nums font-semibold text-ink">{payment.currency} {payment.amount.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm">
            <p className="text-xs text-muted">{t("approvedByLabel")}</p>
            <p className="font-semibold text-ink">{payment.approvedByName ?? "—"}</p>
          </div>
        </div>
        <div>
          <label className="label">{t("paidAmountLabel")}</label>
          <input required type="number" min="0" className="input" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} />
        </div>
        <div>
          <label className="label">{t("paymentMethodLabel")}</label>
          <select className="input" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{t(METHOD_LABEL_KEYS[m])}</option>)}
          </select>
        </div>
        <div>
          <label className="label">{t("referenceNumberLabel")}</label>
          <input className="input" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} />
        </div>
        {amountDiffers && (
          <div>
            <label className="label">{t("amountVarianceNoteLabel")}</label>
            <textarea required className="input min-h-[70px]" value={varianceNote} onChange={(e) => setVarianceNote(e.target.value)} placeholder={t("amountVarianceNotePlaceholder")} />
          </div>
        )}
        {error && <p className="text-sm text-brand">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-line pt-3">
          <button type="button" onClick={onClose} className="btn-secondary">{t("cancel")}</button>
          <button type="submit" disabled={submitting} className="btn-primary">{submitting ? t("saving") : t("markPaidCta")}</button>
        </div>
      </form>
    </Modal>
  );
}
