"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from "lucide-react";
import { api } from "@/lib/api";
import type { Influencer2CampaignStatus, Influencer2CampaignSummary, Influencer2ContentType, Influencer2Folder, MediaHostProfile, PaginatedInfluencer2Campaigns, PostingWeekDefinition } from "@/lib/types";
import { Influencer2CampaignModal } from "@/components/Influencer2CampaignModal";
import { BulkWeekAssignBar } from "@/components/BulkWeekAssignBar";
import { BulkFolderAssignBar } from "@/components/BulkFolderAssignBar";
import { TableSearchInput } from "@/components/TableSearchInput";
import { LoadingWord } from "@/components/LoadingWord";
import { RequireAccess } from "@/components/RequireAccess";
import { useAuth } from "@/hooks/useAuth";
import { canManageInfluencer2 } from "@/lib/permissions";
import { PAYMENT_PROGRESS_LABEL_KEYS, PAYMENT_PROGRESS_BADGE } from "@/lib/paymentProgress";
import { useLang } from "@/lib/i18n";
import { timeAgo } from "@/lib/timeAgo";

const PAGE_SIZE = 25;
const CONTENT_TYPES: Influencer2ContentType[] = ["VIDEO", "IMAGE", "REEL", "STORY", "ARTICLE", "PODCAST", "AUDIO", "OTHER"];
const STATUSES: Influencer2CampaignStatus[] = ["DRAFT", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"];

type SortKey = "name" | "contentType" | "campaign" | "views" | "engagement" | "status" | "updated";
type FilterMode = "week" | "monthly" | "allTime" | "custom";

const ALL_TIME_FROM = "2000-01-01T00:00:00.000Z";

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

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
  const { t, lang } = useLang();
  const { data: me } = useAuth();
  const myRole = me?.organizations.find((o) => o.organizationId === organizationId)?.role;
  const canManage = canManageInfluencer2(myRole);
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [contentType, setContentType] = useState<Influencer2ContentType | "">("");
  const [status, setStatus] = useState<Influencer2CampaignStatus | "">("");
  const [search, setSearch] = useState("");
  const [folderId, setFolderId] = useState(searchParams.get("folderId") ?? "");
  const initialWeekId = searchParams.get("weekDefinitionId") ?? "";
  const [weekDefinitionId, setWeekDefinitionId] = useState(initialWeekId);
  // "Week" isn't a rolling 7 days here — it's a pick from the org's own centrally-defined weeks
  // (see Settings' Campaign Weeks), same ones the profile page's Campaigns table breaks down by
  // and links in from. "Weekly" is the default view regardless of how the page is reached — either
  // the week already picked via the link (initialWeekId), or, landing with none, the earliest
  // defined week (picked by the effect below) — never "All time" as the opening view.
  const [filterMode, setFilterMode] = useState<FilterMode>("week");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [showAddCampaign, setShowAddCampaign] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const { data: profile } = useQuery({
    queryKey: ["media-host-profile", hostId],
    queryFn: () => api.get<MediaHostProfile>(`/api/v1/organizations/${organizationId}/media-hosts/${hostId}`),
  });

  const { data: folders } = useQuery({
    queryKey: ["influencer2-folders", organizationId, hostId],
    queryFn: () => api.get<Influencer2Folder[]>(`/api/v1/organizations/${organizationId}/influencer2/folders?mediaHostId=${hostId}`),
  });
  const selectedFolder = folders?.find((f) => f.id === folderId);

  // The centralized replacement for per-beneficiary folders (see PostingWeeksPanel) — a week
  // definition's own assessment already comes back scoped to this one beneficiary. Fetched
  // unconditionally now (not just when a week is already picked) so the "Week" mode's own dropdown
  // has something to list.
  const { data: weekDefinitions } = useQuery({
    queryKey: ["posting-week-definition-rows", organizationId, hostId],
    queryFn: () => api.get<PostingWeekDefinition[]>(`/api/v1/organizations/${organizationId}/posting-agreements/week-definitions?mediaHostId=${hostId}`),
  });
  const selectedWeek = weekDefinitions?.find((w) => w.id === weekDefinitionId);

  // Landing on "Week" mode with nothing picked yet defaults to the earliest defined week (Week
  // 01), not an empty "Select a week…" placeholder — same as how a fresh weekly view always used
  // to show *some* window rather than nothing.
  useEffect(() => {
    if (filterMode === "week" && !weekDefinitionId && weekDefinitions && weekDefinitions.length > 0) {
      const earliest = [...weekDefinitions].sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
      setWeekDefinitionId(earliest.id);
    }
  }, [filterMode, weekDefinitionId, weekDefinitions]);

  // Memoized on the actual filter inputs, not recomputed on every render — otherwise `to: new
  // Date().toISOString()` below would mint a fresh timestamp on every render, which feeds straight
  // into the summary/list queries' queryKeys below and made them look like a brand-new query every
  // time (cache miss), never settling: each fetch's own completion triggers a re-render, which
  // recomputes `to` again before the resolved data ever gets to stick, so "Posts in range"/"Total
  // Views"/etc. stayed on "—" forever for every mode that falls through to `new Date()` here
  // (monthly, custom-without-explicit-dates, and "All time", which is this page's own default).
  const range = useMemo(
    () =>
      filterMode === "week" && selectedWeek
        ? { from: selectedWeek.startDate, to: selectedWeek.endDate }
        : filterMode === "monthly"
          ? { from: isoDaysAgo(30), to: new Date().toISOString() }
          : filterMode === "custom"
            ? { from: customFrom ? `${customFrom}T00:00:00.000Z` : isoDaysAgo(7), to: customTo ? `${customTo}T23:59:59.999Z` : new Date().toISOString() }
            : { from: ALL_TIME_FROM, to: new Date().toISOString() },
    [filterMode, selectedWeek, customFrom, customTo],
  );

  const { data: summary } = useQuery({
    queryKey: ["influencer2-summary", "media-host", hostId, range.from, range.to],
    queryFn: () => api.get<Influencer2CampaignSummary>(`/api/v1/organizations/${organizationId}/influencer2/campaigns/summary?mediaHostId=${hostId}&from=${range.from}&to=${range.to}`),
  });

  // Viewing one campaign's (or week's) posts means the headline figures should be that scope's
  // own totals, not the beneficiary's overall range-scoped summary — "Posts in range: 73" was
  // every post ever, not the ~5 in this campaign, which read as a bug even though it was working
  // as coded.
  const scopeName = (selectedFolder ?? selectedWeek)?.name ?? null;
  const scopedAssessment = selectedFolder?.assessment ?? selectedWeek?.assessment;
  const displayStats = scopedAssessment
    ? {
        totalPosts: scopedAssessment.totalPosts,
        totalViews: scopedAssessment.totalViews,
        totalLikes: scopedAssessment.totalLikes,
        engagementPerPost:
          scopedAssessment.totalPosts > 0
            ? Math.round((scopedAssessment.totalEngagement / scopedAssessment.totalPosts) * 100) / 100
            : null,
      }
    : summary;

  const params = new URLSearchParams({ mediaHostId: hostId, page: String(page), pageSize: String(PAGE_SIZE) });
  if (contentType) params.set("contentType", contentType);
  if (status) params.set("status", status);
  if (search) params.set("search", search);
  if (folderId) {
    // Viewing one campaign's posts overrides the date-range filter entirely — a campaign is its
    // own scope, not narrowed further by whatever range happens to be selected above.
    params.set("folderId", folderId);
    if (selectedFolder?.startDate) params.set("folderStart", selectedFolder.startDate);
    if (selectedFolder?.endDate) params.set("folderEnd", selectedFolder.endDate);
  } else if (selectedWeek) {
    // A centralized week has no per-post tag of its own — it's plain published-date matching, the
    // same generic from/to the date-range picker already uses, just pinned to this week's dates.
    params.set("from", selectedWeek.startDate);
    params.set("to", selectedWeek.endDate);
  } else {
    params.set("from", range.from);
    params.set("to", range.to);
  }

  const { data } = useQuery({
    queryKey: ["influencer2-campaigns", organizationId, "media-host", hostId, contentType, status, search, folderId, weekDefinitionId, page, range.from, range.to],
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
        case "updated":
          return sign * (new Date(a.campaign.updatedAt).getTime() - new Date(b.campaign.updatedAt).getTime());
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

        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line/60 bg-card px-3 py-2 shadow-card">
          <select
            className="input-auto"
            value={filterMode}
            onChange={(e) => {
              const mode = e.target.value as FilterMode;
              setFilterMode(mode);
              if (mode !== "week") setWeekDefinitionId("");
              setPage(1);
            }}
          >
            <option value="week">{t("dateRangeWeekly")}</option>
            <option value="monthly">{t("dateRangeMonthly")}</option>
            <option value="allTime">{t("dateRangeAllTime")}</option>
            <option value="custom">{t("dateRangeCustom")}</option>
          </select>
          {filterMode === "week" && (
            <select className="input-auto" value={weekDefinitionId} onChange={(e) => { setWeekDefinitionId(e.target.value); setPage(1); }}>
              <option value="">{t("selectWeekPlaceholder")}</option>
              {(weekDefinitions ?? []).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          )}
          {filterMode === "custom" && (
            <>
              <input type="date" className="input-auto" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
              <span className="text-xs text-muted">{t("dateRangeToLabel")}</span>
              <input type="date" className="input-auto" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
            </>
          )}
        </div>

        <p className="text-xs text-muted">
          {scopeName
            ? <>{t("statsScopedToCampaignLabel")} <span className="font-medium text-ink">{scopeName}</span></>
            : filterMode === "week"
              ? <>{t("statsScopedToRangeLabel")} <span className="font-medium text-ink">{t("selectWeekPlaceholder")}</span></>
              : <>{t("statsScopedToRangeLabel")} <span className="font-medium text-ink">{filterMode === "allTime" ? t("dateRangeAllTime") : `${range.from.slice(0, 10)} – ${range.to.slice(0, 10)}`}</span></>}
        </p>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="card"><p className="text-xs text-muted">{scopeName ? `${t("totalPostsForPrefix")} "${scopeName}"` : t("totalPostsLabel")}</p><p className="nums text-lg font-bold text-brand-700">{displayStats?.totalPosts ?? "—"}</p></div>
          <div className="card"><p className="text-xs text-muted">{t("influencer2TotalViewsLabel")}</p><p className="nums text-lg font-bold text-ink">{displayStats?.totalViews != null ? displayStats.totalViews.toLocaleString() : "—"}</p></div>
          <div className="card"><p className="text-xs text-muted">{t("influencer2TotalLikesLabel")}</p><p className="nums text-lg font-bold text-ink">{displayStats?.totalLikes != null ? displayStats.totalLikes.toLocaleString() : "—"}</p></div>
          <div className="card"><p className="text-xs text-muted">{t("avgEngagementPerPostLabel")}</p><p className="nums text-lg font-bold text-ink">{displayStats?.engagementPerPost != null ? displayStats.engagementPerPost.toLocaleString() : "—"}</p></div>
        </div>

        <h2 className="font-display text-base font-bold text-ink">{t("influencer2IndividualCampaignsTitle")}</h2>

        <div className="card grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div>
            <label className="label">{t("searchGenericPlaceholder")}</label>
            <TableSearchInput
              value={search}
              onChange={(v) => { setSearch(v); setPage(1); }}
              placeholder={t("searchGenericPlaceholder")}
              className="w-full sm:max-w-none"
            />
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
                    <SortableHeader label={t("updatedColLabel")} sortKey="updated" active={sortKey} dir={sortDir} onClick={toggleSort} />
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
                      <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted" title={new Date(campaign.updatedAt).toLocaleString()}>{timeAgo(campaign.updatedAt, lang)}</td>
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
