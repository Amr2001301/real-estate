import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
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

    if (accountId && accessKeyId && secretAccessKey) {
      this.client = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
      });
    } else {
      this.logger.warn('R2 not configured — media uploads will be rejected');
    }
  }

  async createPresignedUpload(opts: {
    contentType: string;
    folder: 'projects' | 'units' | 'contracts' | 'receipts' | 'maintenance' | 'banners';
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

  publicUrlFor(key: string): string {
    if (this.publicUrl) return `${this.publicUrl.replace(/\/$/, '')}/${key}`;
    return key;
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
      default:
        return '';
    }
  }
}
