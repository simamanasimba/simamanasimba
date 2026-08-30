import { Injectable } from "@nestjs/common";
import type { MembershipStatus, MembershipType, Prisma } from "@event-intel/database";
import { PrismaService } from "../../prisma/prisma.service";
import { EmailService } from "../notifications/email.service";

export interface CampaignFilters {
  region?: string;
  membershipType?: MembershipType;
  membershipStatus?: MembershipStatus;
}

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  /**
   * Real email broadcast to a filtered slice of the membership — no SMS yet.
   * SMS/WhatsApp reachout needs a paid provider (e.g. Africa's Talking,
   * Twilio) with real credentials, which aren't configured; this is built so
   * plugging one in later only means adding a second send path here, not
   * redesigning the feature (spec section 57's notification abstraction).
   */
  async send(organizationId: string, subject: string, message: string, filters: CampaignFilters) {
    const where: Prisma.MemberWhereInput = {
      organizationId,
      region: filters.region || undefined,
      membershipType: filters.membershipType,
      membershipStatus: filters.membershipStatus,
      email: { not: null },
    };

    const recipients = await this.prisma.member.findMany({ where, select: { email: true } });
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

    return { matched: recipients.length, sent, skippedNoEmail: await this.countWithoutEmail(organizationId, filters), errors };
  }

  private async countWithoutEmail(organizationId: string, filters: CampaignFilters): Promise<number> {
    return this.prisma.member.count({
      where: {
        organizationId,
        region: filters.region || undefined,
        membershipType: filters.membershipType,
        membershipStatus: filters.membershipStatus,
        email: null,
      },
    });
  }
}
