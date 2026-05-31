import { CanActivate, ExecutionContext, Global, INestApplication, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { UserRole } from '@prisma/client';
import { Workbook } from 'exceljs';
import { ReportsModule } from '../reports.module';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { PrismaService } from '../../../common/prisma/prisma.service';

/**
 * P14 — GET /reports/admin-summary correctness. Boots the real ReportsModule
 * over a tailored Prisma mock and asserts that every dashboard section is
 * DB-derived: KPI counts, the 6-month reservation trend grouping, lead-source
 * distribution (sorted, names resolved), the unified recent-activity feed
 * (derived from real rows, newest-first), and actionable alert counts.
 */

class FakeAuthGuard implements CanActivate {
  static currentUser: { sub: string; role: UserRole; codes: string[] } | null = null;
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

const AR_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

function makePrismaMock() {
  return {
    userPermission: { findMany: jest.fn().mockResolvedValue([]) },
    project: { count: jest.fn().mockResolvedValue(4) },
    unit: {
      count: jest.fn().mockImplementation(async (args?: { where?: { status?: string } }) => {
        const status = args?.where?.status;
        if (status === 'AVAILABLE') return 60;
        if (status === 'RESERVED') return 25;
        return 100; // total (no where)
      }),
    },
    lead: {
      count: jest.fn().mockResolvedValue(8), // new this month
      groupBy: jest.fn().mockResolvedValue([
        { sourceId: 's1', _count: { _all: 10 } },
        { sourceId: 's2', _count: { _all: 4 } },
        { sourceId: null, _count: { _all: 2 } },
      ]),
      findMany: jest.fn().mockResolvedValue([
        { id: 'l1', fullName: 'منى', createdAt: new Date('2026-05-30T10:00:00Z') },
      ]),
    },
    leadSource: {
      findMany: jest.fn().mockResolvedValue([
        { id: 's1', name: { ar: 'مباشر', en: 'Direct' } },
        { id: 's2', name: { ar: 'موقع الويب', en: 'Website' } },
      ]),
    },
    deposit: {
      count: jest.fn().mockResolvedValue(3), // pending review
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'd1',
          createdAt: new Date('2026-05-31T09:00:00Z'),
          contract: { contractNumber: 'CON-1', customer: { fullName: 'علي' } },
        },
      ]),
    },
    maintenanceRequest: {
      count: jest.fn().mockResolvedValue(5), // open
      findMany: jest.fn().mockResolvedValue([]),
    },
    contract: {
      count: jest.fn().mockResolvedValue(2), // awaiting signature
      findMany: jest.fn().mockResolvedValue([
        { id: 'c1', contractNumber: 'CON-9', createdAt: new Date('2026-05-31T08:00:00Z'), customer: { fullName: 'سارة' } },
      ]),
    },
    reservation: {
      count: jest.fn().mockImplementation(async (args?: { where?: { expiresAt?: unknown } }) => {
        // The expiring-soon alert query carries expiresAt; the 6 trend queries
        // carry a createdAt range instead.
        if (args?.where?.expiresAt) return 1;
        return 2; // each trend month
      }),
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'r1',
          reservationNumber: 'RES-1',
          createdAt: new Date('2026-05-31T11:00:00Z'),
          unit: { code: 'A-1' },
          client: { fullName: 'خالد' },
          lead: null,
        },
      ]),
    },
    visitAppointment: { count: jest.fn().mockResolvedValue(1) },
    visitRequest: { findMany: jest.fn().mockResolvedValue([]) },
    infoRequest: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    },
    $transaction: jest.fn((ops: unknown) => (Array.isArray(ops) ? Promise.all(ops) : (ops as () => unknown)())),
  };
}

