import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { OrgMembershipGuard } from "../../common/guards/org-membership.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";

/** "Action Access Control": the handful of destructive/correcting actions (edit/delete a posting
 * agreement, edit or undo a payment) that are locked to Super Admin only and always require a
 * stated reason — see each action's own controller for the lockdown + reason requirement. This is
 * just the read side: the list Super Admin reviews for follow-up. Every entry already carries its
 * `reason` in `metadata` (recorded by the action itself), so nothing further is needed here beyond
 * filtering the general audit log down to these specific action names. */
const SENSITIVE_ACTIONS = [
  "posting_agreement.updated",
  "posting_agreement.deleted",
  "posting_agreement.payment_linked",
  "payment.edited",
  "payment.undone",
  "payment.redone",
];

@Controller("api/v1/organizations/:organizationId/audit-logs")
@UseGuards(OrgMembershipGuard, RolesGuard)
@Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
export class AuditLogsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list(@Param("organizationId") organizationId: string, @Query("page") page = "1") {
    const pageSize = 50;
    const pageNum = Number(page) || 1;
    return this.prisma.auditLog.findMany({
      where: { organizationId },
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: "desc" },
      skip: (pageNum - 1) * pageSize,
      take: pageSize,
    });
  }

  /** Registered before nothing needs to worry about — this controller has no ":id"-style param
   * route to collide with, so the static "sensitive-actions" segment is unambiguous. Super Admin
   * only, unlike the general log above, since these are specifically the actions Super Admin is
   * meant to be the sole gatekeeper for. */
  @Get("sensitive-actions")
  @Roles("ORG_SUPER_ADMIN")
  listSensitive(@Param("organizationId") organizationId: string, @Query("page") page = "1") {
    const pageSize = 50;
    const pageNum = Number(page) || 1;
    return this.prisma.auditLog.findMany({
      where: { organizationId, action: { in: SENSITIVE_ACTIONS } },
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: "desc" },
      skip: (pageNum - 1) * pageSize,
      take: pageSize,
    });
  }
}
