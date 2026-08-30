"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { getDeviceId } from "@/lib/deviceId";
import { enqueue, loadQueue, clearSynced, type QueuedCheckIn } from "@/lib/offlineQueue";
import { BrandMark } from "@/components/BrandMark";
import { useLang } from "@/lib/i18n";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface EventInfo {
  event: { id: string; name: string; location?: string; startDatetime: string; allowWalkIns: boolean; allowNewMemberReg: boolean };
}

interface LookupResult {
  found: boolean;
  member?: { id: string; campaignId: string; membershipNumber: string | null; firstName: string; lastName: string; membershipStatus: string; membershipType: string };
  alreadyCheckedIn?: boolean;
  checkedInAt?: string;
}

type Screen = "start" | "lookup" | "member-found" | "not-found" | "register" | "success" | "invalid";
type SyncStatus = "ONLINE" | "OFFLINE" | "SYNCING" | "SYNCED" | "SYNC_ERROR";

export default function AttendPage() {
  const { t, lang } = useLang();
  const { eventId } = useParams<{ eventId: string }>();
  const token = useSearchParams().get("token") ?? "";
  const deviceId = getDeviceId();

  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  useEffect(() => {
    api
      .get<{ logoUrl: string | null }>("/api/v1/public/branding")
      .then((b) => setLogoSrc(b.logoUrl ? (b.logoUrl.startsWith("http") ? b.logoUrl : `${API_BASE}${b.logoUrl}`) : null))
      .catch(() => setLogoSrc(null));
  }, []);

  const [eventInfo, setEventInfo] = useState<EventInfo | null>(null);
  const [screen, setScreen] = useState<Screen>("start");
  const [membershipNumber, setMembershipNumber] = useState("");
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("ONLINE");
  const [queueSize, setQueueSize] = useState(0);
  const [walkIn, setWalkIn] = useState({ membershipNumber: "", firstName: "", middleName: "", lastName: "", phone: "", email: "" });
  const [invalidMessage, setInvalidMessage] = useState<string | null>(null);
  const [registrationResult, setRegistrationResult] = useState<{ registrationId: string; alreadyRegistered: boolean; checkedIn: boolean } | null>(null);

  useEffect(() => {
    // navigator.onLine is unavailable during server rendering — read the real
    // status only after mount, otherwise the SSR'd markup and the client's
    // first render disagree and React throws a hydration-mismatch error.
    setSyncStatus(navigator.onLine ? "ONLINE" : "OFFLINE");
    setQueueSize(loadQueue(eventId).length);
  }, [eventId]);

  const trySync = useCallback(async () => {
    const pending = loadQueue(eventId);
    if (pending.length === 0) return;
    setSyncStatus("SYNCING");
    try {
      const result = await api.post<{ results: Array<{ clientRecordId: string; status: string }> }>(`/api/v1/public/attendance/events/${eventId}/sync`, {
        token,
        deviceId,
        items: pending,
      });
      clearSynced(
        eventId,
        result.results.map((r) => r.clientRecordId),
      );
      setQueueSize(loadQueue(eventId).length);
      setSyncStatus("SYNCED");
    } catch {
      setSyncStatus("SYNC_ERROR");
    }
  }, [eventId, token, deviceId]);

  useEffect(() => {
    function onOnline() {
      setSyncStatus("ONLINE");
      trySync();
    }
    function onOffline() {
      setSyncStatus("OFFLINE");
    }
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    if (navigator.onLine) trySync();
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [trySync]);

  useEffect(() => {
    api
      .get<EventInfo>(`/api/v1/public/attendance/events/${eventId}?token=${encodeURIComponent(token)}`)
      .then((info) => {
        setEventInfo(info);
        setScreen("start");
      })
      .catch((err) => {
        setInvalidMessage(err instanceof ApiError ? err.message : null);
        setScreen("invalid");
      });
  }, [eventId, token]);

  async function onLookup(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api.post<LookupResult>(`/api/v1/public/attendance/events/${eventId}/lookup`, { token, membershipNumber });
      setLookup(result);
      setScreen(result.found ? "member-found" : "not-found");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("lookupFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function onConfirm() {
    setBusy(true);
    setError(null);
    const clientRecordId = crypto.randomUUID();
    if (!navigator.onLine) {
      const item: QueuedCheckIn = { clientRecordId, membershipNumber, checkedInAt: new Date().toISOString() };
      enqueue(eventId, item);
      setQueueSize(loadQueue(eventId).length);
      setScreen("success");
      setBusy(false);
      return;
    }
    try {
      await api.post(`/api/v1/public/attendance/events/${eventId}/check-in`, { token, membershipNumber, deviceId, clientRecordId });
      setScreen("success");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("checkInFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function onRegisterWalkIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api.post<{ registrationId: string; alreadyRegistered: boolean; checkedIn: boolean }>(`/api/v1/public/attendance/events/${eventId}/register`, {
        token,
        ...walkIn,
        deviceId,
        clientRecordId: crypto.randomUUID(),
      });
      setRegistrationResult(result);
      setScreen("success");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("registrationFailed"));
    } finally {
      setBusy(false);
    }
  }

  function resetForNext() {
    setMembershipNumber("");
    setLookup(null);
    setError(null);
    setWalkIn({ membershipNumber: "", firstName: "", middleName: "", lastName: "", phone: "", email: "" });
    setRegistrationResult(null);
    setScreen("start");
  }

  const statusColor: Record<SyncStatus, string> = {
    ONLINE: "bg-green-50 text-success",
    OFFLINE: "bg-amber-50 text-warning",
    SYNCING: "bg-brand-50 text-brand-700",
    SYNCED: "bg-green-50 text-success",
    SYNC_ERROR: "bg-brand-50 text-brand-700",
  };

  const syncStatusLabel: Record<SyncStatus, string> = {
    ONLINE: t("syncOnline"),
    OFFLINE: t("syncOffline"),
    SYNCING: t("syncSyncing"),
    SYNCED: t("syncSynced"),
    SYNC_ERROR: t("syncErrorLabel"),
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-white px-5 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-brand-gradient text-white shadow-pop">
          {logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoSrc} alt="" className="h-full w-full object-cover" />
          ) : (
            <BrandMark className="h-5 w-5" color="white" />
          )}
        </div>
        <span className={`badge ${statusColor[syncStatus]}`}>
          {syncStatusLabel[syncStatus]}
          {queueSize > 0 ? ` · ${queueSize} ${t("pendingSuffix")}` : ""}
        </span>
      </div>

      {screen === "invalid" && (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="text-lg font-semibold text-brand">{t("qrInvalidTitle")}</p>
          <p className="mt-2 text-sm text-muted">{invalidMessage ?? t("qrInvalidBody")}</p>
        </div>
      )}

      {eventInfo && screen !== "invalid" && (
        <>
          <h1 className="font-display text-xl font-bold text-ink">{eventInfo.event.name}</h1>
          {eventInfo.event.location && <p className="text-sm text-muted">{eventInfo.event.location}</p>}

          {screen === "start" && (
            <div className="mt-10 space-y-4 text-center">
              <p className="text-base font-semibold text-ink">{t("areYouMember")}</p>
              <button onClick={() => setScreen("lookup")} className="btn-primary w-full py-3.5 text-base">{t("yesHaveNumber")}</button>
              {eventInfo.event.allowWalkIns && eventInfo.event.allowNewMemberReg ? (
                <button onClick={() => setScreen("register")} className="btn-secondary w-full py-3.5 text-base">{t("noRegisterMe")}</button>
              ) : (
                <p className="text-sm text-muted">{t("walkInDisabled")}</p>
              )}
            </div>
          )}

          {screen === "lookup" && (
            <form onSubmit={onLookup} className="mt-8 space-y-4">
              <div>
                <label className="label">{t("registrationNumberLabel")}</label>
                <input
                  autoFocus
                  inputMode="text"
                  className="input text-center text-lg tracking-wide"
                  placeholder={t("registrationNumberPlaceholder")}
                  value={membershipNumber}
                  onChange={(e) => setMembershipNumber(e.target.value)}
                  required
                />
              </div>
              {error && <p className="text-sm text-brand">{error}</p>}
              <button type="submit" disabled={busy} className="btn-primary w-full py-3.5 text-base">
                {busy ? t("searchingLabel") : t("findMember")}
              </button>
              <button type="button" onClick={resetForNext} className="btn-secondary w-full">{t("back")}</button>
            </form>
          )}

          {screen === "member-found" && lookup?.member && (
            <div className="mt-8 space-y-5 text-center">
              <div className="card">
                <p className="text-lg font-bold text-ink">
                  {lookup.member.firstName} {lookup.member.lastName}
                </p>
                <p className="mt-1 font-mono text-sm text-muted">{lookup.member.membershipNumber ?? lookup.member.campaignId}</p>
                <span className="badge mt-3 bg-green-50 text-success">{lookup.member.membershipStatus}</span>
              </div>
              {lookup.alreadyCheckedIn ? (
                <>
                  <p className="text-base font-semibold text-warning">{t("alreadyCheckedIn")}</p>
                  <p className="text-sm text-muted">{t("checkedInAtPrefix")} {lookup.checkedInAt ? new Date(lookup.checkedInAt).toLocaleTimeString() : "—"}</p>
                  <button onClick={resetForNext} className="btn-secondary w-full py-3.5 text-base">{t("nextPerson")}</button>
                </>
              ) : (
                <>
                  {error && <p className="text-sm text-brand">{error}</p>}
                  <button onClick={onConfirm} disabled={busy} className="btn-primary w-full py-3.5 text-base">
                    {busy ? t("confirmingLabel") : t("confirmAttendance")}
                  </button>
                  <button onClick={resetForNext} className="btn-secondary w-full">{t("cancel")}</button>
                </>
              )}
            </div>
          )}

          {screen === "not-found" && (
            <div className="mt-8 space-y-5 text-center">
              <p className="text-lg font-semibold text-brand">{t("membershipNotFoundTitle")}</p>
              <p className="text-sm text-muted">
                {lang === "sw" ? `"${membershipNumber}" haijasajiliwa na shirika hili.` : `"${membershipNumber}" is not registered with this organization.`}
              </p>
              {eventInfo.event.allowWalkIns && eventInfo.event.allowNewMemberReg ? (
                <button
                  onClick={() => {
                    setWalkIn((w) => ({ ...w, membershipNumber }));
                    setScreen("register");
                  }}
                  className="btn-primary w-full py-3.5 text-base"
                >
                  {t("registerAsNewMember")}
                </button>
              ) : (
                <p className="text-sm text-muted">{t("walkInDisabledOrganizer")}</p>
              )}
              <button onClick={resetForNext} className="btn-secondary w-full">{t("tryAgain")}</button>
            </div>
          )}

          {screen === "register" && (
            <form onSubmit={onRegisterWalkIn} className="mt-6 space-y-3">
              <div>
                <label className="label">{t("membershipNumberOptionalLabel")}</label>
                <input
                  className="input font-mono"
                  placeholder={t("leaveBlankNotMember")}
                  value={walkIn.membershipNumber}
                  onChange={(e) => setWalkIn((w) => ({ ...w, membershipNumber: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t("firstName")}</label>
                  <input required className="input" value={walkIn.firstName} onChange={(e) => setWalkIn((w) => ({ ...w, firstName: e.target.value }))} />
                </div>
                <div>
                  <label className="label">{t("lastName")}</label>
                  <input required className="input" value={walkIn.lastName} onChange={(e) => setWalkIn((w) => ({ ...w, lastName: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="label">{t("phone")}</label>
                <input className="input" value={walkIn.phone} onChange={(e) => setWalkIn((w) => ({ ...w, phone: e.target.value }))} />
              </div>
              <div>
                <label className="label">{t("email")}</label>
                <input type="email" className="input" value={walkIn.email} onChange={(e) => setWalkIn((w) => ({ ...w, email: e.target.value }))} />
              </div>
              {error && <p className="text-sm text-brand">{error}</p>}
              <button type="submit" disabled={busy} className="btn-primary w-full py-3.5 text-base">
                {busy ? t("registeringLabel") : t("registerAndCheckIn")}
              </button>
              <button type="button" onClick={resetForNext} className="btn-secondary w-full">{t("back")}</button>
            </form>
          )}

          {screen === "success" && (
            <div className="mt-6 flex flex-1 flex-col items-center justify-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-50 text-3xl text-success">✓</div>
              <p className="font-display text-xl font-bold text-ink">
                {registrationResult?.alreadyRegistered
                  ? t("alreadyRegisteredTitle")
                  : registrationResult
                    ? registrationResult.checkedIn
                      ? t("checkInSuccessTitle")
                      : t("registeredTitle")
                    : t("checkInSuccessTitle")}
              </p>
              {registrationResult?.alreadyRegistered && <p className="mt-1 max-w-xs text-sm text-muted">{t("alreadyRegisteredBody")}</p>}
              {registrationResult && !registrationResult.alreadyRegistered && !registrationResult.checkedIn && (
                <p className="mt-1 max-w-xs text-sm text-muted">{t("registeredBody")}</p>
              )}
              {registrationResult && !registrationResult.alreadyRegistered && (
                <p className="mt-4 max-w-xs text-sm text-muted">{t("thankYouForAttending")}</p>
              )}

              <button onClick={resetForNext} className="btn-primary mt-8 w-full py-3.5 text-base">{t("nextPerson")}</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
