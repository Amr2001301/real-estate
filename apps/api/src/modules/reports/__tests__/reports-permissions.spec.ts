import { CanActivate, ExecutionContext, Global, INestApplication, Module } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { UserRole } from '@prisma/client';
import { ReportsModule } from '../reports.module';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  PERMISSIONS_KEY,
  type PermissionsMeta,
} from '../../../common/decorators/permissions.decorator';

/**
 * Verifies:
 *   * Every reports route carries the EXACT @Permissions code from the spec
 *     mapping (operational vs sales vs financial).
 *   * ADMIN bypass works without DB lookup.
 *   * Non-admin and unauthenticated callers are rejected.
 *
 * The ReportsController is internal to reports.module.ts (not exported),
 * so we reach it via Reflect.getMetadata('controllers', ReportsModule).
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

/**
 * ReportsService touches many Prisma models. We mock each surface with a
 * benign default so any route under test returns 200 for an ADMIN caller.
 */
function makePrismaMock() {
  const zero = () => jest.fn().mockResolvedValue(0);
  const emptyArr = () => jest.fn().mockResolvedValue([]);
  const sumZero = () => jest.fn().mockResolvedValue({ _sum: { amount: 0, totalAmount: 0 } });

  return {
    userPermission: {
      findMany: jest.fn().mockImplementation(async () => {
        const u = FakeAuthGuard.currentUser;
        return (u?.codes ?? []).map((code) => ({ permission: { code } }));
      }),
    },
    project: { count: zero() },
    unit: { count: zero() },
    lead: { count: zero() },
    visitRequest: { count: zero() },
    contract: { count: zero(), aggregate: sumZero(), findMany: emptyArr() },
    deposit: { count: zero(), aggregate: sumZero(), findMany: emptyArr(), groupBy: emptyArr() },
    installment: { count: zero(), aggregate: sumZero(), findMany: emptyArr() },
    reservation: {
      groupBy: jest.fn().mockResolvedValue([]),
      count: zero(),
      aggregate: jest.fn().mockResolvedValue({ _sum: { bookingAmount: 0 } }),
    },
    bonusEntry: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 }, _count: { _all: 0 } }) },
    brokerCommission: { aggregate: jest.fn().mockResolvedValue({ _sum: { netAmount: 0 }, _count: { _all: 0 } }) },
    brokerPayout: { groupBy: jest.fn().mockResolvedValue([]) },
    document: { findMany: emptyArr() },
    $queryRawUnsafe: jest.fn().mockResolvedValue([]),
    $transaction: jest.fn().mockImplementation(async (ops: unknown) => {
      if (Array.isArray(ops)) return Promise.all(ops);
      return ops;
    }),
  };
}

describe('Reports module · permissions enforcement', () => {
  let app: INestApplication;
  let prismaMock: ReturnType<typeof makePrismaMock>;
  let reflector: Reflector;

  beforeAll(async () => {
    prismaMock = makePrismaMock();

    @Global()
    @Module({
      providers: [{ provide: PrismaService, useValue: prismaMock }],
      exports: [PrismaService],
    })
    class MockPrismaModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [MockPrismaModule, ReportsModule],
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
    prismaMock.userPermission.findMany.mockClear();
  });

  // ── Metadata: route → permission code mapping ──────────────────────────

  describe('@Permissions metadata on every route', () => {
    const controllers = Reflect.getMetadata('controllers', ReportsModule) as Array<
      new () => unknown
    >;
    const Ctor = controllers[0]!;
    const proto = Ctor.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;

    function getMeta(method: string): PermissionsMeta | undefined {
      return reflector.get<PermissionsMeta | undefined>(PERMISSIONS_KEY, proto[method]!);
    }

    it.each<[string, string]>([
      ['kpis',               'reports:operational:read'],
      ['adminSummary',       'reports:operational:read'],
      ['sales',              'reports:sales:read'],
      ['financial',          'reports:financial:read'],
      ['reservations',       'reports:operational:read'],
      ['financialDashboard', 'reports:financial:read'],
    ])('%s → @Permissions(%s)', (method, code) => {
      expect(getMeta(method)).toMatchObject({ codes: [code], adminBypass: true });
    });
  });

  // ── End-to-end: one route per permission group ─────────────────────────

  describe('GET /reports/kpis (operational)', () => {
    it('allows ADMIN by bypass — no permission DB lookup', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer()).get('/reports/kpis').expect(200);
      expect(prismaMock.userPermission.findMany).not.toHaveBeenCalled();
    });
    it('rejects SALES at the @Roles layer (permissions DB never queried)', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['reports:operational:read'], // even with the code, @Roles(ADMIN) blocks
      };
      const res = await request(app.getHttpServer()).get('/reports/kpis').expect(403);
      expect(res.body.message).toBe('Insufficient role');
      expect(prismaMock.userPermission.findMany).not.toHaveBeenCalled();
    });
    it('rejects unauthenticated requests', async () => {
      FakeAuthGuard.currentUser = null;
      await request(app.getHttpServer()).get('/reports/kpis').expect(403);
    });
  });

  describe('GET /reports/sales (sales)', () => {
    it('allows ADMIN by bypass', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer()).get('/reports/sales').expect(200);
      expect(prismaMock.userPermission.findMany).not.toHaveBeenCalled();
    });
    it('rejects CUSTOMER at the @Roles layer', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'cust-1',
        role: UserRole.CUSTOMER,
        codes: ['reports:sales:read'],
      };
      await request(app.getHttpServer()).get('/reports/sales').expect(403);
      expect(prismaMock.userPermission.findMany).not.toHaveBeenCalled();
    });
  });

  describe('GET /reports/financial (financial)', () => {
    it('allows ADMIN by bypass', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer()).get('/reports/financial').expect(200);
      expect(prismaMock.userPermission.findMany).not.toHaveBeenCalled();
    });
    it('rejects BROKER at the @Roles layer', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'broker-1',
        role: UserRole.BROKER,
        codes: ['reports:financial:read'],
      };
      await request(app.getHttpServer()).get('/reports/financial').expect(403);
      expect(prismaMock.userPermission.findMany).not.toHaveBeenCalled();
    });
  });
});
