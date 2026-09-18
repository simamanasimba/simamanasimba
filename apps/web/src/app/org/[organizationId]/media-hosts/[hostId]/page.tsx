"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Pencil, Plus, Receipt, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { MediaHostProfile, Influencer2CampaignSummary, PaginatedInfluencer2Campaigns } from "@/lib/types";
import { MediaHostModal } from "@/components/MediaHostModal";
import { LoadingWord } from "@/components/LoadingWord";
import { Collapsible } from "@/components/Collapsible";
import { RecentActivityList } from "@/components/RecentActivityList";
import { Influencer2CampaignModal } from "@/components/Influencer2CampaignModal";
import { PostingAgreementCard } from "@/components/PostingAgreementCard";
import { DateRangeFilterControl, formatRangeLabel, useDateRangeFilter } from "@/components/DateRangeFilter";
import { useAuth } from "@/hooks/useAuth";
import { canManageInfluencer2, canRecordPayment } from "@/lib/permissions";
import { useLang } from "@/lib/i18n";

/** Same Influencer 2 campaign system as the Influencer pages, scoped to this
 * media host via mediaHostId instead of influencerId. */
export default function MediaHostDetailPage() {
  const { organizationId, hostId } = useParams<{ organizationId: string; hostId: string }>();
  const { t } = useLang();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [addingCampaign, setAddingCampaign] = useState(false);
  const { data: me } = useAuth();
  const myRole = me?.organizations.find((o) => o.organizationId === organizationId)?.role;
  const canManage = canManageInfluencer2(myRole);
  const canManagePayments = canRecordPayment(myRole);
  const dateRangeFilter = useDateRangeFilter("weekly");
  const { range } = dateRangeFilter;

  const { data, refetch } = useQuery({
    queryKey: ["media-host-profile", hostId],
    queryFn: () => api.get<MediaHostProfile>(`/api/v1/organizations/${organizationId}/media-hosts/${hostId}`),
  });

  const { data: summary, refetch: refetchSummary } = useQuery({
    queryKey: ["influencer2-summary", "media-host", hostId, range.from, range.to],
    queryFn: () => api.get<Influencer2CampaignSummary>(`/api/v1/organizations/${organizationId}/influencer2/campaigns/summary?mediaHostId=${hostId}&from=${range.from}&to=${range.to}`),
  });

  const { data: recentCampaigns, refetch: refetchCampaigns } = useQuery({
    queryKey: ["influencer2-campaigns", organizationId, "media-host", hostId, "recent", range.from, range.to],
    queryFn: () => api.get<PaginatedInfluencer2Campaigns>(`/api/v1/organizations/${organizationId}/influencer2/campaigns?mediaHostId=${hostId}&pageSize=8&from=${range.from}&to=${range.to}`),
  });

  function refreshAll() {
    refetch();
    refetchSummary();
    refetchCampaigns();
  }

  async function onDelete() {
    if (!data || !confirm(`${t("deleteCta")} "${data.host.name}"?`)) return;
    try {
      await api.delete(`/api/v1/organizations/${organizationId}/media-hosts/${hostId}`);
      router.push(`/org/${organizationId}/media-hosts`);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed");
    }
  }

  if (!data) return <LoadingWord />;
  const { host, payments } = data;

  return (
    <div className="space-y-6">
      <Link href={`/org/${organizationId}/media-hosts`} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-brand">
        <ArrowLeft size={15} /> {t("backToListCta")}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-ink">{host.name}</h1>
          <p className="text-sm text-muted">{host.type}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/org/${organizationId}/media-hosts/${hostId}/payments`} className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-brand">
            <Receipt size={14} /> {t("paymentHistoryCta")}
          </Link>
          {canManage && (
            <button className="btn-primary text-sm" onClick={() => setAddingCampaign(true)}><Plus size={14} /> {t("createInfluencer2CampaignCta")}</button>
          )}
          <button className="btn-secondary text-sm" onClick={() => setEditing(true)}><Pencil size={14} /> {t("edit")}</button>
          <button title={t("deleteCta")} className="btn-secondary !p-2" onClick={onDelete}><Trash2 size={14} /></button>
        </div>
      </div>

      <PostingAgreementCard organizationId={organizationId} mediaHostId={hostId} canManage={canManagePayments} />

      <DateRangeFilterControl {...dateRangeFilter} organizationId={organizationId} />

      <p className="text-xs text-muted">{t("statsScopedToRangeLabel")} <span className="font-medium text-ink">{formatRangeLabel(range, t("dateRangeAllTime"))}</span></p>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Link href={`/org/${organizationId}/media-hosts/${hostId}/campaigns`} className="card block h-full transition hover:-translate-y-0.5 hover:shadow-lg">
          <p className="text-xs text-muted">{t("totalPostsLabel")}</p>
          <p className="nums text-lg font-bold text-brand-700">{summary?.totalPosts ?? "—"}</p>
        </Link>
        <div className="card">
          <p className="text-xs text-muted">{t("influencer2TotalViewsLabel")}</p>
          <p className="nums text-lg font-bold text-ink">{summary?.totalViews != null ? summary.totalViews.toLocaleString() : "—"}</p>
        </div>
        <div className="card">
          <p className="text-xs text-muted">{t("influencer2TotalLikesLabel")}</p>
          <p className="nums text-lg font-bold text-ink">{summary?.totalLikes != null ? summary.totalLikes.toLocaleString() : "—"}</p>
        </div>
        <div className="card">
          <p className="text-xs text-muted">{t("avgEngagementPerPostLabel")}</p>
          <p className="nums text-lg font-bold text-ink">{summary?.engagementPerPost != null ? summary.engagementPerPost.toLocaleString() : "—"}</p>
        </div>
        <Link href={`/org/${organizationId}/media-hosts/${hostId}/payments`} className="card block h-full transition hover:-translate-y-0.5 hover:shadow-lg">
          <p className="text-xs text-muted">{t("totalPaidLabel")}</p>
          <p className="nums text-lg font-bold text-success">{data.totalPaid.toLocaleString()}</p>
        </Link>
      </div>

      <RecentActivityList
        organizationId={organizationId}
        campaignItems={recentCampaigns?.items ?? []}
        orphanPayments={payments.filter((p) => !p.influencer2CampaignId)}
        viewAllCampaignsHref={`/org/${organizationId}/media-hosts/${hostId}/campaigns`}
        viewAllPaymentsHref={`/org/${organizationId}/media-hosts/${hostId}/payments`}
      />

      <div className="card">
        <Collapsible title={t("bankingInfoTitle")} bare>
          <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
            <div className="flex justify-between border-b border-line/60 py-1.5 text-sm"><span className="text-muted">{t("bankNameLabel")}</span><span className="font-medium text-ink">{host.bankName ?? "—"}</span></div>
            <div className="flex justify-between border-b border-line/60 py-1.5 text-sm"><span className="text-muted">{t("bankAccountNameLabel")}</span><span className="font-medium text-ink">{host.bankAccountName ?? "—"}</span></div>
            <div className="flex justify-between border-b border-line/60 py-1.5 text-sm"><span className="text-muted">{t("bankAccountNumberLabel")}</span><span className="nums font-medium text-ink">{host.bankAccountNumber ?? "—"}</span></div>
            <div className="flex justify-between border-b border-line/60 py-1.5 text-sm"><span className="text-muted">{t("mobileMoneyProviderLabel")}</span><span className="font-medium text-ink">{host.mobileMoneyProvider ?? "—"}</span></div>
            <div className="flex justify-between border-b border-line/60 py-1.5 text-sm"><span className="text-muted">{t("mobileMoneyNumberLabel")}</span><span className="nums font-medium text-ink">{host.mobileMoneyNumber ?? "—"}</span></div>
          </div>
        </Collapsible>
      </div>

      {editing && (
        <MediaHostModal
          organizationId={organizationId}
          mediaHost={host}
          onClose={() => setEditing(false)}
          onDone={() => { setEditing(false); refetch(); }}
        />
      )}

      {addingCampaign && (
        <Influencer2CampaignModal
          organizationId={organizationId}
          fixedMediaHostId={hostId}
          onClose={() => setAddingCampaign(false)}
          onDone={() => { setAddingCampaign(false); refreshAll(); }}
        />
      )}
    </div>
  );
}
