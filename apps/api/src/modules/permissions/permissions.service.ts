import { BadRequestException, Injectable } from "@nestjs/common";
import type { RoleKey } from "@event-intel/database";
import { PrismaService } from "../../prisma/prisma.service";
import {
  ALL_ROLES,
  AREAS,
  ACTIONS,
  AREA_DEFAULT_ROLES,
  HARD_BASELINE_ROLES,
  ALWAYS_LOCKED_AREAS,
  type PermissionArea,
  type PermissionAction,
} from "./permissions.constants";

function isLocked(role: RoleKey, area: PermissionArea): boolean {
  return (HARD_BASELINE_ROLES as RoleKey[]).includes(role) || ALWAYS_LOCKED_AREAS.includes(area);
}

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Used by RolesGuard for routes tagged @RequiresArea — the static @Roles baseline is already
   * checked before this runs, so this only needs to answer "is there an additive grant for this
   * (area, action) pair." */
  async isAreaGranted(organizationId: string, role: RoleKey, area: string, action: PermissionAction): Promise<boolean> {
    if (!AREAS.includes(area as PermissionArea)) return false;
    const override = await this.prisma.orgRolePermission.findUnique({
      where: { organizationId_role_area_action: { organizationId, role, area, action } },
    });
    return override?.allowed ?? false;
  }

  /** Used by RolesGuard when the caller's role IS in the route's static @Roles baseline — an
   * explicit override with allowed:false means an admin revoked this role's normally-default-on
   * access to this (area, action) pair, so the static @Roles allow-list alone must not be enough
   * to get through. */
  async isAreaRevoked(organizationId: string, role: RoleKey, area: string, action: PermissionAction): Promise<boolean> {
    if (!AREAS.includes(area as PermissionArea)) return false;
    const permArea = area as PermissionArea;
    if (isLocked(role, permArea) || !AREA_DEFAULT_ROLES[permArea].includes(role)) return false;
    const override = await this.prisma.orgRolePermission.findUnique({
      where: { organizationId_role_area_action: { organizationId, role, area, action } },
    });
    return override?.allowed === false;
  }

  async getMatrix(organizationId: string) {
    const overrides = await this.prisma.orgRolePermission.findMany({ where: { organizationId } });
    const overrideMap = new Map(overrides.map((o) => [`${o.role}:${o.area}:${o.action}`, o.allowed]));

    const matrix: Record<string, Record<string, Record<string, { allowed: boolean; editable: boolean }>>> = {};
    const grants: Record<string, Record<string, RoleKey[]>> = {};
    for (const area of AREAS) {
      matrix[area] = {};
      grants[area] = {};
      for (const action of ACTIONS) {
        matrix[area][action] = {};
        grants[area][action] = [];
        for (const role of ALL_ROLES) {
          const locked = isLocked(role, area as PermissionArea);
          // "view" defaults to the area's normal default roles; create/edit/delete default OFF
          // for everyone except the two admin roles (who always retain full access regardless —
          // see isLocked) — a fresh org starts with the same narrow write access it always had,
          // nothing silently opens up write access just because view was already granted.
          const defaultOn = action === "view" ? AREA_DEFAULT_ROLES[area].includes(role) : role === "ORG_SUPER_ADMIN" || role === "ORG_ADMIN";
          const override = overrideMap.get(`${role}:${area}:${action}`);
          const allowed = locked ? defaultOn : (override ?? defaultOn);
          matrix[area][action][role] = { allowed, editable: !locked };
          if (!locked && !defaultOn && allowed) grants[area][action].push(role);
        }
      }
    }
    return { areas: AREAS, actions: ACTIONS, roles: ALL_ROLES, matrix, grants };
  }

  async setOverride(organizationId: string, role: RoleKey, area: PermissionArea, action: PermissionAction, allowed: boolean) {
    if (!ALL_ROLES.includes(role)) throw new BadRequestException("Unknown role");
    if (!AREAS.includes(area)) throw new BadRequestException("Unknown area");
    if (!ACTIONS.includes(action)) throw new BadRequestException("Unknown action");
    if (isLocked(role, area)) {
      throw new BadRequestException("This role's access to this area is fixed and can't be changed");
    }
    await this.prisma.orgRolePermission.upsert({
      where: { organizationId_role_area_action: { organizationId, role, area, action } },
      create: { organizationId, role, area, action, allowed },
      update: { allowed },
    });
    return this.getMatrix(organizationId);
  }
}
