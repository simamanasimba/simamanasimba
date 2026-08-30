import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { AuthenticatedRequest } from "../types";

/** Available on routes guarded by OrgMembershipGuard — the caller's membership in the :organizationId route param. */
export const CurrentOrg = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
  return req.orgMember;
});
