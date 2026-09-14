import {
  CallHandler,
  CanActivate,
  ExecutionContext,
  Global,
  INestApplication,
  Injectable,
  Module,
  NestInterceptor,
  ValidationPipe,
} from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { Observable } from 'rxjs';
import { UserRole } from '@prisma/client';
import { BonusModule } from '../bonus.module';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { enterTenantContext } from '../../../common/tenant/tenant-context';

/**
 * Read-only sales performance report (GET /sales-targets/performance).
 *
 * Guarantees:
 *   - ADMIN may target any rep via ?salesId; SALES is self-scoped and the
 *     salesId query param is ignored for SALES (no cross-rep leakage).
 *   - period defaults to the current month and is validated to YYYY-MM.
 *   - target-achievement percentages are computed from realized contract value
 *     and signed-contract count vs. the rep's target.
 *   - the endpoint only reads existing models — no schema/commission changes.
 */

const ADMIN_ID = 'a0000000-0000-4000-8000-000000000001';
const SALES_ID = 'b0000000-0000-4000-8000-000000000002';
const OTHER_SALES_ID = 'c0000000-0000-4000-8000-000000000003';
// Manager whose team is exactly [SALES_ID] in the mock below.
const MANAGER_ID = 'd0000000-0000-4000-8000-000000000004';
const EMPTY_MANAGER_ID = 'e0000000-0000-4000-8000-000000000005';

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

// Per-test overrides for the data-shaped mocks.
const data: {
  targets: Array<{ salesId: string; amountTarget: number; unitsTarget: number }>;
  contracts: Array<{ totalAmount: number; reservation: { salesId: string } | null }>;
} = { targets: [], contracts: [] };

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

function makePrismaMock() {
  return {
    userPermission: {
      findMany: jest.fn().mockImplementation(async () => {
        const u = FakeAuthGuard.currentUser;
        return (u?.codes ?? []).map((code) => ({ permission: { code } }));
      }),
    },
    user: {
      findFirst: jest.fn().mockImplementation(
        async ({ where }: { where: { id: string } }) => {
          const knownIds = [ADMIN_ID, SALES_ID, OTHER_SALES_ID, MANAGER_ID, EMPTY_MANAGER_ID];
          return knownIds.includes(where.id) ? { id: where.id } : null;
        },
      ),
      findMany: jest.fn().mockImplementation(
        async ({ where }: { where: { role?: UserRole | { in: UserRole[] }; managerId?: string } }) => {
          // Team lookup (manager): SALES reps whose managerId = this manager.
          if (where?.role === UserRole.SALES && where.managerId !== undefined) {
            return where.managerId === MANAGER_ID ? [{ id: SALES_ID }] : [];
          }
          // "all sales actors" lookup (ADMIN, no salesId): role IN (SALES, SALES_MANAGER)
          if (where?.role && typeof where.role === 'object' && 'in' in where.role) {
            return [{ id: SALES_ID }, { id: OTHER_SALES_ID }, { id: MANAGER_ID }];
          }
          // name lookup (where: { id: { in: [...] } })
          return [
            { id: SALES_ID, fullName: 'مندوب أول' },
            { id: OTHER_SALES_ID, fullName: 'مندوب ثانٍ' },
            { id: MANAGER_ID, fullName: 'مدير المبيعات' },
          ];
        },
      ),
    },
    salesTarget: {
      findMany: jest.fn().mockImplementation(async () =>
        data.targets.map((t) => ({
          salesId: t.salesId,
          period: '2030-04',
          amountTarget: t.amountTarget,
          unitsTarget: t.unitsTarget,
        })),
      ),
    },
    lead: { groupBy: jest.fn().mockResolvedValue([]) },
    visitAppointment: { groupBy: jest.fn().mockResolvedValue([]) },
    reservation: { groupBy: jest.fn().mockResolvedValue([]) },
    contract: {
      findMany: jest.fn().mockImplementation(async () => data.contracts),
    },
  };
}

