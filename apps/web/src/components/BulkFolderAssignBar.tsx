"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import type { Influencer2Folder } from "@/lib/types";

const NEW_FOLDER_VALUE = "__new__";

/** Files several selected posts under one campaign ("folder") at once — the campaign counterpart
 * to BulkWeekAssignBar, sitting right beside it above the same table. Also lets a new campaign be
 * created inline, same as the per-post form's own picker. */
export function BulkFolderAssignBar({
  organizationId,
  mediaHostId,
  influencerId,
  selectedIds,
  onClearSelection,
  onDone,
}: {
  organizationId: string;
  mediaHostId?: string;
  influencerId?: string;
  selectedIds: string[];
  onClearSelection: () => void;
  onDone: () => void;
}) {
  const { t } = useLang();
  const [folderId, setFolderId] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderStart, setNewFolderStart] = useState("");
  const [newFolderEnd, setNewFolderEnd] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const beneficiaryQuery = mediaHostId ? `mediaHostId=${mediaHostId}` : `influencerId=${influencerId}`;

  const { data: folders, refetch } = useQuery({
    queryKey: ["influencer2-folders", organizationId, mediaHostId, influencerId],
    queryFn: () => api.get<Influencer2Folder[]>(`/api/v1/organizations/${organizationId}/influencer2/folders?${beneficiaryQuery}`),
  });

  if (selectedIds.length === 0) return null;

  async function assign() {
    setSubmitting(true);
    setError(null);
    try {
      let targetFolderId = folderId;
      if (folderId === NEW_FOLDER_VALUE) {
        if (!newFolderName.trim()) return;
        const folder = await api.post<Influencer2Folder>(`/api/v1/organizations/${organizationId}/influencer2/folders`, {
          name: newFolderName.trim(),
          mediaHostId,
          influencerId,
          startDate: newFolderStart || undefined,
          endDate: newFolderEnd || undefined,
        });
        targetFolderId = folder.id;
      }
      if (!targetFolderId) return;
      await api.patch(`/api/v1/organizations/${organizationId}/influencer2/campaigns/bulk-folder`, { campaignIds: selectedIds, folderId: targetFolderId });
      onClearSelection();
      setFolderId("");
      setNewFolderName("");
      setNewFolderStart("");
      setNewFolderEnd("");
      refetch();
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card flex flex-wrap items-center gap-3 border border-brand-200 bg-brand-50/60 py-3 text-sm">
      <span className="font-medium text-ink">{t("bulkWeekSelectedCount").replace("{n}", String(selectedIds.length))}</span>
      <select className="input !w-auto" value={folderId} onChange={(e) => setFolderId(e.target.value)}>
        <option value="">{t("postFolderLabel")}</option>
        {(folders ?? []).map((f) => (
          <option key={f.id} value={f.id}>{f.name}</option>
        ))}
        <option value={NEW_FOLDER_VALUE}>{t("createNewFolderCta")}</option>
      </select>
      {folderId === NEW_FOLDER_VALUE && (
        <>
          <input className="input !w-auto" placeholder={t("newFolderNamePlaceholder")} value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} />
          <input type="date" className="input !w-auto" title={t("folderStartDateLabel")} value={newFolderStart} onChange={(e) => setNewFolderStart(e.target.value)} />
          <input type="date" className="input !w-auto" title={t("folderEndDateLabel")} value={newFolderEnd} onChange={(e) => setNewFolderEnd(e.target.value)} />
        </>
      )}
      <button className="btn-primary !py-1.5 text-xs" disabled={!folderId || submitting} onClick={assign}>
        {t("bulkAssignFolderCta")}
      </button>
      <button className="text-xs font-medium text-muted hover:text-ink" onClick={onClearSelection}>{t("clearSelectionCta")}</button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
