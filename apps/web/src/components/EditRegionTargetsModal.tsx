"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Modal } from "@/components/Modal";
import { TableSearchInput } from "@/components/TableSearchInput";
import { useLang } from "@/lib/i18n";
import { listRegions } from "@/lib/tanzania";
import type { RegionTarget } from "@/lib/types";

interface RowState {
  memberTarget: string;
  leaderTarget: string;
}

export function EditRegionTargetsModal({
  organizationId,
  regions: observedRegions,
  targets,
  onClose,
  onDone,
}: {
  organizationId: string;
  regions: string[];
  targets: RegionTarget[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useLang();
  const regions = Array.from(new Set([...listRegions(), ...observedRegions])).sort((a, b) => a.localeCompare(b));
  const targetByRegion = new Map(targets.map((t) => [t.region, t]));

  const [rows, setRows] = useState<Record<string, RowState>>(() =>
    Object.fromEntries(
      regions.map((region) => {
        const existing = targetByRegion.get(region);
        return [region, { memberTarget: existing?.memberTarget?.toString() ?? "", leaderTarget: existing?.leaderTarget?.toString() ?? "" }];
      }),
    ),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();
  const filteredRegions = q ? regions.filter((region) => region.toLowerCase().includes(q)) : regions;

  function setRow(region: string, key: keyof RowState, value: string) {
    setRows((r) => ({ ...r, [region]: { ...r[region], [key]: value } }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/api/v1/organizations/${organizationId}/region-targets`, {
        targets: regions.map((region) => ({
          region,
          memberTarget: rows[region].memberTarget ? Number(rows[region].memberTarget) : null,
          leaderTarget: rows[region].leaderTarget ? Number(rows[region].leaderTarget) : null,
        })),
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("failedUpdateTargets"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={t("editTargetsTitle")} onClose={onClose} wide>
      <form onSubmit={onSubmit} className="space-y-3">
        <p className="text-xs text-muted">{t("editTargetsHelp")}</p>
        <TableSearchInput value={search} onChange={setSearch} placeholder={t("searchGenericPlaceholder")} />
        <div className="max-h-[60vh] overflow-y-auto rounded-xl border border-line">
          {filteredRegions.length === 0 && q ? (
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
                        className="input-auto w-28"
                        value={rows[region].memberTarget}
                        onChange={(e) => setRow(region, "memberTarget", e.target.value)}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        min="0"
                        className="input-auto w-28"
                        value={rows[region].leaderTarget}
                        onChange={(e) => setRow(region, "leaderTarget", e.target.value)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {error && <p className="text-sm text-brand">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-line pt-3">
          <button type="button" onClick={onClose} className="btn-secondary">{t("cancel")}</button>
          <button type="submit" disabled={submitting} className="btn-primary">{submitting ? t("saving") : t("saveTargets")}</button>
        </div>
      </form>
    </Modal>
  );
}
