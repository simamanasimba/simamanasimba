"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Modal } from "@/components/Modal";
import { useLang } from "@/lib/i18n";
import type { Expense, ExpenseCategory } from "@/lib/types";

export function ExpenseModal({
  organizationId,
  category,
  initial,
  onClose,
  onDone,
}: {
  organizationId: string;
  category: ExpenseCategory;
  initial?: Expense;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useLang();
  const [item, setItem] = useState(initial?.item ?? "");
  const [purpose, setPurpose] = useState(initial?.purpose ?? "");
  const [quantity, setQuantity] = useState(initial ? String(initial.quantity) : "1");
  const [unitCost, setUnitCost] = useState(initial ? String(initial.unitCost) : "");
  const [dateIssued, setDateIssued] = useState(initial?.dateIssued.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
  const [concernedParty, setConcernedParty] = useState(initial?.concernedParty ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const quantityNum = Number(quantity) || 0;
  const unitCostNum = Number(unitCost) || 0;
  const total = quantityNum * unitCostNum;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        category,
        item,
        purpose: purpose || undefined,
        quantity: quantityNum,
        unitCost: unitCostNum,
        dateIssued,
        concernedParty: concernedParty || undefined,
        notes: notes || undefined,
      };
      if (initial) await api.patch(`/api/v1/organizations/${organizationId}/expenses/${initial.id}`, payload);
      else await api.post(`/api/v1/organizations/${organizationId}/expenses`, payload);
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  const title = initial
    ? t("editExpenseTitle")
    : category === "OPERATIONAL"
      ? t("addOperationalCostTitle")
      : t("addAdministrativeCostTitle");

  return (
    <Modal title={title} onClose={onClose} wide>
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="label">{t("expenseItemLabel")}</label>
          <input required className="input" value={item} onChange={(e) => setItem(e.target.value)} />
        </div>
        <div>
          <label className="label">{t("expensePurposeLabel")}</label>
          <textarea className="input min-h-[60px]" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">{t("expenseQuantityLabel")}</label>
            <input required type="number" min="0.01" step="0.01" className="input" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </div>
          <div>
            <label className="label">{t("expenseUnitCostLabel")}</label>
            <input required type="number" min="0" step="0.01" className="input" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
          </div>
        </div>
        <div className="rounded-xl bg-surface p-3.5">
          <p className="text-xs text-muted">{t("expenseTotalCostLabel")}</p>
          <p className="nums font-display text-xl font-extrabold text-ink">{total.toLocaleString()}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">{t("expenseDateIssuedLabel")}</label>
            <input required type="date" className="input" value={dateIssued} onChange={(e) => setDateIssued(e.target.value)} />
          </div>
          <div>
            <label className="label">{t("expenseConcernedPartyLabel")}</label>
            <input className="input" value={concernedParty} onChange={(e) => setConcernedParty(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">{t("notesLabel")}</label>
          <textarea className="input min-h-[50px]" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        {error && <p className="text-sm text-brand">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <button type="button" onClick={onClose} className="btn-secondary">{t("cancel")}</button>
          <button type="submit" disabled={submitting} className="btn-primary">{submitting ? t("creatingLabel") : t("save")}</button>
        </div>
      </form>
    </Modal>
  );
}
