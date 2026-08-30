import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { RoleKey } from "@event-intel/database";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { AREA_KEY } from "../decorators/requires-area.decorator";
import { PermissionsService } from "../../modules/permissions/permissions.service";
import { actionForMethod } from "../../modules/permissions/permissions.constants";
import type { AuthenticatedRequest } from "../types";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<RoleKey[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (req.user?.isPlatformOwner) return true;
    if (!req.orgMember) throw new ForbiddenException("Organization context required");

    const area = this.reflector.getAllAndOverride<string>(AREA_KEY, [context.getHandler(), context.getClass()]);
    const action = actionForMethod(req.method);

    if (requiredRoles.includes(req.orgMember.role)) {
      // Being in the static @Roles list is normally enough — unless an admin has explicitly
      // revoked this role's (usually-default) access to this specific action on the route's area
      // via the Access control page's permission matrix, which now supports revoking as well as
      // granting, at view/create/edit/delete granularity (inferred from the HTTP method).
      if (area && (await this.permissions.isAreaRevoked(req.orgMember.organizationId, req.orgMember.role, area, action))) {
        throw new ForbiddenException(`${action} access to this area has been revoked for role: ${req.orgMember.role}`);
      }
      return true;
    }

    // Not in the static baseline — check whether an admin has additively granted this role
    // this action on the route's area via the Access control page's permission matrix.
    if (area) {
      const granted = await this.permissions.isAreaGranted(req.orgMember.organizationId, req.orgMember.role, area, action);
      if (granted) return true;
    }

    throw new ForbiddenException(`Requires one of roles: ${requiredRoles.join(", ")}`);
  }
}
