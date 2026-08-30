import { BadRequestException, Controller, ForbiddenException, Get, Post, Query } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { BackupsService } from "./backups.service";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types";

const BACKUP_KEY_PREFIX = "db/";

function requirePlatformOwner(user: RequestUser | undefined): void {
  if (!user?.isPlatformOwner) throw new ForbiddenException("Platform owner only");
}

/** Whole-database backups — deliberately platform-owner-only, not org-scoped: a dump covers every organization. */
@Controller("api/v1/platform/backups")
export class BackupsController {
  constructor(private readonly backups: BackupsService) {}

  @Get()
  async list(@CurrentUser() user: RequestUser | undefined) {
    requirePlatformOwner(user);
    return this.backups.listBackups();
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("run")
  async run(@CurrentUser() user: RequestUser | undefined) {
    requirePlatformOwner(user);
    return this.backups.runBackup();
  }

  @Get("download")
  async download(@CurrentUser() user: RequestUser | undefined, @Query("key") key: string) {
    requirePlatformOwner(user);
    if (!key || !key.startsWith(BACKUP_KEY_PREFIX)) throw new BadRequestException("Invalid backup key");
    return { url: await this.backups.getDownloadUrl(key) };
  }
}
