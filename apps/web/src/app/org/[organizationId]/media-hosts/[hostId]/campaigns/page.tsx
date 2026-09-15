"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";
import type { Influencer2CampaignStatus, Influencer2CampaignSummary, Influencer2ContentType, MediaHostProfile, PaginatedInfluencer2Campaigns } from "@/lib/types";
import { Influencer2CampaignModal } from "@/components/Influencer2CampaignModal";
import { LoadingWord } from "@/components/LoadingWord";
import { RequireAccess } from "@/components/RequireAccess";
import { DateRangeFilterControl, useDateRangeFilter } from "@/components/DateRangeFilter";
import { useAuth } from "@/hooks/useAuth";
import { canManageInfluencer2 } from "@/lib/permissions";
import { PAYMENT_PROGRESS_LABEL_KEYS, PAYMENT_PROGRESS_BADGE } from "@/lib/paymentProgress";
import { useLang } from "@/lib/i18n";

const PAGE_SIZE = 25;
const CONTENT_TYPES: Influencer2ContentType[] = ["VIDEO", "IMAGE", "REEL", "STORY", "ARTICLE", "PODCAST", "AUDIO", "OTHER"];
const STATUSES: Influencer2CampaignStatus[] = ["DRAFT", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"];

/** All of one media host's Influencer 2 campaigns — reached from the "Total
 * campaigns" card on their profile page. Mirrors the influencer version. */
export default function MediaHostCampaignsPage() {
  const { organizationId, hostId } = useParams<{ organizationId: string; hostId: string }>();
  const { t } = useLang();
  const { data: me } = useAuth();
  const myRole = me?.organizations.find((o) => o.organizationId === organizationId)?.role;
  const canManage = canManageInfluencer2(myRole);
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [contentType, setContentType] = useState<Influencer2ContentType | "">("");
  const [status, setStatus] = useState<Influencer2CampaignStatus | "">("");
  const [showAddCampaign, setShowAddCampaign] = useState(false);
  const dateRangeFilter = useDateRangeFilter("weekly");
  const { range } = dateRangeFilter;

  const { data: profile } = useQuery({
    queryKey: ["media-host-profile", hostId],
    queryFn: () => api.get<MediaHostProfile>(`/api/v1/organizations/${organizationId}/media-hosts/${hostId}`),
  });

  const { data: summary } = useQuery({
    queryKey: ["influencer2-summary", "media-host", hostId, range.from, range.to],
    queryFn: () => api.get<Influencer2CampaignSummary>(`/api/v1/organizations/${organizationId}/influencer2/campaigns/summary?mediaHostId=${hostId}&from=${range.from}&to=${range.to}`),
  });

  const params = new URLSearchParams({ mediaHostId: hostId, page: String(page), pageSize: String(PAGE_SIZE), from: range.from, to: range.to });
  if (contentType) params.set("contentType", contentType);
  if (status) params.set("status", status);

  const { data } = useQuery({
    queryKey: ["influencer2-campaigns", organizationId, "media-host", hostId, contentType, status, page, range.from, range.to],
    queryFn: () => api.get<PaginatedInfluencer2Campaigns>(`/api/v1/organizations/${organizationId}/influencer2/campaigns?${params.toString()}`),
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["influencer2-campaigns", organizationId, "media-host", hostId] });
    queryClient.invalidateQueries({ queryKey: ["influencer2-summary", "media-host", hostId] });
    queryClient.invalidateQueries({ queryKey: ["media-host-profile", hostId] });
  }

  return (
    <RequireAccess area="influencer2">
      <div className="space-y-6">
        <Link href={`/org/${organizationId}/media-hosts/${hostId}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-brand">
          <ArrowLeft size={15} /> {t("backToListCta")}
        </Link>

        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-2xl font-extrabold text-ink">{profile?.host.name ?? "—"} — {t("allCampaignsTitle")}</h1>
          {canManage && (
            <button className="btn-primary text-sm" onClick={() => setShowAddCampaign(true)}><Plus size={15} /> {t("createInfluencer2CampaignCta")}</button>
          )}
        </div>

        <DateRangeFilterControl {...dateRangeFilter} organizationId={organizationId} />

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="card"><p className="text-xs text-muted">{t("totalPostsLabel")}</p><p className="nums text-lg font-bold text-brand-700">{summary?.totalPosts ?? "—"}</p></div>
          <div className="card"><p className="text-xs text-muted">{t("influencer2TotalViewsLabel")}</p><p className="nums text-lg font-bold text-ink">{summary?.totalViews != null ? summary.totalViews.toLocaleString() : "—"}</p></div>
          <div className="card"><p className="text-xs text-muted">{t("influencer2TotalLikesLabel")}</p><p className="nums text-lg font-bold text-ink">{summary?.totalLikes != null ? summary.totalLikes.toLocaleString() : "—"}</p></div>
          <div className="card"><p className="text-xs text-muted">{t("avgEngagementPerPostLabel")}</p><p className="nums text-lg font-bold text-ink">{summary?.engagementPerPost != null ? summary.engagementPerPost.toLocaleString() : "—"}</p></div>
        </div>

        <h2 className="font-display text-base font-bold text-ink">{t("influencer2IndividualCampaignsTitle")}</h2>

        <div className="card grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label">{t("influencer2FilterContentType")}</label>
            <select className="input" value={contentType} onChange={(e) => { setContentType(e.target.value as Influencer2ContentType | ""); setPage(1); }}>
              <option value="">{t("allLabel")}</option>
              {CONTENT_TYPES.map((ct) => <option key={ct} value={ct}>{ct}</option>)}
            </select>
          </div>
          <div>
            <label className="label">{t("influencer2FilterStatus")}</label>
            <select className="input" value={status} onChange={(e) => { setStatus(e.target.value as Influencer2CampaignStatus | ""); setPage(1); }}>
              <option value="">{t("allLabel")}</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {!data ? (
          <LoadingWord />
        ) : data.items.length === 0 ? (
          <p className="card text-muted">{t("noInfluencer2Campaigns")}</p>
        ) : (
          <div className="card overflow-hidden p-0">
            <div className="max-h-[560px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-surface text-left text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-2.5">{t("influencer2CampaignColLabel")}</th>
                    <th className="px-4 py-2.5">{t("influencer2ContentTypeColLabel")}</th>
                    <th className="px-4 py-2.5">{t("influencer2PlatformsColLabel")}</th>
                    <th className="px-4 py-2.5 text-right">{t("influencer2ViewsColLabel")}</th>
                    <th className="px-4 py-2.5 text-right">{t("influencer2EngagementColLabel")}</th>
                    <th className="px-4 py-2.5">{t("statusColLabel")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.items.map(({ campaign, platformKeys, totals }) => (
                    <tr key={campaign.id} className="hover:bg-brand-50/40">
                      <td className="px-4 py-2.5">
                        <Link href={`/org/${organizationId}/influencer2/${campaign.id}`} className="font-medium text-brand hover:underline">{campaign.name}</Link>
                      </td>
                      <td className="px-4 py-2.5 text-muted">{campaign.contentType}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {platformKeys.map((k) => <span key={k} className="badge bg-surface text-muted">{k}</span>)}
                        </div>
                      </td>
                      <td className="nums px-4 py-2.5 text-right text-muted">{totals.totalViews != null ? totals.totalViews.toLocaleString() : "—"}</td>
                      <td className="nums px-4 py-2.5 text-right font-semibold text-ink">{totals.totalEngagement.toLocaleString()}</td>
                      <td className="px-4 py-2.5">
                        <span className={`badge ${PAYMENT_PROGRESS_BADGE[campaign.paymentProgress ?? "UNPAID"]}`}>
                          {t(PAYMENT_PROGRESS_LABEL_KEYS[campaign.paymentProgress ?? "UNPAID"])}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {data.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-line px-4 py-3 text-sm">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="btn-secondary !px-2.5 !py-1.5 text-xs disabled:opacity-40">
                  <ChevronLeft size={14} /> {t("previousCta")}
                </button>
                <span className="text-muted">{t("pageLabel")} {data.page} {t("ofLabel")} {data.totalPages}</span>
                <button onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))} disabled={page >= data.totalPages} className="btn-secondary !px-2.5 !py-1.5 text-xs disabled:opacity-40">
                  {t("nextCta")} <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        )}

        {showAddCampaign && (
          <Influencer2CampaignModal
            organizationId={organizationId}
            fixedMediaHostId={hostId}
            onClose={() => setShowAddCampaign(false)}
            onDone={() => { setShowAddCampaign(false); refresh(); }}
          />
        )}
      </div>
    </RequireAccess>
  );
}
