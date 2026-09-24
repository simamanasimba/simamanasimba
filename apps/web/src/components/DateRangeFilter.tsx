"use client";

import { useEffect, useMemo, useState } from "react";
import { Bookmark, BookmarkPlus, Save, Copy, Trash2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { useLang } from "@/lib/i18n";
import type { DashboardSavedView, PostingWeekDefinition } from "@/lib/types";

export type DateRangePreset = "weekly" | "monthly" | "allTime" | "custom";

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

// Well before this app's own earliest possible record — used as "from" for the "All time" preset
// so it always covers everything without needing to ask the server what the real earliest date is.
const EPOCH = "2000-01-01T00:00:00.000Z";

/** The exact dates a range-scoped stat tile covers, e.g. "Sep 11 – Sep 18" — shown next to
 * numbers like "Total Posts" so it's never ambiguous whether a figure is all-time (an unfiltered
 * list page's own total) or scoped to whatever range is currently selected above it. Special-cases
 * the "All time" preset's EPOCH sentinel so that reads as "All time" instead of a literal (and
 * misleading-looking) date back in year 2000. */
export function formatRangeLabel(range: { from: string; to: string }, allTimeLabel?: string): string {
  if (range.from === EPOCH && allTimeLabel) return allTimeLabel;
  const from = new Date(range.from);
  const to = new Date(range.to);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${from.toLocaleDateString(undefined, opts)} – ${to.toLocaleDateString(undefined, opts)}`;
}

/** "Weekly" isn't a rolling 7 days — it's a pick from the org's own centrally-defined Campaign
 * Weeks (set up once under Settings), same ones the media/influencer Campaigns tables break down
 * by. Monthly = rolling last 30 days, ending "now" so the dashboard reads live rather than
 * snapping to a fixed calendar boundary. `organizationId` is optional purely so existing call
 * sites that genuinely have none in scope don't break — without it, "weekly" falls back to the
 * old rolling-7-days behavior since there's nothing to fetch weeks with. */
export function useDateRangeFilter(defaultPreset: DateRangePreset = "weekly", organizationId?: string) {
  const [preset, setPreset] = useState<DateRangePreset>(defaultPreset);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [selectedViewId, setSelectedViewId] = useState("");
  const [weekDefinitionId, setWeekDefinitionId] = useState("");

  const { data: weekDefinitionsRaw } = useQuery({
    queryKey: ["posting-week-definitions", organizationId],
    queryFn: () => api.get<PostingWeekDefinition[]>(`/api/v1/organizations/${organizationId}/posting-week-definitions`),
    enabled: Boolean(organizationId),
  });
  const weekDefinitions = useMemo(
    () => [...(weekDefinitionsRaw ?? [])].sort((a, b) => a.startDate.localeCompare(b.startDate)),
    [weekDefinitionsRaw],
  );
  const selectedWeek = weekDefinitions.find((w) => w.id === weekDefinitionId) ?? null;

  // Landing on "weekly" with nothing picked yet defaults to the earliest defined week (Week 01),
  // not an empty "Select a week…" placeholder.
  useEffect(() => {
    if (preset === "weekly" && !weekDefinitionId && weekDefinitions.length > 0) {
      setWeekDefinitionId(weekDefinitions[0].id);
    }
  }, [preset, weekDefinitionId, weekDefinitions]);

  const range = useMemo(() => {
    const to = new Date().toISOString();
    if (preset === "weekly") {
      if (selectedWeek) return { from: selectedWeek.startDate, to: selectedWeek.endDate };
      return { from: isoDaysAgo(7), to };
    }
    if (preset === "monthly") return { from: isoDaysAgo(30), to };
    if (preset === "allTime") return { from: EPOCH, to };
    return {
      from: customFrom ? new Date(`${customFrom}T00:00:00`).toISOString() : isoDaysAgo(7),
      to: customTo ? new Date(`${customTo}T23:59:59`).toISOString() : to,
    };
  }, [preset, customFrom, customTo, selectedWeek]);

  /** Jump straight to a saved view's exact dates — same "YYYY-MM-DD, interpreted as local
   * midnight" path as typing them in, just fed from fromDate/toDate's UTC-midnight-anchored
   * date part instead (see DateRangeFilterControl's save handler for why that round-trips). */
  function applySavedView(view: DashboardSavedView) {
    setCustomFrom(view.fromDate.slice(0, 10));
    setCustomTo(view.toDate.slice(0, 10));
    setPreset("custom");
    setSelectedViewId(view.id);
  }

  return {
    preset,
    setPreset,
    customFrom,
    setCustomFrom,
    customTo,
    setCustomTo,
    range,
    applySavedView,
    selectedViewId,
    setSelectedViewId,
    weekDefinitions,
    weekDefinitionId,
    setWeekDefinitionId,
  };
}

export function DateRangeFilterControl(props: ReturnType<typeof useDateRangeFilter> & { organizationId: string }) {
  const { t } = useLang();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const {
    organizationId,
    preset,
    setPreset,
    customFrom,
    setCustomFrom,
    customTo,
    setCustomTo,
    applySavedView,
    selectedViewId,
    setSelectedViewId,
    weekDefinitions,
    weekDefinitionId,
    setWeekDefinitionId,
  } = props;
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

  /** Overwrites the currently-selected view's dates in place. */
  async function onUpdateExisting() {
    if (!customFrom || !customTo || !selectedView) return;
    setSaving(true);
    try {
      await api.patch(`/api/v1/organizations/${organizationId}/dashboard-saved-views/${selectedView.id}`, { from: customFrom, to: customTo });
      showToast("success", t("viewUpdated"));
      queryClient.invalidateQueries({ queryKey: ["dashboard-saved-views", organizationId] });
    } catch (err) {
      showToast("error", err instanceof ApiError ? err.message : t("viewSaveFailed"));
    } finally {
      setSaving(false);
    }
  }

  /** Creates a brand-new view from the current dates — used both when nothing is selected yet, and
   * (per explicit request) as an alternative to overwriting an already-selected view when its dates
   * changed, so editing a saved view's dates doesn't force a choice between losing the original or
   * silently overwriting it. */
  async function onSaveAsNew() {
    if (!customFrom || !customTo) return;
    const name = window.prompt(t("saveViewNamePrompt"));
    if (!name || !name.trim()) return;
    setSaving(true);
    try {
      const created = await api.post<DashboardSavedView>(`/api/v1/organizations/${organizationId}/dashboard-saved-views`, { name, from: customFrom, to: customTo });
      setSelectedViewId(created.id);
      showToast("success", t("viewSaved"));
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
          <option value="allTime">{t("dateRangeAllTime")}</option>
          <option value="custom">{t("dateRangeCustom")}</option>
        </select>
        {preset === "weekly" && (
          <select className="input-auto" value={weekDefinitionId} onChange={(e) => setWeekDefinitionId(e.target.value)}>
            <option value="">{t("selectWeekPlaceholder")}</option>
            {weekDefinitions.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        )}
        {preset === "custom" && (
          <>
            <input type="date" className="input-auto" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            <span className="text-xs text-muted">{t("dateRangeToLabel")}</span>
            <input type="date" className="input-auto" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
            {isDirty ? (
              <>
                <button
                  type="button"
                  title={t("saveChangesCta")}
                  onClick={onUpdateExisting}
                  disabled={!customFrom || !customTo || saving}
                  className="btn-secondary px-2.5 py-1.5 text-xs disabled:opacity-40"
                >
                  <Save size={14} /> {t("saveChangesCta")}
                </button>
                <button
                  type="button"
                  title={t("saveAsNewViewCta")}
                  onClick={onSaveAsNew}
                  disabled={!customFrom || !customTo || saving}
                  className="btn-secondary px-2.5 py-1.5 text-xs disabled:opacity-40"
                >
                  <Copy size={14} /> {t("saveAsNewViewCta")}
                </button>
              </>
            ) : (
              <button
                type="button"
                title={t("saveViewCta")}
                onClick={onSaveAsNew}
                disabled={!customFrom || !customTo || saving}
                className="btn-secondary px-2.5 py-1.5 text-xs disabled:opacity-40"
              >
                <BookmarkPlus size={14} /> {t("saveViewCta")}
              </button>
            )}
          </>
        )}
      </div>

      {preset === "custom" && savedViews != null && savedViews.length > 0 && (
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
