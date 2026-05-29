import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';

@Injectable()
export class R2Service {
  private readonly logger = new Logger(R2Service.name);
  private client: S3Client | null = null;
  private bucket: string;
  private publicUrl: string;

  constructor(private readonly config: ConfigService) {
    const accountId = config.get<string>('R2_ACCOUNT_ID');
    const accessKeyId = config.get<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = config.get<string>('R2_SECRET_ACCESS_KEY');
    this.bucket = config.get<string>('R2_BUCKET') ?? '';
    this.publicUrl = config.get<string>('R2_PUBLIC_URL') ?? '';

    // S3_ENDPOINT lets local dev point at a MinIO (or any S3-compatible)
    // server without changing code. When set, it wins over the R2 endpoint
    // construction below, and forcePathStyle defaults on (MinIO needs it).
    // Production R2 leaves S3_ENDPOINT unset → unchanged behavior.
    const s3Endpoint = config.get<string>('S3_ENDPOINT');
    const forcePathStyle =
      (config.get<string>('S3_FORCE_PATH_STYLE') ?? '').toLowerCase() === 'true' ||
      (!!s3Endpoint && config.get<string>('S3_FORCE_PATH_STYLE') === undefined);
    const region = config.get<string>('S3_REGION') ?? 'auto';

    if (s3Endpoint && accessKeyId && secretAccessKey) {
      this.client = new S3Client({
        region,
        endpoint: s3Endpoint,
        credentials: { accessKeyId, secretAccessKey },
        forcePathStyle,
      });
    } else if (accountId && accessKeyId && secretAccessKey) {
      this.client = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
      });
    } else {
      this.logger.warn('Object storage not configured — media uploads will be rejected');
    }
  }

  async createPresignedUpload(opts: {
    contentType: string;
    folder:
      | 'projects'
      | 'units'
      | 'contracts'
      | 'receipts'
      | 'maintenance'
      | 'banners'
      | 'documents';
    extension?: string;
  }) {
    if (!this.client || !this.bucket) {
      throw new ServiceUnavailableException('Storage not configured');
    }
    const ext = opts.extension ?? this.guessExtension(opts.contentType);
    const key = `${opts.folder}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}${ext}`;
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: opts.contentType,
    });
    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn: 60 * 5 });
    const publicUrl = this.publicUrlFor(key);
    return { uploadUrl, key, publicUrl };
  }

  async delete(key: string) {
    if (!this.client || !this.bucket) return;
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  /**
   * Short-lived signed GET URL for a private object download. Sets a safe
   * attachment filename + content type. Throws if storage isn't configured.
   */
  async createPresignedDownload(opts: {
    key: string;
    fileName?: string | null;
    contentType?: string | null;
    expiresIn?: number;
  }): Promise<{ url: string; expiresIn: number }> {
    if (!this.client || !this.bucket) {
      throw new ServiceUnavailableException('Storage not configured');
    }
    const expiresIn = opts.expiresIn ?? 60 * 5;
    const safeName = this.safeFileName(opts.fileName);
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: opts.key,
      ResponseContentDisposition: `attachment; filename="${safeName}"`,
      ...(opts.contentType ? { ResponseContentType: opts.contentType } : {}),
    });
    const url = await getSignedUrl(this.client, command, { expiresIn });
    return { url, expiresIn };
  }

  publicUrlFor(key: string): string {
    if (this.publicUrl) return `${this.publicUrl.replace(/\/$/, '')}/${key}`;
    return key;
  }

  // Derives the storage key from a stored public URL (inverse of publicUrlFor).
  keyFromPublicUrl(url: string): string {
    if (this.publicUrl) {
      const base = `${this.publicUrl.replace(/\/$/, '')}/`;
      if (url.startsWith(base)) return url.slice(base.length);
    }
    // Already a key, or an unexpected URL — return as-is (download will 404 if wrong).
    return url.replace(/^https?:\/\/[^/]+\//, '');
  }

  private safeFileName(name?: string | null): string {
    const fallback = 'document';
    if (!name) return fallback;
    const cleaned = name.replace(/[^\w.\-() ]+/g, '_').trim();
    return cleaned.length > 0 ? cleaned : fallback;
  }

  private guessExtension(ct: string): string {
    switch (ct) {
      case 'image/jpeg':
        return '.jpg';
      case 'image/png':
        return '.png';
      case 'image/webp':
        return '.webp';
      case 'video/mp4':
        return '.mp4';
      case 'application/pdf':
        return '.pdf';
      case 'application/msword':
        return '.doc';
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return '.docx';
      case 'application/vnd.ms-excel':
        return '.xls';
      case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        return '.xlsx';
      case 'text/csv':
        return '.csv';
      default:
        return '';
    }
  }
}
