import { Module } from "@nestjs/common";
import { AuditLogsController } from "./audit-logs.controller";
import { OrgMembershipGuard } from "../../common/guards/org-membership.guard";

@Module({
  controllers: [AuditLogsController],
  providers: [OrgMembershipGuard],
})
export class AuditLogsModule {}
