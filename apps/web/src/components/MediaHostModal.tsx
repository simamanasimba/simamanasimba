"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { Modal } from "@/components/Modal";
import { Collapsible } from "@/components/Collapsible";
import { useLang } from "@/lib/i18n";
import type { MediaHost, MediaOutlet, MediaOutletCatalog } from "@/lib/types";

const MEDIA_HOST_TYPES = ["TV", "RADIO", "NEWSPAPER", "WEBSITE", "BLOG", "SOCIAL_MEDIA", "ONLINE_TV", "NEWS_WEBSITE", "MAGAZINE", "FORUM", "PODCAST", "DIGITAL_PUBLISHER", "OTHER"];

/** "New media host" — Type is the primary pick: it narrows Media/Channel/Kipindi to only what
 * this org has actually registered (never a pre-loaded list of every media house that could
 * exist). Media/Channel/Kipindi are typed, not just picked — same as Host's own name field —
 * with existing values offered as suggestions via native <datalist>. Picking an existing Media
 * name loads its own already-used Channels; picking an existing Channel loads its own
 * already-used Kipindi/sessions. Typing a brand new name at any level is always allowed — that's
 * how a media house's very first host ever gets registered, with no chicken-and-egg dropdown to
 * populate first. */
export function MediaHostModal({
  organizationId,
  mediaHost,
  onClose,
  onDone,
}: {
  organizationId: string;
  mediaHost?: MediaHost;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useLang();
  const isEdit = Boolean(mediaHost);
  const [form, setForm] = useState({
    name: mediaHost?.name ?? "",
    type: mediaHost?.type ?? "TV",
    mediaName: mediaHost?.mediaOutlet?.name ?? "",
    channelName: mediaHost?.channelName ?? "",
    programName: mediaHost?.programName ?? "",
    bankName: mediaHost?.bankName ?? "",
    bankAccountName: mediaHost?.bankAccountName ?? "",
    bankAccountNumber: mediaHost?.bankAccountNumber ?? "",
    mobileMoneyNumber: mediaHost?.mobileMoneyNumber ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: outlets } = useQuery({
    queryKey: ["media-outlets", organizationId, form.type],
    queryFn: () => api.get<MediaOutlet[]>(`/api/v1/organizations/${organizationId}/media-outlets?type=${form.type}`),
  });
  const matchedOutlet = (outlets ?? []).find((o) => o.name.trim().toLowerCase() === form.mediaName.trim().toLowerCase());

  const { data: catalog } = useQuery({
    queryKey: ["media-outlet-catalog", organizationId, matchedOutlet?.id, form.type],
    queryFn: () => api.get<MediaOutletCatalog>(`/api/v1/organizations/${organizationId}/media-outlets/${matchedOutlet!.id}/catalog?type=${form.type}`),
    enabled: Boolean(matchedOutlet),
  });
  const channels = catalog?.channels ?? [];
  const matchedChannel = channels.find((c) => c.name.trim().toLowerCase() === form.channelName.trim().toLowerCase());

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function changeType(type: string) {
    setForm((f) => ({ ...f, type, mediaName: "", channelName: "", programName: "" }));
  }

  function changeMediaName(mediaName: string) {
    setForm((f) => ({ ...f, mediaName, channelName: "", programName: "" }));
  }

  function changeChannel(channelName: string) {
    setForm((f) => ({ ...f, channelName, programName: "" }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      let mediaOutletId = matchedOutlet?.id;
      if (!mediaOutletId && form.mediaName.trim()) {
        const created = await api.post<MediaOutlet>(`/api/v1/organizations/${organizationId}/media-outlets`, { name: form.mediaName.trim() });
        mediaOutletId = created.id;
      }

      const body = {
        name: form.name,
        type: form.type,
        mediaOutletId: mediaOutletId || undefined,
        channelName: form.channelName || undefined,
        programName: form.programName || undefined,
        bankName: form.bankName || undefined,
        bankAccountName: form.bankAccountName || undefined,
        bankAccountNumber: form.bankAccountNumber || undefined,
        mobileMoneyNumber: form.mobileMoneyNumber || undefined,
      };
      if (isEdit) {
        await api.patch(`/api/v1/organizations/${organizationId}/media-hosts/${mediaHost!.id}`, body);
      } else {
        await api.post(`/api/v1/organizations/${organizationId}/media-hosts`, body);
      }
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("failedCreatePost"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title={isEdit ? t("editMediaHost") : t("newMediaHost")}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <button type="button" onClick={onClose} className="btn-secondary">{t("cancel")}</button>
          <button type="submit" form="media-host-form" disabled={submitting} className="btn-primary">{submitting ? t("saving") : t("save")}</button>
        </div>
      }
    >
      <form id="media-host-form" onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">{t("hostNameLabel")}</label>
            <input required autoFocus className="input" value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div>
            <label className="label">{t("hostTypeLabel")}</label>
            <select className="input" value={form.type} onChange={(e) => changeType(e.target.value)}>
              {MEDIA_HOST_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">{t("mediaOutletLabel")}</label>
            <input
              className="input"
              list="media-outlet-options"
              placeholder={t("typeOrPickPlaceholder")}
              value={form.mediaName}
              onChange={(e) => changeMediaName(e.target.value)}
            />
            <datalist id="media-outlet-options">
              {(outlets ?? []).map((o) => <option key={o.id} value={o.name} />)}
            </datalist>
          </div>
          <div>
            <label className="label">{t("mediaChannelLabel")}</label>
            <input
              className="input disabled:opacity-50"
              disabled={!form.mediaName.trim()}
              list="media-channel-options"
              placeholder={t("typeOrPickPlaceholder")}
              value={form.channelName}
              onChange={(e) => changeChannel(e.target.value)}
            />
            <datalist id="media-channel-options">
              {channels.map((c) => <option key={c.name} value={c.name} />)}
            </datalist>
          </div>
          <div>
            <label className="label">{t("mediaSessionLabel")}</label>
            <input
              className="input disabled:opacity-50"
              disabled={!form.channelName.trim()}
              list="media-session-options"
              placeholder={t("typeOrPickPlaceholder")}
              value={form.programName}
              onChange={(e) => set("programName", e.target.value)}
            />
            <datalist id="media-session-options">
              {(matchedChannel?.programs ?? []).map((p) => <option key={p} value={p} />)}
            </datalist>
          </div>
        </div>

        <Collapsible title={t("bankingInfoTitle")} subtitle={t("bankingInfoHelp")}>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">{t("bankNameLabel")}</label><input className="input" value={form.bankName} onChange={(e) => set("bankName", e.target.value)} /></div>
            <div><label className="label">{t("bankAccountNameLabel")}</label><input className="input" value={form.bankAccountName} onChange={(e) => set("bankAccountName", e.target.value)} /></div>
            <div><label className="label">{t("bankAccountNumberLabel")}</label><input className="input" value={form.bankAccountNumber} onChange={(e) => set("bankAccountNumber", e.target.value)} /></div>
            <div><label className="label">{t("mobileMoneyNumberLabel")}</label><input className="input" value={form.mobileMoneyNumber} onChange={(e) => set("mobileMoneyNumber", e.target.value)} /></div>
          </div>
        </Collapsible>

        {error && <p className="pt-3 text-sm text-brand">{error}</p>}
      </form>
    </Modal>
  );
}
