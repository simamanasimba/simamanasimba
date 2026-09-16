"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Modal } from "@/components/Modal";
import { useAuth } from "@/hooks/useAuth";
import { useLang } from "@/lib/i18n";
import { PAYMENT_METHODS, type PaymentMethod, type Member } from "@/lib/types";

const METHOD_LABEL_KEYS: Record<PaymentMethod, "paymentMethodCash" | "paymentMethodBankTransfer" | "paymentMethodCheque" | "paymentMethodMobileMoney" | "paymentMethodCard" | "paymentMethodOnlinePayment"> = {
  CASH: "paymentMethodCash",
  BANK_TRANSFER: "paymentMethodBankTransfer",
  CHEQUE: "paymentMethodCheque",
  MOBILE_MONEY: "paymentMethodMobileMoney",
  CARD: "paymentMethodCard",
  ONLINE_PAYMENT: "paymentMethodOnlinePayment",
};

/** The same "record a payment" flow as RecordPaymentModal, but for one already-known leader —
 * reached directly from that member's own page, so there's no beneficiary picker or campaign
 * step (members are never paid against a campaign). An admin uses this to REQUEST the payment —
 * it's created PENDING like every other payment and still needs an approval and Finance actually
 * sending the money, same workflow as media host/influencer payments. */
export function RecordLeaderPaymentModal({ organizationId, member, onClose, onDone }: { organizationId: string; member: Member; onClose: () => void; onDone: () => void }) {
  const { t } = useLang();
  const { data: auth } = useAuth();
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    paymentDate: new Date().toISOString().slice(0, 10),
    amount: "",
    currency: "TZS",
    method: "CASH" as PaymentMethod,
    referenceNumber: "",
    description: "",
    bankName: "",
    bankAccountName: "",
    bankAccountNumber: "",
    bankTransactionRef: "",
    mobileMoneyNumber: member.phone ?? "",
    mobileMoneyTransactionId: "",
  });

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payment = await api.post<{ id: string }>(`/api/v1/organizations/${organizationId}/payments`, {
        beneficiaryType: "MEMBER",
        memberId: member.id,
        paymentDate: form.paymentDate,
        amount: Number(form.amount),
        currency: form.currency,
        method: form.method,
        referenceNumber: form.referenceNumber || undefined,
        description: form.description || undefined,
        bankName: form.method === "BANK_TRANSFER" ? form.bankName || undefined : undefined,
        bankAccountName: form.method === "BANK_TRANSFER" ? form.bankAccountName || undefined : undefined,
        bankAccountNumber: form.method === "BANK_TRANSFER" ? form.bankAccountNumber || undefined : undefined,
        bankTransactionRef: form.method === "BANK_TRANSFER" ? form.bankTransactionRef || undefined : undefined,
        mobileMoneyNumber: form.method === "MOBILE_MONEY" ? form.mobileMoneyNumber || undefined : undefined,
        mobileMoneyTransactionId: form.method === "MOBILE_MONEY" ? form.mobileMoneyTransactionId || undefined : undefined,
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
      setError(err instanceof ApiError ? err.message : "Failed to record payment");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title={`${t("recordPaymentTitle")} — ${member.firstName} ${member.lastName}`}
      onClose={onClose}
      wide
      footer={
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <button type="button" onClick={onClose} className="btn-secondary">{t("cancel")}</button>
          <button type="submit" form="record-leader-payment-form" disabled={submitting} className="btn-primary">{submitting ? t("creatingLabel") : t("save")}</button>
        </div>
      }
    >
      <form id="record-leader-payment-form" onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div>
            <label className="label">{t("paymentDateLabel")}</label>
            <input required type="date" className="input" value={form.paymentDate} onChange={(e) => set("paymentDate", e.target.value)} />
          </div>
          <div>
            <label className="label">{t("amountLabel")}</label>
            <input required type="number" min="0" className="input" value={form.amount} onChange={(e) => set("amount", e.target.value)} />
          </div>
          <div>
            <label className="label">{t("currencyLabel")}</label>
            <input className="input" value={form.currency} onChange={(e) => set("currency", e.target.value)} />
          </div>
        </div>

        <div>
          <label className="label">{t("notesLabel")}</label>
          <textarea required className="input min-h-[60px]" placeholder={t("paymentPurposePlaceholder")} value={form.description} onChange={(e) => set("description", e.target.value)} />
        </div>

        <div>
          <label className="label">{t("paymentMethodLabel")}</label>
          <select className="input" value={form.method} onChange={(e) => set("method", e.target.value)}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>{t(METHOD_LABEL_KEYS[m])}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted">{t("preferredPaymentMethodHelp")}</p>
        </div>

        {form.method === "BANK_TRANSFER" && (
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-line p-3.5">
            <div><label className="label">{t("bankNameLabel")}</label><input className="input" value={form.bankName} onChange={(e) => set("bankName", e.target.value)} /></div>
            <div><label className="label">{t("bankAccountNameLabel")}</label><input className="input" value={form.bankAccountName} onChange={(e) => set("bankAccountName", e.target.value)} /></div>
            <div><label className="label">{t("bankAccountNumberLabel")}</label><input className="input" value={form.bankAccountNumber} onChange={(e) => set("bankAccountNumber", e.target.value)} /></div>
            <div><label className="label">{t("bankTransactionRefLabel")}</label><input className="input" value={form.bankTransactionRef} onChange={(e) => set("bankTransactionRef", e.target.value)} /></div>
          </div>
        )}

        {form.method === "MOBILE_MONEY" && (
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-line p-3.5">
            <div className="col-span-2">
              <label className="label">{t("mobileMoneyNumberLabel")}</label>
              <input className="input" value={form.mobileMoneyNumber} onChange={(e) => set("mobileMoneyNumber", e.target.value)} />
            </div>
            <div className="col-span-2"><label className="label">{t("mobileMoneyTransactionIdLabel")}</label><input className="input" value={form.mobileMoneyTransactionId} onChange={(e) => set("mobileMoneyTransactionId", e.target.value)} /></div>
          </div>
        )}

        {(form.method === "CASH" || form.method === "CHEQUE" || form.method === "CARD" || form.method === "ONLINE_PAYMENT") && (
          <div>
            <label className="label">{t("referenceNumberLabel")}</label>
            <input className="input" value={form.referenceNumber} onChange={(e) => set("referenceNumber", e.target.value)} />
          </div>
        )}

        <div>
          <label className="label">{t("attachmentLabel")}</label>
          <label className="btn-secondary inline-flex cursor-pointer text-xs">
            <Upload size={13} /> {attachmentFile ? attachmentFile.name : t("uploadPhoto")}
            <input type="file" className="hidden" onChange={(e) => setAttachmentFile(e.target.files?.[0] ?? null)} />
          </label>
        </div>

        <div>
          <label className="label">{t("paidByLabel")}</label>
          <input disabled className="input bg-surface" value={auth?.user ? `${auth.user.firstName} ${auth.user.lastName}` : ""} />
        </div>
        <p className="rounded-xl border border-line bg-surface px-3.5 py-2.5 text-xs text-muted">{t("paymentAwaitsApprovalHint")}</p>

        {error && <p className="text-sm text-brand">{error}</p>}
      </form>
    </Modal>
  );
}
