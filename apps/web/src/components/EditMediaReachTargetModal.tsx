"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Modal } from "@/components/Modal";
import { useLang } from "@/lib/i18n";

/** Same shape as EditReachTargetModal, but PATCHes the organization's own mediaReachTarget
 * instead of a single media host/influencer — this is the org-wide "Media Engagement" total. */
export function EditMediaReachTargetModal({
  organizationId,
  current,
  onClose,
  onDone,
}: {
  organizationId: string;
  current: number | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useLang();
  const [value, setValue] = useState(current?.toString() ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.patch(`/api/v1/organizations/${organizationId}`, {
        mediaReachTarget: value ? Number(value) : null,
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("failedUpdateTargets"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={t("editReachTargetTitle")} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="label">{t("reachTargetLabel")}</label>
          <input autoFocus type="number" min="0" className="input" value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
        {error && <p className="text-sm text-brand">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">{t("cancel")}</button>
          <button type="submit" disabled={submitting} className="btn-primary">{submitting ? t("saving") : t("save")}</button>
        </div>
      </form>
    </Modal>
  );
}
