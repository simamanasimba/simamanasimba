"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { Modal } from "@/components/Modal";
import { useLang } from "@/lib/i18n";
import type { MediaEngagement, ReachMilestone } from "@/lib/types";

/** A lightweight alternative to the full MediaEngagementModal for the one thing staff actually do
 * repeatedly over a campaign's life: bump the likes/comments count as a post keeps gaining
 * engagement. Also shows the reach-over-time milestones (1 week/1 month/3 months/1 year after the
 * campaign was created) reconstructed from the snapshot log the backend records on every update. */
export function QuickUpdateReachModal({
  organizationId,
  beneficiaryType,
  beneficiaryId,
  engagement,
  onClose,
  onDone,
}: {
  organizationId: string;
  beneficiaryType: "MEDIA_HOST" | "INFLUENCER";
  beneficiaryId: string;
  engagement: MediaEngagement;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useLang();
  const [likes, setLikes] = useState(engagement.likes?.toString() ?? "");
  const [comments, setComments] = useState(engagement.comments?.toString() ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const base =
    beneficiaryType === "MEDIA_HOST"
      ? `/api/v1/organizations/${organizationId}/media-hosts/${beneficiaryId}/engagements`
      : `/api/v1/organizations/${organizationId}/influencers/${beneficiaryId}/engagements`;

  const { data: milestones } = useQuery({
    queryKey: ["reach-milestones", engagement.id],
    queryFn: () => api.get<ReachMilestone[]>(`${base}/${engagement.id}/reach-milestones`),
  });

  const ageDays = Math.max(0, Math.floor((Date.now() - new Date(engagement.createdAt).getTime()) / 86_400_000));
  const milestoneLabel: Record<ReachMilestone["key"], string> = {
    week1: t("milestoneWeek1Label"),
    month1: t("milestoneMonth1Label"),
    month3: t("milestoneMonth3Label"),
    year1: t("milestoneYear1Label"),
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.patch(`${base}/${engagement.id}`, {
        likes: likes === "" ? null : Number(likes),
        comments: comments === "" ? null : Number(comments),
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("failedUpdateReach"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={t("updateReachTitle")} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <p className="max-w-[320px] truncate text-sm font-medium text-ink">{engagement.topicPostAgenda ?? "—"}</p>
          <p className="text-xs text-muted">{t("campaignAgeLabel")}: {ageDays} {t("daysUnitLabel")}</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t("likesLabel")}</label>
              <input autoFocus type="number" min="0" className="input" value={likes} onChange={(e) => setLikes(e.target.value)} />
            </div>
            <div>
              <label className="label">{t("commentsLabel")}</label>
              <input type="number" min="0" className="input" value={comments} onChange={(e) => setComments(e.target.value)} />
            </div>
          </div>
          {error && <p className="text-sm text-brand">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-secondary">{t("cancel")}</button>
            <button type="submit" disabled={submitting} className="btn-primary">{submitting ? t("saving") : t("save")}</button>
          </div>
        </form>

        <div className="border-t border-line pt-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{t("reachMilestonesTitle")}</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(milestones ?? []).map((m) => (
              <div key={m.key} className="rounded-lg border border-line px-2.5 py-2 text-center">
                <p className="text-[11px] text-muted">{milestoneLabel[m.key]}</p>
                {!m.reached ? (
                  <p className="text-[11px] text-muted">{t("milestonePendingLabel")}</p>
                ) : m.value != null ? (
                  <p className="nums text-sm font-bold text-ink">{m.value.toLocaleString()}</p>
                ) : (
                  <p className="text-[11px] text-muted">{t("milestoneNoDataLabel")}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
