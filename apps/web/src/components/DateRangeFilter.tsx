"use client";

import { useMemo, useState } from "react";
import { Bookmark, BookmarkPlus, Save, Trash2 } from "lucide-react";
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

/** The exact dates a range-scoped stat tile covers, e.g. "Sep 11 – Sep 18" — shown next to
 * numbers like "Total Posts" so it's never ambiguous whether a figure is all-time (an unfiltered
 * list page's own total) or scoped to whatever range is currently selected above it. */
export function formatRangeLabel(range: { from: string; to: string }): string {
  const from = new Date(range.from);
  const to = new Date(range.to);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${from.toLocaleDateString(undefined, opts)} – ${to.toLocaleDateString(undefined, opts)}`;
}

/** Weekly = rolling last 7 days, monthly = rolling last 30 days — both end "now" so the
 * dashboard reads live rather than snapping to a fixed calendar week/month boundary. */
export function useDateRangeFilter(defaultPreset: DateRangePreset = "weekly") {
  const [preset, setPreset] = useState<DateRangePreset>(defaultPreset);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [selectedViewId, setSelectedViewId] = useState("");

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
    setSelectedViewId(view.id);
  }

  return { preset, setPreset, customFrom, setCustomFrom, customTo, setCustomTo, range, applySavedView, selectedViewId, setSelectedViewId };
}

export function DateRangeFilterControl(props: ReturnType<typeof useDateRangeFilter> & { organizationId: string }) {
  const { t } = useLang();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const { organizationId, preset, setPreset, customFrom, setCustomFrom, customTo, setCustomTo, applySavedView, selectedViewId, setSelectedViewId } = props;
  const [saving, setSaving] = useState(false);

  const { data: savedViews } = useQuery({
    queryKey: ["dashboard-saved-views", organizationId],
    queryFn: () => api.get<DashboardSavedView[]>(`/api/v1/organizations/${organizationId}/dashboard-saved-views`),
  });

  const selectedView = savedViews?.find((v) => v.id === selectedViewId) ?? null;
  const isDirty = Boolean(selectedView && (customFrom !== selectedView.fromDate.slice(0, 10) || customTo !== selectedView.toDate.slice(0, 10)));

  function onPresetChange(next: DateRangePreset) {
    setPreset(next);
    setSelectedViewId("");
  }

  function onSelectSavedView(id: string) {
    if (!id) { setSelectedViewId(""); return; }
    const view = savedViews?.find((v) => v.id === id);
    if (view) applySavedView(view);
  }

  async function onSaveOrUpdate() {
    if (!customFrom || !customTo) return;
    setSaving(true);
    try {
      if (selectedView && isDirty) {
        await api.patch(`/api/v1/organizations/${organizationId}/dashboard-saved-views/${selectedView.id}`, { from: customFrom, to: customTo });
        showToast("success", t("viewUpdated"));
      } else {
        const name = window.prompt(t("saveViewNamePrompt"));
        if (!name || !name.trim()) return;
        const created = await api.post<DashboardSavedView>(`/api/v1/organizations/${organizationId}/dashboard-saved-views`, { name, from: customFrom, to: customTo });
        setSelectedViewId(created.id);
        showToast("success", t("viewSaved"));
      }
      queryClient.invalidateQueries({ queryKey: ["dashboard-saved-views", organizationId] });
    } catch (err) {
      showToast("error", err instanceof ApiError ? err.message : t("viewSaveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function onDeleteSelectedView() {
    if (!selectedView || !confirm(`${t("deleteCta")} "${selectedView.name}"?`)) return;
    try {
      await api.delete(`/api/v1/organizations/${organizationId}/dashboard-saved-views/${selectedView.id}`);
      setSelectedViewId("");
      queryClient.invalidateQueries({ queryKey: ["dashboard-saved-views", organizationId] });
    } catch (err) {
      showToast("error", err instanceof ApiError ? err.message : t("viewDeleteFailed"));
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line/60 bg-card px-3 py-2 shadow-card">
      <div className="flex flex-wrap items-center gap-2">
        <select className="input-auto" value={preset} onChange={(e) => onPresetChange(e.target.value as DateRangePreset)}>
          <option value="weekly">{t("dateRangeWeekly")}</option>
          <option value="monthly">{t("dateRangeMonthly")}</option>
          <option value="custom">{t("dateRangeCustom")}</option>
        </select>
        {preset === "custom" && (
          <>
            <input type="date" className="input-auto" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            <span className="text-xs text-muted">{t("dateRangeToLabel")}</span>
            <input type="date" className="input-auto" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
            <button
              type="button"
              title={isDirty ? t("saveChangesCta") : t("saveViewCta")}
              onClick={onSaveOrUpdate}
              disabled={!customFrom || !customTo || saving}
              className="btn-secondary px-2.5 py-1.5 text-xs disabled:opacity-40"
            >
              {isDirty ? <Save size={14} /> : <BookmarkPlus size={14} />}
              {isDirty ? t("saveChangesCta") : t("saveViewCta")}
            </button>
          </>
        )}
      </div>

      {savedViews != null && savedViews.length > 0 && (
        <div className="flex items-center gap-1.5 border-l border-line/60 pl-3">
          <Bookmark size={14} className="shrink-0 text-muted" />
          <select className="input-auto" value={selectedViewId} onChange={(e) => onSelectSavedView(e.target.value)}>
            <option value="">{t("savedViewsLabel")}</option>
            {savedViews.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
          {selectedViewId && (
            <button type="button" title={t("deleteCta")} onClick={onDeleteSelectedView} className="rounded-md p-1 text-muted transition hover:bg-brand-100 hover:text-brand">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
