"use client";

import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pencil, Trash2, Smile } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { Influencer2SentimentEditor } from "@/components/Influencer2SentimentEditor";
import type { Influencer2ContentType, Influencer2MetricCategory, Influencer2Platform, Influencer2PlatformSummary } from "@/lib/types";

function metricEntry(platform: Influencer2PlatformSummary, category: Influencer2MetricCategory) {
  return platform.metrics.find((m) => m.category === category) ?? null;
}

const fmt = (v: number | null) => (v == null ? "—" : v.toLocaleString());

/** A single click-to-edit number cell — shows the current value (or a
 * clickable "—" placeholder when nothing's been entered yet), swaps to an
 * input on click, saves on blur/Enter. No modal, per explicit request. */
function InlineMetricCell({ value, onSave }: { value: number | null; onSave: (value: number) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value != null ? String(value) : "");
  const [saving, setSaving] = useState(false);

  async function commit() {
    setEditing(false);
    if (draft === "" || Number(draft) === value) return;
    setSaving(true);
    try {
      await onSave(Number(draft));
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        min="0"
        className="input nums !w-24 !py-1 text-right"
        value={draft}
        disabled={saving}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") { setDraft(value != null ? String(value) : ""); setEditing(false); }
        }}
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => { setDraft(value != null ? String(value) : ""); setEditing(true); }}
      className="nums w-full rounded px-1.5 py-0.5 text-right text-muted hover:bg-brand-50 hover:text-ink"
    >
      {fmt(value)}
    </button>
  );
}

/** Adapts its columns to whichever categories are actually present (or
 * available for the campaign's content type) across the selected platforms —
 * a platform missing Shares (e.g. Instagram) just shows a non-editable "—".
 * Every value cell is inline-editable; no separate "enter metrics" modal.
 * Comment sentiment is hidden by default — clicking the Sentiment icon on a
 * platform's row expands that ONE platform's actual current distribution
 * (and lets you edit it) right there, rather than always showing every
 * platform's split (or a combined "all platforms" figure) up front. */
