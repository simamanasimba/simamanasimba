import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import * as QRCode from "qrcode";
import { generateOpaqueToken } from "@event-intel/security";
import type { Event, EventStatus, Prisma } from "@event-intel/database";
import { PrismaService } from "../../prisma/prisma.service";
import { SearchIndexService } from "../search-index/search-index.service";
import { StorageService } from "../storage/storage.service";
import { renderQrCardPdf } from "../attendance/qr-card-pdf.util";
import type { CreateEventDto } from "./dto/create-event.dto";
import type { UpdateEventDto } from "./dto/update-event.dto";

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly searchIndex: SearchIndexService,
    private readonly storage: StorageService,
  ) {}

  private indexEvent(event: Event): void {
    this.searchIndex
      .index({
        id: event.id,
        organizationId: event.organizationId,
        entityType: "event",
        title: event.name,
        body: [event.description, event.location].filter(Boolean).join(" "),
        createdAt: event.createdAt.toISOString(),
      })
      .catch((err) => this.logger.warn(`Failed to index event ${event.id}: ${err instanceof Error ? err.message : err}`));
  }

  async create(organizationId: string, dto: CreateEventDto, createdByUserId: string) {
    if (new Date(dto.endDatetime) <= new Date(dto.startDatetime)) {
      throw new BadRequestException("End time must be after the start time");
    }
    const attendanceEnabled = dto.attendanceEnabled ?? true;
    const event = await this.prisma.event.create({
      data: {
        organizationId,
        createdByUserId,
        name: dto.name,
        description: dto.description,
        eventType: dto.eventType,
        location: dto.location,
        startDatetime: new Date(dto.startDatetime),
        endDatetime: new Date(dto.endDatetime),
        capacity: dto.capacity,
        registrationEnabled: dto.registrationEnabled,
        attendanceEnabled,
        allowWalkIns: dto.allowWalkIns,
        allowNewMemberReg: dto.allowNewMemberReg,
        requireApproval: dto.requireApproval,
        requirePhoneVerification: dto.requirePhoneVerification,
        autoCheckInNewMembers: dto.autoCheckInNewMembers,
        monitoringKeywords: dto.monitoringKeywords ?? [],
        status: "DRAFT",
      },
    });
    this.indexEvent(event);

    // QR is generated up front — organizers shouldn't have to remember an
    // extra step before an event can accept check-ins. The raw token is only
    // ever returned once (only its hash is persisted), so the frontend must
    // capture it from this response.
    const qr = attendanceEnabled ? await this.generateQr(organizationId, event.id) : null;
    return { ...event, qr };
  }

  async list(organizationId: string, filters: { status?: EventStatus; eventType?: string; from?: string; to?: string } = {}) {
    const where: Prisma.EventWhereInput = { organizationId, status: filters.status, eventType: filters.eventType };
    if (filters.from || filters.to) {
      where.startDatetime = {
        gte: filters.from ? new Date(filters.from) : undefined,
        lte: filters.to ? new Date(filters.to) : undefined,
      };
    }
    const events = await this.prisma.event.findMany({
      where,
      orderBy: { startDatetime: "desc" },
      include: {
        createdBy: { select: { firstName: true, lastName: true } },
        _count: { select: { attendanceRecords: true } },
      },
    });
    return events.map((e) => ({ ...e, attendanceCount: e._count.attendanceRecords }));
  }

  async listEventTypes(organizationId: string): Promise<string[]> {
    const rows = await this.prisma.event.findMany({
      where: { organizationId, eventType: { not: null } },
      select: { eventType: true },
      distinct: ["eventType"],
    });
    return rows.map((r) => r.eventType).filter((t): t is string => Boolean(t));
  }

  async getById(organizationId: string, eventId: string) {
    const event = await this.prisma.event.findFirst({ where: { id: eventId, organizationId } });
    if (!event) throw new NotFoundException("Event not found");

    const [registrationCount, attendanceCount, walkInCount] = await Promise.all([
      this.prisma.eventRegistration.count({ where: { eventId, registrationStatus: { in: ["REGISTERED", "APPROVED"] } } }),
      this.prisma.attendanceRecord.count({ where: { eventId } }),
      this.prisma.attendanceRecord.count({ where: { eventId, method: "WALK_IN" } }),
    ]);

    return {
      event,
      stats: {
        registered: registrationCount,
        checkedIn: attendanceCount,
        remaining: Math.max(registrationCount - attendanceCount, 0),
        attendanceRate: registrationCount > 0 ? attendanceCount / registrationCount : 0,
        walkIns: walkInCount,
      },
    };
  }

  async update(organizationId: string, eventId: string, dto: UpdateEventDto) {
    const existing = await this.ensureEvent(organizationId, eventId);
    const effectiveStart = dto.startDatetime ? new Date(dto.startDatetime) : existing.startDatetime;
    const effectiveEnd = dto.endDatetime ? new Date(dto.endDatetime) : existing.endDatetime;
    if (effectiveEnd <= effectiveStart) {
      throw new BadRequestException("End time must be after the start time");
    }
    return this.prisma.event.update({
      where: { id: eventId },
      data: {
        ...dto,
        startDatetime: dto.startDatetime ? new Date(dto.startDatetime) : undefined,
        endDatetime: dto.endDatetime ? new Date(dto.endDatetime) : undefined,
      },
    });
  }

  async registerMember(organizationId: string, eventId: string, memberId: string, source: "ADMIN" | "SELF_SERVICE" | "WALK_IN" | "IMPORT" | "API" = "ADMIN") {
    const event = await this.ensureEvent(organizationId, eventId);
    const member = await this.prisma.member.findFirst({ where: { id: memberId, organizationId } });
    if (!member) throw new NotFoundException("Member not found in this organization");

    const existing = await this.prisma.eventRegistration.findUnique({ where: { eventId_memberId: { eventId, memberId } } });
    if (existing) return existing;

    if (event.capacity) {
      const count = await this.prisma.eventRegistration.count({ where: { eventId, registrationStatus: { in: ["REGISTERED", "APPROVED"] } } });
      if (count >= event.capacity) {
        return this.prisma.eventRegistration.create({
          data: { eventId, memberId, source, registrationStatus: "WAITLISTED" },
        });
      }
    }

    return this.prisma.eventRegistration.create({
      data: { eventId, memberId, source, registrationStatus: event.requireApproval ? "REGISTERED" : "APPROVED" },
    });
  }

  async listRegistrations(organizationId: string, eventId: string) {
    await this.ensureEvent(organizationId, eventId);
    const [registrations, attendance] = await Promise.all([
      this.prisma.eventRegistration.findMany({
        where: { eventId },
        include: { member: { select: { id: true, membershipNumber: true, firstName: true, lastName: true, membershipStatus: true } } },
        orderBy: { registeredAt: "desc" },
      }),
      this.prisma.attendanceRecord.findMany({ where: { eventId }, select: { memberId: true, checkedInAt: true } }),
    ]);
    const checkedInAtByMember = new Map(attendance.map((a) => [a.memberId, a.checkedInAt]));
    return registrations.map((r) => ({ ...r, checkedInAt: checkedInAtByMember.get(r.memberId) ?? null }));
  }

  /**
   * A member counts as "obtained" at this event only if their account was actually created BY
   * registering here — not everyone on the guest list, which also includes existing members who
   * simply RSVP'd or checked in with a membership number they already had. `registrationSource`
   * alone isn't enough (it never changes after someone's first join, so a walk-in member
   * re-registering at a later event would still read EVENT_WALK_IN there too) — this instead
   * finds each such member's very first EventRegistration system-wide and only credits the event
   * that matches, so each new member is attributed to exactly one "source" event.
   */
  async listNewMembers(organizationId: string, eventId: string) {
    await this.ensureEvent(organizationId, eventId);
    const registrations = await this.prisma.eventRegistration.findMany({
      where: { eventId },
      select: {
        registeredAt: true,
        member: {
          select: { id: true, campaignId: true, membershipNumber: true, firstName: true, lastName: true, phone: true, email: true, membershipStatus: true, registrationSource: true },
        },
      },
    });
    const walkIns = registrations.filter((r) => r.member.registrationSource === "EVENT_WALK_IN");
    if (walkIns.length === 0) return [];

    const memberIds = walkIns.map((r) => r.member.id);
    const allRegistrations = await this.prisma.eventRegistration.findMany({
      where: { memberId: { in: memberIds } },
      select: { memberId: true, eventId: true },
      orderBy: { registeredAt: "asc" },
    });
    const debutEventByMember = new Map<string, string>();
    for (const r of allRegistrations) {
      if (!debutEventByMember.has(r.memberId)) debutEventByMember.set(r.memberId, r.eventId);
    }

    return walkIns
      .filter((r) => debutEventByMember.get(r.member.id) === eventId)
      .map((r) => ({ ...r.member, registeredAt: r.registeredAt }));
  }

  async generateQr(organizationId: string, eventId: string) {
    const event = await this.ensureEvent(organizationId, eventId);
    if (!event.attendanceEnabled) throw new ConflictException("Attendance is not enabled for this event");

    await this.prisma.attendanceToken.updateMany({ where: { eventId, status: "ACTIVE" }, data: { status: "REVOKED", revokedAt: new Date() } });

    const { token, hash } = generateOpaqueToken();
    // Expiring the token at the event's own end time means a stale door QR
    // (or a screenshot of one) stops working the moment the event is over,
    // without needing a separate cron job to sweep tokens.
    await this.prisma.attendanceToken.create({ data: { eventId, tokenHash: hash, expiresAt: event.endDatetime } });

    const checkInUrl = `${process.env.WEB_ORIGIN ?? "http://localhost:3000"}/attend/${eventId}?token=${token}`;
    const qrDataUrl = await QRCode.toDataURL(checkInUrl);
    return { token, checkInUrl, qrDataUrl };
  }

  async getQrPdf(organizationId: string, eventId: string, token: string) {
    const event = await this.ensureEvent(organizationId, eventId);
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true, logoUrl: true } });
    const checkInUrl = `${process.env.WEB_ORIGIN ?? "http://localhost:3000"}/attend/${eventId}?token=${token}`;
    const qrPng = await QRCode.toBuffer(checkInUrl, { width: 480, margin: 1 });
    const dateLabel = event.startDatetime.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    const logo = org?.logoUrl ? await this.storage.readAsBuffer(org.logoUrl) : null;
    const pdf = await renderQrCardPdf({
      title: org?.name ?? event.name,
      subtitle: `${event.name} — ${dateLabel}`,
      lines: ["Scan to register or check in"],
      qrPng,
      footer: event.location ?? undefined,
      logo,
    });
    return pdf;
  }

  async revokeQr(organizationId: string, eventId: string) {
    await this.ensureEvent(organizationId, eventId);
    await this.prisma.attendanceToken.updateMany({ where: { eventId, status: "ACTIVE" }, data: { status: "REVOKED", revokedAt: new Date() } });
    return { revoked: true };
  }

  private async ensureEvent(organizationId: string, eventId: string) {
    const event = await this.prisma.event.findFirst({ where: { id: eventId, organizationId } });
    if (!event) throw new NotFoundException("Event not found");
    return event;
  }
}
