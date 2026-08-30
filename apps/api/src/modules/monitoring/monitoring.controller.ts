import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import { MonitoringService } from "./monitoring.service";
import { CreateAliasDto, CreateMonitoringRuleDto } from "./dto/monitoring.dto";
import { OrgMembershipGuard } from "../../common/guards/org-membership.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";

@Controller("api/v1/organizations/:organizationId/monitoring")
@UseGuards(OrgMembershipGuard, RolesGuard)
export class MonitoringController {
  constructor(private readonly monitoring: MonitoringService) {}

  @Get("aliases")
  listAliases(@Param("organizationId") organizationId: string) {
    return this.monitoring.listAliases(organizationId);
  }

  @Post("aliases")
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
  createAlias(@Param("organizationId") organizationId: string, @Body() dto: CreateAliasDto) {
    return this.monitoring.createAlias(organizationId, dto.alias, dto.aliasType);
  }

  @Delete("aliases/:aliasId")
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
  removeAlias(@Param("organizationId") organizationId: string, @Param("aliasId") aliasId: string) {
    return this.monitoring.removeAlias(organizationId, aliasId);
  }

  @Get("rules")
  listRules(@Param("organizationId") organizationId: string) {
    return this.monitoring.listRules(organizationId);
  }

  @Post("rules")
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
  createRule(@Param("organizationId") organizationId: string, @Body() dto: CreateMonitoringRuleDto) {
    return this.monitoring.createRule(organizationId, dto);
  }

  @Post("rules/:ruleId/run")
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
  runRule(@Param("organizationId") organizationId: string, @Param("ruleId") ruleId: string) {
    return this.monitoring.runRule(organizationId, ruleId);
  }
}
