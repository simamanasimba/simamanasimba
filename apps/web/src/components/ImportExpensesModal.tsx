"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { useLang } from "@/lib/i18n";
import type { ExpenseCategory } from "@/lib/types";

interface ImportResult {
  created: number;
  errors: string[];
}

/** One category per import — matches the section it was opened from, so the CSV only needs the
 * same fields the "Add" form asks for (no category column to get wrong). */
export function ImportExpensesModal({
  organizationId,
  category,
  onClose,
  onImported,
}: {
  organizationId: string;
  category: ExpenseCategory;
  onClose: () => void;
  onImported: () => void;
}) {
  const { t } = useLang();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setSubmitting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/v1/organizations/${organizationId}/expenses/import?category=${category}`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? t("importFailed"));
      }
      const data = (await res.json()) as ImportResult;
      setResult(data);
      onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("importFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={t("importExpensesTitle")} onClose={onClose}>
      {result ? (
        <div className="space-y-3">
          <p className="text-sm text-ink">
            {t("importCreatedPrefix")} <span className="font-semibold text-success">{result.created}</span>
          </p>
          {result.errors.length > 0 && (
            <div className="max-h-32 overflow-y-auto rounded-lg bg-brand-50 p-3 text-xs text-brand-700">
              {result.errors.map((e, i) => (
                <p key={i}>{e}</p>
              ))}
            </div>
          )}
          <button onClick={onClose} className="btn-primary w-full">{t("doneBtn")}</button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <p className="text-sm text-muted">{t("csvColumnsExpensesHelp")}</p>
          <input type="file" accept=".csv" required onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="input" />
          {error && <p className="text-sm text-brand">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-secondary">{t("cancel")}</button>
            <button type="submit" disabled={submitting || !file} className="btn-primary">{submitting ? t("importingLabel") : t("import")}</button>
          </div>
        </form>
      )}
    </Modal>
  );
}
