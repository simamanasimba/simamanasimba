"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { TableSearchInput } from "@/components/TableSearchInput";
import { useLang } from "@/lib/i18n";
import { useAuth } from "@/hooks/useAuth";
import { isOrgAdmin } from "@/lib/permissions";
import { listRegions } from "@/lib/tanzania";
import type { RegionTarget } from "@/lib/types";

interface RegionCount {
  region: string;
  count: number;
}

/** One org-wide target field (member target / media reach target) — an inline,
 * uncontrolled form so it doesn't need to juggle re-syncing local state once
 * its query resolves. */
function OrgTargetField({
  organizationId,
  field,
  label,
  current,
  disabled,
  onSaved,
}: {
  organizationId: string;
  field: "memberTarget" | "mediaReachTarget";
  label: string;
  current: number | null | undefined;
  disabled: boolean;
  onSaved: () => void;
}) {
  const { t } = useLang();
  const { showToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const raw = inputRef.current?.value ?? "";
    setSubmitting(true);
    try {
      await api.patch(`/api/v1/organizations/${organizationId}`, { [field]: raw ? Number(raw) : null });
      showToast("success", t("targetSaved"));
      onSaved();
    } catch (err) {
      showToast("error", err instanceof ApiError ? err.message : t("failedUpdateTargets"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
      <div>
        <label className="label">{label}</label>
        <input
          ref={inputRef}
          key={current ?? "none"}
          type="number"
          min="0"
          disabled={disabled}
          defaultValue={current?.toString() ?? ""}
          className="input w-40"
        />
      </div>
      {!disabled && (
        <button type="submit" disabled={submitting} className="btn-primary">{submitting ? t("saving") : t("save")}</button>
      )}
    </form>
  );
}

export function ConfigureTargetsView({ organizationId, onBack }: { organizationId: string; onBack?: () => void }) {
  const { t } = useLang();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const { data: me } = useAuth();
  const myRole = me?.organizations.find((o) => o.organizationId === organizationId)?.role;
  const canEdit = isOrgAdmin(myRole);

  const { data: membership } = useQuery({
    queryKey: ["membership-summary", organizationId],
    queryFn: () => api.get<{ target: number | null }>(`/api/v1/organizations/${organizationId}/analytics/membership-summary`),
  });
  const { data: mediaReach } = useQuery({
    queryKey: ["media-reach", organizationId],
    queryFn: () => api.get<{ target: number | null }>(`/api/v1/organizations/${organizationId}/analytics/media-reach`),
  });
  const { data: byRegion } = useQuery({
    queryKey: ["analytics-region", organizationId],
    queryFn: () => api.get<RegionCount[]>(`/api/v1/organizations/${organizationId}/analytics/members/by-region`),
  });
  const { data: leadersByRegion } = useQuery({
    queryKey: ["analytics-region-leaders", organizationId],
    queryFn: () => api.get<RegionCount[]>(`/api/v1/organizations/${organizationId}/analytics/members/by-region/leaders`),
  });
  const { data: regionTargets, refetch: refetchRegionTargets } = useQuery({
    queryKey: ["region-targets", organizationId],
    queryFn: () => api.get<RegionTarget[]>(`/api/v1/organizations/${organizationId}/region-targets`),
  });

  const observedRegions = Array.from(new Set([...(byRegion ?? []), ...(leadersByRegion ?? [])].map((r) => r.region)));
  const regions = Array.from(new Set([...listRegions(), ...observedRegions])).sort((a, b) => a.localeCompare(b));

  const [rows, setRows] = useState<Record<string, { memberTarget: string; leaderTarget: string }>>({});
  useEffect(() => {
    if (regionTargets === undefined || byRegion === undefined || leadersByRegion === undefined) return;
    const targetByRegion = new Map(regionTargets.map((rt) => [rt.region, rt]));
    setRows(
      Object.fromEntries(
        regions.map((region) => {
          const existing = targetByRegion.get(region);
          return [region, { memberTarget: existing?.memberTarget?.toString() ?? "", leaderTarget: existing?.leaderTarget?.toString() ?? "" }];
        }),
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regionTargets, byRegion, leadersByRegion]);

  function setRow(region: string, key: "memberTarget" | "leaderTarget", value: string) {
    setRows((r) => ({ ...r, [region]: { ...r[region], [key]: value } }));
  }

  const [regionSearch, setRegionSearch] = useState("");
  const regionQuery = regionSearch.trim().toLowerCase();
  const filteredRegions = regionQuery ? regions.filter((region) => region.toLowerCase().includes(regionQuery)) : regions;

  const [savingRegions, setSavingRegions] = useState(false);
  async function saveRegionTargets() {
    setSavingRegions(true);
    try {
      await api.post(`/api/v1/organizations/${organizationId}/region-targets`, {
        targets: regions.map((region) => ({
          region,
          memberTarget: rows[region]?.memberTarget ? Number(rows[region].memberTarget) : null,
          leaderTarget: rows[region]?.leaderTarget ? Number(rows[region].leaderTarget) : null,
        })),
      });
      showToast("success", t("targetSaved"));
      refetchRegionTargets();
    } catch (err) {
      showToast("error", err instanceof ApiError ? err.message : t("failedUpdateTargets"));
    } finally {
      setSavingRegions(false);
    }
  }

  function refreshOrgTargets() {
    queryClient.invalidateQueries({ queryKey: ["membership-summary", organizationId] });
    queryClient.invalidateQueries({ queryKey: ["media-reach", organizationId] });
  }

  return (
    <div className="space-y-6">
      {onBack && (
        <button type="button" onClick={onBack} className="no-print inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-brand">
          <ArrowLeft size={15} /> {t("backToReportCta")}
        </button>
      )}

      {!canEdit && <p className="card text-sm text-muted">{t("targetsReadOnlyHint")}</p>}

      <div className="card space-y-4">
        <h2 className="font-display text-base font-bold text-ink">{t("orgWideTargetsTitle")}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <OrgTargetField
            organizationId={organizationId}
            field="memberTarget"
            label={t("memberTargetLabel")}
            current={membership?.target}
            disabled={!canEdit}
            onSaved={refreshOrgTargets}
          />
          <OrgTargetField
            organizationId={organizationId}
            field="mediaReachTarget"
            label={t("reachTargetLabel")}
            current={mediaReach?.target}
            disabled={!canEdit}
            onSaved={refreshOrgTargets}
          />
        </div>
      </div>

      <div className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-base font-bold text-ink">{t("editTargetsTitle")}</h2>
          <TableSearchInput value={regionSearch} onChange={setRegionSearch} placeholder={t("searchGenericPlaceholder")} />
        </div>
        <p className="text-xs text-muted">{t("editTargetsHelp")}</p>
        <div className="max-h-[60vh] overflow-y-auto rounded-xl border border-line">
          {filteredRegions.length === 0 && regionQuery ? (
            <p className="px-4 py-6 text-sm text-muted">{t("noSearchResults")}</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-2.5">{t("region")}</th>
                  <th className="px-4 py-2.5">{t("memberTargetLabel")}</th>
                  <th className="px-4 py-2.5">{t("leaderTargetLabel")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredRegions.map((region) => (
                  <tr key={region}>
                    <td className="px-4 py-2 font-medium text-ink">{region}</td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        min="0"
                        disabled={!canEdit}
                        className="input-auto w-28"
                        value={rows[region]?.memberTarget ?? ""}
                        onChange={(e) => setRow(region, "memberTarget", e.target.value)}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        min="0"
                        disabled={!canEdit}
                        className="input-auto w-28"
                        value={rows[region]?.leaderTarget ?? ""}
                        onChange={(e) => setRow(region, "leaderTarget", e.target.value)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {canEdit && (
          <div className="flex justify-end">
            <button type="button" disabled={savingRegions} onClick={saveRegionTargets} className="btn-primary">
              {savingRegions ? t("saving") : t("saveTargets")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
