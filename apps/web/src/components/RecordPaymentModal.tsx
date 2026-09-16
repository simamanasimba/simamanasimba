"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Modal } from "@/components/Modal";
import { useAuth } from "@/hooks/useAuth";
import { useLang } from "@/lib/i18n";
import { PAYMENT_METHODS, type PaymentMethod, type MediaHost, type Influencer, type Member, type PaginatedMembers, type Influencer2Campaign, type PaginatedInfluencer2Campaigns, type Payment } from "@/lib/types";

/** Sunday-anchored, matching PaymentsService.getFinanceDashboard's own week start. */
function startOfWeek(): string {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().slice(0, 10);
}

const METHOD_LABEL_KEYS: Record<PaymentMethod, "paymentMethodCash" | "paymentMethodBankTransfer" | "paymentMethodCheque" | "paymentMethodMobileMoney" | "paymentMethodCard" | "paymentMethodOnlinePayment"> = {
  CASH: "paymentMethodCash",
  BANK_TRANSFER: "paymentMethodBankTransfer",
  CHEQUE: "paymentMethodCheque",
  MOBILE_MONEY: "paymentMethodMobileMoney",
  CARD: "paymentMethodCard",
  ONLINE_PAYMENT: "paymentMethodOnlinePayment",
};

type Beneficiary = (MediaHost & { kind: "MEDIA_HOST" }) | (Influencer & { kind: "INFLUENCER" }) | (Member & { kind: "MEMBER"; name: string });

/** Media hosts and influencers both use the Influencer 2 campaign system, so picking one of them
 * leads into "pick an unpaid campaign to pay". Members (leaders, paid for things like attending
 * or organizing a meeting) have no campaign to link — selecting one skips straight to the amount/
 * method fields below. */
