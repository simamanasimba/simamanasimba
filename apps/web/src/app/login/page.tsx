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

  const heroSlideLayer = (
    <>
      {slides.length === 0 && <div className="absolute inset-0 bg-brand-gradient" />}
      {slides.map((src, i) => (
        <div
          key={src}
          className="absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ease-in-out"
          style={{ backgroundImage: `url(${src})`, opacity: i === slideIndex % slides.length ? 1 : 0 }}
        />
      ))}
    </>
  );
  function renderHeroDots(positionClassName: string) {
    if (slides.length < 2) return null;
    return (
      <div className={`absolute z-10 flex gap-1.5 ${positionClassName}`}>
        {slides.map((src, i) => (
          <button
            key={src}
            aria-label={`${i + 1}`}
            onClick={() => setSlideIndex(i)}
            className={`h-1.5 rounded-full transition-all ${i === slideIndex % slides.length ? "w-5 bg-white" : "w-1.5 bg-white/40"}`}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Mobile-only top hero — same crossfading slides as the desktop panel below, just
          reflowed as a top band with a bottom-sheet-style form card overlapping its edge,
          since there's no room for a side-by-side split on a phone screen. */}
      <div className="relative h-[40vh] min-h-[280px] w-full overflow-hidden bg-ink lg:hidden">
        {heroSlideLayer}
        <div className="absolute inset-0 bg-gradient-to-b from-ink/20 via-ink/10 to-ink" />
        <div className="absolute right-4 top-4">
          <LanguageToggle />
        </div>
        <div className="relative flex h-full flex-col justify-end p-6 pb-12 text-white">
          <p className="animate-rise-in font-display text-3xl font-extrabold leading-tight">{t("helloGreeting")}</p>
          <p className="animate-rise-in font-display text-3xl font-extrabold leading-tight" style={{ animationDelay: "0.1s" }}>{t("signInTitle")}</p>
        </div>
        {renderHeroDots("bottom-4 left-6")}
      </div>

      {/* Left half — full-height brand photo, desktop only. */}
      <div className="relative hidden overflow-hidden bg-ink lg:block lg:w-1/2">
        {heroSlideLayer}
        <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/20 to-ink/10" />
        <div className="relative flex h-full flex-col justify-end p-12 text-white">
          <p className="animate-rise-in font-display text-2xl font-extrabold">Tunasimama na Simba</p>
          <p className="animate-rise-in mt-3 max-w-sm text-white/85" style={{ animationDelay: "0.1s" }}>{t("heroBody")}</p>
        </div>
        {renderHeroDots("bottom-5 left-12")}
      </div>

      {/* Form — a bottom sheet overlapping the hero band on mobile, a plain centered
          column on desktop (its own soft brand wash there since there's no hero to sit on). */}
      <div className="app-bg relative -mt-6 flex flex-1 items-start justify-center rounded-t-3xl px-4 pb-10 pt-7 lg:mt-0 lg:items-center lg:rounded-none lg:bg-none lg:bg-white lg:py-10">
        <div className="absolute right-4 top-4 hidden sm:right-6 sm:top-6 lg:block">
          <LanguageToggle />
        </div>
        <div className="w-full max-w-sm">
          <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-line lg:hidden" />

          <div className="mb-6 text-center lg:mb-8">
            <Link href="/" className="animate-pop-in mx-auto mb-4 hidden h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-brand-gradient text-white shadow-pop lg:flex">
              {logoSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoSrc} alt="" className="h-full w-full object-cover" />
              ) : (
                <BrandMark className="h-7 w-7" color="white" />
              )}
            </Link>
            <h1 className="animate-rise-in font-display text-xl font-extrabold text-ink lg:text-2xl" style={{ animationDelay: "0.15s" }}>{t("loginCardSubtitle")}</h1>
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
