"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X, Ban, RotateCcw, Trash2, Lock } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { useLang, type DictKey } from "@/lib/i18n";
import { RequireAccess } from "@/components/RequireAccess";
import { useRolePermissions } from "@/hooks/useRolePermissions";
import { useAuth } from "@/hooks/useAuth";
import type { PermissionArea, PermissionAction, RoleKey } from "@/lib/permissions";

interface OrgUser {
  userId: string;
  role: string;
  status: string;
  user: { email: string; firstName: string; lastName: string };
}

const ROLES = ["ORG_SUPER_ADMIN", "ORG_ADMIN", "FINANCE_OFFICER", "STANDARD_USER"];

const ROLE_KEYS: Record<string, DictKey> = {
  ORG_SUPER_ADMIN: "roleOrgSuperAdmin",
  ORG_ADMIN: "roleOrgAdmin",
  FINANCE_OFFICER: "roleFinanceOfficer",
  STANDARD_USER: "roleStandardUser",
};

// The editable rows — each backed by a live GET .../role-permissions area. Kept separate from
// "record-payment", which has its own fixed rule (see recordPaymentFixedNote) and isn't part of
// the override system, so it's rendered as a plain note below the table instead of a row.
const CAPABILITY_ROWS: { labelKey: DictKey; area: PermissionArea }[] = [
  { labelKey: "capabilityDashboard", area: "dashboard" },
  { labelKey: "capabilityMembers", area: "members" },
  { labelKey: "capabilityInfluencers", area: "influencers" },
  { labelKey: "capabilityMediaHosts", area: "media-hosts" },
  { labelKey: "capabilityEvents", area: "events" },
  { labelKey: "capabilityTracker", area: "tracker" },
  { labelKey: "capabilityReports", area: "reports" },
  { labelKey: "capabilityFinance", area: "finance" },
  { labelKey: "capabilityPaymentApproval", area: "payment-approval" },
  { labelKey: "capabilitySettings", area: "settings" },
  { labelKey: "capabilityAccessControlArea", area: "access-control" },
];

const ACTIONS: { action: PermissionAction; labelKey: DictKey }[] = [
  { action: "view", labelKey: "actionView" },
  { action: "create", labelKey: "actionCreate" },
  { action: "edit", labelKey: "actionEdit" },
  { action: "delete", labelKey: "actionDelete" },
];

