"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Modal } from "@/components/Modal";
import { useLang } from "@/lib/i18n";
import type { PostingAgreement, PostingAgreementEngagementMetric } from "@/lib/types";

const ENGAGEMENT_METRICS: PostingAgreementEngagementMetric[] = ["VIEWS", "LIKES", "COMMENTS", "SHARES", "TOTAL_ENGAGEMENT"];

/** A week can require a posts target, an engagement target, or both at once — each has its own
 * on/off checkbox rather than an either/or select, since the two aren't mutually exclusive. */
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
  // Once any week/campaign under this agreement has actually been paid, its target and rate are
  // locked (enforced server-side too — this is just so the form shows read-only fields instead of
  // letting the user hit that error on submit).
  const locked = Boolean(agreement?.hasBeenPaid);
  const [wantsPosts, setWantsPosts] = useState(agreement ? agreement.postsPerWeek != null : true);
  const [wantsEngagement, setWantsEngagement] = useState(agreement ? agreement.engagementMetric != null : false);
  const [form, setForm] = useState({
    startDate: agreement?.startDate.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
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
    if (!wantsPosts && !wantsEngagement) {
      setError(t("agreementNeedsTargetError"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        mediaHostId,
        influencerId,
        startDate: form.startDate,
        notes: form.notes || undefined,
      };
      // Locked fields are simply left out of the request — the backend treats an omitted field as
      // "not changing it", so a paid agreement's notes/start date can still be edited freely
      // without ever touching (or re-sending unchanged) its target/rate.
      if (!locked) {
        body.postsPerWeek = wantsPosts ? Number(form.postsPerWeek) : null;
        body.engagementMetric = wantsEngagement ? form.engagementMetric : null;
        body.engagementTarget = wantsEngagement ? Number(form.engagementTarget) : null;
        body.weeklyAmount = Number(form.weeklyAmount);
        body.currency = form.currency || undefined;
      }
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
          <label className="label">{t("agreementStartDateLabel")}</label>
          <input required type="date" className="input" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
          <p className="mt-1 text-xs text-muted">{t("agreementStartDateHelp")}</p>
        </div>

        {locked && <p className="rounded-xl border border-line bg-surface px-3.5 py-2.5 text-xs text-muted">{t("agreementLockedHint")}</p>}

        {isEdit && (
          <div>
            <label className="label">{t("postingAgreementAttachmentLabel")}</label>
            {agreement?.attachmentUrl ? (
              <a href={agreement.attachmentUrl} target="_blank" rel="noreferrer" className="block text-sm font-medium text-brand hover:underline">
                {t("viewAttachmentCta")}
              </a>
            ) : (
              <p className="text-xs text-muted">{t("noAttachmentYet")}</p>
            )}
            <p className="mt-1 text-xs text-muted">{t("postingAgreementAttachmentHelp")}</p>
          </div>
        )}

        <div className="rounded-xl border border-line/60 p-3.5">
          <label className="flex items-center gap-2 text-sm font-medium text-ink">
            <input type="checkbox" disabled={locked} checked={wantsPosts} onChange={(e) => setWantsPosts(e.target.checked)} />
            {t("targetTypePostCount")}
          </label>
          {wantsPosts && (
            <div className="mt-2">
              <label className="label">{t("postsPerWeekLabel")}</label>
              <input required disabled={locked} type="number" min="1" className={`input ${locked ? "bg-surface text-muted" : ""}`} value={form.postsPerWeek} onChange={(e) => set("postsPerWeek", e.target.value)} />
            </div>
          )}
        </div>

        <div className="rounded-xl border border-line/60 p-3.5">
          <label className="flex items-center gap-2 text-sm font-medium text-ink">
            <input type="checkbox" disabled={locked} checked={wantsEngagement} onChange={(e) => setWantsEngagement(e.target.checked)} />
            {t("targetTypeEngagement")}
          </label>
          {wantsEngagement && (
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div>
                <label className="label">{t("agreementEngagementMetricLabel")}</label>
                <select disabled={locked} className={`input ${locked ? "bg-surface text-muted" : ""}`} value={form.engagementMetric} onChange={(e) => set("engagementMetric", e.target.value as PostingAgreementEngagementMetric)}>
                  {ENGAGEMENT_METRICS.map((m) => (
                    <option key={m} value={m}>{metricLabel[m]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">{t("engagementTargetLabel")}</label>
                <input required disabled={locked} type="number" min="1" className={`input ${locked ? "bg-surface text-muted" : ""}`} value={form.engagementTarget} onChange={(e) => set("engagementTarget", e.target.value)} />
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">{t("weeklyAmountLabel")}</label>
            <input required disabled={locked} type="number" min="0" step="0.01" className={`input ${locked ? "bg-surface text-muted" : ""}`} value={form.weeklyAmount} onChange={(e) => set("weeklyAmount", e.target.value)} />
            <p className="mt-1 text-xs text-muted">{t("flatAmountHelp")}</p>
          </div>
          <div>
            <label className="label">{t("currencyLabel")}</label>
            <input disabled={locked} className={`input ${locked ? "bg-surface text-muted" : ""}`} value={form.currency} onChange={(e) => set("currency", e.target.value)} />
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
