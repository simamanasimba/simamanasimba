"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { PasswordInput } from "@/components/PasswordInput";
import { BrandMark } from "@/components/BrandMark";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useLang } from "@/lib/i18n";
import type { MeResponse } from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const SLIDE_INTERVAL_MS = 5500;

interface PublicBranding {
  name: string;
  logoUrl: string | null;
  heroImageUrl: string | null;
  heroSlides: string[];
}

export default function LoginPage() {
  const { t } = useLang();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: branding } = useQuery({
    queryKey: ["public-branding"],
    queryFn: () => api.get<PublicBranding>("/api/v1/public/branding"),
  });
  const slides = (() => {
    const list = branding?.heroSlides?.length ? branding.heroSlides : branding?.heroImageUrl ? [branding.heroImageUrl] : [];
    return list.map((s) => (s.startsWith("http") ? s : `${API_BASE}${s}`));
  })();
  const [slideIndex, setSlideIndex] = useState(0);

  useEffect(() => {
    if (slides.length < 2) return;
    const timer = setInterval(() => setSlideIndex((i) => (i + 1) % slides.length), SLIDE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [slides.length]);

  const logoSrc = branding?.logoUrl ? (branding.logoUrl.startsWith("http") ? branding.logoUrl : `${API_BASE}${branding.logoUrl}`) : null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/api/v1/auth/login", { email, password });
      // Fetch /auth/me fresh right here and go straight to the right
      // destination — the landing page ("/") no longer force-redirects logged-in
      // admins away (they need to be able to view it themselves), so login can't
      // rely on that redirect chain anymore.
      const me = await api.get<MeResponse>("/api/v1/auth/me");
      if (me.organizations?.length) {
        window.location.href = `/org/${me.organizations[0].organizationId}/dashboard`;
      } else {
        window.location.href = "/register";
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("loginFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Left half — full-height brand photo, crossfading through every uploaded slide, hidden on small screens */}
      <div className="relative hidden overflow-hidden bg-ink lg:block lg:w-1/2">
        {slides.length === 0 && <div className="absolute inset-0 bg-brand-gradient" />}
        {slides.map((src, i) => (
          <div
            key={src}
            className="absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ease-in-out"
            style={{ backgroundImage: `url(${src})`, opacity: i === slideIndex % slides.length ? 1 : 0 }}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/20 to-ink/10" />
        <div className="relative flex h-full flex-col justify-end p-12 text-white">
          <p className="animate-rise-in font-display text-2xl font-extrabold">Tunasimama na Simba</p>
          <p className="animate-rise-in mt-3 max-w-sm text-white/85" style={{ animationDelay: "0.1s" }}>{t("heroBody")}</p>
        </div>
        {slides.length > 1 && (
          <div className="absolute bottom-5 left-12 z-10 flex gap-1.5">
            {slides.map((src, i) => (
              <button
                key={src}
                aria-label={`${i + 1}`}
                onClick={() => setSlideIndex(i)}
                className={`h-1.5 rounded-full transition-all ${i === slideIndex % slides.length ? "w-5 bg-white" : "w-1.5 bg-white/40"}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Right half — login form. On mobile (no hero panel) this gets its own
          soft brand wash + card so the page doesn't read as a bare white form. */}
      <div className="app-bg relative flex flex-1 items-center justify-center px-4 py-10 lg:bg-none lg:bg-white">
        <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
          <LanguageToggle />
        </div>
        <div className="w-full max-w-sm">
          <div className="mb-6 text-center lg:mb-8">
            <Link href="/" className="animate-pop-in mx-auto mb-4 flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-brand-gradient text-white shadow-pop lg:h-12 lg:w-12 lg:rounded-xl">
              {logoSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoSrc} alt="" className="h-full w-full object-cover" />
              ) : (
                <BrandMark className="h-8 w-8 lg:h-7 lg:w-7" color="white" />
              )}
            </Link>
            <p className="animate-rise-in font-display text-sm font-bold uppercase tracking-wide text-brand-700 lg:hidden" style={{ animationDelay: "0.1s" }}>Tunasimama na Simba</p>
            <h1 className="animate-rise-in font-display mt-1 text-2xl font-extrabold text-ink lg:mt-0" style={{ animationDelay: "0.15s" }}>{t("signInTitle")}</h1>
          </div>

          <form onSubmit={onSubmit} className="animate-rise-in card space-y-4 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none" style={{ animationDelay: "0.2s" }}>
            <div>
              <label className="label" htmlFor="email">{t("email")}</label>
              <input id="email" type="email" autoComplete="username" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="password">{t("password")}</label>
              <PasswordInput id="password" autoComplete="current-password" required value={password} onChange={setPassword} />
            </div>
            {error && <p className="text-sm text-brand">{error}</p>}
            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? t("signingIn") : t("signIn")}
            </button>
            <div className="text-center text-sm text-muted">
              <Link href="/forgot-password" className="hover:text-brand">{t("forgotPassword")}</Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
