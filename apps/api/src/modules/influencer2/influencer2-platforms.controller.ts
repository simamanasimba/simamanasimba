import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { Influencer2PlatformsService } from "./influencer2-platforms.service";
import { OrgMembershipGuard } from "../../common/guards/org-membership.guard";
import { RolesGuard } from "../../common/guards/roles.guard";

@Controller("api/v1/organizations/:organizationId/influencer2/platforms")
@UseGuards(OrgMembershipGuard, RolesGuard)
export class Influencer2PlatformsController {
  constructor(private readonly platforms: Influencer2PlatformsService) {}

  @Get()
  list(@Param("organizationId") _organizationId: string, @Query("contentType") contentType?: string) {
    return this.platforms.list(contentType);
  }
}
