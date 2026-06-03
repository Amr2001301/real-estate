import { CanActivate, ExecutionContext, Global, INestApplication, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import request from 'supertest';
import { Prisma, UserRole } from '@prisma/client';
import { InstallmentsModule } from '../installments.module';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { PrismaService } from '../../../common/prisma/prisma.service';

/**
 * Gap 5 — GET /me/installments summary + filters.
 *
 *   - summary.totalPaid / remaining / overdue derive from Installment.status
 *     buckets (the authoritative paid flag; pending/rejected proofs never flip
 *     it, so they can't inflate "paid").
 *   - the LIST honours status + contractId filters; the SUMMARY ignores the
 *     status filter (full schedule) but respects contractId.
 *   - the booking amount is never part of these totals (it lives on the
 *     reservation), so no double-counting.
 *   - every query is scoped by plan.contract.customerId = caller → no cross-
 *     customer read.
 */

const CUSTOMER_ID = 'cust-1';

class FakeAuthGuard implements CanActivate {
  static currentUser: { sub: string; role: UserRole } | null = null;
  canActivate(context: ExecutionContext): boolean {
    if (!FakeAuthGuard.currentUser) return false;
    const req = context.switchToHttp().getRequest();
    req.user = { sub: FakeAuthGuard.currentUser.sub, role: FakeAuthGuard.currentUser.role };
    return true;
  }
}

function makePrismaMock() {
  const m = {
    userPermission: { findMany: jest.fn().mockResolvedValue([]) },
    installment: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'i1', dueDate: new Date('2030-01-01'), amount: new Prisma.Decimal(1000), status: 'PAID', paidAt: new Date('2030-01-02'), type: 'INSTALLMENT', plan: { contract: null } },
      ]),
      count: jest.fn().mockResolvedValue(1),
      groupBy: jest.fn().mockResolvedValue([
        { status: 'PAID', _sum: { amount: new Prisma.Decimal(3000) }, _count: { _all: 3 } },
        { status: 'PENDING', _sum: { amount: new Prisma.Decimal(2000) }, _count: { _all: 2 } },
        { status: 'OVERDUE', _sum: { amount: new Prisma.Decimal(500) }, _count: { _all: 1 } },
      ]),
      findFirst: jest.fn().mockResolvedValue({ amount: new Prisma.Decimal(500), dueDate: new Date('2029-12-01') }),
    },
    contract: {
      findMany: jest.fn().mockResolvedValue([{ id: 'c1', contractNumber: 'CT-1' }]),
    },
    $transaction: jest.fn(),
  };
  m.$transaction.mockImplementation(async (ops: unknown) => {
    if (Array.isArray(ops)) return Promise.all(ops);
    return ops;
  });
  return m;
}

let mock = makePrismaMock();

describe('GET /me/installments · summary + filters (Gap 5)', () => {
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
      imports: [MockPrismaModule, ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), InstallmentsModule],
      providers: [
        { provide: APP_GUARD, useClass: FakeAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    FakeAuthGuard.currentUser = { sub: CUSTOMER_ID, role: UserRole.CUSTOMER };
    mock.installment.findMany.mockClear();
    mock.installment.count.mockClear();
    mock.installment.groupBy.mockClear();
    mock.installment.findFirst.mockClear();
    mock.contract.findMany.mockClear();
  });

  it('returns a backward-compatible {data, meta} plus an additive summary', async () => {
    const res = await request(app.getHttpServer()).get('/me/installments').expect(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('meta');
    expect(res.body).toHaveProperty('summary');
  });

  it('computes totals from status buckets (paid only; remaining = pending+overdue)', async () => {
    const res = await request(app.getHttpServer()).get('/me/installments').expect(200);
    const s = res.body.summary;
    expect(s.totalPaid).toBe('3000');     // PAID bucket only
    expect(s.overdue).toBe('500');         // OVERDUE bucket
    expect(s.remaining).toBe('2500');      // PENDING(2000) + OVERDUE(500)
    expect(s.counts).toMatchObject({ total: 6, paid: 3, pending: 2, overdue: 1 });
    expect(s.nextDue).toMatchObject({ amount: '500' });
    expect(s.contracts).toEqual([{ id: 'c1', contractNumber: 'CT-1' }]);
  });

  it('scopes every query to the caller (no cross-customer read)', async () => {
    await request(app.getHttpServer()).get('/me/installments').expect(200);
    const listWhere = mock.installment.findMany.mock.calls[0]![0].where;
    expect(listWhere.plan.contract.customerId).toBe(CUSTOMER_ID);
    const groupWhere = mock.installment.groupBy.mock.calls[0]![0].where;
    expect(groupWhere.plan.contract.customerId).toBe(CUSTOMER_ID);
    expect(mock.contract.findMany.mock.calls[0]![0].where.customerId).toBe(CUSTOMER_ID);
  });

  it('applies the status filter to the LIST but not to the SUMMARY', async () => {
    await request(app.getHttpServer()).get('/me/installments?status=OVERDUE').expect(200);
    expect(mock.installment.findMany.mock.calls[0]![0].where.status).toBe('OVERDUE');
    // Summary buckets must reflect the whole schedule, so no status narrowing.
    expect(mock.installment.groupBy.mock.calls[0]![0].where.status).toBeUndefined();
  });

  it('applies the contractId filter to both the list and the summary', async () => {
    await request(app.getHttpServer()).get('/me/installments?contractId=c1').expect(200);
    expect(mock.installment.findMany.mock.calls[0]![0].where.plan.contract.id).toBe('c1');
    expect(mock.installment.groupBy.mock.calls[0]![0].where.plan.contract.id).toBe('c1');
  });

  it('handles an empty schedule (zeros, null nextDue)', async () => {
    mock.installment.groupBy.mockResolvedValueOnce([]);
    mock.installment.findFirst.mockResolvedValueOnce(null);
    mock.installment.findMany.mockResolvedValueOnce([]);
    mock.installment.count.mockResolvedValueOnce(0);
    const res = await request(app.getHttpServer()).get('/me/installments').expect(200);
    expect(res.body.summary).toMatchObject({
      totalPaid: '0',
      remaining: '0',
      overdue: '0',
      nextDue: null,
    });
  });
});
