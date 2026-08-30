import { Module } from "@nestjs/common";
import { OrganizationsController } from "./organizations.controller";
import { PublicBrandingController } from "./public-branding.controller";
import { OrganizationsService } from "./organizations.service";
import { NotificationsModule } from "../notifications/notifications.module";
import { OrgMembershipGuard } from "../../common/guards/org-membership.guard";
import { AuditService } from "../../common/audit.service";

@Module({
  imports: [NotificationsModule],
  controllers: [OrganizationsController, PublicBrandingController],
  providers: [OrganizationsService, OrgMembershipGuard, AuditService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
