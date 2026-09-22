"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Modal } from "@/components/Modal";
import { useLang } from "@/lib/i18n";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/types";

const METHOD_LABEL_KEYS: Record<PaymentMethod, "paymentMethodCash" | "paymentMethodBankTransfer" | "paymentMethodCheque" | "paymentMethodMobileMoney" | "paymentMethodCard" | "paymentMethodOnlinePayment"> = {
  CASH: "paymentMethodCash",
  BANK_TRANSFER: "paymentMethodBankTransfer",
  CHEQUE: "paymentMethodCheque",
  MOBILE_MONEY: "paymentMethodMobileMoney",
  CARD: "paymentMethodCard",
  ONLINE_PAYMENT: "paymentMethodOnlinePayment",
};

/** The one real "pay" action for a met-target week/campaign — records it as paid right here, with
 * proof attached, instead of the old "create a ticket" step that quietly sat as PENDING with no
 * clear next step. Shared by PostingAgreementCard's weekly table, PostingFoldersPanel's campaign
 * table, and Finance's org-wide ready-for-payment queue. */
export function MarkAgreementPaidModal({
  organizationId,
  evaluationId,
  agreedAmount,
  currency,
  onClose,
  onDone,
}: {
  organizationId: string;
  evaluationId: string;
  agreedAmount: number;
  currency: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useLang();
  const [amount, setAmount] = useState(String(agreedAmount));
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccountName, setBankAccountName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankTransactionRef, setBankTransactionRef] = useState("");
  const [mobileMoneyNumber, setMobileMoneyNumber] = useState("");
  const [mobileMoneyTransactionId, setMobileMoneyTransactionId] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payment = await api.post<{ id: string }>(`/api/v1/organizations/${organizationId}/posting-agreements/evaluations/${evaluationId}/mark-paid`, {
        amountPaid: Number(amount),
        paymentDate,
        method,
        referenceNumber: referenceNumber || undefined,
        bankName: method === "BANK_TRANSFER" ? bankName || undefined : undefined,
        bankAccountName: method === "BANK_TRANSFER" ? bankAccountName || undefined : undefined,
        bankAccountNumber: method === "BANK_TRANSFER" ? bankAccountNumber || undefined : undefined,
        bankTransactionRef: method === "BANK_TRANSFER" ? bankTransactionRef || undefined : undefined,
        mobileMoneyNumber: method === "MOBILE_MONEY" ? mobileMoneyNumber || undefined : undefined,
        mobileMoneyTransactionId: method === "MOBILE_MONEY" ? mobileMoneyTransactionId || undefined : undefined,
      });

      if (attachmentFile) {
        const fd = new FormData();
        fd.append("file", attachmentFile);
        await fetch(`/api/v1/organizations/${organizationId}/payments/${payment.id}/attachment`, {
          method: "POST",
          credentials: "include",
          body: fd,
        });
      }

      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("failedMarkAgreementPaid"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title={t("markAsPaidTitle")}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <button type="button" onClick={onClose} className="btn-secondary">{t("cancel")}</button>
          <button type="submit" form="mark-agreement-paid-form" disabled={submitting} className="btn-primary">{submitting ? t("saving") : t("markAsPaidTitle")}</button>
        </div>
      }
    >
      <form id="mark-agreement-paid-form" onSubmit={onSubmit} className="space-y-3">
        <div className="rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm">
          <span className="text-muted">{t("amountAgreedLabel")}: </span>
          <span className="font-semibold text-ink">{currency} {agreedAmount.toLocaleString()}</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">{t("amountLabel")}</label>
            <input required type="number" min="0" step="0.01" className="input" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <label className="label">{t("paymentDateLabel")}</label>
            <input required type="date" className="input" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="label">{t("paymentMethodLabel")}</label>
          <select className="input" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>{t(METHOD_LABEL_KEYS[m])}</option>
            ))}
          </select>
        </div>

        {method === "BANK_TRANSFER" && (
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-line p-3.5">
            <div><label className="label">{t("bankNameLabel")}</label><input className="input" value={bankName} onChange={(e) => setBankName(e.target.value)} /></div>
            <div><label className="label">{t("bankAccountNameLabel")}</label><input className="input" value={bankAccountName} onChange={(e) => setBankAccountName(e.target.value)} /></div>
            <div><label className="label">{t("bankAccountNumberLabel")}</label><input className="input" value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} /></div>
            <div><label className="label">{t("bankTransactionRefLabel")}</label><input className="input" value={bankTransactionRef} onChange={(e) => setBankTransactionRef(e.target.value)} /></div>
          </div>
        )}

        {method === "MOBILE_MONEY" && (
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-line p-3.5">
            <div className="col-span-2"><label className="label">{t("mobileMoneyNumberLabel")}</label><input className="input" value={mobileMoneyNumber} onChange={(e) => setMobileMoneyNumber(e.target.value)} /></div>
            <div className="col-span-2"><label className="label">{t("mobileMoneyTransactionIdLabel")}</label><input className="input" value={mobileMoneyTransactionId} onChange={(e) => setMobileMoneyTransactionId(e.target.value)} /></div>
          </div>
        )}

        {(method === "CASH" || method === "CHEQUE" || method === "CARD" || method === "ONLINE_PAYMENT") && (
          <div>
            <label className="label">{t("referenceNumberLabel")}</label>
            <input className="input" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} />
          </div>
        )}

        <div>
          <label className="label">{t("attachmentLabel")}</label>
          <label className="btn-secondary inline-flex cursor-pointer text-xs">
            <Upload size={13} /> {attachmentFile ? attachmentFile.name : t("uploadPhoto")}
            <input type="file" className="hidden" onChange={(e) => setAttachmentFile(e.target.files?.[0] ?? null)} />
          </label>
        </div>

        {error && <p className="text-sm text-brand">{error}</p>}
      </form>
    </Modal>
  );
}
