import { Global, Module } from "@nestjs/common";
import { PermissionsService } from "./permissions.service";
import { PermissionsController } from "./permissions.controller";
import { AuditService } from "../../common/audit.service";
import { OrgMembershipGuard } from "../../common/guards/org-membership.guard";

/** Global so RolesGuard (used via @UseGuards on many controllers) can inject PermissionsService
 * without every one of those controllers' modules needing to import this one — same pattern as
 * PrismaModule. */
@Global()
@Module({
  controllers: [PermissionsController],
  providers: [PermissionsService, AuditService, OrgMembershipGuard],
  exports: [PermissionsService],
})
export class PermissionsModule {}
