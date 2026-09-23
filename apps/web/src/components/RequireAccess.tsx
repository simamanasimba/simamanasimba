"use client";

import { useParams } from "next/navigation";
import { ShieldOff } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useRolePermissions } from "@/hooks/useRolePermissions";
import { useLang } from "@/lib/i18n";
import { canAccess, type NavKey } from "@/lib/permissions";

/** Gates an org page behind the current user's role for this org. Renders nothing while auth is
 * still loading (the page's own content will follow once it resolves), and a plain "no access"
 * card instead of the page when the role doesn't permit this area. */
export function RequireAccess({ area, children }: { area: NavKey; children: React.ReactNode }) {
  const { organizationId } = useParams<{ organizationId: string }>();
  const { data, isLoading } = useAuth();
  const { data: perms } = useRolePermissions(organizationId);
  const { t } = useLang();

  if (isLoading) return null;
  // Mirrors RolesGuard's own `if (req.user?.isPlatformOwner) return true` bypass on the backend —
  // without this, a platform owner's org-role badge (which can be anything, e.g. Finance Officer)
  // still hid pages the API would actually let them through to, including Access Control itself,
  // the one door back in when no org role can reach it.
  if (data?.user.isPlatformOwner) return <>{children}</>;
  const role = data?.organizations.find((o) => o.organizationId === organizationId)?.role;
  if (!canAccess(role, area, perms?.matrix)) {
    return (
      <div className="card flex flex-col items-center gap-3 py-16 text-center">
        <ShieldOff size={32} className="text-muted" />
        <h1 className="font-display text-lg font-bold text-ink">{t("noPermissionTitle")}</h1>
        <p className="max-w-sm text-sm text-muted">{t("noPermissionBody")}</p>
      </div>
    );
  }
  return <>{children}</>;
}
