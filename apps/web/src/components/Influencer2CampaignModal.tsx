"use client";

import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Facebook, Instagram, Youtube, Twitter, Linkedin, Music2, Check, type LucideIcon } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Modal } from "@/components/Modal";
import { useLang } from "@/lib/i18n";
import type { Influencer, Influencer2Campaign, Influencer2ContentType, Influencer2Platform } from "@/lib/types";

const CONTENT_TYPES: Influencer2ContentType[] = ["VIDEO", "IMAGE", "REEL", "STORY", "ARTICLE", "PODCAST", "AUDIO", "OTHER"];

// lucide-react ships no dedicated TikTok mark — Music2 stands in for it.
const PLATFORM_ICONS: Record<string, LucideIcon> = {
  facebook: Facebook,
  instagram: Instagram,
  youtube: Youtube,
  x: Twitter,
  linkedin: Linkedin,
  tiktok: Music2,
};

interface PlatformDraft {
  postUrl: string;
  publishedAt: string;
}

/** Create/edit the campaign's Content Information — kept to just what's
 * necessary (name, content type, description, optional influencer/media-host
 * link) per explicit request to trim the form. Platform selection (with
 * per-platform Post URL/date) only appears when CREATING a new campaign —
 * once a campaign exists, platforms are managed individually from the detail
 * page (Influencer2PlatformModal) so this form never has to reconcile
 * add/remove/edit of already-attached platforms in one submit. When opened
 * from an influencer's or media host's own profile page, fixedInfluencerId/
 * fixedMediaHostId pre-fills and hides that picker entirely. */