export function RecordPaymentModal({ organizationId, onClose, onDone }: { organizationId: string; onClose: () => void; onDone: () => void }) {
  const { t } = useLang();
  const { data: auth } = useAuth();
  const { data: hosts } = useQuery({ queryKey: ["media-hosts", organizationId], queryFn: () => api.get<MediaHost[]>(`/api/v1/organizations/${organizationId}/media-hosts`) });
  const { data: influencers } = useQuery({ queryKey: ["influencers", organizationId], queryFn: () => api.get<Influencer[]>(`/api/v1/organizations/${organizationId}/influencers`) });
  const { data: leaders } = useQuery({
    queryKey: ["members-leaders", organizationId],
    queryFn: () => api.get<PaginatedMembers>(`/api/v1/organizations/${organizationId}/members?isLeader=true&pageSize=500`),
  });

  const [beneficiaryType, setBeneficiaryType] = useState<"MEDIA_HOST" | "INFLUENCER" | "MEMBER">("INFLUENCER");
  const isLeadersTab = beneficiaryType === "MEMBER";

  // Since leaders are paid weekly, whoever already has a payment in flight for this week is shown
  // lower down (and tagged), so the list naturally leads with who's still unpaid instead of
  // treating every leader as equally due.
  const { data: memberPayments } = useQuery({
    queryKey: ["payments", organizationId, "MEMBER"],
    queryFn: () => api.get<Payment[]>(`/api/v1/organizations/${organizationId}/payments?beneficiaryType=MEMBER`),
    enabled: isLeadersTab,
  });
  const paidThisWeekMemberIds = new Set(
    (memberPayments ?? [])
      .filter((p) => p.status !== "REJECTED" && p.status !== "CANCELLED" && p.paymentDate.slice(0, 10) >= startOfWeek() && p.memberId)
      .map((p) => p.memberId as string),
  );
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Beneficiary | null>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<Influencer2Campaign | null>(null);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMember = beneficiaryType === "MEMBER";
  const unpaidCampaignsUrl = selected && !isMember
    ? selected.kind === "MEDIA_HOST"
      ? `/api/v1/organizations/${organizationId}/influencer2/campaigns?mediaHostId=${selected.id}&paymentStatus=NOT_PAID&pageSize=100`
      : `/api/v1/organizations/${organizationId}/influencer2/campaigns?influencerId=${selected.id}&paymentStatus=NOT_PAID&pageSize=100`
    : null;
  const { data: unpaidCampaigns, isLoading: loadingCampaigns } = useQuery({
    queryKey: ["unpaid-influencer2-campaigns", selected?.kind, selected?.id],
    queryFn: () => api.get<PaginatedInfluencer2Campaigns>(unpaidCampaignsUrl!),
    enabled: Boolean(unpaidCampaignsUrl),
  });
  const readyToPay = Boolean(selected && (isMember || selectedCampaign));

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
    if (beneficiaryType === "MEMBER") {
      const rows = (leaders?.items ?? []).map((m) => ({ ...m, kind: "MEMBER" as const, name: `${m.firstName} ${m.lastName}` }));
      // Unpaid-this-week leaders first — with hundreds of leaders, whoever's still owed for this
      // week should never be buried under everyone who's already been paid.
      return [...rows].sort((a, b) => Number(paidThisWeekMemberIds.has(a.id)) - Number(paidThisWeekMemberIds.has(b.id)));
    }
    return (influencers ?? []).map((i) => ({ ...i, kind: "INFLUENCER" as const }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beneficiaryType, hosts, influencers, leaders, paidThisWeekMemberIds.size]);

  // The list is visible by default (capped so it stays fast to render with a large roster) — no
  // need to already know a name to type before anything shows. Typing narrows it further.
  const suggestions = (search.trim().length === 0 ? pool : pool.filter((b) => b.name.toLowerCase().includes(search.trim().toLowerCase()))).slice(0, 50);

  // Bank fields come straight from the beneficiary's saved profile — locked read-only when
  // that profile actually has them, so a payment can't silently drift from what's on file. If
  // the profile has nothing saved yet, the fields stay editable as a fallback. The mobile money
  // number is different: it defaults from registration (falling back to the general phone
  // number if no dedicated payout number was set) but always stays editable, since the club
  // may pay to a different number for a specific payment. Members have no saved payout profile
  // at all (no bank/mobile columns on Member), so their fields always start blank and editable.
  const hasBankDetails = Boolean(selected && selected.kind !== "MEMBER" && (selected.bankName || selected.bankAccountName || selected.bankAccountNumber));

  function pickBeneficiary(b: Beneficiary) {
    setSelected(b);
    setSearch("");
    setSelectedCampaign(null);
    if (b.kind === "MEMBER") {
      setForm((f) => ({ ...f, bankName: "", bankAccountName: "", bankAccountNumber: "", mobileMoneyNumber: b.phone ?? f.mobileMoneyNumber }));
      return;
    }
    setForm((f) => ({
      ...f,
      bankName: b.bankName ?? f.bankName,
      bankAccountName: b.bankAccountName ?? f.bankAccountName,
      bankAccountNumber: b.bankAccountNumber ?? f.bankAccountNumber,
      mobileMoneyNumber: b.mobileMoneyNumber ?? (b.kind === "INFLUENCER" ? b.phone : undefined) ?? f.mobileMoneyNumber,
    }));
  }

  function changeBeneficiaryType(type: "MEDIA_HOST" | "INFLUENCER" | "MEMBER") {
    setBeneficiaryType(type);
    setSelected(null);
    setSelectedCampaign(null);
    setSearch("");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !(isMember || selectedCampaign)) return;
    setSubmitting(true);
    setError(null);
    try {
      const payment = await api.post<{ id: string }>(`/api/v1/organizations/${organizationId}/payments`, {
        beneficiaryType,
        mediaHostId: beneficiaryType === "MEDIA_HOST" ? selected.id : undefined,
        influencerId: beneficiaryType === "INFLUENCER" ? selected.id : undefined,
        memberId: beneficiaryType === "MEMBER" ? selected.id : undefined,
        influencer2CampaignId: selectedCampaign?.id,
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
          <button type="submit" form="record-payment-form" disabled={submitting || !readyToPay} className="btn-primary">{submitting ? t("creatingLabel") : t("save")}</button>
        </div>
      }
    >
      <form id="record-payment-form" onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="label">{t("payWhoLabel")}</label>
          <div className="grid grid-cols-3 gap-2">
            <button type="button" onClick={() => changeBeneficiaryType("INFLUENCER")} className={beneficiaryType === "INFLUENCER" ? "btn-primary text-sm" : "btn-secondary text-sm"}>
              {t("tabInfluencers")}
            </button>
            <button type="button" onClick={() => changeBeneficiaryType("MEDIA_HOST")} className={beneficiaryType === "MEDIA_HOST" ? "btn-primary text-sm" : "btn-secondary text-sm"}>
              {t("tabMediaHosts")}
            </button>
            <button type="button" onClick={() => changeBeneficiaryType("MEMBER")} className={beneficiaryType === "MEMBER" ? "btn-primary text-sm" : "btn-secondary text-sm"}>
              {t("tabLeaders")}
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
            <div className="mt-2">
              <input
                className="input"
                placeholder={t("searchPersonPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="mt-1.5 max-h-56 overflow-y-auto rounded-xl border border-line bg-white shadow-card">
                {suggestions.length === 0 ? (
                  <p className="px-3.5 py-2.5 text-sm text-muted">{t("noMatchesFound")}</p>
                ) : (
                  suggestions.map((b) => {
                    const paidThisWeek = isLeadersTab && paidThisWeekMemberIds.has(b.id);
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => pickBeneficiary(b)}
                        className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-sm hover:bg-brand-50"
                      >
                        <span className={paidThisWeek ? "text-muted" : "text-ink"}>{b.name}</span>
                        {paidThisWeek && <span className="badge bg-surface text-muted">{t("paidThisWeekLabel")}</span>}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {selected && !isMember && loadingCampaigns && <p className="text-sm text-muted">{t("loadingCampaignsLabel")}</p>}

        {selected && !isMember && !loadingCampaigns && (unpaidCampaigns?.items.length ?? 0) === 0 && (
          <p className="rounded-xl border border-line bg-surface px-3.5 py-3 text-sm text-muted">{t("noPendingUnpaidCampaign")}</p>
        )}

        {selected && !isMember && !loadingCampaigns && (unpaidCampaigns?.items.length ?? 0) > 0 && !selectedCampaign && (
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

        {selected && readyToPay && (
          <>
            {selectedCampaign && (
              <div className="flex items-center justify-between rounded-xl border border-line bg-brand-50/50 px-3.5 py-2.5">
                <div>
                  <p className="text-xs text-muted">{t("selectCampaignLabel")}</p>
                  <p className="text-sm font-semibold text-ink">{selectedCampaign.name}</p>
                </div>
                <button type="button" onClick={() => setSelectedCampaign(null)} className="text-sm font-semibold text-brand hover:underline">{t("changeSelectionCta")}</button>
              </div>
            )}

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
