"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { AuthCard } from "@/components/AuthCard";
import { useLang } from "@/lib/i18n";

export default function ForgotPasswordPage() {
  const { t } = useLang();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await api.post("/api/v1/auth/forgot-password", { email });
    setSent(true);
  }

  return (
    <AuthCard title={t("resetPasswordTitle")}>
      {sent ? (
        <p className="text-sm text-ink">{t("resetLinkSentMsg")}</p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label">{t("email")}</label>
            <input type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <button type="submit" className="btn-primary w-full">{t("sendResetLinkBtn")}</button>
        </form>
      )}
    </AuthCard>
  );
}