describe('GET /reports/admin-summary (P14)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const prismaMock = makePrismaMock();

    @Global()
    @Module({
      providers: [{ provide: PrismaService, useValue: prismaMock }],
      exports: [PrismaService],
    })
    class MockPrismaModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [MockPrismaModule, ReportsModule],
      providers: [
        { provide: APP_GUARD, useClass: FakeAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => await app.close());

  it('returns DB-derived KPIs (incl. real maintenance + pending deposits)', async () => {
    FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
    const res = await request(app.getHttpServer()).get('/reports/admin-summary').expect(200);
    expect(res.body.kpis).toEqual({
      projects: 4,
      totalUnits: 100,
      availableUnits: 60,
      reservedUnits: 25,
      newLeadsThisMonth: 8,
      pendingDeposits: 3,
      openMaintenance: 5,
    });
  });

  it('groups the reservation trend into the last 6 calendar months', async () => {
    FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
    const res = await request(app.getHttpServer()).get('/reports/admin-summary').expect(200);
    const trend = res.body.reservationTrend as Array<{ month: string; label: string; value: number }>;
    expect(trend).toHaveLength(6);
    // chronological + correct Arabic labels for the trailing 6 months.
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      expect(trend[i]!.label).toBe(AR_MONTHS[d.getMonth()]);
      expect(trend[i]!.month).toBe(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      expect(trend[i]!.value).toBe(2);
    }
  });

  it('distributes leads by source (sorted desc, names resolved, unknown bucketed)', async () => {
    FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
    const res = await request(app.getHttpServer()).get('/reports/admin-summary').expect(200);
    expect(res.body.leadSources).toEqual([
      { source: 'مباشر', count: 10 },
      { source: 'موقع الويب', count: 4 },
      { source: 'غير محدد', count: 2 },
    ]);
  });

  it('derives recent activity from real rows, newest-first (no demo names)', async () => {
    FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
    const res = await request(app.getHttpServer()).get('/reports/admin-summary').expect(200);
    const activity = res.body.recentActivity as Array<{ type: string; title: string; action: string; context: string | null }>;
    // r1 (11:00) > d1 (09:00) > c1 (08:00) > l1 (prev day) — newest first.
    expect(activity[0]).toMatchObject({ type: 'reservation', title: 'خالد', action: 'حجز جديد', context: 'A-1' });
    expect(activity.map((a) => a.type)).toEqual(['reservation', 'deposit', 'contract', 'lead']);
    // None of the removed hardcoded demo names survive.
    expect(JSON.stringify(activity)).not.toMatch(/أحمد منصور|سارة كمال|محمد علي|برج الجوار/);
  });

  it('returns real alert counts only (no fabricated alerts)', async () => {
    FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
    const res = await request(app.getHttpServer()).get('/reports/admin-summary').expect(200);
    expect(res.body.alerts).toEqual({
      contractsAwaitingSignature: 2,
      depositsPendingReview: 3,
      openMaintenance: 5,
      reservationsExpiringSoon: 1,
      visitsAwaitingConfirmation: 1,
      infoRequestsOpen: 0,
    });
    // Every alert value is a number — nothing fabricated.
    for (const v of Object.values(res.body.alerts as Record<string, unknown>)) {
      expect(typeof v).toBe('number');
    }
  });

  it('is forbidden for CUSTOMER / CLIENT / BROKER (rejected at @Roles)', async () => {
    for (const role of [UserRole.CUSTOMER, UserRole.CLIENT, UserRole.BROKER]) {
      FakeAuthGuard.currentUser = { sub: 'u', role, codes: ['reports:operational:read'] };
      await request(app.getHttpServer()).get('/reports/admin-summary').expect(403);
    }
  });

  // ── P14.1 — CSV export ───────────────────────────────────────────────────

  it('export.csv returns a downloadable CSV with the real summary data (no demo values)', async () => {
    FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
    const res = await request(app.getHttpServer())
      .get('/reports/admin-summary/export.csv')
      .expect(200);

    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attachment');

    const csv = res.text;
    // All five real sections are present.
    expect(csv).toContain('المؤشرات الرئيسية');
    expect(csv).toContain('اتجاه الحجوزات');
    expect(csv).toContain('توزيع مصادر العملاء المحتملين');
    expect(csv).toContain('التنبيهات المعلقة');
    expect(csv).toContain('آخر النشاطات');
    // Real values from the mocked DB rows.
    expect(csv).toContain('المشاريع المنشورة,4');
    expect(csv).toContain('مباشر,10');
    expect(csv).toContain('خالد'); // recent-activity actor
    // None of the removed hardcoded demo values survive.
    expect(csv).not.toMatch(/أحمد منصور|بيانات تجريبية|74%/);
  });

  it('export.csv is forbidden for CUSTOMER / CLIENT / BROKER', async () => {
    for (const role of [UserRole.CUSTOMER, UserRole.CLIENT, UserRole.BROKER]) {
      FakeAuthGuard.currentUser = { sub: 'u', role, codes: ['reports:operational:read'] };
      await request(app.getHttpServer()).get('/reports/admin-summary/export.csv').expect(403);
    }
  });

  // ── P14.2 — styled XLSX export ───────────────────────────────────────────

  // Pulls the raw binary body so the workbook can be parsed back with exceljs.
  async function fetchXlsx(): Promise<{ headers: Record<string, string>; wb: Workbook }> {
    const res = await request(app.getHttpServer())
      .get('/reports/admin-summary/export.xlsx')
      .buffer()
      .parse((response, cb) => {
        const chunks: Buffer[] = [];
        response.on('data', (c: Buffer) => chunks.push(c));
        response.on('end', () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);
    const wb = new Workbook();
    await wb.xlsx.load(res.body as unknown as ArrayBuffer);
    return { headers: res.headers, wb };
  }

  /** Flatten every cell value across all sheets into one searchable string. */
  function dumpAll(wb: Workbook): string {
    const parts: string[] = [];
    wb.eachSheet((ws) => {
      ws.eachRow((row) => {
        row.eachCell((cell) => parts.push(String(cell.value ?? '')));
      });
    });
    return parts.join('');
  }

  it('export.xlsx returns the correct content-type + attachment header', async () => {
    FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
    const { headers } = await fetchXlsx();
    expect(headers['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(headers['content-disposition']).toContain('attachment');
    expect(headers['content-disposition']).toContain('admin-summary.xlsx');
  });

  it('workbook has the 5 expected Arabic sheets', async () => {
    FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
    const { wb } = await fetchXlsx();
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      'الملخص',
      'اتجاهات الحجوزات',
      'مصادر العملاء',
      'التنبيهات',
      'آخر النشاطات',
    ]);
  });

  it('workbook is built from real adminSummary data (KPI values, sources, activity)', async () => {
    FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
    const { wb } = await fetchXlsx();
    const all = dumpAll(wb);
    expect(all).toContain('تقرير لوحة التحكم'); // title
    expect(all).toContain('المشاريع المنشورة');
    expect(all).toContain('مباشر'); // lead source name
    expect(all).toContain('خالد'); // recent-activity actor
    // The الملخص KPI table carries the real projects count (4).
    const summary = wb.getWorksheet('الملخص')!;
    const labels: string[] = [];
    summary.eachRow((row) => labels.push(String(row.getCell(1).value ?? '')));
    const projectsRow = summary
      .getRows(1, summary.rowCount)!
      .find((r) => String(r.getCell(1).value) === 'المشاريع المنشورة');
    expect(projectsRow?.getCell(2).value).toBe(4);
  });

  it('workbook contains no old fake/demo values', async () => {
    FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
    const { wb } = await fetchXlsx();
    expect(dumpAll(wb)).not.toMatch(/أحمد منصور|بيانات تجريبية|74%|برج الجوار/);
  });

  it('export.xlsx is forbidden for CUSTOMER / CLIENT / BROKER', async () => {
    for (const role of [UserRole.CUSTOMER, UserRole.CLIENT, UserRole.BROKER]) {
      FakeAuthGuard.currentUser = { sub: 'u', role, codes: ['reports:operational:read'] };
      await request(app.getHttpServer()).get('/reports/admin-summary/export.xlsx').expect(403);
    }
  });
});
