import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { AuthenticatedRequest } from "../types";

/**
 * Resolves the caller's membership for the :organizationId route param and
 * attaches it as req.orgMember. This is the tenant-isolation boundary: every
 * organization-scoped controller must use this guard, and every service
 * method must filter by req.orgMember.organizationId — never by a body/query
 * value — so organization A can never read or write organization B's data.
 */
@Injectable()
export class OrgMembershipGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!req.user) throw new UnauthorizedException("Authentication required");

    const organizationId = req.params.organizationId as string;
    if (!organizationId) {
      throw new ForbiddenException("Missing organization context");
    }

    if (req.user.isPlatformOwner) {
      req.orgMember = { organizationId, role: "ORG_SUPER_ADMIN" };
      return true;
    }

    const membership = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId: req.user.id } },
    });

    if (!membership || membership.status !== "ACTIVE") {
      throw new ForbiddenException("You do not have access to this organization");
    }

    // A guest's window is checked here, not at login — same as SUSPENDED above, the account can
    // still authenticate, but every request scoped to this organization is refused outside it.
    if (membership.role === "GUEST_USER") {
      const now = new Date();
      if ((membership.activeFrom && now < membership.activeFrom) || (membership.activeUntil && now > membership.activeUntil)) {
        throw new ForbiddenException("This guest account is not active right now");
      }
    }

    req.orgMember = { organizationId, role: membership.role };
    return true;
  }
}
