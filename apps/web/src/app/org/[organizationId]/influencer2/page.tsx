"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, ChevronLeft, ChevronRight, Sparkles, CircleCheck } from "lucide-react";
import { api } from "@/lib/api";
import type { Influencer, Influencer2CampaignListItem, Influencer2CampaignStatus, Influencer2ContentType, Influencer2Platform, PaginatedInfluencer2Campaigns } from "@/lib/types";
import { Influencer2CampaignModal } from "@/components/Influencer2CampaignModal";
import { ApprovePaymentModal } from "@/components/ApprovePaymentModal";
import { LoadingWord } from "@/components/LoadingWord";
import { RequireAccess } from "@/components/RequireAccess";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/hooks/useAuth";
import { useRolePermissions } from "@/hooks/useRolePermissions";
import { canManageInfluencer2, canApprovePayment } from "@/lib/permissions";
import { PAYMENT_PROGRESS_LABEL_KEYS, PAYMENT_PROGRESS_BADGE } from "@/lib/paymentProgress";
import { useLang } from "@/lib/i18n";

const PAGE_SIZE = 25;
const CONTENT_TYPES: Influencer2ContentType[] = ["VIDEO", "IMAGE", "REEL", "STORY", "ARTICLE", "PODCAST", "AUDIO", "OTHER"];
const STATUSES: Influencer2CampaignStatus[] = ["DRAFT", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"];

export default function Influencer2ListPage() {
  const { organizationId } = useParams<{ organizationId: string }>();
  const { t } = useLang();
  const { showToast } = useToast();
  const { data: me } = useAuth();
  const { data: perms } = useRolePermissions(organizationId);
  const myRole = me?.organizations.find((o) => o.organizationId === organizationId)?.role;
  const canManage = canManageInfluencer2(myRole);
  const canApprove = canApprovePayment(myRole, perms?.matrix);
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [influencerId, setInfluencerId] = useState("");
  const [platformKey, setPlatformKey] = useState("");
  const [contentType, setContentType] = useState<Influencer2ContentType | "">("");
  const [status, setStatus] = useState<Influencer2CampaignStatus | "">("");
  const [showCreate, setShowCreate] = useState(false);
  const [approvingItem, setApprovingItem] = useState<Influencer2CampaignListItem | null>(null);

  const { data: influencers } = useQuery({
    queryKey: ["influencers", organizationId],
    queryFn: () => api.get<Influencer[]>(`/api/v1/organizations/${organizationId}/influencers`),
  });
  const { data: platforms } = useQuery({
    queryKey: ["influencer2-platforms", organizationId, "all"],
    queryFn: () => api.get<Influencer2Platform[]>(`/api/v1/organizations/${organizationId}/influencer2/platforms`),
  });

  const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (influencerId) params.set("influencerId", influencerId);
  if (platformKey) params.set("platformKey", platformKey);
  if (contentType) params.set("contentType", contentType);
  if (status) params.set("status", status);

  const { data } = useQuery({
    queryKey: ["influencer2-campaigns", organizationId, influencerId, platformKey, contentType, status, page],
    queryFn: () => api.get<PaginatedInfluencer2Campaigns>(`/api/v1/organizations/${organizationId}/influencer2/campaigns?${params.toString()}`),
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["influencer2-campaigns", organizationId] });
  }

  return (
    <RequireAccess area="influencer2">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display flex items-center gap-2 text-2xl font-extrabold text-ink">
              <Sparkles size={22} className="text-brand" /> {t("influencer2Title")}
            </h1>
            <p className="text-sm text-muted">{t("influencer2Subtitle")}</p>
          </div>
          {canManage && (
            <button className="btn-primary text-sm" onClick={() => setShowCreate(true)}>
              <Plus size={15} /> {t("createInfluencer2CampaignCta")}
            </button>
          )}
        </div>

        <div className="card grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div>
            <label className="label">{t("influencer2FilterInfluencer")}</label>
            <select className="input" value={influencerId} onChange={(e) => { setInfluencerId(e.target.value); setPage(1); }}>
              <option value="">{t("allLabel")}</option>
              {(influencers ?? []).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">{t("influencer2FilterPlatform")}</label>
            <select className="input" value={platformKey} onChange={(e) => { setPlatformKey(e.target.value); setPage(1); }}>
              <option value="">{t("allLabel")}</option>
              {(platforms ?? []).map((p) => <option key={p.id} value={p.key}>{p.name}</option>)}
            </select>
          </div>
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
                    <th className="px-4 py-2.5">{t("influencer2FilterInfluencer")}</th>
                    <th className="px-4 py-2.5">{t("influencer2ContentTypeColLabel")}</th>
                    <th className="px-4 py-2.5">{t("influencer2PlatformsColLabel")}</th>
                    <th className="px-4 py-2.5 text-right">{t("influencer2ViewsColLabel")}</th>
                    <th className="px-4 py-2.5 text-right">{t("influencer2EngagementColLabel")}</th>
                    <th className="px-4 py-2.5">{t("statusColLabel")}</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.items.map((item) => {
                    const { campaign, influencerName, platformKeys, totals } = item;
                    const isUnpaid = (campaign.paymentProgress ?? "UNPAID") === "UNPAID";
                    return (
                      <tr key={campaign.id} className="hover:bg-brand-50/40">
                        <td className="px-4 py-2.5">
                          <Link href={`/org/${organizationId}/influencer2/${campaign.id}`} className="font-medium text-brand hover:underline">{campaign.name}</Link>
                        </td>
                        <td className="px-4 py-2.5 text-muted">{influencerName ?? "—"}</td>
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
                        <td className="whitespace-nowrap px-4 py-2.5 text-right">
                          {canApprove && isUnpaid && (campaign.influencerId || campaign.mediaHostId) && (
                            <button
                              title={t("approvePaymentCta")}
                              className="btn-secondary !p-2"
                              onClick={() => setApprovingItem(item)}
                            >
                              <CircleCheck size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
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

        {showCreate && (
          <Influencer2CampaignModal
            organizationId={organizationId}
            onClose={() => setShowCreate(false)}
            onDone={() => { setShowCreate(false); refresh(); }}
          />
        )}

        {approvingItem && (
          <ApprovePaymentModal
            organizationId={organizationId}
            campaignId={approvingItem.campaign.id}
            beneficiaryType={approvingItem.campaign.influencerId ? "INFLUENCER" : "MEDIA_HOST"}
            beneficiaryId={(approvingItem.campaign.influencerId ?? approvingItem.campaign.mediaHostId)!}
            onClose={() => setApprovingItem(null)}
            onDone={() => { setApprovingItem(null); showToast("success", t("paymentApprovedToast")); refresh(); }}
          />
        )}
      </div>
    </RequireAccess>
  );
}
