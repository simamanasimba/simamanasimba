"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { CampaignReportModal } from "@/components/CampaignReportModal";
import { formatRangeLabel } from "@/components/DateRangeFilter";
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
  const [showReport, setShowReport] = useState(false);
  const { data: summary } = useQuery({
    queryKey: ["influencer2-summary", "collective", scope, organizationId, range.from, range.to],
    queryFn: () => api.get<Influencer2CampaignSummary>(`/api/v1/organizations/${organizationId}/influencer2/campaigns/summary?scope=${scope}&from=${range.from}&to=${range.to}`),
  });

  // Deliberately its own label, distinct from "Active media" on the Media Engagement Overview
  // just below — this counts distinct HOSTS with a campaign, not distinct media HOUSES with a
  // registered host. Those are two different numbers and were easy to confuse when this reused
  // the generic "Total media" label.
  const beneficiaryLabel = scope === "ALL_MEDIA_HOSTS" ? t("mediaHostsWithCampaignsLabel") : t("totalInfluencersLabel");

  const tile = (label: string, value: string | number, accent = false) => (
    <button
      type="button"
      onClick={() => setShowReport(true)}
      className="card text-left transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <p className="text-xs text-muted">{label}</p>
      <p className={`nums text-lg font-bold ${accent ? "text-brand-700" : "text-ink"}`}>{value}</p>
    </button>
  );

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted">{t("statsScopedToRangeLabel")} <span className="font-medium text-ink">{formatRangeLabel(range, t("dateRangeAllTime"))}</span></p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {tile(beneficiaryLabel, summary?.totalBeneficiaries ?? "—", true)}
        {tile(t("totalPostsLabel"), summary?.totalPosts ?? "—")}
        {tile(t("influencer2TotalViewsLabel"), summary?.totalViews != null ? summary.totalViews.toLocaleString() : "—")}
        {tile(t("influencer2TotalLikesLabel"), summary?.totalLikes != null ? summary.totalLikes.toLocaleString() : "—")}
        {tile(t("influencer2TotalEngagementLabel"), summary?.totalEngagement != null ? summary.totalEngagement.toLocaleString() : "—", true)}
        {tile(t("avgEngagementPerPostLabel"), summary?.engagementPerPost != null ? summary.engagementPerPost.toLocaleString() : "—")}
      </div>

      {showReport && (
        <CampaignReportModal organizationId={organizationId} scope={scope} range={range} onClose={() => setShowReport(false)} />
      )}
    </div>
  );
}
