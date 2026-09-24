"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Pencil, Plus, Trash2, CircleCheck } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { Influencer2CampaignDetail, Influencer2PlatformSummary } from "@/lib/types";
import { LoadingWord } from "@/components/LoadingWord";
import { RequireAccess } from "@/components/RequireAccess";
import { Influencer2CampaignModal } from "@/components/Influencer2CampaignModal";
import { Influencer2PlatformModal } from "@/components/Influencer2PlatformModal";
import { Influencer2PlatformBreakdownTable } from "@/components/Influencer2PlatformBreakdownTable";
import { Influencer2EngagementByPlatformChart, Influencer2GrowthChart } from "@/components/Influencer2Charts";
import { ApprovePaymentModal } from "@/components/ApprovePaymentModal";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/hooks/useAuth";
import { useRolePermissions } from "@/hooks/useRolePermissions";
import { canManageInfluencer2, canApprovePayment } from "@/lib/permissions";
import { PAYMENT_PROGRESS_LABEL_KEYS, PAYMENT_PROGRESS_BADGE } from "@/lib/paymentProgress";
import { useLang } from "@/lib/i18n";
import { timeAgo } from "@/lib/timeAgo";

export default function Influencer2DetailPage() {
  const { organizationId, campaignId } = useParams<{ organizationId: string; campaignId: string }>();
  const router = useRouter();
  const { t, lang } = useLang();
  const { showToast } = useToast();
  const { data: me } = useAuth();
  const { data: perms } = useRolePermissions(organizationId);
  const myRole = me?.organizations.find((o) => o.organizationId === organizationId)?.role;
  const canManage = canManageInfluencer2(myRole);
  const canApprove = canApprovePayment(myRole, perms?.matrix);
  const queryClient = useQueryClient();

  const [editingCampaign, setEditingCampaign] = useState(false);
  const [addingPlatform, setAddingPlatform] = useState(false);
  const [editingPlatform, setEditingPlatform] = useState<Influencer2PlatformSummary | null>(null);
  const [approvingPayment, setApprovingPayment] = useState(false);

  const { data, refetch } = useQuery({
    queryKey: ["influencer2-campaign", campaignId],
    queryFn: () => api.get<Influencer2CampaignDetail>(`/api/v1/organizations/${organizationId}/influencer2/campaigns/${campaignId}`),
  });

  function refresh() {
    refetch();
    queryClient.invalidateQueries({ queryKey: ["influencer2-campaigns", organizationId] });
  }

  async function onRemovePlatform(platform: Influencer2PlatformSummary) {
    if (!confirm(platform.platformName)) return;
    await api.delete(`/api/v1/organizations/${organizationId}/influencer2/campaigns/${campaignId}/platforms/${platform.campaignPlatformId}`);
    refresh();
  }

  /** Where "back"/delete should return to — the influencer or media host this post belongs to
   * (never the standalone /influencer2 list, which has no nav entry and isn't where anyone
   * actually came from; see backHref below for the same logic used before data has loaded). */
  function beneficiaryHref(d: Influencer2CampaignDetail) {
    if (d.influencer) return `/org/${organizationId}/influencers/${d.influencer.id}/campaigns`;
    if (d.mediaHost) return `/org/${organizationId}/media-hosts/${d.mediaHost.id}/campaigns`;
    return `/org/${organizationId}/influencer2`;
  }

  async function onDeleteCampaign() {
    if (!data || !confirm(data.campaign.name)) return;
    try {
      await api.delete(`/api/v1/organizations/${organizationId}/influencer2/campaigns/${campaignId}`);
      router.push(beneficiaryHref(data));
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed");
    }
  }

  if (!data) return <LoadingWord />;
  const { campaign, influencer, mediaHost, platforms, totals } = data;
  const canApproveThisCampaign = canApprove && (campaign.paymentProgress ?? "UNPAID") === "UNPAID" && Boolean(influencer || mediaHost);

  return (
    <RequireAccess area="influencer2">
      <div className="space-y-6">
        <Link href={beneficiaryHref(data)} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-brand">
          <ArrowLeft size={15} /> {t("backToListCta")}
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-extrabold text-ink">{campaign.name}</h1>
            <p className="text-sm text-muted">
              {campaign.contentType}
              {campaign.description ? ` · ${campaign.description}` : ""}
            </p>
            <p className="mt-0.5 text-xs text-muted" title={new Date(campaign.updatedAt).toLocaleString()}>{t("lastEditedLabel")}: {timeAgo(campaign.updatedAt, lang)}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {influencer && (
                <Link href={`/org/${organizationId}/influencers/${influencer.id}`} className="badge bg-brand-50 text-brand-700 hover:underline">{influencer.name}</Link>
              )}
              {mediaHost && (
                <Link href={`/org/${organizationId}/media-hosts/${mediaHost.id}`} className="badge bg-brand-50 text-brand-700 hover:underline">{mediaHost.name}</Link>
              )}
              {platforms.map((p) => <span key={p.campaignPlatformId} className="badge bg-surface text-muted">{p.platformName}</span>)}
              <span className={`badge ${PAYMENT_PROGRESS_BADGE[campaign.paymentProgress ?? "UNPAID"]}`}>
                {t(PAYMENT_PROGRESS_LABEL_KEYS[campaign.paymentProgress ?? "UNPAID"])}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canApproveThisCampaign && (
              <button className="btn-primary text-sm" onClick={() => setApprovingPayment(true)}>
                <CircleCheck size={14} /> {t("approvePaymentCta")}
              </button>
            )}
            {canManage && (
              <>
                <button title={t("edit")} className="btn-secondary !p-2" onClick={() => setEditingCampaign(true)}><Pencil size={14} /></button>
                <button title={t("deleteCta")} className="btn-secondary !p-2" onClick={onDeleteCampaign}><Trash2 size={14} /></button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <div className="card"><p className="text-xs text-muted">{t("influencer2PlatformsLabel")}</p><p className="nums text-xl font-bold text-ink">{totals.platformCount}</p></div>
          <div className="card"><p className="text-xs text-muted">{t("influencer2TotalViewsLabel")}</p><p className="nums text-xl font-bold text-ink">{totals.totalViews != null ? totals.totalViews.toLocaleString() : "—"}</p></div>
          <div className="card"><p className="text-xs text-muted">{t("influencer2TotalEngagementLabel")}</p><p className="nums text-xl font-bold text-brand-700">{totals.totalEngagement.toLocaleString()}</p></div>
          <div className="card"><p className="text-xs text-muted">{t("influencer2TotalCommentsLabel")}</p><p className="nums text-xl font-bold text-ink">{totals.totalComments != null ? totals.totalComments.toLocaleString() : "—"}</p></div>
          <div className="card"><p className="text-xs text-muted">{t("influencer2TotalSharesLabel")}</p><p className="nums text-xl font-bold text-ink">{totals.totalShares != null ? totals.totalShares.toLocaleString() : "—"}</p></div>
          <div className="card">
            <p className="text-xs text-muted">{t("influencer2OverallSentimentLabel")}</p>
            {totals.sentiment ? (
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-semibold">
                <span className="inline-flex items-center gap-1 text-success"><span className="h-2 w-2 rounded-full bg-success" />{totals.sentiment.positive}%</span>
                <span className="inline-flex items-center gap-1 text-brand-700"><span className="h-2 w-2 rounded-full bg-brand" />{totals.sentiment.negative}%</span>
                <span className="inline-flex items-center gap-1 text-muted"><span className="h-2 w-2 rounded-full bg-line" />{totals.sentiment.neutral}%</span>
              </div>
            ) : (
              <p className="nums text-xl font-bold text-ink">—</p>
            )}
          </div>
        </div>

        {canManage && (
          <div className="flex justify-end">
            <button className="btn-secondary text-sm" onClick={() => setAddingPlatform(true)}><Plus size={14} /> {t("influencer2AddPlatformCta")}</button>
          </div>
        )}

        {platforms.length === 0 ? (
          <p className="card text-muted">{t("influencer2NoPlatformsYet")}</p>
        ) : (
          <>
            <Influencer2PlatformBreakdownTable
              organizationId={organizationId}
              campaignId={campaignId}
              contentType={campaign.contentType}
              platforms={platforms}
              onMetricsChanged={refresh}
              onEditPlatform={canManage ? (p) => setEditingPlatform(p) : undefined}
              onRemovePlatform={canManage ? onRemovePlatform : undefined}
            />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Influencer2EngagementByPlatformChart platforms={platforms} />
              <Influencer2GrowthChart organizationId={organizationId} campaignId={campaignId} platforms={platforms} />
            </div>
          </>
        )}

        {editingCampaign && (
          <Influencer2CampaignModal
            organizationId={organizationId}
            initial={campaign}
            onClose={() => setEditingCampaign(false)}
            onDone={() => { setEditingCampaign(false); refresh(); }}
          />
        )}

        {addingPlatform && (
          <Influencer2PlatformModal
            organizationId={organizationId}
            campaignId={campaignId}
            contentType={campaign.contentType}
            existingPlatformIds={platforms.map((p) => p.platformId)}
            onClose={() => setAddingPlatform(false)}
            onDone={() => { setAddingPlatform(false); refresh(); }}
          />
        )}

        {editingPlatform && (
          <Influencer2PlatformModal
            organizationId={organizationId}
            campaignId={campaignId}
            contentType={campaign.contentType}
            existingPlatformIds={platforms.map((p) => p.platformId)}
            editing={editingPlatform}
            onClose={() => setEditingPlatform(null)}
            onDone={() => { setEditingPlatform(null); refresh(); }}
          />
        )}

        {approvingPayment && (influencer || mediaHost) && (
          <ApprovePaymentModal
            organizationId={organizationId}
            campaignId={campaignId}
            beneficiaryType={influencer ? "INFLUENCER" : "MEDIA_HOST"}
            beneficiaryId={(influencer ?? mediaHost)!.id}
            onClose={() => setApprovingPayment(false)}
            onDone={() => { setApprovingPayment(false); showToast("success", t("paymentApprovedToast")); refresh(); }}
          />
        )}
      </div>
    </RequireAccess>
  );
}
