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

/** Top-level object-key namespaces in the storage bucket. */
export type StorageFolder =
  | 'projects'
  | 'units'
  | 'contracts'
  | 'receipts'
  | 'maintenance'
  | 'banners'
  | 'documents'
  | 'avatars';

/**
 * Private folders — always uploaded to / downloaded from the private bucket.
 * Public folders (everything else) use the public bucket with CDN access.
 */
export const PRIVATE_FOLDERS = new Set<StorageFolder>([
  'contracts',
  'receipts',
  'documents',
  'maintenance',
]);

@Injectable()
export class R2Service {
  private readonly logger = new Logger(R2Service.name);

  // Public bucket — serves marketing media (projects, units, banners, avatars).
  private publicClient: S3Client | null = null;
  private publicBucket: string;
  private publicUrl: string;

  // Private bucket — serves sensitive objects (contracts, receipts, documents,
  // maintenance attachments). No CDN domain; access only via presigned GET.
  // Falls back to the public bucket if R2_PRIVATE_BUCKET is not configured
  // (dev/test without isolation). Production env validation requires it.
  private privateClient: S3Client | null = null;
  private privateBucket: string;

  constructor(private readonly config: ConfigService) {
    const accountId = config.get<string>('R2_ACCOUNT_ID');
    const accessKeyId = config.get<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = config.get<string>('R2_SECRET_ACCESS_KEY');

    this.publicBucket = config.get<string>('R2_BUCKET') ?? '';
    this.publicUrl = config.get<string>('R2_PUBLIC_URL') ?? '';
    this.privateBucket = config.get<string>('R2_PRIVATE_BUCKET') ?? this.publicBucket;

    const s3Endpoint = config.get<string>('S3_ENDPOINT');
    const forcePathStyle =
      (config.get<string>('S3_FORCE_PATH_STYLE') ?? '').toLowerCase() === 'true' ||
      (!!s3Endpoint && config.get<string>('S3_FORCE_PATH_STYLE') === undefined);
    const region = config.get<string>('S3_REGION') ?? 'auto';

    if (s3Endpoint && accessKeyId && secretAccessKey) {
      const clientConfig = {
        region,
        endpoint: s3Endpoint,
        credentials: { accessKeyId, secretAccessKey },
        forcePathStyle,
      };
      this.publicClient = new S3Client(clientConfig);
      this.privateClient = new S3Client(clientConfig);
    } else if (accountId && accessKeyId && secretAccessKey) {
      const clientConfig = {
        region: 'auto' as const,
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
      };
      this.publicClient = new S3Client(clientConfig);
      this.privateClient = new S3Client(clientConfig);
    } else {
      this.logger.warn('Object storage not configured — media uploads will be rejected');
    }
  }

  /** True when a folder belongs to the private bucket. */
  isPrivateFolder(folder: StorageFolder): boolean {
    return PRIVATE_FOLDERS.has(folder);
  }

