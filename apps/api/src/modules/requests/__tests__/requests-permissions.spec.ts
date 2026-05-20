import { CanActivate, ExecutionContext, Global, INestApplication, Module } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { UserRole } from '@prisma/client';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';
import { ROLES_KEY } from '../../../common/decorators/roles.decorator';
import { RequestsModule } from '../requests.module';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  PERMISSIONS_KEY,
  type PermissionsMeta,
} from '../../../common/decorators/permissions.decorator';

/**
 * Locks down the legacy /visit-requests admin surface in requests.module.ts.
 *
 * Critical invariants:
 *   * GET /visit-requests  → visits:read  (closes the bypass that the visits
 *     batch initially missed; this spec is the regression guard)
 *   * PATCH /visit-requests/:id  → visits:approve
 *   * Public + CLIENT/CUSTOMER /me + GET /info-requests routes have NO
 *     permission metadata (intentionally role-only / public)
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
    visitRequest: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    infoRequest: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    $transaction: jest.fn().mockImplementation(async (ops: unknown) => {
      if (Array.isArray(ops)) return Promise.all(ops);
      return ops;
    }),
  };
}

describe('Requests module · permissions enforcement (legacy admin surface)', () => {
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
      imports: [MockPrismaModule, RequestsModule],
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
  });

  // ── Metadata — internal controller class via Reflect.getMetadata ───────
  const controllers = Reflect.getMetadata('controllers', RequestsModule) as Array<
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
  function isPublic(method: string): boolean | undefined {
    return reflector.get<boolean | undefined>(IS_PUBLIC_KEY, proto[method]!);
  }

  describe('@Permissions metadata', () => {
    it('listVisits (GET /visit-requests) → visits:read, adminBypass true', () => {
      expect(getPermissions('listVisits')).toMatchObject({
        codes: ['visits:read'],
        adminBypass: true,
      });
    });

    it('updateVisit (PATCH /visit-requests/:id) → visits:approve, adminBypass true', () => {
      expect(getPermissions('updateVisit')).toMatchObject({
        codes: ['visits:approve'],
        adminBypass: true,
      });
    });

    it('listInfo (GET /info-requests) → no permission metadata (role-only, deferred)', () => {
      expect(getPermissions('listInfo')).toBeUndefined();
      // Confirm it's still role-gated to ADMIN/SALES.
      expect(getRoles('listInfo')).toEqual([UserRole.ADMIN, UserRole.SALES]);
    });

    it('publicInfo + publicVisit — @Public(), no permission metadata', () => {
      expect(getPermissions('publicInfo')).toBeUndefined();
      expect(getPermissions('publicVisit')).toBeUndefined();
      expect(isPublic('publicInfo')).toBe(true);
      expect(isPublic('publicVisit')).toBe(true);
    });

    it('meInfo + meVisit + myVisits — role-only (CLIENT/CUSTOMER), no permission metadata', () => {
      for (const method of ['meInfo', 'meVisit', 'myVisits']) {
        expect(getPermissions(method)).toBeUndefined();
        expect(getRoles(method)).toEqual([UserRole.CLIENT, UserRole.CUSTOMER]);
      }
    });
  });

  // ── End-to-end on GET /visit-requests (the route that was at risk) ────

  describe('GET /visit-requests', () => {
    it('ADMIN bypasses — no permission DB lookup', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer()).get('/visit-requests').expect(200);
      expect(mock.userPermission.findMany).not.toHaveBeenCalled();
    });

    it('SALES with visits:read → 200 (single DB lookup)', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['visits:read'],
      };
      await request(app.getHttpServer()).get('/visit-requests').expect(200);
      expect(mock.userPermission.findMany).toHaveBeenCalledTimes(1);
    });

    it('SALES without visits:read → structured 403', async () => {
      FakeAuthGuard.currentUser = { sub: 'sales-2', role: UserRole.SALES, codes: [] };
      const res = await request(app.getHttpServer()).get('/visit-requests').expect(403);
      expect(res.body).toMatchObject({
        code: 'missing_permission',
        permissions: ['visits:read'],
      });
    });

    it('rejects unauthenticated requests', async () => {
      FakeAuthGuard.currentUser = null;
      await request(app.getHttpServer()).get('/visit-requests').expect(403);
    });
  });

  // ── Sanity: GET /info-requests stays accessible to SALES with no code ─

  describe('GET /info-requests (role-only by design)', () => {
    it('SALES with zero permissions → 200 (no permission gate)', async () => {
      FakeAuthGuard.currentUser = { sub: 'sales-1', role: UserRole.SALES, codes: [] };
      await request(app.getHttpServer()).get('/info-requests').expect(200);
      // Permissions DB was never consulted because the route has no
      // @Permissions metadata.
      expect(mock.userPermission.findMany).not.toHaveBeenCalled();
    });
  });
});
