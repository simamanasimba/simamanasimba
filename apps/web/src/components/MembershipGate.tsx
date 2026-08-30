"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useLang } from "@/lib/i18n";

export interface FoundMember {
  id: string;
  campaignId: string;
  membershipNumber: string | null;
  firstName: string;
  middleName: string | null;
  lastName: string;
  phone: string | null;
  email: string | null;
  region: string | null;
  district: string | null;
  ward: string | null;
  branch: string | null;
  membershipStatus: string;
  membershipType: string;
}

interface LookupResult {
  found: boolean;
  member?: FoundMember;
}

export function MembershipGate({
  onFound,
  onStartFresh,
}: {
  onFound: (identifier: string, member: FoundMember) => void;
  onStartFresh: () => void;
}) {
  const { t } = useLang();
  const [screen, setScreen] = useState<"choose" | "lookup" | "not-found">("choose");
  const [identifier, setIdentifier] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onLookup(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api.post<LookupResult>("/api/v1/public/members/lookup", { identifier });
      if (result.found && result.member) {
        onFound(identifier, result.member);
      } else {
        setScreen("not-found");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("lookupFailed"));
    } finally {
      setBusy(false);
    }
  }

  if (screen === "choose") {
    return (
      <div className="space-y-3">
        <p className="text-sm font-semibold text-ink">{t("alreadyRegisteredQuestion")}</p>
        <button type="button" onClick={() => setScreen("lookup")} className="btn-primary w-full py-3 text-base">
          {t("yesUseMembershipId")}
        </button>
        <button type="button" onClick={onStartFresh} className="btn-secondary w-full py-3 text-base">
          {t("noStartFresh")}
        </button>
      </div>
    );
  }

  if (screen === "lookup") {
    return (
      <form onSubmit={onLookup} className="space-y-3">
        <div>
          <label className="label">{t("membershipOrCampaignIdLabel")}</label>
          <input
            autoFocus
            required
            className="input font-mono"
            placeholder={t("membershipOrCampaignIdPlaceholder")}
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-brand">{error}</p>}
        <button type="submit" disabled={busy} className="btn-primary w-full py-3 text-base">
          {busy ? t("searchingLabel") : t("findMyDetails")}
        </button>
        <button type="button" onClick={() => setScreen("choose")} className="btn-secondary w-full">
          {t("back")}
        </button>
      </form>
    );
  }

  return (
    <div className="space-y-3 text-center">
      <p className="text-sm font-semibold text-brand">{t("identifierNotFound")}</p>
      <button type="button" onClick={onStartFresh} className="btn-primary w-full py-3 text-base">
        {t("noStartFresh")}
      </button>
      <button type="button" onClick={() => setScreen("lookup")} className="btn-secondary w-full">
        {t("tryAgain")}
      </button>
    </div>
  );
}
