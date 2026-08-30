"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Modal } from "@/components/Modal";
import { LocationSelect, type LocationValue } from "@/components/LocationSelect";
import { useLang } from "@/lib/i18n";
import type { Member } from "@/lib/types";

export function EditMemberModal({
  organizationId,
  member,
  onClose,
  onDone,
}: {
  organizationId: string;
  member: Member;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useLang();
  const [form, setForm] = useState({
    membershipNumber: member.membershipNumber ?? "",
    firstName: member.firstName,
    lastName: member.lastName,
    phone: member.phone ?? "",
    email: member.email ?? "",
    branch: member.branch ?? "",
  });
  const [location, setLocation] = useState<LocationValue>({
    region: member.region ?? "",
    district: member.district ?? "",
    ward: member.ward ?? "",
  });
  const [isLeader, setIsLeader] = useState(member.isLeader ?? false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.patch(`/api/v1/organizations/${organizationId}/members/${member.id}`, {
        membershipNumber: form.membershipNumber || undefined,
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone || undefined,
        email: form.email || undefined,
        branch: form.branch || undefined,
        region: location.region || undefined,
        district: location.district || undefined,
        ward: location.ward || undefined,
        isLeader,
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("failedUpdateMember"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={t("editMemberTitle")} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="label">{t("membershipNumberLabel")}</label>
          <input
            className="input font-mono"
            placeholder={t("membershipNumberOptionalHelp")}
            value={form.membershipNumber}
            onChange={(e) => set("membershipNumber", e.target.value)}
          />
        </div>
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
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">{t("phone")}</label>
            <input className="input" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <div>
            <label className="label">{t("email")}</label>
            <input type="email" className="input" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
        </div>
        <LocationSelect value={location} onChange={setLocation} />
        <div>
          <label className="label">{t("branchLabel")}</label>
          <input className="input" value={form.branch} onChange={(e) => set("branch", e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-ink">
          <input type="checkbox" className="h-4 w-4 rounded border-line" checked={isLeader} onChange={(e) => setIsLeader(e.target.checked)} />
          {t("isLeaderLabel")}
        </label>
        {error && <p className="text-sm text-brand">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">{t("cancel")}</button>
          <button type="submit" disabled={submitting} className="btn-primary">{submitting ? t("saving") : t("save")}</button>
        </div>
      </form>
    </Modal>
  );
}
