"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Printer, Settings2 } from "lucide-react";
import { api } from "@/lib/api";
import { useLang, type DictKey } from "@/lib/i18n";
import type { PerformanceDirection, PerformanceMetric, PerformanceReport } from "@/lib/types";

const DIRECTION_STYLE: Record<PerformanceDirection, { bg: string; text: string; labelKey: DictKey }> = {
  ON_TRACK: { bg: "bg-green-50", text: "text-success", labelKey: "directionOnTrackLabel" },
  NEEDS_IMPROVEMENT: { bg: "bg-amber-50", text: "text-warning", labelKey: "directionNeedsImprovementLabel" },
  BEHIND: { bg: "bg-brand-50", text: "text-brand-700", labelKey: "directionBehindLabel" },
  NO_TARGET: { bg: "bg-surface", text: "text-muted", labelKey: "directionNoTargetLabel" },
};

function DirectionBadge({ direction }: { direction: PerformanceDirection }) {
  const { t } = useLang();
  const s = DIRECTION_STYLE[direction];
  return <span className={`badge ${s.bg} ${s.text}`}>{t(s.labelKey)}</span>;
}

function MetricRow({ label, metric, showPast }: { label: string; metric: PerformanceMetric; showPast: boolean }) {
  return (
    <tr className="border-b border-line/60 last:border-0">
      <td className="py-2.5 pr-4 font-medium text-ink">{label}</td>
      <td className="nums px-2 py-2.5 text-right text-ink">{metric.current.toLocaleString()}</td>
      {showPast && <td className="nums px-2 py-2.5 text-right text-muted">{metric.past != null ? metric.past.toLocaleString() : "—"}</td>}
      {showPast && (
        <td className="nums px-2 py-2.5 text-right text-muted">
          {metric.varianceSincePast != null ? `${metric.varianceSincePast >= 0 ? "+" : ""}${metric.varianceSincePast.toLocaleString()}` : "—"}
        </td>
      )}
      <td className="nums px-2 py-2.5 text-right font-semibold text-ink">{metric.pctOfTarget != null ? `${metric.pctOfTarget}%` : "—"}</td>
      <td className="px-2 py-2.5 text-right"><DirectionBadge direction={metric.direction} /></td>
    </tr>
  );
}

function RegionTable({ title, rows, metric }: { title: string; rows: Array<{ region: string; members: PerformanceMetric; leaders: PerformanceMetric }>; metric: "members" | "leaders" }) {
  const { t } = useLang();
  return (
    <div className="card overflow-hidden p-0">
      <div className="px-5 pt-5">
        <h2 className="font-display text-base font-bold text-ink">{title}</h2>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-5 py-2.5">{t("regionColLabel")}</th>
              <th className="px-2 py-2.5 text-right">{t("currentValueLabel")}</th>
              <th className="px-2 py-2.5 text-right">%</th>
              <th className="px-5 py-2.5 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => {
              const m = r[metric];
              return (
                <tr key={r.region}>
                  <td className="px-5 py-2.5 font-medium text-ink">{r.region}</td>
                  <td className="nums px-2 py-2.5 text-right text-ink">{m.current.toLocaleString()}</td>
                  <td className="nums px-2 py-2.5 text-right font-semibold text-ink">{m.pctOfTarget != null ? `${m.pctOfTarget}%` : "—"}</td>
                  <td className="px-5 py-2.5 text-right"><DirectionBadge direction={m.direction} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Target-vs-actual comparison, with an accurate historical comparison point
 * for members and media reach (reconstructed from real timestamped records —
 * registration dates, metric snapshots), and an honest current-only view for
 * leaders (no historical tracking exists for when someone became a leader). */
export function PerformanceReportView({ organizationId, onConfigureTargets }: { organizationId: string; onConfigureTargets: () => void }) {
  const { t } = useLang();
  const [monthsBack, setMonthsBack] = useState<string>("3");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const isCustom = monthsBack === "custom";
  const customReady = isCustom && customStart && customEnd;

  const { data } = useQuery({
    queryKey: ["performance-report", organizationId, monthsBack, customStart, customEnd],
    queryFn: () => {
      const params = isCustom
        ? `?startDate=${customStart}&endDate=${customEnd}`
        : monthsBack === "start"
          ? ""
          : `?monthsBack=${monthsBack}`;
      return api.get<PerformanceReport>(`/api/v1/organizations/${organizationId}/analytics/performance-report${params}`);
    },
    enabled: !isCustom || Boolean(customReady),
  });

  function onPrint() {
    window.print();
  }

  if (!data) return <p className="card text-muted">{isCustom ? t("selectDateRangeHint") : t("loadingCampaignsLabel")}</p>;

  return (
    <div className="space-y-6">
      <div className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted">{t("overallDirectionLabel")}</p>
          <div className="mt-1"><DirectionBadge direction={data.overallDirection} /></div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label">{t("compareWithLabel")}</label>
            <select className="input" value={monthsBack} onChange={(e) => setMonthsBack(e.target.value)}>
              <option value="1">{t("compare1MonthLabel")}</option>
              <option value="3">{t("compare3MonthsLabel")}</option>
              <option value="6">{t("compare6MonthsLabel")}</option>
              <option value="12">{t("compare12MonthsLabel")}</option>
              <option value="start">{t("compareSinceStartLabel")}</option>
              <option value="custom">{t("compareCustomRangeLabel")}</option>
            </select>
          </div>
          {isCustom && (
            <>
              <div>
                <label className="label">{t("startDateLabel")}</label>
                <input type="date" className="input" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
              </div>
              <div>
                <label className="label">{t("endDateLabel")}</label>
                <input type="date" className="input" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
              </div>
            </>
          )}
          <button type="button" onClick={onConfigureTargets} className="btn-secondary no-print" title={t("configureTargetsOptionLabel")}>
            <Settings2 size={14} /> {t("configureTargetsOptionLabel")}
          </button>
          <button type="button" onClick={onPrint} className="btn-secondary no-print" title={t("printReportCta")}>
            <Printer size={14} /> {t("printReportCta")}
          </button>
        </div>
      </div>

      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2.5"></th>
                <th className="px-2 py-2.5 text-right">{t("currentValueLabel")}</th>
                <th className="px-2 py-2.5 text-right">{t("pastValueLabel")}</th>
                <th className="px-2 py-2.5 text-right">{t("varianceSinceLabel")}</th>
                <th className="px-2 py-2.5 text-right">%</th>
                <th className="px-2 py-2.5 text-right"></th>
              </tr>
            </thead>
            <tbody className="px-4">
              <MetricRow label={t("statTotalMembers")} metric={data.members} showPast />
              <MetricRow label={t("totalReachLabel")} metric={data.mediaReach} showPast />
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <p className="text-xs text-muted">{t("leadersNoHistoryHint")}</p>
        <table className="mt-2 w-full text-sm">
          <tbody>
            <MetricRow label={t("statTotalLeaders")} metric={data.leaders} showPast={false} />
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RegionTable title={t("membersByRegion")} rows={data.byRegion} metric="members" />
        <RegionTable title={t("leadersByRegion")} rows={data.byRegion} metric="leaders" />
      </div>
    </div>
  );
}
