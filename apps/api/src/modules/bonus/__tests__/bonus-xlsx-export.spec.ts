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
import { BonusEntryStatus, UserRole } from '@prisma/client';
import { Workbook } from 'exceljs';
import { BonusModule } from '../bonus.module';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { PrismaService } from '../../../common/prisma/prisma.service';

/**
 * P15.3 — styled XLSX twin of the bonus-entries CSV export.
 * Same ADMIN-only gate + filters; the CSV endpoint stays the raw fallback.
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

function makePrismaMock() {
  return {
    userPermission: {
      findMany: jest.fn().mockImplementation(async () =>
        (FakeAuthGuard.currentUser?.codes ?? []).map((code) => ({ permission: { code } })),
      ),
    },
    bonusEntry: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'e1',
          period: '2026-05',
          amount: 1500,
          status: BonusEntryStatus.PAID,
          paidAt: new Date('2026-05-20T00:00:00Z'),
          sales: { fullName: 'منى المبيعات' },
          rule: { name: 'قاعدة الربع الثاني' },
        },
      ]),
    },
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

describe('GET /bonus-entries/export.xlsx (P15.3)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    @Global()
    @Module({
      providers: [{ provide: PrismaService, useValue: makePrismaMock() }],
      exports: [PrismaService],
    })
    class MockPrismaModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [MockPrismaModule, BonusModule],
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

  it('returns a real XLSX (PK) with the spreadsheet content-type + attachment', async () => {
    FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
    const res = await fetchXlsx(app, '/bonus-entries/export.xlsx').expect(200);
    expect(res.headers['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(res.headers['content-disposition']).toContain('bonus-entries.xlsx');
    expect((res.body as Buffer).subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  });

  it('opens with the expected sheet + real data and no fake/demo values', async () => {
    FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
    const res = await fetchXlsx(app, '/bonus-entries/export.xlsx?status=PAID&period=2026-05').expect(200);
    const wb = new Workbook();
    await wb.xlsx.load(res.body as unknown as ArrayBuffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['مكافآت المندوبين']);
    const flat: string[] = [];
    wb.eachSheet((ws) => ws.eachRow((r) => r.eachCell((c) => flat.push(String(c.value ?? '')))));
    const all = flat.join(' ');
    expect(all).toContain('تقرير مكافآت المندوبين');
    expect(all).toContain('منى المبيعات'); // real row
    expect(all).toContain('عوامل التصفية'); // applied filters surfaced
    expect(all).not.toMatch(/أحمد منصور|بيانات تجريبية|74%/);
  });

  it('is forbidden for SALES / CUSTOMER / BROKER at the @Roles layer', async () => {
    for (const role of [UserRole.SALES, UserRole.CUSTOMER, UserRole.BROKER]) {
      FakeAuthGuard.currentUser = { sub: 'x', role, codes: ['bonus:entries:read'] };
      await request(app.getHttpServer()).get('/bonus-entries/export.xlsx').expect(403);
    }
  });
});
