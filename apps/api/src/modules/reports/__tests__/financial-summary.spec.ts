import { CanActivate, ExecutionContext, Global, INestApplication, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { UserRole } from '@prisma/client';
import { ReportsModule } from '../reports.module';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { PrismaService } from '../../../common/prisma/prisma.service';

/**
 * F1 — financial-dashboard summary correctness. Boots the real ReportsModule
 * over a tailored Prisma mock so we can assert both the computed numbers
 * (verified vs all collection, by-type split, booking pipeline) and the query
 * criteria (computed overdue ≠ stored OVERDUE; aging boundaries; reservation
 * pipeline excludes rejected/cancelled/expired).
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

const has = (where: unknown, needle: string) => JSON.stringify(where ?? {}).includes(needle);

// Captured query criteria for wiring assertions.
const captured = {
  installmentWheres: [] as unknown[],
  reservationCountStatuses: [] as string[],
  brokerCommissionWheres: [] as unknown[],
};

function makePrismaMock() {
  return {
    userPermission: { findMany: jest.fn().mockResolvedValue([]) },
    contract: {
      count: jest.fn().mockResolvedValue(0),
      aggregate: jest.fn().mockResolvedValue({ _sum: { totalAmount: 0 } }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    deposit: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
      // Vary the sum by verified / booking detection in the where clause.
      aggregate: jest.fn().mockImplementation(async ({ where }: { where: unknown }) => {
        const verified = has(where, '"verified":true');
        const booking = has(where, 'BOOKING_AMOUNT');
        const amount = booking ? (verified ? 250 : 400) : verified ? 600 : 1000;
        return { _sum: { amount } };
      }),
      groupBy: jest.fn().mockResolvedValue([
        { type: 'BOOKING_AMOUNT', verified: true, _sum: { amount: 250 }, _count: { _all: 2 } },
        { type: 'BOOKING_AMOUNT', verified: false, _sum: { amount: 150 }, _count: { _all: 1 } },
        { type: 'INSTALLMENT', verified: true, _sum: { amount: 350 }, _count: { _all: 3 } },
      ]),
    },
    installment: {
      count: jest.fn().mockResolvedValue(1),
      findMany: jest.fn().mockResolvedValue([]),
      aggregate: jest.fn().mockImplementation(async ({ where }: { where: unknown }) => {
        captured.installmentWheres.push(where);
        return { _sum: { amount: 100 }, _count: { _all: 1 } };
      }),
    },
    reservation: {
      groupBy: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockImplementation(async ({ where }: { where: { status: string } }) => {
        captured.reservationCountStatuses.push(where.status);
        return where.status === 'PENDING' ? 4 : where.status === 'APPROVED' ? 2 : 0;
      }),
      aggregate: jest.fn().mockImplementation(async ({ where }: { where: { status: string } }) => ({
        _sum: { bookingAmount: where.status === 'PENDING' ? 4000 : 2000 },
      })),
    },
    // Sales bonus: PENDING=300, APPROVED=200, PAID=500.
    bonusEntry: {
      aggregate: jest.fn().mockImplementation(async ({ where }: { where: { status: string } }) => {
        const amount = where.status === 'PENDING' ? 300 : where.status === 'APPROVED' ? 200 : 500;
        return { _sum: { amount }, _count: { _all: 1 } };
      }),
    },
    // Broker commissions: detect status / paid-vs-unpaid in the where clause.
    brokerCommission: {
      aggregate: jest.fn().mockImplementation(async ({ where }: { where: unknown }) => {
        captured.brokerCommissionWheres.push(where);
        const j = JSON.stringify(where);
        let netAmount = 0;
        if (j.includes('"status":"PENDING"')) netAmount = 100;
        else if (j.includes('"payoutId":null')) netAmount = 700; // unpaid (approved, no/!paid payout)
        else if (j.includes('"status":"PAID"')) netAmount = 900; // approved + paid payout
        else if (j.includes('"status":"APPROVED"')) netAmount = 1600; // total approved
        return { _sum: { netAmount }, _count: { _all: 1 } };
      }),
    },
    brokerPayout: {
      groupBy: jest.fn().mockResolvedValue([
        { status: 'DRAFT', _sum: { totalNet: 50 }, _count: { _all: 1 } },
        { status: 'PAID', _sum: { totalNet: 900 }, _count: { _all: 2 } },
      ]),
    },
    document: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn().mockImplementation(async (ops: unknown) => {
      if (Array.isArray(ops)) return Promise.all(ops);
      return ops;
    }),
  };
}

describe('Reports · financial-dashboard summary correctness (F1)', () => {
  let app: INestApplication;
  let mock: ReturnType<typeof makePrismaMock>;

  beforeAll(async () => {
    mock = makePrismaMock();

    @Global()
    @Module({ providers: [{ provide: PrismaService, useValue: mock }], exports: [PrismaService] })
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

  let body: {
    summary: Record<string, string | number>;
    collectionByType: Array<{ type: string; count: number; totalAll: string; totalVerified: string; totalUnverified: string }>;
    aging: Array<{ label: string; count: number; amount: string }>;
    booking: Record<string, string | number>;
    liabilities: {
      salesBonus: Record<string, string | number>;
      brokerCommissions: Record<string, string | number>;
      brokerPayouts: Record<string, string | number>;
      totalUnpaidLiabilities: string;
    };
  };

  beforeAll(async () => {
    FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
    captured.installmentWheres = [];
    captured.reservationCountStatuses = [];
    captured.brokerCommissionWheres = [];
    const res = await request(app.getHttpServer()).get('/reports/financial-dashboard').expect(200);
    body = res.body;
  });

  it('splits collection into verified / all / unverified', () => {
    expect(body.summary.totalCollectedAll).toBe('1000');
    expect(body.summary.totalCollectedVerified).toBe('600');
    expect(body.summary.totalCollectedUnverified).toBe('400');
    // Existing field kept = ALL (back-compat).
    expect(body.summary.totalCollected).toBe('1000');
  });

  it('breaks collection down by deposit type with verified/unverified split', () => {
    const booking = body.collectionByType.find((c) => c.type === 'BOOKING_AMOUNT')!;
    expect(booking).toMatchObject({ count: 3, totalAll: '400', totalVerified: '250', totalUnverified: '150' });
    const installment = body.collectionByType.find((c) => c.type === 'INSTALLMENT')!;
    expect(installment).toMatchObject({ count: 3, totalAll: '350', totalVerified: '350', totalUnverified: '0' });
    // Every enum type is represented (zero-filled when absent).
    expect(body.collectionByType.map((c) => c.type).sort()).toEqual(
      ['BOOKING_AMOUNT', 'DOWN_PAYMENT', 'FINAL_PAYMENT', 'INSTALLMENT'],
    );
  });

  it('computes overdue from dueDate<today AND status!=PAID (not the stored OVERDUE flag)', () => {
    const computedOverdue = captured.installmentWheres.find(
      (w) => has(w, '"not":"PAID"') && has(w, '"dueDate"') && has(w, '"lt"') && !has(w, '"gte"'),
    );
    expect(computedOverdue).toBeDefined();
    expect(body.summary.overdueInstallmentCountComputed).toBe(1);
    expect(body.summary.overdueAmountComputed).toBe('100');
  });

  it('outstanding excludes PAID and has no dueDate bound', () => {
    const outstanding = captured.installmentWheres.find(
      (w) => has(w, '"not":"PAID"') && !has(w, '"dueDate"'),
    );
    expect(outstanding).toBeDefined();
    expect(body.summary.totalOutstanding).toBe('100');
  });

  it('produces four aging buckets, all scoped to unpaid', () => {
    expect(body.aging.map((a) => a.label)).toEqual(['1-30', '31-60', '61-90', '90+']);
    // Each aging query is status!=PAID with a dueDate range.
    const agingQueries = captured.installmentWheres.filter(
      (w) => has(w, '"not":"PAID"') && has(w, '"dueDate"'),
    );
    expect(agingQueries.length).toBeGreaterThanOrEqual(4);
  });

  it('booking pipeline counts only PENDING + APPROVED reservations', () => {
    expect(captured.reservationCountStatuses.sort()).toEqual(['APPROVED', 'PENDING']);
    expect(captured.reservationCountStatuses).not.toContain('REJECTED');
    expect(captured.reservationCountStatuses).not.toContain('CANCELLED');
    expect(captured.reservationCountStatuses).not.toContain('EXPIRED');
    expect(body.booking.pendingReservationsCount).toBe(4);
    expect(body.booking.approvedReservationsCount).toBe(2);
    expect(body.booking.pendingReservationsBookingAmount).toBe('4000');
    expect(body.booking.approvedReservationsBookingAmount).toBe('2000');
    expect(body.booking.bookingCollectedVerified).toBe('250');
    expect(body.booking.bookingCollectedAll).toBe('400');
    // estimate = (4000 + 2000) − 250 verified collected = 5750
    expect(body.booking.bookingUncollectedEstimate).toBe('5750');
  });

  it('sales bonus: pending + approved are unpaid; paid is separate', () => {
    const sb = body.liabilities.salesBonus;
    expect(sb.pendingAmount).toBe('300');
    expect(sb.approvedAmount).toBe('200');
    expect(sb.paidAmount).toBe('500');
    expect(sb.unpaidAmount).toBe('500'); // 300 + 200, paid excluded
  });

  it('broker commissions: unpaid = approved & not settled via a PAID payout', () => {
    const bc = body.liabilities.brokerCommissions;
    expect(bc.unpaidAmount).toBe('700');
    expect(bc.paidAmount).toBe('900');
    // The unpaid query is APPROVED + (payoutId null OR payout not PAID).
    const unpaidQ = captured.brokerCommissionWheres.find(
      (w) => JSON.stringify(w).includes('"payoutId":null'),
    );
    expect(JSON.stringify(unpaidQ)).toContain('"status":"APPROVED"');
    expect(JSON.stringify(unpaidQ)).toContain('"not":"PAID"');
  });

  it('broker payouts lifecycle reported separately', () => {
    const bp = body.liabilities.brokerPayouts;
    expect(bp.draftAmount).toBe('50');
    expect(bp.paidAmount).toBe('900');
    expect(bp.paidCount).toBe(2);
  });

  it('totalUnpaidLiabilities = sales unpaid + broker commission unpaid (payouts NOT re-added)', () => {
    // 500 (bonus unpaid) + 700 (broker commission unpaid) = 1200.
    // Broker payout totals (950) are deliberately excluded → no double count.
    expect(body.liabilities.totalUnpaidLiabilities).toBe('1200');
  });

  it('keeps the existing summary fields intact (back-compat)', () => {
    for (const k of ['totalContractValue', 'totalCollected', 'totalRemaining', 'totalOverdue', 'collectedThisMonth', 'dueThisMonth', 'contractCount', 'depositCount', 'overdueInstallmentCount']) {
      expect(body.summary).toHaveProperty(k);
    }
  });
});
