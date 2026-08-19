import {
  CanActivate,
  ExecutionContext,
  Global,
  INestApplication,
  Module,
} from '@nestjs/common';
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
 * P15.4 — graceful chart fallback. The chart renderer is mocked to return null
 * (the contract for any rendering failure). The board export must STILL produce
 * a valid workbook with its KPI/data tables and zero embedded images — never a
 * broken file.
 */
jest.mock('../../../common/utils/xlsx-chart', () => ({
  renderBarChartPng: jest.fn().mockResolvedValue(null),
  renderDoughnutChartPng: jest.fn().mockResolvedValue(null),
}));

class FakeAuthGuard implements CanActivate {
  static currentUser: { sub: string; role: UserRole; codes: string[] } | null = null;
  canActivate(context: ExecutionContext): boolean {
    if (!FakeAuthGuard.currentUser) return false;
    const req = context.switchToHttp().getRequest();
    req.user = { sub: FakeAuthGuard.currentUser.sub, role: FakeAuthGuard.currentUser.role, email: null, phone: null };
    return true;
  }
}

function makePrismaMock() {
  const zero = () => jest.fn().mockResolvedValue(0);
  const emptyArr = () => jest.fn().mockResolvedValue([]);
  const sumZero = () => jest.fn().mockResolvedValue({ _sum: { amount: 0, totalAmount: 0 } });
  return {
    userPermission: { findMany: jest.fn().mockResolvedValue([]) },
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
    $transaction: jest.fn().mockImplementation(async (ops: unknown) =>
      Array.isArray(ops) ? Promise.all(ops) : ops,
    ),
  };
}

function fetchXlsx(app: INestApplication, path: string) {
  return request(app.getHttpServer())
    .get(path)
    .buffer()
    .parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });
}

describe('Board XLSX — graceful chart fallback (P15.4)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    @Global()
    @Module({
      providers: [{ provide: PrismaService, useValue: makePrismaMock() }],
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

  afterAll(async () => app?.close());

  it.each([
    ['/reports/financial/export.xlsx', 'الملخص'],
    ['/reports/sales/export.xlsx', 'الملخص'],
    ['/reports/financial-dashboard/export.xlsx', 'الملخص'],
  ])('%s still produces a valid workbook with its tables + a chart-unavailable note when charts are null', async (path, coverName) => {
    FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
    const res = await fetchXlsx(app, path).expect(200);
    expect((res.body as Buffer).subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    const wb = new Workbook();
    await wb.xlsx.load(res.body as unknown as ArrayBuffer);
    // Cover sheet + tables still render; each chart slot degrades to a note.
    const cover = wb.getWorksheet(coverName)!;
    expect(cover).toBeDefined();
    const flat: string[] = [];
    cover.eachRow((r) => r.eachCell((c) => flat.push(String(c.value ?? ''))));
    expect(flat.join(' ')).toContain('الرسم البياني غير متاح حالياً');
  });
});
