"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { Download, Image as ImageIcon, FileText, RefreshCw, Search, CheckCircle2, Copy, Check } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { EventRecord, EventWithStats, LiveStats } from "@/lib/types";
import { StatCard } from "@/components/StatCard";
import { BrandMark } from "@/components/BrandMark";
import { LoadingWord } from "@/components/LoadingWord";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { useLang } from "@/lib/i18n";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface QrResult {
  token: string;
  checkInUrl: string;
  qrDataUrl: string;
}

/** Converts an ISO instant to the value a `datetime-local` input expects, in the
 * viewer's own local time (not UTC) — otherwise a pre-filled edit form would show
 * a different clock time than what was actually entered. */
function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function EditEventModal({
  organizationId,
  event,
  onClose,
  onSaved,
}: {
  organizationId: string;
  event: EventRecord;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useLang();
  const [form, setForm] = useState({
    name: event.name,
    eventType: event.eventType ?? "",
    location: event.location ?? "",
    startDatetime: toDatetimeLocalValue(event.startDatetime),
    endDatetime: toDatetimeLocalValue(event.endDatetime),
  });
  const [allowWalkIn, setAllowWalkIn] = useState(event.allowWalkIns && event.allowNewMemberReg);
  const [limitOneResponse, setLimitOneResponse] = useState(event.limitOneResponsePerPerson);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.patch(`/api/v1/organizations/${organizationId}/events/${event.id}`, {
        ...form,
        startDatetime: new Date(form.startDatetime).toISOString(),
        endDatetime: new Date(form.endDatetime).toISOString(),
        allowWalkIns: allowWalkIn,
        allowNewMemberReg: allowWalkIn,
        limitOneResponsePerPerson: limitOneResponse,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("failedUpdateEvent"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={t("editEvent")} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="label">{t("eventNameLabel")}</label>
          <input required className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </div>
        <div>
          <label className="label">{t("eventTypeLabel")}</label>
          <input className="input" value={form.eventType} onChange={(e) => setForm((f) => ({ ...f, eventType: e.target.value }))} />
        </div>
        <div>
          <label className="label">{t("locationLabel")}</label>
          <input className="input" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">{t("startsLabel")}</label>
            <input type="datetime-local" required className="input" value={form.startDatetime} onChange={(e) => setForm((f) => ({ ...f, startDatetime: e.target.value }))} />
          </div>
          <div>
            <label className="label">{t("endsLabel")}</label>
            <input type="datetime-local" required className="input" value={form.endDatetime} onChange={(e) => setForm((f) => ({ ...f, endDatetime: e.target.value }))} />
          </div>
        </div>
        <label className="flex items-start gap-2 text-sm text-ink">
          <input type="checkbox" className="mt-0.5" checked={allowWalkIn} onChange={(e) => setAllowWalkIn(e.target.checked)} />
          <span>
            {t("allowWalkInLabel")}
            <span className="block text-xs font-normal text-muted">{t("allowWalkInHelp")}</span>
          </span>
        </label>
        {allowWalkIn && (
          <label className="flex items-start gap-2 pl-6 text-sm text-ink">
            <input type="checkbox" className="mt-0.5" checked={limitOneResponse} onChange={(e) => setLimitOneResponse(e.target.checked)} />
            <span>
              {t("limitOneResponseLabel")}
              <span className="block text-xs font-normal text-muted">{t("limitOneResponseHelp")}</span>
            </span>
          </label>
        )}
        {error && <p className="text-sm text-brand">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">{t("cancel")}</button>
          <button type="submit" disabled={submitting} className="btn-primary">{submitting ? t("saving") : t("save")}</button>
        </div>
      </form>
    </Modal>
  );
}

interface AttendanceRow {
  id: string;
  checkedInAt: string;
  method: string;
  member: { id: string; membershipNumber: string; firstName: string; lastName: string; phone: string | null; isLeader: boolean; region: string | null };
}

interface SearchedMember {
  id: string;
  membershipNumber: string | null;
  firstName: string;
  lastName: string;
}

export default function EventDetailPage() {
  const { t } = useLang();
  const { organizationId, eventId } = useParams<{ organizationId: string; eventId: string }>();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [qr, setQr] = useState<QrResult | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [exportingBanner, setExportingBanner] = useState(false);
  const [downloadingQrPdf, setDownloadingQrPdf] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);
  const [checkInSearch, setCheckInSearch] = useState("");
  const [checkingInId, setCheckingInId] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const bannerRef = useRef<HTMLDivElement>(null);

  const { data: org } = useQuery({
    queryKey: ["org", organizationId],
    queryFn: () => api.get<{ logoUrl: string | null; name: string }>(`/api/v1/organizations/${organizationId}`),
  });
  const logoSrc = org?.logoUrl ? (org.logoUrl.startsWith("http") ? org.logoUrl : `${API_BASE}${org.logoUrl}`) : null;

  useEffect(() => {
    const cached = sessionStorage.getItem(`eip:new-qr:${eventId}`);
    if (cached) {
      setQr(JSON.parse(cached));
      sessionStorage.removeItem(`eip:new-qr:${eventId}`);
    }
  }, [eventId]);

  const { data } = useQuery({
    queryKey: ["event", organizationId, eventId],
    queryFn: () => api.get<EventWithStats>(`/api/v1/organizations/${organizationId}/events/${eventId}`),
  });

  const { data: live } = useQuery({
    queryKey: ["event-live", organizationId, eventId],
    queryFn: () => api.get<LiveStats>(`/api/v1/organizations/${organizationId}/events/${eventId}/attendance/live`),
    refetchInterval: 5000,
  });

  // The event no longer has a browsable "registered guests" list — attendance for a meeting is
  // just whoever scans in (existing members only, per explicit request: no signing up for a
  // meeting, no invited-guest list, just a live record of who actually showed up). This search
  // is only for the rare case an admin needs to check someone in by hand (no phone, offline,
  // etc.) — it looks up the org's whole member directory on demand, not a pre-built guest list.
  const { data: searchResults } = useQuery({
    queryKey: ["member-quick-search", organizationId, checkInSearch],
    queryFn: () => api.get<{ items: SearchedMember[] }>(`/api/v1/organizations/${organizationId}/members?q=${encodeURIComponent(checkInSearch)}&pageSize=8`),
    enabled: checkInSearch.trim().length >= 2,
  });

  const { data: attendance } = useQuery({
    queryKey: ["event-attendance", organizationId, eventId],
    queryFn: () => api.get<AttendanceRow[]>(`/api/v1/organizations/${organizationId}/events/${eventId}/attendance`),
    refetchInterval: 8000,
  });

  async function generateQr() {
    setGenerating(true);
    setQrError(null);
    try {
      const result = await api.post<QrResult>(`/api/v1/organizations/${organizationId}/events/${eventId}/qr`);
      setQr(result);
    } catch (err) {
      setQrError(err instanceof ApiError ? err.message : t("failedGenerateQr"));
    } finally {
      setGenerating(false);
    }
  }

  async function publish() {
    await api.patch(`/api/v1/organizations/${organizationId}/events/${eventId}`, { status: "OPEN" });
    queryClient.invalidateQueries({ queryKey: ["event", organizationId, eventId] });
  }

  async function exportBanner() {
    if (!bannerRef.current) return;
    setExportingBanner(true);
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(bannerRef.current, { pixelRatio: 2 });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${data?.event.name ?? "event"}-qr-banner.png`;
      a.click();
    } finally {
      setExportingBanner(false);
    }
  }

  async function downloadQrPdf() {
    if (!qr) return;
    setDownloadingQrPdf(true);
    try {
      const url = `${API_BASE}/api/v1/organizations/${organizationId}/events/${eventId}/qr/pdf?token=${encodeURIComponent(qr.token)}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(t("failedGenerateQr"));
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${event?.name ?? "event"}-qr.pdf`;
      a.click();
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : t("failedGenerateQr"));
    } finally {
      setDownloadingQrPdf(false);
    }
  }

  async function adminCheckIn(memberId: string) {
    setCheckingInId(memberId);
    try {
      await api.post(`/api/v1/organizations/${organizationId}/events/${eventId}/attendance/admin-checkin`, { memberId });
      queryClient.invalidateQueries({ queryKey: ["event-attendance", organizationId, eventId] });
      queryClient.invalidateQueries({ queryKey: ["event-live", organizationId, eventId] });
      setCheckInSearch("");
      showToast("success", t("checkedInLabel"));
    } catch (err) {
      showToast("error", err instanceof ApiError ? err.message : t("checkInFailed"));
    } finally {
      setCheckingInId(null);
    }
  }

  async function downloadAttendancePdf() {
    setReportBusy(true);
    try {
      const report = await api.post<{ fileUrl: string | null; status: string }>(`/api/v1/organizations/${organizationId}/reports`, {
        type: "EVENT_ATTENDANCE",
        format: "PDF",
        parameters: { eventId },
      });
      if (report.fileUrl) {
        window.open(report.fileUrl.startsWith("http") ? report.fileUrl : `${API_BASE}${report.fileUrl}`, "_blank");
      }
    } finally {
      setReportBusy(false);
    }
  }

  if (!data) return <LoadingWord />;
  const { event, stats } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-ink">{event.name}</h1>
          <p className="text-sm text-muted">
            {event.eventType && <span className="badge mr-2 bg-brand-50 text-brand-700">{event.eventType}</span>}
            {new Date(event.startDatetime).toLocaleString()} · {event.location}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={downloadAttendancePdf} disabled={reportBusy} className="btn-secondary text-sm">
            <FileText size={15} /> {reportBusy ? t("preparing") : t("attendancePdf")}
          </button>
          <span className="badge bg-surface text-muted">{event.status}</span>
          <button onClick={() => setEditing(true)} className="btn-secondary">{t("editEvent")}</button>
          {event.status === "DRAFT" && <button onClick={publish} className="btn-secondary">{t("publish")}</button>}
        </div>
      </div>

      {editing && (
        <EditEventModal
          organizationId={organizationId}
          event={event}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            queryClient.invalidateQueries({ queryKey: ["event", organizationId, eventId] });
            showToast("success", t("eventUpdated"));
          }}
        />
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <StatCard label={t("statRegistered")} value={live?.registered ?? stats.registered} />
        <StatCard label={t("statCheckedIn")} value={live?.checkedIn ?? stats.checkedIn} />
        <StatCard label={t("statRemaining")} value={live?.remaining ?? stats.remaining} />
        <StatCard label={t("statAttendanceRate")} value={`${((live?.attendanceRate ?? stats.attendanceRate) * 100).toFixed(1)}%`} />
        <StatCard label={t("statWalkIns")} value={live?.walkIns ?? stats.walkIns} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{t("qrTitle")}</h2>
            {qr && (
              <button onClick={generateQr} className="flex items-center gap-1 text-xs font-medium text-brand hover:underline">
                <RefreshCw size={12} /> {t("regenerate")}
              </button>
            )}
          </div>
          {qr ? (
            <div className="flex flex-col items-center gap-3">
              <div ref={bannerRef} className="w-full max-w-xs overflow-hidden rounded-2xl bg-brand-gradient p-6 text-center text-white shadow-pop">
                {logoSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoSrc} alt="" className="mx-auto h-10 w-10 rounded-lg object-cover" />
                ) : (
                  <BrandMark className="mx-auto h-10 w-10" color="white" />
                )}
                <p className="font-display mt-2 text-lg font-extrabold">{org?.name ?? event.name}</p>
                <p className="text-xs text-white/80">{event.name} — {new Date(event.startDatetime).toLocaleDateString()}</p>
                <div className="mx-auto mt-4 w-fit rounded-xl bg-white p-3">
                  <QRCodeSVG value={qr.checkInUrl} size={168} />
                </div>
                <p className="mt-3 text-[11px] font-medium uppercase tracking-wide text-white/80">{t("scanToCheckIn")}</p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(qr.checkInUrl).then(() => {
                      setLinkCopied(true);
                      setTimeout(() => setLinkCopied(false), 2000);
                    });
                  }}
                  className="btn-secondary text-sm"
                >
                  {linkCopied ? <Check size={15} /> : <Copy size={15} />} {linkCopied ? t("linkCopied") : t("copyLinkCta")}
                </button>
                <button onClick={exportBanner} disabled={exportingBanner} className="btn-secondary text-sm">
                  <ImageIcon size={15} /> {exportingBanner ? t("exportingLabel") : t("exportBanner")}
                </button>
                <button onClick={downloadQrPdf} disabled={downloadingQrPdf} className="btn-secondary text-sm">
                  <FileText size={15} /> {downloadingQrPdf ? t("preparing") : t("downloadQrPdf")}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-6">
              <p className="text-sm text-muted">{t("noQrYet")}</p>
              <button onClick={generateQr} disabled={generating} className="btn-primary">
                {generating ? t("generatingLabel") : t("generateQrBtn")}
              </button>
            </div>
          )}
          {qrError && <p className="mt-2 text-sm text-brand">{qrError}</p>}
        </div>

        <div className="card">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted">{t("quickCheckInTitle")}</h2>
          <p className="mb-3 text-xs text-muted">{t("quickCheckInHelp")}</p>
          <div className="relative mb-3">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              className="input pl-8 text-sm"
              placeholder={t("searchRegistrantsPlaceholder")}
              value={checkInSearch}
              onChange={(e) => setCheckInSearch(e.target.value)}
            />
          </div>
          {checkInSearch.trim().length >= 2 && (
            (searchResults?.items.length ?? 0) === 0 ? (
              <p className="text-sm text-muted">{t("noMembersFound")}</p>
            ) : (
              <ul className="max-h-80 divide-y divide-line overflow-y-auto">
                {(searchResults?.items ?? []).map((m) => {
                  const alreadyIn = (attendance ?? []).some((a) => a.member.id === m.id);
                  return (
                    <li key={m.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                      <Link href={`/org/${organizationId}/members/${m.id}`} className="min-w-0 truncate text-ink hover:text-brand-700">
                        {m.firstName} {m.lastName} <span className="font-mono text-xs text-muted">{m.membershipNumber}</span>
                      </Link>
                      {alreadyIn ? (
                        <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-success">
                          <CheckCircle2 size={13} /> {t("checkedInLabel")}
                        </span>
                      ) : (
                        <button
                          onClick={() => adminCheckIn(m.id)}
                          disabled={checkingInId === m.id}
                          className="btn-secondary shrink-0 !px-2.5 !py-1 text-xs"
                        >
                          {checkingInId === m.id ? t("checkingInLabel") : t("checkInCta")}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )
          )}
        </div>
      </div>

      <div className="card p-0">
        <div className="flex items-center justify-between px-5 pt-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{t("checkInsTitle")} ({attendance?.length ?? 0})</h2>
          <button onClick={downloadAttendancePdf} disabled={reportBusy} className="flex items-center gap-1 text-xs font-medium text-brand hover:underline disabled:opacity-50">
            <Download size={12} /> {t("exportPdf")}
          </button>
        </div>
        <div className="mt-3 max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-2.5">{t("colFullName")}</th>
                <th className="px-5 py-2.5">{t("colPhone")}</th>
                <th className="px-5 py-2.5">{t("colUserType")}</th>
                <th className="px-5 py-2.5">{t("colLocation")}</th>
                <th className="px-5 py-2.5">{t("colCheckedInAt")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(attendance ?? []).map((a) => (
                <tr key={a.id} className="hover:bg-brand-50/40">
                  <td className="px-5 py-2.5">
                    <Link href={`/org/${organizationId}/members/${a.member.id}`} className="text-ink hover:text-brand-700">
                      {a.member.firstName} {a.member.lastName} <span className="font-mono text-xs text-muted">{a.member.membershipNumber}</span>
                    </Link>
                  </td>
                  <td className="px-5 py-2.5 text-muted">{a.member.phone ?? "—"}</td>
                  <td className="px-5 py-2.5">
                    <span className={`badge ${a.member.isLeader ? "bg-brand-50 text-brand-700" : "bg-surface text-muted"}`}>
                      {a.member.isLeader ? t("roleLeader") : t("roleMember")}
                    </span>
                  </td>
                  <td className="px-5 py-2.5 text-muted">{a.member.region ?? "—"}</td>
                  <td className="px-5 py-2.5 text-muted">{new Date(a.checkedInAt).toLocaleString()}</td>
                </tr>
              ))}
              {(!attendance || attendance.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-center text-muted">{t("noCheckInsYet")}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
