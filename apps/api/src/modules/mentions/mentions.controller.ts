import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import type { SentimentLabel } from "@event-intel/database";
import { PrismaService } from "../../prisma/prisma.service";
import { OrgMembershipGuard } from "../../common/guards/org-membership.guard";

@Controller("api/v1/organizations/:organizationId/mentions")
@UseGuards(OrgMembershipGuard)
export class MentionsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list(
    @Param("organizationId") organizationId: string,
    @Query("sentiment") sentiment?: SentimentLabel,
    @Query("topic") topic?: string,
    @Query("eventId") eventId?: string,
    @Query("page") page = "1",
  ) {
    const pageSize = 25;
    const pageNum = Number(page) || 1;
    return this.prisma.mention
      .findMany({
        where: {
          organizationId,
          topic,
          eventId,
          aiAnalyses: sentiment ? { some: { sentiment } } : undefined,
        },
        include: { aiAnalyses: true },
        orderBy: { detectedAt: "desc" },
        skip: (pageNum - 1) * pageSize,
        take: pageSize,
      });
  }

  @Get(":mentionId")
  get(@Param("organizationId") organizationId: string, @Param("mentionId") mentionId: string) {
    return this.prisma.mention.findFirst({
      where: { id: mentionId, organizationId },
      include: { aiAnalyses: true, sources: true },
    });
  }
}
