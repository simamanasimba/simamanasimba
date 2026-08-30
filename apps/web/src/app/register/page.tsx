"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { AuthCard } from "@/components/AuthCard";
import { MembershipGate, type FoundMember } from "@/components/MembershipGate";
import { LocationSelect, type LocationValue } from "@/components/LocationSelect";
import { useLang } from "@/lib/i18n";

interface RegistrationResult {
  campaignId: string;
}

export default function RegisterPage() {
  const { t } = useLang();
  const [mode, setMode] = useState<"gate" | "form">("gate");
  const [identifier, setIdentifier] = useState<string | null>(null);
  const [contact, setContact] = useState<string | null>(null);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    gender: "",
    phone: "",
    email: "",
    branch: "",
    membershipNumber: "",
  });
  const [location, setLocation] = useState<LocationValue>({ region: "", district: "", ward: "" });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [campaignId, setCampaignId] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function onFound(foundIdentifier: string, foundContact: string, member: FoundMember) {
    setIdentifier(foundIdentifier);
    setContact(foundContact);
    setForm({
      firstName: member.firstName,
      lastName: member.lastName,
      gender: "",
      phone: member.phone ?? "",
      email: member.email ?? "",
      branch: member.branch ?? "",
      membershipNumber: member.membershipNumber ?? "",
    });
    setLocation({ region: member.region ?? "", district: member.district ?? "", ward: member.ward ?? "" });
    setMode("form");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (identifier) {
        const result = await api.post<{ campaignId: string }>("/api/v1/public/members/update", {
          identifier,
          contact,
          fullName: `${form.firstName} ${form.lastName}`.trim(),
          gender: form.gender || undefined,
          phone: form.phone || undefined,
          email: form.email || undefined,
          region: location.region || undefined,
          district: location.district || undefined,
          ward: location.ward || undefined,
          branch: form.branch || undefined,
        });
        setCampaignId(result.campaignId);
      } else {
        const result = await api.post<RegistrationResult>("/api/v1/public/members/register", {
          fullName: `${form.firstName} ${form.lastName}`.trim(),
          gender: form.gender || undefined,
          phone: form.phone || undefined,
          email: form.email || undefined,
          region: location.region || undefined,
          district: location.district || undefined,
          ward: location.ward || undefined,
          branch: form.branch || undefined,
          membershipNumber: form.membershipNumber || undefined,
        });
        setCampaignId(result.campaignId);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("registrationFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  if (campaignId) {
    return (
      <AuthCard title={t("registerSuccessTitle")}>
        <div className="space-y-4 text-center">
          <div className="rounded-xl bg-brand-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-brand-700">{t("campaignIdLabel")}</p>
            <p className="nums font-mono text-lg font-extrabold text-ink">{campaignId}</p>
          </div>
          <p className="text-xs text-muted">{t("campaignIdHelp")}</p>
        </div>
      </AuthCard>
    );
  }

  if (mode === "gate") {
    return (
      <AuthCard title={t("registerPageTitle")} subtitle={t("registerPageSubtitle")}>
        <MembershipGate onFound={onFound} onStartFresh={() => setMode("form")} />
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t("registerPageTitle")} subtitle={t("registerPageSubtitle")}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">{t("firstName")}</label>
            <input required className="input" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
          </div>
          <div>
            <label className="label">{t("lastName")}</label>
            <input required className="input" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">{t("genderLabel")}</label>
          <select required className="input" value={form.gender} onChange={(e) => set("gender", e.target.value)}>
            <option value="" disabled>—</option>
            <option value="MALE">{t("genderMale")}</option>
            <option value="FEMALE">{t("genderFemale")}</option>
          </select>
        </div>
        <div>
          <label className="label">{t("phone")}</label>
          <input required className="input" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </div>
        <div>
          <label className="label">{t("emailOptionalLabel")}</label>
          <input type="email" className="input" value={form.email} onChange={(e) => set("email", e.target.value)} />
        </div>
        <LocationSelect value={location} onChange={setLocation} required />
        <div>
          <label className="label">{t("branchLabel")}</label>
          <input className="input" value={form.branch} onChange={(e) => set("branch", e.target.value)} />
        </div>
        {!identifier && (
          <div>
            <label className="label">{t("postMembershipNumber")}</label>
            <input className="input font-mono" value={form.membershipNumber} onChange={(e) => set("membershipNumber", e.target.value)} />
            <p className="mt-1 text-xs text-muted">{t("campaignMembershipOptionalHelp")}</p>
          </div>
        )}
        {error && <p className="text-sm text-brand">{error}</p>}
        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? t("registeringLabel") : t("postSubmit")}
        </button>
      </form>
    </AuthCard>
  );
}
