"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Modal } from "@/components/Modal";
import { useLang } from "@/lib/i18n";

/** The single "Approve Payment" action on an Unpaid campaign — collapses what used to be two
 * separate steps in two separate places (record a payment on the Finance page, then approve it
 * on the Campaign Tracker page) into one button an admin uses right where they're already
 * looking at the unpaid campaign. Under the hood this still does both API calls (create the
 * payment, then approve it), and approving only authorizes the amount FOR Finance to pay — it
 * moves the payment to "Pending Payment", not "Paid". No payment method is asked for here: the
 * admin isn't the one making the payment, so how it gets paid is Finance's own step (see
 * ProcessingPaymentsPanel / PaymentsService.markPaid) — asking for it here would blur who does
 * what. */
export function ApprovePaymentModal({
  organizationId,
  campaignId,
  beneficiaryType,
  beneficiaryId,
  onClose,
  onDone,
}: {
  organizationId: string;
  campaignId: string;
  beneficiaryType: "MEDIA_HOST" | "INFLUENCER";
  beneficiaryId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useLang();
  const [form, setForm] = useState({
    paymentDate: new Date().toISOString().slice(0, 10),
    amount: "",
    currency: "TZS",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payment = await api.post<{ id: string }>(`/api/v1/organizations/${organizationId}/payments`, {
        beneficiaryType,
        mediaHostId: beneficiaryType === "MEDIA_HOST" ? beneficiaryId : undefined,
        influencerId: beneficiaryType === "INFLUENCER" ? beneficiaryId : undefined,
        influencer2CampaignId: campaignId,
        paymentDate: form.paymentDate,
        amount: Number(form.amount),
        currency: form.currency,
      });
      await api.patch(`/api/v1/organizations/${organizationId}/payments/${payment.id}/approve`, {});
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("failedApprovePayment"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={t("approvePaymentCta")} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <p className="rounded-xl border border-line bg-surface px-3.5 py-2.5 text-xs text-muted">{t("approvePaymentHint")}</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">{t("paymentDateLabel")}</label>
            <input required type="date" className="input" value={form.paymentDate} onChange={(e) => setForm((f) => ({ ...f, paymentDate: e.target.value }))} />
          </div>
          <div>
            <label className="label">{t("amountLabel")}</label>
            <input required type="number" min="0" className="input" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
          </div>
        </div>
        {error && <p className="text-sm text-brand">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-line pt-3">
          <button type="button" onClick={onClose} className="btn-secondary">{t("cancel")}</button>
          <button type="submit" disabled={submitting} className="btn-primary">{submitting ? t("saving") : t("approvePaymentCta")}</button>
        </div>
      </form>
    </Modal>
  );
}
