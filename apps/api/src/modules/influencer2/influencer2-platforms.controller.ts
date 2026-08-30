import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { Influencer2PlatformsService } from "./influencer2-platforms.service";
import { OrgMembershipGuard } from "../../common/guards/org-membership.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { RequiresArea } from "../../common/decorators/requires-area.decorator";

@Controller("api/v1/organizations/:organizationId/influencer2/platforms")
@UseGuards(OrgMembershipGuard, RolesGuard)
@Roles("ORG_SUPER_ADMIN", "ORG_ADMIN", "FINANCE_OFFICER")
@RequiresArea("influencers")
export class Influencer2PlatformsController {
  constructor(private readonly platforms: Influencer2PlatformsService) {}

  @Get()
  list(@Param("organizationId") _organizationId: string, @Query("contentType") contentType?: string) {
    return this.platforms.list(contentType);
  }
}
