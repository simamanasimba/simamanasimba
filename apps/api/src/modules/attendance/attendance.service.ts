import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import * as QRCode from "qrcode";
import { hashToken } from "@event-intel/security";
import type { AttendanceMethod, Event, Gender } from "@event-intel/database";
import { PrismaService } from "../../prisma/prisma.service";
import { MembersService } from "../members/members.service";
import { renderQrCardPdf } from "./qr-card-pdf.util";

export interface ResolvedEventToken {
  event: Event;
}

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly members: MembersService,
  ) {}

  async resolveEventByToken(eventId: string, token: string): Promise<ResolvedEventToken> {
    const attendanceToken = await this.prisma.attendanceToken.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!attendanceToken || attendanceToken.eventId !== eventId) {
      throw new ForbiddenException("This QR code is invalid or has been revoked");
    }
    // Checked before the ACTIVE-status check so a QR that's both expired and revoked (the
    // normal case once generateQr() revokes the old token) still reports the more useful
    // "event has ended" reason instead of a generic invalid message.
    if (attendanceToken.expiresAt && attendanceToken.expiresAt < new Date()) {
      throw new ForbiddenException("This event has ended — this QR code is no longer active");
    }
    if (attendanceToken.status !== "ACTIVE") {
      throw new ForbiddenException("This QR code is invalid or has been revoked");
    }
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException("Event not found");
    return { event };
  }

  /** Accepts either a club membership number or this system's own campaign ID — same Member table either way now. */
  async lookupMember(eventId: string, token: string, registrationNumber: string) {
    const { event } = await this.resolveEventByToken(eventId, token);
    const member = await this.members.findByIdentifier(event.organizationId, registrationNumber);
    if (!member) return { found: false as const };

    const existing = await this.prisma.attendanceRecord.findUnique({ where: { eventId_memberId: { eventId, memberId: member.id } } });
    return {
      found: true as const,
      member: {
        id: member.id,
        campaignId: member.campaignId,
        membershipNumber: member.membershipNumber,
        firstName: member.firstName,
        lastName: member.lastName,
        membershipStatus: member.membershipStatus,
        membershipType: member.membershipType,
      },
      alreadyCheckedIn: Boolean(existing),
      checkedInAt: existing?.checkedInAt.toISOString(),
    };
  }

  private async ensureRegistration(eventId: string, memberId: string, source: "WALK_IN" | "ADMIN" = "ADMIN") {
    const existing = await this.prisma.eventRegistration.findUnique({ where: { eventId_memberId: { eventId, memberId } } });
    if (existing) return { registration: existing, alreadyRegistered: true };
    const registration = await this.prisma.eventRegistration.create({ data: { eventId, memberId, source, registrationStatus: "APPROVED" } });
    return { registration, alreadyRegistered: false };
  }

  /**
   * AttendanceRecord.deviceId is a real foreign key, but the public attend
   * page just generates a random UUID client-side (see lib/deviceId.ts) and
   * never registers it — auto-provision a lightweight device row the first
   * time we see an unfamiliar id, rather than crashing every anonymous
   * check-in with a foreign-key violation.
   */
  private async ensureDevice(organizationId: string, deviceId?: string): Promise<void> {
    if (!deviceId) return;
    await this.prisma.attendanceDevice.upsert({
      where: { id: deviceId },
      create: { id: deviceId, organizationId, name: "Fan device", deviceType: "PHONE" },
      update: {},
    });
  }

  private async recordAttendance(params: {
    organizationId: string;
    eventId: string;
    memberId: string;
    method: AttendanceMethod;
    deviceId?: string;
    clientRecordId?: string;
    checkedInByUserId?: string;
    checkedInAt?: Date;
  }) {
    await this.ensureDevice(params.organizationId, params.deviceId);
    try {
      return {
        status: "CHECKED_IN" as const,
        record: await this.prisma.attendanceRecord.create({
          data: {
            organizationId: params.organizationId,
            eventId: params.eventId,
            memberId: params.memberId,
            method: params.method,
            deviceId: params.deviceId,
            clientRecordId: params.clientRecordId,
            checkedInByUserId: params.checkedInByUserId,
            checkedInAt: params.checkedInAt ?? new Date(),
          },
        }),
      };
    } catch (err: unknown) {
      // Unique constraint on (eventId, memberId) or (deviceId, clientRecordId) — already checked in.
      if ((err as { code?: string }).code === "P2002") {
        const existing = await this.prisma.attendanceRecord.findUnique({
          where: { eventId_memberId: { eventId: params.eventId, memberId: params.memberId } },
        });
        return { status: "ALREADY_CHECKED_IN" as const, record: existing };
      }
      throw err;
    }
  }

  async checkIn(eventId: string, token: string, registrationNumber: string, deviceId?: string, clientRecordId?: string) {
    const { event } = await this.resolveEventByToken(eventId, token);
    if (!event.attendanceEnabled) throw new ConflictException("Attendance is not enabled for this event");

    const member = await this.members.findByIdentifier(event.organizationId, registrationNumber);
    if (!member) throw new NotFoundException("Membership or campaign ID not found");

    await this.ensureRegistration(eventId, member.id, "WALK_IN");
    const result = await this.recordAttendance({
      organizationId: event.organizationId,
      eventId,
      memberId: member.id,
      method: "MEMBERSHIP_NUMBER",
      deviceId,
      clientRecordId,
    });

    return {
      ...result,
      member: {
        id: member.id,
        membershipNumber: member.membershipNumber,
        firstName: member.firstName,
        lastName: member.lastName,
      },
    };
  }

  async registerWalkIn(
    eventId: string,
    token: string,
    input: {
      membershipNumber?: string;
      firstName: string;
      middleName?: string;
      lastName: string;
      gender?: Gender;
      phone?: string;
      email?: string;
      address?: string;
      region?: string;
      district?: string;
      deviceId?: string;
      clientRecordId?: string;
    },
  ) {
    const { event } = await this.resolveEventByToken(eventId, token);
    if (!event.allowWalkIns || !event.allowNewMemberReg) {
      throw new ForbiddenException("This event does not allow walk-in registration");
    }

    const member = await this.members.create(
      event.organizationId,
      {
        membershipNumber: input.membershipNumber,
        firstName: input.firstName,
        middleName: input.middleName,
        lastName: input.lastName,
        gender: input.gender,
        phone: input.phone,
        email: input.email,
        address: input.address,
        region: input.region,
        district: input.district,
      },
      "EVENT_WALK_IN",
    );

    const { registration, alreadyRegistered } = await this.ensureRegistration(eventId, member.id, "WALK_IN");

    let attendance: Awaited<ReturnType<AttendanceService["recordAttendance"]>> | null = null;
    if (!alreadyRegistered && event.autoCheckInNewMembers) {
      attendance = await this.recordAttendance({
        organizationId: event.organizationId,
        eventId,
        memberId: member.id,
        method: "WALK_IN",
        deviceId: input.deviceId,
        clientRecordId: input.clientRecordId,
      });
    }

    // Registering and checking in are two different moments — most events don't auto-check-in,
    // so a fresh registration just joins the guest list until someone actually checks them in at
    // the door. `checkedIn` tells the frontend which message to show instead of always claiming
    // "check-in successful".
    return { member, attendance, alreadyRegistered, registrationId: registration.id, checkedIn: Boolean(attendance) };
  }

  /** Guest list for the door scanner/link — same shape as the authenticated admin registrations
   * list, but reachable with just the event's share token (no login), since the person scanning
   * tickets at the door may not have a system account. */
  async listRegistrationsForScanner(eventId: string, token: string) {
    await this.resolveEventByToken(eventId, token);
    const [registrations, attendance] = await Promise.all([
      this.prisma.eventRegistration.findMany({
        where: { eventId },
        include: { member: { select: { id: true, membershipNumber: true, firstName: true, lastName: true } } },
        orderBy: { registeredAt: "desc" },
      }),
      this.prisma.attendanceRecord.findMany({ where: { eventId }, select: { memberId: true, checkedInAt: true } }),
    ]);
    const checkedInAtByMember = new Map(attendance.map((a) => [a.memberId, a.checkedInAt]));
    return registrations.map((r) => ({
      registrationId: r.id,
      member: r.member,
      checkedInAt: checkedInAtByMember.get(r.member.id) ?? null,
    }));
  }

  /** The ticket handed to a registrant after signing up — a QR encoding a URL to a staff-facing
   * check-in confirmation page. Deliberately independent of the event's revocable AttendanceToken:
   * regenerating the door QR must not silently invalidate every ticket already issued. The
   * registration's own unguessable id is proof enough, the same way a boarding pass barcode works. */
  async getTicket(eventId: string, registrationId: string) {
    const registration = await this.prisma.eventRegistration.findFirst({
      where: { id: registrationId, eventId },
      include: {
        event: true,
        member: { select: { id: true, firstName: true, lastName: true, membershipNumber: true, campaignId: true } },
      },
    });
    if (!registration) throw new NotFoundException("Ticket not found");

    const attendance = await this.prisma.attendanceRecord.findUnique({
      where: { eventId_memberId: { eventId, memberId: registration.memberId } },
    });

    return {
      registrationId: registration.id,
      event: {
        id: registration.event.id,
        name: registration.event.name,
        location: registration.event.location,
        startDatetime: registration.event.startDatetime,
        endDatetime: registration.event.endDatetime,
        hasEnded: registration.event.endDatetime < new Date(),
      },
      member: registration.member,
      checkedIn: Boolean(attendance),
      checkedInAt: attendance?.checkedInAt ?? null,
    };
  }

  private ticketUrl(eventId: string, registrationId: string): string {
    return `${process.env.WEB_ORIGIN ?? "http://localhost:3000"}/attend/${eventId}/ticket/${registrationId}`;
  }

  async getTicketQrPng(eventId: string, registrationId: string): Promise<Buffer> {
    await this.getTicket(eventId, registrationId); // 404s early if the ticket doesn't exist
    return QRCode.toBuffer(this.ticketUrl(eventId, registrationId), { width: 480, margin: 1 });
  }

  async getTicketPdf(eventId: string, registrationId: string): Promise<Buffer> {
    const ticket = await this.getTicket(eventId, registrationId);
    const event = await this.prisma.event.findUnique({ where: { id: eventId }, include: { organization: { select: { name: true } } } });
    const qrPng = await QRCode.toBuffer(this.ticketUrl(eventId, registrationId), { width: 480, margin: 1 });
    const dateLabel = new Date(ticket.event.startDatetime).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    return renderQrCardPdf({
      title: event?.organization.name ?? ticket.event.name,
      subtitle: `${ticket.event.name} — ${dateLabel}`,
      lines: [`${ticket.member.firstName} ${ticket.member.lastName}`, "Entry ticket — scan at the door"],
      qrPng,
      footer: ticket.event.location ?? undefined,
    });
  }

  async checkInByRegistration(eventId: string, registrationId: string, checkedInByUserId?: string) {
    const registration = await this.prisma.eventRegistration.findFirst({
      where: { id: registrationId, eventId },
      include: { event: true, member: { select: { id: true, firstName: true, lastName: true } } },
    });
    if (!registration) throw new NotFoundException("Ticket not found");
    if (registration.event.endDatetime < new Date()) {
      throw new ForbiddenException("This event has ended — check-in is closed");
    }

    const result = await this.recordAttendance({
      organizationId: registration.event.organizationId,
      eventId,
      memberId: registration.memberId,
      method: "QR",
      checkedInByUserId,
    });

    return { ...result, member: registration.member };
  }

  async syncBatch(
    eventId: string,
    token: string,
    deviceId: string | undefined,
    items: Array<{ clientRecordId: string; membershipNumber: string; checkedInAt: string }>,
  ) {
    const { event } = await this.resolveEventByToken(eventId, token);

    const results: Array<{ clientRecordId: string; status: string; memberId?: string }> = [];
    for (const item of items) {
      const member = await this.members.findByIdentifier(event.organizationId, item.membershipNumber);
      if (!member) {
        results.push({ clientRecordId: item.clientRecordId, status: "MEMBER_NOT_FOUND" as const });
        continue;
      }
      await this.ensureRegistration(eventId, member.id, "WALK_IN");
      const result = await this.recordAttendance({
        organizationId: event.organizationId,
        eventId,
        memberId: member.id,
        method: "OFFLINE_SYNC",
        deviceId,
        clientRecordId: item.clientRecordId,
        checkedInAt: new Date(item.checkedInAt),
      });
      results.push({ clientRecordId: item.clientRecordId, status: result.status, memberId: member.id });
    }
    return { synced: results.length, results };
  }

  async adminCheckIn(organizationId: string, eventId: string, memberId: string, checkedInByUserId: string) {
    const event = await this.prisma.event.findFirst({ where: { id: eventId, organizationId } });
    if (!event) throw new NotFoundException("Event not found");
    const member = await this.prisma.member.findFirst({ where: { id: memberId, organizationId } });
    if (!member) throw new NotFoundException("Member not found");

    await this.ensureRegistration(eventId, memberId, "ADMIN");
    return this.recordAttendance({ organizationId, eventId, memberId, method: "ADMIN", checkedInByUserId });
  }

  async listAttendance(organizationId: string, eventId: string) {
    return this.prisma.attendanceRecord.findMany({
      where: { organizationId, eventId },
      include: {
        member: { select: { id: true, membershipNumber: true, firstName: true, lastName: true, phone: true, isLeader: true, region: true } },
        device: true,
      },
      orderBy: { checkedInAt: "desc" },
    });
  }

  async liveStats(organizationId: string, eventId: string) {
    const event = await this.prisma.event.findFirst({ where: { id: eventId, organizationId } });
    if (!event) throw new NotFoundException("Event not found");

    const [registered, checkedIn, walkIns] = await Promise.all([
      this.prisma.eventRegistration.count({ where: { eventId, registrationStatus: { in: ["REGISTERED", "APPROVED"] } } }),
      this.prisma.attendanceRecord.count({ where: { eventId } }),
      this.prisma.attendanceRecord.count({ where: { eventId, method: { in: ["WALK_IN", "OFFLINE_SYNC"] } } }),
    ]);

    return {
      eventId,
      registered,
      checkedIn,
      remaining: Math.max(registered - checkedIn, 0),
      attendanceRate: registered > 0 ? checkedIn / registered : 0,
      walkIns,
      updatedAt: new Date().toISOString(),
    };
  }

  async registerDevice(organizationId: string, name: string, deviceType: string, eventId?: string) {
    return this.prisma.attendanceDevice.create({
      data: { organizationId, name, deviceType: deviceType as never, eventId },
    });
  }

  async listDevices(organizationId: string) {
    return this.prisma.attendanceDevice.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" } });
  }

  async heartbeatDevice(organizationId: string, deviceId: string) {
    const device = await this.prisma.attendanceDevice.findFirst({ where: { id: deviceId, organizationId } });
    if (!device) throw new NotFoundException("Device not found");
    return this.prisma.attendanceDevice.update({ where: { id: deviceId }, data: { lastSeenAt: new Date() } });
  }
}
