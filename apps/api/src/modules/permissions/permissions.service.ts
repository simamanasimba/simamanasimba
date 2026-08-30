import { BadRequestException, Injectable } from "@nestjs/common";
import type { RoleKey } from "@event-intel/database";
import { PrismaService } from "../../prisma/prisma.service";
import { ALL_ROLES, AREAS, AREA_DEFAULT_ROLES, HARD_BASELINE_ROLES, ALWAYS_LOCKED_AREAS, type PermissionArea } from "./permissions.constants";

function isLocked(role: RoleKey, area: PermissionArea): boolean {
  return (HARD_BASELINE_ROLES as RoleKey[]).includes(role) || ALWAYS_LOCKED_AREAS.includes(area);
}

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Used by RolesGuard for routes tagged @RequiresArea — the static @Roles baseline is already
   * checked before this runs, so this only needs to answer "is there an additive grant." */
  async isAreaGranted(organizationId: string, role: RoleKey, area: string): Promise<boolean> {
    if (!AREAS.includes(area as PermissionArea)) return false;
    const override = await this.prisma.orgRolePermission.findUnique({
      where: { organizationId_role_area: { organizationId, role, area } },
    });
    return override?.allowed ?? false;
  }

  /** Used by RolesGuard when the caller's role IS in the route's static @Roles baseline — an
   * explicit override with allowed:false means an admin revoked this role's normally-default-on
   * access to this area, so the static @Roles allow-list alone must not be enough to get through. */
  async isAreaRevoked(organizationId: string, role: RoleKey, area: string): Promise<boolean> {
    if (!AREAS.includes(area as PermissionArea)) return false;
    const permArea = area as PermissionArea;
    if (isLocked(role, permArea) || !AREA_DEFAULT_ROLES[permArea].includes(role)) return false;
    const override = await this.prisma.orgRolePermission.findUnique({
      where: { organizationId_role_area: { organizationId, role, area } },
    });
    return override?.allowed === false;
  }

  async getMatrix(organizationId: string) {
    const overrides = await this.prisma.orgRolePermission.findMany({ where: { organizationId } });
    const overrideMap = new Map(overrides.map((o) => [`${o.role}:${o.area}`, o.allowed]));

    const matrix: Record<string, Record<string, { allowed: boolean; editable: boolean }>> = {};
    const grants: Record<string, RoleKey[]> = {};
    for (const area of AREAS) {
      matrix[area] = {};
      grants[area] = [];
      for (const role of ALL_ROLES) {
        const locked = isLocked(role, area as PermissionArea);
        const defaultOn = AREA_DEFAULT_ROLES[area].includes(role);
        const override = overrideMap.get(`${role}:${area}`);
        const allowed = locked ? defaultOn : (override ?? defaultOn);
        matrix[area][role] = { allowed, editable: !locked };
        if (!locked && !defaultOn && allowed) grants[area].push(role);
      }
    }
    return { areas: AREAS, roles: ALL_ROLES, matrix, grants };
  }

  async setOverride(organizationId: string, role: RoleKey, area: PermissionArea, allowed: boolean) {
    if (!ALL_ROLES.includes(role)) throw new BadRequestException("Unknown role");
    if (!AREAS.includes(area)) throw new BadRequestException("Unknown area");
    if (isLocked(role, area)) {
      throw new BadRequestException("This role's access to this area is fixed and can't be changed");
    }
    await this.prisma.orgRolePermission.upsert({
      where: { organizationId_role_area: { organizationId, role, area } },
      create: { organizationId, role, area, allowed },
      update: { allowed },
    });
    return this.getMatrix(organizationId);
  }
}
