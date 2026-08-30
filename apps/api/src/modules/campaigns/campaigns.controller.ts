import { Body, Controller, Param, Post, UseGuards } from "@nestjs/common";
import { CampaignsService } from "./campaigns.service";
import { SendCampaignDto } from "./dto/send-campaign.dto";
import { OrgMembershipGuard } from "../../common/guards/org-membership.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types";
import { AuditService } from "../../common/audit.service";

@Controller("api/v1/organizations/:organizationId/campaigns")
@UseGuards(OrgMembershipGuard, RolesGuard)
export class CampaignsController {
  constructor(
    private readonly campaigns: CampaignsService,
    private readonly audit: AuditService,
  ) {}

  @Post("send")
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
  async send(@Param("organizationId") organizationId: string, @Body() dto: SendCampaignDto, @CurrentUser() user: RequestUser) {
    const result = await this.campaigns.send(organizationId, dto.subject, dto.message, {
      region: dto.region,
      membershipType: dto.membershipType,
      membershipStatus: dto.membershipStatus,
    });
    await this.audit.record({
      organizationId,
      userId: user.id,
      action: "campaign.sent",
      entityType: "campaign",
      metadata: { subject: dto.subject, sent: result.sent, matched: result.matched },
    });
    return result;
  }
}
