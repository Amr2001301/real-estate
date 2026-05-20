import { CanActivate, ExecutionContext, Global, INestApplication, Module } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../../../common/decorators/roles.decorator';
import { MaintenanceModule } from '../maintenance.module';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  PERMISSIONS_KEY,
  type PermissionsMeta,
} from '../../../common/decorators/permissions.decorator';

/**
 * Verifies the maintenance permissions rollout:
 *   * Per-route metadata for the 7 surviving handlers + absence of the
 *     legacy `update` multiplexer.
 *   * GET /maintenance-categories stays role-only (no permission gate) so
 *     CUSTOMER can still read categories.
 *   * Customer self-service routes have no permission metadata.
 *   * Legacy PATCH /maintenance-requests/:id returns 404.
 *   * ADMIN bypass works on the new POST /assign and /status routes.
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

function makePrismaMock() {
  return {
    userPermission: {
      findMany: jest.fn().mockImplementation(async () => {
        const u = FakeAuthGuard.currentUser;
        return (u?.codes ?? []).map((code) => ({ permission: { code } }));
      }),
    },
    maintenanceCategory: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue({ id: 'cat-1', name: { ar: 'ع', en: 'en' }, active: true }),
      create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'cat-new',
        ...data,
      })),
      update: jest.fn().mockImplementation(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => ({
        id: where.id,
        ...data,
      })),
    },
    maintenanceRequest: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'req-new',
        ...data,
      })),
      update: jest.fn().mockImplementation(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => ({
        id: where.id,
        ...data,
      })),
    },
    unit: {
      findUnique: jest.fn().mockResolvedValue({ id: 'unit-1', status: 'SOLD' }),
    },
    $transaction: jest.fn().mockImplementation(async (ops: unknown) => {
      if (Array.isArray(ops)) return Promise.all(ops);
      return ops;
    }),
  };
}

describe('Maintenance module · permissions enforcement', () => {
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
      imports: [MockPrismaModule, MaintenanceModule],
      providers: [
        Reflector,
        { provide: APP_GUARD, useClass: FakeAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
      ],
    }).compile();

    reflector = moduleRef.get(Reflector);
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    FakeAuthGuard.currentUser = null;
    mock.userPermission.findMany.mockClear();
    mock.maintenanceRequest.create.mockClear();
    mock.maintenanceRequest.update.mockClear();
    mock.maintenanceCategory.create.mockClear();
  });

  // ── Metadata — controller is internal to the module ───────────────────

  const controllers = Reflect.getMetadata('controllers', MaintenanceModule) as Array<
    new () => unknown
  >;
  const Ctor = controllers[0]!;
  const proto = Ctor.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;

  function getPermissions(method: string): PermissionsMeta | undefined {
    return reflector.get<PermissionsMeta | undefined>(PERMISSIONS_KEY, proto[method]!);
  }
  function getRoles(method: string): UserRole[] | undefined {
    return reflector.get<UserRole[] | undefined>(ROLES_KEY, proto[method]!);
  }

  describe('@Permissions metadata', () => {
    it('listCategories → no permission metadata (role-only; preserves CUSTOMER flow)', () => {
      expect(getPermissions('listCategories')).toBeUndefined();
      expect(getRoles('listCategories')).toEqual([UserRole.ADMIN, UserRole.CUSTOMER]);
    });

    it.each<[string]>([['createCategory'], ['updateCategory']])(
      '%s → maintenance:categories:manage, adminBypass true',
      (method) => {
        expect(getPermissions(method)).toMatchObject({
          codes: ['maintenance:categories:manage'],
          adminBypass: true,
        });
      },
    );

    it.each<[string]>([['create'], ['myList']])(
      '%s (customer self-service) → no permission metadata',
      (method) => {
        expect(getPermissions(method)).toBeUndefined();
        expect(getRoles(method)).toEqual([UserRole.CUSTOMER]);
      },
    );

    it('list (admin) → maintenance:read, adminBypass true', () => {
      expect(getPermissions('list')).toMatchObject({
        codes: ['maintenance:read'],
        adminBypass: true,
      });
    });

    it('assignRequest → maintenance:assign, adminBypass true', () => {
      expect(getPermissions('assignRequest')).toMatchObject({
        codes: ['maintenance:assign'],
        adminBypass: true,
      });
    });

    it('setRequestStatus → maintenance:resolve, adminBypass true', () => {
      expect(getPermissions('setRequestStatus')).toMatchObject({
        codes: ['maintenance:resolve'],
        adminBypass: true,
      });
    });

    it('legacy `update` handler is absent (route split landed)', () => {
      expect(proto.update).toBeUndefined();
    });
  });

  // ── Read / category / customer flows ──────────────────────────────────

  describe('GET /maintenance-requests (admin)', () => {
    it('ADMIN bypasses — no permission DB lookup', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer()).get('/maintenance-requests').expect(200);
      expect(mock.userPermission.findMany).not.toHaveBeenCalled();
    });

    it('unauthenticated → 403', async () => {
      FakeAuthGuard.currentUser = null;
      await request(app.getHttpServer()).get('/maintenance-requests').expect(403);
    });
  });

  describe('GET /maintenance-categories (role-only)', () => {
    it('ADMIN reads categories — no permission DB lookup', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer()).get('/maintenance-categories').expect(200);
      expect(mock.userPermission.findMany).not.toHaveBeenCalled();
    });

    it('CUSTOMER reads categories with zero permissions — no DB lookup, no 403', async () => {
      FakeAuthGuard.currentUser = { sub: 'cust-1', role: UserRole.CUSTOMER, codes: [] };
      await request(app.getHttpServer()).get('/maintenance-categories').expect(200);
      expect(mock.userPermission.findMany).not.toHaveBeenCalled();
    });
  });

  describe('Customer self-service /me/maintenance-requests', () => {
    it('CUSTOMER creates own request with zero permissions', async () => {
      FakeAuthGuard.currentUser = { sub: 'cust-1', role: UserRole.CUSTOMER, codes: [] };
      await request(app.getHttpServer())
        .post('/me/maintenance-requests')
        .send({
          unitId: 'a1111111-1111-4111-8111-111111111111',
          categoryId: 'b2222222-2222-4222-8222-222222222222',
          description: 'AC not working in bedroom',
        })
        .expect(201);
      expect(mock.userPermission.findMany).not.toHaveBeenCalled();
      expect(mock.maintenanceRequest.create).toHaveBeenCalledTimes(1);
    });

    it('CUSTOMER lists own requests with zero permissions', async () => {
      FakeAuthGuard.currentUser = { sub: 'cust-1', role: UserRole.CUSTOMER, codes: [] };
      await request(app.getHttpServer()).get('/me/maintenance-requests').expect(200);
      expect(mock.userPermission.findMany).not.toHaveBeenCalled();
    });

    it('ADMIN is blocked at @Roles on POST /me/maintenance-requests (CUSTOMER-only)', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer())
        .post('/me/maintenance-requests')
        .send({
          unitId: 'a1111111-1111-4111-8111-111111111111',
          categoryId: 'b2222222-2222-4222-8222-222222222222',
          description: 'should-be-blocked',
        })
        .expect(403);
      expect(mock.maintenanceRequest.create).not.toHaveBeenCalled();
    });
  });

  // ── Admin actions (new POST routes) ────────────────────────────────────

  describe('POST /maintenance-requests/:id/assign', () => {
    const PATH = '/maintenance-requests/c3333333-3333-4333-8333-333333333333/assign';

    it('ADMIN bypasses → 201; update called with assignedAdminId set, status NOT set', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer())
        .post(PATH)
        .send({ assignedAdminId: 'd4444444-4444-4444-8444-444444444444' })
        .expect(201);
      const call = mock.maintenanceRequest.update.mock.calls[0]![0] as { data: Record<string, unknown> };
      expect(call.data.assignedAdminId).toBe('d4444444-4444-4444-8444-444444444444');
      expect(call.data.status).toBeUndefined();
    });

    it('SALES even with maintenance:assign → 403 from @Roles (route is ADMIN-only)', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['maintenance:assign'],
      };
      await request(app.getHttpServer())
        .post(PATH)
        .send({ assignedAdminId: 'd4444444-4444-4444-8444-444444444444' })
        .expect(403);
      expect(mock.userPermission.findMany).not.toHaveBeenCalled();
      expect(mock.maintenanceRequest.update).not.toHaveBeenCalled();
    });
  });

  describe('POST /maintenance-requests/:id/status', () => {
    const PATH = '/maintenance-requests/c3333333-3333-4333-8333-333333333333/status';

    it('ADMIN bypasses → 201; update called with status set, assignedAdminId NOT set', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer()).post(PATH).send({ status: 'RESOLVED' }).expect(201);
      const call = mock.maintenanceRequest.update.mock.calls[0]![0] as { data: Record<string, unknown> };
      expect(call.data.status).toBe('RESOLVED');
      expect(call.data.assignedAdminId).toBeUndefined();
    });
  });

  // ── Category management — SALES blocked at @Roles ─────────────────────

  describe('POST /maintenance-categories', () => {
    it('SALES even with maintenance:categories:manage → 403 from @Roles (route is ADMIN-only)', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['maintenance:categories:manage'],
      };
      await request(app.getHttpServer())
        .post('/maintenance-categories')
        .send({ ar: 'كهرباء', en: 'Electrical' })
        .expect(403);
      expect(mock.maintenanceCategory.create).not.toHaveBeenCalled();
    });
  });

  // ── Legacy PATCH /:id removed ──────────────────────────────────────────

  describe('Legacy PATCH /maintenance-requests/:id', () => {
    it('returns 404 (route removed)', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer())
        .patch('/maintenance-requests/c3333333-3333-4333-8333-333333333333')
        .send({ status: 'IN_PROGRESS' })
        .expect(404);
      expect(mock.maintenanceRequest.update).not.toHaveBeenCalled();
    });
  });
});
