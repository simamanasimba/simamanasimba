import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { hashToken } from "@event-intel/security";
import { PrismaService } from "../../prisma/prisma.service";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import type { AuthenticatedRequest } from "../types";
import { SESSION_COOKIE_NAME } from "../constants";

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const rawToken: string | undefined = req.cookies?.[SESSION_COOKIE_NAME];
    if (!rawToken) {
      if (isPublic) return true;
      throw new UnauthorizedException("No active session");
    }

    const tokenHash = hashToken(rawToken);
    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      if (isPublic) return true;
      throw new UnauthorizedException("Session expired or invalid");
    }

    req.user = {
      id: session.user.id,
      email: session.user.email,
      firstName: session.user.firstName,
      lastName: session.user.lastName,
      phone: session.user.phone,
      profilePhotoUrl: session.user.profilePhotoUrl,
      isPlatformOwner: session.user.isPlatformOwner,
      mustChangePassword: session.user.mustChangePassword,
    };

    return true;
  }
}
