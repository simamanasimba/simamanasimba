import { ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { randomBytes } from "crypto";
import type { Gender, Prisma } from "@event-intel/database";
import { PrismaService } from "../../prisma/prisma.service";
import { SearchIndexService } from "../search-index/search-index.service";
import { EmailService } from "../notifications/email.service";
import { resolvePrimaryOrganizationId } from "../../common/primary-organization";
import type { CreateMemberDto } from "./dto/create-member.dto";
import type { UpdateMemberDto } from "./dto/update-member.dto";
import type { SearchMembersDto } from "./dto/search-members.dto";

function generateCampaignId(): string {
  return `CMP-${randomBytes(4).toString("hex").toUpperCase()}`;
}

function normalizePhone(value: string): string {
  return value.replace(/\D+/g, "");
}

/**
 * Membership numbers/campaign IDs are human-shareable (printed on cards,
 * read aloud at events) — never proof of ownership on their own. The public
 * self-service lookup/update endpoints require the caller to also know the
 * phone or email already on the member's record before returning or
 * changing anything.
 */
function matchesContact(member: { phone: string | null; email: string | null }, contact: string): boolean {
  const trimmed = contact.trim();
  if (!trimmed) return false;
  if (member.email && trimmed.toLowerCase() === member.email.toLowerCase()) return true;
  const normalizedInput = normalizePhone(trimmed);
  if (member.phone && normalizedInput && normalizedInput === normalizePhone(member.phone)) return true;
  return false;
}

@Injectable()
export class MembersService {
  private readonly logger = new Logger(MembersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly searchIndex: SearchIndexService,
    private readonly email: EmailService,
  ) {}

  private indexMember(member: { id: string; organizationId: string; campaignId: string; membershipNumber: string | null; firstName: string; lastName: string; phone: string | null; email: string | null; createdAt: Date }): void {
    this.searchIndex
      .index({
        id: member.id,
        organizationId: member.organizationId,
        entityType: "member",
        // Only the club's own real membership number belongs in a display title — campaignId is
        // an internal system reference, never shown to anyone as "the" identifier.
        title: member.membershipNumber ? `${member.firstName} ${member.lastName} (${member.membershipNumber})` : `${member.firstName} ${member.lastName}`,
        body: [member.phone, member.email].filter(Boolean).join(" "),
        createdAt: member.createdAt.toISOString(),
      })
      .catch((err) => this.logger.warn(`Failed to index member ${member.id}: ${err instanceof Error ? err.message : err}`));
  }

  private async generateUniqueCampaignId(tx: Prisma.TransactionClient): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const campaignId = generateCampaignId();
      const clash = await tx.member.findUnique({ where: { campaignId } });
      if (!clash) return campaignId;
    }
    throw new Error("Failed to generate a unique campaign ID");
  }

  /**
   * Creates a campaign member. Every member gets a campaignId (this
   * system's own identifier); membershipNumber is only ever set when the
   * person actually provided one — it's the club's external register, never
   * invented here. Self-service sources (campaign sign-up, event walk-in)
   * are deduplicated by phone so re-registering returns the existing
   * profile instead of minting a second identity for the same person.
   */
  /**
   * @param dedupeExisting For EVENT_WALK_IN, this is the event's own
   * `limitOneResponsePerPerson` setting — off lets one contact phone
   * register several distinct people (a parent signing up their kids),
   * on collapses a repeat submission into the existing member. Always on
   * for SELF_REGISTRATION regardless of the caller's argument, since that
   * flow has no per-event setting to defer to.
   */
  async create(organizationId: string, dto: CreateMemberDto, source: "ADMIN" | "SELF_REGISTRATION" | "EVENT_WALK_IN" | "IMPORT" = "ADMIN", dedupeExisting = true) {
    const isSelfService = source === "SELF_REGISTRATION" || source === "EVENT_WALK_IN";
    if (isSelfService && (dedupeExisting || source === "SELF_REGISTRATION")) {
      // Phone is the most reliable match; fall back to an exact name match when no phone was
      // given, so someone re-submitting the same walk-in form doesn't create a second Member
      // record every time (MySQL's default collation is already case-insensitive).
      const existing = dto.phone
        ? await this.prisma.member.findFirst({ where: { organizationId, phone: dto.phone } })
        : await this.prisma.member.findFirst({ where: { organizationId, firstName: dto.firstName, lastName: dto.lastName } });
      if (existing) return existing;
    }

    const member = await this.prisma.$transaction(async (tx) => {
      const membershipNumber = dto.membershipNumber?.trim() || null;
      if (membershipNumber) {
        const existing = await tx.member.findUnique({ where: { organizationId_membershipNumber: { organizationId, membershipNumber } } });
        if (existing) throw new ConflictException(`Membership number ${membershipNumber} is already in use`);
      }
      const campaignId = await this.generateUniqueCampaignId(tx);

      return tx.member.create({
        data: {
          organizationId,
          campaignId,
          membershipNumber,
          firstName: dto.firstName,
          middleName: dto.middleName,
          lastName: dto.lastName,
          gender: dto.gender,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
          phone: dto.phone,
          email: dto.email,
          address: dto.address,
          region: dto.region,
          district: dto.district,
          ward: dto.ward,
          branch: dto.branch,
          isLeader: dto.isLeader,
          membershipType: dto.membershipType,
          customFields: (dto.customFields ?? {}) as Prisma.InputJsonValue,
          registrationSource: source,
        },
      });
    });
    this.indexMember(member);
    return member;
  }

  async search(organizationId: string, query: SearchMembersDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;

    const where: Prisma.MemberWhereInput = {
      organizationId,
      region: query.region,
      district: query.district,
      membershipType: query.membershipType,
      membershipStatus: query.membershipStatus,
      isLeader: query.isLeader != null ? query.isLeader === "true" : undefined,
    };

    if (query.registeredFrom || query.registeredTo) {
      where.registrationDate = {
        gte: query.registeredFrom ? new Date(query.registeredFrom) : undefined,
        lte: query.registeredTo ? new Date(query.registeredTo) : undefined,
      };
    }

    if (query.q) {
      const term = query.q.trim();
      // No `mode: "insensitive"` here — that's Postgres-only in Prisma. MySQL's
      // default collation (utf8mb4_unicode_ci, set when the database was created)
      // already makes `contains` case-insensitive.
      where.OR = [
        { membershipNumber: { contains: term } },
        { firstName: { contains: term } },
        { lastName: { contains: term } },
        { phone: { contains: term } },
        { email: { contains: term } },
      ];
    }

    const orderBy: Prisma.MemberOrderByWithRelationInput[] = query.sortBy
      ? [{ [query.sortBy]: query.sortDir ?? "asc" }]
      : [{ lastName: "asc" }, { firstName: "asc" }];

    const [items, total] = await Promise.all([
      this.prisma.member.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.member.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  /** Same filters as search(), but returns every matching row for export — no pagination. */
  async exportRows(organizationId: string, query: SearchMembersDto) {
    const where: Prisma.MemberWhereInput = {
      organizationId,
      region: query.region,
      district: query.district,
      membershipType: query.membershipType,
      membershipStatus: query.membershipStatus,
      isLeader: query.isLeader != null ? query.isLeader === "true" : undefined,
    };
    if (query.registeredFrom || query.registeredTo) {
      where.registrationDate = {
        gte: query.registeredFrom ? new Date(query.registeredFrom) : undefined,
        lte: query.registeredTo ? new Date(query.registeredTo) : undefined,
      };
    }
    if (query.q) {
      const term = query.q.trim();
      where.OR = [
        { membershipNumber: { contains: term } },
        { firstName: { contains: term } },
        { lastName: { contains: term } },
        { phone: { contains: term } },
        { email: { contains: term } },
      ];
    }
    return this.prisma.member.findMany({ where, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] });
  }

  async delete(organizationId: string, memberId: string) {
    const result = await this.prisma.member.deleteMany({ where: { id: memberId, organizationId } });
    if (result.count === 0) throw new NotFoundException("Member not found");
    return { success: true };
  }

  async bulkDelete(organizationId: string, memberIds: string[]) {
    const result = await this.prisma.member.deleteMany({ where: { id: { in: memberIds }, organizationId } });
    return { deleted: result.count };
  }

  /** Emails exactly the selected members — the checkbox-driven replacement for the old filter-based campaigns page. */
  async bulkEmail(organizationId: string, memberIds: string[], subject: string, message: string) {
    const recipients = await this.prisma.member.findMany({
      where: { id: { in: memberIds }, organizationId, email: { not: null } },
      select: { email: true },
    });
    let sent = 0;
    const errors: string[] = [];
    for (const member of recipients) {
      if (!member.email) continue;
      try {
        await this.email.send({ to: member.email, subject, text: message });
        sent++;
      } catch (err) {
        errors.push(`${member.email}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    return { matched: memberIds.length, sent, skippedNoEmail: memberIds.length - recipients.length, errors };
  }

  /** Bulk-creates members from parsed import rows. Rows with a membership number that already exists are skipped, not overwritten. */
  async importRows(organizationId: string, rows: Array<Partial<CreateMemberDto>>) {
    const results = { created: 0, skipped: 0, errors: [] as string[] };
    for (const [index, row] of rows.entries()) {
      if (!row.firstName || !row.lastName) {
        results.errors.push(`Row ${index + 2}: firstName and lastName are required`);
        continue;
      }
      try {
        if (row.membershipNumber) {
          const existing = await this.prisma.member.findUnique({
            where: { organizationId_membershipNumber: { organizationId, membershipNumber: row.membershipNumber } },
          });
          if (existing) {
            results.skipped++;
            continue;
          }
        }
        await this.create(organizationId, row as CreateMemberDto, "IMPORT");
        results.created++;
      } catch (err) {
        results.errors.push(`Row ${index + 2}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    return results;
  }

  async findByMembershipNumber(organizationId: string, membershipNumber: string) {
    return this.prisma.member.findUnique({
      where: { organizationId_membershipNumber: { organizationId, membershipNumber } },
    });
  }

  findByCampaignId(organizationId: string, campaignId: string) {
    return this.prisma.member.findFirst({ where: { organizationId, campaignId } });
  }

  /** Accepts either a club membership number or this system's own campaign ID. */
  async findByIdentifier(organizationId: string, identifier: string) {
    const trimmed = identifier.trim();
    return (await this.findByMembershipNumber(organizationId, trimmed)) ?? (await this.findByCampaignId(organizationId, trimmed));
  }

  /** Matches by phone instead of a membership number the person may not have memorized or carry
   * on them — narrows via a DB `contains` on the last 9 digits (robust to leading-zero/
   * country-code formatting differences) then exact-compares normalized digits. If more than one
   * member shares a phone (allowed — see registerCampaignMember/create's dedupe, which is opt-in
   * per event), the most recently registered one wins. */
  async findByPhone(organizationId: string, phone: string) {
    const normalized = normalizePhone(phone);
    if (!normalized) return null;
    const significant = normalized.slice(-9);
    const candidates = await this.prisma.member.findMany({
      where: { organizationId, phone: { contains: significant } },
      orderBy: { registrationDate: "desc" },
    });
    return candidates.find((m) => m.phone && normalizePhone(m.phone).endsWith(significant)) ?? null;
  }

  /** Whether any member already has this phone on file — used to warn (not block) a new
   * registration about a possible duplicate, without exposing who the other member is. */
  async phoneInUse(organizationId: string, phone: string): Promise<boolean> {
    return Boolean(await this.findByPhone(organizationId, phone));
  }

  /**
   * Creates-or-finds a campaign member for the general "become a fan" flow
   * and post-specific "Sajili Kushiriki" — always self-service, always
   * deduplicated by phone. Splits a single fullName into first/last since
   * the lightweight public forms collect one name field.
   */
  registerCampaignMember(
    organizationId: string,
    input: { fullName: string; gender?: Gender; phone?: string; email?: string; region?: string; district?: string; ward?: string; branch?: string; membershipNumber?: string },
  ) {
    const [firstName, ...rest] = input.fullName.trim().split(/\s+/);
    return this.create(
      organizationId,
      {
        firstName,
        lastName: rest.join(" ") || firstName,
        gender: input.gender,
        phone: input.phone,
        email: input.email,
        region: input.region,
        district: input.district,
        ward: input.ward,
        branch: input.branch,
        membershipNumber: input.membershipNumber,
      },
      "SELF_REGISTRATION",
    );
  }

  /** Same as registerCampaignMember, but resolves the org itself — for the unauthenticated public /register page (single-club deployment: the first-created org). */
  async registerCampaignMemberPublic(input: { fullName: string; gender?: Gender; phone?: string; email?: string; region?: string; district?: string; ward?: string; branch?: string; membershipNumber?: string }) {
    const orgId = await resolvePrimaryOrganizationId(this.prisma);
    if (!orgId) throw new NotFoundException("No organization configured");
    return this.registerCampaignMember(orgId, input);
  }

  /** Safe subset of a member's own record for public self-service autofill — no admin-only fields. */
  private toPublicLookup(member: {
    id: string; campaignId: string; membershipNumber: string | null; firstName: string; middleName: string | null; lastName: string;
    phone: string | null; email: string | null; region: string | null; district: string | null; ward: string | null; branch: string | null;
    membershipStatus: string; membershipType: string;
  }) {
    return {
      id: member.id,
      campaignId: member.campaignId,
      membershipNumber: member.membershipNumber,
      firstName: member.firstName,
      middleName: member.middleName,
      lastName: member.lastName,
      phone: member.phone,
      email: member.email,
      region: member.region,
      district: member.district,
      ward: member.ward,
      branch: member.branch,
      membershipStatus: member.membershipStatus,
      membershipType: member.membershipType,
    };
  }

  /** Public "already registered?" lookup for self-service forms — resolves the single deployed org, accepts membership number or campaign ID plus the phone/email on file as proof of ownership. */
  async lookupByIdentifierPublic(identifier: string, contact: string) {
    const orgId = await resolvePrimaryOrganizationId(this.prisma);
    if (!orgId) return { found: false as const };
    const member = await this.findByIdentifier(orgId, identifier);
    if (!member || !matchesContact(member, contact)) return { found: false as const };
    return { found: true as const, member: this.toPublicLookup(member) };
  }

  /**
   * Updates an existing member's own self-service fields by membership number
   * or campaign ID (plus the phone/email on file as proof of ownership) —
   * used when someone picks "I'm already registered" instead of filling the
   * whole form again. Never touches membershipNumber/campaignId themselves
   * (club-controlled), only the contact/location details.
   */
  async updateByIdentifierPublic(
    identifier: string,
    contact: string,
    input: { fullName?: string; gender?: Gender; phone?: string; email?: string; region?: string; district?: string; ward?: string; branch?: string },
  ) {
    const orgId = await resolvePrimaryOrganizationId(this.prisma);
    if (!orgId) throw new NotFoundException("No organization configured");
    const member = await this.findByIdentifier(orgId, identifier);
    if (!member || !matchesContact(member, contact)) {
      throw new NotFoundException("No member found for that membership number or campaign ID");
    }

    const [firstName, ...rest] = input.fullName?.trim().split(/\s+/) ?? [];
    const updated = await this.prisma.member.update({
      where: { id: member.id },
      data: {
        firstName: firstName || undefined,
        lastName: rest.length ? rest.join(" ") : undefined,
        gender: input.gender,
        phone: input.phone,
        email: input.email,
        region: input.region,
        district: input.district,
        ward: input.ward,
        branch: input.branch,
      },
    });
    this.indexMember(updated);
    return updated;
  }

  async getProfile(organizationId: string, memberId: string) {
    const member = await this.prisma.member.findFirst({ where: { id: memberId, organizationId } });
    if (!member) throw new NotFoundException("Member not found");

    const [attendanceRecords, registrations, history, payments] = await Promise.all([
      this.prisma.attendanceRecord.findMany({
        where: { memberId },
        orderBy: { checkedInAt: "desc" },
        include: { event: { select: { id: true, name: true, startDatetime: true } } },
      }),
      this.prisma.eventRegistration.findMany({
        where: { memberId },
        include: { event: { select: { id: true, name: true, startDatetime: true, status: true } } },
      }),
      this.prisma.membershipHistory.findMany({ where: { memberId }, orderBy: { createdAt: "desc" } }),
      // Almost always empty for a non-leader — payments to members exist to record what a leader
      // was paid (e.g. for attending/organizing a meeting), same shape as the media host/influencer
      // payment history sections.
      this.prisma.payment.findMany({ where: { memberId }, orderBy: { paymentDate: "desc" } }),
    ]);

    const totalPaid = payments.filter((p) => p.status === "PAID").reduce((sum, p) => sum + Number(p.paidAmount ?? p.amount), 0);
    const numericPayments = payments.map((p) => ({ ...p, amount: Number(p.amount), paidAmount: p.paidAmount != null ? Number(p.paidAmount) : null }));

    return {
      member,
      stats: {
        eventsAttended: attendanceRecords.length,
        eventsRegistered: registrations.length,
        lastAttendance: attendanceRecords[0]?.checkedInAt ?? null,
      },
      attendanceRecords,
      registrations,
      membershipHistory: history,
      payments: numericPayments,
      totalPaid,
    };
  }

  async update(organizationId: string, memberId: string, dto: UpdateMemberDto) {
    const existing = await this.prisma.member.findFirst({ where: { id: memberId, organizationId } });
    if (!existing) throw new NotFoundException("Member not found");

    const membershipNumber = dto.membershipNumber?.trim() || undefined;
    if (membershipNumber && membershipNumber !== existing.membershipNumber) {
      const clash = await this.prisma.member.findUnique({ where: { organizationId_membershipNumber: { organizationId, membershipNumber } } });
      if (clash) throw new ConflictException(`Membership number ${membershipNumber} is already in use`);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.membershipStatus && dto.membershipStatus !== existing.membershipStatus) {
        await tx.membershipHistory.create({
          data: {
            memberId,
            fromStatus: existing.membershipStatus,
            toStatus: dto.membershipStatus,
            fromType: existing.membershipType,
            toType: dto.membershipType ?? existing.membershipType,
          },
        });
      }

      return tx.member.update({
        where: { id: memberId },
        data: {
          membershipNumber: dto.membershipNumber !== undefined ? membershipNumber ?? null : undefined,
          firstName: dto.firstName,
          middleName: dto.middleName,
          lastName: dto.lastName,
          gender: dto.gender,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
          phone: dto.phone,
          email: dto.email,
          address: dto.address,
          region: dto.region,
          district: dto.district,
          ward: dto.ward,
          branch: dto.branch,
          isLeader: dto.isLeader,
          membershipType: dto.membershipType,
          membershipStatus: dto.membershipStatus,
          customFields: dto.customFields as Prisma.InputJsonValue | undefined,
        },
      });
    });
    this.indexMember(updated);
    return updated;
  }
}
