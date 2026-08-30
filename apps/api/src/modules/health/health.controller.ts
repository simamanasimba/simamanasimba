import { Controller, Get } from "@nestjs/common";
import Redis from "ioredis";
import { PrismaService } from "../../prisma/prisma.service";
import { Public } from "../../common/decorators/public.decorator";

@Public()
@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async root() {
    const [database, redis, search, connectors] = await Promise.all([
      this.database(),
      this.redis(),
      this.search(),
      Promise.resolve(this.connectors()),
    ]);
    const allOk = [database, redis, search].every((c) => c.status === "ok");
    return { status: allOk ? "ok" : "degraded", database, redis, search, connectors };
  }

  @Get("database")
  database() {
    return this.prisma.$queryRaw`select 1`.then(
      () => ({ status: "ok" as const }),
      (err: Error) => ({ status: "error" as const, message: err.message }),
    );
  }

  @Get("redis")
  async redis() {
    const client = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", { lazyConnect: true, retryStrategy: () => null, maxRetriesPerRequest: 1 });
    try {
      await client.connect();
      await client.ping();
      return { status: "ok" as const };
    } catch (err) {
      return { status: "error" as const, message: err instanceof Error ? err.message : String(err) };
    } finally {
      client.disconnect();
    }
  }

  @Get("search")
  async search() {
    if (!process.env.OPENSEARCH_URL) {
      return { status: "ok" as const, provider: "mysql", note: "OPENSEARCH_URL not set — using MySQL LIKE-based fallback" };
    }
    try {
      const res = await fetch(process.env.OPENSEARCH_URL);
      return { status: res.ok ? ("ok" as const) : ("error" as const), provider: "opensearch" };
    } catch (err) {
      return { status: "error" as const, provider: "opensearch", message: err instanceof Error ? err.message : String(err) };
    }
  }

  @Get("connectors")
  connectors() {
    return {
      news: { configured: Boolean(process.env.NEWS_API_KEY) },
      webSearch: { configured: Boolean(process.env.SEARCH_API_KEY) },
      ai: { configured: Boolean(process.env.AI_API_KEY), provider: process.env.AI_PROVIDER ?? "none" },
      youtube: { configured: true, note: "requires a per-organization YouTube API key stored via social account credentials" },
      meta_instagram_linkedin_x_threads_tiktok: { configured: false, note: "requires OAuth app approval — see /api/v1/platform-capabilities" },
    };
  }
}
