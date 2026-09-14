import {
  CallHandler,
  CanActivate,
  ExecutionContext,
  Global,
  INestApplication,
  Injectable,
  Module,
  NestInterceptor,
} from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { Observable } from 'rxjs';
import { UserRole } from '@prisma/client';
import { Workbook } from 'exceljs';
import { ReportsModule } from '../reports.module';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { DateSerializerInterceptor } from '../../../common/interceptors/date-serializer.interceptor';
import { LocaleInterceptor } from '../../../common/interceptors/locale.interceptor';
import { enterTenantContext } from '../../../common/tenant/tenant-context';

/**
 * Regression for the P14.2 download bug: the XLSX arrived in Excel/Numbers as a
 * single JSON cell ({"options":…,"logger":{"context":"StreamableFile"…}}).
 *
 * Root cause: the global response interceptors (DateSerializerInterceptor and
 * LocaleInterceptor) deep-rebuilt every payload as a plain object. That stripped
 * the StreamableFile prototype, so Nest no longer recognised it via `instanceof`
 * and JSON-serialized the wrapper instead of streaming the bytes.
 *
 * The original admin-summary.spec boots ReportsModule WITHOUT those interceptors,
 * so it never reproduced the bug. This spec wires BOTH interceptors into the
 * pipeline (exactly as main.ts / app.module.ts do) and asserts the response is
 * the raw XLSX (ZIP "PK" magic), not JSON.
 */

const TEST_COMPANY_ID = 'aaaaaaaa-0000-4000-8000-000000000001';

@Injectable()
class FakeTenantInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return new Observable(subscriber => {
      enterTenantContext({ companyId: TEST_COMPANY_ID, bypass: false, isPublic: false });
      next.handle().subscribe(subscriber);
    });
  }
}

class FakeAuthGuard implements CanActivate {
  static currentUser: { sub: string; role: UserRole } | null = null;
  canActivate(context: ExecutionContext): boolean {
    if (!FakeAuthGuard.currentUser) return false;
    const req = context.switchToHttp().getRequest();
    req.user = { sub: FakeAuthGuard.currentUser.sub, role: FakeAuthGuard.currentUser.role, email: null, phone: null };
    return true;
  }
}

const ZERO_AGG_XLSX = { _sum: { amount: null, totalAmount: null, totalNet: null, netAmount: null } };

function makePrismaMock() {
  return {
    userPermission: { findMany: jest.fn().mockResolvedValue([]) },
    project: { count: jest.fn().mockResolvedValue(4), findMany: jest.fn().mockResolvedValue([]) },
    unit: {
      count: jest.fn().mockImplementation(async (args?: { where?: { status?: string } }) => {
        const status = args?.where?.status;
        if (status === 'AVAILABLE') return 60;
        if (status === 'RESERVED') return 25;
        if (status === 'SOLD') return 15;
        return 100;
      }),
    },
    lead: {
      count: jest.fn().mockResolvedValue(8),
      groupBy: jest.fn().mockResolvedValue([
        { sourceId: 's1', _count: { _all: 10 } },
        { sourceId: null, _count: { _all: 2 } },
      ]),
      findMany: jest.fn().mockResolvedValue([{ id: 'l1', fullName: 'منى', createdAt: new Date('2026-05-30T10:00:00Z') }]),
    },
    leadSource: { findMany: jest.fn().mockResolvedValue([{ id: 's1', name: { ar: 'مباشر', en: 'Direct' } }]) },
    deposit: {
      count: jest.fn().mockResolvedValue(3),
      aggregate: jest.fn().mockResolvedValue(ZERO_AGG_XLSX),
      findMany: jest.fn().mockResolvedValue([
        { id: 'd1', createdAt: new Date('2026-05-31T09:00:00Z'), contract: { contractNumber: 'CON-1', customer: { fullName: 'علي' } } },
      ]),
    },
    maintenanceRequest: { count: jest.fn().mockResolvedValue(5), findMany: jest.fn().mockResolvedValue([]) },
    contract: {
      count: jest.fn().mockResolvedValue(2),
      aggregate: jest.fn().mockResolvedValue(ZERO_AGG_XLSX),
      findMany: jest.fn().mockResolvedValue([
        { id: 'c1', contractNumber: 'CON-9', createdAt: new Date('2026-05-31T08:00:00Z'), customer: { fullName: 'سارة' } },
      ]),
    },
    reservation: {
      count: jest.fn().mockImplementation(async (args?: { where?: { expiresAt?: unknown } }) => (args?.where?.expiresAt ? 1 : 2)),
      groupBy: jest.fn().mockResolvedValue([]),
      findMany: jest.fn().mockResolvedValue([
        { id: 'r1', reservationNumber: 'RES-1', createdAt: new Date('2026-05-31T11:00:00Z'), unit: { code: 'A-1' }, client: { fullName: 'خالد' }, lead: null },
      ]),
    },
    visitAppointment: { count: jest.fn().mockResolvedValue(1) },
    visitRequest: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
    infoRequest: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
    user: { count: jest.fn().mockResolvedValue(0) },
    installment: { aggregate: jest.fn().mockResolvedValue(ZERO_AGG_XLSX) },
    bonusEntry: { aggregate: jest.fn().mockResolvedValue(ZERO_AGG_XLSX) },
    brokerPayout: { aggregate: jest.fn().mockResolvedValue(ZERO_AGG_XLSX), groupBy: jest.fn().mockResolvedValue([]) },
    brokerCommission: { aggregate: jest.fn().mockResolvedValue(ZERO_AGG_XLSX) },
    $transaction: jest.fn((ops: unknown) => (Array.isArray(ops) ? Promise.all(ops) : (ops as () => unknown)())),
    $queryRawUnsafe: jest.fn().mockResolvedValue([]),
  };
}

