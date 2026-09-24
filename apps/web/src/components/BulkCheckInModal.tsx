"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Upload, UserPlus, Users } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Modal } from "@/components/Modal";
import { LocationSelect, type LocationValue } from "@/components/LocationSelect";
import { useLang } from "@/lib/i18n";
import type { Member, PaginatedMembers } from "@/lib/types";

type Tab = "select" | "new" | "upload";

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

  const [newForm, setNewForm] = useState({ membershipNumber: "", firstName: "", lastName: "", phone: "", email: "" });
  const [newLocation, setNewLocation] = useState<LocationValue>({ region: "", district: "", ward: "" });
  const [newIsLeader, setNewIsLeader] = useState(false);
  const [addedNames, setAddedNames] = useState<string[]>([]);
  const [addingNew, setAddingNew] = useState(false);
  const [newError, setNewError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkResult | null>(null);

  function setNew<K extends keyof typeof newForm>(key: K, value: string) {
    setNewForm((f) => ({ ...f, [key]: value }));
  }

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

  /** Creates a brand-new member (full set of fields, matching NewMemberModal) and checks them in
   * immediately — kept as its own tab rather than folded into "select existing" so an admin can add
   * several walk-ins who aren't registered yet without leaving the check-in flow, one at a time. */
  async function addNewMember(e: React.FormEvent) {
    e.preventDefault();
    setAddingNew(true);
    setNewError(null);
    try {
      const member = await api.post<Member>(`/api/v1/organizations/${organizationId}/members`, {
        membershipNumber: newForm.membershipNumber || undefined,
        firstName: newForm.firstName,
        lastName: newForm.lastName,
        phone: newForm.phone || undefined,
        email: newForm.email || undefined,
        region: newLocation.region || undefined,
        district: newLocation.district || undefined,
        ward: newLocation.ward || undefined,
        isLeader: newIsLeader,
      });
      await api.post(`/api/v1/organizations/${organizationId}/events/${eventId}/attendance/admin-checkin`, { memberId: member.id });
      setAddedNames((prev) => [...prev, `${member.firstName} ${member.lastName}`]);
      setNewForm({ membershipNumber: "", firstName: "", lastName: "", phone: "", email: "" });
      setNewLocation({ region: "", district: "", ward: "" });
      setNewIsLeader(false);
      onDone();
    } catch (err) {
      setNewError(err instanceof ApiError ? err.message : t("bulkCheckInFailed"));
    } finally {
      setAddingNew(false);
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
              onClick={() => setTab("new")}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition ${tab === "new" ? "bg-white text-brand-700 shadow-sm" : "text-muted"}`}
            >
              <UserPlus size={14} /> {t("newMemberTab")}
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
                <input className="input !pl-9" placeholder={t("searchPersonPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} />
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
                          <span className="font-mono text-xs text-muted">{m.membershipNumber ?? "—"}</span>
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
          ) : tab === "new" ? (
            <form onSubmit={addNewMember} className="space-y-3">
              <div>
                <label className="label">{t("membershipNumberLabel")}</label>
                <input className="input font-mono" placeholder={t("membershipNumberOptionalHelp")} value={newForm.membershipNumber} onChange={(e) => setNew("membershipNumber", e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t("firstName")}</label>
                  <input required className="input" value={newForm.firstName} onChange={(e) => setNew("firstName", e.target.value)} />
                </div>
                <div>
                  <label className="label">{t("lastName")}</label>
                  <input required className="input" value={newForm.lastName} onChange={(e) => setNew("lastName", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t("phone")}</label>
                  <input className="input" value={newForm.phone} onChange={(e) => setNew("phone", e.target.value)} />
                </div>
                <div>
                  <label className="label">{t("email")}</label>
                  <input type="email" className="input" value={newForm.email} onChange={(e) => setNew("email", e.target.value)} />
                </div>
              </div>
              <LocationSelect value={newLocation} onChange={setNewLocation} />
              <label className="flex items-center gap-2 text-sm font-medium text-ink">
                <input type="checkbox" className="h-4 w-4 rounded border-line" checked={newIsLeader} onChange={(e) => setNewIsLeader(e.target.checked)} />
                {t("isLeaderLabel")}
              </label>
              {addedNames.length > 0 && <p className="text-xs font-medium text-success">{t("bulkNewMembersAddedPrefix")} {addedNames.join(", ")}</p>}
              {newError && <p className="text-sm text-brand">{newError}</p>}
              <div className="flex justify-end gap-2 border-t border-line pt-3">
                <button type="button" onClick={onClose} className="btn-secondary">{t("doneBtn")}</button>
                <button type="submit" disabled={addingNew} className="btn-primary">{addingNew ? t("checkingInLabel") : t("addAndCheckInCta")}</button>
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
