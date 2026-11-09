/**
 * R2Service — the stored key keeps a proper extension.
 *
 * Browsers send `file.name.split('.').pop()` ("png", no dot), which used to
 * make keys like `branding/2026-11-06/<uuid>png`. QA run 1, F-007.
 */
import { ConfigService } from '@nestjs/config';
import { R2Service } from '../r2.service';

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: jest.fn() })),
  PutObjectCommand: jest.fn(),
  DeleteObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn(),
}));
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://signed.example/upload'),
}));

function svc(): R2Service {
  const cfg: Record<string, string> = {
    S3_ENDPOINT: 'http://minio:9000',
    S3_REGION: 'us-east-1',
    R2_ACCESS_KEY_ID: 'k',
    R2_SECRET_ACCESS_KEY: 's',
    R2_BUCKET: 'pub',
    R2_PUBLIC_URL: 'https://cdn.example.com',
    R2_PRIVATE_BUCKET: 'priv',
  };
  return new R2Service({ get: (k: string) => cfg[k] ?? '' } as unknown as ConfigService);
}

describe('presigned upload keys', () => {
  it.each([
    ['png', '.png'],
    ['.PNG', '.png'],
    ['photo.JPG', '.jpg'],
    ['we ird!', '.weird'],
  ])('extension %p gives %p', async (input, ext) => {
    const r = await svc().createPresignedUpload({ folder: 'branding', contentType: 'image/png', extension: input, sizeBytes: 10 });
    expect(r.key.endsWith(ext)).toBe(true);
    expect(r.key).toMatch(/\/[0-9a-f-]{36}\.[a-z0-9]+$/);
  });

  it('falls back to the content type when no usable extension is sent', async () => {
    const r = await svc().createPresignedUpload({ folder: 'branding', contentType: 'image/webp', extension: '!!', sizeBytes: 10 });
    expect(r.key.endsWith('.webp')).toBe(true);
  });
});
