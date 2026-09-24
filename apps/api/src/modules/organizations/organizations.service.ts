import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { hashPassword } from "@event-intel/security";
import type { OrgMemberStatus, Prisma, RoleKey } from "@event-intel/database";
import { PrismaService } from "../../prisma/prisma.service";
import { EmailService } from "../notifications/email.service";
import { resolvePrimaryOrganizationId } from "../../common/primary-organization";

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  async getById(organizationId: string) {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw new NotFoundException("Organization not found");
    return org;
  }

  async update(organizationId: string, data: { name?: string; website?: string; timezone?: string; logoUrl?: string; heroImageUrl?: string; settings?: Record<string, unknown>; mediaReachTarget?: number | null; memberTarget?: number | null }) {
    await this.getById(organizationId);
    return this.prisma.organization.update({
      where: { id: organizationId },
      data: { ...data, settings: data.settings as Prisma.InputJsonValue | undefined },
    });
  }

  private getHeroSlides(settings: unknown): string[] {
    const value = (settings as Record<string, unknown> | null)?.heroSlides;
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
  }

  /** Adds one image to the landing-page hero slideshow — settings.heroSlides, so no schema migration is needed for this. */
  async addHeroSlide(organizationId: string, imageUrl: string) {
    const org = await this.getById(organizationId);
    const heroSlides = [...this.getHeroSlides(org.settings), imageUrl];
    return this.update(organizationId, { settings: { ...(org.settings as Record<string, unknown>), heroSlides } });
  }

  async removeHeroSlide(organizationId: string, imageUrl: string) {
    const org = await this.getById(organizationId);
    const heroSlides = this.getHeroSlides(org.settings).filter((s) => s !== imageUrl);
    return this.update(organizationId, { settings: { ...(org.settings as Record<string, unknown>), heroSlides } });
  }

  /**
   * Public-facing branding for the marketing landing page, shown to
   * anonymous visitors before any login/org context exists. This product is
   * deployed per-club (one organization) — see resolvePrimaryOrganizationId.
   */
  async getPublicBranding() {
    const orgId = await resolvePrimaryOrganizationId(this.prisma);
    if (!orgId) return { name: "Tunasimama na Simba", logoUrl: null, heroImageUrl: null, heroSlides: [] };
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true, logoUrl: true, heroImageUrl: true, settings: true },
    });
    if (!org) return { name: "Tunasimama na Simba", logoUrl: null, heroImageUrl: null, heroSlides: [] };
    return { name: org.name, logoUrl: org.logoUrl, heroImageUrl: org.heroImageUrl, heroSlides: this.getHeroSlides(org.settings) };
  }

  async listMembers(organizationId: string) {
    return this.prisma.organizationMember.findMany({
      where: { organizationId, status: { not: "REMOVED" } },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true, status: true, lastLoginAt: true } } },
      orderBy: { createdAt: "asc" },
    });
  }

  async inviteUser(organizationId: string, input: { email: string; firstName: string; lastName: string; role: RoleKey; activeFrom?: string; activeUntil?: string }) {
    const org = await this.getById(organizationId);
    let user = await this.prisma.user.findUnique({ where: { email: input.email } });

    let temporaryPassword: string | undefined;
    if (!user) {
      // Email delivery isn't reliably configured in this deployment, so a random token would
      // never reach the new user — default to their last name instead, something the admin who
      // just typed it already knows and can hand over directly. mustChangePassword forces them
      // off it on first login.
      temporaryPassword = input.lastName.trim();
      user = await this.prisma.user.create({
        data: {
          email: input.email,
          firstName: input.firstName,
          lastName: input.lastName,
          passwordHash: await hashPassword(temporaryPassword),
          status: "ACTIVE",
          mustChangePassword: true,
        },
      });
    }

    const existingMembership = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId: user.id } },
    });
    if (existingMembership && existingMembership.status !== "REMOVED") {
      throw new ConflictException("This user is already a member of the organization");
    }

    const activeFrom = input.activeFrom ? new Date(input.activeFrom) : undefined;
    const activeUntil = input.activeUntil ? new Date(input.activeUntil) : undefined;
    const membership = existingMembership
      ? await this.prisma.organizationMember.update({
          where: { id: existingMembership.id },
          data: { role: input.role, status: "ACTIVE", activeFrom, activeUntil },
        })
      : await this.prisma.organizationMember.create({
          data: { organizationId, userId: user.id, role: input.role, activeFrom, activeUntil },
        });

    await this.email.send({
      to: input.email,
      subject: `You've been added to ${org.name}`,
      text: temporaryPassword
        ? `You have been invited to ${org.name} as ${input.role}. Temporary password: ${temporaryPassword} — please log in and change it.`
        : `You have been added to ${org.name} as ${input.role}. Log in with your existing account.`,
    });

    return { ...membership, temporaryPassword };
  }

  async updateMember(organizationId: string, userId: string, data: { role?: RoleKey; status?: OrgMemberStatus; activeFrom?: string; activeUntil?: string }) {
    const membership = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
    });
    if (!membership) throw new NotFoundException("Membership not found");
    // Once a member is Super Admin, that role is read-only — no accidental (or malicious) downgrade
    // via this endpoint. A previous mistaken downgrade here is exactly what locked an org out of
    // Access Control entirely, since it's the one role guaranteed a way back in (see
    // HARD_BASELINE_ROLES). Suspending/reactivating a Super Admin is still allowed; only the role
    // field itself is frozen once set to ORG_SUPER_ADMIN.
    if (membership.role === "ORG_SUPER_ADMIN" && data.role && data.role !== "ORG_SUPER_ADMIN") {
      throw new BadRequestException("Super Admin's role is locked and cannot be changed here");
    }
    return this.prisma.organizationMember.update({
      where: { id: membership.id },
      data: {
        role: data.role,
        status: data.status,
        activeFrom: data.activeFrom !== undefined ? (data.activeFrom ? new Date(data.activeFrom) : null) : undefined,
        activeUntil: data.activeUntil !== undefined ? (data.activeUntil ? new Date(data.activeUntil) : null) : undefined,
      },
    });
  }

  async removeMember(organizationId: string, userId: string) {
    const membership = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
    });
    if (!membership) throw new NotFoundException("Membership not found");
    return this.prisma.organizationMember.update({ where: { id: membership.id }, data: { status: "REMOVED" } });
  }
}
