"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { useLang } from "@/lib/i18n";
import type { PostingWeekDefinition } from "@/lib/types";

function WeekDefinitionModal({
  organizationId,
  initial,
  onClose,
  onDone,
}: {
  organizationId: string;
  initial?: PostingWeekDefinition;
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
        await api.patch(`/api/v1/organizations/${organizationId}/posting-week-definitions/${initial.id}`, { name, startDate, endDate });
      } else {
        await api.post(`/api/v1/organizations/${organizationId}/posting-week-definitions`, { name, startDate, endDate });
      }
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("failedSaveWeekDefinition"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={initial ? t("editCampaignWeekTitle") : t("newCampaignWeekTitle")} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="label">{t("folderNameLabel")}</label>
          <input required className="input" placeholder={t("weekNamePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">{t("folderStartDateLabel")}</label>
            <input required type="date" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="label">{t("folderEndDateLabel")}</label>
            <input required type="date" className="input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>
        {error && <p className="text-sm text-brand">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-line pt-3">
          <button type="button" onClick={onClose} className="btn-secondary">{t("cancel")}</button>
          <button type="submit" disabled={submitting} className="btn-primary">{submitting ? t("creatingLabel") : t("save")}</button>
        </div>
      </form>
    </Modal>
  );
}

/** Org-wide "Campaign Weeks" — set once here ("Week 1": Aug 18–28), automatically applied to every
 * media host's and influencer's own weekly Campaigns table, replacing each of them getting a
 * manually-dated Influencer2Folder created for the same week over and over. See the Prisma schema
 * doc comment on PostingWeekDefinition. */
export function CampaignWeeksCard({ organizationId }: { organizationId: string }) {
  const { t } = useLang();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [modalState, setModalState] = useState<"new" | PostingWeekDefinition | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: weeks, refetch } = useQuery({
    queryKey: ["posting-week-definitions", organizationId],
    queryFn: () => api.get<PostingWeekDefinition[]>(`/api/v1/organizations/${organizationId}/posting-week-definitions`),
  });

  function refreshEverywhere() {
    refetch();
    queryClient.invalidateQueries({ queryKey: ["posting-week-definition-rows"] });
  }

  async function removeWeek(week: PostingWeekDefinition) {
    if (!confirm(t("confirmDeleteCampaignWeek"))) return;
    setBusyId(week.id);
    try {
      await api.delete(`/api/v1/organizations/${organizationId}/posting-week-definitions/${week.id}`);
      refreshEverywhere();
    } catch (err) {
      showToast("error", err instanceof ApiError ? err.message : t("failedSaveWeekDefinition"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="card space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{t("campaignWeeksTitle")}</h2>
          <p className="mt-1 max-w-md text-xs text-muted">{t("campaignWeeksHelp")}</p>
        </div>
        <button className="btn-secondary text-sm" onClick={() => setModalState("new")}>
          <Plus size={14} /> {t("newCampaignWeekCta")}
        </button>
      </div>

      {(!weeks || weeks.length === 0) ? (
        <p className="text-sm text-muted">{t("noCampaignWeeksYet")}</p>
      ) : (
        <ul className="divide-y divide-line">
          {weeks.map((w) => (
            <li key={w.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <div>
                <p className="font-medium text-ink">{w.name}</p>
                <p className="text-xs text-muted">{w.startDate.slice(0, 10)} – {w.endDate.slice(0, 10)}</p>
              </div>
              <div className="flex items-center gap-2">
                <button title={t("edit")} className="text-muted hover:text-brand" onClick={() => setModalState(w)}><Pencil size={13} /></button>
                <button title={t("deleteCta")} className="text-muted hover:text-brand" disabled={busyId === w.id} onClick={() => removeWeek(w)}><Trash2 size={13} /></button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {modalState && (
        <WeekDefinitionModal
          organizationId={organizationId}
          initial={modalState === "new" ? undefined : modalState}
          onClose={() => setModalState(null)}
          onDone={() => { setModalState(null); refreshEverywhere(); }}
        />
      )}
    </div>
  );
}
