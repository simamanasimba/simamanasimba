import { Injectable, Logger } from "@nestjs/common";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";

const LOCAL_STORAGE_DIR = join(process.cwd(), "storage");

/**
 * S3-compatible object storage (works with AWS S3, Cloudflare R2, or MinIO —
 * spec section 7). Without S3_ENDPOINT/S3_BUCKET configured, falls back to
 * writing under ./storage and serving it from Express as a dev-only
 * convenience — never silently pretend a file was uploaded when it wasn't.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3?: S3Client;
  private readonly bucket = process.env.S3_BUCKET;

  constructor() {
    if (process.env.S3_ENDPOINT && process.env.S3_BUCKET && process.env.S3_ACCESS_KEY && process.env.S3_SECRET_KEY) {
      this.s3 = new S3Client({
        endpoint: process.env.S3_ENDPOINT,
        region: process.env.S3_REGION ?? "auto",
        forcePathStyle: true,
        credentials: { accessKeyId: process.env.S3_ACCESS_KEY, secretAccessKey: process.env.S3_SECRET_KEY },
      });
    } else {
      this.logger.warn("S3 not configured — files will be stored on local disk under ./storage (dev fallback only)");
    }
  }

  async upload(key: string, body: Buffer, contentType: string): Promise<string> {
    if (this.s3 && this.bucket) {
      await this.s3.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }));
      return `${process.env.S3_ENDPOINT}/${this.bucket}/${key}`;
    }

    const filePath = join(LOCAL_STORAGE_DIR, key);
    await mkdir(join(filePath, ".."), { recursive: true });
    await writeFile(filePath, body);
    return `/files/${key}`;
  }

  /** Reads back a previously-uploaded file (e.g. an org logo) as raw bytes — for embedding into
   * server-rendered PDFs. Returns null rather than throwing if the file is missing or unreadable,
   * since a missing logo should degrade a PDF's branding, not break generation entirely. */
  async readAsBuffer(url: string): Promise<Buffer | null> {
    try {
      if (url.startsWith("http")) {
        const res = await fetch(url);
        if (!res.ok) return null;
        return Buffer.from(await res.arrayBuffer());
      }
      const key = url.replace(/^\/files\//, "").split("?")[0];
      return await readFile(join(LOCAL_STORAGE_DIR, key));
    } catch {
      return null;
    }
  }
}