export function Influencer2CampaignModal({
  organizationId,
  initial,
  fixedInfluencerId,
  fixedMediaHostId,
  onClose,
  onDone,
}: {
  organizationId: string;
  initial?: Influencer2Campaign;
  fixedInfluencerId?: string;
  fixedMediaHostId?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useLang();
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    contentType: initial?.contentType ?? ("VIDEO" as Influencer2ContentType),
    description: initial?.description ?? "",
    influencerId: initial?.influencerId ?? fixedInfluencerId ?? "",
  });
  const [selectedPlatformIds, setSelectedPlatformIds] = useState<Set<string>>(new Set());
  const [platformDrafts, setPlatformDrafts] = useState<Record<string, PlatformDraft>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Belt-and-suspenders against a double-fire submit (fast double-click/double-tap racing ahead
  // of the `disabled` re-render) creating two campaigns from one submit — a plain ref is checked
  // synchronously, unlike state, so it can't be raced the way `submitting` alone could.
  const submitLockRef = useRef(false);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const { data: influencers } = useQuery({
    queryKey: ["influencers", organizationId],
    queryFn: () => api.get<Influencer[]>(`/api/v1/organizations/${organizationId}/influencers`),
    enabled: !fixedInfluencerId && !fixedMediaHostId,
  });

  const { data: platforms } = useQuery({
    queryKey: ["influencer2-platforms", organizationId, form.contentType],
    queryFn: () => api.get<Influencer2Platform[]>(`/api/v1/organizations/${organizationId}/influencer2/platforms?contentType=${form.contentType}`),
    enabled: !initial,
  });

  function togglePlatform(platformId: string) {
    setSelectedPlatformIds((prev) => {
      const next = new Set(prev);
      if (next.has(platformId)) next.delete(platformId);
      else next.add(platformId);
      return next;
    });
    setPlatformDrafts((prev) => (prev[platformId] ? prev : { ...prev, [platformId]: { postUrl: "", publishedAt: "" } }));
  }

  function setDraft(platformId: string, key: keyof PlatformDraft, value: string) {
    setPlatformDrafts((prev) => ({ ...prev, [platformId]: { ...prev[platformId], [key]: value } }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        name: form.name,
        contentType: form.contentType,
        description: form.description || undefined,
        influencerId: fixedMediaHostId ? undefined : form.influencerId || undefined,
        mediaHostId: fixedMediaHostId || undefined,
      };

      if (initial) {
        await api.patch(`/api/v1/organizations/${organizationId}/influencer2/campaigns/${initial.id}`, payload);
      } else {
        const campaign = await api.post<Influencer2Campaign>(`/api/v1/organizations/${organizationId}/influencer2/campaigns`, payload);
        try {
          for (const platformId of selectedPlatformIds) {
            const draft = platformDrafts[platformId];
            await api.post(`/api/v1/organizations/${organizationId}/influencer2/campaigns/${campaign.id}/platforms`, {
              platformId,
              postUrl: draft?.postUrl || undefined,
              publishedAt: draft?.publishedAt || undefined,
            });
          }
        } catch (platformErr) {
          // The campaign itself was created but a platform failed to attach — roll it back so a
          // retry doesn't leave a second, orphaned campaign behind (what silently happened
          // before this fix: each retry left a new empty campaign with 0 platforms attached).
          await api.delete(`/api/v1/organizations/${organizationId}/influencer2/campaigns/${campaign.id}`).catch(() => {});
          throw platformErr;
        }
      }
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed");
    } finally {
      submitLockRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title={initial ? t("editInfluencer2CampaignTitle") : t("createInfluencer2CampaignTitle")}
      onClose={onClose}
      wide
      footer={
        <div>
          {error && <p className="pb-2 text-sm font-medium text-brand">{error}</p>}
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <button type="button" onClick={onClose} className="btn-secondary">{t("cancel")}</button>
            <button type="submit" form="influencer2-campaign-form" disabled={submitting} className="btn-primary">{submitting ? t("creatingLabel") : t("save")}</button>
          </div>
        </div>
      }
    >
      <form id="influencer2-campaign-form" onSubmit={onSubmit} className="space-y-3">
        <div><label className="label">{t("influencer2NameLabel")}</label><input required className="input" value={form.name} onChange={(e) => set("name", e.target.value)} /></div>

        <div>
          <label className="label">{t("contentTypeLabel")}</label>
          <select className="input" value={form.contentType} onChange={(e) => set("contentType", e.target.value as Influencer2ContentType)}>
            {CONTENT_TYPES.map((ct) => <option key={ct} value={ct}>{ct}</option>)}
          </select>
        </div>

        <div><label className="label">{t("descriptionLabel")}</label><textarea className="input min-h-[60px]" value={form.description} onChange={(e) => set("description", e.target.value)} /></div>

        {!fixedInfluencerId && !fixedMediaHostId && (
          <div>
            <label className="label">{t("influencer2InfluencerLabel")}</label>
            <select className="input" value={form.influencerId} onChange={(e) => set("influencerId", e.target.value)}>
              <option value="">{t("noneOptionLabel")}</option>
              {(influencers ?? []).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </div>
        )}

        {!initial && (
          <div className="border-t border-line pt-3">
            <label className="label">{t("influencer2WherePublishedLabel")}</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {(platforms ?? []).map((p) => {
                const Icon = PLATFORM_ICONS[p.key];
                const selected = selectedPlatformIds.has(p.id);
                return (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => togglePlatform(p.id)}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                      selected ? "border-brand bg-brand-50 text-brand-700" : "border-line bg-surface text-muted hover:border-brand/40"
                    }`}
                  >
                    {Icon && <Icon size={16} />}
                    <span className="flex-1 text-left">{p.name}</span>
                    {selected && <Check size={15} />}
                  </button>
                );
              })}
            </div>

            {[...selectedPlatformIds].map((platformId) => {
              const platform = (platforms ?? []).find((p) => p.id === platformId);
              const draft = platformDrafts[platformId] ?? { postUrl: "", publishedAt: "" };
              return (
                <div key={platformId} className="mt-3 rounded-xl bg-surface p-3">
                  <p className="mb-2 text-sm font-semibold text-ink">{platform?.name ?? platformId}</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div>
                      <label className="label">{t("influencer2PostUrlLabel")}</label>
                      <input type="url" className="input" value={draft.postUrl} onChange={(e) => setDraft(platformId, "postUrl", e.target.value)} />
                    </div>
                    <div>
                      <label className="label">{t("influencer2PublishedAtLabel")}</label>
                      <input type="date" className="input" value={draft.publishedAt} onChange={(e) => setDraft(platformId, "publishedAt", e.target.value)} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </form>
    </Modal>
  );
}
