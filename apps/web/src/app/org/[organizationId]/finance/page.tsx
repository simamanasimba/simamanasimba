"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Wallet } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { Payment, MediaCampaign, MediaHost, Influencer, Member, PaginatedMembers, Expense, ExpenseCategory } from "@/lib/types";
import { Modal } from "@/components/Modal";
import { RecordPaymentModal } from "@/components/RecordPaymentModal";
import { PendingApprovalPanel } from "@/components/PendingApprovalPanel";
import { ReadyForPaymentPanel } from "@/components/ReadyForPaymentPanel";
import { ProcessingPaymentsPanel } from "@/components/ProcessingPaymentsPanel";
import { Collapsible } from "@/components/Collapsible";
import { ExpenseModal } from "@/components/ExpenseModal";
import { FinanceStatCards } from "@/components/FinanceStatCards";
import { TableSearchInput } from "@/components/TableSearchInput";
import { useToast } from "@/components/Toast";
import { useLang } from "@/lib/i18n";
import { useAuth } from "@/hooks/useAuth";
import { canApprovePayment, canPayPostingAgreement } from "@/lib/permissions";
import { useRolePermissions } from "@/hooks/useRolePermissions";
import { RequireAccess } from "@/components/RequireAccess";

function AddPaymentModal({ organizationId, onClose, onDone }: { organizationId: string; onClose: () => void; onDone: () => void }) {
  const { t } = useLang();
  const { data: campaigns } = useQuery({ queryKey: ["media-campaigns", organizationId], queryFn: () => api.get<MediaCampaign[]>(`/api/v1/organizations/${organizationId}/media-campaigns`) });
  const { data: hosts } = useQuery({ queryKey: ["media-hosts", organizationId], queryFn: () => api.get<MediaHost[]>(`/api/v1/organizations/${organizationId}/media-hosts`) });
  const { data: influencers } = useQuery({ queryKey: ["influencers", organizationId], queryFn: () => api.get<Influencer[]>(`/api/v1/organizations/${organizationId}/influencers`) });
  const { data: leaders } = useQuery({
    queryKey: ["members-leaders", organizationId],
    queryFn: () => api.get<PaginatedMembers>(`/api/v1/organizations/${organizationId}/members?isLeader=true&pageSize=500`),
  });

  const [form, setForm] = useState({
    campaignId: "",
    beneficiaryType: "INFLUENCER" as "MEDIA_HOST" | "INFLUENCER" | "MEMBER",
    paymentDate: new Date().toISOString().slice(0, 10),
    currency: "TZS",
    method: "",
    description: "",
  });
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const memberBeneficiaries: Array<{ id: string; name: string }> = (leaders?.items ?? []).map((m: Member) => ({ id: m.id, name: `${m.firstName} ${m.lastName}` }));
  const allBeneficiaries: Array<{ id: string; name: string }> =
    form.beneficiaryType === "MEDIA_HOST" ? (hosts ?? []) : form.beneficiaryType === "MEMBER" ? memberBeneficiaries : (influencers ?? []);
  // Only entries with an amount already typed always stay visible, even once a search hides them
  // from the plain list — otherwise typing a search after keying in a few amounts would look like
  // it silently discarded them.
  const beneficiaries = search.trim()
    ? allBeneficiaries.filter((b) => b.name.toLowerCase().includes(search.trim().toLowerCase()) || Number(amounts[b.id]) > 0)
    : allBeneficiaries;
  const entries = Object.entries(amounts)
    .map(([beneficiaryId, raw]) => ({ beneficiaryId, amount: Number(raw) }))
    .filter((e) => e.amount > 0);
  const total = entries.reduce((sum, e) => sum + e.amount, 0);

  function setBeneficiaryType(beneficiaryType: "MEDIA_HOST" | "INFLUENCER" | "MEMBER") {
    setForm((f) => ({ ...f, beneficiaryType }));
    setAmounts({});
    setSearch("");
  }

  function setAmount(beneficiaryId: string, value: string) {
    setAmounts((a) => ({ ...a, [beneficiaryId]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (entries.length === 0) {
      setError(t("bulkPaymentNoAmountsError"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/api/v1/organizations/${organizationId}/payments/bulk`, {
        campaignId: form.campaignId || undefined,
        beneficiaryType: form.beneficiaryType,
        paymentDate: form.paymentDate,
        currency: form.currency,
        method: form.method || undefined,
        description: form.description || undefined,
        entries,
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create payment");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={t("bulkPaymentCta")} onClose={onClose} wide>
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="label">{t("campaignLabel")}</label>
          <select className="input" value={form.campaignId} onChange={(e) => setForm((f) => ({ ...f, campaignId: e.target.value }))}>
            <option value="">—</option>
            {(campaigns ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">{t("beneficiaryTypeLabel")}</label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setBeneficiaryType("INFLUENCER")}
              className={form.beneficiaryType === "INFLUENCER" ? "btn-primary text-sm" : "btn-secondary text-sm"}
            >
              {t("tabInfluencers")}
            </button>
            <button
              type="button"
              onClick={() => setBeneficiaryType("MEDIA_HOST")}
              className={form.beneficiaryType === "MEDIA_HOST" ? "btn-primary text-sm" : "btn-secondary text-sm"}
            >
              {t("tabMediaHosts")}
            </button>
            <button
              type="button"
              onClick={() => setBeneficiaryType("MEMBER")}
              className={form.beneficiaryType === "MEMBER" ? "btn-primary text-sm" : "btn-secondary text-sm"}
            >
              {t("tabLeaders")}
            </button>
          </div>
          <p className="mt-1 text-xs text-muted">{t("bulkPaymentGroupHelp")}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div>
            <label className="label">{t("paymentDateLabel")}</label>
            <input required type="date" className="input" value={form.paymentDate} onChange={(e) => setForm((f) => ({ ...f, paymentDate: e.target.value }))} />
          </div>
          <input className="input mt-6" placeholder={t("paymentMethodLabel")} value={form.method} onChange={(e) => setForm((f) => ({ ...f, method: e.target.value }))} />
          <input className="input mt-6" placeholder={t("currencyLabel")} value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} />
        </div>

        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            className="input pl-9"
            placeholder={t("searchPersonPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="card max-h-[320px] overflow-auto p-0">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2.5">{t("beneficiaryLabel")}</th>
                <th className="px-4 py-2.5">{t("amountLabel")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {beneficiaries.map((b) => (
                <tr key={b.id}>
                  <td className="px-4 py-2 font-medium text-ink">{b.name}</td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      min="0"
                      className="input-auto w-32"
                      value={amounts[b.id] ?? ""}
                      onChange={(e) => setAmount(b.id, e.target.value)}
                    />
                  </td>
                </tr>
              ))}
              {beneficiaries.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-6 text-center text-muted">
                    {allBeneficiaries.length > 0
                      ? t("noMatchesFound")
                      : form.beneficiaryType === "MEDIA_HOST" ? t("noMediaHostsFound") : form.beneficiaryType === "MEMBER" ? t("noLeadersFound") : t("noInfluencersFound")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <textarea className="input min-h-[60px]" placeholder="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />

        <div className="flex items-center justify-between border-t border-line pt-3">
          <p className="text-sm text-muted">
            {entries.length} {t("bulkPaymentEntriesSuffix")} · <span className="nums font-semibold text-ink">{form.currency} {total.toLocaleString()}</span>
          </p>
        </div>
        {error && <p className="text-sm text-brand">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">{t("cancel")}</button>
          <button type="submit" disabled={submitting} className="btn-primary">{submitting ? t("creatingLabel") : t("save")}</button>
        </div>
      </form>
    </Modal>
  );
}

function ExpenseSection({ organizationId, category, title, help }: { organizationId: string; category: ExpenseCategory; title: string; help: string }) {
  const { t } = useLang();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [search, setSearch] = useState("");

  const { data: expenses } = useQuery({
    queryKey: ["expenses", organizationId, category],
    queryFn: () => api.get<Expense[]>(`/api/v1/organizations/${organizationId}/expenses?category=${category}`),
  });

  const q = search.trim().toLowerCase();
  const filteredExpenses = q
    ? (expenses ?? []).filter((e) => [e.item, e.concernedParty].some((f) => (f ?? "").toLowerCase().includes(q)))
    : (expenses ?? []);

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["expenses", organizationId, category] });
    queryClient.invalidateQueries({ queryKey: ["expense-totals", organizationId] });
  }

  return (
    <div className="card">
      <Collapsible title={title} subtitle={help} bare>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <TableSearchInput value={search} onChange={setSearch} placeholder={t("searchGenericPlaceholder")} />
          <button className="btn-primary text-sm" onClick={() => setShowAdd(true)}><Plus size={15} /> {t("addExpenseCta")}</button>
        </div>
        {!expenses || expenses.length === 0 ? (
          <p className="text-sm text-muted">{t("noExpensesYet")}</p>
        ) : filteredExpenses.length === 0 ? (
          <p className="text-sm text-muted">{t("noSearchResults")}</p>
        ) : (
          <div className="max-h-[22rem] overflow-auto rounded-xl border border-line">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-2.5">{t("colItem")}</th>
                  <th className="px-4 py-2.5">{t("colQuantity")}</th>
                  <th className="px-4 py-2.5">{t("colUnitCost")}</th>
                  <th className="px-4 py-2.5">{t("colTotalCost")}</th>
                  <th className="px-4 py-2.5">{t("colDateIssued")}</th>
                  <th className="px-4 py-2.5">{t("colFor")}</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredExpenses.map((e) => (
                  <tr key={e.id} className="hover:bg-brand-50/40">
                    <td className="max-w-[200px] truncate px-4 py-2.5 font-medium text-ink">{e.item}</td>
                    <td className="nums px-4 py-2.5 text-muted">{e.quantity}</td>
                    <td className="nums px-4 py-2.5 text-muted">{e.unitCost.toLocaleString()}</td>
                    <td className="nums px-4 py-2.5 font-semibold text-ink">{e.totalCost.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-muted">{new Date(e.dateIssued).toLocaleDateString()}</td>
                    <td className="px-4 py-2.5 text-muted">{e.concernedParty ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button onClick={() => setEditing(e)} className="text-sm font-semibold text-brand hover:underline">{t("edit")}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Collapsible>

      {(showAdd || editing) && (
        <ExpenseModal
          organizationId={organizationId}
          category={category}
          initial={editing ?? undefined}
          onClose={() => { setShowAdd(false); setEditing(null); }}
          onDone={() => { setShowAdd(false); setEditing(null); refresh(); }}
        />
      )}
    </div>
  );
}

export default function FinancePage() {
  const { organizationId } = useParams<{ organizationId: string }>();
  const { t } = useLang();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const { data: me } = useAuth();
  const myRole = me?.organizations.find((o) => o.organizationId === organizationId)?.role;
  const { data: perms } = useRolePermissions(organizationId);
  // The Finance page is a review surface for everyone else (Super Admin, Admin, Standard User) —
  // only Finance itself records or marks payments here. canRecordPayment is intentionally not
  // used for this: it's broader (also gates the separate per-member "Record Payment" button on a
  // member's own profile, which stays available to admins) and touching it would loosen that too.
  const canPay = myRole === "FINANCE_OFFICER";
  const canApprove = canApprovePayment(myRole, perms?.matrix);
  const canPayAgreements = canPayPostingAgreement(myRole);
  const [showRecord, setShowRecord] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  // Only approved payments show here — a pending one only appears once someone with
  // approval rights acts on it, in the panel below.
  const { data: payments } = useQuery({
    queryKey: ["payments", organizationId, "PAID"],
    queryFn: () => api.get<Payment[]>(`/api/v1/organizations/${organizationId}/payments?status=PAID`),
  });

  const today = new Date().toISOString().slice(0, 10);
  const todaysPayments = useMemo(() => (payments ?? []).filter((p) => p.paymentDate.slice(0, 10) === today), [payments, today]);
  const todaysTotal = todaysPayments.reduce((sum, p) => sum + Number(p.paidAmount ?? p.amount), 0);

  function refreshAll() {
    queryClient.invalidateQueries({ queryKey: ["finance-dashboard", organizationId] });
    queryClient.invalidateQueries({ queryKey: ["payments", organizationId] });
  }

  return (
    <RequireAccess area="finance">
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display flex items-center gap-2 text-2xl font-extrabold text-ink">
            <Wallet size={22} className="text-brand" /> {t("financeTitle")}
          </h1>
          <p className="font-display-sub text-sm text-muted">{t("financeSubtitle")}</p>
        </div>
        {canPay && (
          <div className="flex items-center gap-2">
            <button className="btn-secondary text-sm" onClick={() => setShowAdd(true)}>{t("bulkPaymentCta")}</button>
            <button className="btn-primary text-sm" onClick={() => setShowRecord(true)}>
              <Plus size={15} /> {t("recordPaymentTitle")}
            </button>
          </div>
        )}
      </div>

      <FinanceStatCards organizationId={organizationId} />

      {canApprove && <PendingApprovalPanel organizationId={organizationId} />}

      <ReadyForPaymentPanel organizationId={organizationId} canPay={canPayAgreements} />

      <Link
        href={`/org/${organizationId}/finance/today`}
        className="card flex flex-wrap items-center justify-between gap-3 transition hover:-translate-y-0.5 hover:shadow-lg"
      >
        <div>
          <h2 className="font-display text-lg font-bold text-ink">{t("todaysPaymentsTitle")}</h2>
          <p className="text-xs text-muted">{t("todaysPaymentsHelp")}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted">{t("totalLabel")}</p>
          <p className="nums text-2xl font-bold text-ink">{todaysPayments[0]?.currency ?? "TZS"} {todaysTotal.toLocaleString()}</p>
        </div>
      </Link>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch lg:min-h-[520px]">
        <div className="space-y-4">
          <ExpenseSection organizationId={organizationId} category="OPERATIONAL" title={t("operationalCostsTitle")} help={t("operationalCostsHelp")} />
          <ExpenseSection organizationId={organizationId} category="ADMINISTRATIVE" title={t("administrativeCostsTitle")} help={t("administrativeCostsHelp")} />
        </div>
        {canPay && <ProcessingPaymentsPanel organizationId={organizationId} />}
      </div>

      <div className="flex justify-end">
        <Link href={`/org/${organizationId}/finance/reports`} className="text-sm font-medium text-brand hover:underline">
          {t("financeReportsCta")}
        </Link>
      </div>

      {showRecord && (
        <RecordPaymentModal
          organizationId={organizationId}
          canPayAgreements={canPayAgreements}
          onClose={() => setShowRecord(false)}
          onDone={() => {
            setShowRecord(false);
            showToast("success", t("entriesSaved"));
            refreshAll();
          }}
        />
      )}

      {showAdd && (
        <AddPaymentModal
          organizationId={organizationId}
          onClose={() => setShowAdd(false)}
          onDone={() => {
            setShowAdd(false);
            showToast("success", t("entriesSaved"));
            refreshAll();
          }}
        />
      )}
    </div>
    </RequireAccess>
  );
}
