"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Upload, Users } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Modal } from "@/components/Modal";
import { useLang } from "@/lib/i18n";
import type { PaginatedMembers } from "@/lib/types";

type Tab = "select" | "upload";

interface BulkResult {
  checkedIn: number;
  alreadyCheckedIn: number;
  notFound: number;
  emptyRows?: number;
}

/** Two ways to check in several members at once: pick them from a searchable multi-select list,
 * or upload a CSV of membership/campaign numbers (one per row) — same "manual vs. spreadsheet"
 * choice ImportMembersModal already offers for creating members, reused here for check-in. */
export function BulkCheckInModal({ organizationId, eventId, onClose, onDone }: { organizationId: string; eventId: string; onClose: () => void; onDone: () => void }) {
  const { t } = useLang();
  const [tab, setTab] = useState<Tab>("select");

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { data } = useQuery({
    queryKey: ["member-bulk-search", organizationId, search],
    queryFn: () => api.get<PaginatedMembers>(`/api/v1/organizations/${organizationId}/members?q=${encodeURIComponent(search)}&pageSize=100`),
  });
  const members = data?.items ?? [];

  const [file, setFile] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkResult | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submitSelect(e: React.FormEvent) {
    e.preventDefault();
    if (selected.size === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post<BulkResult>(`/api/v1/organizations/${organizationId}/events/${eventId}/attendance/admin-checkin-bulk`, {
        memberIds: Array.from(selected),
      });
      setResult(res);
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("bulkCheckInFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setSubmitting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/v1/organizations/${organizationId}/events/${eventId}/attendance/admin-checkin-import`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? t("bulkCheckInFailed"));
      }
      const data = (await res.json()) as BulkResult;
      setResult(data);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("bulkCheckInFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={t("bulkCheckInTitle")} onClose={onClose} wide>
      {result ? (
        <div className="space-y-3">
          <p className="text-sm text-ink">
            {t("bulkCheckedInPrefix")} <span className="font-semibold text-success">{result.checkedIn}</span>
            {result.alreadyCheckedIn > 0 && (
              <>
                {" · "}
                {t("bulkAlreadyCheckedInPrefix")} <span className="font-semibold text-muted">{result.alreadyCheckedIn}</span>
              </>
            )}
            {result.notFound > 0 && (
              <>
                {" · "}
                {t("bulkNotFoundPrefix")} <span className="font-semibold text-brand">{result.notFound}</span>
              </>
            )}
          </p>
          <button onClick={onClose} className="btn-primary w-full">{t("doneBtn")}</button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex rounded-xl bg-surface p-1">
            <button
              type="button"
              onClick={() => setTab("select")}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition ${tab === "select" ? "bg-white text-brand-700 shadow-sm" : "text-muted"}`}
            >
              <Users size={14} /> {t("selectMembersTab")}
            </button>
            <button
              type="button"
              onClick={() => setTab("upload")}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition ${tab === "upload" ? "bg-white text-brand-700 shadow-sm" : "text-muted"}`}
            >
              <Upload size={14} /> {t("uploadCsvTab")}
            </button>
          </div>

          {tab === "select" ? (
            <form onSubmit={submitSelect} className="space-y-3">
              <div className="relative">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input className="input pl-9" placeholder={t("searchPersonPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div className="max-h-72 overflow-y-auto rounded-xl border border-line">
                {members.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-muted">{t("noMembersFound")}</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {members.map((m) => (
                      <li key={m.id}>
                        <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm hover:bg-brand-50/40">
                          <input type="checkbox" checked={selected.has(m.id)} onChange={() => toggle(m.id)} />
                          <span className="flex-1 text-ink">{m.firstName} {m.lastName}</span>
                          <span className="font-mono text-xs text-muted">{m.membershipNumber ?? m.campaignId}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <p className="text-xs text-muted">{selected.size} {t("bulkSelectedSuffix")}</p>
              {error && <p className="text-sm text-brand">{error}</p>}
              <div className="flex justify-end gap-2 border-t border-line pt-3">
                <button type="button" onClick={onClose} className="btn-secondary">{t("cancel")}</button>
                <button type="submit" disabled={submitting || selected.size === 0} className="btn-primary">{submitting ? t("checkingInLabel") : t("checkInCta")}</button>
              </div>
            </form>
          ) : (
            <form onSubmit={submitUpload} className="space-y-4">
              <p className="text-sm text-muted">{t("bulkCsvHelp")}</p>
              <input type="file" accept=".csv" required onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="input" />
              {error && <p className="text-sm text-brand">{error}</p>}
              <div className="flex justify-end gap-2 border-t border-line pt-3">
                <button type="button" onClick={onClose} className="btn-secondary">{t("cancel")}</button>
                <button type="submit" disabled={submitting || !file} className="btn-primary">{submitting ? t("importingLabel") : t("import")}</button>
              </div>
            </form>
          )}
        </div>
      )}
    </Modal>
  );
}
