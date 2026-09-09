"use client";

import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from "recharts";
import { Radio, Tv, Newspaper, Globe, FileText, MessageSquare, BookOpen, Mic, Building2, Users, Trophy, Megaphone, Target, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { api } from "@/lib/api";
import { StatTile } from "@/components/StatTile";
import { useLang } from "@/lib/i18n";
import type { MediaEngagementOverview as OverviewData, Influencer2CampaignSummary } from "@/lib/types";

const TYPE_ICONS: Record<string, LucideIcon> = {
  TV: Tv,
  ONLINE_TV: Tv,
  RADIO: Radio,
  PODCAST: Mic,
  NEWSPAPER: Newspaper,
  MAGAZINE: Newspaper,
  NEWS_WEBSITE: Globe,
  WEBSITE: Globe,
  BLOG: FileText,
  FORUM: MessageSquare,
  SOCIAL_MEDIA: MessageSquare,
  DIGITAL_PUBLISHER: BookOpen,
  OTHER: Globe,
};

const RANK_COLORS = ["bg-amber-50 text-warning", "bg-line/60 text-muted", "bg-brand-50 text-brand-700"];

function sentenceCase(value: string): string {
  const lower = value.toLowerCase().replace(/_/g, " ");
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function total(row: { likes: number; comments: number; views: number; shares: number }): number {
  return row.likes + row.comments + row.views + row.shares;
}

/** Real, registered-data stats for the "Media Engagement" dashboard view, laid out to fit one
 * screen without a page scroll: compact stat tiles, then the by-type chart alongside a right-hand
 * column of Top Performing Hosts / Top Performing Media / Media by Type (each list internally
 * scrolls past 5 rows rather than growing the page). All of it is scoped to `range` — "active
 * media"/"active hosts" means hosts that actually posted during the window, not the whole
 * roster — via the API, not client-side filtering. Active/hosts counts come from actual MediaHost
 * rows (never the reference catalog); the by-type chart and top-performer lists come from real
 * recorded engagement (legacy MediaEngagement + Influencer 2 metric values, wherever either is
 * linked to a media host). "Shares" is this app's closest real equivalent to "saves" — there's no
 * distinct saves metric tracked anywhere in the data. Only media types with at least some real
 * engagement are shown in the chart. */
export function MediaEngagementOverview({ organizationId, range }: { organizationId: string; range: { from: string; to: string } }) {
  const { t } = useLang();

  const { data } = useQuery({
    queryKey: ["media-engagement-overview", organizationId, range.from, range.to],
    queryFn: () => api.get<OverviewData>(`/api/v1/organizations/${organizationId}/media-hosts/engagement-overview?from=${range.from}&to=${range.to}`),
  });
  const { data: summary } = useQuery({
    queryKey: ["influencer2-summary", "collective", "ALL_MEDIA_HOSTS", organizationId, range.from, range.to],
    queryFn: () => api.get<Influencer2CampaignSummary>(`/api/v1/organizations/${organizationId}/influencer2/campaigns/summary?scope=ALL_MEDIA_HOSTS&from=${range.from}&to=${range.to}`),
  });

  if (!data) return null;

  const chartData = data.engagementByType
    .filter((row) => row.likes || row.views || row.shares)
    .map((row) => ({ type: sentenceCase(row.type), likes: row.likes, views: row.views, shares: row.shares }));
  const topHosts = [...data.topHosts].sort((a, b) => total(b) - total(a));
  const topMedia = [...data.topMedia].sort((a, b) => total(b) - total(a));

  const typeRows = data.hostsByType.map(({ type, count }) => {
    const eng = data.engagementByType.find((e) => e.type === type);
    return { type, hosts: count, engagement: eng ? total(eng) : 0 };
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label={t("activeMediaLabel")} value={data.activeMediaCount} icon={Building2} href={`/org/${organizationId}/media-hosts`} />
        <StatTile label={t("activeMediaHostsLabel")} value={data.activeHostCount} icon={Users} />
        <StatTile label={t("totalCampaignsLabel")} value={summary?.totalCampaigns ?? "—"} icon={Megaphone} />
        <StatTile label={t("engagementPerPostLabel")} value={summary?.engagementPerPost != null ? summary.engagementPerPost.toLocaleString() : "—"} icon={Target} />
        <StatTile label={t("influencer2TotalEngagementLabel")} value={summary?.totalEngagement != null ? summary.totalEngagement.toLocaleString() : "—"} icon={Trophy} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="card lg:col-span-7">
          <h2 className="mb-2 text-center font-display text-sm font-bold text-ink">{t("engagementByTypeTitle")}</h2>
          {chartData.length > 0 ? (
            <div className="mx-auto h-[220px] w-full max-w-xl sm:h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barGap={4} barCategoryGap="20%" margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EFE7E5" />
                  <XAxis dataKey="type" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={32} />
                  <Tooltip />
                  <Legend wrapperStyle={{ paddingTop: 8, fontSize: 12 }} />
                  <Bar dataKey="likes" name={t("likesLabel")} fill="#DC2626" radius={[6, 6, 0, 0]} maxBarSize={32}>
                    <LabelList dataKey="likes" position="top" fontSize={10} />
                  </Bar>
                  <Bar dataKey="views" name={t("viewsLabel")} fill="#2563EB" radius={[6, 6, 0, 0]} maxBarSize={32}>
                    <LabelList dataKey="views" position="top" fontSize={10} />
                  </Bar>
                  <Bar dataKey="shares" name={t("sharesLabel")} fill="#16A34A" radius={[6, 6, 0, 0]} maxBarSize={32}>
                    <LabelList dataKey="shares" position="top" fontSize={10} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-[220px] items-center justify-center sm:h-[240px]">
              <p className="text-sm text-muted">{t("noEngagementYet")}</p>
            </div>
          )}
        </div>

        <div className="space-y-4 lg:col-span-5">
          <div className="card">
            <div className="mb-2 flex items-center gap-1.5">
              <Trophy size={14} className="text-warning" />
              <h2 className="font-display text-sm font-bold text-ink">{t("topPerformingHostsTitle")}</h2>
            </div>
            {topHosts.length === 0 ? (
              <p className="text-sm text-muted">{t("noEngagementYet")}</p>
            ) : (
              <div className="max-h-[168px] space-y-0.5 overflow-y-auto">
                {topHosts.map((h, i) => {
                  const Icon = TYPE_ICONS[h.type] ?? Globe;
                  return (
                    <div key={h.id} className="flex items-center gap-2 rounded-lg px-1 py-1.5 hover:bg-brand-50/40">
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${RANK_COLORS[i] ?? "bg-surface text-muted"}`}>
                        {i + 1}
                      </span>
                      <Icon size={13} className="shrink-0 text-muted" />
                      <p className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{h.name}</p>
                      <span className="nums shrink-0 text-sm font-bold text-ink">{total(h).toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="card">
            <div className="mb-2 flex items-center gap-1.5">
              <Sparkles size={14} className="text-brand-700" />
              <h2 className="font-display text-sm font-bold text-ink">{t("topPerformingMediaTitle")}</h2>
            </div>
            {topMedia.length === 0 ? (
              <p className="text-sm text-muted">{t("noEngagementYet")}</p>
            ) : (
              <div className="max-h-[168px] space-y-0.5 overflow-y-auto">
                {topMedia.map((m, i) => (
                  <div key={m.id} className="flex items-center gap-2 rounded-lg px-1 py-1.5 hover:bg-brand-50/40">
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${RANK_COLORS[i] ?? "bg-surface text-muted"}`}>
                      {i + 1}
                    </span>
                    <Building2 size={13} className="shrink-0 text-muted" />
                    <p className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{m.name}</p>
                    <span className="nums shrink-0 text-sm font-bold text-ink">{total(m).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="card">
            <div className="mb-2 flex items-center gap-1.5">
              <Globe size={14} className="text-muted" />
              <h2 className="font-display text-sm font-bold text-ink">{t("mediaByTypeTitle")}</h2>
            </div>
            {typeRows.length === 0 ? (
              <p className="text-sm text-muted">{t("noEngagementYet")}</p>
            ) : (
              <div className="max-h-[168px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-muted">
                      <th className="pb-1.5 font-semibold">{t("typeLabel")}</th>
                      <th className="pb-1.5 text-right font-semibold">{t("hostsColLabel")}</th>
                      <th className="pb-1.5 text-right font-semibold">{t("influencer2TotalEngagementLabel")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/60">
                    {typeRows.map(({ type, hosts, engagement }) => {
                      const Icon = TYPE_ICONS[type] ?? Globe;
                      return (
                        <tr key={type}>
                          <td className="flex items-center gap-1.5 py-1.5 font-medium text-ink">
                            <Icon size={13} className="shrink-0 text-muted" /> {sentenceCase(type)}
                          </td>
                          <td className="nums py-1.5 text-right text-muted">{hosts}</td>
                          <td className="nums py-1.5 text-right font-semibold text-ink">{engagement.toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
