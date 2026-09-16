"use client";

import { useQuery } from "@tanstack/react-query";
import { Modal } from "@/components/Modal";
import { api } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import type { PaginatedInfluencer2Campaigns } from "@/lib/types";

/** "Which posts actually counted toward this week's evaluation" — the same Influencer2Campaign
 * list the host's/influencer's own Campaigns tab reads, just scoped to one agreement week. */
export function WeekPostsModal({
  organizationId,
  mediaHostId,
  influencerId,
  weekNumber,
  weekStart,
  weekEnd,
  onClose,
}: {
  organizationId: string;
  mediaHostId?: string;
  influencerId?: string;
  weekNumber: number;
  weekStart: string;
  weekEnd: string;
  onClose: () => void;
}) {
  const { t } = useLang();
  const beneficiaryQuery = mediaHostId ? `mediaHostId=${mediaHostId}` : `influencerId=${influencerId}`;
  const { data, isLoading } = useQuery({
    queryKey: ["posting-agreement-week-posts", organizationId, mediaHostId, influencerId, weekNumber, weekStart, weekEnd],
    queryFn: () =>
      api.get<PaginatedInfluencer2Campaigns>(
        `/api/v1/organizations/${organizationId}/influencer2/campaigns?${beneficiaryQuery}&weekNumber=${weekNumber}&from=${weekStart}&to=${weekEnd}&pageSize=100`,
      ),
  });

  return (
    <Modal title={`${t("weekPostsTitle")} ${weekNumber}`} onClose={onClose}>
      {isLoading ? (
        <p className="text-sm text-muted">{t("loadingLabel")}</p>
      ) : (data?.items.length ?? 0) === 0 ? (
        <p className="text-sm text-muted">{t("noPostsThisWeek")}</p>
      ) : (
        <ul className="divide-y divide-line">
          {(data?.items ?? []).map(({ campaign, platformKeys, totals }) => (
            <li key={campaign.id} className="py-2.5 text-sm">
              <p className="font-medium text-ink">{campaign.name}</p>
              <p className="text-xs text-muted">
                {platformKeys.join(", ") || "—"} · {t("influencer2TotalEngagementLabel")}: {totals.totalEngagement.toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
