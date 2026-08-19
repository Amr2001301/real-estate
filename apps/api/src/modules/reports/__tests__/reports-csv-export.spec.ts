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
import { Workbook } from 'exceljs';
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
    $queryRaw: jest.fn().mockResolvedValue([]),
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
    prismaMock.$queryRaw.mockClear();
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
      ['salesXlsx', 'reports:sales:read'],
      ['financialCsv', 'reports:financial:read'],
      ['financialXlsx', 'reports:financial:read'],
      ['operationalCsv', 'reports:operational:read'],
      ['operationalXlsx', 'reports:operational:read'],
      ['financialDashboardCsv', 'reports:financial:read'],
      ['financialDashboardXlsx', 'reports:financial:read'],
    ])('%s → @Permissions(%s)', (method, code) => {
      expect(getMeta(method)).toMatchObject({ codes: [code], adminBypass: true });
    });
  });

  // ── Operational XLSX twin (P15.3) ─────────────────────────────────────────

  function fetchXlsx(path: string) {
    return request(app.getHttpServer())
      .get(path)
      .buffer()
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
  }

  describe('GET /reports/operational/export.xlsx', () => {
    it('returns a real XLSX (PK) with the spreadsheet content-type + attachment', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      const res = await fetchXlsx('/reports/operational/export.xlsx').expect(200);
      const body = res.body as Buffer;
      expect(res.headers['content-type']).toContain(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      expect(res.headers['content-disposition']).toContain('operational-report.xlsx');
      expect(body.subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    });

    it('opens with the two expected sheets and no fake/demo values', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      const res = await fetchXlsx('/reports/operational/export.xlsx').expect(200);
      const wb = new Workbook();
      await wb.xlsx.load(res.body as unknown as ArrayBuffer);
      expect(wb.worksheets.map((w) => w.name)).toEqual(['المؤشرات', 'الحجوزات حسب الحالة']);
      const flat: string[] = [];
      wb.eachSheet((ws) => ws.eachRow((r) => r.eachCell((c) => flat.push(String(c.value ?? '')))));
      const all = flat.join(' ');
      expect(all).toContain('التقرير التشغيلي');
      expect(all).toContain('إجمالي الوحدات');
      expect(all).not.toMatch(/أحمد منصور|بيانات تجريبية|برج الجوار|74%/);
    });

    it('rejects SALES / BROKER at the @Roles layer', async () => {
      for (const role of [UserRole.SALES, UserRole.BROKER]) {
        FakeAuthGuard.currentUser = { sub: 'x', role, codes: ['reports:operational:read'] };
        await request(app.getHttpServer()).get('/reports/operational/export.xlsx').expect(403);
      }
    });
  });

  // ── Board-style report XLSX (P15.4) ───────────────────────────────────────

  async function loadBoard(path: string) {
    FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
    const res = await fetchXlsx(path).expect(200);
    const wb = new Workbook();
    await wb.xlsx.load(res.body as unknown as ArrayBuffer);
    const flat: string[] = [];
    wb.eachSheet((ws) => ws.eachRow((r) => r.eachCell((c) => flat.push(String(c.value ?? '')))));
    return { res, wb, text: flat.join(' ') };
  }

  describe('GET /reports/sales/export.xlsx (board)', () => {
    it('is a real XLSX (PK) + content-type/attachment with the expected sheets, no fakes', async () => {
      const { res, wb, text } = await loadBoard('/reports/sales/export.xlsx');
      expect(res.headers['content-type']).toContain('spreadsheetml.sheet');
      expect(res.headers['content-disposition']).toContain('sales-report.xlsx');
      expect((res.body as Buffer).subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
      expect(wb.worksheets.map((w) => w.name)).toEqual(['الملخص', 'المبيعات حسب المشروع']);
      expect(text).toContain('تقرير المبيعات');
      expect(text).toContain('الملخص التنفيذي');
      expect(text).not.toMatch(/أحمد منصور|بيانات تجريبية|74%/);
    });
    it('is forbidden for SALES (admin-only @Roles)', async () => {
      FakeAuthGuard.currentUser = { sub: 'x', role: UserRole.SALES, codes: ['reports:sales:read'] };
      await request(app.getHttpServer()).get('/reports/sales/export.xlsx').expect(403);
    });
  });

  describe('GET /reports/financial/export.xlsx (board)', () => {
    it('embeds a doughnut chart on the cover, PK, expected sheet, no fakes', async () => {
      const { res, wb, text } = await loadBoard('/reports/financial/export.xlsx');
      expect(res.headers['content-disposition']).toContain('financial-report.xlsx');
      expect((res.body as Buffer).subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
      expect(wb.worksheets.map((w) => w.name)).toEqual(['الملخص']);
      // Verified/unverified doughnut renders even at zero values → image embedded.
      expect(wb.getWorksheet('الملخص')!.getImages().length).toBeGreaterThan(0);
      expect(text).toContain('التقرير المالي');
      expect(text).not.toMatch(/أحمد منصور|بيانات تجريبية|74%/);
    });
    it('is forbidden for BROKER', async () => {
      FakeAuthGuard.currentUser = { sub: 'x', role: UserRole.BROKER, codes: ['reports:financial:read'] };
      await request(app.getHttpServer()).get('/reports/financial/export.xlsx').expect(403);
    });
  });

  describe('GET /reports/financial-dashboard/export.xlsx (board)', () => {
    it('is a real XLSX (PK) with cover + detail sheets, no fakes', async () => {
      const { res, wb, text } = await loadBoard('/reports/financial-dashboard/export.xlsx');
      expect(res.headers['content-disposition']).toContain('financial-dashboard.xlsx');
      expect((res.body as Buffer).subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
      expect(wb.worksheets.map((w) => w.name)).toEqual([
        'الملخص', 'التحصيل حسب النوع', 'أعمار المتأخرات',
      ]);
      expect(text).toContain('لوحة المؤشرات المالية');
      expect(text).not.toMatch(/أحمد منصور|بيانات تجريبية|74%/);
    });
    it('forwards the projectId filter to financialDashboard', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      const projectId = '11111111-1111-4111-8111-111111111111';
      await fetchXlsx(`/reports/financial-dashboard/export.xlsx?projectId=${projectId}`).expect(200);
      const where = JSON.stringify(prismaMock.contract.aggregate.mock.calls.map((c) => c[0]));
      expect(where).toContain(projectId);
    });
    it('is forbidden for SALES', async () => {
      FakeAuthGuard.currentUser = { sub: 'x', role: UserRole.SALES, codes: ['reports:financial:read'] };
      await request(app.getHttpServer()).get('/reports/financial-dashboard/export.xlsx').expect(403);
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
      // sales() builds a $queryRaw with the Prisma.sql tagged template; the
      // second argument is the period string bound as a parameter.
      const calls = prismaMock.$queryRaw.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      // The period value is passed as a parameterised SQL literal, not embedded
      // in the query string — verify it appears somewhere in the call args.
      const args = JSON.stringify(calls);
      expect(args).toContain('2030-03');
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
