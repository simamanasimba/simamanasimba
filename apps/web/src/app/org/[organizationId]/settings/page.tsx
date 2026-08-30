"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload, X, ShieldCheck, ChevronRight } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { BrandMark } from "@/components/BrandMark";
import { useToast } from "@/components/Toast";
import { LanguageToggle } from "@/components/LanguageToggle";
import { Collapsible } from "@/components/Collapsible";
import { useLang } from "@/lib/i18n";
import { RequireAccess } from "@/components/RequireAccess";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface OrgDetails {
  id: string;
  name: string;
  logoUrl: string | null;
  heroImageUrl: string | null;
  settings?: { heroSlides?: string[] };
}

function BrandingCard({ organizationId }: { organizationId: string }) {
  const { t } = useLang();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { data: org } = useQuery({
    queryKey: ["org", organizationId],
    queryFn: () => api.get<OrgDetails>(`/api/v1/organizations/${organizationId}`),
  });
  const [name, setName] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingSlide, setUploadingSlide] = useState(false);

  const currentName = name || org?.name || "";
  const dirty = Boolean((name && name !== org?.name) || logoFile);

  function onPickLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  async function uploadImage(kind: "logo" | "hero", file: File) {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`/api/v1/organizations/${organizationId}/branding/${kind}`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? t("uploadFailed"));
  }

  async function onAddSlide(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingSlide(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/v1/organizations/${organizationId}/branding/hero-slides`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? t("uploadFailed"));
      queryClient.invalidateQueries({ queryKey: ["org", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["public-branding"] });
      showToast("success", t("slideAdded"));
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : t("uploadFailed"));
    } finally {
      setUploadingSlide(false);
    }
  }

  async function onRemoveSlide(url: string) {
    try {
      await api.delete(`/api/v1/organizations/${organizationId}/branding/hero-slides`, { url });
      queryClient.invalidateQueries({ queryKey: ["org", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["public-branding"] });
      showToast("success", t("slideRemoved"));
    } catch (err) {
      showToast("error", err instanceof ApiError ? err.message : t("uploadFailed"));
    }
  }

  async function saveAll(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (name && name !== org?.name) {
        await api.patch(`/api/v1/organizations/${organizationId}`, { name: currentName });
      }
      if (logoFile) await uploadImage("logo", logoFile);

      queryClient.invalidateQueries({ queryKey: ["org", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["me"] });
      queryClient.invalidateQueries({ queryKey: ["public-branding"] });
      setLogoFile(null);
      showToast("success", t("brandingSaved"));
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : t("uploadFailed"));
    } finally {
      setSaving(false);
    }
  }

  const logoSrc = logoPreview ?? (org?.logoUrl ? (org.logoUrl.startsWith("http") ? org.logoUrl : `${API_BASE}${org.logoUrl}`) : null);
  const slideCount = (org?.settings?.heroSlides ?? []).length;

  return (
    <form onSubmit={saveAll} className="card">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{t("branding")}</h2>
        <button type="submit" disabled={saving || !dirty} className="btn-primary shrink-0">{saving ? t("saving") : t("save")}</button>
      </div>

      <div>
        <label className="label">{t("orgName")}</label>
        <input className="input" value={currentName} onChange={(e) => setName(e.target.value)} />
      </div>

      <Collapsible title={t("logoSectionTitle")} subtitle={t("logoSectionHelp")}>
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-brand-gradient shadow-pop">
            {logoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoSrc} alt="Organization logo" className="h-full w-full object-cover" />
            ) : (
              <BrandMark className="h-8 w-8" color="white" />
            )}
          </div>
          <label className="btn-secondary cursor-pointer text-xs">
            <Upload size={13} /> {t("uploadLogo")}
            <input type="file" accept="image/*" className="hidden" onChange={onPickLogo} />
          </label>
          {logoFile && <span className="text-xs text-muted">{t("unsavedChangeNote")}</span>}
        </div>
      </Collapsible>

      <Collapsible title={t("slideImagesLabel")} subtitle={`${t("slideImagesHelp")}${slideCount ? ` · ${slideCount}` : ""}`}>
        <div className="flex flex-wrap items-center gap-3">
          {(org?.settings?.heroSlides ?? []).map((slide) => {
            const src = slide.startsWith("http") ? slide : `${API_BASE}${slide}`;
            return (
              <div key={slide} className="group relative h-20 w-36 shrink-0 overflow-hidden rounded-xl bg-cover bg-center shadow-pop" style={{ backgroundImage: `url(${src})` }}>
                <button
                  type="button"
                  onClick={() => onRemoveSlide(slide)}
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-ink/70 text-white opacity-0 transition group-hover:opacity-100"
                  aria-label={t("close")}
                >
                  <X size={13} />
                </button>
              </div>
            );
          })}
          <label className="btn-secondary cursor-pointer text-xs">
            <Upload size={13} /> {uploadingSlide ? t("uploadingLabel") : t("addSlide")}
            <input type="file" accept="image/*" className="hidden" onChange={onAddSlide} disabled={uploadingSlide} />
          </label>
        </div>
      </Collapsible>
    </form>
  );
}

export default function SettingsPage() {
  const { organizationId } = useParams<{ organizationId: string }>();
  const { t } = useLang();

  return (
    <RequireAccess area="settings">
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-extrabold text-ink">{t("settingsTitle")}</h1>

      <div className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{t("languageSectionTitle")}</h2>
          <p className="mt-1 max-w-md text-xs text-muted">{t("languageSectionHelp")}</p>
        </div>
        <LanguageToggle />
      </div>

      <BrandingCard organizationId={organizationId} />

      <Link
        href={`/org/${organizationId}/access-control`}
        className="card flex items-center justify-between gap-3 transition hover:border-brand-200"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-pop">
            <ShieldCheck size={18} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-ink">{t("goToAccessControl")}</h2>
            <p className="mt-0.5 max-w-md text-xs text-muted">{t("goToAccessControlHelp")}</p>
          </div>
        </div>
        <ChevronRight size={18} className="shrink-0 text-muted" />
      </Link>
    </div>
    </RequireAccess>
  );
}
