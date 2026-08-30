"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Modal } from "@/components/Modal";
import { useAuth } from "@/hooks/useAuth";
import { useLang } from "@/lib/i18n";
import { PAYMENT_METHODS, type PaymentMethod, type MediaHost, type Influencer, type Influencer2Campaign, type PaginatedInfluencer2Campaigns } from "@/lib/types";

const METHOD_LABEL_KEYS: Record<PaymentMethod, "paymentMethodCash" | "paymentMethodBankTransfer" | "paymentMethodCheque" | "paymentMethodMobileMoney" | "paymentMethodCard" | "paymentMethodOnlinePayment"> = {
  CASH: "paymentMethodCash",
  BANK_TRANSFER: "paymentMethodBankTransfer",
  CHEQUE: "paymentMethodCheque",
  MOBILE_MONEY: "paymentMethodMobileMoney",
  CARD: "paymentMethodCard",
  ONLINE_PAYMENT: "paymentMethodOnlinePayment",
};

type Beneficiary = (MediaHost & { kind: "MEDIA_HOST" }) | (Influencer & { kind: "INFLUENCER" });

/** Both media hosts and influencers now use the same Influencer 2 campaign
 * system, so there's just one "pick an unpaid campaign to pay" flow here —
 * filtered by mediaHostId or influencerId depending on who's selected. */
