import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import type { EventStatus } from "@event-intel/database";
import { EventsService } from "./events.service";
import { CreateEventDto } from "./dto/create-event.dto";
import { UpdateEventDto } from "./dto/update-event.dto";
import { RegisterMemberDto } from "./dto/register-member.dto";
import { OrgMembershipGuard } from "../../common/guards/org-membership.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types";
import { AuditService } from "../../common/audit.service";

@Controller("api/v1/organizations/:organizationId/events")
@UseGuards(OrgMembershipGuard, RolesGuard)
export class EventsController {
  constructor(
    private readonly events: EventsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list(
    @Param("organizationId") organizationId: string,
    @Query("status") status?: EventStatus,
    @Query("eventType") eventType?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.events.list(organizationId, { status, eventType, from, to });
  }

  @Get("event-types")
  eventTypes(@Param("organizationId") organizationId: string) {
    return this.events.listEventTypes(organizationId);
  }

  @Post()
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
  async create(@Param("organizationId") organizationId: string, @Body() dto: CreateEventDto, @CurrentUser() user: RequestUser) {
    const event = await this.events.create(organizationId, dto, user.id);
    await this.audit.record({ organizationId, userId: user.id, action: "event.created", entityType: "event", entityId: event.id });
    return event;
  }

  @Get(":eventId")
  get(@Param("organizationId") organizationId: string, @Param("eventId") eventId: string) {
    return this.events.getById(organizationId, eventId);
  }

  @Patch(":eventId")
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
  async update(
    @Param("organizationId") organizationId: string,
    @Param("eventId") eventId: string,
    @Body() dto: UpdateEventDto,
    @CurrentUser() user: RequestUser,
  ) {
    const event = await this.events.update(organizationId, eventId, dto);
    await this.audit.record({ organizationId, userId: user.id, action: "event.updated", entityType: "event", entityId: eventId });
    return event;
  }

  @Delete(":eventId")
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
  async remove(@Param("organizationId") organizationId: string, @Param("eventId") eventId: string, @CurrentUser() user: RequestUser) {
    const result = await this.events.delete(organizationId, eventId);
    await this.audit.record({ organizationId, userId: user.id, action: "event.deleted", entityType: "event", entityId: eventId });
    return result;
  }

  @Get(":eventId/registrations")
  listRegistrations(@Param("organizationId") organizationId: string, @Param("eventId") eventId: string) {
    return this.events.listRegistrations(organizationId, eventId);
  }

  @Get(":eventId/new-members")
  listNewMembers(@Param("organizationId") organizationId: string, @Param("eventId") eventId: string) {
    return this.events.listNewMembers(organizationId, eventId);
  }

  @Post(":eventId/registrations")
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
  async register(
    @Param("organizationId") organizationId: string,
    @Param("eventId") eventId: string,
    @Body() dto: RegisterMemberDto,
    @CurrentUser() user: RequestUser,
  ) {
    const registration = await this.events.registerMember(organizationId, eventId, dto.memberId, "ADMIN");
    await this.audit.record({ organizationId, userId: user.id, action: "event.member_registered", entityType: "event_registration", entityId: registration.id });
    return registration;
  }

  @Post(":eventId/qr")
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
  async generateQr(@Param("organizationId") organizationId: string, @Param("eventId") eventId: string, @CurrentUser() user: RequestUser) {
    const qr = await this.events.generateQr(organizationId, eventId);
    await this.audit.record({ organizationId, userId: user.id, action: "event.qr_generated", entityType: "event", entityId: eventId });
    return qr;
  }

  @Get(":eventId/qr/pdf")
  async getQrPdf(
    @Param("organizationId") organizationId: string,
    @Param("eventId") eventId: string,
    @Query("token") token: string,
    @Res() res: Response,
  ) {
    const pdf = await this.events.getQrPdf(organizationId, eventId, token);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="event-qr-${eventId}.pdf"`);
    res.send(pdf);
  }

  @Patch(":eventId/qr/revoke")
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
  async revokeQr(@Param("organizationId") organizationId: string, @Param("eventId") eventId: string, @CurrentUser() user: RequestUser) {
    const result = await this.events.revokeQr(organizationId, eventId);
    await this.audit.record({ organizationId, userId: user.id, action: "event.qr_revoked", entityType: "event", entityId: eventId });
    return result;
  }
}
