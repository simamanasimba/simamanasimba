import { Controller, Logger, Post, UseGuards } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { MonitoringService } from "../monitoring/monitoring.service";
import { getSocialConnector } from "@event-intel/connectors";
import { InternalKeyGuard } from "../../common/guards/internal-key.guard";
import { Public } from "../../common/decorators/public.decorator";

@Public()
@UseGuards(InternalKeyGuard)
@Controller("api/v1/internal")
export class InternalController {
  private readonly logger = new Logger(InternalController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly monitoring: MonitoringService,
  ) {}

  /** Called by the worker's repeatable "run-monitoring-rules" job. */
  @Post("monitoring/run-due")
  async runDueMonitoringRules() {
    const rules = await this.prisma.monitoringRule.findMany({ where: { isActive: true } });
    const results: Array<{ ruleId: string; ok: boolean; created?: number; error?: string }> = [];
    for (const rule of rules) {
      try {
        const result = await this.monitoring.runRule(rule.organizationId, rule.id);
        results.push({ ruleId: rule.id, ok: true, created: result.created });
      } catch (err) {
        this.logger.error(`Rule ${rule.id} failed: ${err instanceof Error ? err.message : err}`);
        results.push({ ruleId: rule.id, ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    }
    return { rulesRun: results.length, results };
  }

  /** Called by the worker's repeatable "sync-social-metrics" job. */
  @Post("social-metrics/sync")
  async syncSocialMetrics() {
    const accounts = await this.prisma.socialAccount.findMany({ where: { status: "CONNECTED" } });
    const results: Array<{ accountId: string; status: string; message?: string }> = [];
    for (const account of accounts) {
      const connector = getSocialConnector(account.platform);
      const credentials: Record<string, string> = account.platform === "YOUTUBE" ? { apiKey: process.env.YOUTUBE_API_KEY ?? "" } : {};
      const metrics = await connector.fetchAccountMetrics(account.externalAccountId ?? "", credentials);

      if (metrics.status === "OK" && metrics.data) {
        const snapshots = Object.entries({ followers: metrics.data.followers, posts: metrics.data.posts })
          .filter(([, v]) => typeof v === "number")
          .map(([metricKey, metricValue]) =>
            this.prisma.metricSnapshot.create({
              data: { organizationId: account.organizationId, entityType: "SOCIAL_ACCOUNT", socialAccountId: account.id, metricKey, metricValue: metricValue as number },
            }),
          );
        await Promise.all(snapshots);
        await this.prisma.socialAccount.update({ where: { id: account.id }, data: { lastSyncedAt: new Date(), lastError: null } });
        results.push({ accountId: account.id, status: "OK" });
      } else {
        await this.prisma.socialAccount.update({ where: { id: account.id }, data: { lastError: metrics.message } });
        results.push({ accountId: account.id, status: metrics.status, message: metrics.message });
      }
    }
    return { accountsProcessed: results.length, results };
  }
}