export function Influencer2PlatformBreakdownTable({
  organizationId,
  campaignId,
  contentType,
  platforms,
  onMetricsChanged,
  onEditPlatform,
  onRemovePlatform,
}: {
  organizationId: string;
  campaignId: string;
  contentType: Influencer2ContentType;
  platforms: Influencer2PlatformSummary[];
  onMetricsChanged: () => void;
  onEditPlatform?: (platform: Influencer2PlatformSummary) => void;
  onRemovePlatform?: (platform: Influencer2PlatformSummary) => void;
}) {
  const { t } = useLang();
  const [expandedSentimentFor, setExpandedSentimentFor] = useState<string | null>(null);
  const showActions = Boolean(onEditPlatform || onRemovePlatform);

  const { data: catalog } = useQuery({
    queryKey: ["influencer2-platforms", organizationId, contentType],
    queryFn: () => api.get<Influencer2Platform[]>(`/api/v1/organizations/${organizationId}/influencer2/platforms?contentType=${contentType}`),
  });

  function definitionFor(platformId: string, category: Influencer2MetricCategory) {
    const platform = (catalog ?? []).find((p) => p.id === platformId);
    return platform?.metricDefinitions.find((d) => d.category === category) ?? null;
  }

  function sentimentDefinitionIds(platformId: string) {
    const defs = (catalog ?? []).find((p) => p.id === platformId)?.metricDefinitions ?? [];
    const positive = defs.find((d) => d.key === "comments_positive");
    const negative = defs.find((d) => d.key === "comments_negative");
    const neutral = defs.find((d) => d.key === "comments_neutral");
    if (!positive || !negative || !neutral) return null;
    return { positive: positive.id, negative: negative.id, neutral: neutral.id };
  }

  const hasCategory = (category: Influencer2MetricCategory) =>
    platforms.some((p) => metricEntry(p, category) || definitionFor(p.platformId, category));
  const showViews = hasCategory("VIEWS");
  const showLikes = hasCategory("LIKES");
  const showComments = hasCategory("COMMENTS");
  const showShares = hasCategory("SHARES");
  const showOther = hasCategory("OTHER");
  const columnCount = 2 + [showViews, showLikes, showComments, showShares, showOther].filter(Boolean).length + 1 + (showActions ? 1 : 0);

  async function saveMetric(campaignPlatformId: string, metricDefinitionId: string, value: number) {
    try {
      await api.post(`/api/v1/organizations/${organizationId}/influencer2/campaigns/${campaignId}/platforms/${campaignPlatformId}/metrics`, {
        metrics: [{ metricDefinitionId, value }],
      });
      onMetricsChanged();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to save");
    }
  }

  function renderCell(p: Influencer2PlatformSummary, category: Influencer2MetricCategory) {
    const entry = metricEntry(p, category);
    const definition = definitionFor(p.platformId, category);
    if (!entry && !definition) return <td className="nums px-5 py-2.5 text-right text-muted">—</td>;
    const definitionId = entry?.metricDefinitionId ?? definition?.id;
    if (!definitionId) return <td className="nums px-5 py-2.5 text-right text-muted">—</td>;
    return (
      <td className="px-5 py-1.5 text-right">
        <InlineMetricCell value={entry?.value ?? null} onSave={(value) => saveMetric(p.campaignPlatformId, definitionId, value)} />
      </td>
    );
  }

  return (
    <div className="card overflow-hidden p-0">
      <div className="px-5 pt-5">
        <h2 className="font-display text-base font-bold text-ink">{t("influencer2PlatformBreakdownTitle")}</h2>
        <p className="text-xs text-muted">{t("influencer2InlineEditHint")}</p>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-5 py-2.5">{t("influencer2FilterPlatform")}</th>
              <th className="px-5 py-2.5">{t("influencer2PublishedLabel")}</th>
              {showViews && <th className="px-5 py-2.5 text-right">{t("influencer2ViewsColLabel")}</th>}
              {showLikes && <th className="px-5 py-2.5 text-right">{t("influencer2TotalLikesLabel")}</th>}
              {showComments && <th className="px-5 py-2.5 text-right">{t("influencer2TotalCommentsLabel")}</th>}
              {showShares && <th className="px-5 py-2.5 text-right">{t("influencer2TotalSharesLabel")}</th>}
              {showOther && <th className="px-5 py-2.5 text-right">{t("influencer2OtherColLabel")}</th>}
              <th className="px-5 py-2.5 text-right">{t("influencer2TotalEngagementLabel")}</th>
              {showActions && <th className="px-5 py-2.5" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {platforms.map((p) => {
              const sentimentIds = sentimentDefinitionIds(p.platformId);
              const expanded = expandedSentimentFor === p.campaignPlatformId;
              return (
                <Fragment key={p.campaignPlatformId}>
                  <tr>
                    <td className="px-5 py-2.5 font-medium text-ink">
                      {p.postUrl ? <a href={p.postUrl} target="_blank" rel="noreferrer" className="text-brand hover:underline">{p.platformName}</a> : p.platformName}
                    </td>
                    <td className="px-5 py-2.5 text-muted">{p.publishedAt ? new Date(p.publishedAt).toLocaleDateString() : "—"}</td>
                    {showViews && renderCell(p, "VIEWS")}
                    {showLikes && renderCell(p, "LIKES")}
                    {showComments && renderCell(p, "COMMENTS")}
                    {showShares && renderCell(p, "SHARES")}
                    {showOther && renderCell(p, "OTHER")}
                    <td className="nums px-5 py-2.5 text-right font-semibold text-ink">{fmt(p.totalEngagement)}</td>
                    {showActions && (
                      <td className="px-5 py-2.5 text-right">
                        <div className="flex justify-end gap-2 whitespace-nowrap">
                          {sentimentIds && (
                            <button
                              type="button"
                              title={t("influencer2SentimentTitle")}
                              onClick={() => setExpandedSentimentFor(expanded ? null : p.campaignPlatformId)}
                              className={expanded ? "text-brand" : "text-muted hover:text-brand"}
                            >
                              <Smile size={14} />
                            </button>
                          )}
                          {onEditPlatform && (
                            <button type="button" title={t("edit")} onClick={() => onEditPlatform(p)} className="text-muted hover:text-brand"><Pencil size={14} /></button>
                          )}
                          {onRemovePlatform && (
                            <button type="button" title={t("influencer2RemovePlatformCta")} onClick={() => onRemovePlatform(p)} className="text-muted hover:text-brand"><Trash2 size={14} /></button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                  {expanded && sentimentIds && (
                    <tr>
                      <td colSpan={columnCount} className="bg-surface px-5 py-3">
                        <Influencer2SentimentEditor
                          organizationId={organizationId}
                          campaignId={campaignId}
                          campaignPlatformId={p.campaignPlatformId}
                          platformName={p.platformName}
                          definitionIds={sentimentIds}
                          initial={p.sentiment ?? { positive: null, negative: null, neutral: null }}
                          onSaved={onMetricsChanged}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
