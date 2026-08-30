"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Plus, MapPin, CalendarDays, User, Users, LayoutGrid, List as ListIcon } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { EventRecord } from "@/lib/types";
import { Modal } from "@/components/Modal";
import { useLang } from "@/lib/i18n";

interface CreatedEvent extends EventRecord {
  qr: { token: string; checkInUrl: string; qrDataUrl: string } | null;
}

function NewEventModal({ organizationId, onClose, onCreated }: { organizationId: string; onClose: () => void; onCreated: (event: CreatedEvent) => void }) {
  const { t } = useLang();
  const EVENT_TYPE_SUGGESTIONS = [t("etMatch"), t("etTraining"), t("etMeeting"), t("etBoardMeeting"), t("etCampaign"), t("etFanEvent")];
  const [form, setForm] = useState({ name: "", eventType: "", location: "", startDatetime: "", endDatetime: "" });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const created = await api.post<CreatedEvent>(`/api/v1/organizations/${organizationId}/events`, {
        ...form,
        startDatetime: new Date(form.startDatetime).toISOString(),
        endDatetime: new Date(form.endDatetime).toISOString(),
      });
      onCreated(created);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("failedCreateEvent"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={t("newEvent")} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="label">{t("eventNameLabel")}</label>
          <input required className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </div>
        <div>
          <label className="label">{t("eventTypeLabel")}</label>
          <input
            list="event-type-suggestions"
            className="input"
            placeholder={t("eventTypePlaceholder")}
            value={form.eventType}
            onChange={(e) => setForm((f) => ({ ...f, eventType: e.target.value }))}
          />
          <datalist id="event-type-suggestions">
            {EVENT_TYPE_SUGGESTIONS.map((et) => (
              <option key={et} value={et} />
            ))}
          </datalist>
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
        {error && <p className="text-sm text-brand">{error}</p>}
        <p className="text-xs text-muted">{t("qrAutoHelp")}</p>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">{t("cancel")}</button>
          <button type="submit" disabled={submitting} className="btn-primary">{submitting ? t("creatingLabel") : t("createEventBtn")}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function EventsPage() {
  const { organizationId } = useParams<{ organizationId: string }>();
  const { t } = useLang();
  const router = useRouter();
  const [showNew, setShowNew] = useState(false);
  const [eventType, setEventType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [view, setView] = useState<"cards" | "list">("cards");

  const { data: eventTypes } = useQuery({
    queryKey: ["event-types", organizationId],
    queryFn: () => api.get<string[]>(`/api/v1/organizations/${organizationId}/events/event-types`),
  });

  const { data } = useQuery({
    queryKey: ["events", organizationId, eventType, from, to],
    queryFn: () => {
      const params = new URLSearchParams();
      if (eventType) params.set("eventType", eventType);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      return api.get<EventRecord[]>(`/api/v1/organizations/${organizationId}/events?${params}`);
    },
  });

  function onCreated(event: CreatedEvent) {
    setShowNew(false);
    if (event.qr) {
      sessionStorage.setItem(`eip:new-qr:${event.id}`, JSON.stringify(event.qr));
    }
    router.push(`/org/${organizationId}/events/${event.id}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-extrabold text-ink">{t("eventsTitle")}</h1>
        <button className="btn-primary" onClick={() => setShowNew(true)}>
          <Plus size={15} /> {t("newEvent")}
        </button>
      </div>

      <div className="card flex flex-wrap items-end gap-3">
        <div>
          <label className="label text-xs">{t("fieldType")}</label>
          <select className="input" value={eventType} onChange={(e) => setEventType(e.target.value)}>
            <option value="">{t("allTypes")}</option>
            {(eventTypes ?? []).map((et) => (
              <option key={et} value={et}>{et}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label text-xs">{t("filterFromLabel")}</label>
          <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="label text-xs">{t("filterToLabel")}</label>
          <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="ml-auto flex items-center gap-1 rounded-lg border border-line/60 bg-surface p-1">
          <button
            type="button"
            title={t("cardViewLabel")}
            onClick={() => setView("cards")}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold transition ${view === "cards" ? "bg-white shadow-sm text-ink" : "text-muted"}`}
          >
            <LayoutGrid size={14} /> {t("cardViewLabel")}
          </button>
          <button
            type="button"
            title={t("listViewLabel")}
            onClick={() => setView("list")}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold transition ${view === "list" ? "bg-white shadow-sm text-ink" : "text-muted"}`}
          >
            <ListIcon size={14} /> {t("listViewLabel")}
          </button>
        </div>
      </div>

      {view === "cards" ? (
        <div className="max-h-[640px] overflow-y-auto pr-1">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(data ?? []).map((e) => (
              <Link key={e.id} href={`/org/${organizationId}/events/${e.id}`} className="card block transition hover:-translate-y-0.5 hover:shadow-pop/40">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="truncate font-display font-bold text-ink">{e.name}</h3>
                  <span className="badge shrink-0 bg-surface text-muted">{e.status}</span>
                </div>
                {e.eventType && <span className="badge mt-1.5 bg-brand-50 text-brand-700">{e.eventType}</span>}
                <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                  <span className="flex items-center gap-1"><CalendarDays size={13} /> {new Date(e.startDatetime).toLocaleDateString()}</span>
                  {e.location && <span className="flex items-center gap-1"><MapPin size={13} /> {e.location}</span>}
                  {e.createdBy && <span className="flex items-center gap-1"><User size={13} /> {e.createdBy.firstName} {e.createdBy.lastName}</span>}
                  <span className="flex items-center gap-1"><Users size={13} /> {e.attendanceCount ?? 0} {t("attendeesLabel").toLowerCase()}</span>
                </div>
              </Link>
            ))}
            {data?.length === 0 && <p className="text-muted">{t("noEventsMatch")}</p>}
          </div>
        </div>
      ) : (
        <div className="card max-h-[640px] overflow-y-auto p-0">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface text-left text-xs text-muted">
              <tr>
                <th className="px-4 py-2 font-semibold">{t("nameLabel")}</th>
                <th className="px-4 py-2 font-semibold">{t("typeLabel")}</th>
                <th className="px-4 py-2 font-semibold">{t("startsLabel")}</th>
                <th className="px-4 py-2 font-semibold">{t("locationLabel")}</th>
                <th className="px-4 py-2 font-semibold">{t("organizerLabel")}</th>
                <th className="px-4 py-2 font-semibold">{t("attendeesLabel")}</th>
                <th className="px-4 py-2 font-semibold">{t("statusLabel")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {(data ?? []).map((e) => (
                <tr key={e.id} className="cursor-pointer hover:bg-surface" onClick={() => router.push(`/org/${organizationId}/events/${e.id}`)}>
                  <td className="px-4 py-2 font-semibold text-ink">{e.name}</td>
                  <td className="px-4 py-2 text-muted">{e.eventType ?? "—"}</td>
                  <td className="px-4 py-2 text-muted">{new Date(e.startDatetime).toLocaleDateString()}</td>
                  <td className="px-4 py-2 text-muted">{e.location ?? "—"}</td>
                  <td className="px-4 py-2 text-muted">{e.createdBy ? `${e.createdBy.firstName} ${e.createdBy.lastName}` : "—"}</td>
                  <td className="nums px-4 py-2 text-muted">{e.attendanceCount ?? 0}</td>
                  <td className="px-4 py-2"><span className="badge bg-surface text-muted">{e.status}</span></td>
                </tr>
              ))}
              {data?.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-muted">{t("noEventsMatch")}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showNew && <NewEventModal organizationId={organizationId} onClose={() => setShowNew(false)} onCreated={onCreated} />}
    </div>
  );
}
