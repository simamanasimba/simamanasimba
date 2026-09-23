import { Body, Controller, Get, Param, Post, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { AttendanceService } from "./attendance.service";
import { CheckInDto, CheckPhoneDto, LookupMemberDto, RegisterWalkInDto, SyncBatchDto, ValidateTokenDto } from "./dto/public-attendance.dto";
import { Public } from "../../common/decorators/public.decorator";

/**
 * The public attendance flow — reached by scanning an event's QR code. Only
 * @Public() and only exposes what's needed to check a single member in: no
 * endpoint here can list or browse the member database (spec section 61),
 * with one deliberate exception — `registrations`, which lists only this one
 * event's guest list (name + check-in status), gated by the same event
 * token, for the door scanner's "search by name" fallback.
 */
@Public()
@Controller("api/v1/public/attendance/events/:eventId")
export class PublicAttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Get()
  async validate(@Param("eventId") eventId: string, @Query() query: ValidateTokenDto) {
    const { event } = await this.attendance.resolveEventByToken(eventId, query.token);
    return {
      event: {
        id: event.id,
        name: event.name,
        location: event.location,
        startDatetime: event.startDatetime,
        allowWalkIns: event.allowWalkIns,
        allowNewMemberReg: event.allowNewMemberReg,
        requirePhoneVerification: event.requirePhoneVerification,
      },
    };
  }

  @Post("lookup")
  lookup(@Param("eventId") eventId: string, @Body() dto: LookupMemberDto) {
    return this.attendance.lookupMember(eventId, dto.token, dto.phone);
  }

  @Post("check-phone")
  checkPhone(@Param("eventId") eventId: string, @Body() dto: CheckPhoneDto) {
    return this.attendance.checkPhoneInUse(eventId, dto.token, dto.phone);
  }

  @Post("check-in")
  checkIn(@Param("eventId") eventId: string, @Body() dto: CheckInDto) {
    return this.attendance.checkIn(eventId, dto.token, dto.memberId, dto.deviceId, dto.clientRecordId);
  }

  @Post("register")
  registerWalkIn(@Param("eventId") eventId: string, @Body() dto: RegisterWalkInDto) {
    return this.attendance.registerWalkIn(eventId, dto.token, dto);
  }

  @Post("sync")
  sync(@Param("eventId") eventId: string, @Body() dto: SyncBatchDto) {
    return this.attendance.syncBatch(eventId, dto.token, dto.deviceId, dto.items);
  }

  @Get("registrations")
  listRegistrations(@Param("eventId") eventId: string, @Query() query: ValidateTokenDto) {
    return this.attendance.listRegistrationsForScanner(eventId, query.token);
  }

  @Get("ticket/:registrationId")
  getTicket(@Param("eventId") eventId: string, @Param("registrationId") registrationId: string) {
    return this.attendance.getTicket(eventId, registrationId);
  }

  @Get("ticket/:registrationId/qr.png")
  async getTicketQr(@Param("eventId") eventId: string, @Param("registrationId") registrationId: string, @Res() res: Response) {
    const png = await this.attendance.getTicketQrPng(eventId, registrationId);
    res.setHeader("Content-Type", "image/png");
    res.send(png);
  }

  @Get("ticket/:registrationId/pdf")
  async getTicketPdf(@Param("eventId") eventId: string, @Param("registrationId") registrationId: string, @Res() res: Response) {
    const pdf = await this.attendance.getTicketPdf(eventId, registrationId);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="ticket-${registrationId}.pdf"`);
    res.send(pdf);
  }

  @Post("ticket/:registrationId/checkin")
  checkInTicket(@Param("eventId") eventId: string, @Param("registrationId") registrationId: string) {
    return this.attendance.checkInByRegistration(eventId, registrationId);
  }
}
