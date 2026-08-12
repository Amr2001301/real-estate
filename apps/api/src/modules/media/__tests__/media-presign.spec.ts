import {
  CanActivate,
  ExecutionContext,
  Global,
  INestApplication,
  Module,
  ValidationPipe,
} from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { UserRole } from '@prisma/client';
import { MediaModule, ALLOWED_MEDIA_MIME_TYPES, MAX_MEDIA_UPLOAD_SIZE_BYTES } from '../media.module';
import { R2Service } from '../r2.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';

/**
 * POST /media/presign — MIME allowlist + size cap + authorization.
 *
 * Covers:
 *   - DTO validation: each allowed MIME type accepted, blocked types rejected
 *   - DTO validation: sizeBytes range (zero, negative, over-max, at-max, valid)
 *   - Authorization: ADMIN allowed, SALES/CLIENT/anonymous blocked
 *   - R2 not called for invalid or unauthorized requests
 *   - ContentType and folder are forwarded to R2 unchanged
 *   - Allowlist constants do not contain dangerous types (sanity check)
 */

class FakeAuthGuard implements CanActivate {
  static currentUser: { sub: string; role: UserRole } | null = null;
  canActivate(context: ExecutionContext): boolean {
    if (!FakeAuthGuard.currentUser) return false;
    const req = context.switchToHttp().getRequest<{ user: unknown }>();
    req.user = {
      sub: FakeAuthGuard.currentUser.sub,
      role: FakeAuthGuard.currentUser.role,
      email: null,
      phone: null,
    };
    return true;
  }
}

const r2Mock = {
  createPresignedUpload: jest
    .fn()
    .mockResolvedValue({ uploadUrl: 'https://r2.example.com/upload', key: 'k', publicUrl: 'https://cdn/k' }),
};

const prismaMock = {
  userPermission: { findMany: jest.fn().mockResolvedValue([]) },
};

