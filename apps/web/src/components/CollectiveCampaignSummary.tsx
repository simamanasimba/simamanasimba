"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import type { Influencer2CampaignSummary } from "@/lib/types";

/** Org-wide collective stats across EVERY media host's or EVERY influencer's
 * Influencer 2 campaigns — the "Media Engagement"/"Influencers" dashboard
 * views. Reuses the same summary endpoint the individual profile pages use,
 * just scoped to "all" instead of one person. */
export function CollectiveCampaignSummary({
  organizationId,
  scope,
  range,
}: {
  organizationId: string;
  scope: "ALL_MEDIA_HOSTS" | "ALL_INFLUENCERS";
  range: { from: string; to: string };
}) {
  const { t } = useLang();
  const { data: summary } = useQuery({
    queryKey: ["influencer2-summary", "collective", scope, organizationId, range.from, range.to],
    queryFn: () => api.get<Influencer2CampaignSummary>(`/api/v1/organizations/${organizationId}/influencer2/campaigns/summary?scope=${scope}&from=${range.from}&to=${range.to}`),
  });

  // Deliberately its own label, distinct from "Active media" on the Media Engagement Overview
  // just below — this counts distinct HOSTS with a campaign, not distinct media HOUSES with a
  // registered host. Those are two different numbers and were easy to confuse when this reused
  // the generic "Total media" label.
  const beneficiaryLabel = scope === "ALL_MEDIA_HOSTS" ? t("mediaHostsWithCampaignsLabel") : t("totalInfluencersLabel");

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      <div className="card"><p className="text-xs text-muted">{beneficiaryLabel}</p><p className="nums text-lg font-bold text-brand-700">{summary?.totalBeneficiaries ?? "—"}</p></div>
      <div className="card"><p className="text-xs text-muted">{t("totalCampaignsLabel")}</p><p className="nums text-lg font-bold text-ink">{summary?.totalCampaigns ?? "—"}</p></div>
      <div className="card"><p className="text-xs text-muted">{t("influencer2TotalViewsLabel")}</p><p className="nums text-lg font-bold text-ink">{summary?.totalViews != null ? summary.totalViews.toLocaleString() : "—"}</p></div>
      <div className="card"><p className="text-xs text-muted">{t("influencer2TotalLikesLabel")}</p><p className="nums text-lg font-bold text-ink">{summary?.totalLikes != null ? summary.totalLikes.toLocaleString() : "—"}</p></div>
      <div className="card"><p className="text-xs text-muted">{t("influencer2TotalEngagementLabel")}</p><p className="nums text-lg font-bold text-brand-700">{summary?.totalEngagement != null ? summary.totalEngagement.toLocaleString() : "—"}</p></div>
      <div className="card"><p className="text-xs text-muted">{t("engagementPerPostLabel")}</p><p className="nums text-lg font-bold text-ink">{summary?.engagementPerPost != null ? summary.engagementPerPost.toLocaleString() : "—"}</p></div>
    </div>
  );
}
