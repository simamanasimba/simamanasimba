import { config as loadDotenv } from "dotenv";
import { resolve } from "path";

loadDotenv({ path: resolve(process.cwd(), "../../.env") });

import { createQueues, startWorkers, logger } from "./queue";

const RETRY_OPTS = { attempts: 5, backoff: { type: "exponential" as const, delay: 5_000 } };

async function main(): Promise<void> {
  const { monitoringQueue, socialSyncQueue } = createQueues();

  await monitoringQueue.add(
    "run-due",
    {},
    { repeat: { every: 15 * 60_000 }, ...RETRY_OPTS },
  );
  await socialSyncQueue.add(
    "sync",
    {},
    { repeat: { every: 60 * 60_000 }, ...RETRY_OPTS },
  );

  startWorkers();
  logger.info("Worker started: monitoring rules every 15m, social metrics sync every 60m");
}

main().catch((err) => {
  logger.error({ err }, "Worker failed to start");
  process.exit(1);
});
