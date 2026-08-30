"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, XCircle, Clock } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { BrandMark } from "@/components/BrandMark";
import { useLang } from "@/lib/i18n";

interface Ticket {
  registrationId: string;
  event: { id: string; name: string; location: string | null; startDatetime: string; endDatetime: string; hasEnded: boolean };
  member: { id: string; firstName: string; lastName: string; membershipNumber: string | null; campaignId: string };
  checkedIn: boolean;
  checkedInAt: string | null;
}

type State = "loading" | "ready" | "not-found" | "confirmed";

export default function TicketCheckInPage() {
  const { t } = useLang();
  const { eventId, registrationId } = useParams<{ eventId: string; registrationId: string }>();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Ticket>(`/api/v1/public/attendance/events/${eventId}/ticket/${registrationId}`)
      .then((data) => {
        setTicket(data);
        setState(data.checkedIn ? "confirmed" : "ready");
      })
      .catch(() => setState("not-found"));
  }, [eventId, registrationId]);

  async function confirmCheckIn() {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/v1/public/attendance/events/${eventId}/ticket/${registrationId}/checkin`);
      setTicket((prev) => (prev ? { ...prev, checkedIn: true, checkedInAt: new Date().toISOString() } : prev));
      setState("confirmed");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("checkInFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center bg-white px-5 py-8 text-center">
      <div className="mb-6 flex h-9 w-9 items-center justify-center rounded-lg bg-brand-gradient text-white shadow-pop">
        <BrandMark className="h-5 w-5" color="white" />
      </div>

      {state === "loading" && <p className="mt-16 text-sm text-muted">…</p>}

      {state === "not-found" && (
        <div className="mt-16 flex flex-col items-center gap-3">
          <XCircle size={32} className="text-brand" />
          <p className="text-lg font-semibold text-ink">{t("ticketNotFoundTitle")}</p>
          <p className="text-sm text-muted">{t("ticketNotFoundBody")}</p>
        </div>
      )}

      {ticket && (state === "ready" || state === "confirmed") && (
        <>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("ticketCheckInTitle")}</p>
          <h1 className="font-display mt-1 text-xl font-bold text-ink">{ticket.event.name}</h1>
          {ticket.event.location && <p className="text-sm text-muted">{ticket.event.location}</p>}

          <div className="card mt-6 w-full">
            <p className="text-lg font-bold text-ink">{ticket.member.firstName} {ticket.member.lastName}</p>
            <p className="mt-1 font-mono text-sm text-muted">{ticket.member.membershipNumber ?? ticket.member.campaignId}</p>
          </div>

          {ticket.event.hasEnded ? (
            <div className="mt-8 flex flex-col items-center gap-2">
              <Clock size={28} className="text-warning" />
              <p className="text-base font-semibold text-warning">{t("ticketEventEndedTitle")}</p>
              <p className="text-sm text-muted">{t("ticketEventEndedBody")}</p>
            </div>
          ) : state === "confirmed" ? (
            <div className="mt-8 flex flex-col items-center gap-2">
              <CheckCircle2 size={32} className="text-success" />
              <p className="text-base font-semibold text-ink">{t("checkInConfirmedTitle")}</p>
              {ticket.checkedInAt && (
                <p className="text-sm text-muted">{t("ticketCheckedInAtPrefix")} {new Date(ticket.checkedInAt).toLocaleTimeString()}</p>
              )}
            </div>
          ) : (
            <>
              <p className="mt-6 text-sm text-muted">{t("ticketCheckInSubtitle")}</p>
              {error && <p className="mt-2 text-sm text-brand">{error}</p>}
              <button onClick={confirmCheckIn} disabled={busy} className="btn-primary mt-4 w-full py-3.5 text-base">
                {busy ? t("checkingInLabel") : t("confirmCheckInCta")}
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}
