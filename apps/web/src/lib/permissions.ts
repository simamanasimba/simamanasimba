export type RoleKey = "ORG_SUPER_ADMIN" | "ORG_ADMIN" | "FINANCE_OFFICER" | "STANDARD_USER" | "GUEST_USER";

export type NavKey =
  | "dashboard"
  | "people"
  | "members"
  | "influencers"
  | "media-hosts"
  | "events"
  | "reports"
  | "influencer2"
  | "finance"
  | "finance-reports"
  | "settings"
  | "access-control";

/** Which roles can see each area of the app. Admin-equivalent roles always have full access.
 * Trimmed to just ORG_SUPER_ADMIN/ORG_ADMIN/FINANCE_OFFICER/STANDARD_USER per explicit request —
 * the former specialist roles (event manager, attendance officer, membership officer, digital
 * intelligence analyst, report viewer) are gone, so most operational areas are admin-only now. A
 * STANDARD_USER can still be granted extra area access later via the Access control page's
 * additive OrgRolePermission overrides. */
const NAV_ACCESS: Record<NavKey, RoleKey[]> = {
  // Finance's own dashboard IS the Payments page ("finance" below) now — no separate Dashboard
  // link for them, matching dashboard/page.tsx's redirect for that role. GUEST_USER gets the same
  // minimal default as STANDARD_USER everywhere (mirrors permissions.constants.ts's ALL_ROLES
  // comment) — its own defining trait is the active-window check, not area access.
  dashboard: ["ORG_SUPER_ADMIN", "ORG_ADMIN", "STANDARD_USER", "GUEST_USER"],
  // "people" is the sidebar group container — visible if any child below it is. Members are
  // event-attendee data and unrelated to Finance's job, so FINANCE_OFFICER is deliberately left
  // out of "members" while still included in "influencers"/"media-hosts" (who they pay).
  people: ["ORG_SUPER_ADMIN", "ORG_ADMIN", "FINANCE_OFFICER"],
  members: ["ORG_SUPER_ADMIN", "ORG_ADMIN"],
  influencers: ["ORG_SUPER_ADMIN", "ORG_ADMIN", "FINANCE_OFFICER"],
  "media-hosts": ["ORG_SUPER_ADMIN", "ORG_ADMIN", "FINANCE_OFFICER"],
  events: ["ORG_SUPER_ADMIN", "ORG_ADMIN"],
  reports: ["ORG_SUPER_ADMIN", "ORG_ADMIN"],
  // Influencer 2 is an isolated, experimental content-engagement module (see
  // packages/database/prisma/schema.prisma).
  influencer2: ["ORG_SUPER_ADMIN", "ORG_ADMIN"],
  // The operational Finance page (recording payments, entering costs) is Finance's own working
  // page — admins get the read-only "final report" (finance-reports) instead, not this one.
  finance: ["FINANCE_OFFICER"],
  "finance-reports": ["ORG_SUPER_ADMIN", "ORG_ADMIN", "FINANCE_OFFICER"],
  settings: ["ORG_SUPER_ADMIN", "ORG_ADMIN"],
  // ORG_ADMIN deliberately excluded by default — mirrors permissions.constants.ts's
  // AREA_DEFAULT_ROLES. Only ORG_SUPER_ADMIN sees Access Control out of the box now; an
  // ORG_ADMIN's access is a plain, revocable/grantable toggle from the live permission matrix
  // (canAccess() below reads that matrix first — this fallback only matters before it loads).
  "access-control": ["ORG_SUPER_ADMIN"],
};

const ADMIN_ROLES: RoleKey[] = ["ORG_SUPER_ADMIN", "ORG_ADMIN"];

/** The areas an org admin can grant EXTRA roles access to from the Access control page's
 * permission matrix — mirrors apps/api/src/modules/permissions/permissions.constants.ts. Not
 * every NavKey has one: "people" is a derived group (visible if any child below it is) and the
 * operational "finance" page (recording payments) has its own fixed, non-overridable rule —
 * only the read-only Reports page ("finance-reports") is part of this system, under the
 * combined backend area "finance". */
export type PermissionArea = "dashboard" | "members" | "influencers" | "media-hosts" | "events" | "tracker" | "reports" | "finance" | "payment-approval" | "settings" | "access-control";

/** The CRUD dimension layered on top of area — mirrors permissions.constants.ts's ACTIONS. */
export type PermissionAction = "view" | "create" | "edit" | "delete";

export interface PermissionMatrixCell {
  allowed: boolean;
  editable: boolean;
}

