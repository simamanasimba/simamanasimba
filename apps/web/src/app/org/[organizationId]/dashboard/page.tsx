"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Wallet, AlertTriangle, CalendarDays, Settings2, Users } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";
import { api } from "@/lib/api";
import { StatCard } from "@/components/StatCard";
import { StatTile } from "@/components/StatTile";
import { RegionTooltip } from "@/components/RegionTooltip";
import { EditRegionTargetsModal } from "@/components/EditRegionTargetsModal";
import { TargetKeyLegend } from "@/components/TargetKeyLegend";
import { OverallReachGauge } from "@/components/OverallReachGauge";
import { CollectiveCampaignSummary } from "@/components/CollectiveCampaignSummary";
import { MediaEngagementOverview } from "@/components/MediaEngagementOverview";
import { DateRangeFilterControl, useDateRangeFilter } from "@/components/DateRangeFilter";
import { useAuth } from "@/hooks/useAuth";
import { isOrgAdmin } from "@/lib/permissions";
import type { EventRecord, FinanceDashboard, RegionTarget } from "@/lib/types";
import { useLang } from "@/lib/i18n";

interface MembershipSummary {
  total: number;
  active: number;
  inactive: number;
  target: number | null;
}

interface GrowthPoint {
  period: string;
  newMembers: number;
  cumulativeMembers: number;
}

interface RegionCount {
  region: string;
  count: number;
}

interface Alert {
  id: string;
  type: string;
  title: string;
  priority: string;
  createdAt: string;
}

/** No target configured → neutral (the app's own border/line color). Otherwise color-coded by how
 * close the bar is to its target, using the app's real success/warning tokens — and a plain
 * error red for "well short" (never the brand color), so a struggling region never visually
 * doubles as a clickable action. */
function regionBarColor(count: number, target: number | null): string {
  if (target == null || target <= 0) return "#EFE7E5";
  const pct = count / target;
  if (pct >= 1) return "#16A34A";
  if (pct >= 0.5) return "#D97706";
  return "#B91C1C";
}

interface BarTargetLabelProps {
  x?: number;
  y?: number;
  width?: number;
  index?: number;
}

/** Renders the progress-against-target percentage directly above each bar, always visible —
 * previously this was only shown in the hover tooltip, which meant the target was invisible
 * until you hovered. Falls back to the plain reached count when no target is configured (there's
 * no percentage to show against). */
function renderBarTargetLabel(data: Array<{ count: number; target: number | null }>) {
  return ({ x = 0, y = 0, width = 0, index = 0 }: BarTargetLabelProps) => {
    const d = data[index];
    const text = d ? (d.target != null && d.target > 0 ? `${Math.round((d.count / d.target) * 100)}%` : `${d.count}`) : "";
    return (
      <text x={x + width / 2} y={y - 6} textAnchor="middle" fontSize={11} fill="#8A7F7C">
        {text}
      </text>
    );
  };
}

