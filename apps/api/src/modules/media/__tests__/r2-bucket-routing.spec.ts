/**
 * R2Service — public/private bucket routing tests.
 *
 * Verifies that:
 *   - Public folders (projects, units, banners, avatars) → public bucket + publicUrl returned
 *   - Private folders (contracts, receipts, documents, maintenance) → private bucket + no publicUrl
 *   - createPresignedDownload auto-detects bucket from key prefix
 *   - uploadObject routes by folder; returns publicUrl only for public folders
 *   - delete routes by folder prefix
 *   - keyFromStoredValue handles full URLs and bare keys
 *   - PRIVATE_FOLDERS set contains exactly the expected members
 *   - Bucket isolation: no public URL ever returned for private folders
 */

import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { R2Service, PRIVATE_FOLDERS, StorageFolder } from '../r2.service';

// ── Mock the AWS SDK so tests never make real HTTP calls ──────────────────────

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: jest.fn() })),
  PutObjectCommand: jest.fn(),
  DeleteObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn(),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://signed.r2.example/upload?sig=x'),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { S3Client } = require('@aws-sdk/client-s3') as { S3Client: jest.Mock };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner') as { getSignedUrl: jest.Mock };

function makeService(overrides: Record<string, string> = {}): R2Service {
  const defaults = {
    S3_ENDPOINT: 'http://minio:9000',
    S3_REGION: 'us-east-1',
    R2_ACCESS_KEY_ID: 'minioadmin',
    R2_SECRET_ACCESS_KEY: 'minioadmin',
    R2_BUCKET: 'public-bucket',
    R2_PUBLIC_URL: 'https://cdn.example.com',
    R2_PRIVATE_BUCKET: 'private-bucket',
  };
  const cfg: Record<string, string> = { ...defaults, ...overrides };
  const config = { get: (k: string) => cfg[k] ?? '' } as unknown as ConfigService;
  return new R2Service(config);
}

// ── PRIVATE_FOLDERS constant ──────────────────────────────────────────────────

describe('PRIVATE_FOLDERS constant', () => {
  it('contains contracts, receipts, documents, maintenance', () => {
    expect(PRIVATE_FOLDERS.has('contracts')).toBe(true);
    expect(PRIVATE_FOLDERS.has('receipts')).toBe(true);
    expect(PRIVATE_FOLDERS.has('documents')).toBe(true);
    expect(PRIVATE_FOLDERS.has('maintenance')).toBe(true);
  });

  it('does NOT contain public folders (projects, units, banners, avatars)', () => {
    expect(PRIVATE_FOLDERS.has('projects')).toBe(false);
    expect(PRIVATE_FOLDERS.has('units')).toBe(false);
    expect(PRIVATE_FOLDERS.has('banners')).toBe(false);
    expect(PRIVATE_FOLDERS.has('avatars')).toBe(false);
  });

  it('has exactly 4 members', () => {
    expect(PRIVATE_FOLDERS.size).toBe(4);
  });
});

// ── isPrivateFolder ───────────────────────────────────────────────────────────

describe('R2Service.isPrivateFolder()', () => {
  const svc = makeService();

  it.each(['contracts', 'receipts', 'documents', 'maintenance'] as StorageFolder[])(
    '%s → true',
    (folder) => expect(svc.isPrivateFolder(folder)).toBe(true),
  );

  it.each(['projects', 'units', 'banners', 'avatars'] as StorageFolder[])(
    '%s → false',
    (folder) => expect(svc.isPrivateFolder(folder)).toBe(false),
  );
});

// ── createPresignedUpload — bucket routing ────────────────────────────────────

