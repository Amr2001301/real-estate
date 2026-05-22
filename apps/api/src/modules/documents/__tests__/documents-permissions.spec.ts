import { CanActivate, ExecutionContext, Global, INestApplication, Module } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { UserRole } from '@prisma/client';
import { DocumentsModule } from '../documents.module';
import { R2Service } from '../../media/r2.service';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  PERMISSIONS_KEY,
  type PermissionsMeta,
} from '../../../common/decorators/permissions.decorator';

/**
 * Verifies the documents permissions rollout:
 *   * Per-route metadata for all 6 handlers; class-level @Roles(ADMIN)
 *     preserved (every route is ADMIN-only at the role layer).
 *   * ADMIN bypass on every route; no permission DB lookup.
 *   * SALES is blocked at @Roles even with the matching permission code.
 *   * Soft-delete behaviour: `deletedAt` set on DELETE; row not removed.
 *   * Business validation (assertOwnerExists) still runs after the gate.
 */

interface FakeUser {
  sub: string;
  role: UserRole;
  codes: string[];
}

class FakeAuthGuard implements CanActivate {
  static currentUser: FakeUser | null = null;
  canActivate(context: ExecutionContext): boolean {
    if (!FakeAuthGuard.currentUser) return false;
    const req = context.switchToHttp().getRequest();
    req.user = {
      sub: FakeAuthGuard.currentUser.sub,
      role: FakeAuthGuard.currentUser.role,
      email: null,
      phone: null,
    };
    return true;
  }
}

const fixture: {
  ownerExists: boolean;
  maintenanceExists: boolean;
} = { ownerExists: true, maintenanceExists: true };

function makePrismaMock() {
  return {
    userPermission: {
      findMany: jest.fn().mockImplementation(async () => {
        const u = FakeAuthGuard.currentUser;
        return (u?.codes ?? []).map((code) => ({ permission: { code } }));
      }),
    },
    document: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue({
        id: 'doc-1',
        ownerType: 'PROJECT',
        ownerId: 'a1111111-1111-4111-8111-111111111111',
        title: 'Doc',
        fileUrl: 'https://cdn/x.pdf',
        deletedAt: null,
      }),
      findFirst: jest.fn().mockResolvedValue({
        id: 'doc-1',
        ownerType: 'PROJECT',
        ownerId: 'a1111111-1111-4111-8111-111111111111',
        title: 'Doc',
        fileUrl: 'https://cdn/x.pdf',
        deletedAt: null,
      }),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'doc-new',
        ...data,
      })),
      update: jest.fn().mockImplementation(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => ({
        id: where.id,
        ...data,
      })),
    },
    project: {
      findUnique: jest.fn().mockImplementation(async () =>
        fixture.ownerExists ? { id: 'a1111111-1111-4111-8111-111111111111' } : null,
      ),
    },
    unit: { findUnique: jest.fn().mockResolvedValue(null) },
    lead: { findUnique: jest.fn().mockResolvedValue(null) },
    reservation: { findUnique: jest.fn().mockResolvedValue(null) },
    contract: { findUnique: jest.fn().mockResolvedValue(null) },
    deposit: { findUnique: jest.fn().mockResolvedValue(null) },
    broker: { findUnique: jest.fn().mockResolvedValue(null) },
    brokerCommission: { findUnique: jest.fn().mockResolvedValue(null) },
    brokerPayout: { findUnique: jest.fn().mockResolvedValue(null) },
    user: { findUnique: jest.fn().mockResolvedValue(null) },
    maintenanceRequest: {
      findUnique: jest.fn().mockImplementation(async () =>
        fixture.maintenanceExists ? { id: 'm1111111-1111-4111-8111-111111111111' } : null,
      ),
    },
    $transaction: jest.fn().mockImplementation(async (ops: unknown) => {
      if (Array.isArray(ops)) return Promise.all(ops);
      return ops;
    }),
  };
}

const r2Mock = {
  createPresignedUpload: jest.fn().mockResolvedValue({
    url: 'https://r2.example.com/upload',
    key: 'k',
    publicUrl: 'https://cdn/x',
  }),
};