describe('GET /reports/admin-summary/export.xlsx · binary streaming through global interceptors', () => {
  let app: INestApplication;

  beforeAll(async () => {
    @Global()
    @Module({ providers: [{ provide: PrismaService, useValue: makePrismaMock() }], exports: [PrismaService] })
    class MockPrismaModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [MockPrismaModule, ReportsModule],
      providers: [
        { provide: APP_GUARD, useClass: FakeAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
        { provide: APP_INTERCEPTOR, useClass: FakeTenantInterceptor },
        // The two body-rewriting interceptors that previously mangled the stream.
        { provide: APP_INTERCEPTOR, useClass: LocaleInterceptor },
        { provide: APP_INTERCEPTOR, useClass: DateSerializerInterceptor },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    // DateSerializerInterceptor is registered globally in main.ts (not the module),
    // so mirror that too — guarantees it sits in the response pipeline here.
    app.useGlobalInterceptors(new DateSerializerInterceptor());
    await app.init();
  });

  afterAll(async () => app?.close());

  async function fetchRaw() {
    return request(app.getHttpServer())
      .get('/reports/admin-summary/export.xlsx')
      .buffer()
      .parse((response, cb) => {
        const chunks: Buffer[] = [];
        response.on('data', (c: Buffer) => chunks.push(c));
        response.on('end', () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);
  }

  it('streams real XLSX bytes (ZIP "PK" magic), not a JSON-serialized StreamableFile', async () => {
    FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN };
    const res = await fetchRaw();
    const body = res.body as Buffer;

    expect(res.headers['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    // XLSX is a ZIP container — first four bytes are 0x50 0x4B 0x03 0x04 ("PK\x03\x04").
    expect(body.subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    expect(body.toString('latin1', 0, 2)).toBe('PK');

    // And it must NOT be the leaked JSON wrapper.
    const head = body.toString('utf8', 0, 64);
    expect(head).not.toContain('StreamableFile');
    expect(head.trimStart().startsWith('{')).toBe(false);
  });

  it('the streamed bytes load back into a real 5-sheet workbook', async () => {
    FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN };
    const res = await fetchRaw();
    const wb = new Workbook();
    await wb.xlsx.load(res.body as unknown as ArrayBuffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      'الملخص',
      'اتجاهات الحجوزات',
      'مصادر العملاء',
      'التنبيهات',
      'آخر النشاطات',
    ]);
  });
});
