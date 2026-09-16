"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Pencil, Receipt, XCircle } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { PostingAgreementModal } from "@/components/PostingAgreementModal";
import type { PostingAgreement, PostingAgreementEngagementMetric, PostingAgreementEvaluation } from "@/lib/types";

function mostRecentMonday(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = (day + 6) % 7; // days since Monday
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diff));
  return monday.toISOString().slice(0, 10);
}

export function PostingAgreementCard({
  organizationId,
  mediaHostId,
  influencerId,
  canManage,
}: {
  organizationId: string;
  mediaHostId?: string;
  influencerId?: string;
  canManage: boolean;
}) {
  const { t } = useLang();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [weekStart, setWeekStart] = useState(mostRecentMonday());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const beneficiaryQuery = mediaHostId ? `mediaHostId=${mediaHostId}` : `influencerId=${influencerId}`;

  const { data: agreements, refetch: refetchAgreements } = useQuery({
    queryKey: ["posting-agreements", organizationId, mediaHostId, influencerId],
    queryFn: () => api.get<PostingAgreement[]>(`/api/v1/organizations/${organizationId}/posting-agreements?${beneficiaryQuery}`),
  });
  const agreement = agreements?.[0];

  const { data: evaluations, refetch: refetchEvaluations } = useQuery({
    queryKey: ["posting-agreement-evaluations", organizationId, agreement?.id],
    queryFn: () => api.get<PostingAgreementEvaluation[]>(`/api/v1/organizations/${organizationId}/posting-agreements/${agreement!.id}/evaluations`),
    enabled: Boolean(agreement),
  });

  const metricLabel: Record<PostingAgreementEngagementMetric, string> = {
    VIEWS: t("metricViews"),
    LIKES: t("metricLikes"),
    COMMENTS: t("metricComments"),
    SHARES: t("metricShares"),
    TOTAL_ENGAGEMENT: t("metricTotalEngagement"),
  };

  async function evaluateWeek() {
    if (!agreement) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/v1/organizations/${organizationId}/posting-agreements/${agreement.id}/evaluate`, { weekStart });
      await refetchEvaluations();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("failedEvaluateWeek"));
    } finally {
      setBusy(false);
    }
  }

  async function createTicket(evaluationId: string) {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/v1/organizations/${organizationId}/posting-agreements/evaluations/${evaluationId}/create-ticket`, {});
      await refetchEvaluations();
      queryClient.invalidateQueries({ queryKey: ["payments"] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("failedCreateTicket"));
    } finally {
      setBusy(false);
    }
  }

  const targetLabel = agreement
    ? agreement.targetType === "POST_COUNT"
      ? `${agreement.postsPerWeek} ${t("postsPerWeekLabel").toLowerCase()}`
      : `${agreement.engagementTarget?.toLocaleString()} ${metricLabel[agreement.engagementMetric!]}/wk`
    : null;

  return (
    <div className="card space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-ink">{t("postingAgreementTitle")}</h3>
          <p className="text-sm text-muted">{t("postingAgreementSubtitle")}</p>
        </div>
        {canManage && (
          <button className="btn-secondary text-sm" onClick={() => setShowModal(true)}>
            {agreement ? <><Pencil size={14} /> {t("editAgreementCta")}</> : t("setUpAgreementCta")}
          </button>
        )}
      </div>

      {!agreement && <p className="text-sm text-muted">{t("noPostingAgreementYet")}</p>}

      {agreement && (
        <>
          <div className="flex flex-wrap items-center gap-4 rounded-lg border border-line/60 bg-surface px-4 py-3 text-sm">
            <span className="font-medium text-ink">{targetLabel}</span>
            <span className="nums font-bold text-brand-700">{agreement.weeklyAmount.toLocaleString()} {agreement.currency}/wk</span>
            <span className={`inline-flex items-center gap-1 text-xs font-medium ${agreement.isActive ? "text-success" : "text-muted"}`}>
              {agreement.isActive ? t("agreementActiveLabel") : t("agreementInactiveLabel")}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-medium text-muted">{t("weekOfLabel")}</label>
            <input type="date" className="input !w-auto !py-1.5 text-sm" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} />
            <button className="btn-primary text-sm" disabled={busy} onClick={evaluateWeek}>{t("evaluateThisWeekCta")}</button>
          </div>
          {error && <p className="text-sm text-brand">{error}</p>}

          <div>
            <h4 className="mb-2 text-sm font-semibold text-ink">{t("weeklyEvaluationsTitle")}</h4>
            {(!evaluations || evaluations.length === 0) ? (
              <p className="text-sm text-muted">{t("noEvaluationsYet")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs text-muted">
                      <th className="py-1.5 pr-3">{t("weekOfLabel")}</th>
                      <th className="py-1.5 pr-3">{agreement.targetType === "POST_COUNT" ? t("actualPostsLabel") : t("actualEngagementLabel")}</th>
                      <th className="py-1.5 pr-3">{t("targetMetLabel")}</th>
                      <th className="py-1.5 pr-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {evaluations.map((ev) => (
                      <tr key={ev.id} className="border-b border-line/60">
                        <td className="py-1.5 pr-3 nums">{ev.weekStart.slice(0, 10)}</td>
                        <td className="py-1.5 pr-3 nums">
                          {agreement.targetType === "POST_COUNT" ? ev.actualPostCount : (ev.actualEngagement?.toLocaleString() ?? "—")}
                        </td>
                        <td className="py-1.5 pr-3">
                          {ev.targetMet ? (
                            <span className="inline-flex items-center gap-1 text-success"><CheckCircle2 size={14} /> {t("targetMetLabel")}</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-muted"><XCircle size={14} /> {t("targetMissedLabel")}</span>
                          )}
                        </td>
                        <td className="py-1.5 pr-3 text-right">
                          {ev.paymentId ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-success"><Receipt size={13} /> {t("ticketCreatedLabel")}</span>
                          ) : ev.targetMet && canManage ? (
                            <button className="btn-secondary !py-1 text-xs" disabled={busy} onClick={() => createTicket(ev.id)}>{t("createTicketCta")}</button>
                          ) : null}
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
    </div>
  );
}
