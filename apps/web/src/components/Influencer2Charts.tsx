"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { api } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import type { Influencer2MetricHistoryPoint, Influencer2PlatformSummary } from "@/lib/types";

const BAR_COLORS = ["#DC2626", "#7F1D1D", "#D97706", "#16A34A", "#2563EB", "#7C3AED"];

/** Total Public Engagement per platform — same visual tokens as every other
 * bar chart in this app (dashed grid, muted axis text, brand-red-led palette). */
export function Influencer2EngagementByPlatformChart({ platforms }: { platforms: Influencer2PlatformSummary[] }) {
  const { t } = useLang();
  const data = platforms.map((p) => ({ name: p.platformName, value: p.totalEngagement }));

  return (
    <div className="card">
      <h2 className="font-display mb-4 text-base font-bold text-ink">{t("influencer2EngagementByPlatformTitle")}</h2>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 8, left: 8, right: 16, bottom: 8 }} barCategoryGap="35%">
          <CartesianGrid strokeDasharray="3 3" stroke="#EFE7E5" vertical={false} />
          <XAxis dataKey="name" stroke="#8A7F7C" fontSize={12} axisLine={false} tickLine={false} />
          <YAxis stroke="#8A7F7C" fontSize={12} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #EFE7E5" }} />
          <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={64}>
            {data.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Growth over time for one platform's one metric at a time — the user picks
 * both from dropdowns, backed by the append-only metric snapshot history. */
export function Influencer2GrowthChart({
  organizationId,
  campaignId,
  platforms,
}: {
  organizationId: string;
  campaignId: string;
  platforms: Influencer2PlatformSummary[];
}) {
  const { t } = useLang();
  const [platformId, setPlatformId] = useState(platforms[0]?.campaignPlatformId ?? "");
  const platform = platforms.find((p) => p.campaignPlatformId === platformId) ?? platforms[0];
  const [metricKey, setMetricKey] = useState(platform?.metrics[0]?.key ?? "");
  const activeMetricKey = platform?.metrics.some((m) => m.key === metricKey) ? metricKey : (platform?.metrics[0]?.key ?? "");

  const { data } = useQuery({
    queryKey: ["influencer2-metric-history", campaignId, platform?.campaignPlatformId, activeMetricKey],
    queryFn: () =>
      api.get<Influencer2MetricHistoryPoint[]>(
        `/api/v1/organizations/${organizationId}/influencer2/campaigns/${campaignId}/platforms/${platform!.campaignPlatformId}/metrics/history?metricKey=${activeMetricKey}`,
      ),
    enabled: Boolean(platform && activeMetricKey),
  });

  const chartData = (data ?? []).map((d) => ({ date: new Date(d.collectedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }), value: d.value }));

  if (platforms.length === 0) return null;

  return (
    <div className="card">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-base font-bold text-ink">{t("influencer2GrowthOverTimeTitle")}</h2>
        <div className="flex gap-2">
          <select
            className="input !w-auto !py-1.5 text-sm"
            value={platform?.campaignPlatformId ?? ""}
            onChange={(e) => {
              setPlatformId(e.target.value);
              const next = platforms.find((p) => p.campaignPlatformId === e.target.value);
              setMetricKey(next?.metrics[0]?.key ?? "");
            }}
          >
            {platforms.map((p) => <option key={p.campaignPlatformId} value={p.campaignPlatformId}>{p.platformName}</option>)}
          </select>
          <select className="input !w-auto !py-1.5 text-sm" value={activeMetricKey} onChange={(e) => setMetricKey(e.target.value)}>
            {(platform?.metrics ?? []).map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        </div>
      </div>
      {chartData.length < 2 ? (
        <p className="text-sm text-muted">{t("influencer2NoGrowthDataYet")}</p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EFE7E5" vertical={false} />
            <XAxis dataKey="date" stroke="#8A7F7C" fontSize={12} axisLine={false} tickLine={false} />
            <YAxis stroke="#8A7F7C" fontSize={12} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #EFE7E5" }} />
            <Line type="monotone" dataKey="value" stroke="#DC2626" strokeWidth={3} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
