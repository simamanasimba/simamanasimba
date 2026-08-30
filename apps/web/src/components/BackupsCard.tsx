"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DatabaseBackup, Download, RefreshCw } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { useLang } from "@/lib/i18n";

interface BackupEntry {
  key: string;
  sizeBytes: number;
  lastModified: string | null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Platform-owner-only: full-database backups (schema + data + relations) — see BackupsController on the API. */
export function BackupsCard() {
  const { t } = useLang();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [running, setRunning] = useState(false);

  const { data: backups, isLoading } = useQuery({
    queryKey: ["platform-backups"],
    queryFn: () => api.get<BackupEntry[]>("/api/v1/platform/backups"),
  });

  async function runBackup() {
    setRunning(true);
    try {
      await api.post("/api/v1/platform/backups/run");
      await queryClient.invalidateQueries({ queryKey: ["platform-backups"] });
      showToast("success", t("backupStarted"));
    } catch (err) {
      showToast("error", err instanceof ApiError ? err.message : t("backupFailed"));
    } finally {
      setRunning(false);
    }
  }

  async function download(key: string) {
    try {
      const { url } = await api.get<{ url: string }>(`/api/v1/platform/backups/download?key=${encodeURIComponent(key)}`);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      showToast("error", err instanceof ApiError ? err.message : t("backupFailed"));
    }
  }

  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{t("backupsSectionTitle")}</h2>
          <p className="mt-1 max-w-md text-xs text-muted">{t("backupsSectionHelp")}</p>
        </div>
        <button type="button" onClick={runBackup} disabled={running} className="btn-primary shrink-0">
          {running ? <RefreshCw size={14} className="animate-spin" /> : <DatabaseBackup size={14} />}
          {running ? t("backupRunning") : t("backupRunNow")}
        </button>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted">{t("loadingLabel")}</p>
      ) : !backups?.length ? (
        <p className="text-xs text-muted">{t("noBackupsYet")}</p>
      ) : (
        <ul className="divide-y divide-line">
          {backups.map((b) => (
            <li key={b.key} className="flex items-center justify-between gap-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="nums truncate font-medium text-ink">{b.key.replace(/^db\//, "").replace(/\.sql\.gz$/, "")}</p>
                <p className="text-xs text-muted">{formatBytes(b.sizeBytes)}{b.lastModified ? ` · ${new Date(b.lastModified).toLocaleString()}` : ""}</p>
              </div>
              <button type="button" onClick={() => download(b.key)} className="btn-secondary shrink-0 text-xs">
                <Download size={13} /> {t("download")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
