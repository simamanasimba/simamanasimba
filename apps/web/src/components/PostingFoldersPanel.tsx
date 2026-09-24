"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Pencil, Plus, Receipt, Trash2, XCircle } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Modal } from "@/components/Modal";
import { MarkAgreementPaidModal } from "@/components/MarkAgreementPaidModal";
import { useLang } from "@/lib/i18n";
import type { Influencer2Folder, PostingAgreement } from "@/lib/types";

function FolderModal({
  organizationId,
  mediaHostId,
  influencerId,
  initial,
  onClose,
  onDone,
}: {
  organizationId: string;
  mediaHostId?: string;
  influencerId?: string;
  initial?: Influencer2Folder;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useLang();
  const [name, setName] = useState(initial?.name ?? "");
  const [startDate, setStartDate] = useState(initial?.startDate?.slice(0, 10) ?? "");
  const [endDate, setEndDate] = useState(initial?.endDate?.slice(0, 10) ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (initial) {
        await api.patch(`/api/v1/organizations/${organizationId}/influencer2/folders/${initial.id}`, {
          name,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        });
      } else {
        await api.post(`/api/v1/organizations/${organizationId}/influencer2/folders`, {
          mediaHostId,
          influencerId,
          name,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        });
      }
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("failedSaveFolder"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={initial ? t("editFolderTitle") : t("newFolderTitle")} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="label">{t("folderNameLabel")}</label>
          <input required className="input" placeholder={t("newFolderNamePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">{t("folderStartDateLabel")}</label>
            <input type="date" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="label">{t("folderEndDateLabel")}</label>
            <input type="date" className="input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>
        <p className="text-xs text-muted">{t("folderDateRangeHelp")}</p>
        {error && <p className="text-sm text-brand">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-line pt-3">
          <button type="button" onClick={onClose} className="btn-secondary">{t("cancel")}</button>
          <button type="submit" disabled={submitting} className="btn-primary">{submitting ? t("creatingLabel") : t("save")}</button>
        </div>
      </form>
    </Modal>
  );
}

/** The "campaign" side of a posting agreement: named, dated groupings of posts (e.g. "Week 1"),
 * each measured against the beneficiary's own agreement target — the same evaluate/mark-as-paid
 * flow PostingAgreementCard's auto-computed weeks offer, just for a folder the admin created and
 * dated by hand instead of a rigid 7-day cycle. */
export function PostingFoldersPanel({
  organizationId,
  mediaHostId,
  influencerId,
  canManage,
  canPay,
}: {
  organizationId: string;
  mediaHostId?: string;
  influencerId?: string;
  /** Create/edit campaigns, evaluate — admins and Finance. */
  canManage: boolean;
  /** Mark a met-target campaign as paid — Finance only. */
  canPay: boolean;
}) {
  const { t } = useLang();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [modalState, setModalState] = useState<"new" | Influencer2Folder | null>(null);
  const [payingFolder, setPayingFolder] = useState<Influencer2Folder | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const beneficiaryQuery = mediaHostId ? `mediaHostId=${mediaHostId}` : `influencerId=${influencerId}`;
  const postsHref = (folderId: string) =>
    mediaHostId
      ? `/org/${organizationId}/media-hosts/${mediaHostId}/campaigns?folderId=${folderId}`
      : `/org/${organizationId}/influencers/${influencerId}/campaigns?folderId=${folderId}`;

  const { data: folders, refetch } = useQuery({
    queryKey: ["influencer2-folders", organizationId, mediaHostId, influencerId],
    queryFn: () => api.get<Influencer2Folder[]>(`/api/v1/organizations/${organizationId}/influencer2/folders?${beneficiaryQuery}`),
  });

  // Needed to show what a met-target folder is worth — the flat agreed amount, same for every
  // folder regardless of how far actualPostCount exceeds the target.
  const { data: agreements } = useQuery({
    queryKey: ["posting-agreements", organizationId, mediaHostId, influencerId],
    queryFn: () => api.get<PostingAgreement[]>(`/api/v1/organizations/${organizationId}/posting-agreements?${beneficiaryQuery}`),
  });
  const agreement = agreements?.[0];

  /** Whether a folder's CURRENT totals already meet the agreement's target — computed live from
   * assessment data, independent of whether it has been formally evaluated yet. Detection must
   * never wait on a manual "Evaluate" click: a folder with 19 posts against a 4-post target
   * obviously meets it right now, and the table should say so immediately. Evaluate still exists
   * to lock those numbers into a permanent record, which is what a payment ticket is created from. */
  function liveTargetMet(folder: Influencer2Folder): boolean | null {
    if (!agreement || !folder.assessment) return null;
    const postOk = agreement.postsPerWeek != null ? folder.assessment.totalPosts >= agreement.postsPerWeek : null;
    // Every listed metric must clear its own target (AND, not OR) — a deal can require several at
    // once (e.g. views AND likes).
    const engagementOk =
      agreement.engagementTargets.length === 0
        ? null
        : agreement.engagementTargets.every((t) => {
            const value =
              t.metric === "VIEWS" ? folder.assessment!.totalViews
              : t.metric === "LIKES" ? folder.assessment!.totalLikes
              : t.metric === "COMMENTS" ? folder.assessment!.totalComments
              : t.metric === "SHARES" ? folder.assessment!.totalShares
              : folder.assessment!.totalEngagement;
            return (value ?? 0) >= t.target;
          });
    const checks = [postOk, engagementOk].filter((v): v is boolean => v != null);
    return checks.length > 0 && checks.every(Boolean);
  }

  /** How many more posts this folder needs to hit the agreement's post-count target — null once
   * met (or when there's no post-count target to begin with), so a missed/pending week always
   * shows exactly what's left instead of just a flat "missed" badge. */
  function postsRemaining(folder: Influencer2Folder): number | null {
    if (!agreement?.postsPerWeek) return null;
    const have = folder.assessment?.totalPosts ?? 0;
    const remaining = agreement.postsPerWeek - have;
    return remaining > 0 ? remaining : null;
  }

  async function evaluateFolder(folder: Influencer2Folder) {
    if (!folder.agreementId) return;
    setBusyId(folder.id);
    setError(null);
    try {
      await api.post(`/api/v1/organizations/${organizationId}/posting-agreements/${folder.agreementId}/folders/${folder.id}/evaluate`, {});
      await refetch();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("failedEvaluateWeek"));
    } finally {
      setBusyId(null);
    }
  }

  async function removeFolder(folder: Influencer2Folder) {
    if (!confirm(t("confirmDeleteFolder"))) return;
    setBusyId(folder.id);
    setError(null);
    try {
      await api.delete(`/api/v1/organizations/${organizationId}/influencer2/folders/${folder.id}`);
      await refetch();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("failedSaveFolder"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="card space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-ink">{t("foldersPanelTitle")}</h3>
          <p className="text-sm text-muted">{t("foldersPanelSubtitle")}</p>
        </div>
        {canManage && (
          <button className="btn-secondary text-sm" onClick={() => setModalState("new")}>
            <Plus size={14} /> {t("newFolderCta")}
          </button>
        )}
      </div>

      {error && <p className="text-sm text-brand">{error}</p>}

      {(!folders || folders.length === 0) ? (
        <p className="text-sm text-muted">{t("noFoldersYet")}</p>
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
              {folders.map((f) => (
                <tr
                  key={f.id}
                  className="cursor-pointer border-b border-line/60 hover:bg-brand-50/40"
                  onClick={() => router.push(postsHref(f.id))}
                >
                  <td className="py-1.5 pr-3 font-medium text-ink">{f.name}</td>
                  <td className="py-1.5 pr-3 text-xs text-muted">
                    {f.startDate && f.endDate ? `${f.startDate.slice(0, 10)} – ${f.endDate.slice(0, 10)}` : t("noDateRangeLabel")}
                  </td>
                  <td className="py-1.5 pr-3 nums">{f.assessment?.totalPosts ?? 0}</td>
                  <td className="py-1.5 pr-3 nums">{(f.assessment?.totalEngagement ?? 0).toLocaleString()}</td>
                  <td className="py-1.5 pr-3">
                    {!f.agreementId ? (
                      <span className="text-xs text-muted">{t("noPostingAgreementYet")}</span>
                    ) : f.evaluation ? (
                      f.evaluation.targetMet ? (
                        <span className="inline-flex items-center gap-1 text-success"><CheckCircle2 size={14} /> {t("targetMetLabel")}</span>
                      ) : (
                        <div>
                          <span className="inline-flex items-center gap-1 text-muted"><XCircle size={14} /> {t("targetMissedLabel")}</span>
                          {postsRemaining(f) != null && (
                            <p className="mt-0.5 text-xs text-muted">{postsRemaining(f)} {t("postsNeededSuffix")}</p>
                          )}
                        </div>
                      )
                    ) : liveTargetMet(f) === true ? (
                      <span className="inline-flex items-center gap-1 text-success" title={t("liveTargetMetHint")}>
                        <CheckCircle2 size={14} /> {t("targetMetLabel")}
                      </span>
                    ) : (
                      <div>
                        <span className="text-xs text-muted">{t("weekPendingEvaluationLabel")}</span>
                        {postsRemaining(f) != null && (
                          <p className="mt-0.5 text-xs text-muted">{postsRemaining(f)} {t("postsNeededSuffix")}</p>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="py-1.5 pr-3 nums">
                    {(f.evaluation ? f.evaluation.targetMet : liveTargetMet(f) === true) && agreement
                      ? `${agreement.currency} ${agreement.weeklyAmount.toLocaleString()}`
                      : "—"}
                  </td>
                  <td className="py-1.5 pr-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      {f.agreementId && !f.evaluation && canManage && (
                        <button className="btn-secondary !py-1 text-xs" disabled={busyId === f.id} onClick={() => evaluateFolder(f)}>
                          {t("evaluateThisWeekCta")}
                        </button>
                      )}
                      {f.evaluation?.payment?.status === "PAID" ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-success"><Receipt size={13} /> {t("paymentStatusPaid")}</span>
                      ) : f.evaluation?.paymentId ? (
                        // A payment record exists but isn't PAID (old data from before "Mark as
                        // paid" always paid immediately) — never re-offer paying it, that would try
                        // to create a second payment for the same campaign.
                        <span className="text-xs text-muted">{f.evaluation.payment?.status ?? t("weekPendingEvaluationLabel")}</span>
                      ) : f.evaluation?.targetMet && canPay ? (
                        <button className="btn-secondary !py-1 text-xs" onClick={() => setPayingFolder(f)}>
                          {t("markAsPaidTitle")}
                        </button>
                      ) : f.evaluation?.targetMet ? (
                        <span className="text-xs text-muted">{t("awaitingFinanceLabel")}</span>
                      ) : f.evaluation && canPay ? (
                        <button className="btn-secondary !py-1 text-xs text-warning" onClick={() => setPayingFolder(f)}>
                          {t("payConditionallyCta")}
                        </button>
                      ) : null}
                      {canManage && (
                        <>
                          <button title={t("edit")} className="text-muted hover:text-brand" onClick={() => setModalState(f)}><Pencil size={13} /></button>
                          <button title={t("deleteCta")} className="text-muted hover:text-brand" disabled={busyId === f.id} onClick={() => removeFolder(f)}><Trash2 size={13} /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalState && (
        <FolderModal
          organizationId={organizationId}
          mediaHostId={mediaHostId}
          influencerId={influencerId}
          initial={modalState === "new" ? undefined : modalState}
          onClose={() => setModalState(null)}
          onDone={() => { setModalState(null); refetch(); }}
        />
      )}

      {payingFolder?.evaluation && agreement && (
        <MarkAgreementPaidModal
          organizationId={organizationId}
          evaluationId={payingFolder.evaluation.id}
          agreedAmount={agreement.weeklyAmount}
          currency={agreement.currency}
          isConditional={!payingFolder.evaluation.targetMet}
          onClose={() => setPayingFolder(null)}
          onDone={() => {
            setPayingFolder(null);
            refetch();
            queryClient.invalidateQueries({ queryKey: ["payments"] });
            queryClient.invalidateQueries({ queryKey: ["finance-dashboard"] });
          }}
        />
      )}
    </div>
  );
}
