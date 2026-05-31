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
import { BrokerStatus, UserRole } from '@prisma/client';
import { Workbook } from 'exceljs';
import { BrokerReportsModule } from '../broker-reports.module';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { PrismaService } from '../../../common/prisma/prisma.service';

/**
 * P15.3 — styled XLSX twins of the broker-reports CSV exports (top-brokers +
 * broker-detail). Controller-level @Roles(ADMIN) + @Permissions('broker_reports
 * :read') still apply; the CSV endpoints stay the raw fallback.
 *
 * The empty-universe path (no commissions/contracts in range) is the realistic
 * "nothing to show" case and the cleanest way to prove the XLSX generates a
 * valid, fake-free workbook end-to-end.
 */

const BROKER_ID = '11111111-1111-4111-8111-111111111111';

class FakeAuthGuard implements CanActivate {
  static currentUser: { sub: string; role: UserRole; codes: string[] } | null = null;
  canActivate(context: ExecutionContext): boolean {
    if (!FakeAuthGuard.currentUser) return false;
    const req = context.switchToHttp().getRequest();
    req.user = { sub: FakeAuthGuard.currentUser.sub, role: FakeAuthGuard.currentUser.role, email: null, phone: null };
    return true;
  }
}

const brokerRow = {
  id: BROKER_ID,
  companyName: { ar: 'وساطة الرياض', en: 'Riyadh Brokerage' },
  commercialName: { ar: 'وساطة الرياض', en: 'Riyadh Brokerage' },
  code: 'BR-001',
  status: BrokerStatus.ACTIVE,
  defaultCommissionPct: 2.5,
  commissionModel: 'PERCENTAGE',
  contractStartAt: null,
  contractEndAt: null,
};

/** Returns benign empty defaults for any model.method the services call. */
function autoPrisma() {
  const model = () => ({
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn().mockResolvedValue(null),
    findUnique: jest.fn().mockResolvedValue(null),
    count: jest.fn().mockResolvedValue(0),
    aggregate: jest.fn().mockResolvedValue({ _sum: {}, _count: { _all: 0 }, _avg: {}, _min: {}, _max: {} }),
    groupBy: jest.fn().mockResolvedValue([]),
  });
  const cache: Record<string, ReturnType<typeof model>> = {};
  return new Proxy({} as Record<string, unknown>, {
    get(_t, prop: string) {
      if (prop === 'userPermission') {
        return {
          findMany: jest.fn().mockImplementation(async () =>
            (FakeAuthGuard.currentUser?.codes ?? []).map((code) => ({ permission: { code } })),
          ),
        };
      }
      if (prop === '$transaction') {
        return jest.fn((ops: unknown) => (Array.isArray(ops) ? Promise.all(ops) : (ops as () => unknown)()));
      }
      if (prop === 'then') return undefined; // not a thenable
      cache[prop] ??= model();
      if (prop === 'broker') cache[prop].findUnique = jest.fn().mockResolvedValue(brokerRow);
      return cache[prop];
    },
  });
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

async function loadSheets(body: Buffer): Promise<{ names: string[]; text: string }> {
  const wb = new Workbook();
  await wb.xlsx.load(body as unknown as ArrayBuffer);
  const flat: string[] = [];
  wb.eachSheet((ws) => ws.eachRow((r) => r.eachCell((c) => flat.push(String(c.value ?? '')))));
  return { names: wb.worksheets.map((w) => w.name), text: flat.join(' ') };
}

describe('broker-reports XLSX exports (P15.3)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    @Global()
    @Module({
      providers: [{ provide: PrismaService, useValue: autoPrisma() }],
      exports: [PrismaService],
    })
    class MockPrismaModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [MockPrismaModule, BrokerReportsModule],
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

  describe('GET /broker-reports/export/top-brokers.xlsx', () => {
    it('returns a real XLSX (PK) + content-type/attachment, single sheet, no fakes', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      const res = await fetchXlsx(app, '/broker-reports/export/top-brokers.xlsx').expect(200);
      expect(res.headers['content-type']).toContain('spreadsheetml.sheet');
      expect(res.headers['content-disposition']).toContain('top-brokers.xlsx');
      expect((res.body as Buffer).subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
      const { names, text } = await loadSheets(res.body as Buffer);
      expect(names).toEqual(['أعلى الوسطاء']);
      expect(text).toContain('تقرير أعلى الوسطاء');
      expect(text).not.toMatch(/أحمد منصور|بيانات تجريبية|74%/);
    });

    it('is forbidden for non-admin roles', async () => {
      for (const role of [UserRole.SALES, UserRole.BROKER, UserRole.CUSTOMER]) {
        FakeAuthGuard.currentUser = { sub: 'x', role, codes: ['broker_reports:read'] };
        await request(app.getHttpServer()).get('/broker-reports/export/top-brokers.xlsx').expect(403);
      }
    });
  });

  describe('GET /broker-reports/export/broker/:id.xlsx', () => {
    it('returns a real XLSX (PK) with the four detail sheets, no fakes', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      const res = await fetchXlsx(app, `/broker-reports/export/broker/${BROKER_ID}.xlsx`).expect(200);
      expect(res.headers['content-disposition']).toContain('broker-detail.xlsx');
      expect((res.body as Buffer).subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
      const { names, text } = await loadSheets(res.body as Buffer);
      expect(names).toEqual(['الملخص', 'الاتجاه الشهري', 'الوكلاء', 'المشاريع']);
      expect(text).toContain('تقرير الوسيط');
      expect(text).not.toMatch(/أحمد منصور|بيانات تجريبية|74%/);
    });

    it('is forbidden for non-admin roles', async () => {
      FakeAuthGuard.currentUser = { sub: 'x', role: UserRole.BROKER, codes: ['broker_reports:read'] };
      await request(app.getHttpServer()).get(`/broker-reports/export/broker/${BROKER_ID}.xlsx`).expect(403);
    });
  });

  describe('GET /broker-reports/export/summary.xlsx (board, P15.4)', () => {
    it('returns a real XLSX (PK) with cover + top-brokers sheet, no fakes', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      const res = await fetchXlsx(app, '/broker-reports/export/summary.xlsx').expect(200);
      expect(res.headers['content-type']).toContain('spreadsheetml.sheet');
      expect(res.headers['content-disposition']).toContain('broker-summary.xlsx');
      expect((res.body as Buffer).subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
      const { names, text } = await loadSheets(res.body as Buffer);
      expect(names).toEqual(['الملخص', 'أعلى الوسطاء']);
      expect(text).toContain('تقرير أداء الوسطاء');
      expect(text).toContain('الملخص التنفيذي');
      expect(text).not.toMatch(/أحمد منصور|بيانات تجريبية|74%/);
    });

    it('is forbidden for non-admin roles', async () => {
      for (const role of [UserRole.SALES, UserRole.BROKER]) {
        FakeAuthGuard.currentUser = { sub: 'x', role, codes: ['broker_reports:read'] };
        await request(app.getHttpServer()).get('/broker-reports/export/summary.xlsx').expect(403);
      }
    });
  });
});