function CapabilityMatrix({ organizationId }: { organizationId: string }) {
  const { t } = useLang();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const { data: perms } = useRolePermissions(organizationId);
  const [pending, setPending] = useState<string | null>(null);
  const [action, setAction] = useState<PermissionAction>("view");

  async function toggle(role: string, area: PermissionArea, allowed: boolean) {
    const key = `${role}:${area}:${action}`;
    setPending(key);
    try {
      await api.patch(`/api/v1/organizations/${organizationId}/role-permissions`, { role, area, action, allowed });
      queryClient.invalidateQueries({ queryKey: ["role-permissions", organizationId] });
      showToast("success", t("permissionUpdated"));
    } catch (err) {
      showToast("error", err instanceof ApiError ? err.message : t("failedUpdatePermission"));
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="card overflow-x-auto">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{t("whatEachRoleCanSeeTitle")}</h2>
        <div className="flex gap-1 rounded-lg border border-line/60 bg-surface p-1">
          {ACTIONS.map((a) => (
            <button
              key={a.action}
              type="button"
              onClick={() => setAction(a.action)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${action === a.action ? "bg-white text-ink shadow-sm" : "text-muted"}`}
            >
              {t(a.labelKey)}
            </button>
          ))}
        </div>
      </div>
      <p className="mb-4 max-w-2xl text-xs text-muted">{t("permissionMatrixHelp")}</p>
      <table className="w-full min-w-[900px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
            <th className="py-2 pr-3">{t("capabilityArea")}</th>
            {ROLES.map((r) => (
              <th key={r} className="whitespace-nowrap px-2 py-2 text-center font-medium">{t(ROLE_KEYS[r])}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {CAPABILITY_ROWS.map((row) => (
            <tr key={row.area} className="border-b border-line/60">
              <td className="py-2 pr-3 font-medium text-ink">{t(row.labelKey)}</td>
              {ROLES.map((role) => {
                const cell = perms?.matrix?.[row.area]?.[action]?.[role as RoleKey];
                if (!cell) {
                  return <td key={role} className="px-2 py-2 text-center text-muted/40">—</td>;
                }
                if (!cell.editable) {
                  return (
                    <td key={role} className="px-2 py-2 text-center" title={t("builtInAccessHint")}>
                      {cell.allowed ? <Check size={15} className="mx-auto text-emerald-600" /> : <X size={15} className="mx-auto text-muted/40" />}
                    </td>
                  );
                }
                return (
                  <td key={role} className="px-2 py-2 text-center">
                    <input
                      type="checkbox"
                      disabled={pending === `${role}:${row.area}:${action}`}
                      checked={cell.allowed}
                      onChange={(e) => toggle(role, row.area, e.target.checked)}
                      className="h-4 w-4 rounded border-line accent-brand-600 disabled:opacity-40"
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 border-t border-line pt-3 text-xs text-muted">{t("recordPaymentFixedNote")}</p>
    </div>
  );
}

function TeamMembersCard({ organizationId }: { organizationId: string }) {
  const { t } = useLang();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { data: me } = useAuth();
  const myRole = me?.organizations.find((o) => o.organizationId === organizationId)?.role;
  const isSuperAdmin = myRole === "ORG_SUPER_ADMIN";
  const [invite, setInvite] = useState({ email: "", firstName: "", lastName: "", role: "STANDARD_USER" });

  const { data: users, refetch } = useQuery({
    queryKey: ["org-users", organizationId],
    queryFn: () => api.get<OrgUser[]>(`/api/v1/organizations/${organizationId}/users`),
  });

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    try {
      const result = await api.post<{ temporaryPassword?: string }>(`/api/v1/organizations/${organizationId}/users/invite`, invite);
      setInvite({ email: "", firstName: "", lastName: "", role: "STANDARD_USER" });
      refetch();
      showToast(
        "success",
        result.temporaryPassword
          ? `${t("invitedPrefix")} ${invite.email} — ${t("temporaryPasswordPrefix")}: "${result.temporaryPassword}"`
          : `${t("invitedPrefix")} ${invite.email}`,
      );
    } catch (err) {
      showToast("error", err instanceof ApiError ? err.message : t("failedInvite"));
    }
  }

  async function updateRole(userId: string, role: string) {
    try {
      await api.patch(`/api/v1/organizations/${organizationId}/users/${userId}`, { role });
      queryClient.invalidateQueries({ queryKey: ["org-users", organizationId] });
      showToast("success", t("roleUpdated"));
    } catch (err) {
      showToast("error", err instanceof ApiError ? err.message : t("failedUpdateRole"));
    }
  }

  async function toggleSuspend(userId: string, currentStatus: string) {
    const nextStatus = currentStatus === "SUSPENDED" ? "ACTIVE" : "SUSPENDED";
    try {
      await api.patch(`/api/v1/organizations/${organizationId}/users/${userId}`, { status: nextStatus });
      queryClient.invalidateQueries({ queryKey: ["org-users", organizationId] });
      showToast("success", nextStatus === "SUSPENDED" ? t("userSuspended") : t("userReactivated"));
    } catch (err) {
      showToast("error", err instanceof ApiError ? err.message : t("failedUpdateRole"));
    }
  }

  async function deleteMember(userId: string, name: string) {
    if (!window.confirm(`${t("confirmDeleteAccount")} ${name}?`)) return;
    try {
      await api.delete(`/api/v1/organizations/${organizationId}/users/${userId}`);
      queryClient.invalidateQueries({ queryKey: ["org-users", organizationId] });
      showToast("success", t("accountDeleted"));
    } catch (err) {
      showToast("error", err instanceof ApiError ? err.message : t("failedDeleteAccount"));
    }
  }

  return (
    <div className="card">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{t("teamMembers")}</h2>
      <form onSubmit={sendInvite} className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-5">
        <input className="input" placeholder={t("email")} type="email" required value={invite.email} onChange={(e) => setInvite((f) => ({ ...f, email: e.target.value }))} />
        <input className="input" placeholder={t("firstName")} required value={invite.firstName} onChange={(e) => setInvite((f) => ({ ...f, firstName: e.target.value }))} />
        <input className="input" placeholder={t("lastName")} required value={invite.lastName} onChange={(e) => setInvite((f) => ({ ...f, lastName: e.target.value }))} />
        <select className="input" value={invite.role} onChange={(e) => setInvite((f) => ({ ...f, role: e.target.value }))}>
          {ROLES.map((r) => <option key={r} value={r}>{t(ROLE_KEYS[r])}</option>)}
        </select>
        <button type="submit" className="btn-primary">{t("invite")}</button>
      </form>

      <ul className="max-h-96 divide-y divide-line overflow-y-auto">
        {(users ?? []).map((u) => (
          <li key={u.userId} className="flex items-center justify-between gap-3 py-2.5 text-sm">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate font-medium text-ink">{u.user.firstName} {u.user.lastName}</p>
                {u.status === "SUSPENDED" && <span className="badge shrink-0 bg-brand-50 text-brand-700">{t("suspendedLabel")}</span>}
              </div>
              <p className="truncate text-xs text-muted">{u.user.email}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {u.role === "ORG_SUPER_ADMIN" ? (
                <span className="input flex w-48 items-center gap-1.5 !bg-surface text-muted" title={t("superAdminRoleLockedHint")}>
                  <Lock size={13} /> {t(ROLE_KEYS[u.role])}
                </span>
              ) : (
                <select className="input w-48" value={u.role} onChange={(e) => updateRole(u.userId, e.target.value)}>
                  {ROLES.map((r) => <option key={r} value={r}>{t(ROLE_KEYS[r])}</option>)}
                </select>
              )}
              <button
                type="button"
                onClick={() => toggleSuspend(u.userId, u.status)}
                title={u.status === "SUSPENDED" ? t("reactivateCta") : t("suspendCta")}
                className="btn-secondary !px-2.5 !py-2"
              >
                {u.status === "SUSPENDED" ? <RotateCcw size={14} /> : <Ban size={14} />}
              </button>
              {isSuperAdmin && (
                <button
                  type="button"
                  onClick={() => deleteMember(u.userId, `${u.user.firstName} ${u.user.lastName}`)}
                  title={t("deleteAccountCta")}
                  className="btn-secondary !px-2.5 !py-2 !text-brand hover:!bg-brand-50"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function AccessControlPage() {
  const { organizationId } = useParams<{ organizationId: string }>();
  const { t } = useLang();

  return (
    <RequireAccess area="access-control">
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-ink">{t("accessControlTitle")}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">{t("accessControlHelp")}</p>
        </div>
        <TeamMembersCard organizationId={organizationId} />
        <CapabilityMatrix organizationId={organizationId} />
      </div>
    </RequireAccess>
  );
}
