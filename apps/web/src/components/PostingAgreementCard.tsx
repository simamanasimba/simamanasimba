"use client";

import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Eye, Paperclip, Pencil, Printer, Receipt, Trash2, XCircle } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { PostingAgreementModal } from "@/components/PostingAgreementModal";
import { WeekPostsModal } from "@/components/WeekPostsModal";
import { printAgreement } from "@/lib/printAgreement";
import type { PostingAgreement, PostingAgreementEngagementMetric, PostingAgreementWeek } from "@/lib/types";

/** A small ✓/✗/— pill for one of the two possible per-week checks — "—" when that check isn't
 * part of this agreement at all (postTargetMet/engagementTargetMet are null in that case). */
function CheckPill({ met, label }: { met: boolean | null; label: string }) {
  if (met == null) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${met ? "text-success" : "text-muted"}`}>
      {met ? <CheckCircle2 size={13} /> : <XCircle size={13} />} {label}
    </span>
  );
}

export function PostingAgreementCard({
  organizationId,
  mediaHostId,
  influencerId,
  beneficiaryName,
  canManage,
}: {
  organizationId: string;
  mediaHostId?: string;
  influencerId?: string;
  /** Only needed to label the printed document — falls back to a generic word if omitted. */
  beneficiaryName?: string;
  canManage: boolean;
}) {
  const { t } = useLang();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [viewingWeek, setViewingWeek] = useState<PostingAgreementWeek | null>(null);
  const [busyWeek, setBusyWeek] = useState<number | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  const beneficiaryQuery = mediaHostId ? `mediaHostId=${mediaHostId}` : `influencerId=${influencerId}`;

  const { data: agreements, refetch: refetchAgreements } = useQuery({
    queryKey: ["posting-agreements", organizationId, mediaHostId, influencerId],
    queryFn: () => api.get<PostingAgreement[]>(`/api/v1/organizations/${organizationId}/posting-agreements?${beneficiaryQuery}`),
  });
  const agreement = agreements?.[0];

  const { data: weeks, refetch: refetchWeeks } = useQuery({
    queryKey: ["posting-agreement-weeks", organizationId, agreement?.id],
    queryFn: () => api.get<PostingAgreementWeek[]>(`/api/v1/organizations/${organizationId}/posting-agreements/${agreement!.id}/weeks`),
    enabled: Boolean(agreement),
  });

  const metricLabel: Record<PostingAgreementEngagementMetric, string> = {
    VIEWS: t("metricViews"),
    LIKES: t("metricLikes"),
    COMMENTS: t("metricComments"),
    SHARES: t("metricShares"),
    TOTAL_ENGAGEMENT: t("metricTotalEngagement"),
  };

  async function evaluateWeek(weekNumber: number) {
    if (!agreement) return;
    setBusyWeek(weekNumber);
    setError(null);
    try {
      await api.post(`/api/v1/organizations/${organizationId}/posting-agreements/${agreement.id}/weeks/${weekNumber}/evaluate`, {});
      await refetchWeeks();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("failedEvaluateWeek"));
    } finally {
      setBusyWeek(null);
    }
  }

  async function createTicket(evaluationId: string, weekNumber: number) {
    setBusyWeek(weekNumber);
    setError(null);
    try {
      await api.post(`/api/v1/organizations/${organizationId}/posting-agreements/evaluations/${evaluationId}/create-ticket`, {});
      await refetchWeeks();
      queryClient.invalidateQueries({ queryKey: ["payments"] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("failedCreateTicket"));
    } finally {
      setBusyWeek(null);
    }
  }

  async function uploadAttachment(file: File) {
    if (!agreement) return;
    setUploadingAttachment(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/v1/organizations/${organizationId}/posting-agreements/${agreement.id}/attachment`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? t("failedSaveAgreement"));
      }
      await refetchAgreements();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("failedSaveAgreement"));
    } finally {
      setUploadingAttachment(false);
      if (attachmentInputRef.current) attachmentInputRef.current.value = "";
    }
  }

  async function removeAgreement() {
    if (!agreement) return;
    if (!confirm(t("confirmDeleteAgreement"))) return;
    setError(null);
    try {
      await api.delete(`/api/v1/organizations/${organizationId}/posting-agreements/${agreement.id}`);
      await refetchAgreements();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("failedSaveAgreement"));
    }
  }

  function onPrint() {
    if (!agreement) return;
    printAgreement({
      agreement,
      beneficiaryName: beneficiaryName ?? t("beneficiaryLabel"),
      targetLabel,
      labels: {
        title: t("postingAgreementTitle"),
        beneficiary: t("beneficiaryLabel"),
        agreementDate: t("agreementStartDateLabel"),
        target: t("targetTypePostCount"),
        amount: t("weeklyAmountLabel"),
        status: t("paymentStatusLabel"),
        active: t("agreementActiveLabel"),
        inactive: t("agreementInactiveLabel"),
        notes: t("notesLabel"),
        referenceNote: t("agreementStartDateHelp"),
      },
    });
  }

  const targetLabel = agreement
    ? [
        agreement.postsPerWeek != null ? `${agreement.postsPerWeek} ${t("postsPerWeekLabel").toLowerCase()}` : null,
        agreement.engagementMetric && agreement.engagementTarget != null
          ? `${agreement.engagementTarget.toLocaleString()} ${metricLabel[agreement.engagementMetric]}/wk`
          : null,
      ]
        .filter(Boolean)
        .join(" + ")
    : null;

  function actualEngagementForMetric(w: PostingAgreementWeek, metric: PostingAgreementEngagementMetric): number | null {
    if (!w.evaluation) return null;
    const e = w.evaluation;
    switch (metric) {
      case "VIEWS":
        return e.actualViews;
      case "LIKES":
        return e.actualLikes;
      case "COMMENTS":
        return e.actualComments;
      case "SHARES":
        return e.actualShares;
      case "TOTAL_ENGAGEMENT":
        return e.actualEngagement;
    }
  }

  return (
    <div className="card space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-ink">{t("postingAgreementTitle")}</h3>
          <p className="text-sm text-muted">{t("postingAgreementSubtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          {agreement && (
            <>
              <button className="btn-secondary text-sm" onClick={onPrint}>
                <Printer size={14} /> {t("printAgreementCta")}
              </button>
              {canManage && (
                <>
                  <input
                    ref={attachmentInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAttachment(f); }}
                  />
                  <button className="btn-secondary text-sm" disabled={uploadingAttachment} onClick={() => attachmentInputRef.current?.click()}>
                    <Paperclip size={14} /> {agreement.attachmentUrl ? t("replaceAttachmentCta") : t("attachDocumentCta")}
                  </button>
                </>
              )}
            </>
          )}
          {canManage && (
            <button className="btn-secondary text-sm" onClick={() => setShowModal(true)}>
              {agreement ? <><Pencil size={14} /> {t("editAgreementCta")}</> : t("setUpAgreementCta")}
            </button>
          )}
          {agreement && canManage && (
            <button title={t("clearAgreementCta")} className="btn-secondary !p-2" onClick={removeAgreement}>
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {!agreement && <p className="text-sm text-muted">{t("noPostingAgreementYet")}</p>}

      {agreement && (
        <>
          <div className="flex flex-wrap items-center gap-4 rounded-lg border border-line/60 bg-surface px-4 py-3 text-sm">
            <span className="font-medium text-ink">{targetLabel}</span>
            <span className="nums font-bold text-brand-700">{agreement.weeklyAmount.toLocaleString()} {agreement.currency}</span>
            <span className="text-xs text-muted">{t("agreementStartDateLabel")}: {agreement.startDate.slice(0, 10)}</span>
            {agreement.attachmentUrl && (
              <a href={agreement.attachmentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">
                <Paperclip size={12} /> {t("viewAttachmentCta")}
              </a>
            )}
            <span className={`inline-flex items-center gap-1 text-xs font-medium ${agreement.isActive ? "text-success" : "text-muted"}`}>
              {agreement.isActive ? t("agreementActiveLabel") : t("agreementInactiveLabel")}
            </span>
          </div>
          {error && <p className="text-sm text-brand">{error}</p>}

          <div>
            <h4 className="mb-2 text-sm font-semibold text-ink">{t("weeklyEvaluationsTitle")}</h4>
            {(!weeks || weeks.length === 0) ? (
              <p className="text-sm text-muted">{t("noEvaluationsYet")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs text-muted">
                      <th className="py-1.5 pr-3">{t("weekOfLabel")}</th>
                      {agreement.postsPerWeek != null && <th className="py-1.5 pr-3">{t("actualPostsLabel")}</th>}
                      {agreement.engagementMetric && <th className="py-1.5 pr-3">{metricLabel[agreement.engagementMetric]}</th>}
                      <th className="py-1.5 pr-3">{t("targetMetLabel")}</th>
                      <th className="py-1.5 pr-3">{t("amountLabel")}</th>
                      <th className="py-1.5 pr-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {weeks.map((w) => (
                      <tr key={w.weekNumber} className="border-b border-line/60">
                        <td className="py-1.5 pr-3">
                          <span className="nums font-medium text-ink">{t("weekLabel")} {w.weekNumber}</span>
                          <span className="ml-1 text-xs text-muted">({w.weekStart.slice(0, 10)} – {w.weekEnd.slice(0, 10)})</span>
                        </td>
                        {agreement.postsPerWeek != null && (
                          <td className="py-1.5 pr-3">
                            {w.evaluation ? (
                              <div className="flex items-center gap-1.5">
                                <span className="nums">{w.evaluation.actualPostCount}</span>
                                <CheckPill met={w.evaluation.postTargetMet} label="" />
                              </div>
                            ) : "—"}
                          </td>
                        )}
                        {agreement.engagementMetric && (
                          <td className="py-1.5 pr-3">
                            {w.evaluation ? (
                              <div className="flex items-center gap-1.5">
                                <span className="nums">{(actualEngagementForMetric(w, agreement.engagementMetric)?.toLocaleString()) ?? "—"}</span>
                                <CheckPill met={w.evaluation.engagementTargetMet} label="" />
                              </div>
                            ) : "—"}
                          </td>
                        )}
                        <td className="py-1.5 pr-3">
                          {w.status === "IN_PROGRESS" ? (
                            <span className="text-xs text-muted">{t("weekInProgressLabel")}</span>
                          ) : w.evaluation ? (
                            w.evaluation.targetMet ? (
                              <span className="inline-flex items-center gap-1 text-success"><CheckCircle2 size={14} /> {t("targetMetLabel")}</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-muted"><XCircle size={14} /> {t("targetMissedLabel")}</span>
                            )
                          ) : (
                            <span className="text-xs text-muted">{t("weekPendingEvaluationLabel")}</span>
                          )}
                        </td>
                        <td className="py-1.5 pr-3 nums">
                          {w.evaluation ? `${agreement.currency} ${agreement.weeklyAmount.toLocaleString()}` : "—"}
                        </td>
                        <td className="py-1.5 pr-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {w.evaluation && (
                              <button title={t("viewPostsCta")} className="text-muted hover:text-brand" onClick={() => setViewingWeek(w)}>
                                <Eye size={14} />
                              </button>
                            )}
                            {w.status === "PENDING_EVALUATION" && canManage && (
                              <button className="btn-secondary !py-1 text-xs" disabled={busyWeek === w.weekNumber} onClick={() => evaluateWeek(w.weekNumber)}>
                                {t("evaluateThisWeekCta")}
                              </button>
                            )}
                            {w.evaluation?.paymentId ? (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-success"><Receipt size={13} /> {t("ticketCreatedLabel")}</span>
                            ) : w.evaluation?.targetMet && canManage ? (
                              <button className="btn-secondary !py-1 text-xs" disabled={busyWeek === w.weekNumber} onClick={() => createTicket(w.evaluation!.id, w.weekNumber)}>
                                {t("createTicketCta")}
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {showModal && (
        <PostingAgreementModal
          organizationId={organizationId}
          mediaHostId={mediaHostId}
          influencerId={influencerId}
          agreement={agreement}
          onClose={() => setShowModal(false)}
          onDone={() => { setShowModal(false); refetchAgreements(); }}
        />
      )}

      {viewingWeek && (
        <WeekPostsModal
          organizationId={organizationId}
          mediaHostId={mediaHostId}
          influencerId={influencerId}
          weekNumber={viewingWeek.weekNumber}
          weekStart={viewingWeek.weekStart}
          weekEnd={viewingWeek.weekEnd}
          onClose={() => setViewingWeek(null)}
        />
      )}
    </div>
  );
}
