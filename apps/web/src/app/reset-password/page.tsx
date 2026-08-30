"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { AuthCard } from "@/components/AuthCard";
import { PasswordInput } from "@/components/PasswordInput";
import { LoadingWord } from "@/components/LoadingWord";
import { useLang } from "@/lib/i18n";

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { t } = useLang();
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/api/v1/auth/reset-password", { token: params.get("token") ?? "", newPassword });
      router.replace("/login");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("resetFailed"));
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label">{t("newPasswordLabel")}</label>
        <PasswordInput required minLength={10} value={newPassword} onChange={setNewPassword} />
      </div>
      {error && <p className="text-sm text-brand">{error}</p>}
      <button type="submit" className="btn-primary w-full">{t("resetPasswordBtn")}</button>
    </form>
  );
}

export default function ResetPasswordPage() {
  const { t } = useLang();
  return (
    <AuthCard title={t("newPasswordSetTitle")}>
      <Suspense fallback={<LoadingWord className="text-sm text-muted" />}>
        <ResetPasswordForm />
      </Suspense>
    </AuthCard>
  );
}