export interface PermissionMatrixResponse {
  areas: PermissionArea[];
  actions: PermissionAction[];
  roles: RoleKey[];
  matrix: Record<PermissionArea, Record<PermissionAction, Record<RoleKey, PermissionMatrixCell>>>;
  grants: Record<PermissionArea, Record<PermissionAction, RoleKey[]>>;
}

const NAV_TO_PERMISSION_AREA: Partial<Record<NavKey, PermissionArea>> = {
  dashboard: "dashboard",
  members: "members",
  influencers: "influencers",
  "media-hosts": "media-hosts",
  events: "events",
  reports: "reports",
  "finance-reports": "finance",
  settings: "settings",
  "access-control": "access-control",
};

/** `matrix` (from GET .../role-permissions) is optional so every existing call site keeps working
 * unchanged before that query resolves — pass it once a component has fetched the org's live
 * permission matrix so this reflects the real, current answer: an admin-granted extra role, OR a
 * default role whose access to this area has since been explicitly revoked. Falls back to the
 * fixed defaults below only when there's no matrix entry for this area (areas with no backend
 * permission area at all, like "people"/"influencer2"/the operational "finance" page) or it
 * hasn't loaded yet. */
export function canAccess(role: string | undefined | null, area: NavKey, matrix?: PermissionMatrixResponse["matrix"]): boolean {
  if (!role) return false;
  const permArea = NAV_TO_PERMISSION_AREA[area];
  const cell = permArea ? matrix?.[permArea]?.view?.[role as RoleKey] : undefined;
  if (cell) return cell.allowed;
  return NAV_ACCESS[area]?.includes(role as RoleKey) ?? false;
}

/** Whether `role` can perform `action` (create/edit/delete — "view" is canAccess's job) in `area`,
 * per the live matrix. Locked/admin-equivalent roles always resolve true via the matrix itself
 * (see permissions.service.ts's getMatrix); this only meaningfully gates non-admin roles. */
export function canDo(role: string | undefined | null, area: PermissionArea, action: Exclude<PermissionAction, "view">, matrix?: PermissionMatrixResponse["matrix"]): boolean {
  if (!role) return false;
  const cell = matrix?.[area]?.[action]?.[role as RoleKey];
  if (cell) return cell.allowed;
  return ADMIN_ROLES.includes(role as RoleKey);
}

/** Only admins and the Finance role are allowed to record/edit payments — everyone else can view what finance shares with them but not act. */
export function canRecordPayment(role: string | undefined | null): boolean {
  if (!role) return false;
  return ADMIN_ROLES.includes(role as RoleKey) || role === "FINANCE_OFFICER";
}

/** Who can set up or edit a posting agreement (target, rate, attachment) and manage its campaigns
 * — Super Admin and Admin have this exactly like Finance does (same set as canRecordPayment;
 * named separately so this isn't coupled to payment-recording specifically). Setting up the deal
 * is a different responsibility from actually paying it out — see canPayPostingAgreement. */
export function canManagePostingAgreement(role: string | undefined | null): boolean {
  return canRecordPayment(role);
}

/** Who can actually mark a met-target week/campaign as paid — Finance only. An admin (including
 * Super Admin) can set up the agreement and follow the money, but paying it out is exclusively
 * Finance's action, not an admin's. */
export function canPayPostingAgreement(role: string | undefined | null): boolean {
  return role === "FINANCE_OFFICER";
}

/** Who may approve/reject a pending payment — admins by default, but (like canAccess) that
 * default can now be revoked for ORG_ADMIN specifically, and granted to other roles, via the
 * Access control page's matrix. */
export function canApprovePayment(role: string | undefined | null, matrix?: PermissionMatrixResponse["matrix"]): boolean {
  if (!role) return false;
  const cell = matrix?.["payment-approval"]?.edit?.[role as RoleKey];
  if (cell) return cell.allowed;
  return ADMIN_ROLES.includes(role as RoleKey);
}

/** Influencer 2 has no separate viewer/manager split — whoever can see the module can create/
 * edit in it. */
export function canManageInfluencer2(role: string | undefined | null): boolean {
  return canAccess(role, "influencer2");
}

export function isOrgAdmin(role: string | undefined | null): boolean {
  return Boolean(role && ADMIN_ROLES.includes(role as RoleKey));
}

/** "Action Access Control": edit/delete a posting agreement, edit or undo a payment — locked to
 * Super Admin only (matching the backend's own @Roles("ORG_SUPER_ADMIN") on each of those routes),
 * always with a mandatory reason, flagged in the Sensitive Actions log for review. */
export function isSuperAdmin(role: string | undefined | null): boolean {
  return role === "ORG_SUPER_ADMIN";
}