let mock = makePrismaMock();

describe('Bonus · sales performance report', () => {
  let app: INestApplication;

  beforeAll(async () => {
    mock = makePrismaMock();

    @Global()
    @Module({
      providers: [{ provide: PrismaService, useValue: mock }],
      exports: [PrismaService],
    })
    class MockPrismaModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [MockPrismaModule, BonusModule],
      providers: [
        { provide: APP_INTERCEPTOR, useClass: FakeTenantInterceptor },
        { provide: APP_GUARD, useClass: FakeAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    data.targets = [];
    data.contracts = [];
    mock.user.findFirst.mockClear();
    mock.user.findMany.mockClear();
  });

  it('ADMIN can query a given salesId (single rep, no all-reps lookup)', async () => {
    FakeAuthGuard.currentUser = { sub: ADMIN_ID, role: UserRole.ADMIN, codes: [] };
    const res = await request(app.getHttpServer())
      .get(`/sales-targets/performance?period=2030-04&salesId=${SALES_ID}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].salesId).toBe(SALES_ID);
    expect(res.body[0].period).toBe('2030-04');
    // The "all sales actors" lookup (where.role = { in: [...] }) must NOT run.
    const roleLookups = mock.user.findMany.mock.calls.filter((c) => {
      const role = (c[0] as { where?: { role?: unknown } })?.where?.role;
      return role && typeof role === 'object' && 'in' in (role as object);
    });
    expect(roleLookups).toHaveLength(0);
  });

  it('ADMIN with no salesId includes both SALES and SALES_MANAGER actors', async () => {
    FakeAuthGuard.currentUser = { sub: ADMIN_ID, role: UserRole.ADMIN, codes: [] };
    const res = await request(app.getHttpServer())
      .get('/sales-targets/performance?period=2030-04')
      .expect(200);
    const ids = (res.body as Array<{ salesId: string }>).map((r) => r.salesId).sort();
    expect(ids).toEqual([SALES_ID, OTHER_SALES_ID, MANAGER_ID].sort());
  });

  it('SALES is self-scoped and ignores a salesId pointing at another rep', async () => {
    FakeAuthGuard.currentUser = { sub: SALES_ID, role: UserRole.SALES, codes: ['targets:read'] };
    const res = await request(app.getHttpServer())
      .get(`/sales-targets/performance?period=2030-04&salesId=${OTHER_SALES_ID}`)
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].salesId).toBe(SALES_ID);
    expect(res.body[0].salesId).not.toBe(OTHER_SALES_ID);
  });

  it('defaults period to the current month when none is supplied', async () => {
    FakeAuthGuard.currentUser = { sub: SALES_ID, role: UserRole.SALES, codes: ['targets:read'] };
    const expected = new Date().toISOString().slice(0, 7);
    const res = await request(app.getHttpServer())
      .get('/sales-targets/performance')
      .expect(200);
    expect(res.body[0].period).toBe(expected);
  });

  it('rejects an invalid period format (400)', async () => {
    FakeAuthGuard.currentUser = { sub: SALES_ID, role: UserRole.SALES, codes: ['targets:read'] };
    await request(app.getHttpServer())
      .get('/sales-targets/performance?period=2030-13')
      .expect(400);
    await request(app.getHttpServer())
      .get('/sales-targets/performance?period=not-a-period')
      .expect(400);
  });

  it('computes achievement percentages from realized value and signed count', async () => {
    FakeAuthGuard.currentUser = { sub: ADMIN_ID, role: UserRole.ADMIN, codes: [] };
    data.targets = [{ salesId: SALES_ID, amountTarget: 100000, unitsTarget: 4 }];
    data.contracts = [
      { totalAmount: 30000, reservation: { salesId: SALES_ID } },
      { totalAmount: 20000, reservation: { salesId: SALES_ID } },
    ];

    const res = await request(app.getHttpServer())
      .get(`/sales-targets/performance?period=2030-04&salesId=${SALES_ID}`)
      .expect(200);

    const row = res.body[0];
    expect(row.realizedValue).toBe(50000);
    expect(row.signedContractsCount).toBe(2);
    expect(row.achievedAmount).toBe(50000);
    expect(row.achievedUnits).toBe(2);
    expect(row.targetAmount).toBe(100000);
    expect(row.targetUnits).toBe(4);
    expect(row.targetAmountPercent).toBe(50);
    expect(row.targetUnitsPercent).toBe(50);
  });

  it('SALES_MANAGER gets self + their team (not all sales) when no salesId is given', async () => {
    FakeAuthGuard.currentUser = {
      sub: MANAGER_ID,
      role: UserRole.SALES_MANAGER,
      codes: ['targets:read'],
    };
    const res = await request(app.getHttpServer())
      .get('/sales-targets/performance?period=2030-04')
      .expect(200);
    const ids = (res.body as Array<{ salesId: string }>).map((r) => r.salesId).sort();
    // self (MANAGER_ID) + team (SALES_ID); OTHER_SALES_ID (another team) excluded.
    expect(ids).toEqual([MANAGER_ID, SALES_ID].sort());
  });

  it('SALES_MANAGER can query their own performance (self in scope)', async () => {
    FakeAuthGuard.currentUser = {
      sub: MANAGER_ID,
      role: UserRole.SALES_MANAGER,
      codes: ['targets:read'],
    };
    const res = await request(app.getHttpServer())
      .get(`/sales-targets/performance?period=2030-04&salesId=${MANAGER_ID}`)
      .expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].salesId).toBe(MANAGER_ID);
  });

  it('SALES_MANAGER with a salesId in their team gets that rep', async () => {
    FakeAuthGuard.currentUser = {
      sub: MANAGER_ID,
      role: UserRole.SALES_MANAGER,
      codes: ['targets:read'],
    };
    const res = await request(app.getHttpServer())
      .get(`/sales-targets/performance?period=2030-04&salesId=${SALES_ID}`)
      .expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].salesId).toBe(SALES_ID);
  });

  it('SALES_MANAGER cannot query a salesId outside their team (yields no rows)', async () => {
    FakeAuthGuard.currentUser = {
      sub: MANAGER_ID,
      role: UserRole.SALES_MANAGER,
      codes: ['targets:read'],
    };
    // OTHER_SALES_ID is a SALES user but not on this manager's team.
    const res = await request(app.getHttpServer())
      .get(`/sales-targets/performance?period=2030-04&salesId=${OTHER_SALES_ID}`)
      .expect(200);
    expect(res.body).toEqual([]);
  });

  it('SALES_MANAGER with no team still sees their own row', async () => {
    FakeAuthGuard.currentUser = {
      sub: EMPTY_MANAGER_ID,
      role: UserRole.SALES_MANAGER,
      codes: ['targets:read'],
    };
    const res = await request(app.getHttpServer())
      .get('/sales-targets/performance?period=2030-04')
      .expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].salesId).toBe(EMPTY_MANAGER_ID);
  });

  it('returns null percentages when no target exists for the period', async () => {
    FakeAuthGuard.currentUser = { sub: ADMIN_ID, role: UserRole.ADMIN, codes: [] };
    data.contracts = [{ totalAmount: 12000, reservation: { salesId: SALES_ID } }];
    const res = await request(app.getHttpServer())
      .get(`/sales-targets/performance?period=2030-04&salesId=${SALES_ID}`)
      .expect(200);
    const row = res.body[0];
    expect(row.targetAmount).toBeNull();
    expect(row.targetUnits).toBeNull();
    expect(row.targetAmountPercent).toBeNull();
    expect(row.targetUnitsPercent).toBeNull();
    expect(row.achievedAmount).toBe(12000);
  });
});