  /**
   * Mint a short-lived presigned PUT URL for a browser-side upload.
   *
   * Public folders  → public bucket, returns `{ uploadUrl, key, publicUrl }`.
   * Private folders → private bucket, returns `{ uploadUrl, key }` (no publicUrl).
   *
   * The returned `key` is the value to persist in the database for private
   * objects. For public objects persist `publicUrl` as the CDN-accessible URL.
   */
  async createPresignedUpload(opts: {
    contentType: string;
    folder: StorageFolder;
    extension?: string;
  }): Promise<{ uploadUrl: string; key: string; publicUrl?: string }> {
    const isPrivate = this.isPrivateFolder(opts.folder);
    const client = isPrivate ? this.privateClient : this.publicClient;
    const bucket = isPrivate ? this.privateBucket : this.publicBucket;

    if (!client || !bucket) {
      throw new ServiceUnavailableException('Storage not configured');
    }
    const ext = opts.extension ?? this.guessExtension(opts.contentType);
    const key = `${opts.folder}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}${ext}`;
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: opts.contentType,
    });
    let uploadUrl: string;
    try {
      uploadUrl = await getSignedUrl(client, command, { expiresIn: 60 * 5 });
    } catch (err) {
      this.logger.error(
        `createPresignedUpload failed for bucket=${bucket}: ${(err as Error).message}`,
      );
      throw new ServiceUnavailableException('Storage not available — please retry shortly');
    }
    const publicUrl = isPrivate ? undefined : this.publicUrlFor(key);
    return { uploadUrl, key, publicUrl };
  }

  /**
   * Server-side direct upload of an in-memory buffer.
   *
   * Public folders  → public bucket, returns `{ key, publicUrl }`.
   * Private folders → private bucket, returns `{ key }` (no publicUrl).
   */
  async uploadObject(opts: {
    buffer: Buffer;
    contentType: string;
    folder: StorageFolder;
    extension?: string;
  }): Promise<{ key: string; publicUrl?: string }> {
    const isPrivate = this.isPrivateFolder(opts.folder);
    const client = isPrivate ? this.privateClient : this.publicClient;
    const bucket = isPrivate ? this.privateBucket : this.publicBucket;

    if (!client || !bucket) {
      throw new ServiceUnavailableException('Storage not configured');
    }
    const ext = opts.extension ?? this.guessExtension(opts.contentType);
    const key = `${opts.folder}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}${ext}`;
    try {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: opts.buffer,
          ContentType: opts.contentType,
        }),
      );
    } catch (err) {
      this.logger.error(`uploadObject failed for bucket=${bucket}: ${(err as Error).message}`);
      throw new ServiceUnavailableException('Storage not available — please retry shortly');
    }
    const publicUrl = isPrivate ? undefined : this.publicUrlFor(key);
    return { key, publicUrl };
  }

  /**
   * Delete an object. Bucket is inferred from the key's folder prefix.
   * Only called for avatar replacement — avatars are in the public bucket.
   */
  async delete(key: string) {
    const folder = key.split('/')[0] as StorageFolder;
    const isPrivate = this.isPrivateFolder(folder);
    const client = isPrivate ? this.privateClient : this.publicClient;
    const bucket = isPrivate ? this.privateBucket : this.publicBucket;
    if (!client || !bucket) return;
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  }

  /**
   * Short-lived signed GET URL for a private object download.
   *
   * The bucket is inferred automatically from the key's folder prefix:
   * private-folder keys → private bucket, public-folder keys → public bucket.
   * This handles both new objects (bare key stored in DB) and legacy objects
   * (full public URL stored in DB — extract the key first via keyFromStoredValue).
   */
  async createPresignedDownload(opts: {
    key: string;
    fileName?: string | null;
    contentType?: string | null;
    expiresIn?: number;
  }): Promise<{ url: string; expiresIn: number }> {
    const folder = opts.key.split('/')[0] as StorageFolder;
    const isPrivate = this.isPrivateFolder(folder);
    const client = isPrivate ? this.privateClient : this.publicClient;
    const bucket = isPrivate ? this.privateBucket : this.publicBucket;

    if (!client || !bucket) {
      throw new ServiceUnavailableException('Storage not configured');
    }
    const expiresIn = opts.expiresIn ?? 60 * 5;
    const safeName = this.safeFileName(opts.fileName);
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: opts.key,
      ResponseContentDisposition: `attachment; filename="${safeName}"`,
      ...(opts.contentType ? { ResponseContentType: opts.contentType } : {}),
    });
    const url = await getSignedUrl(client, command, { expiresIn });
    return { url, expiresIn };
  }

  /** Public CDN URL for a key in the public bucket. */
  publicUrlFor(key: string): string {
    if (this.publicUrl) return `${this.publicUrl.replace(/\/$/, '')}/${key}`;
    return key;
  }

  /**
   * Normalised public base of the configured object storage with a trailing
   * slash. Used by the documents URL guard to allowlist our own presigned-origin
   * URLs even when the dev storage base resolves to localhost.
   */
  get publicBaseUrl(): string {
    return this.publicUrl ? `${this.publicUrl.replace(/\/$/, '')}/` : '';
  }

  /**
   * Extracts the R2 object key from a stored DB value. Handles three cases:
   *
   *  1. Bare key          e.g. `documents/2026-08-12/<uuid>.pdf`  → returned as-is
   *  2. Full CDN URL      e.g. `https://cdn.example.com/projects/…` → prefix stripped
   *  3. Foreign http URL  (any other http(s) URL)                 → host stripped
   *
   * Used before every `createPresignedDownload` call so legacy full-URL records
   * and new bare-key records both resolve correctly.
   */
  keyFromStoredValue(value: string): string {
    if (!value) return value;
    // Case 1: already a bare key (no scheme)
    if (!/^https?:\/\//.test(value)) return value;
    // Case 2: strip configured public URL prefix
    if (this.publicUrl) {
      const base = `${this.publicUrl.replace(/\/$/, '')}/`;
      if (value.startsWith(base)) return value.slice(base.length);
    }
    // Case 3: strip host from any other http(s) URL (legacy unknown origin)
    return value.replace(/^https?:\/\/[^/]+\//, '');
  }

  /**
   * @deprecated Use keyFromStoredValue — handles both bare keys and full URLs.
   */
  keyFromPublicUrl(url: string): string {
    return this.keyFromStoredValue(url);
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
