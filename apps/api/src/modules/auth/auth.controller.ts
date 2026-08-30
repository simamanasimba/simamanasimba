import { BadRequestException, Body, Controller, Get, HttpCode, Patch, Post, Req, Res, UnauthorizedException, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Throttle } from "@nestjs/throttler";
import type { Response } from "express";
import { AuthService } from "./auth.service";
import { RegisterOrganizationDto } from "./dto/register-organization.dto";
import { LoginDto } from "./dto/login.dto";
import { ForgotPasswordDto, ResetPasswordDto, VerifyEmailDto } from "./dto/reset-password.dto";
import { UpdateProfileDto, ChangePasswordDto } from "./dto/update-profile.dto";
import { Public } from "../../common/decorators/public.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { SESSION_COOKIE_NAME } from "../../common/constants";
import type { AuthenticatedRequest, RequestUser } from "../../common/types";
import { StorageService, MAX_UPLOAD_BYTES, sanitizeExtension } from "../storage/storage.service";

const isProduction = process.env.NODE_ENV === "production";

function setSessionCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    // Web app and API live on different domains in production (e.g. a
    // vercel.app site calling a railway.app API) — SameSite=Lax would strip
    // the cookie from cross-site fetch/XHR requests, breaking auth entirely.
    // SameSite=None requires Secure, which is fine since both sides are HTTPS.
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    expires: expiresAt,
    path: "/",
  });
}

@Controller("api/v1/auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly storage: StorageService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("register-organization")
  async registerOrganization(@Body() dto: RegisterOrganizationDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.registerOrganization(dto);
    setSessionCookie(res, result.session.token, result.session.expiresAt);
    return { organization: result.organization, user: result.user };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("login")
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.login(dto.email, dto.password);
    setSessionCookie(res, result.session.token, result.session.expiresAt);
    return { user: result.user };
  }

  @Post("logout")
  @HttpCode(200)
  async logout(@Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[SESSION_COOKIE_NAME];
    if (token) await this.auth.logout(token);
    res.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
    return { success: true };
  }

  @Public()
  @Post("verify-email")
  @HttpCode(200)
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    await this.auth.verifyEmail(dto.token);
    return { success: true };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("forgot-password")
  @HttpCode(200)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.auth.requestPasswordReset(dto.email);
    return { success: true };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("reset-password")
  @HttpCode(200)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.auth.resetPassword(dto.token, dto.newPassword);
    return { success: true };
  }

  @Get("me")
  async me(@CurrentUser() user: RequestUser | undefined) {
    if (!user) throw new UnauthorizedException();
    const memberships = await this.auth.getMemberships(user.id);
    return {
      user,
      organizations: memberships.map((m) => ({
        organizationId: m.organizationId,
        role: m.role,
        organization: { id: m.organization.id, name: m.organization.name, slug: m.organization.slug },
      })),
    };
  }

  @Patch("me")
  async updateProfile(@CurrentUser() user: RequestUser | undefined, @Body() dto: UpdateProfileDto) {
    if (!user) throw new UnauthorizedException();
    return this.auth.updateProfile(user.id, dto);
  }

  @Post("me/avatar")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  async uploadAvatar(@CurrentUser() user: RequestUser | undefined, @UploadedFile() file: Express.Multer.File) {
    if (!user) throw new UnauthorizedException();
    if (!file) throw new BadRequestException("No file uploaded — expected an image file under field name 'file'");
    if (!file.mimetype.startsWith("image/")) throw new BadRequestException("Profile photo must be an image file");

    const ext = sanitizeExtension(file.originalname, "png");
    const url = await this.storage.upload(`avatars/${user.id}/photo.${ext}`, file.buffer, file.mimetype);
    return this.auth.updateAvatar(user.id, `${url}?v=${Date.now()}`);
  }

  @Post("change-password")
  @HttpCode(200)
  async changePassword(
    @CurrentUser() user: RequestUser | undefined,
    @Body() dto: ChangePasswordDto,
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!user) throw new UnauthorizedException();
    await this.auth.changePassword(user.id, dto.currentPassword, dto.newPassword);
    // changePassword revoked every session including the one making this request — issue a
    // fresh one so the user isn't immediately logged out by their own password change.
    const session = await this.auth.createSession(user.id);
    setSessionCookie(res, session.token, session.expiresAt);
    return { success: true };
  }
}
