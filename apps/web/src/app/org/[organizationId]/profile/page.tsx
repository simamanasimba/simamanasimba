"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/Toast";
import { PasswordInput } from "@/components/PasswordInput";
import { LoadingWord } from "@/components/LoadingWord";
import { CropImageModal } from "@/components/CropImageModal";
import { useLang } from "@/lib/i18n";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function ProfilePage() {
  const { data } = useAuth();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { t } = useLang();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  if (!data?.user) return <LoadingWord />;
  const user = data.user;

  const displayFirstName = firstName || user.firstName;
  const displayLastName = lastName || user.lastName;
  const displayPhone = phone || user.phone || "";
  const initials = `${displayFirstName[0] ?? ""}${displayLastName[0] ?? ""}`.toUpperCase();
  const avatarSrc = user.profilePhotoUrl ? (user.profilePhotoUrl.startsWith("http") ? user.profilePhotoUrl : `${API_BASE}${user.profilePhotoUrl}`) : null;

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await api.patch("/api/v1/auth/me", { firstName: displayFirstName, lastName: displayLastName, phone: displayPhone || undefined });
      queryClient.invalidateQueries({ queryKey: ["me"] });
      showToast("success", t("profileUpdated"));
    } catch (err) {
      showToast("error", err instanceof ApiError ? err.message : t("failedUpdateProfile"));
    } finally {
      setSavingProfile(false);
    }
  }

  async function uploadAvatar(blob: Blob) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", blob, "profile-photo.jpg");
      const res = await fetch(`/api/v1/auth/me/avatar`, { method: "POST", credentials: "include", body: formData });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? t("uploadFailed"));
      queryClient.invalidateQueries({ queryKey: ["me"] });
      showToast("success", t("profilePhotoUpdated"));
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : t("uploadFailed"));
    } finally {
      setUploading(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setChangingPassword(true);
    try {
      await api.post("/api/v1/auth/change-password", { currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      showToast("success", t("passwordChanged"));
    } catch (err) {
      showToast("error", err instanceof ApiError ? err.message : t("failedChangePassword"));
    } finally {
      setChangingPassword(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="font-display text-2xl font-extrabold text-ink">{t("myProfileTitle")}</h1>

      <div className="card">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">{t("photoDetailsTitle")}</h2>
        <div className="flex flex-col items-start gap-6 sm:flex-row">
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-brand-gradient text-lg font-bold text-white shadow-pop">
              {avatarSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <label className="btn-secondary cursor-pointer text-xs">
              <Upload size={13} /> {uploading ? t("uploadingLabel") : t("uploadPhoto")}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) setCropSrc(URL.createObjectURL(file));
                }}
              />
            </label>
          </div>
          <form onSubmit={saveProfile} className="flex-1 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">{t("firstName")}</label>
                <input className="input" value={displayFirstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div>
                <label className="label">{t("lastName")}</label>
                <input className="input" value={displayLastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="label">{t("phone")}</label>
              <input className="input" value={displayPhone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <label className="label">{t("email")}</label>
              <input className="input bg-surface" value={user.email} disabled />
            </div>
            <button type="submit" disabled={savingProfile} className="btn-primary">{savingProfile ? t("saving") : t("saveChangesBtn")}</button>
          </form>
        </div>
      </div>

      <div className="card">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">{t("changePasswordTitle")}</h2>
        <form onSubmit={changePassword} className="max-w-sm space-y-3">
          <div>
            <label className="label">{t("currentPasswordLabel")}</label>
            <PasswordInput required value={currentPassword} onChange={setCurrentPassword} />
          </div>
          <div>
            <label className="label">{t("newPasswordLabel")}</label>
            <PasswordInput required minLength={10} value={newPassword} onChange={setNewPassword} />
          </div>
          <button type="submit" disabled={changingPassword} className="btn-primary">{changingPassword ? t("updatingLabel") : t("updatePasswordBtn")}</button>
        </form>
      </div>

      {cropSrc && (
        <CropImageModal
          imageSrc={cropSrc}
          onClose={() => setCropSrc(null)}
          onDone={(blob) => {
            setCropSrc(null);
            uploadAvatar(blob);
          }}
        />
      )}
    </div>
  );
}
