"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Modal } from "@/components/Modal";
import { useLang } from "@/lib/i18n";
import type { PostingAgreement, PostingAgreementEngagementMetric, PostingAgreementTargetType } from "@/lib/types";

const ENGAGEMENT_METRICS: PostingAgreementEngagementMetric[] = ["VIEWS", "LIKES", "COMMENTS", "SHARES", "TOTAL_ENGAGEMENT"];

export function PostingAgreementModal({
  organizationId,
  mediaHostId,
  influencerId,
  agreement,
  onClose,
  onDone,
}: {
  organizationId: string;
  mediaHostId?: string;
  influencerId?: string;
  agreement?: PostingAgreement;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useLang();
  const isEdit = Boolean(agreement);
  const [form, setForm] = useState({
    targetType: (agreement?.targetType ?? "POST_COUNT") as PostingAgreementTargetType,
    postsPerWeek: agreement?.postsPerWeek != null ? String(agreement.postsPerWeek) : "",
    engagementMetric: (agreement?.engagementMetric ?? "VIEWS") as PostingAgreementEngagementMetric,
    engagementTarget: agreement?.engagementTarget != null ? String(agreement.engagementTarget) : "",
    weeklyAmount: agreement?.weeklyAmount != null ? String(agreement.weeklyAmount) : "",
    currency: agreement?.currency ?? "TZS",
    notes: agreement?.notes ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const metricLabel: Record<PostingAgreementEngagementMetric, string> = {
    VIEWS: t("metricViews"),
    LIKES: t("metricLikes"),
    COMMENTS: t("metricComments"),
    SHARES: t("metricShares"),
    TOTAL_ENGAGEMENT: t("metricTotalEngagement"),
  };

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const body = {
        mediaHostId,
        influencerId,
        targetType: form.targetType,
        postsPerWeek: form.targetType === "POST_COUNT" ? Number(form.postsPerWeek) : undefined,
        engagementMetric: form.targetType === "ENGAGEMENT" ? form.engagementMetric : undefined,
        engagementTarget: form.targetType === "ENGAGEMENT" ? Number(form.engagementTarget) : undefined,
        weeklyAmount: Number(form.weeklyAmount),
        currency: form.currency || undefined,
        notes: form.notes || undefined,
      };
      if (isEdit) {
        await api.patch(`/api/v1/organizations/${organizationId}/posting-agreements/${agreement!.id}`, body);
      } else {
        await api.post(`/api/v1/organizations/${organizationId}/posting-agreements`, body);
      }
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("failedSaveAgreement"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title={isEdit ? t("editAgreementCta") : t("postingAgreementTitle")}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <button type="button" onClick={onClose} className="btn-secondary">{t("cancel")}</button>
          <button type="submit" form="posting-agreement-form" disabled={submitting} className="btn-primary">{submitting ? t("saving") : t("save")}</button>
        </div>
      }
    >
      <form id="posting-agreement-form" onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="label">{t("targetTypeLabel")}</label>
          <select className="input" value={form.targetType} onChange={(e) => set("targetType", e.target.value as PostingAgreementTargetType)}>
            <option value="POST_COUNT">{t("targetTypePostCount")}</option>
            <option value="ENGAGEMENT">{t("targetTypeEngagement")}</option>
          </select>
        </div>

        {form.targetType === "POST_COUNT" ? (
          <div>
            <label className="label">{t("postsPerWeekLabel")}</label>
            <input required type="number" min="1" className="input" value={form.postsPerWeek} onChange={(e) => set("postsPerWeek", e.target.value)} />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t("agreementEngagementMetricLabel")}</label>
              <select className="input" value={form.engagementMetric} onChange={(e) => set("engagementMetric", e.target.value as PostingAgreementEngagementMetric)}>
                {ENGAGEMENT_METRICS.map((m) => (
                  <option key={m} value={m}>{metricLabel[m]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">{t("engagementTargetLabel")}</label>
              <input required type="number" min="1" className="input" value={form.engagementTarget} onChange={(e) => set("engagementTarget", e.target.value)} />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">{t("weeklyAmountLabel")}</label>
            <input required type="number" min="0" step="0.01" className="input" value={form.weeklyAmount} onChange={(e) => set("weeklyAmount", e.target.value)} />
          </div>
          <div>
            <label className="label">{t("currencyLabel")}</label>
            <input className="input" value={form.currency} onChange={(e) => set("currency", e.target.value)} />
          </div>
        </div>

        <div>
          <label className="label">{t("notesLabel")}</label>
          <textarea className="input" rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </div>

        {error && <p className="pt-3 text-sm text-brand">{error}</p>}
      </form>
    </Modal>
  );
}
