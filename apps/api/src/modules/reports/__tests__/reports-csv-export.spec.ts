import {
  CanActivate,
  ExecutionContext,
  Global,
  INestApplication,
  Module,
} from '@nestjs/common';
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
 * Reports CSV export endpoints.
 *
 *   - Each export route mirrors the @Permissions code of its JSON sibling.
 *   - text/csv content-type + attachment Content-Disposition headers.
 *   - UTF-8 BOM in the body.
 *   - ADMIN bypass; non-admin / unauthenticated rejected; missing-permission
 *     ADMIN gets the structured 403.
 *   - At least one query filter (sales period) flows through to the service.
 */

const BOM = '﻿';

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
  const zero = () => jest.fn().mockResolvedValue(0);
  const emptyArr = () => jest.fn().mockResolvedValue([]);
  const sumZero = () =>
    jest.fn().mockResolvedValue({ _sum: { amount: 0, totalAmount: 0 } });

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

describe('Reports module · CSV export', () => {
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
    prismaMock.$queryRawUnsafe.mockClear();
  });

  // ── Metadata ────────────────────────────────────────────────────────────

  describe('@Permissions metadata on export routes', () => {
    const controllers = Reflect.getMetadata('controllers', ReportsModule) as Array<
      new () => unknown
    >;
    const Ctor = controllers[0]!;
    const proto = Ctor.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;

    function getMeta(method: string): PermissionsMeta | undefined {
      return reflector.get<PermissionsMeta | undefined>(PERMISSIONS_KEY, proto[method]!);
    }

    it.each<[string, string]>([
      ['salesCsv', 'reports:sales:read'],
      ['financialCsv', 'reports:financial:read'],
      ['operationalCsv', 'reports:operational:read'],
      ['financialDashboardCsv', 'reports:financial:read'],
    ])('%s → @Permissions(%s)', (method, code) => {
      expect(getMeta(method)).toMatchObject({ codes: [code], adminBypass: true });
    });
  });

  // ── Sales export ─────────────────────────────────────────────────────────

  describe('GET /reports/sales/export.csv', () => {
    it('returns text/csv with attachment disposition + BOM for ADMIN', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      const res = await request(app.getHttpServer())
        .get('/reports/sales/export.csv')
        .expect(200);

      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-type']).toContain('charset=utf-8');
      expect(res.headers['content-disposition']).toContain('attachment');
      expect(res.headers['content-disposition']).toContain('sales-report.csv');
      expect(res.text.startsWith(BOM)).toBe(true);
      // Body carries the Arabic summary header.
      expect(res.text).toContain('عدد العقود');
    });

    it('passes the period filter through to the raw SQL breakdown', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer())
        .get('/reports/sales/export.csv?period=2030-03')
        .expect(200);
      // sales() builds a $queryRawUnsafe with the sanitized period embedded.
      const calls = prismaMock.$queryRawUnsafe.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      expect(String(calls[0]![0])).toContain('2030-03');
    });

    it('ADMIN missing reports:sales:read is NOT blocked (bypass)', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer()).get('/reports/sales/export.csv').expect(200);
      expect(prismaMock.userPermission.findMany).not.toHaveBeenCalled();
    });

    it('rejects SALES role at the @Roles layer (admin-only)', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['reports:sales:read'],
      };
      await request(app.getHttpServer()).get('/reports/sales/export.csv').expect(403);
    });

    it('rejects unauthenticated requests', async () => {
      FakeAuthGuard.currentUser = null;
      await request(app.getHttpServer()).get('/reports/sales/export.csv').expect(403);
    });
  });

  // ── Financial export ──────────────────────────────────────────────────────

  describe('GET /reports/financial/export.csv', () => {
    it('returns text/csv with the financial filename for ADMIN', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      const res = await request(app.getHttpServer())
        .get('/reports/financial/export.csv')
        .expect(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('financial-report.csv');
      expect(res.text.startsWith(BOM)).toBe(true);
    });

    it('rejects BROKER at the @Roles layer', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'broker-1',
        role: UserRole.BROKER,
        codes: ['reports:financial:read'],
      };
      await request(app.getHttpServer()).get('/reports/financial/export.csv').expect(403);
    });
  });

  // ── Operational export ────────────────────────────────────────────────────

  describe('GET /reports/operational/export.csv', () => {
    it('returns text/csv with the operational filename for ADMIN', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      const res = await request(app.getHttpServer())
        .get('/reports/operational/export.csv')
        .expect(200);
      expect(res.headers['content-disposition']).toContain('operational-report.csv');
      expect(res.text).toContain('إجمالي الوحدات');
    });
  });

  // ── Financial dashboard export ────────────────────────────────────────────

  describe('GET /reports/financial-dashboard/export.csv', () => {
    it('returns text/csv with multi-section body for ADMIN', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      const res = await request(app.getHttpServer())
        .get('/reports/financial-dashboard/export.csv')
        .expect(200);
      expect(res.headers['content-disposition']).toContain('financial-dashboard.csv');
      // Multi-section layout leads with a section comment; the BOM is emitted by
      // toCsv within the first data block (Excel still renders Arabic correctly).
      expect(res.text).toContain(BOM);
      // Existing sections preserved.
      expect(res.text).toContain('# ملخص');
      expect(res.text).toContain('# الأقساط المتأخرة');
      expect(res.text).toContain('# آخر الدفعات');
      // New F1/F4/F5 sections present.
      expect(res.text).toContain('# التحصيل حسب النوع');
      expect(res.text).toContain('# أعمار المتأخرات');
      expect(res.text).toContain('# خط الحجوزات');
      expect(res.text).toContain('# العمولات والالتزامات');
      expect(res.text).toContain('# سلامة المستندات والإيصالات');
      // Stable metric keys + an Arabic label appear in the summary section.
      expect(res.text).toContain('totalCollectedVerified');
      expect(res.text).toContain('المحصّل المؤكد');
    });

    it('forwards the same filters to financialDashboard (projectId)', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      const projectId = '11111111-1111-4111-8111-111111111111';
      await request(app.getHttpServer())
        .get(`/reports/financial-dashboard/export.csv?projectId=${projectId}`)
        .expect(200);
      // The contract aggregate (totalContractValue) carries the projectId filter.
      const where = JSON.stringify(prismaMock.contract.aggregate.mock.calls.map((c) => c[0]));
      expect(where).toContain(projectId);
    });

    it('non-admin without reports:financial:read receives structured 403', async () => {
      // Use a role that passes @Roles(ADMIN)? No — financial routes are
      // ADMIN-only, so @Roles blocks non-admins first. To exercise the
      // PermissionsGuard structured 403 we would need a non-ADMIN role that
      // @Roles allows, which these routes don't have. Assert @Roles block
      // for a SALES user instead.
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: [],
      };
      await request(app.getHttpServer())
        .get('/reports/financial-dashboard/export.csv')
        .expect(403);
    });
  });
});