describe('Documents module · permissions enforcement', () => {
  let app: INestApplication;
  let mock: ReturnType<typeof makePrismaMock>;
  let reflector: Reflector;

  beforeAll(async () => {
    mock = makePrismaMock();

    @Global()
    @Module({
      providers: [{ provide: PrismaService, useValue: mock }],
      exports: [PrismaService],
    })
    class MockPrismaModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [MockPrismaModule, DocumentsModule],
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

    reflector = moduleRef.get(Reflector);
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    FakeAuthGuard.currentUser = null;
    fixture.ownerExists = true;
    fixture.maintenanceExists = true;
    mock.userPermission.findMany.mockClear();
    mock.document.findMany.mockClear();
    mock.document.create.mockClear();
    mock.document.update.mockClear();
    mock.project.findUnique.mockClear();
    mock.maintenanceRequest.findUnique.mockClear();
    r2Mock.createPresignedUpload.mockClear();
  });

  // ── Internal controller reached via Reflect.getMetadata ───────────────
  const controllers = Reflect.getMetadata('controllers', DocumentsModule) as Array<
    new () => unknown
  >;
  const Ctor = controllers[0]!;
  const proto = Ctor.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;

  function getMeta(method: string): PermissionsMeta | undefined {
    return reflector.get<PermissionsMeta | undefined>(PERMISSIONS_KEY, proto[method]!);
  }

  // ── Metadata ──────────────────────────────────────────────────────────

  describe('@Permissions metadata', () => {
    it('presign → documents:upload, adminBypass true', () => {
      expect(getMeta('presign')).toMatchObject({
        codes: ['documents:upload'],
        adminBypass: true,
      });
    });
    it('list → documents:read, adminBypass true', () => {
      expect(getMeta('list')).toMatchObject({
        codes: ['documents:read'],
        adminBypass: true,
      });
    });
    it('findOne → documents:read, adminBypass true', () => {
      expect(getMeta('findOne')).toMatchObject({
        codes: ['documents:read'],
        adminBypass: true,
      });
    });
    it('create → documents:upload, adminBypass true', () => {
      expect(getMeta('create')).toMatchObject({
        codes: ['documents:upload'],
        adminBypass: true,
      });
    });
    it('update → documents:update, adminBypass true', () => {
      expect(getMeta('update')).toMatchObject({
        codes: ['documents:update'],
        adminBypass: true,
      });
    });
    it('softDelete → documents:delete, adminBypass true', () => {
      expect(getMeta('softDelete')).toMatchObject({
        codes: ['documents:delete'],
        adminBypass: true,
      });
    });
  });

  // ── ADMIN bypass ─────────────────────────────────────────────────────

  describe('ADMIN bypass', () => {
    beforeEach(() => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
    });

    it('GET /documents → 200; no permission DB lookup', async () => {
      await request(app.getHttpServer()).get('/documents').expect(200);
      expect(mock.userPermission.findMany).not.toHaveBeenCalled();
    });

    it('POST /documents/presign → 201; R2 service called', async () => {
      await request(app.getHttpServer())
        .post('/documents/presign')
        .send({ contentType: 'application/pdf', sizeBytes: 1024, fileName: 'doc.pdf' })
        .expect(201);
      expect(r2Mock.createPresignedUpload).toHaveBeenCalled();
      expect(mock.userPermission.findMany).not.toHaveBeenCalled();
    });

    it('POST /documents (valid PROJECT owner) → 201; document.create called', async () => {
      await request(app.getHttpServer())
        .post('/documents')
        .send({
          ownerType: 'PROJECT',
          ownerId: 'a1111111-1111-4111-8111-111111111111',
          title: 'Brochure',
          fileUrl: 'https://cdn.example.com/x.pdf',
          category: 'IMAGE',
        })
        .expect(201);
      expect(mock.document.create).toHaveBeenCalledTimes(1);
    });

    it('PATCH /documents/:id → 200; document.update called', async () => {
      await request(app.getHttpServer())
        .patch('/documents/a1111111-1111-4111-8111-111111111111')
        .send({ title: 'Renamed' })
        .expect(200);
      expect(mock.document.update).toHaveBeenCalled();
    });

    it('DELETE /documents/:id → 200; soft delete sets deletedAt', async () => {
      await request(app.getHttpServer())
        .delete('/documents/a1111111-1111-4111-8111-111111111111')
        .expect(200);
      const call = mock.document.update.mock.calls[0]![0] as { data: { deletedAt: Date | null } };
      expect(call.data.deletedAt).toBeInstanceOf(Date);
    });
  });

  // ── Role enforcement — SALES blocked at @Roles ───────────────────────

  describe('SALES blocked at class-level @Roles(ADMIN)', () => {
    it('SALES even with documents:read → 403 on GET /documents; service NOT called', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['documents:read'],
      };
      await request(app.getHttpServer()).get('/documents').expect(403);
      expect(mock.userPermission.findMany).not.toHaveBeenCalled();
      expect(mock.document.findMany).not.toHaveBeenCalled();
    });

    it('SALES even with documents:upload → 403 on POST /documents/presign; R2 NOT called', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['documents:upload'],
      };
      await request(app.getHttpServer())
        .post('/documents/presign')
        .send({ contentType: 'application/pdf', sizeBytes: 1024 })
        .expect(403);
      expect(r2Mock.createPresignedUpload).not.toHaveBeenCalled();
    });

    it('SALES even with documents:delete → 403 on DELETE /documents/:id; document.update NOT called', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['documents:delete'],
      };
      await request(app.getHttpServer())
        .delete('/documents/a1111111-1111-4111-8111-111111111111')
        .expect(403);
      expect(mock.document.update).not.toHaveBeenCalled();
    });
  });

  // ── Unauthenticated ───────────────────────────────────────────────────

  describe('Unauthenticated', () => {
    it('GET /documents without auth → 403', async () => {
      FakeAuthGuard.currentUser = null;
      await request(app.getHttpServer()).get('/documents').expect(403);
    });
  });

  // ── Business validation survives the gate ────────────────────────────

  describe('assertOwnerExists business validation', () => {
    it('ADMIN bypass + POST /documents with invalid PROJECT ownerId → 400; document.create NOT called', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      fixture.ownerExists = false; // project.findUnique returns null
      await request(app.getHttpServer())
        .post('/documents')
        .send({
          ownerType: 'PROJECT',
          ownerId: 'a1111111-1111-4111-8111-111111111111',
          title: 'Broken',
          fileUrl: 'https://cdn.example.com/x.pdf',
        })
        .expect(400);
      expect(mock.project.findUnique).toHaveBeenCalledTimes(1);
      expect(mock.document.create).not.toHaveBeenCalled();
    });

    it('accepts an existing MAINTENANCE_REQUEST owner → document.create called', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      fixture.maintenanceExists = true;
      await request(app.getHttpServer())
        .post('/documents')
        .send({
          ownerType: 'MAINTENANCE_REQUEST',
          ownerId: 'm1111111-1111-4111-8111-111111111111',
          title: 'صورة قبل الإصلاح',
          fileUrl: 'https://cdn.example.com/before.jpg',
        })
        .expect(201);
      expect(mock.maintenanceRequest.findUnique).toHaveBeenCalledTimes(1);
      expect(mock.document.create).toHaveBeenCalledTimes(1);
    });

    it('rejects a missing MAINTENANCE_REQUEST owner → 400; document.create NOT called', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      fixture.maintenanceExists = false;
      await request(app.getHttpServer())
        .post('/documents')
        .send({
          ownerType: 'MAINTENANCE_REQUEST',
          ownerId: 'm1111111-1111-4111-8111-111111111111',
          title: 'broken',
          fileUrl: 'https://cdn.example.com/x.jpg',
        })
        .expect(400);
      expect(mock.maintenanceRequest.findUnique).toHaveBeenCalledTimes(1);
      expect(mock.document.create).not.toHaveBeenCalled();
    });
  });
});
