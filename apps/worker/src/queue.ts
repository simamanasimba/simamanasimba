import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { createLogger, type Logger } from "@event-intel/logger";

const logger: Logger = createLogger("worker");
const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", { maxRetriesPerRequest: null });

const API_BASE = process.env.API_INTERNAL_URL ?? "http://localhost:4000";
const INTERNAL_KEY = process.env.INTERNAL_API_KEY ?? "";

class RetryableError extends Error {}
class NonRetryableError extends Error {}

/**
 * Calls one of the API's internal endpoints. Server errors and rate limits
 * (5xx/429) are retryable — BullMQ's exponential backoff will re-attempt.
 * 4xx client errors are not (misconfiguration won't fix itself on retry) —
 * spec section 66's retryable/non-retryable/rate-limit distinction.
 */
async function callInternal(path: string): Promise<unknown> {
  const res = await fetch(`${API_BASE}${path}`, { method: "POST", headers: { "x-internal-key": INTERNAL_KEY } });
  if (res.status === 429 || res.status >= 500) {
    throw new RetryableError(`${path} returned ${res.status}`);
  }
  if (!res.ok) {
    throw new NonRetryableError(`${path} returned ${res.status}: ${await res.text().catch(() => "")}`);
  }
  return res.json();
}

export function createQueues() {
  const monitoringQueue = new Queue("monitoring-runs", { connection });
  const socialSyncQueue = new Queue("social-metrics-sync", { connection });
  return { monitoringQueue, socialSyncQueue };
}

export function startWorkers(): void {
  new Worker(
    "monitoring-runs",
    async (job: Job) => {
      logger.info({ jobId: job.id }, "Running due monitoring rules");
      return callInternal("/api/v1/internal/monitoring/run-due");
    },
    { connection, concurrency: 1 },
  ).on("failed", (job, err) => logger.error({ jobId: job?.id, err }, "monitoring-runs job failed"));

  new Worker(
    "social-metrics-sync",
    async (job: Job) => {
      logger.info({ jobId: job.id }, "Syncing social metrics");
      return callInternal("/api/v1/internal/social-metrics/sync");
    },
    { connection, concurrency: 1 },
  ).on("failed", (job, err) => logger.error({ jobId: job?.id, err }, "social-metrics-sync job failed"));
}

export { logger };
