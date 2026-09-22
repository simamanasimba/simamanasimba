"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Pencil, Plus, Receipt, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { InfluencerProfile, Influencer2CampaignSummary, PaginatedInfluencer2Campaigns } from "@/lib/types";
import { InfluencerModal } from "@/components/InfluencerModal";
import { LoadingWord } from "@/components/LoadingWord";
import { Collapsible } from "@/components/Collapsible";
import { RecentActivityList } from "@/components/RecentActivityList";
import { Influencer2CampaignModal } from "@/components/Influencer2CampaignModal";
import { PostingAgreementCard } from "@/components/PostingAgreementCard";
import { PostingFoldersPanel } from "@/components/PostingFoldersPanel";
import { PostingPaymentSummary } from "@/components/PostingPaymentSummary";
import { DateRangeFilterControl, formatRangeLabel, useDateRangeFilter } from "@/components/DateRangeFilter";
import { useAuth } from "@/hooks/useAuth";
import { canManageInfluencer2, canRecordPayment, canManagePostingAgreement, canPayPostingAgreement } from "@/lib/permissions";
import { useLang } from "@/lib/i18n";

/** Campaigns here are Influencer 2's model (one campaign = one piece of
 * content across multiple platforms) — this replaced the original
 * MediaEngagement-based campaign flow for influencers per explicit request,
 * so there is now one unified campaign system on this page, not two. */
