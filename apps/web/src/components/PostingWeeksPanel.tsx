"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Receipt, XCircle } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { MarkAgreementPaidModal } from "@/components/MarkAgreementPaidModal";
import { useLang } from "@/lib/i18n";
import type { PostingAgreement, PostingWeekDefinition } from "@/lib/types";

/** The beneficiary-facing side of org-wide Campaign Weeks (see CampaignWeeksCard, managed once
 * from Settings): this beneficiary's own actual posts/engagement/payment status against each
 * centrally-defined week, replacing the old per-beneficiary Influencer2Folder ("Campaigns") panel
 * for anything going forward — that older panel and its data are untouched, just no longer shown
 * here. A row's whole line is clickable through to that week's own posts, same as the old panel. */
export function PostingWeeksPanel({
  organizationId,
  mediaHostId,
  influencerId,
  canPay,
}: {
  organizationId: string;
  mediaHostId?: string;
  influencerId?: string;
  /** Mark a met-target week as paid — Finance only. */
  canPay: boolean;
}) {
  const { t } = useLang();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [payingWeek, setPayingWeek] = useState<PostingWeekDefinition | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const beneficiaryQuery = mediaHostId ? `mediaHostId=${mediaHostId}` : `influencerId=${influencerId}`;
  const postsHref = (weekDefinitionId: string) =>
    mediaHostId
      ? `/org/${organizationId}/media-hosts/${mediaHostId}/campaigns?weekDefinitionId=${weekDefinitionId}`
      : `/org/${organizationId}/influencers/${influencerId}/campaigns?weekDefinitionId=${weekDefinitionId}`;

  const { data: weeks, refetch } = useQuery({
    queryKey: ["posting-week-definition-rows", organizationId, mediaHostId, influencerId],
    queryFn: () => api.get<PostingWeekDefinition[]>(`/api/v1/organizations/${organizationId}/posting-agreements/week-definitions?${beneficiaryQuery}`),
  });
  // Most recent week first — same convention as the older auto-computed weekly cycle.
  const sortedWeeks = useMemo(() => [...(weeks ?? [])].sort((a, b) => b.startDate.localeCompare(a.startDate)), [weeks]);

  const { data: agreements } = useQuery({
    queryKey: ["posting-agreements", organizationId, mediaHostId, influencerId],
    queryFn: () => api.get<PostingAgreement[]>(`/api/v1/organizations/${organizationId}/posting-agreements?${beneficiaryQuery}`),
  });
  const agreement = agreements?.[0];

  /** Same live "meets target right now" detection PostingFoldersPanel offers, for the same reason
   * — never wait on a manual Evaluate click to say so. */
  function liveTargetMet(week: PostingWeekDefinition): boolean | null {
    if (!agreement || !week.assessment) return null;
    const postOk = agreement.postsPerWeek != null ? week.assessment.totalPosts >= agreement.postsPerWeek : null;
    const engagementValue =
      agreement.engagementMetric === "VIEWS" ? week.assessment.totalViews
      : agreement.engagementMetric === "LIKES" ? week.assessment.totalLikes
      : agreement.engagementMetric === "COMMENTS" ? week.assessment.totalComments
      : agreement.engagementMetric === "SHARES" ? week.assessment.totalShares
      : agreement.engagementMetric === "TOTAL_ENGAGEMENT" ? week.assessment.totalEngagement
      : null;
    const engagementOk = agreement.engagementMetric && agreement.engagementTarget != null ? (engagementValue ?? 0) >= agreement.engagementTarget : null;
    const checks = [postOk, engagementOk].filter((v): v is boolean => v != null);
    return checks.length > 0 && checks.every(Boolean);
  }

  function postsRemaining(week: PostingWeekDefinition): number | null {
    if (!agreement?.postsPerWeek) return null;
    const have = week.assessment?.totalPosts ?? 0;
    const remaining = agreement.postsPerWeek - have;
    return remaining > 0 ? remaining : null;
  }

  async function evaluateWeek(week: PostingWeekDefinition) {
    if (!week.agreementId) return;
    setBusyId(week.id);
    setError(null);
    try {
      await api.post(`/api/v1/organizations/${organizationId}/posting-agreements/${week.agreementId}/week-definitions/${week.id}/evaluate`, {});
      await refetch();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("failedEvaluateWeek"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="card space-y-4">
      <div>
        <h3 className="font-semibold text-ink">{t("foldersPanelTitle")}</h3>
        <p className="text-sm text-muted">{t("campaignWeeksPanelSubtitle")}</p>
      </div>

      {error && <p className="text-sm text-brand">{error}</p>}

      {(!weeks || weeks.length === 0) ? (
        <p className="text-sm text-muted">{t("noCampaignWeeksYet")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="py-1.5 pr-3">{t("folderNameLabel")}</th>
                <th className="py-1.5 pr-3">{t("folderDateRangeColLabel")}</th>
                <th className="py-1.5 pr-3">{t("actualPostsLabel")}</th>
                <th className="py-1.5 pr-3">{t("metricTotalEngagement")}</th>
                <th className="py-1.5 pr-3">{t("targetMetLabel")}</th>
                <th className="py-1.5 pr-3">{t("amountLabel")}</th>
                <th className="py-1.5 pr-3" />
              </tr>
            </thead>
            <tbody>
              {sortedWeeks.map((w) => (
                <tr
                  key={w.id}
                  className="cursor-pointer border-b border-line/60 hover:bg-brand-50/40"
                  onClick={() => router.push(postsHref(w.id))}
                >
                  <td className="py-1.5 pr-3 font-medium text-ink">{w.name}</td>
                  <td className="py-1.5 pr-3 text-xs text-muted">{w.startDate.slice(0, 10)} – {w.endDate.slice(0, 10)}</td>
                  <td className="py-1.5 pr-3 nums">{w.assessment?.totalPosts ?? 0}</td>
                  <td className="py-1.5 pr-3 nums">{(w.assessment?.totalEngagement ?? 0).toLocaleString()}</td>
                  <td className="py-1.5 pr-3">
                    {!w.agreementId ? (
                      <span className="text-xs text-muted">{t("noPostingAgreementYet")}</span>
                    ) : w.evaluation ? (
                      w.evaluation.targetMet ? (
                        <span className="inline-flex items-center gap-1 text-success"><CheckCircle2 size={14} /> {t("targetMetLabel")}</span>
                      ) : (
                        <div>
                          <span className="inline-flex items-center gap-1 text-muted"><XCircle size={14} /> {t("targetMissedLabel")}</span>
                          {postsRemaining(w) != null && <p className="mt-0.5 text-xs text-muted">{postsRemaining(w)} {t("postsNeededSuffix")}</p>}
                        </div>
                      )
                    ) : liveTargetMet(w) === true ? (
                      <span className="inline-flex items-center gap-1 text-success" title={t("liveTargetMetHint")}>
                        <CheckCircle2 size={14} /> {t("targetMetLabel")}
                      </span>
                    ) : (
                      <div>
                        <span className="text-xs text-muted">{t("weekPendingEvaluationLabel")}</span>
                        {postsRemaining(w) != null && <p className="mt-0.5 text-xs text-muted">{postsRemaining(w)} {t("postsNeededSuffix")}</p>}
                      </div>
                    )}
                  </td>
                  <td className="py-1.5 pr-3 nums">
                    {(w.evaluation ? w.evaluation.targetMet : liveTargetMet(w) === true) && agreement
                      ? `${agreement.currency} ${agreement.weeklyAmount.toLocaleString()}`
                      : "—"}
                  </td>
                  <td className="py-1.5 pr-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      {w.agreementId && !w.evaluation && w.endDate.slice(0, 10) <= new Date().toISOString().slice(0, 10) && (
                        <button className="btn-secondary !py-1 text-xs" disabled={busyId === w.id} onClick={() => evaluateWeek(w)}>
                          {t("evaluateThisWeekCta")}
                        </button>
                      )}
                      {w.evaluation?.payment?.status === "PAID" ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-success"><Receipt size={13} /> {t("paymentStatusPaid")}</span>
                      ) : w.evaluation?.paymentId ? (
                        <span className="text-xs text-muted">{w.evaluation.payment?.status ?? t("weekPendingEvaluationLabel")}</span>
                      ) : w.evaluation?.targetMet && canPay ? (
                        <button className="btn-secondary !py-1 text-xs" onClick={() => setPayingWeek(w)}>
                          {t("markAsPaidTitle")}
                        </button>
                      ) : w.evaluation?.targetMet ? (
                        <span className="text-xs text-muted">{t("awaitingFinanceLabel")}</span>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {payingWeek?.evaluation && agreement && (
        <MarkAgreementPaidModal
          organizationId={organizationId}
          evaluationId={payingWeek.evaluation.id}
          agreedAmount={agreement.weeklyAmount}
          currency={agreement.currency}
          onClose={() => setPayingWeek(null)}
          onDone={() => {
            setPayingWeek(null);
            refetch();
            queryClient.invalidateQueries({ queryKey: ["payments"] });
            queryClient.invalidateQueries({ queryKey: ["finance-dashboard"] });
          }}
        />
      )}
    </div>
  );
}
