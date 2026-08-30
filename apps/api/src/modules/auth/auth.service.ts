import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { generateOpaqueToken, hashPassword, hashToken, verifyPassword } from "@event-intel/security";
import { PrismaService } from "../../prisma/prisma.service";
import { EmailService } from "../notifications/email.service";

const SESSION_TTL_MS = Number(process.env.SESSION_TTL_HOURS ?? 24 * 7) * 60 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "org"
  );
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  async registerOrganization(input: {
    organizationName: string;
    adminFirstName: string;
    adminLastName: string;
    adminEmail: string;
    adminPassword: string;
  }) {
    const existing = await this.prisma.user.findUnique({ where: { email: input.adminEmail } });
    if (existing) throw new ConflictException("An account with this email already exists");

    const passwordHash = await hashPassword(input.adminPassword);
    const baseSlug = slugify(input.organizationName);

    const result = await this.prisma.$transaction(async (tx) => {
      let slug = baseSlug;
      for (let attempt = 0; await tx.organization.findUnique({ where: { slug } }); attempt++) {
        slug = `${baseSlug}-${attempt + 2}`;
      }

      const organization = await tx.organization.create({
        data: { name: input.organizationName, slug },
      });

      const user = await tx.user.create({
        data: {
          email: input.adminEmail,
          passwordHash,
          firstName: input.adminFirstName,
          lastName: input.adminLastName,
        },
      });

      await tx.organizationMember.create({
        data: { organizationId: organization.id, userId: user.id, role: "ORG_SUPER_ADMIN" },
      });

      const { token, hash } = generateOpaqueToken();
      await tx.emailVerificationToken.create({
        data: { userId: user.id, tokenHash: hash, expiresAt: new Date(Date.now() + VERIFY_TOKEN_TTL_MS) },
      });

      return { organization, user, verificationToken: token };
    });

    await this.email.send({
      to: input.adminEmail,
      subject: "Verify your email",
      text: `Welcome to Event Intel. Verify your email with this token: ${result.verificationToken}`,
    });

    const session = await this.createSession(result.user.id);
    return { organization: result.organization, user: this.toPublicUser(result.user), session };
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new UnauthorizedException("Invalid email or password");
    }
    if (user.status === "DISABLED") {
      throw new UnauthorizedException("This account has been disabled");
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const session = await this.createSession(user.id);
    return { user: this.toPublicUser(user), session };
  }

  async logout(rawToken: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { tokenHash: hashToken(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async createSession(userId: string, meta?: { userAgent?: string; ipAddress?: string }) {
    const { token, hash } = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await this.prisma.session.create({
      data: { userId, tokenHash: hash, expiresAt, userAgent: meta?.userAgent, ipAddress: meta?.ipAddress },
    });
    return { token, expiresAt };
  }

  async verifyEmail(token: string): Promise<void> {
    const record = await this.prisma.emailVerificationToken.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException("Invalid or expired verification token");
    }
    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      this.prisma.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date(), status: "ACTIVE" } }),
    ]);
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Always return success shape to the caller — do not leak whether the email exists.
    if (!user) return;

    const { token, hash } = generateOpaqueToken();
    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hash, expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
    });
    await this.email.send({
      to: email,
      subject: "Reset your password",
      text: `Use this token to reset your password (valid 1 hour): ${token}`,
    });
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const record = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException("Invalid or expired reset token");
    }
    const passwordHash = await hashPassword(newPassword);
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      this.prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      this.prisma.session.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
  }

  async getMemberships(userId: string) {
    return this.prisma.organizationMember.findMany({
      where: { userId, status: "ACTIVE" },
      include: { organization: true },
    });
  }

  async updateProfile(userId: string, data: { firstName?: string; lastName?: string; phone?: string }) {
    const user = await this.prisma.user.update({ where: { id: userId }, data });
    return this.toPublicUser(user);
  }

  async updateAvatar(userId: string, profilePhotoUrl: string) {
    const user = await this.prisma.user.update({ where: { id: userId }, data: { profilePhotoUrl } });
    return this.toPublicUser(user);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      throw new UnauthorizedException("Current password is incorrect");
    }
    const passwordHash = await hashPassword(newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash, mustChangePassword: false } }),
      // Revoke every other session — this is a security-sensitive change (spec section 9's
      // "session expiration" contract) — but keep the caller's own current session usable via
      // the controller re-issuing a fresh one right after this call.
      this.prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
  }

  private toPublicUser(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    profilePhotoUrl: string | null;
    isPlatformOwner: boolean;
    mustChangePassword: boolean;
  }) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      profilePhotoUrl: user.profilePhotoUrl,
      isPlatformOwner: user.isPlatformOwner,
      mustChangePassword: user.mustChangePassword,
    };
  }
}
