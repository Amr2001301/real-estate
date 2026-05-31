import {
  CanActivate,
  ExecutionContext,
  Global,
  INestApplication,
  Module,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { UserRole } from '@prisma/client';
import { Workbook } from 'exceljs';
import { MaintenanceModule } from '../maintenance.module';
import { DocumentsService } from '../../documents/documents.module';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { PrismaService } from '../../../common/prisma/prisma.service';

/**
 * P15.3 — styled XLSX twin of the maintenance summary CSV export. Same ADMIN +
 * maintenance:read gate + filters; the CSV endpoint stays the raw fallback.
 */

class FakeAuthGuard implements CanActivate {
  static currentUser: { sub: string; role: UserRole; codes: string[] } | null = null;
  canActivate(context: ExecutionContext): boolean {
    if (!FakeAuthGuard.currentUser) return false;
    const req = context.switchToHttp().getRequest();
    req.user = { sub: FakeAuthGuard.currentUser.sub, role: FakeAuthGuard.currentUser.role, email: null, phone: null };
    return true;
  }
}

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
      if (prop === '$queryRaw' || prop === '$queryRawUnsafe') {
        return jest.fn().mockResolvedValue([]);
      }
      if (prop === 'then') return undefined;
      cache[prop] ??= model();
      return cache[prop];
    },
  });
}

const documentsMock = {
  presign: jest.fn(),
  create: jest.fn(),
  listForOwner: jest.fn().mockResolvedValue([]),
};

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

describe('GET /maintenance-requests/reports/summary.xlsx (P15.3)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    @Global()
    @Module({
      providers: [{ provide: PrismaService, useValue: autoPrisma() }],
      exports: [PrismaService],
    })
    class MockPrismaModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), MockPrismaModule, MaintenanceModule],
      providers: [
        { provide: APP_GUARD, useClass: FakeAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
      ],
    })
      .overrideProvider(DocumentsService)
      .useValue(documentsMock)
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => app?.close());

  it('returns a real XLSX (PK) with the spreadsheet content-type + attachment', async () => {
    FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
    const res = await fetchXlsx(app, '/maintenance-requests/reports/summary.xlsx').expect(200);
    expect(res.headers['content-type']).toContain('spreadsheetml.sheet');
    expect(res.headers['content-disposition']).toContain('maintenance-report.xlsx');
    expect((res.body as Buffer).subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  });

  it('opens with the four expected sheets and no fake/demo values', async () => {
    FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
    const res = await fetchXlsx(app, '/maintenance-requests/reports/summary.xlsx?status=OPEN').expect(200);
    const wb = new Workbook();
    await wb.xlsx.load(res.body as unknown as ArrayBuffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      'الملخص', 'حسب الفئة', 'حسب المسند إليه', 'ضمانات تنتهي قريباً',
    ]);
    const flat: string[] = [];
    wb.eachSheet((ws) => ws.eachRow((r) => r.eachCell((c) => flat.push(String(c.value ?? '')))));
    const all = flat.join(' ');
    expect(all).toContain('تقرير الصيانة');
    expect(all).toContain('إجمالي الطلبات');
    expect(all).toContain('عوامل التصفية'); // applied status filter surfaced
    expect(all).not.toMatch(/أحمد منصور|بيانات تجريبية|74%/);
  });

  it('is forbidden for CUSTOMER / BROKER at the @Roles layer', async () => {
    for (const role of [UserRole.CUSTOMER, UserRole.BROKER]) {
      FakeAuthGuard.currentUser = { sub: 'x', role, codes: ['maintenance:read'] };
      await request(app.getHttpServer()).get('/maintenance-requests/reports/summary.xlsx').expect(403);
    }
  });
});
