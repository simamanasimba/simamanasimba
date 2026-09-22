"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import type { PostingAgreement, PostingAgreementWeek } from "@/lib/types";

/** Tags several selected posts with one agreement week at once — sits above a campaigns table
 * whenever at least one row is checked. Reuses the same agreement/weeks lookup the post form's
 * own "counts toward week" selector uses, scoped to this one host/influencer. */
export function BulkWeekAssignBar({
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
  const [weekNumber, setWeekNumber] = useState<number | "">("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const beneficiaryQuery = mediaHostId ? `mediaHostId=${mediaHostId}` : `influencerId=${influencerId}`;

  const { data: agreements } = useQuery({
    queryKey: ["posting-agreements", organizationId, mediaHostId, influencerId],
    queryFn: () => api.get<PostingAgreement[]>(`/api/v1/organizations/${organizationId}/posting-agreements?${beneficiaryQuery}`),
  });
  const agreement = agreements?.[0];

  const { data: weeks } = useQuery({
    queryKey: ["posting-agreement-weeks", organizationId, agreement?.id],
    queryFn: () => api.get<PostingAgreementWeek[]>(`/api/v1/organizations/${organizationId}/posting-agreements/${agreement!.id}/weeks`),
    enabled: Boolean(agreement),
  });

  if (selectedIds.length === 0) return null;

  async function assign() {
    if (weekNumber === "") return;
    setSubmitting(true);
    setError(null);
    try {
      await api.patch(`/api/v1/organizations/${organizationId}/influencer2/campaigns/bulk-week`, { campaignIds: selectedIds, weekNumber });
      onClearSelection();
      setWeekNumber("");
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
      {agreement ? (
        <>
          <select className="input !w-auto" value={weekNumber} onChange={(e) => setWeekNumber(e.target.value ? Number(e.target.value) : "")}>
            <option value="">{t("postAgreementWeekLabel")}</option>
            {weeks?.map((w) => (
              <option key={w.weekNumber} value={w.weekNumber}>
                {t("weekLabel")} {w.weekNumber} ({w.weekStart.slice(0, 10)} – {w.weekEnd.slice(0, 10)})
              </option>
            ))}
          </select>
          <button className="btn-primary !py-1.5 text-xs" disabled={weekNumber === "" || submitting} onClick={assign}>
            {t("bulkAssignWeekCta")}
          </button>
        </>
      ) : (
        <span className="text-xs text-muted">{t("bulkAssignWeekNoAgreement")}</span>
      )}
      <button className="text-xs font-medium text-muted hover:text-ink" onClick={onClearSelection}>{t("clearSelectionCta")}</button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
