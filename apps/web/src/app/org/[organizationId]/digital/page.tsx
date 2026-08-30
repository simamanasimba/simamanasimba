"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { useLang } from "@/lib/i18n";

function formatDiscoveryResult(lang: string, found: number, dup: number) {
  return lang === "sw" ? `Imepata vipya ${found}, nakala ${dup} zimerukwa.` : `Found ${found} new item(s), ${dup} duplicate(s) skipped.`;
}

interface MonitoringRule {
  id: string;
  name: string;
  isActive: boolean;
  queries: Array<{ id: string; queryType: string; value: string }>;
}

interface Mention {
  id: string;
  sourceType: string;
  sourceProvider: string;
  sourceUrl: string;
  detectedAt: string;
  topic: string | null;
  priority: string;
  aiAnalyses: Array<{ analysisType: string; sentiment: string | null }>;
}

interface Alert {
  id: string;
  type: string;
  title: string;
  priority: string;
  status: string;
  createdAt: string;
}

export default function DigitalIntelligencePage() {
  const { t, lang } = useLang();
  const { organizationId } = useParams<{ organizationId: string }>();
  const queryClient = useQueryClient();
  const [newRuleName, setNewRuleName] = useState("");
  const [newKeyword, setNewKeyword] = useState("");
  const [runMessage, setRunMessage] = useState<string | null>(null);

  const { data: rules, refetch: refetchRules } = useQuery({
    queryKey: ["monitoring-rules", organizationId],
    queryFn: () => api.get<MonitoringRule[]>(`/api/v1/organizations/${organizationId}/monitoring/rules`),
  });

  const { data: mentions } = useQuery({
    queryKey: ["mentions", organizationId],
    queryFn: () => api.get<Mention[]>(`/api/v1/organizations/${organizationId}/mentions`),
  });

  const { data: alerts } = useQuery({
    queryKey: ["alerts-all", organizationId],
    queryFn: () => api.get<Alert[]>(`/api/v1/organizations/${organizationId}/alerts`),
  });

  async function createRule(e: React.FormEvent) {
    e.preventDefault();
    if (!newKeyword.trim()) return;
    await api.post(`/api/v1/organizations/${organizationId}/monitoring/rules`, {
      name: newRuleName || newKeyword,
      queries: [{ queryType: "KEYWORD", value: newKeyword }],
    });
    setNewRuleName("");
    setNewKeyword("");
    refetchRules();
  }

  async function runRule(ruleId: string) {
    setRunMessage(t("runningDiscovery"));
    try {
      const result = await api.post<{ created: number; duplicates: number; providersSkipped: Array<{ name: string; reason: string }> }>(
        `/api/v1/organizations/${organizationId}/monitoring/rules/${ruleId}/run`,
      );
      const skipped = result.providersSkipped.map((p) => `${p.name} (${p.reason})`).join(", ");
      const skippedSuffix = skipped ? (lang === "sw" ? ` Vilivyorukwa: ${skipped}` : ` Skipped: ${skipped}`) : "";
      setRunMessage(formatDiscoveryResult(lang, result.created, result.duplicates) + skippedSuffix);
      queryClient.invalidateQueries({ queryKey: ["mentions", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["alerts-all", organizationId] });
    } catch (err) {
      setRunMessage(err instanceof ApiError ? err.message : t("runFailed"));
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl text-ink">{t("digitalTitle")}</h1>

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{t("monitoringRulesTitle")}</h2>
        <form onSubmit={createRule} className="mb-4 flex flex-wrap gap-2">
          <input className="input flex-1" placeholder={t("ruleNamePlaceholder")} value={newRuleName} onChange={(e) => setNewRuleName(e.target.value)} />
          <input className="input flex-1" placeholder={t("keywordPlaceholder")} value={newKeyword} onChange={(e) => setNewKeyword(e.target.value)} />
          <button type="submit" className="btn-primary">{t("addRule")}</button>
        </form>
        {runMessage && <p className="mb-3 text-sm text-muted">{runMessage}</p>}
        <ul className="divide-y divide-line">
          {(rules ?? []).map((r) => (
            <li key={r.id} className="flex items-center justify-between py-2.5">
              <div>
                <p className="text-sm font-medium text-ink">{r.name}</p>
                <p className="text-xs text-muted">{r.queries.map((q) => q.value).join(", ")}</p>
              </div>
              <button onClick={() => runRule(r.id)} className="btn-secondary text-sm">{t("runDiscovery")}</button>
            </li>
          ))}
          {(!rules || rules.length === 0) && <p className="py-2 text-sm text-muted">{t("noRulesYet")}</p>}
        </ul>
      </div>

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{t("recentMentionsTitle")}</h2>
        {(!mentions || mentions.length === 0) ? (
          <p className="text-sm text-muted">{t("noMentionsYet")}</p>
        ) : (
          <ul className="max-h-96 divide-y divide-line overflow-y-auto">
            {mentions.map((m) => (
              <li key={m.id} className="py-2.5">
                <div className="flex items-center justify-between">
                  <a href={m.sourceUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-brand hover:underline">{m.sourceProvider}</a>
                  <span className="badge bg-surface text-muted">{m.aiAnalyses.find((a) => a.analysisType === "SENTIMENT")?.sentiment ?? t("unknownSentiment")}</span>
                </div>
                <p className="text-xs text-muted">{new Date(m.detectedAt).toLocaleString()} · {m.topic ?? t("uncategorized")}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{t("alertsTitle")}</h2>
        {(!alerts || alerts.length === 0) ? (
          <p className="text-sm text-muted">{t("noAlertsYet")}</p>
        ) : (
          <ul className="max-h-96 divide-y divide-line overflow-y-auto">
            {alerts.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-ink">{a.title}</span>
                <span className="badge bg-brand-light text-brand">{a.status}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
