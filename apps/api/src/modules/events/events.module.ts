import { Module } from "@nestjs/common";
import { EventsController } from "./events.controller";
import { EventsService } from "./events.service";
import { OrgMembershipGuard } from "../../common/guards/org-membership.guard";
import { AuditService } from "../../common/audit.service";

@Module({
  controllers: [EventsController],
  providers: [EventsService, OrgMembershipGuard, AuditService],
  exports: [EventsService],
})
export class EventsModule {}
