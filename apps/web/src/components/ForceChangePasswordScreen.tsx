"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { PasswordInput } from "@/components/PasswordInput";
import { BrandMark } from "@/components/BrandMark";
import { useToast } from "@/components/Toast";
import { useLang } from "@/lib/i18n";

/** Blocks the app behind a mandatory password change — shown when the signed-in user still has
 * the temporary password an admin set for them (their last name) at account-creation time. */
export function ForceChangePasswordScreen() {
  const { t } = useLang();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError(t("passwordsDontMatch"));
      return;
    }
    setBusy(true);
    try {
      await api.post("/api/v1/auth/change-password", { currentPassword, newPassword });
      queryClient.invalidateQueries({ queryKey: ["me"] });
      showToast("success", t("passwordChanged"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("failedChangePassword"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center app-bg px-4">
      <div className="card w-full max-w-sm">
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-gradient text-white shadow-pop">
            <BrandMark className="h-5 w-5" color="white" />
          </div>
          <ShieldCheck size={18} className="text-brand" />
        </div>
        <h1 className="font-display text-lg font-bold text-ink">{t("forceChangePasswordTitle")}</h1>
        <p className="mt-1 text-sm text-muted">{t("forceChangePasswordBody")}</p>
        <form onSubmit={onSubmit} className="mt-5 space-y-3">
          <div>
            <label className="label">{t("currentPasswordLabel")}</label>
            <PasswordInput required value={currentPassword} onChange={setCurrentPassword} />
          </div>
          <div>
            <label className="label">{t("newPasswordLabel")}</label>
            <PasswordInput required minLength={10} value={newPassword} onChange={setNewPassword} />
          </div>
          <div>
            <label className="label">{t("confirmNewPasswordLabel")}</label>
            <PasswordInput required minLength={10} value={confirmPassword} onChange={setConfirmPassword} />
          </div>
          {error && <p className="text-sm text-brand">{error}</p>}
          <button type="submit" disabled={busy} className="btn-primary w-full">{busy ? t("updatingLabel") : t("updatePasswordBtn")}</button>
        </form>
      </div>
    </div>
  );
}