export default function DashboardPage() {
  const { organizationId } = useParams<{ organizationId: string }>();
  const router = useRouter();
  const { t } = useLang();
  const queryClient = useQueryClient();
  const { data: me } = useAuth();
  const myRole = me?.organizations.find((o) => o.organizationId === organizationId)?.role;
  const [showEditTargets, setShowEditTargets] = useState(false);
  const dateRangeFilter = useDateRangeFilter("weekly");

  // The Finance role's "dashboard" IS the Payments page now — there's no separate stripped-down
  // dashboard view for them anymore, per explicit request. Redirect rather than branch-render, so
  // a bookmarked/direct /dashboard link also lands them in the right place.
  useEffect(() => {
    if (myRole === "FINANCE_OFFICER") router.replace(`/org/${organizationId}/finance`);
  }, [myRole, organizationId, router]);

  const { data: summary } = useQuery({
    queryKey: ["membership-summary", organizationId],
    queryFn: () => api.get<MembershipSummary>(`/api/v1/organizations/${organizationId}/analytics/membership-summary`),
  });

  const { range } = dateRangeFilter;

  // Kept on its own fixed 12-month trend, independent of the filter below — a cumulative growth
  // LINE only reads as a trend across several buckets; collapsing it to interval=month inside a
  // 7-day weekly window would leave a single dot, not a chart. The filter instead scopes the
  // region bar chart and the "new members" stat to "who joined in this range."
  const { data: growth } = useQuery({
    queryKey: ["analytics-growth", organizationId],
    queryFn: () => api.get<GrowthPoint[]>(`/api/v1/organizations/${organizationId}/analytics/membership-growth?interval=month`),
  });

  const { data: byRegion } = useQuery({
    queryKey: ["analytics-region", organizationId, range.from, range.to],
    queryFn: () => api.get<RegionCount[]>(`/api/v1/organizations/${organizationId}/analytics/members/by-region?from=${range.from}&to=${range.to}`),
  });

  const { data: newMembersInRange } = useQuery({
    queryKey: ["members-new-in-range", organizationId, range.from, range.to],
    queryFn: () => api.get<{ total: number }>(`/api/v1/organizations/${organizationId}/members?registeredFrom=${range.from}&registeredTo=${range.to}&pageSize=1`),
  });

  const { data: leadersByRegion } = useQuery({
    queryKey: ["analytics-region-leaders", organizationId],
    queryFn: () => api.get<RegionCount[]>(`/api/v1/organizations/${organizationId}/analytics/members/by-region/leaders`),
  });

  const { data: regionTargets } = useQuery({
    queryKey: ["region-targets", organizationId],
    queryFn: () => api.get<RegionTarget[]>(`/api/v1/organizations/${organizationId}/region-targets`),
  });

  const { data: events } = useQuery({
    queryKey: ["events", organizationId],
    queryFn: () => api.get<EventRecord[]>(`/api/v1/organizations/${organizationId}/events`),
  });

  const { data: alerts } = useQuery({
    queryKey: ["alerts", organizationId],
    queryFn: () => api.get<Alert[]>(`/api/v1/organizations/${organizationId}/alerts?status=OPEN`),
  });

  const { data: financeDashboard } = useQuery({
    queryKey: ["finance-dashboard", organizationId],
    queryFn: () => api.get<FinanceDashboard>(`/api/v1/organizations/${organizationId}/payments/finance-dashboard`),
  });

  const { data: mediaReach, refetch: refetchMediaReach } = useQuery({
    queryKey: ["media-reach", organizationId],
    queryFn: () => api.get<{ totalReach: number; mediaReach: number; influencerReach: number; target: number | null }>(`/api/v1/organizations/${organizationId}/analytics/media-reach`),
  });

  const targetsByRegion = new Map((regionTargets ?? []).map((rt) => [rt.region, rt]));
  const memberChartData = (byRegion ?? []).map((r) => ({
    region: r.region,
    count: r.count,
    target: targetsByRegion.get(r.region)?.memberTarget ?? null,
  }));
  const leaderChartData = (leadersByRegion ?? []).map((r) => ({
    region: r.region,
    count: r.count,
    target: targetsByRegion.get(r.region)?.leaderTarget ?? null,
  }));
  const allObservedRegions = Array.from(new Set([...(byRegion ?? []), ...(leadersByRegion ?? [])].map((r) => r.region)));

  const chartData = (growth ?? []).map((g) => ({
    period: new Date(g.period).toLocaleDateString(undefined, { month: "short", year: "2-digit" }),
    members: g.cumulativeMembers,
  }));

  if (myRole === "FINANCE_OFFICER") return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold text-ink">{t("navDashboard")}</h1>
      </div>

      <DateRangeFilterControl {...dateRangeFilter} organizationId={organizationId} />

      {/* Members, Media, and Influencer statistics together on one page — a stat here always
          redirects into that category's own dashboard (Members/Media Hosts/Influencers) rather
          than opening an in-page report, so "click a number, land where the detail actually
          lives" is consistent across all three, the same way the Members stat tiles below already
          worked before Media/Influencer joined them here. */}
      <h2 className="font-display text-sm font-bold uppercase tracking-wide text-muted">{t("navMediaEngagementView")}</h2>
      <MediaEngagementOverview organizationId={organizationId} range={dateRangeFilter.range} />

      <h2 className="font-display text-sm font-bold uppercase tracking-wide text-muted">{t("navInfluencersView")}</h2>
      <CollectiveCampaignSummary organizationId={organizationId} scope="ALL_INFLUENCERS" range={dateRangeFilter.range} />

      <h2 className="font-display text-sm font-bold uppercase tracking-wide text-muted">{t("navWanachamaEngagement")}</h2>

      {/* Compact stat tiles instead of the bigger StatCards — leaves more room for the charts
          below without pushing the page past one screen. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <StatTile
          label={t("statTotalMembers")}
          value={(summary?.total ?? 0).toLocaleString()}
          hint={summary?.target ? `${Math.min(100, Math.round(((summary?.total ?? 0) / summary.target) * 100))}% ${t("ofLabel")} ${summary.target.toLocaleString()}` : undefined}
          icon={Users}
          href={`/org/${organizationId}/members`}
        />
        <StatTile label={t("newMembersInRangeLabel")} value={(newMembersInRange?.total ?? 0).toLocaleString()} icon={Users} href={`/org/${organizationId}/members`} />
        <StatTile label={t("totalSpend")} value={(financeDashboard?.totalSpend ?? 0).toLocaleString()} icon={Wallet} href={`/org/${organizationId}/finance/reports?view=finance`} />
        <StatTile label={t("statTotalMeetings")} value={events?.length ?? "—"} icon={CalendarDays} href={`/org/${organizationId}/events`} />
      </div>

      {/* Membership by region + growth, side by side — region gets more space since a club can have many regions */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="card lg:col-span-3">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="font-display text-sm font-bold text-ink">{t("membersByRegion")} <span className="font-normal text-muted">— {t("newMembersInRangeLabel").toLowerCase()}</span></h2>
            {isOrgAdmin(myRole) && (
              <button title={t("editTargetsCta")} className="text-muted hover:text-brand" onClick={() => setShowEditTargets(true)}>
                <Settings2 size={14} />
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <div className="h-[160px] sm:h-[190px] xl:h-[210px]" style={{ minWidth: Math.max(memberChartData.length * 64, 260) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={memberChartData} margin={{ top: 20, left: 8, right: 16, bottom: 36 }} barCategoryGap="35%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#EFE7E5" vertical={false} />
                  <XAxis
                    type="category"
                    dataKey="region"
                    stroke="#8A7F7C"
                    fontSize={11}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    angle={-35}
                    textAnchor="end"
                    height={55}
                  />
                  <YAxis type="number" stroke="#8A7F7C" fontSize={11} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
                  <Tooltip content={<RegionTooltip />} cursor={{ fill: "#FEF2F2" }} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={44} label={renderBarTargetLabel(memberChartData)}>
                    {memberChartData.map((d, i) => (
                      <Cell key={i} fill={regionBarColor(d.count, d.target)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <TargetKeyLegend className="mt-2" />
        </div>

        <div className="card lg:col-span-2">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="font-display text-sm font-bold text-ink">{t("membershipGrowth")}</h2>
            <span className="badge bg-brand-50 text-brand-700">{t("last12Months")}</span>
          </div>
          <div className="h-[160px] sm:h-[190px] xl:h-[210px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <defs>
                <linearGradient id="growthLine" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#DC2626" />
                  <stop offset="100%" stopColor="#7F1D1D" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#EFE7E5" vertical={false} />
              <XAxis dataKey="period" stroke="#8A7F7C" fontSize={11} axisLine={false} tickLine={false} />
              <YAxis stroke="#8A7F7C" fontSize={11} axisLine={false} tickLine={false} width={28} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #EFE7E5" }} />
              <Line type="monotone" dataKey="members" stroke="url(#growthLine)" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Reach gauge + leaders chart side by side (not stacked full-width) — both are
          medium-weight supplementary content, so pairing them keeps the page from running
          longer than it needs to. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <OverallReachGauge
        organizationId={organizationId}
        totalReach={mediaReach?.totalReach ?? 0}
        mediaReach={mediaReach?.mediaReach ?? 0}
        influencerReach={mediaReach?.influencerReach ?? 0}
        target={mediaReach?.target ?? null}
        canEditTarget={isOrgAdmin(myRole)}
        onTargetSaved={() => refetchMediaReach()}
      />

      {/* Leaders by region — same progress-vs-target treatment as the members chart above */}
      <div className="card">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="font-display text-sm font-bold text-ink">{t("leadersByRegion")}</h2>
          {isOrgAdmin(myRole) && (
            <button title={t("editTargetsCta")} className="text-muted hover:text-brand" onClick={() => setShowEditTargets(true)}>
              <Settings2 size={14} />
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <div className="h-[140px] sm:h-[160px] xl:h-[180px]" style={{ minWidth: Math.max(leaderChartData.length * 64, 260) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={leaderChartData} margin={{ top: 20, left: 8, right: 16, bottom: 36 }} barCategoryGap="35%">
                <CartesianGrid strokeDasharray="3 3" stroke="#EFE7E5" vertical={false} />
                <XAxis
                  type="category"
                  dataKey="region"
                  stroke="#8A7F7C"
                  fontSize={11}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  angle={-35}
                  textAnchor="end"
                  height={55}
                />
                <YAxis type="number" stroke="#8A7F7C" fontSize={11} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
                <Tooltip content={<RegionTooltip />} cursor={{ fill: "#FEF2F2" }} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={44} label={renderBarTargetLabel(leaderChartData)}>
                  {leaderChartData.map((d, i) => (
                    <Cell key={i} fill={regionBarColor(d.count, d.target)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <TargetKeyLegend className="mt-2" />
      </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-sm font-bold text-ink">
              <AlertTriangle size={16} className="text-warning" /> {t("openAlertsTitle")}
            </h2>
            <Link href={`/org/${organizationId}/digital`} className="text-sm font-medium text-brand hover:underline">{t("viewAll")}</Link>
          </div>
          {!alerts || alerts.length === 0 ? (
            <p className="text-sm text-muted">{t("noOpenAlerts")}</p>
          ) : (
            <ul className="max-h-[140px] divide-y divide-line overflow-y-auto">
              {alerts.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-2">
                  <span className="text-sm text-ink">{a.title}</span>
                  <span className="badge bg-brand-50 text-brand-700">{a.priority}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-display text-sm font-bold text-ink">{t("recentEventsTitle")}</h2>
            <Link href={`/org/${organizationId}/events`} className="text-sm font-medium text-brand hover:underline">{t("viewAll")}</Link>
          </div>
          <div className="max-h-[140px] divide-y divide-line overflow-y-auto">
            {(events ?? []).slice(0, 5).map((e) => (
              <Link key={e.id} href={`/org/${organizationId}/events/${e.id}`} className="flex items-center justify-between py-2 hover:text-brand">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{e.name}</p>
                  <p className="text-xs text-muted">{new Date(e.startDatetime).toLocaleString()}</p>
                </div>
                <span className="badge shrink-0 bg-surface text-muted">{e.status}</span>
              </Link>
            ))}
            {(!events || events.length === 0) && <p className="py-2.5 text-sm text-muted">{t("noEventsYet")}</p>}
          </div>
        </div>
      </div>

      {showEditTargets && (
        <EditRegionTargetsModal
          organizationId={organizationId}
          regions={allObservedRegions}
          targets={regionTargets ?? []}
          onClose={() => setShowEditTargets(false)}
          onDone={() => {
            setShowEditTargets(false);
            queryClient.invalidateQueries({ queryKey: ["region-targets", organizationId] });
          }}
        />
      )}
    </div>
  );
}

