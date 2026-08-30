"use client";

import { useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { api } from "@/lib/api";
import { readBrandingCache, writeBrandingCache } from "@/lib/brandingCache";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * Full-screen boot splash — shown once per page load. Shows the
 * organization's uploaded logo (Settings → Branding) once one exists;
 * otherwise a plain placeholder mark. Pure CSS transitions, no artwork.
 */
export function SplashScreen({ onDone }: { onDone?: () => void }) {
  const [hiding, setHiding] = useState(false);
  const [gone, setGone] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    const cached = readBrandingCache();
    if (cached?.logoUrl) setLogoUrl(cached.logoUrl.startsWith("http") ? cached.logoUrl : `${API_BASE}${cached.logoUrl}`);

    api
      .get<{ name: string; logoUrl: string | null; heroImageUrl: string | null }>("/api/v1/public/branding")
      .then((branding) => {
        if (branding?.logoUrl) setLogoUrl(branding.logoUrl.startsWith("http") ? branding.logoUrl : `${API_BASE}${branding.logoUrl}`);
        writeBrandingCache(branding);
      })
      .catch(() => {
        // No branding configured yet — the placeholder mark covers this.
      });
  }, []);

  useEffect(() => {
    const hideTimer = setTimeout(() => setHiding(true), 1100);
    const goneTimer = setTimeout(() => {
      setGone(true);
      onDone?.();
    }, 1500);
    return () => {
      clearTimeout(hideTimer);
      clearTimeout(goneTimer);
    };
  }, [onDone]);

  if (gone) return null;

  return (
    <div
      className={`fixed inset-0 z-[999] flex flex-col items-center justify-center bg-white transition-opacity duration-400 ${
        hiding ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <div className="animate-splash-in flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl bg-brand-gradient shadow-pop">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <BrandMark className="h-12 w-12" color="white" />
        )}
      </div>
      <p className="animate-splash-fade font-display mt-5 text-2xl font-extrabold tracking-tight text-ink">Tunasimama na Simba</p>

      <style>{`
        @keyframes splash-in {
          0%   { transform: scale(0.85); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-splash-in { animation: splash-in 0.45s cubic-bezier(.2,.8,.3,1) both; }

        @keyframes splash-fade {
          0% { opacity: 0; transform: translateY(4px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .animate-splash-fade { animation: splash-fade 0.4s ease-out 0.2s both; }
      `}</style>
    </div>
  );
}
