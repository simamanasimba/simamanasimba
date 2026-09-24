"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { Modal } from "@/components/Modal";
import { useLang } from "@/lib/i18n";
import type { Payment } from "@/lib/types";

/** Reconciliation action — Super Admin only. For a week/campaign that's genuinely already been
 * paid, but through a path that never named a specific week (a general "Record Payment", a bulk
 * payment, or one predating the Campaign Weeks system) — that's exactly why it can otherwise sit
 * showing "Awaiting Finance" forever despite money already having moved. This links the ALREADY-
 * RECORDED payment to this evaluation; it never creates a new payment, so nothing is double-
 * counted in any spend total, it only corrects which week the existing one is credited to. */
export function LinkExistingPaymentModal({
  organizationId,
  evaluationId,
  mediaHostId,
  influencerId,
  onClose,
  onDone,
}: {
  organizationId: string;
  evaluationId: string;
  mediaHostId?: string;
  influencerId?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useLang();
  const beneficiaryQuery = mediaHostId ? `mediaHostId=${mediaHostId}` : `influencerId=${influencerId}`;
  const { data: payments } = useQuery({
    queryKey: ["payments-for-linking", organizationId, mediaHostId, influencerId],
    queryFn: () => api.get<Payment[]>(`/api/v1/organizations/${organizationId}/payments?${beneficiaryQuery}`),
  });
  const sortedPayments = [...(payments ?? [])].sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));

  const [paymentId, setPaymentId] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!paymentId || !reason.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/api/v1/organizations/${organizationId}/posting-agreements/evaluations/${evaluationId}/link-payment`, {
        paymentId,
        reason: reason.trim(),
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("failedLinkPayment"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title={t("linkExistingPaymentTitle")}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <button type="button" onClick={onClose} className="btn-secondary">{t("cancel")}</button>
          <button type="submit" form="link-existing-payment-form" disabled={submitting || !paymentId || !reason.trim()} className="btn-primary">
            {submitting ? t("saving") : t("linkPaymentCta")}
          </button>
        </div>
      }
    >
      <form id="link-existing-payment-form" onSubmit={onSubmit} className="space-y-3">
        <p className="rounded-xl border border-warning/40 bg-warning/10 px-3.5 py-2.5 text-xs text-warning">{t("linkExistingPaymentHint")}</p>

        <div>
          <label className="label">{t("selectPaymentLabel")}</label>
          {sortedPayments.length === 0 ? (
            <p className="text-sm text-muted">{t("noPaymentsToLink")}</p>
          ) : (
            <select required className="input" value={paymentId} onChange={(e) => setPaymentId(e.target.value)}>
              <option value="">{t("selectPaymentPlaceholder")}</option>
              {sortedPayments.map((p) => (
                <option key={p.id} value={p.id}>
                  {new Date(p.paymentDate).toLocaleDateString()} — {p.currency} {(p.paidAmount ?? p.amount).toLocaleString()} — {p.method ?? "—"}
                  {p.description ? ` — ${p.description}` : ""}
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="label">{t("conditionalReasonLabel")}</label>
          <textarea
            required
            rows={2}
            className="input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("linkExistingPaymentReasonPlaceholder")}
          />
        </div>

        {error && <p className="text-sm text-brand">{error}</p>}
      </form>
    </Modal>
  );
}
