import type { RoleKey } from "@event-intel/database";

/** All assignable org roles (PLATFORM_OWNER is a separate cross-org superuser flag, not
 * something an organization assigns to its own members). */
export const ALL_ROLES: RoleKey[] = ["ORG_SUPER_ADMIN", "ORG_ADMIN", "FINANCE_OFFICER", "STANDARD_USER"];

export const AREAS = [
  "dashboard",
  "members",
  "influencers",
  "media-hosts",
  "events",
  "reports",
  "finance",
  "payment-approval",
  "settings",
  "access-control",
] as const;

export type PermissionArea = (typeof AREAS)[number];

/** The one role that can never be edited out of any area, in either direction — the account's
 * permanent safety net. If every other role's access to an area gets misconfigured (including
 * "access-control" itself), an ORG_SUPER_ADMIN can always get back in and fix it. Per explicit
 * request, ORG_ADMIN's access is no longer in this permanent category — see AREA_DEFAULT_ROLES
 * below, it's now a revocable *default* instead of a fixed baseline. */
export const HARD_BASELINE_ROLES: RoleKey[] = ["ORG_SUPER_ADMIN"];

/** Each area's default-on roles — mirrors apps/web/src/lib/permissions.ts's NAV_ACCESS (kept as
 * a second, hand-maintained copy the same way this codebase already mirrors it a third time in
 * the Access control page's display-only CAPABILITY_MATRIX). Being in this list just sets the
 * starting checkbox state; every role except HARD_BASELINE_ROLES can have that default flipped
 * either way through the override table now (grant OR revoke) — "editable" in the matrix means
 * exactly that. "finance" here covers the read-only Reports page and its underlying payment/
 * expense data — the FINANCE_OFFICER-only operational Payments page has its own separate, fixed
 * rule and is not part of this override system. */
export const AREA_DEFAULT_ROLES: Record<PermissionArea, RoleKey[]> = {
  // Included only so the matrix has a row for it; every cell is baseline (non-editable) since
  // there's nothing left to grant. Finance is excluded — their own Payments page is their
  // dashboard now, matching apps/web/src/lib/permissions.ts's NAV_ACCESS.
  dashboard: ALL_ROLES.filter((r) => r !== "FINANCE_OFFICER"),
  members: ["ORG_SUPER_ADMIN", "ORG_ADMIN"],
  influencers: ["ORG_SUPER_ADMIN", "ORG_ADMIN", "FINANCE_OFFICER"],
  "media-hosts": ["ORG_SUPER_ADMIN", "ORG_ADMIN", "FINANCE_OFFICER"],
  events: ["ORG_SUPER_ADMIN", "ORG_ADMIN"],
  reports: ["ORG_SUPER_ADMIN", "ORG_ADMIN"],
  finance: ["ORG_SUPER_ADMIN", "ORG_ADMIN", "FINANCE_OFFICER"],
  // Who may approve/reject a pending payment — deliberately narrower than "finance" itself
  // (Finance can record/view payments but a payment they create shouldn't be self-approved by
  // the same role by default). An admin can additively grant this to FINANCE_OFFICER (or
  // STANDARD_USER) from the Access control page if that's how the club wants to run it.
  "payment-approval": ["ORG_SUPER_ADMIN", "ORG_ADMIN"],
  settings: ["ORG_SUPER_ADMIN", "ORG_ADMIN"],
  "access-control": ["ORG_SUPER_ADMIN", "ORG_ADMIN"],
};

/** Areas where an override is actually consulted by a backend guard (RolesGuard, via
 * @RequiresArea on the relevant routes) — members/finance/settings/access-control map onto real
 * @Roles-protected controllers. The rest (influencers, media-hosts, events, reports) have no
 * role-restricted GET routes today, so an override there only changes frontend nav visibility —
 * same level of protection those areas already have. */
export const BACKEND_ENFORCED_AREAS: PermissionArea[] = ["members", "finance", "payment-approval", "settings", "access-control"];

/** "access-control" is the one area where even ORG_ADMIN's default access stays locked
 * (non-editable), on top of ORG_SUPER_ADMIN above — it's the only door back into this page. If
 * an org has no ORG_SUPER_ADMIN account and an ORG_ADMIN revoked their own access here, there
 * would be no self-service way back in at all. Every other area is fully editable for ORG_ADMIN. */
export const ALWAYS_LOCKED_AREAS: PermissionArea[] = ["access-control"];
