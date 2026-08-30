"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Modal } from "@/components/Modal";
import { Collapsible } from "@/components/Collapsible";
import { useLang } from "@/lib/i18n";
import { INFLUENCER_TYPES, type Influencer } from "@/lib/types";

function sentenceCase(value: string): string {
  const lower = value.toLowerCase().replace(/_/g, " ");
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function InfluencerModal({
  organizationId,
  influencer,
  onClose,
  onDone,
}: {
  organizationId: string;
  influencer?: Influencer;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useLang();
  const isEdit = Boolean(influencer);
  const [form, setForm] = useState({
    name: influencer?.name ?? "",
    type: influencer?.type ?? "OTHER",
    brandName: influencer?.brandName ?? "",
    phone: influencer?.phone ?? "",
    email: influencer?.email ?? "",
    socialHandle: influencer?.socialHandle ?? "",
    contractStartDate: influencer?.contractStartDate?.slice(0, 10) ?? "",
    bankName: influencer?.bankName ?? "",
    bankAccountName: influencer?.bankAccountName ?? "",
    bankAccountNumber: influencer?.bankAccountNumber ?? "",
    mobileMoneyNumber: influencer?.mobileMoneyNumber ?? "",
  });
  const [sameAsPhone, setSameAsPhone] = useState(Boolean(influencer?.phone) && influencer?.phone === influencer?.mobileMoneyNumber);
  const [additionalPhones, setAdditionalPhones] = useState<string[]>(influencer?.additionalPhones ?? []);
  const [agreementFile, setAgreementFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function changePhone(value: string) {
    setForm((f) => ({ ...f, phone: value, mobileMoneyNumber: sameAsPhone ? value : f.mobileMoneyNumber }));
  }

  function toggleSameAsPhone(checked: boolean) {
    setSameAsPhone(checked);
    if (checked) setForm((f) => ({ ...f, mobileMoneyNumber: f.phone }));
  }

  function setAdditionalPhone(index: number, value: string) {
    setAdditionalPhones((phones) => phones.map((p, i) => (i === index ? value : p)));
  }

  function removeAdditionalPhone(index: number) {
    setAdditionalPhones((phones) => phones.filter((_, i) => i !== index));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const body = {
        name: form.name,
        type: form.type,
        brandName: form.brandName || undefined,
        phone: form.phone || undefined,
        additionalPhones: additionalPhones.filter((p) => p.trim()).length ? additionalPhones.filter((p) => p.trim()) : undefined,
        email: form.email || undefined,
        socialHandle: form.socialHandle || undefined,
        contractStartDate: form.contractStartDate || undefined,
        bankName: form.bankName || undefined,
        bankAccountName: form.bankAccountName || undefined,
        bankAccountNumber: form.bankAccountNumber || undefined,
        mobileMoneyNumber: form.mobileMoneyNumber || undefined,
      };
      const saved = isEdit
        ? await api.patch<Influencer>(`/api/v1/organizations/${organizationId}/influencers/${influencer!.id}`, body)
        : await api.post<Influencer>(`/api/v1/organizations/${organizationId}/influencers`, body);

      if (agreementFile) {
        const fd = new FormData();
        fd.append("file", agreementFile);
        await fetch(`/api/v1/organizations/${organizationId}/influencers/${saved.id}/agreement`, {
          method: "POST",
          credentials: "include",
          body: fd,
        });
      }

      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("failedCreatePost"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title={isEdit ? t("editInfluencer") : t("newInfluencer")}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <button type="button" onClick={onClose} className="btn-secondary">{t("cancel")}</button>
          <button type="submit" form="influencer-form" disabled={submitting} className="btn-primary">{submitting ? t("saving") : t("save")}</button>
        </div>
      }
    >
      <form id="influencer-form" onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">{t("influencerNameLabel")}</label>
            <input required autoFocus className="input" value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div>
            <label className="label">{t("influencerTypeLabel")}</label>
            <select className="input" value={form.type} onChange={(e) => set("type", e.target.value)}>
              {INFLUENCER_TYPES.map((type) => (
                <option key={type} value={type}>{sentenceCase(type)}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="label">{t("brandNameLabel")}</label>
          <input className="input" value={form.brandName} onChange={(e) => set("brandName", e.target.value)} />
        </div>

        <div>
          <label className="label">{t("phone")}</label>
          <div className="space-y-2">
            <input className="input" value={form.phone} onChange={(e) => changePhone(e.target.value)} />
            {additionalPhones.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <input className="input" value={p} onChange={(e) => setAdditionalPhone(i, e.target.value)} />
                <button type="button" onClick={() => removeAdditionalPhone(i)} className="shrink-0 text-muted hover:text-brand">
                  <X size={16} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setAdditionalPhones((phones) => [...phones, ""])}
              className="flex items-center gap-1 text-sm font-semibold text-brand hover:underline"
            >
              <Plus size={14} /> {t("addPhoneNumberCta")}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">{t("email")}</label>
            <input type="email" className="input" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div>
            <label className="label">{t("socialHandleLabel")}</label>
            <input className="input" value={form.socialHandle} onChange={(e) => set("socialHandle", e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">{t("contractStartDateLabel")}</label>
            <input type="date" className="input" value={form.contractStartDate} onChange={(e) => set("contractStartDate", e.target.value)} />
          </div>
          <div>
            <label className="label">{t("agreementAttachmentLabel")}</label>
            <input
              type="file"
              className="input"
              onChange={(e) => setAgreementFile(e.target.files?.[0] ?? null)}
            />
            {influencer?.agreementUrl && !agreementFile && (
              <a href={influencer.agreementUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs font-semibold text-brand hover:underline">
                {t("viewCurrentAgreementCta")}
              </a>
            )}
          </div>
        </div>

        <Collapsible title={t("bankingInfoTitle")} subtitle={t("bankingInfoHelp")}>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">{t("bankNameLabel")}</label><input className="input" value={form.bankName} onChange={(e) => set("bankName", e.target.value)} /></div>
            <div><label className="label">{t("bankAccountNameLabel")}</label><input className="input" value={form.bankAccountName} onChange={(e) => set("bankAccountName", e.target.value)} /></div>
            <div><label className="label">{t("bankAccountNumberLabel")}</label><input className="input" value={form.bankAccountNumber} onChange={(e) => set("bankAccountNumber", e.target.value)} /></div>
            <div>
              <label className="label">{t("mobileMoneyNumberLabel")}</label>
              <input
                className="input disabled:opacity-70"
                disabled={sameAsPhone}
                value={form.mobileMoneyNumber}
                onChange={(e) => set("mobileMoneyNumber", e.target.value)}
              />
              <label className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-muted">
                <input type="checkbox" className="h-3.5 w-3.5 rounded border-line" checked={sameAsPhone} onChange={(e) => toggleSameAsPhone(e.target.checked)} />
                {t("sameAsPhoneCta")}
              </label>
            </div>
          </div>
        </Collapsible>

        {error && <p className="pt-3 text-sm text-brand">{error}</p>}
      </form>
    </Modal>
  );
}
