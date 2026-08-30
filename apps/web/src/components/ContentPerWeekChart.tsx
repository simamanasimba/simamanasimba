"use client";

import { useQuery } from "@tanstack/react-query";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { api } from "@/lib/api";
import { useLang } from "@/lib/i18n";

/** Campaigns (content pieces) posted per week for one media host or influencer — shared between
 * their two profile pages since both need the identical chart, just pointed at a different URL. */
export function ContentPerWeekChart({ queryKey, url }: { queryKey: string[]; url: string }) {
  const { t } = useLang();
  const { data } = useQuery({
    queryKey,
    queryFn: () => api.get<Array<{ period: string; count: number }>>(url),
  });
  const chartData = (data ?? []).map((d) => ({
    period: new Date(d.period).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    count: d.count,
  }));

  return (
    <div className="card">
      <h2 className="font-display mb-1 text-base font-bold text-ink">{t("contentPerWeekTitle")}</h2>
      <p className="mb-4 text-xs text-muted">{t("contentPerWeekCaption")}</p>
      {chartData.length === 0 ? (
        <p className="text-sm text-muted">{t("noResultsFound")}</p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EFE7E5" vertical={false} />
            <XAxis dataKey="period" stroke="#8A7F7C" fontSize={12} axisLine={false} tickLine={false} />
            <YAxis stroke="#8A7F7C" fontSize={12} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #EFE7E5" }} />
            <Line type="monotone" dataKey="count" stroke="#DC2626" strokeWidth={3} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
