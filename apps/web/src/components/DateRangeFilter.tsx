"use client";

import { useMemo, useState } from "react";
import { useLang } from "@/lib/i18n";

export type DateRangePreset = "weekly" | "monthly" | "custom";

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

/** Weekly = rolling last 7 days, monthly = rolling last 30 days — both end "now" so the
 * dashboard reads live rather than snapping to a fixed calendar week/month boundary. */
export function useDateRangeFilter(defaultPreset: DateRangePreset = "weekly") {
  const [preset, setPreset] = useState<DateRangePreset>(defaultPreset);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const range = useMemo(() => {
    const to = new Date().toISOString();
    if (preset === "weekly") return { from: isoDaysAgo(7), to };
    if (preset === "monthly") return { from: isoDaysAgo(30), to };
    return {
      from: customFrom ? new Date(`${customFrom}T00:00:00`).toISOString() : isoDaysAgo(7),
      to: customTo ? new Date(`${customTo}T23:59:59`).toISOString() : to,
    };
  }, [preset, customFrom, customTo]);

  return { preset, setPreset, customFrom, setCustomFrom, customTo, setCustomTo, range };
}

export function DateRangeFilterControl(props: ReturnType<typeof useDateRangeFilter>) {
  const { t } = useLang();
  const { preset, setPreset, customFrom, setCustomFrom, customTo, setCustomTo } = props;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select className="input-auto" value={preset} onChange={(e) => setPreset(e.target.value as DateRangePreset)}>
        <option value="weekly">{t("dateRangeWeekly")}</option>
        <option value="monthly">{t("dateRangeMonthly")}</option>
        <option value="custom">{t("dateRangeCustom")}</option>
      </select>
      {preset === "custom" && (
        <>
          <input type="date" className="input-auto" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
          <span className="text-xs text-muted">{t("dateRangeToLabel")}</span>
          <input type="date" className="input-auto" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
        </>
      )}
    </div>
  );
}