describe('POST /media/presign — MIME allowlist + size validation + authorization', () => {
  let app: INestApplication;

  beforeAll(async () => {
    @Global()
    @Module({
      providers: [{ provide: PrismaService, useValue: prismaMock }],
      exports: [PrismaService],
    })
    class MockPrismaModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [MockPrismaModule, MediaModule],
      providers: [
        Reflector,
        { provide: APP_GUARD, useClass: FakeAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
      ],
    })
      .overrideProvider(R2Service)
      .useValue(r2Mock)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN };
    r2Mock.createPresignedUpload.mockClear();
    prismaMock.userPermission.findMany.mockClear();
  });

  // ── Allowlist sanity ───────────────────────────────────────────────────────
  // Verify dangerous types are structurally excluded from the constant used by
  // both the DTO @IsIn guard and the service-level defense-in-depth check.

  describe('ALLOWED_MEDIA_MIME_TYPES constant', () => {
    it('does not include text/html', () => {
      expect(ALLOWED_MEDIA_MIME_TYPES).not.toContain('text/html');
    });
    it('does not include application/javascript', () => {
      expect(ALLOWED_MEDIA_MIME_TYPES).not.toContain('application/javascript');
    });
    it('does not include text/javascript', () => {
      expect(ALLOWED_MEDIA_MIME_TYPES).not.toContain('text/javascript');
    });
    it('does not include image/svg+xml', () => {
      expect(ALLOWED_MEDIA_MIME_TYPES).not.toContain('image/svg+xml');
    });
    it('does not include application/octet-stream', () => {
      expect(ALLOWED_MEDIA_MIME_TYPES).not.toContain('application/octet-stream');
    });
  });

  // ── Authorization ──────────────────────────────────────────────────────────

  describe('Authorization', () => {
    const VALID = { contentType: 'image/jpeg', folder: 'projects', sizeBytes: 1024 };

    it('unauthenticated → 403; R2 not called', async () => {
      FakeAuthGuard.currentUser = null;
      await request(app.getHttpServer()).post('/media/presign').send(VALID).expect(403);
      expect(r2Mock.createPresignedUpload).not.toHaveBeenCalled();
    });

    it('ADMIN → 201; R2 called', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN };
      await request(app.getHttpServer()).post('/media/presign').send(VALID).expect(201);
      expect(r2Mock.createPresignedUpload).toHaveBeenCalled();
    });

    it('SALES → 403; R2 not called', async () => {
      FakeAuthGuard.currentUser = { sub: 'sales-1', role: UserRole.SALES };
      await request(app.getHttpServer()).post('/media/presign').send(VALID).expect(403);
      expect(r2Mock.createPresignedUpload).not.toHaveBeenCalled();
    });

    it('CLIENT → 403; R2 not called', async () => {
      FakeAuthGuard.currentUser = { sub: 'client-1', role: UserRole.CLIENT };
      await request(app.getHttpServer()).post('/media/presign').send(VALID).expect(403);
      expect(r2Mock.createPresignedUpload).not.toHaveBeenCalled();
    });
  });

  // ── MIME allowlist ─────────────────────────────────────────────────────────

  describe('MIME allowlist', () => {
    it.each([...ALLOWED_MEDIA_MIME_TYPES])(
      'allowed MIME "%s" → 201; R2 called',
      async (mime) => {
        await request(app.getHttpServer())
          .post('/media/presign')
          .send({ contentType: mime, folder: 'projects', sizeBytes: 1024 })
          .expect(201);
        expect(r2Mock.createPresignedUpload).toHaveBeenCalled();
        r2Mock.createPresignedUpload.mockClear();
      },
    );

    it('text/html → 400; R2 not called', async () => {
      await request(app.getHttpServer())
        .post('/media/presign')
        .send({ contentType: 'text/html', folder: 'projects', sizeBytes: 1024 })
        .expect(400);
      expect(r2Mock.createPresignedUpload).not.toHaveBeenCalled();
    });

    it('application/javascript → 400; R2 not called', async () => {
      await request(app.getHttpServer())
        .post('/media/presign')
        .send({ contentType: 'application/javascript', folder: 'projects', sizeBytes: 1024 })
        .expect(400);
      expect(r2Mock.createPresignedUpload).not.toHaveBeenCalled();
    });

    it('text/javascript → 400; R2 not called', async () => {
      await request(app.getHttpServer())
        .post('/media/presign')
        .send({ contentType: 'text/javascript', folder: 'projects', sizeBytes: 1024 })
        .expect(400);
      expect(r2Mock.createPresignedUpload).not.toHaveBeenCalled();
    });

    it('image/svg+xml → 400; R2 not called', async () => {
      await request(app.getHttpServer())
        .post('/media/presign')
        .send({ contentType: 'image/svg+xml', folder: 'projects', sizeBytes: 1024 })
        .expect(400);
      expect(r2Mock.createPresignedUpload).not.toHaveBeenCalled();
    });

    it('application/octet-stream → 400; R2 not called', async () => {
      await request(app.getHttpServer())
        .post('/media/presign')
        .send({ contentType: 'application/octet-stream', folder: 'projects', sizeBytes: 1024 })
        .expect(400);
      expect(r2Mock.createPresignedUpload).not.toHaveBeenCalled();
    });

    it('missing contentType → 400; R2 not called', async () => {
      await request(app.getHttpServer())
        .post('/media/presign')
        .send({ folder: 'projects', sizeBytes: 1024 })
        .expect(400);
      expect(r2Mock.createPresignedUpload).not.toHaveBeenCalled();
    });
  });

  // ── Folder validation ──────────────────────────────────────────────────────

  describe('Folder validation', () => {
    it('invalid folder → 400; R2 not called', async () => {
      await request(app.getHttpServer())
        .post('/media/presign')
        .send({ contentType: 'image/jpeg', folder: 'arbitrary-folder', sizeBytes: 1024 })
        .expect(400);
      expect(r2Mock.createPresignedUpload).not.toHaveBeenCalled();
    });

    it('missing folder → 400; R2 not called', async () => {
      await request(app.getHttpServer())
        .post('/media/presign')
        .send({ contentType: 'image/jpeg', sizeBytes: 1024 })
        .expect(400);
      expect(r2Mock.createPresignedUpload).not.toHaveBeenCalled();
    });

    it('private folder (contracts) → 400; not allowed through general media endpoint', async () => {
      await request(app.getHttpServer())
        .post('/media/presign')
        .send({ contentType: 'application/pdf', folder: 'contracts', sizeBytes: 1024 })
        .expect(400);
      expect(r2Mock.createPresignedUpload).not.toHaveBeenCalled();
    });

    it('private folder (documents) → 400; not allowed through general media endpoint', async () => {
      await request(app.getHttpServer())
        .post('/media/presign')
        .send({ contentType: 'application/pdf', folder: 'documents', sizeBytes: 1024 })
        .expect(400);
      expect(r2Mock.createPresignedUpload).not.toHaveBeenCalled();
    });

    it('private folder (maintenance) → 400; not allowed through general media endpoint', async () => {
      await request(app.getHttpServer())
        .post('/media/presign')
        .send({ contentType: 'image/jpeg', folder: 'maintenance', sizeBytes: 1024 })
        .expect(400);
      expect(r2Mock.createPresignedUpload).not.toHaveBeenCalled();
    });

    it('receipts folder → 201; routes to private bucket (no publicUrl in response)', async () => {
      // receipts is allowed through the general endpoint for admin deposit recording.
      // The response omits publicUrl — callers must persist the key.
      r2Mock.createPresignedUpload.mockResolvedValueOnce({
        uploadUrl: 'https://r2.example.com/upload',
        key: 'receipts/2026-08-12/uuid.pdf',
        // publicUrl intentionally absent — private folder
      });
      const res = await request(app.getHttpServer())
        .post('/media/presign')
        .send({ contentType: 'application/pdf', folder: 'receipts', sizeBytes: 1024 })
        .expect(201);
      expect(res.body.publicUrl).toBeUndefined();
      expect(res.body.key).toBeTruthy();
    });
  });

  // ── Size validation ────────────────────────────────────────────────────────

  describe('Size validation', () => {
    it('sizeBytes = 1 (minimum) → 201', async () => {
      await request(app.getHttpServer())
        .post('/media/presign')
        .send({ contentType: 'image/jpeg', folder: 'projects', sizeBytes: 1 })
        .expect(201);
    });

    it(`sizeBytes = ${MAX_MEDIA_UPLOAD_SIZE_BYTES} (boundary) → 201`, async () => {
      await request(app.getHttpServer())
        .post('/media/presign')
        .send({ contentType: 'image/jpeg', folder: 'projects', sizeBytes: MAX_MEDIA_UPLOAD_SIZE_BYTES })
        .expect(201);
    });

    it(`sizeBytes = MAX + 1 → 400; R2 not called`, async () => {
      await request(app.getHttpServer())
        .post('/media/presign')
        .send({ contentType: 'image/jpeg', folder: 'projects', sizeBytes: MAX_MEDIA_UPLOAD_SIZE_BYTES + 1 })
        .expect(400);
      expect(r2Mock.createPresignedUpload).not.toHaveBeenCalled();
    });

    it('sizeBytes = 0 → 400; R2 not called', async () => {
      await request(app.getHttpServer())
        .post('/media/presign')
        .send({ contentType: 'image/jpeg', folder: 'projects', sizeBytes: 0 })
        .expect(400);
      expect(r2Mock.createPresignedUpload).not.toHaveBeenCalled();
    });

    it('sizeBytes = -1 → 400; R2 not called', async () => {
      await request(app.getHttpServer())
        .post('/media/presign')
        .send({ contentType: 'image/jpeg', folder: 'projects', sizeBytes: -1 })
        .expect(400);
      expect(r2Mock.createPresignedUpload).not.toHaveBeenCalled();
    });

    it('missing sizeBytes → 400; R2 not called', async () => {
      await request(app.getHttpServer())
        .post('/media/presign')
        .send({ contentType: 'image/jpeg', folder: 'projects' })
        .expect(400);
      expect(r2Mock.createPresignedUpload).not.toHaveBeenCalled();
    });
  });

  // ── Payload forwarding ─────────────────────────────────────────────────────

  describe('Payload forwarding', () => {
    it('validated contentType is passed to R2 unchanged', async () => {
      await request(app.getHttpServer())
        .post('/media/presign')
        .send({ contentType: 'image/webp', folder: 'units', sizeBytes: 2048 })
        .expect(201);
      expect(r2Mock.createPresignedUpload).toHaveBeenCalledWith(
        expect.objectContaining({ contentType: 'image/webp', folder: 'units' }),
      );
    });

    it('optional extension is forwarded when present', async () => {
      await request(app.getHttpServer())
        .post('/media/presign')
        .send({ contentType: 'image/jpeg', folder: 'projects', sizeBytes: 512, extension: '.jpg' })
        .expect(201);
      expect(r2Mock.createPresignedUpload).toHaveBeenCalledWith(
        expect.objectContaining({ extension: '.jpg' }),
      );
    });

    it('sizeBytes is NOT forwarded to R2 (upload size not cryptographically bound)', async () => {
      await request(app.getHttpServer())
        .post('/media/presign')
        .send({ contentType: 'image/jpeg', folder: 'projects', sizeBytes: 1024 })
        .expect(201);
      const callArgs = r2Mock.createPresignedUpload.mock.calls[0][0] as Record<string, unknown>;
      // sizeBytes is validated server-side but not passed to R2; actual uploaded
      // bytes are not cryptographically enforced by presigned PUT (see residual
      // risk documentation in media.module.ts).
      expect(callArgs).not.toHaveProperty('sizeBytes');
    });
  });
});
