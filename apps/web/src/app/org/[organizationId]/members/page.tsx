"use client";

import { useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, Download, Upload, Plus, Search, Mail, MessageSquare, Trash2, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { PaginatedMembers } from "@/lib/types";
import { NewMemberModal } from "@/components/NewMemberModal";
import { ImportMembersModal } from "@/components/ImportMembersModal";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { RequireAccess } from "@/components/RequireAccess";
import { useLang } from "@/lib/i18n";

function BulkEmailModal({
  organizationId,
  memberIds,
  onClose,
  onDone,
}: {
  organizationId: string;
  memberIds: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useLang();
  const { showToast } = useToast();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = await api.post<{ sent: number; matched: number }>(`/api/v1/organizations/${organizationId}/members/bulk-email`, {
        memberIds,
        subject,
        message,
      });
      showToast("success", `${t("campaignSent")} (${result.sent}/${result.matched})`);
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("campaignError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={t("sendEmailCta")} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <p className="text-sm text-muted">{memberIds.length} {t("bulkSelectedSuffix")}</p>
        <div>
          <label className="label">{t("campaignSubject")}</label>
          <input required className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t("campaignSubjectPlaceholder")} />
        </div>
        <div>
          <label className="label">{t("campaignMessage")}</label>
          <textarea required className="input min-h-[140px]" value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t("campaignMessagePlaceholder")} />
        </div>
        {error && <p className="text-sm text-brand">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">{t("cancel")}</button>
          <button type="submit" disabled={submitting} className="btn-primary">{submitting ? t("campaignSending") : t("campaignSend")}</button>
        </div>
      </form>
    </Modal>
  );
}

type SortKey = "membershipNumber" | "firstName" | "lastName" | "region" | "membershipType" | "membershipStatus" | "registrationDate";

type FilterKind = "" | "region" | "type" | "status" | "date";

const MEMBERSHIP_TYPES = ["REGULAR", "PREMIUM", "HONORARY", "STUDENT", "CORPORATE", "LIFETIME"];
const MEMBERSHIP_TYPE_KEYS: Record<string, "mtRegular" | "mtPremium" | "mtHonorary" | "mtStudent" | "mtCorporate" | "mtLifetime"> = {
  REGULAR: "mtRegular",
  PREMIUM: "mtPremium",
  HONORARY: "mtHonorary",
  STUDENT: "mtStudent",
  CORPORATE: "mtCorporate",
  LIFETIME: "mtLifetime",
};

const MEMBERSHIP_STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED", "EXPIRED"];
const MEMBERSHIP_STATUS_KEYS: Record<string, "msActive" | "msInactive" | "msSuspended" | "msExpired"> = {
  ACTIVE: "msActive",
  INACTIVE: "msInactive",
  SUSPENDED: "msSuspended",
  EXPIRED: "msExpired",
};

export default function MembersPage() {
  const { organizationId } = useParams<{ organizationId: string }>();
  const { t } = useLang();
  const { showToast } = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showBulkEmail, setShowBulkEmail] = useState(false);
  const COLUMNS: Array<{ key: SortKey; label: string }> = [
    { key: "membershipNumber", label: t("colMembershipNumber") },
    { key: "lastName", label: t("colName") },
    { key: "region", label: t("region") },
    { key: "membershipType", label: t("fieldType") },
    { key: "membershipStatus", label: t("filterMembershipStatus") },
    { key: "registrationDate", label: t("addedLabel") },
  ];
  const initialStatus = useSearchParams().get("membershipStatus") ?? "";

  const [q, setQ] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterKind>(initialStatus ? "status" : "");
  const [region, setRegion] = useState("");
  const [membershipType, setMembershipType] = useState("");
  const [membershipStatus, setMembershipStatus] = useState(initialStatus);
  const [registeredFrom, setRegisteredFrom] = useState("");
  const [registeredTo, setRegisteredTo] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("lastName");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [showNew, setShowNew] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const filterParams = {
    q,
    region,
    membershipType,
    membershipStatus,
    registeredFrom,
    registeredTo,
    sortBy,
    sortDir,
  };

  const { data, refetch } = useQuery({
    queryKey: ["members", organizationId, filterParams, page, pageSize],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      Object.entries(filterParams).forEach(([k, v]) => v && params.set(k, v));
      return api.get<PaginatedMembers>(`/api/v1/organizations/${organizationId}/members?${params}`);
    },
  });

  function resetPage() {
    setPage(1);
  }

  function selectFilter(kind: FilterKind) {
    setActiveFilter(kind);
    setRegion("");
    setMembershipType("");
    setMembershipStatus("");
    setRegisteredFrom("");
    setRegisteredTo("");
    resetPage();
  }

  function toggleSort(key: SortKey) {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir("asc");
    }
  }

  function exportUrl() {
    const params = new URLSearchParams();
    Object.entries(filterParams).forEach(([k, v]) => v && params.set(k, v));
    return `/api/v1/organizations/${organizationId}/members/export?${params}`;
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllOnPage() {
    const ids = data?.items.map((m) => m.id) ?? [];
    const allSelected = ids.length > 0 && ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  }

  function onSendSms() {
    showToast("error", t("smsNotConnected"));
  }

  async function onBulkDelete() {
    if (!confirm(t("confirmBulkDelete"))) return;
    try {
      await api.post(`/api/v1/organizations/${organizationId}/members/bulk-delete`, { memberIds: Array.from(selected) });
      showToast("success", t("bulkDeleteSuccess"));
      setSelected(new Set());
      refetch();
    } catch (err) {
      showToast("error", err instanceof ApiError ? err.message : t("bulkDeleteFailed"));
    }
  }

  return (
    <RequireAccess area="members">
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-ink">{t("membersTitle")}</h1>
          <p className="text-sm text-muted">
            <span className="nums font-semibold text-ink">{data?.total ?? 0}</span> {t("totalMembers")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a href={exportUrl()} className="btn-secondary text-sm">
            <Download size={15} /> {t("export")}
          </a>
          <button className="btn-secondary text-sm" onClick={() => setShowImport(true)}>
            <Upload size={15} /> {t("import")}
          </button>
          <button className="btn-primary text-sm" onClick={() => setShowNew(true)}>
            <Plus size={15} /> {t("newMember")}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 sm:min-w-[240px] sm:max-w-sm">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              className="input pl-9"
              placeholder={t("searchPlaceholder")}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                resetPage();
              }}
            />
          </div>

          <select
            className="input-auto"
            value={activeFilter}
            onChange={(e) => selectFilter(e.target.value as FilterKind)}
          >
            <option value="">{t("filterBy")}</option>
            <option value="region">{t("filterRegionLabel")}</option>
            <option value="type">{t("filterMembershipType")}</option>
            <option value="status">{t("filterMembershipStatus")}</option>
            <option value="date">{t("filterRegisteredDate")}</option>
          </select>

          {activeFilter === "region" && (
            <input
              autoFocus
              className="input-auto"
              placeholder={t("regionNamePlaceholder")}
              value={region}
              onChange={(e) => { setRegion(e.target.value); resetPage(); }}
            />
          )}
          {activeFilter === "type" && (
            <select className="input-auto" value={membershipType} onChange={(e) => { setMembershipType(e.target.value); resetPage(); }}>
              <option value="">{t("allTypes")}</option>
              {MEMBERSHIP_TYPES.map((mt) => (
                <option key={mt} value={mt}>{t(MEMBERSHIP_TYPE_KEYS[mt])}</option>
              ))}
            </select>
          )}
          {activeFilter === "status" && (
            <select className="input-auto" value={membershipStatus} onChange={(e) => { setMembershipStatus(e.target.value); resetPage(); }}>
              <option value="">{t("allStatuses")}</option>
              {MEMBERSHIP_STATUSES.map((s) => (
                <option key={s} value={s}>{t(MEMBERSHIP_STATUS_KEYS[s])}</option>
              ))}
            </select>
          )}
          {activeFilter === "date" && (
            <div className="flex items-center gap-2">
              <input type="date" className="input-auto" value={registeredFrom} onChange={(e) => { setRegisteredFrom(e.target.value); resetPage(); }} />
              <span className="text-sm text-muted">{t("dateRangeTo")}</span>
              <input type="date" className="input-auto" value={registeredTo} onChange={(e) => { setRegisteredTo(e.target.value); resetPage(); }} />
            </div>
          )}
          {activeFilter !== "" && (
            <button onClick={() => selectFilter("")} className="text-sm font-medium text-brand hover:underline">
              {t("clear")}
            </button>
          )}

          <select className="input-auto ml-auto" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); resetPage(); }}>
            {[10, 25, 50, 100, 250].map((n) => (
              <option key={n} value={n}>{n} {t("rowsSuffix")}</option>
            ))}
          </select>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="card flex flex-wrap items-center gap-3 bg-brand-50">
          <p className="text-sm font-semibold text-brand-700">{selected.size} {t("bulkSelectedSuffix")}</p>
          <div className="ml-auto flex items-center gap-2">
            <button className="btn-secondary text-sm" onClick={() => setShowBulkEmail(true)}>
              <Mail size={14} /> {t("sendEmailCta")}
            </button>
            <button className="btn-secondary text-sm" onClick={onSendSms}>
              <MessageSquare size={14} /> {t("sendSmsCta")}
            </button>
            <button className="btn-secondary text-sm text-brand hover:bg-brand-100" onClick={onBulkDelete}>
              <Trash2 size={14} /> {t("deleteCta")}
            </button>
            <button className="text-muted hover:text-ink" onClick={() => setSelected(new Set())} aria-label={t("clear")}>
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Desktop/tablet: full table */}
      <div className="card hidden overflow-hidden p-0 sm:block">
      <div className="max-h-[560px] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-surface text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={(data?.items.length ?? 0) > 0 && data!.items.every((m) => selected.has(m.id))}
                  onChange={toggleAllOnPage}
                />
              </th>
              {COLUMNS.map((col) => (
                <th key={col.key} className="cursor-pointer select-none whitespace-nowrap px-4 py-3" onClick={() => toggleSort(col.key)}>
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {sortBy === col.key ? (
                      sortDir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                    ) : (
                      <ArrowUpDown size={12} className="opacity-30" />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {data?.items.map((m) => (
              <tr key={m.id} className={`hover:bg-brand-50/40 ${selected.has(m.id) ? "bg-brand-50/60" : ""}`}>
                <td className="px-4 py-3">
                  <input type="checkbox" checked={selected.has(m.id)} onChange={() => toggleOne(m.id)} />
                </td>
                <td className="px-4 py-3">
                  <Link href={`/org/${organizationId}/members/${m.id}`} className="font-mono text-brand-700 hover:underline">
                    {m.membershipNumber ?? m.campaignId}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/org/${organizationId}/members/${m.id}`} className="text-ink hover:text-brand-700">
                    {m.firstName} {m.lastName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted">{m.region ?? "—"}</td>
                <td className="px-4 py-3 text-muted">{MEMBERSHIP_TYPE_KEYS[m.membershipType] ? t(MEMBERSHIP_TYPE_KEYS[m.membershipType]) : m.membershipType}</td>
                <td className="px-4 py-3">
                  <span className={`badge ${m.membershipStatus === "ACTIVE" ? "bg-green-50 text-success" : "bg-brand-50 text-brand-700"}`}>
                    {MEMBERSHIP_STATUS_KEYS[m.membershipStatus] ? t(MEMBERSHIP_STATUS_KEYS[m.membershipStatus]) : m.membershipStatus}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-muted">{new Date(m.registrationDate).toLocaleDateString()}</td>
              </tr>
            ))}
            {data?.items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-muted">{t("noMembersFound")}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      </div>

      {/* Phone: stacked cards — a wide table doesn't fit a phone screen well */}
      <div className="space-y-2.5 sm:hidden">
        {data?.items.length === 0 && <p className="card text-center text-muted">{t("noMembersFound")}</p>}
        {data?.items.map((m) => (
          <div key={m.id} className={`card flex items-start gap-3 ${selected.has(m.id) ? "bg-brand-50/60" : ""}`}>
            <input type="checkbox" checked={selected.has(m.id)} onChange={() => toggleOne(m.id)} className="mt-1 shrink-0" />
            <Link href={`/org/${organizationId}/members/${m.id}`} className="min-w-0 flex-1">
              <p className="font-medium text-ink">{m.firstName} {m.lastName}</p>
              <p className="font-mono text-xs text-brand-700">{m.membershipNumber ?? m.campaignId}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                <span>{m.region ?? "—"}</span>
                <span>{MEMBERSHIP_TYPE_KEYS[m.membershipType] ? t(MEMBERSHIP_TYPE_KEYS[m.membershipType]) : m.membershipType}</span>
                <span className={`badge ${m.membershipStatus === "ACTIVE" ? "bg-green-50 text-success" : "bg-brand-50 text-brand-700"}`}>
                  {MEMBERSHIP_STATUS_KEYS[m.membershipStatus] ? t(MEMBERSHIP_STATUS_KEYS[m.membershipStatus]) : m.membershipStatus}
                </span>
                <span>{t("addedLabel")}: {new Date(m.registrationDate).toLocaleDateString()}</span>
              </div>
            </Link>
          </div>
        ))}
      </div>

      {data && data.totalPages > 1 && (
        <div className="flex items-center gap-2">
          <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t("previous")}</button>
          <span className="text-sm text-muted">{t("pageLabel")} {data.page} {t("ofLabel")} {data.totalPages}</span>
          <button className="btn-secondary" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>{t("next")}</button>
        </div>
      )}

      {showNew && (
        <NewMemberModal
          organizationId={organizationId}
          onClose={() => setShowNew(false)}
          onCreated={() => {
            setShowNew(false);
            refetch();
          }}
        />
      )}
      {showImport && (
        <ImportMembersModal
          organizationId={organizationId}
          onClose={() => setShowImport(false)}
          onImported={() => refetch()}
        />
      )}
      {showBulkEmail && (
        <BulkEmailModal
          organizationId={organizationId}
          memberIds={Array.from(selected)}
          onClose={() => setShowBulkEmail(false)}
          onDone={() => {
            setShowBulkEmail(false);
            setSelected(new Set());
          }}
        />
      )}
    </div>
    </RequireAccess>
  );
}