export function RecordPaymentModal({ organizationId, onClose, onDone }: { organizationId: string; onClose: () => void; onDone: () => void }) {
  const { t } = useLang();
  const { data: auth } = useAuth();
  const { data: hosts } = useQuery({ queryKey: ["media-hosts", organizationId], queryFn: () => api.get<MediaHost[]>(`/api/v1/organizations/${organizationId}/media-hosts`) });
  const { data: influencers } = useQuery({ queryKey: ["influencers", organizationId], queryFn: () => api.get<Influencer[]>(`/api/v1/organizations/${organizationId}/influencers`) });

  const [beneficiaryType, setBeneficiaryType] = useState<"MEDIA_HOST" | "INFLUENCER">("INFLUENCER");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Beneficiary | null>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<Influencer2Campaign | null>(null);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unpaidCampaignsUrl = selected
    ? selected.kind === "MEDIA_HOST"
      ? `/api/v1/organizations/${organizationId}/influencer2/campaigns?mediaHostId=${selected.id}&paymentStatus=NOT_PAID&pageSize=100`
      : `/api/v1/organizations/${organizationId}/influencer2/campaigns?influencerId=${selected.id}&paymentStatus=NOT_PAID&pageSize=100`
    : null;
  const { data: unpaidCampaigns, isLoading: loadingCampaigns } = useQuery({
    queryKey: ["unpaid-influencer2-campaigns", selected?.kind, selected?.id],
    queryFn: () => api.get<PaginatedInfluencer2Campaigns>(unpaidCampaignsUrl!),
    enabled: Boolean(unpaidCampaignsUrl),
  });

  const [form, setForm] = useState({
    paymentDate: new Date().toISOString().slice(0, 10),
    amount: "",
    currency: "TZS",
    method: "CASH" as PaymentMethod,
    referenceNumber: "",
    description: "",
    bankName: "",
    bankAccountName: "",
    bankAccountNumber: "",
    bankTransactionRef: "",
    mobileMoneyNumber: "",
    mobileMoneyTransactionId: "",
  });

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const pool: Beneficiary[] = useMemo(() => {
    if (beneficiaryType === "MEDIA_HOST") return (hosts ?? []).map((h) => ({ ...h, kind: "MEDIA_HOST" as const }));
    return (influencers ?? []).map((i) => ({ ...i, kind: "INFLUENCER" as const }));
  }, [beneficiaryType, hosts, influencers]);

  const suggestions = search.trim().length === 0 ? [] : pool.filter((b) => b.name.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 6);

  // Bank fields come straight from the beneficiary's saved profile — locked read-only when
  // that profile actually has them, so a payment can't silently drift from what's on file. If
  // the profile has nothing saved yet, the fields stay editable as a fallback. The mobile money
  // number is different: it defaults from registration (falling back to the general phone
  // number if no dedicated payout number was set) but always stays editable, since the club
  // may pay to a different number for a specific payment.
  const hasBankDetails = Boolean(selected?.bankName || selected?.bankAccountName || selected?.bankAccountNumber);

  function pickBeneficiary(b: Beneficiary) {
    setSelected(b);
    setSearch("");
    setSelectedCampaign(null);
    setForm((f) => ({
      ...f,
      bankName: b.bankName ?? f.bankName,
      bankAccountName: b.bankAccountName ?? f.bankAccountName,
      bankAccountNumber: b.bankAccountNumber ?? f.bankAccountNumber,
      mobileMoneyNumber: b.mobileMoneyNumber ?? (b.kind === "INFLUENCER" ? b.phone : undefined) ?? f.mobileMoneyNumber,
    }));
  }

  function changeBeneficiaryType(type: "MEDIA_HOST" | "INFLUENCER") {
    setBeneficiaryType(type);
    setSelected(null);
    setSelectedCampaign(null);
    setSearch("");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !selectedCampaign) return;
    setSubmitting(true);
    setError(null);
    try {
      const payment = await api.post<{ id: string }>(`/api/v1/organizations/${organizationId}/payments`, {
        beneficiaryType,
        mediaHostId: beneficiaryType === "MEDIA_HOST" ? selected.id : undefined,
        influencerId: beneficiaryType === "INFLUENCER" ? selected.id : undefined,
        influencer2CampaignId: selectedCampaign.id,
        paymentDate: form.paymentDate,
        amount: Number(form.amount),
        currency: form.currency,
        method: form.method,
        referenceNumber: form.referenceNumber || undefined,
        description: form.description || undefined,
        bankName: form.method === "BANK_TRANSFER" ? form.bankName || undefined : undefined,
        bankAccountName: form.method === "BANK_TRANSFER" ? form.bankAccountName || undefined : undefined,
        bankAccountNumber: form.method === "BANK_TRANSFER" ? form.bankAccountNumber || undefined : undefined,
        bankTransactionRef: form.method === "BANK_TRANSFER" ? form.bankTransactionRef || undefined : undefined,
        mobileMoneyNumber: form.method === "MOBILE_MONEY" ? form.mobileMoneyNumber || undefined : undefined,
        mobileMoneyTransactionId: form.method === "MOBILE_MONEY" ? form.mobileMoneyTransactionId || undefined : undefined,
      });

      if (attachmentFile) {
        const fd = new FormData();
        fd.append("file", attachmentFile);
        await fetch(`/api/v1/organizations/${organizationId}/payments/${payment.id}/attachment`, {
          method: "POST",
          credentials: "include",
          body: fd,
        });
      }

      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to record payment");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title={t("recordPaymentTitle")}
      onClose={onClose}
      wide
      footer={
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <button type="button" onClick={onClose} className="btn-secondary">{t("cancel")}</button>
          <button type="submit" form="record-payment-form" disabled={submitting || !selectedCampaign} className="btn-primary">{submitting ? t("creatingLabel") : t("save")}</button>
        </div>
      }
    >
      <form id="record-payment-form" onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="label">{t("payWhoLabel")}</label>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => changeBeneficiaryType("INFLUENCER")} className={beneficiaryType === "INFLUENCER" ? "btn-primary text-sm" : "btn-secondary text-sm"}>
              {t("tabInfluencers")}
            </button>
            <button type="button" onClick={() => changeBeneficiaryType("MEDIA_HOST")} className={beneficiaryType === "MEDIA_HOST" ? "btn-primary text-sm" : "btn-secondary text-sm"}>
              {t("tabMediaHosts")}
            </button>
          </div>

          {selected ? (
            <div className="mt-2 flex items-center justify-between rounded-xl border border-line bg-brand-50/50 px-3.5 py-2.5">
              <div>
                <p className="text-xs text-muted">{t("selectedBeneficiaryLabel")}</p>
                <p className="text-sm font-semibold text-ink">{selected.name}</p>
              </div>
              <button type="button" onClick={() => { setSelected(null); setSelectedCampaign(null); }} className="text-sm font-semibold text-brand hover:underline">{t("changeSelectionCta")}</button>
            </div>
          ) : (
            <div className="relative mt-2">
              <input
                className="input"
                placeholder={t("searchPersonPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search.trim().length > 0 && (
                <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-line bg-white shadow-lg">
                  {suggestions.length === 0 ? (
                    <p className="px-3.5 py-2.5 text-sm text-muted">{t("noMatchesFound")}</p>
                  ) : (
                    suggestions.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => pickBeneficiary(b)}
                        className="block w-full px-3.5 py-2.5 text-left text-sm hover:bg-brand-50"
                      >
                        {b.name}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {selected && loadingCampaigns && <p className="text-sm text-muted">{t("loadingCampaignsLabel")}</p>}

        {selected && !loadingCampaigns && (unpaidCampaigns?.items.length ?? 0) === 0 && (
          <p className="rounded-xl border border-line bg-surface px-3.5 py-3 text-sm text-muted">{t("noPendingUnpaidCampaign")}</p>
        )}

        {selected && !loadingCampaigns && (unpaidCampaigns?.items.length ?? 0) > 0 && !selectedCampaign && (
          <div>
            <label className="label">{t("selectCampaignLabel")}</label>
            <div className="space-y-2">
              {(unpaidCampaigns?.items ?? []).map(({ campaign }) => (
                <button
                  type="button"
                  key={campaign.id}
                  onClick={() => setSelectedCampaign(campaign)}
                  className="block w-full rounded-xl border border-line px-3.5 py-2.5 text-left hover:border-brand hover:bg-brand-50/40"
                >
                  <p className="text-sm font-semibold text-ink">{campaign.name}</p>
                  <p className="mt-0.5 text-xs text-muted">{campaign.contentType}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {selected && selectedCampaign && (
          <>
            <div className="flex items-center justify-between rounded-xl border border-line bg-brand-50/50 px-3.5 py-2.5">
              <div>
                <p className="text-xs text-muted">{t("selectCampaignLabel")}</p>
                <p className="text-sm font-semibold text-ink">{selectedCampaign.name}</p>
              </div>
              <button type="button" onClick={() => setSelectedCampaign(null)} className="text-sm font-semibold text-brand hover:underline">{t("changeSelectionCta")}</button>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div>
                <label className="label">{t("paymentDateLabel")}</label>
                <input required type="date" className="input" value={form.paymentDate} onChange={(e) => set("paymentDate", e.target.value)} />
              </div>
              <div>
                <label className="label">{t("amountLabel")}</label>
                <input required type="number" min="0" className="input" value={form.amount} onChange={(e) => set("amount", e.target.value)} />
              </div>
              <div>
                <label className="label">{t("currencyLabel")}</label>
                <input className="input" value={form.currency} onChange={(e) => set("currency", e.target.value)} />
              </div>
            </div>

            <div>
              <label className="label">{t("paymentMethodLabel")}</label>
              <select className="input" value={form.method} onChange={(e) => set("method", e.target.value)}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>{t(METHOD_LABEL_KEYS[m])}</option>
                ))}
              </select>
            </div>

            {form.method === "BANK_TRANSFER" && (
              <div className="grid grid-cols-2 gap-3 rounded-xl border border-line p-3.5">
                <div>
                  <label className="label">{t("bankNameLabel")}</label>
                  <input readOnly={hasBankDetails} className={`input ${hasBankDetails ? "bg-surface text-muted" : ""}`} value={form.bankName} onChange={(e) => set("bankName", e.target.value)} />
                </div>
                <div>
                  <label className="label">{t("bankAccountNameLabel")}</label>
                  <input readOnly={hasBankDetails} className={`input ${hasBankDetails ? "bg-surface text-muted" : ""}`} value={form.bankAccountName} onChange={(e) => set("bankAccountName", e.target.value)} />
                </div>
                <div>
                  <label className="label">{t("bankAccountNumberLabel")}</label>
                  <input readOnly={hasBankDetails} className={`input ${hasBankDetails ? "bg-surface text-muted" : ""}`} value={form.bankAccountNumber} onChange={(e) => set("bankAccountNumber", e.target.value)} />
                </div>
                <div><label className="label">{t("bankTransactionRefLabel")}</label><input className="input" value={form.bankTransactionRef} onChange={(e) => set("bankTransactionRef", e.target.value)} /></div>
              </div>
            )}

            {form.method === "MOBILE_MONEY" && (
              <div className="grid grid-cols-2 gap-3 rounded-xl border border-line p-3.5">
                <div className="col-span-2">
                  <label className="label">{t("mobileMoneyNumberLabel")}</label>
                  <input className="input" value={form.mobileMoneyNumber} onChange={(e) => set("mobileMoneyNumber", e.target.value)} />
                </div>
                <div className="col-span-2"><label className="label">{t("mobileMoneyTransactionIdLabel")}</label><input className="input" value={form.mobileMoneyTransactionId} onChange={(e) => set("mobileMoneyTransactionId", e.target.value)} /></div>
              </div>
            )}

            {(form.method === "CASH" || form.method === "CHEQUE" || form.method === "CARD" || form.method === "ONLINE_PAYMENT") && (
              <div>
                <label className="label">{t("referenceNumberLabel")}</label>
                <input className="input" value={form.referenceNumber} onChange={(e) => set("referenceNumber", e.target.value)} />
              </div>
            )}

            <div>
              <label className="label">{t("attachmentLabel")}</label>
              <label className="btn-secondary inline-flex cursor-pointer text-xs">
                <Upload size={13} /> {attachmentFile ? attachmentFile.name : t("uploadPhoto")}
                <input type="file" className="hidden" onChange={(e) => setAttachmentFile(e.target.files?.[0] ?? null)} />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">{t("paidByLabel")}</label>
                <input disabled className="input bg-surface" value={auth?.user ? `${auth.user.firstName} ${auth.user.lastName}` : ""} />
              </div>
            </div>
            <p className="rounded-xl border border-line bg-surface px-3.5 py-2.5 text-xs text-muted">{t("paymentAwaitsApprovalHint")}</p>

            <div>
              <label className="label">{t("notesLabel")}</label>
              <textarea className="input min-h-[60px]" value={form.description} onChange={(e) => set("description", e.target.value)} />
            </div>
          </>
        )}

        {error && <p className="text-sm text-brand">{error}</p>}
      </form>
    </Modal>
  );
}
