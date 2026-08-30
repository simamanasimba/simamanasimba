"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Modal } from "@/components/Modal";
import { useLang } from "@/lib/i18n";
import type { MediaEngagement } from "@/lib/types";

export function MediaEngagementModal({
  organizationId,
  beneficiaryType,
  beneficiaryId,
  initial,
  onClose,
  onDone,
}: {
  organizationId: string;
  beneficiaryType: "MEDIA_HOST" | "INFLUENCER";
  beneficiaryId: string;
  initial?: MediaEngagement;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useLang();
  const [form, setForm] = useState({
    topicPostAgenda: initial?.topicPostAgenda ?? "",
    narrativeKeyMessage: initial?.narrativeKeyMessage ?? "",
    reachAudience: initial?.reachAudience ?? "",
    memberEngagement: initial?.memberEngagement ?? "",
    mediaImpactOutcome: initial?.mediaImpactOutcome ?? "",
    regionalFeedback: initial?.regionalFeedback ?? "",
    meNotes: initial?.meNotes ?? "",
    natureOfNarrative: initial?.natureOfNarrative ?? "",
    reportingTimeline: initial?.reportingTimeline ?? "",
    link: initial?.link ?? "",
    likes: initial?.likes?.toString() ?? "",
    comments: initial?.comments?.toString() ?? "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const base =
    beneficiaryType === "MEDIA_HOST"
      ? `/api/v1/organizations/${organizationId}/media-hosts/${beneficiaryId}/engagements`
      : `/api/v1/organizations/${organizationId}/influencers/${beneficiaryId}/engagements`;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        ...form,
        likes: form.likes ? Number(form.likes) : undefined,
        comments: form.comments ? Number(form.comments) : undefined,
      };
      if (initial) await api.patch(`${base}/${initial.id}`, payload);
      else await api.post(base, payload);
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={initial ? t("editCampaignTitle") : t("createCampaignTitle")} onClose={onClose} wide>
      <form onSubmit={onSubmit} className="max-h-[75vh] space-y-3 overflow-y-auto pr-1">
        {initial && (
          <div className="rounded-xl bg-surface p-3">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{t("payoutDetailsTitle")}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div><span className="block text-xs text-muted">{t("rateTzsLabel")}</span><span className="nums text-sm font-medium text-ink">{initial.rateTzs != null ? initial.rateTzs.toLocaleString() : "—"}</span></div>
              <div><span className="block text-xs text-muted">{t("totalTzsLabel")}</span><span className="nums text-sm font-medium text-ink">{initial.totalTzs != null ? initial.totalTzs.toLocaleString() : "—"}</span></div>
              <div><span className="block text-xs text-muted">{t("engagementDatesLabel")}</span><span className="text-sm font-medium text-ink">{initial.engagementDates ?? "—"}</span></div>
              <div><span className="block text-xs text-muted">{t("paymentStatusLabel")}</span><span className="text-sm font-medium text-ink">{initial.status === "PAID" ? t("statusPaid") : t("statusNotPaid")}</span></div>
            </div>
          </div>
        )}
        <div><label className="label">{t("topicPostAgendaLabel")}</label><input required className="input" value={form.topicPostAgenda} onChange={(e) => set("topicPostAgenda", e.target.value)} /></div>
        <div>
          <label className="label">{t("narrativeKeyMessageLabel")}</label>
          <textarea required className="input min-h-[60px]" value={form.narrativeKeyMessage} onChange={(e) => set("narrativeKeyMessage", e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">{t("reachAudienceLabel")}</label><input required className="input" value={form.reachAudience} onChange={(e) => set("reachAudience", e.target.value)} /></div>
          <div><label className="label">{t("memberEngagementLabel")}</label><input required className="input" value={form.memberEngagement} onChange={(e) => set("memberEngagement", e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">{t("likesLabel")}</label><input type="number" min="0" className="input" value={form.likes} onChange={(e) => set("likes", e.target.value)} /></div>
          <div><label className="label">{t("commentsLabel")}</label><input type="number" min="0" className="input" value={form.comments} onChange={(e) => set("comments", e.target.value)} /></div>
        </div>
        <div>
          <label className="label">{t("mediaImpactOutcomeLabel")}</label>
          <textarea required className="input min-h-[60px]" value={form.mediaImpactOutcome} onChange={(e) => set("mediaImpactOutcome", e.target.value)} />
        </div>
        <div>
          <label className="label">{t("regionalFeedbackLabel")}</label>
          <textarea required className="input min-h-[60px]" value={form.regionalFeedback} onChange={(e) => set("regionalFeedback", e.target.value)} />
        </div>
        <div>
          <label className="label">{t("meNotesLabel")}</label>
          <textarea required className="input min-h-[60px]" value={form.meNotes} onChange={(e) => set("meNotes", e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">{t("natureOfNarrativeLabel")}</label><input required className="input" value={form.natureOfNarrative} onChange={(e) => set("natureOfNarrative", e.target.value)} /></div>
          <div><label className="label">{t("reportingTimelineLabel")}</label><input required className="input" value={form.reportingTimeline} onChange={(e) => set("reportingTimeline", e.target.value)} /></div>
        </div>
        <div><label className="label">{t("linkLabel")}</label><input required className="input" value={form.link} onChange={(e) => set("link", e.target.value)} /></div>

        {error && <p className="text-sm text-brand">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <button type="button" onClick={onClose} className="btn-secondary">{t("cancel")}</button>
          <button type="submit" disabled={submitting} className="btn-primary">{submitting ? t("creatingLabel") : t("save")}</button>
        </div>
      </form>
    </Modal>
  );
}
