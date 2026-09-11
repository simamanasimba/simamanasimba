"use client";

import { useMemo, useState } from "react";
import { Bookmark, BookmarkPlus, Trash2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { useLang } from "@/lib/i18n";
import type { DashboardSavedView } from "@/lib/types";

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

  /** Jump straight to a saved view's exact dates — same "YYYY-MM-DD, interpreted as local
   * midnight" path as typing them in, just fed from fromDate/toDate's UTC-midnight-anchored
   * date part instead (see DateRangeFilterControl's save handler for why that round-trips). */
  function applySavedView(view: DashboardSavedView) {
    setCustomFrom(view.fromDate.slice(0, 10));
    setCustomTo(view.toDate.slice(0, 10));
    setPreset("custom");
  }

  return { preset, setPreset, customFrom, setCustomFrom, customTo, setCustomTo, range, applySavedView };
}

export function DateRangeFilterControl(props: ReturnType<typeof useDateRangeFilter> & { organizationId: string }) {
  const { t } = useLang();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const { organizationId, preset, setPreset, customFrom, setCustomFrom, customTo, setCustomTo, applySavedView } = props;
  const [selectedViewId, setSelectedViewId] = useState("");

  const { data: savedViews } = useQuery({
    queryKey: ["dashboard-saved-views", organizationId],
    queryFn: () => api.get<DashboardSavedView[]>(`/api/v1/organizations/${organizationId}/dashboard-saved-views`),
  });

  function onPresetChange(next: DateRangePreset) {
    setPreset(next);
    setSelectedViewId("");
  }

  function onSelectSavedView(id: string) {
    setSelectedViewId(id);
    const view = savedViews?.find((v) => v.id === id);
    if (view) applySavedView(view);
  }

  async function onSaveView() {
    if (!customFrom || !customTo) return;
    const name = window.prompt(t("saveViewNamePrompt"));
    if (!name || !name.trim()) return;
    try {
      await api.post(`/api/v1/organizations/${organizationId}/dashboard-saved-views`, { name, from: customFrom, to: customTo });
      queryClient.invalidateQueries({ queryKey: ["dashboard-saved-views", organizationId] });
      showToast("success", t("viewSaved"));
    } catch (err) {
      showToast("error", err instanceof ApiError ? err.message : t("viewSaveFailed"));
    }
  }

  async function onDeleteSelectedView() {
    if (!selectedViewId) return;
    const view = savedViews?.find((v) => v.id === selectedViewId);
    if (!view || !confirm(`${t("deleteCta")} "${view.name}"?`)) return;
    try {
      await api.delete(`/api/v1/organizations/${organizationId}/dashboard-saved-views/${selectedViewId}`);
      setSelectedViewId("");
      queryClient.invalidateQueries({ queryKey: ["dashboard-saved-views", organizationId] });
    } catch (err) {
      showToast("error", err instanceof ApiError ? err.message : t("viewDeleteFailed"));
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select className="input-auto" value={preset} onChange={(e) => onPresetChange(e.target.value as DateRangePreset)}>
        <option value="weekly">{t("dateRangeWeekly")}</option>
        <option value="monthly">{t("dateRangeMonthly")}</option>
        <option value="custom">{t("dateRangeCustom")}</option>
      </select>

      {preset === "custom" && (
        <>
          <input type="date" className="input-auto" value={customFrom} onChange={(e) => { setCustomFrom(e.target.value); setSelectedViewId(""); }} />
          <span className="text-xs text-muted">{t("dateRangeToLabel")}</span>
          <input type="date" className="input-auto" value={customTo} onChange={(e) => { setCustomTo(e.target.value); setSelectedViewId(""); }} />
          <button
            type="button"
            title={t("saveViewCta")}
            onClick={onSaveView}
            disabled={!customFrom || !customTo}
            className="btn-secondary px-2.5 py-1.5 text-xs disabled:opacity-40"
          >
            <BookmarkPlus size={14} /> {t("saveViewCta")}
          </button>
        </>
      )}

      {savedViews != null && savedViews.length > 0 && (
        <div className="flex items-center gap-1">
          <Bookmark size={14} className="text-muted" />
          <select className="input-auto" value={selectedViewId} onChange={(e) => onSelectSavedView(e.target.value)}>
            <option value="">{t("savedViewsLabel")}</option>
            {savedViews.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
          {selectedViewId && (
            <button type="button" title={t("deleteCta")} onClick={onDeleteSelectedView} className="text-muted hover:text-brand">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
