import type { RoleKey } from "@event-intel/database";

/** All assignable org roles (PLATFORM_OWNER is a separate cross-org superuser flag, not
 * something an organization assigns to its own members). GUEST_USER gets the exact same minimal
 * defaults as STANDARD_USER everywhere below (it's simply never added to any area's list, same as
 * STANDARD_USER isn't, except "dashboard"'s filter-based inclusion) — its own defining trait,
 * the active-window check, lives on OrganizationMember/OrgMembershipGuard instead, not here. */
export const ALL_ROLES: RoleKey[] = ["ORG_SUPER_ADMIN", "ORG_ADMIN", "FINANCE_OFFICER", "STANDARD_USER", "GUEST_USER"];

export const AREAS = [
  "dashboard",
  "members",
  "influencers",
  "media-hosts",
  "events",
  "tracker",
  "reports",
  "finance",
  "payment-approval",
  "settings",
  "access-control",
] as const;

export type PermissionArea = (typeof AREAS)[number];

/** The CRUD dimension layered on top of area — inferred from the request's HTTP method by
 * RolesGuard (GET→view, POST→create, PATCH/PUT→edit, DELETE→delete), never set explicitly by
 * route decorators. An override now targets one (area, action) pair, not the whole area. */
export const ACTIONS = ["view", "create", "edit", "delete"] as const;
export type PermissionAction = (typeof ACTIONS)[number];

export function actionForMethod(method: string): PermissionAction {
  switch (method.toUpperCase()) {
    case "POST":
      return "create";
    case "PATCH":
    case "PUT":
      return "edit";
    case "DELETE":
      return "delete";
    default:
      return "view";
  }
}

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
  tracker: ["ORG_SUPER_ADMIN", "ORG_ADMIN", "FINANCE_OFFICER"],
  reports: ["ORG_SUPER_ADMIN", "ORG_ADMIN"],
  finance: ["ORG_SUPER_ADMIN", "ORG_ADMIN", "FINANCE_OFFICER"],
  // Who may approve/reject a pending payment — deliberately narrower than "finance" itself
  // (Finance can record/view payments but a payment they create shouldn't be self-approved by
  // the same role by default). An admin can additively grant this to FINANCE_OFFICER (or
  // STANDARD_USER) from the Access control page if that's how the club wants to run it.
  "payment-approval": ["ORG_SUPER_ADMIN", "ORG_ADMIN"],
  settings: ["ORG_SUPER_ADMIN", "ORG_ADMIN"],
  // ORG_ADMIN is deliberately NOT included by default — per explicit request, only ORG_SUPER_ADMIN
  // (the permanent HARD_BASELINE_ROLES safety net below) sees Access Control out of the box. An
  // ORG_ADMIN's access is now a normal, revocable/grantable toggle like any other area (see
  // ALWAYS_LOCKED_AREAS below, which no longer includes this area), just off by default.
  "access-control": ["ORG_SUPER_ADMIN"],
};

/** Areas where an override is actually consulted by a backend guard (RolesGuard, via
 * @RequiresArea — now class-level on every relevant controller, so every view/create/edit/delete
 * route in these areas is covered, not just GETs). "dashboard" has no controller of its own (it's
 * an aggregate view over other endpoints' own guards) so it's intentionally left out here. */
export const BACKEND_ENFORCED_AREAS: PermissionArea[] = [
  "members",
  "influencers",
  "media-hosts",
  "events",
  "tracker",
  "reports",
  "finance",
  "payment-approval",
  "settings",
  "access-control",
];

/** No area is unconditionally locked anymore — "access-control" used to be, so even ORG_ADMIN's
 * default access there couldn't be edited either way; per explicit request it's now a plain
 * revocable/grantable toggle like every other area (default off — see AREA_DEFAULT_ROLES above).
 * ORG_SUPER_ADMIN's own access-control access still can't be removed, via HARD_BASELINE_ROLES
 * above (a global rule, not tied to this array) — that's the permanent door back in. */
export const ALWAYS_LOCKED_AREAS: PermissionArea[] = [];
