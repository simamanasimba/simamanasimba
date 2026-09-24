"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Upload, FileText, Lock, Pencil, Undo2 } from "lucide-react";
import { Modal } from "@/components/Modal";
import { useLang } from "@/lib/i18n";
import { useAuth } from "@/hooks/useAuth";
import { api, ApiError } from "@/lib/api";
import { isSuperAdmin } from "@/lib/permissions";
import { PAYMENT_STATUS_LABEL_KEYS, PAYMENT_STATUS_BADGE } from "@/lib/paymentStatusDisplay";
import { PAYMENT_METHODS, type Payment, type PaymentMethod } from "@/lib/types";

const LOCKED_STATUSES: Payment["status"][] = ["PAID", "REJECTED", "CANCELLED"];

const METHOD_LABEL_KEYS: Record<PaymentMethod, "paymentMethodCash" | "paymentMethodBankTransfer" | "paymentMethodCheque" | "paymentMethodMobileMoney" | "paymentMethodCard" | "paymentMethodOnlinePayment"> = {
  CASH: "paymentMethodCash",
  BANK_TRANSFER: "paymentMethodBankTransfer",
  CHEQUE: "paymentMethodCheque",
  MOBILE_MONEY: "paymentMethodMobileMoney",
  CARD: "paymentMethodCard",
  ONLINE_PAYMENT: "paymentMethodOnlinePayment",
};

/** Detail view for one payment, opened by clicking a row in PaymentHistoryTable (on the
 * influencer/media-host profile pages and their dedicated payment-history pages).
 * Once a payment is PAID (or REJECTED/CANCELLED) it's locked — view-only, nothing editable,
 * receipt included. While it's still unpaid, the receipt stays uploadable/replaceable, and a
 * Finance Officer specifically (not admins — paying is Finance's job, same rule as everywhere
 * else in this app) can fill in the amount/method/reference right here and complete the payment
 * once it's been approved (PROCESSING). */