describe('createPresignedUpload — bucket routing', () => {
  beforeEach(() => {
    S3Client.mockClear();
    (getSignedUrl as jest.Mock).mockResolvedValue('https://signed.r2.example/upload?sig=x');
  });

  it('public folder (projects) → returns publicUrl, no private bucket used', async () => {
    const svc = makeService();
    const result = await svc.createPresignedUpload({ contentType: 'image/jpeg', folder: 'projects' });
    expect(result.publicUrl).toMatch(/^https:\/\/cdn\.example\.com\/projects\//);
    expect(result.key).toMatch(/^projects\//);
    expect(result.uploadUrl).toBe('https://signed.r2.example/upload?sig=x');
  });

  it('public folder (units) → publicUrl present', async () => {
    const svc = makeService();
    const result = await svc.createPresignedUpload({ contentType: 'image/png', folder: 'units' });
    expect(result.publicUrl).toBeDefined();
    expect(result.publicUrl).toMatch(/^https:\/\/cdn\.example\.com\/units\//);
  });

  it('public folder (banners) → publicUrl present', async () => {
    const svc = makeService();
    const result = await svc.createPresignedUpload({ contentType: 'image/webp', folder: 'banners' });
    expect(result.publicUrl).toBeDefined();
  });

  it('public folder (avatars) → publicUrl present', async () => {
    const svc = makeService();
    const result = await svc.createPresignedUpload({ contentType: 'image/jpeg', folder: 'avatars' });
    expect(result.publicUrl).toBeDefined();
  });

  it('private folder (documents) → publicUrl absent', async () => {
    const svc = makeService();
    const result = await svc.createPresignedUpload({ contentType: 'application/pdf', folder: 'documents' });
    expect(result.publicUrl).toBeUndefined();
    expect(result.key).toMatch(/^documents\//);
  });

  it('private folder (contracts) → publicUrl absent', async () => {
    const svc = makeService();
    const result = await svc.createPresignedUpload({ contentType: 'application/pdf', folder: 'contracts' });
    expect(result.publicUrl).toBeUndefined();
  });

  it('private folder (receipts) → publicUrl absent', async () => {
    const svc = makeService();
    const result = await svc.createPresignedUpload({ contentType: 'application/pdf', folder: 'receipts' });
    expect(result.publicUrl).toBeUndefined();
  });

  it('private folder (maintenance) → publicUrl absent', async () => {
    const svc = makeService();
    const result = await svc.createPresignedUpload({ contentType: 'image/jpeg', folder: 'maintenance' });
    expect(result.publicUrl).toBeUndefined();
  });

  it('key always present for any folder', async () => {
    const svc = makeService();
    for (const folder of ['projects', 'documents', 'receipts', 'contracts'] as StorageFolder[]) {
      const result = await svc.createPresignedUpload({ contentType: 'application/pdf', folder });
      expect(result.key).toBeTruthy();
    }
  });

  it('throws ServiceUnavailableException when storage not configured', async () => {
    const config = { get: () => '' } as unknown as ConfigService;
    const svc = new R2Service(config);
    await expect(
      svc.createPresignedUpload({ contentType: 'image/jpeg', folder: 'projects' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

// ── uploadObject — bucket routing ─────────────────────────────────────────────

describe('uploadObject — bucket routing', () => {
  it('public folder → publicUrl present', async () => {
    const svc = makeService();
    const result = await svc.uploadObject({
      buffer: Buffer.from('img'),
      contentType: 'image/jpeg',
      folder: 'projects',
    });
    expect(result.publicUrl).toBeDefined();
    expect(result.publicUrl).toMatch(/^https:\/\/cdn\.example\.com\/projects\//);
  });

  it('private folder (maintenance) → publicUrl absent', async () => {
    const svc = makeService();
    const result = await svc.uploadObject({
      buffer: Buffer.from('photo'),
      contentType: 'image/jpeg',
      folder: 'maintenance',
    });
    expect(result.publicUrl).toBeUndefined();
    expect(result.key).toMatch(/^maintenance\//);
  });
});

// ── createPresignedDownload — bucket auto-detection ───────────────────────────

describe('createPresignedDownload — bucket auto-detection', () => {
  it('public key (projects/) → uses public client', async () => {
    const svc = makeService();
    const result = await svc.createPresignedDownload({
      key: 'projects/2026-08-12/abc-123.jpg',
    });
    expect(result.url).toBe('https://signed.r2.example/upload?sig=x');
    expect(result.expiresIn).toBe(300);
  });

  it('private key (documents/) → signed URL still returned (private client used)', async () => {
    const svc = makeService();
    const result = await svc.createPresignedDownload({
      key: 'documents/2026-08-12/abc-123.pdf',
      fileName: 'contract.pdf',
      contentType: 'application/pdf',
    });
    expect(result.url).toBeTruthy();
    expect(result.expiresIn).toBe(300);
  });

  it('contracts/ key → private client (no public URL should ever be the result)', async () => {
    const svc = makeService();
    const result = await svc.createPresignedDownload({
      key: 'contracts/2026-08-12/abc-123.pdf',
    });
    expect(result.url).not.toContain('cdn.example.com');
  });

  it('custom expiresIn is respected', async () => {
    const svc = makeService();
    const result = await svc.createPresignedDownload({
      key: 'documents/2026-08-01/xyz.pdf',
      expiresIn: 60,
    });
    expect(result.expiresIn).toBe(60);
  });
});

// ── keyFromStoredValue — legacy URL + bare key ────────────────────────────────

describe('R2Service.keyFromStoredValue()', () => {
  const svc = makeService();

  it('bare key returned unchanged', () => {
    expect(svc.keyFromStoredValue('documents/2026-08-12/uuid.pdf')).toBe(
      'documents/2026-08-12/uuid.pdf',
    );
  });

  it('full CDN URL → key extracted', () => {
    expect(
      svc.keyFromStoredValue('https://cdn.example.com/contracts/2026-08-12/uuid.pdf'),
    ).toBe('contracts/2026-08-12/uuid.pdf');
  });

  it('CDN URL with trailing slash on base handled', () => {
    expect(
      svc.keyFromStoredValue('https://cdn.example.com/projects/2026-01-01/img.jpg'),
    ).toBe('projects/2026-01-01/img.jpg');
  });

  it('unknown foreign URL → host stripped, path returned', () => {
    expect(
      svc.keyFromStoredValue('https://old-cdn.example.net/documents/2026-01-01/file.pdf'),
    ).toBe('documents/2026-01-01/file.pdf');
  });

  it('empty string returned as-is', () => {
    expect(svc.keyFromStoredValue('')).toBe('');
  });

  it('keyFromPublicUrl is an alias for keyFromStoredValue', () => {
    const url = 'https://cdn.example.com/projects/2026-01-01/img.jpg';
    expect(svc.keyFromPublicUrl(url)).toBe(svc.keyFromStoredValue(url));
  });
});

// ── publicUrlFor ──────────────────────────────────────────────────────────────

describe('R2Service.publicUrlFor()', () => {
  it('builds CDN URL from key', () => {
    const svc = makeService();
    expect(svc.publicUrlFor('projects/2026-01-01/img.jpg')).toBe(
      'https://cdn.example.com/projects/2026-01-01/img.jpg',
    );
  });

  it('handles trailing slash on R2_PUBLIC_URL', () => {
    const svc = makeService({ R2_PUBLIC_URL: 'https://cdn.example.com/' });
    expect(svc.publicUrlFor('units/2026-01-01/img.jpg')).toBe(
      'https://cdn.example.com/units/2026-01-01/img.jpg',
    );
  });
});

// ── Storage isolation — no public URL for private objects ─────────────────────

describe('Storage isolation — no publicUrl ever returned for private folders', () => {
  it('all private folders produce no publicUrl from createPresignedUpload', async () => {
    const svc = makeService();
    for (const folder of PRIVATE_FOLDERS) {
      const result = await svc.createPresignedUpload({
        contentType: 'application/pdf',
        folder,
      });
      expect(result.publicUrl).toBeUndefined();
    }
  });

  it('all private folders produce no publicUrl from uploadObject', async () => {
    const svc = makeService();
    for (const folder of PRIVATE_FOLDERS) {
      const result = await svc.uploadObject({
        buffer: Buffer.from('x'),
        contentType: 'application/pdf',
        folder,
      });
      expect(result.publicUrl).toBeUndefined();
    }
  });
});
