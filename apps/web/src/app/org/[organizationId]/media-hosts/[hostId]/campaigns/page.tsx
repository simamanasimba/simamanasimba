"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from "lucide-react";
import { api } from "@/lib/api";
import type { Influencer2CampaignStatus, Influencer2CampaignSummary, Influencer2ContentType, Influencer2Folder, MediaHostProfile, PaginatedInfluencer2Campaigns } from "@/lib/types";
import { Influencer2CampaignModal } from "@/components/Influencer2CampaignModal";
import { BulkWeekAssignBar } from "@/components/BulkWeekAssignBar";
import { BulkFolderAssignBar } from "@/components/BulkFolderAssignBar";
import { LoadingWord } from "@/components/LoadingWord";
import { RequireAccess } from "@/components/RequireAccess";
import { DateRangeFilterControl, formatRangeLabel, useDateRangeFilter } from "@/components/DateRangeFilter";
import { useAuth } from "@/hooks/useAuth";
import { canManageInfluencer2 } from "@/lib/permissions";
import { PAYMENT_PROGRESS_LABEL_KEYS, PAYMENT_PROGRESS_BADGE } from "@/lib/paymentProgress";
import { useLang } from "@/lib/i18n";

const PAGE_SIZE = 25;
const CONTENT_TYPES: Influencer2ContentType[] = ["VIDEO", "IMAGE", "REEL", "STORY", "ARTICLE", "PODCAST", "AUDIO", "OTHER"];
const STATUSES: Influencer2CampaignStatus[] = ["DRAFT", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"];

type SortKey = "name" | "contentType" | "campaign" | "views" | "engagement" | "status";

/** Clickable header that toggles asc/desc on the current page's rows — sorting only ever applies
 * to the page you're looking at (data is server-paginated), same as any spreadsheet column sort
 * within a visible sheet. */
function SortableHeader({ label, sortKey, active, dir, onClick, align }: { label: string; sortKey: SortKey; active: SortKey; dir: "asc" | "desc"; onClick: (key: SortKey) => void; align?: "right" }) {
  const isActive = active === sortKey;
  return (
    <th className={`px-4 py-2.5 ${align === "right" ? "text-right" : ""}`}>
      <button type="button" onClick={() => onClick(sortKey)} className={`inline-flex items-center gap-1 ${align === "right" ? "flex-row-reverse" : ""} hover:text-ink`}>
        {label}
        {isActive ? (dir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : null}
      </button>
    </th>
  );
}

/** All of one media host's Influencer 2 campaigns — reached from the "Total
 * campaigns" card on their profile page. Mirrors the influencer version. */
export default function MediaHostCampaignsPage() {
  const { organizationId, hostId } = useParams<{ organizationId: string; hostId: string }>();
  const searchParams = useSearchParams();
  const { t } = useLang();
  const { data: me } = useAuth();
  const myRole = me?.organizations.find((o) => o.organizationId === organizationId)?.role;
  const canManage = canManageInfluencer2(myRole);
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [contentType, setContentType] = useState<Influencer2ContentType | "">("");
  const [status, setStatus] = useState<Influencer2CampaignStatus | "">("");
  const [folderId, setFolderId] = useState(searchParams.get("folderId") ?? "");
  const [showAddCampaign, setShowAddCampaign] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  // A list of every post defaults to showing every post — "weekly" as a default here silently
  // hid posts older than 7 days (a genuinely confusing "missing post" experience), unlike the
  // profile page's own stat tiles, where a weekly-by-default *summary* is the actual intent.
  const dateRangeFilter = useDateRangeFilter("allTime");
  const { range } = dateRangeFilter;

  const { data: profile } = useQuery({
    queryKey: ["media-host-profile", hostId],
    queryFn: () => api.get<MediaHostProfile>(`/api/v1/organizations/${organizationId}/media-hosts/${hostId}`),
  });

  const { data: summary } = useQuery({
    queryKey: ["influencer2-summary", "media-host", hostId, range.from, range.to],
    queryFn: () => api.get<Influencer2CampaignSummary>(`/api/v1/organizations/${organizationId}/influencer2/campaigns/summary?mediaHostId=${hostId}&from=${range.from}&to=${range.to}`),
  });

  const { data: folders } = useQuery({
    queryKey: ["influencer2-folders", organizationId, hostId],
    queryFn: () => api.get<Influencer2Folder[]>(`/api/v1/organizations/${organizationId}/influencer2/folders?mediaHostId=${hostId}`),
  });
  const selectedFolder = folders?.find((f) => f.id === folderId);

  const params = new URLSearchParams({ mediaHostId: hostId, page: String(page), pageSize: String(PAGE_SIZE) });
  if (contentType) params.set("contentType", contentType);
  if (status) params.set("status", status);
  if (folderId) {
    // Viewing one campaign's posts overrides the date-range filter entirely — a campaign is its
    // own scope, not narrowed further by whatever range happens to be selected above.
    params.set("folderId", folderId);
    if (selectedFolder?.startDate) params.set("folderStart", selectedFolder.startDate);
    if (selectedFolder?.endDate) params.set("folderEnd", selectedFolder.endDate);
  } else {
    params.set("from", range.from);
    params.set("to", range.to);
  }

  const { data } = useQuery({
    queryKey: ["influencer2-campaigns", organizationId, "media-host", hostId, contentType, status, folderId, page, range.from, range.to],
    queryFn: () => api.get<PaginatedInfluencer2Campaigns>(`/api/v1/organizations/${organizationId}/influencer2/campaigns?${params.toString()}`),
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["influencer2-campaigns", organizationId, "media-host", hostId] });
    queryClient.invalidateQueries({ queryKey: ["influencer2-summary", "media-host", hostId] });
    queryClient.invalidateQueries({ queryKey: ["media-host-profile", hostId] });
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const pageIds = data?.items.map((i) => i.campaign.id) ?? [];
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));

  function toggleSelectAllOnPage() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  const folderNameById = new Map((folders ?? []).map((f) => [f.id, f.name]));

  const sortedItems = useMemo(() => {
    const items = data?.items ?? [];
    const sign = sortDir === "asc" ? 1 : -1;
    return [...items].sort((a, b) => {
      switch (sortKey) {
        case "name":
          return sign * a.campaign.name.localeCompare(b.campaign.name);
        case "contentType":
          return sign * a.campaign.contentType.localeCompare(b.campaign.contentType);
        case "campaign": {
          const an = (a.campaign.folderId && folderNameById.get(a.campaign.folderId)) || "";
          const bn = (b.campaign.folderId && folderNameById.get(b.campaign.folderId)) || "";
          return sign * an.localeCompare(bn);
        }
        case "views":
          return sign * ((a.totals.totalViews ?? -1) - (b.totals.totalViews ?? -1));
        case "engagement":
          return sign * (a.totals.totalEngagement - b.totals.totalEngagement);
        case "status":
          return sign * (a.campaign.paymentProgress ?? "UNPAID").localeCompare(b.campaign.paymentProgress ?? "UNPAID");
        default:
          return 0;
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, sortKey, sortDir]);

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

        <p className="text-xs text-muted">{t("statsScopedToRangeLabel")} <span className="font-medium text-ink">{formatRangeLabel(range, t("dateRangeAllTime"))}</span></p>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="card"><p className="text-xs text-muted">{t("totalPostsLabel")}</p><p className="nums text-lg font-bold text-brand-700">{summary?.totalPosts ?? "—"}</p></div>
          <div className="card"><p className="text-xs text-muted">{t("influencer2TotalViewsLabel")}</p><p className="nums text-lg font-bold text-ink">{summary?.totalViews != null ? summary.totalViews.toLocaleString() : "—"}</p></div>
          <div className="card"><p className="text-xs text-muted">{t("influencer2TotalLikesLabel")}</p><p className="nums text-lg font-bold text-ink">{summary?.totalLikes != null ? summary.totalLikes.toLocaleString() : "—"}</p></div>
          <div className="card"><p className="text-xs text-muted">{t("avgEngagementPerPostLabel")}</p><p className="nums text-lg font-bold text-ink">{summary?.engagementPerPost != null ? summary.engagementPerPost.toLocaleString() : "—"}</p></div>
        </div>

        <h2 className="font-display text-base font-bold text-ink">{t("influencer2IndividualCampaignsTitle")}</h2>

        <div className="card grid grid-cols-1 gap-3 sm:grid-cols-3">
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
          <div>
            <label className="label">{t("postFolderLabel")}</label>
            <select className="input" value={folderId} onChange={(e) => { setFolderId(e.target.value); setPage(1); }}>
              <option value="">{t("allLabel")}</option>
              {(folders ?? []).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
        </div>

        {canManage && (
          <div className="space-y-2">
            <BulkWeekAssignBar
              organizationId={organizationId}
              mediaHostId={hostId}
              selectedIds={[...selectedIds]}
              onClearSelection={() => setSelectedIds(new Set())}
              onDone={refresh}
            />
            <BulkFolderAssignBar
              organizationId={organizationId}
              mediaHostId={hostId}
              selectedIds={[...selectedIds]}
              onClearSelection={() => setSelectedIds(new Set())}
              onDone={refresh}
            />
          </div>
        )}

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
                    {canManage && (
                      <th className="w-8 px-4 py-2.5">
                        <input type="checkbox" checked={allOnPageSelected} onChange={toggleSelectAllOnPage} title={t("selectAllCta")} />
                      </th>
                    )}
                    <SortableHeader label={t("influencer2CampaignColLabel")} sortKey="name" active={sortKey} dir={sortDir} onClick={toggleSort} />
                    <SortableHeader label={t("influencer2ContentTypeColLabel")} sortKey="contentType" active={sortKey} dir={sortDir} onClick={toggleSort} />
                    <th className="px-4 py-2.5">{t("influencer2PlatformsColLabel")}</th>
                    <SortableHeader label={t("postFolderLabel")} sortKey="campaign" active={sortKey} dir={sortDir} onClick={toggleSort} />
                    <SortableHeader label={t("influencer2ViewsColLabel")} sortKey="views" active={sortKey} dir={sortDir} onClick={toggleSort} align="right" />
                    <SortableHeader label={t("influencer2EngagementColLabel")} sortKey="engagement" active={sortKey} dir={sortDir} onClick={toggleSort} align="right" />
                    <SortableHeader label={t("statusColLabel")} sortKey="status" active={sortKey} dir={sortDir} onClick={toggleSort} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {sortedItems.map(({ campaign, platformKeys, totals }) => (
                    <tr key={campaign.id} className="hover:bg-brand-50/40">
                      {canManage && (
                        <td className="px-4 py-2.5">
                          <input type="checkbox" checked={selectedIds.has(campaign.id)} onChange={() => toggleSelected(campaign.id)} />
                        </td>
                      )}
                      <td className="px-4 py-2.5">
                        <Link href={`/org/${organizationId}/influencer2/${campaign.id}`} className="font-medium text-brand hover:underline">{campaign.name}</Link>
                      </td>
                      <td className="px-4 py-2.5 text-muted">{campaign.contentType}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {platformKeys.map((k) => <span key={k} className="badge bg-surface text-muted">{k}</span>)}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-muted">{campaign.folderId ? (folderNameById.get(campaign.folderId) ?? "—") : "—"}</td>
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