export default function InfluencerDetailPage() {
  const { organizationId, influencerId } = useParams<{ organizationId: string; influencerId: string }>();
  const { t } = useLang();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [addingCampaign, setAddingCampaign] = useState(false);
  const { data: me } = useAuth();
  const myRole = me?.organizations.find((o) => o.organizationId === organizationId)?.role;
  const canManage = canManageInfluencer2(myRole);
  const canManagePayments = canRecordPayment(myRole);
  const canManageAgreement = canManagePostingAgreement(myRole);
  const canPayAgreement = canPayPostingAgreement(myRole);
  const dateRangeFilter = useDateRangeFilter("weekly");
  const { range } = dateRangeFilter;

  const { data, refetch } = useQuery({
    queryKey: ["influencer-profile", influencerId],
    queryFn: () => api.get<InfluencerProfile>(`/api/v1/organizations/${organizationId}/influencers/${influencerId}`),
  });

  const { data: summary, refetch: refetchSummary } = useQuery({
    queryKey: ["influencer2-summary", influencerId, range.from, range.to],
    queryFn: () => api.get<Influencer2CampaignSummary>(`/api/v1/organizations/${organizationId}/influencer2/campaigns/summary?influencerId=${influencerId}&from=${range.from}&to=${range.to}`),
  });

  const { data: recentCampaigns, refetch: refetchCampaigns } = useQuery({
    queryKey: ["influencer2-campaigns", organizationId, influencerId, "recent", range.from, range.to],
    queryFn: () => api.get<PaginatedInfluencer2Campaigns>(`/api/v1/organizations/${organizationId}/influencer2/campaigns?influencerId=${influencerId}&pageSize=8&from=${range.from}&to=${range.to}`),
  });

  function refreshAll() {
    refetch();
    refetchSummary();
    refetchCampaigns();
  }

  async function onDelete() {
    if (!data || !confirm(`${t("deleteCta")} "${data.influencer.name}"?`)) return;
    try {
      await api.delete(`/api/v1/organizations/${organizationId}/influencers/${influencerId}`);
      router.push(`/org/${organizationId}/influencers`);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed");
    }
  }

  if (!data) return <LoadingWord />;
  const { influencer, payments } = data;

  return (
    <div className="space-y-6">
      <Link href={`/org/${organizationId}/influencers`} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-brand">
        <ArrowLeft size={15} /> {t("backToListCta")}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-ink">{influencer.name}</h1>
          <p className="text-sm text-muted">{influencer.type}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/org/${organizationId}/influencers/${influencerId}/payments`} className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-brand">
            <Receipt size={14} /> {t("paymentHistoryCta")}
          </Link>
          {canManage && (
            <button className="btn-primary text-sm" onClick={() => setAddingCampaign(true)}><Plus size={14} /> {t("createInfluencer2CampaignCta")}</button>
          )}
          <button className="btn-secondary text-sm" onClick={() => setEditing(true)}><Pencil size={14} /> {t("edit")}</button>
          <button title={t("deleteCta")} className="btn-secondary !p-2" onClick={onDelete}><Trash2 size={14} /></button>
        </div>
      </div>

      <DateRangeFilterControl {...dateRangeFilter} organizationId={organizationId} />

      <p className="text-xs text-muted">{t("statsScopedToRangeLabel")} <span className="font-medium text-ink">{formatRangeLabel(range, t("dateRangeAllTime"))}</span></p>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Link href={`/org/${organizationId}/influencers/${influencerId}/campaigns`} className="card block h-full transition hover:-translate-y-0.5 hover:shadow-lg">
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
        <Link href={`/org/${organizationId}/influencers/${influencerId}/payments`} className="card block h-full transition hover:-translate-y-0.5 hover:shadow-lg">
          <p className="text-xs text-muted">{t("totalPaidLabel")}</p>
          <p className="nums text-lg font-bold text-success">{data.totalPaid.toLocaleString()}</p>
        </Link>
      </div>

      <RecentActivityList
        organizationId={organizationId}
        campaignItems={recentCampaigns?.items ?? []}
        orphanPayments={payments.filter((p) => !p.influencer2CampaignId)}
        viewAllCampaignsHref={`/org/${organizationId}/influencers/${influencerId}/campaigns`}
        viewAllPaymentsHref={`/org/${organizationId}/influencers/${influencerId}/payments`}
      />

      <PostingPaymentSummary organizationId={organizationId} influencerId={influencerId} compact={!canPayAgreement} />

      <PostingAgreementCard organizationId={organizationId} influencerId={influencerId} beneficiaryName={influencer.name} canManage={canManageAgreement} canPay={canPayAgreement} />

      <PostingFoldersPanel organizationId={organizationId} influencerId={influencerId} canManage={canManageAgreement} canPay={canPayAgreement} />

      <div className="card">
        <Collapsible title={t("bankingInfoTitle")} bare>
          <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
            <div className="flex justify-between border-b border-line/60 py-1.5 text-sm"><span className="text-muted">{t("bankNameLabel")}</span><span className="font-medium text-ink">{influencer.bankName ?? "—"}</span></div>
            <div className="flex justify-between border-b border-line/60 py-1.5 text-sm"><span className="text-muted">{t("bankAccountNameLabel")}</span><span className="font-medium text-ink">{influencer.bankAccountName ?? "—"}</span></div>
            <div className="flex justify-between border-b border-line/60 py-1.5 text-sm"><span className="text-muted">{t("bankAccountNumberLabel")}</span><span className="nums font-medium text-ink">{influencer.bankAccountNumber ?? "—"}</span></div>
            <div className="flex justify-between border-b border-line/60 py-1.5 text-sm"><span className="text-muted">{t("mobileMoneyProviderLabel")}</span><span className="font-medium text-ink">{influencer.mobileMoneyProvider ?? "—"}</span></div>
            <div className="flex justify-between border-b border-line/60 py-1.5 text-sm"><span className="text-muted">{t("mobileMoneyNumberLabel")}</span><span className="nums font-medium text-ink">{influencer.mobileMoneyNumber ?? "—"}</span></div>
          </div>
        </Collapsible>
      </div>

      {editing && (
        <InfluencerModal
          organizationId={organizationId}
          influencer={influencer}
          onClose={() => setEditing(false)}
          onDone={() => { setEditing(false); refetch(); }}
        />
      )}

      {addingCampaign && (
        <Influencer2CampaignModal
          organizationId={organizationId}
          fixedInfluencerId={influencerId}
          onClose={() => setAddingCampaign(false)}
          onDone={() => { setAddingCampaign(false); refreshAll(); }}
        />
      )}
    </div>
  );
}
