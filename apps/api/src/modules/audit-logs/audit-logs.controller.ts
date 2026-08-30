import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { OrgMembershipGuard } from "../../common/guards/org-membership.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";

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
}
