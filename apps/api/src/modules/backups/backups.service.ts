import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { spawn } from "child_process";
import { createGzip } from "zlib";
import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const BACKUP_PREFIX = "db/";
const RETENTION_COUNT = 30;
const DAILY_RUN_UTC_HOUR = 2;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export interface BackupSummary {
  key: string;
  sizeBytes: number;
  durationMs: number;
}

export interface BackupListing {
  key: string;
  sizeBytes: number;
  lastModified: Date | null;
}

/**
 * Full logical backups of the MySQL database (schema + data + routines/triggers —
 * everything mysqldump captures, so a restore recreates every table's relations
 * exactly as they were) to a Railway-provisioned S3-compatible bucket. Runs once
 * daily and on demand (see BackupsController). Configuration lives entirely in
 * BACKUP_S3_* env vars — if they're unset, scheduled/manual runs no-op with a
 * warning rather than failing the whole app.
 */
@Injectable()
export class BackupsService implements OnModuleInit {
  private readonly logger = new Logger(BackupsService.name);

  private get configured(): boolean {
    return Boolean(process.env.BACKUP_S3_ENDPOINT && process.env.BACKUP_S3_BUCKET && process.env.BACKUP_S3_ACCESS_KEY && process.env.BACKUP_S3_SECRET_KEY);
  }

  onModuleInit(): void {
    if (!this.configured) {
      this.logger.warn("BACKUP_S3_* not configured — scheduled database backups are disabled");
      return;
    }
    this.scheduleDaily();
  }

  private scheduleDaily(): void {
    const now = new Date();
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), DAILY_RUN_UTC_HOUR, 0, 0, 0));
    if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);

    setTimeout(() => {
      void this.runScheduled();
      setInterval(() => void this.runScheduled(), ONE_DAY_MS);
    }, next.getTime() - now.getTime());

    this.logger.log(`Scheduled daily database backup — first run at ${next.toISOString()}`);
  }

  private async runScheduled(): Promise<void> {
    try {
      const result = await this.runBackup();
      this.logger.log(`Scheduled backup complete: ${result.key} (${result.sizeBytes} bytes, ${result.durationMs}ms)`);
    } catch (err) {
      this.logger.error("Scheduled database backup failed", err instanceof Error ? err.stack : String(err));
    }
  }

  private s3Client(): S3Client {
    return new S3Client({
      endpoint: process.env.BACKUP_S3_ENDPOINT,
      region: process.env.BACKUP_S3_REGION ?? "auto",
      forcePathStyle: false,
      credentials: {
        accessKeyId: process.env.BACKUP_S3_ACCESS_KEY!,
        secretAccessKey: process.env.BACKUP_S3_SECRET_KEY!,
      },
    });
  }

  private async dumpAndGzip(): Promise<Buffer> {
    const databaseUrl = new URL(process.env.DATABASE_URL!);
    const dbName = databaseUrl.pathname.replace(/^\//, "");

    return new Promise<Buffer>((resolve, reject) => {
      const child = spawn(
        "mysqldump",
        ["--single-transaction", "--routines", "--triggers", "-h", databaseUrl.hostname, "-P", databaseUrl.port || "3306", "-u", decodeURIComponent(databaseUrl.username), dbName],
        { env: { ...process.env, MYSQL_PWD: decodeURIComponent(databaseUrl.password) } },
      );

      const gzip = createGzip();
      const chunks: Buffer[] = [];
      gzip.on("data", (chunk: Buffer) => chunks.push(chunk));
      gzip.on("error", reject);
      gzip.on("end", () => resolve(Buffer.concat(chunks)));

      let stderr = "";
      child.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
      child.on("error", reject);
      child.stdout.pipe(gzip);
      child.on("close", (code) => {
        if (code !== 0) reject(new Error(`mysqldump exited with code ${code}: ${stderr.slice(0, 2000)}`));
      });
    });
  }

  private async prune(s3: S3Client): Promise<void> {
    const listed = await s3.send(new ListObjectsV2Command({ Bucket: process.env.BACKUP_S3_BUCKET, Prefix: BACKUP_PREFIX }));
    const objects = (listed.Contents ?? []).filter((o): o is { Key: string } => Boolean(o.Key)).sort((a, b) => (a.Key < b.Key ? 1 : -1));
    const stale = objects.slice(RETENTION_COUNT);
    for (const obj of stale) {
      await s3.send(new DeleteObjectCommand({ Bucket: process.env.BACKUP_S3_BUCKET, Key: obj.Key }));
    }
  }

  async runBackup(): Promise<BackupSummary> {
    if (!this.configured) throw new Error("BACKUP_S3_* is not configured");
    const startedAt = Date.now();
    const buffer = await this.dumpAndGzip();
    const key = `${BACKUP_PREFIX}${new Date().toISOString().replace(/[:.]/g, "-")}.sql.gz`;

    const s3 = this.s3Client();
    await s3.send(new PutObjectCommand({ Bucket: process.env.BACKUP_S3_BUCKET, Key: key, Body: buffer, ContentType: "application/gzip" }));
    await this.prune(s3);

    return { key, sizeBytes: buffer.length, durationMs: Date.now() - startedAt };
  }

  async listBackups(): Promise<BackupListing[]> {
    if (!this.configured) return [];
    const s3 = this.s3Client();
    const listed = await s3.send(new ListObjectsV2Command({ Bucket: process.env.BACKUP_S3_BUCKET, Prefix: BACKUP_PREFIX }));
    return (listed.Contents ?? [])
      .filter((o): o is { Key: string; Size?: number; LastModified?: Date } => Boolean(o.Key))
      .map((o) => ({ key: o.Key, sizeBytes: o.Size ?? 0, lastModified: o.LastModified ?? null }))
      .sort((a, b) => (a.key < b.key ? 1 : -1));
  }

  async getDownloadUrl(key: string): Promise<string> {
    if (!this.configured) throw new Error("BACKUP_S3_* is not configured");
    const s3 = this.s3Client();
    const command = new GetObjectCommand({ Bucket: process.env.BACKUP_S3_BUCKET, Key: key });
    return getSignedUrl(s3, command, { expiresIn: 300 });
  }
}
