"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { BrandMark } from "@/components/BrandMark";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useLang } from "@/lib/i18n";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface PublicBranding {
  name: string;
  logoUrl: string | null;
  heroImageUrl: string | null;
}

export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  const { t } = useLang();
  const { data: branding } = useQuery({
    queryKey: ["public-branding"],
    queryFn: () => api.get<PublicBranding>("/api/v1/public/branding"),
  });
  const logoSrc = branding?.logoUrl ? (branding.logoUrl.startsWith("http") ? branding.logoUrl : `${API_BASE}${branding.logoUrl}`) : null;

  return (
    <div className="app-bg flex min-h-screen items-center justify-center px-4">
      <div className="fixed right-4 top-4 z-10 sm:right-6 sm:top-6">
        <LanguageToggle />
      </div>
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="mx-auto mb-4 flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-brand-gradient text-white shadow-pop">
            {logoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoSrc} alt="" className="h-full w-full object-cover" />
            ) : (
              <BrandMark className="h-7 w-7" color="white" />
            )}
          </Link>
          <p className="font-display text-sm font-bold uppercase tracking-wide text-brand-700">Tunasimama na Simba</p>
          <h1 className="font-display mt-1 text-2xl font-extrabold text-ink">{title}</h1>
          {subtitle && <p className="font-display-sub mt-1 text-sm text-muted">{subtitle}</p>}
        </div>
        <div className="card">{children}</div>
        <p className="mt-6 text-center text-sm text-muted">
          <Link href="/login" className="font-medium text-brand-700 hover:underline">← {t("backHome")}</Link>
        </p>
      </div>
    </div>
  );
}