export function PaymentDetailModal({
  organizationId,
  payment: initialPayment,
  onClose,
}: {
  organizationId: string;
  payment: Payment;
  onClose: () => void;
}) {
  const { t } = useLang();
  const orgId = organizationId;
  const { data: me } = useAuth();
  const myRole = me?.organizations.find((o) => o.organizationId === orgId)?.role;
  const isFinance = myRole === "FINANCE_OFFICER";
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [payment, setPayment] = useState(initialPayment);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [method, setMethod] = useState<PaymentMethod>((payment.method as PaymentMethod) || "CASH");
  const [referenceNumber, setReferenceNumber] = useState(payment.referenceNumber ?? "");
  const [paidAmount, setPaidAmount] = useState(String(payment.amount));
  const [varianceNote, setVarianceNote] = useState("");
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);

  const isLocked = LOCKED_STATUSES.includes(payment.status);
  const canComplete = isFinance && payment.status === "PROCESSING";
  const amountDiffers = Number(paidAmount) !== payment.amount;

  // "Action Access Control": correcting or reversing an already-recorded payment is a sensitive,
  // Super-Admin-only action — every use requires a stated reason and is flagged in the Sensitive
  // Actions log for review (see AuditLogsController.listSensitive). Available regardless of the
  // payment's own PENDING/PROCESSING/PAID lock state, since a correction is often needed
  // *because* something was already marked paid incorrectly.
  const canManageSensitive = isSuperAdmin(myRole);
  const [editingPayment, setEditingPayment] = useState(false);
  const [editForm, setEditForm] = useState({
    amount: String(payment.amount),
    paidAmount: payment.paidAmount != null ? String(payment.paidAmount) : "",
    paymentDate: payment.paymentDate.slice(0, 10),
    method: payment.method ?? "",
    referenceNumber: payment.referenceNumber ?? "",
    bankTransactionRef: payment.bankTransactionRef ?? "",
    mobileMoneyTransactionId: payment.mobileMoneyTransactionId ?? "",
    reason: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [undoing, setUndoing] = useState(false);
  const [undoError, setUndoError] = useState<string | null>(null);

  async function onSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editForm.reason.trim()) {
      setEditError(t("conditionalReasonRequired"));
      return;
    }
    setSavingEdit(true);
    setEditError(null);
    try {
      const updated = await api.patch<Payment>(`/api/v1/organizations/${orgId}/payments/${payment.id}/edit`, {
        amount: Number(editForm.amount),
        paidAmount: editForm.paidAmount ? Number(editForm.paidAmount) : undefined,
        paymentDate: editForm.paymentDate,
        method: editForm.method || undefined,
        referenceNumber: editForm.referenceNumber || undefined,
        bankTransactionRef: editForm.bankTransactionRef || undefined,
        mobileMoneyTransactionId: editForm.mobileMoneyTransactionId || undefined,
        reason: editForm.reason.trim(),
      });
      setPayment((p) => ({ ...p, ...updated }));
      setEditingPayment(false);
      refreshProfiles();
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : t("failedEditPayment"));
    } finally {
      setSavingEdit(false);
    }
  }

  async function onUndoPayment() {
    if (!confirm(t("confirmUndoPayment"))) return;
    const reason = window.prompt(t("undoPaymentReasonPrompt"));
    if (!reason?.trim()) return;
    setUndoing(true);
    setUndoError(null);
    try {
      const updated = await api.post<Payment>(`/api/v1/organizations/${orgId}/payments/${payment.id}/undo`, { reason: reason.trim() });
      setPayment((p) => ({ ...p, ...updated }));
      refreshProfiles();
    } catch (err) {
      setUndoError(err instanceof ApiError ? err.message : t("failedUndoPayment"));
    } finally {
      setUndoing(false);
    }
  }

  function refreshProfiles() {
    queryClient.invalidateQueries({ predicate: (q) => ["influencer-profile", "media-host-profile", "member"].includes(q.queryKey[0] as string) });
  }

  async function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/v1/organizations/${orgId}/payments/${payment.id}/attachment`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      if (!res.ok) throw new Error();
      const updated = (await res.json()) as Payment;
      setPayment((p) => ({ ...p, documentUrl: updated.documentUrl ?? null }));
      refreshProfiles();
    } catch {
      setUploadError(t("failedUploadReceipt"));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function onCompletePayment(e: React.FormEvent) {
    e.preventDefault();
    if (amountDiffers && !varianceNote.trim()) {
      setCompleteError(t("amountVarianceRequired"));
      return;
    }
    setCompleting(true);
    setCompleteError(null);
    try {
      const updated = await api.patch<Payment>(`/api/v1/organizations/${orgId}/payments/${payment.id}/mark-paid`, {
        method,
        referenceNumber: referenceNumber || undefined,
        paidAmount: Number(paidAmount),
        varianceNote: amountDiffers ? varianceNote.trim() : undefined,
      });
      setPayment((p) => ({ ...p, ...updated }));
      refreshProfiles();
    } catch (err) {
      setCompleteError(err instanceof ApiError ? err.message : t("failedMarkPaid"));
    } finally {
      setCompleting(false);
    }
  }

  return (
    <Modal title={t("paymentDetailsTitle")} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm">
            <p className="text-xs text-muted">{t("paymentDateLabel")}</p>
            <p className="font-semibold text-ink">{new Date(payment.paymentDate).toLocaleDateString()}</p>
          </div>
          <div className="rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm">
            <p className="text-xs text-muted">{t("paymentStatusLabel")}</p>
            <span className={`badge ${PAYMENT_STATUS_BADGE[payment.status]}`}>{t(PAYMENT_STATUS_LABEL_KEYS[payment.status])}</span>
          </div>
          <div className="rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm">
            <p className="text-xs text-muted">{t("approvedAmountLabel")}</p>
            <p className="nums font-semibold text-ink">{payment.currency} {payment.amount.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm">
            <p className="text-xs text-muted">{t("paidAmountLabel")}</p>
            <p className="nums font-semibold text-ink">{payment.paidAmount != null ? `${payment.currency} ${payment.paidAmount.toLocaleString()}` : "—"}</p>
          </div>
          {payment.paidAmount != null && payment.paidAmount !== payment.amount && payment.amountVarianceNote && (
            <div className="col-span-2 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm">
              <p className="text-xs text-muted">{t("amountVarianceNoteLabel")}</p>
              <p className="text-ink">{payment.amountVarianceNote}</p>
            </div>
          )}
          <div className="rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm">
            <p className="text-xs text-muted">{t("paymentMethodLabel")}</p>
            <p className="font-semibold text-ink">{payment.method ?? "—"}</p>
          </div>
          <div className="rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm">
            <p className="text-xs text-muted">{t("referenceNumberLabel")}</p>
            <p className="font-semibold text-ink">{payment.bankTransactionRef ?? payment.mobileMoneyTransactionId ?? payment.referenceNumber ?? "—"}</p>
          </div>
          <div className="rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm">
            <p className="text-xs text-muted">{t("approvedByLabel")}</p>
            <p className="font-semibold text-ink">{payment.approvedByName ?? "—"}</p>
          </div>
          <div className="rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm">
            <p className="text-xs text-muted">{t("approvedAtLabel")}</p>
            <p className="font-semibold text-ink">{payment.approvedAt ? new Date(payment.approvedAt).toLocaleDateString() : "—"}</p>
          </div>
        </div>

        {payment.description && (
          <div className="rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm">
            <p className="text-xs text-muted">{t("descriptionLabel")}</p>
            <p className="text-ink">{payment.description}</p>
          </div>
        )}

        <div className="rounded-xl border border-line px-3.5 py-2.5">
          <p className="mb-2 flex items-center gap-1.5 text-xs text-muted">
            {isLocked && <Lock size={12} />} {t("attachmentLabel")}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {payment.documentUrl && (
              <a href={payment.documentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline">
                <FileText size={14} /> {t("viewReceiptCta")}
              </a>
            )}
            {!isLocked && (
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="btn-secondary text-sm">
                <Upload size={13} /> {uploading ? t("saving") : payment.documentUrl ? t("replaceReceiptCta") : t("uploadReceiptCta")}
              </button>
            )}
            {!payment.documentUrl && isLocked && <span className="text-sm text-muted">{t("noReceiptUploaded")}</span>}
            <input ref={fileInputRef} type="file" className="hidden" onChange={onFileSelected} />
          </div>
          {uploadError && <p className="mt-2 text-sm text-brand">{uploadError}</p>}
        </div>

        {canComplete && (
          <form onSubmit={onCompletePayment} className="space-y-3 rounded-xl border border-brand-200 bg-brand-50/40 p-3.5">
            <p className="text-sm font-semibold text-ink">{t("completePaymentTitle")}</p>
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
                <textarea required className="input min-h-[60px]" value={varianceNote} onChange={(e) => setVarianceNote(e.target.value)} placeholder={t("amountVarianceNotePlaceholder")} />
              </div>
            )}
            {completeError && <p className="text-sm text-brand">{completeError}</p>}
            <button type="submit" disabled={completing} className="btn-primary w-full justify-center text-sm">
              {completing ? t("saving") : t("completePaymentCta")}
            </button>
          </form>
        )}

        {payment.status === "PENDING" && (
          <p className="rounded-xl border border-line bg-surface px-3.5 py-2.5 text-xs text-muted">{t("awaitingApprovalNote")}</p>
        )}

        {canManageSensitive && (
          <div className="rounded-xl border border-warning/40 bg-warning/10 p-3.5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-warning">{t("sensitiveActionsTitle")}</p>
            <div className="flex flex-wrap gap-2">
              {!editingPayment && (
                <button type="button" className="btn-secondary text-sm" onClick={() => setEditingPayment(true)}>
                  <Pencil size={13} /> {t("editPaymentCta")}
                </button>
              )}
              {payment.status !== "CANCELLED" && (
                <button type="button" className="btn-secondary text-sm" disabled={undoing} onClick={onUndoPayment}>
                  <Undo2 size={13} /> {undoing ? t("saving") : t("undoPaymentCta")}
                </button>
              )}
            </div>
            {undoError && <p className="mt-2 text-sm text-brand">{undoError}</p>}

            {editingPayment && (
              <form onSubmit={onSaveEdit} className="mt-3 space-y-3 border-t border-warning/30 pt-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">{t("amountLabel")}</label>
                    <input required type="number" min="0" step="0.01" className="input" value={editForm.amount} onChange={(e) => setEditForm((f) => ({ ...f, amount: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">{t("paidAmountLabel")}</label>
                    <input type="number" min="0" step="0.01" className="input" value={editForm.paidAmount} onChange={(e) => setEditForm((f) => ({ ...f, paidAmount: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">{t("paymentDateLabel")}</label>
                    <input required type="date" className="input" value={editForm.paymentDate} onChange={(e) => setEditForm((f) => ({ ...f, paymentDate: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">{t("paymentMethodLabel")}</label>
                    <input className="input" value={editForm.method} onChange={(e) => setEditForm((f) => ({ ...f, method: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">{t("referenceNumberLabel")}</label>
                    <input className="input" value={editForm.referenceNumber} onChange={(e) => setEditForm((f) => ({ ...f, referenceNumber: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">{t("bankTransactionRefLabel")}</label>
                    <input className="input" value={editForm.bankTransactionRef} onChange={(e) => setEditForm((f) => ({ ...f, bankTransactionRef: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="label">{t("conditionalReasonLabel")}</label>
                  <textarea required rows={2} className="input" value={editForm.reason} onChange={(e) => setEditForm((f) => ({ ...f, reason: e.target.value }))} placeholder={t("editPaymentReasonPlaceholder")} />
                </div>
                {editError && <p className="text-sm text-brand">{editError}</p>}
                <div className="flex justify-end gap-2">
                  <button type="button" className="btn-secondary text-sm" onClick={() => setEditingPayment(false)}>{t("cancel")}</button>
                  <button type="submit" disabled={savingEdit} className="btn-primary text-sm">{savingEdit ? t("saving") : t("save")}</button>
                </div>
              </form>
            )}
          </div>
        )}

        <div className="flex justify-end border-t border-line pt-3">
          <button type="button" onClick={onClose} className="btn-secondary">{t("close")}</button>
        </div>
      </div>
    </Modal>
  );
}
