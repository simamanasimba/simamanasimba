"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Eye, Pencil, Plus, Receipt, Trash2, XCircle } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Modal } from "@/components/Modal";
import { useLang } from "@/lib/i18n";
import type { Influencer2Folder } from "@/lib/types";

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
 * each measured against the beneficiary's own agreement target — the same evaluate/create-ticket
 * flow PostingAgreementCard's auto-computed weeks offer, just for a folder the admin created and
 * dated by hand instead of a rigid 7-day cycle. */
export function PostingFoldersPanel({
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
  const [modalState, setModalState] = useState<"new" | Influencer2Folder | null>(null);
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

  async function createTicket(folder: Influencer2Folder) {
    if (!folder.evaluation) return;
    setBusyId(folder.id);
    setError(null);
    try {
      await api.post(`/api/v1/organizations/${organizationId}/posting-agreements/evaluations/${folder.evaluation.id}/create-ticket`, {});
      await refetch();
      queryClient.invalidateQueries({ queryKey: ["payments"] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("failedCreateTicket"));
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
                <th className="py-1.5 pr-3" />
              </tr>
            </thead>
            <tbody>
              {folders.map((f) => (
                <tr key={f.id} className="border-b border-line/60">
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
                        <span className="inline-flex items-center gap-1 text-muted"><XCircle size={14} /> {t("targetMissedLabel")}</span>
                      )
                    ) : (
                      <span className="text-xs text-muted">{t("weekPendingEvaluationLabel")}</span>
                    )}
                  </td>
                  <td className="py-1.5 pr-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={postsHref(f.id)} title={t("viewPostsCta")} className="text-muted hover:text-brand">
                        <Eye size={13} />
                      </Link>
                      {f.agreementId && !f.evaluation && canManage && (
                        <button className="btn-secondary !py-1 text-xs" disabled={busyId === f.id} onClick={() => evaluateFolder(f)}>
                          {t("evaluateThisWeekCta")}
                        </button>
                      )}
                      {f.evaluation?.paymentId ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-success"><Receipt size={13} /> {t("ticketCreatedLabel")}</span>
                      ) : f.evaluation?.targetMet && canManage ? (
                        <button className="btn-secondary !py-1 text-xs" disabled={busyId === f.id} onClick={() => createTicket(f)}>
                          {t("createTicketCta")}
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
    </div>
  );
}
