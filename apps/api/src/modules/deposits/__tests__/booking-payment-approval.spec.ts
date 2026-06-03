import {
  CanActivate,
  ExecutionContext,
  Global,
  INestApplication,
  Module,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { UserRole } from '@prisma/client';
import { DepositsModule } from '../deposits.module';
import { DocumentsService } from '../../documents/documents.module';
import { NotificationsService } from '../../notifications/notifications.module';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { PrismaService } from '../../../common/prisma/prisma.service';

/**
 * Gap 2 — payment-proof approval propagation + customer paid totals.
 *
 *   approveProof():
 *     - BOOKING_AMOUNT deposit (reservationId set) → flips
 *       Reservation.bookingPaymentStatus = PAID + stamps bookingPaidAt.
 *     - installment-linked deposit → marks Installment PAID (and does NOT
 *       touch any reservation).
 *   rejectProof():
 *     - never marks anything as paid (no installment / reservation write).
 *   GET /me/deposits:
 *     - customer scope includes reservation-linked booking deposits.
 *     - paid totals (groupBy) exclude PENDING_REVIEW + REJECTED.
 *
 * Real DepositsService methods run against a mocked PrismaService; the
 * DocumentsService + NotificationsService are stubbed so nothing touches R2,
 * push, or the DB.
 */

const RES_ID = 'eeeeeeee-1111-4111-8111-111111111111';
const INST_ID = 'aaaaaaaa-2222-4222-8222-222222222222';
const BOOKING_DEPOSIT_ID = 'dddddddd-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const INSTALLMENT_DEPOSIT_ID = 'dddddddd-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const CUSTOMER_ID = 'cust-1';
const PAID_AT = new Date('2030-04-01T00:00:00.000Z');

const documentsMock = {
  create: jest.fn().mockResolvedValue({ id: 'doc-1' }),
};
const notificationsMock = {
  sendToUser: jest.fn().mockResolvedValue(undefined),
  sendToUsers: jest.fn().mockResolvedValue(undefined),
  sendToRoles: jest.fn().mockResolvedValue(undefined),
};

// Per-test configurable findUnique target for approve/reject.
type DepositTarget = Record<string, unknown> | null;
const fixture: { target: DepositTarget } = { target: null };

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
  const m = {
    userPermission: {
      findMany: jest.fn().mockImplementation(async () => {
        const u = FakeAuthGuard.currentUser;
        return (u?.codes ?? []).map((code) => ({ permission: { code } }));
      }),
    },
    deposit: {
      findUnique: jest.fn().mockImplementation(async () => fixture.target),
      update: jest.fn().mockImplementation(async ({ where, data }) => ({
        id: where.id,
        amount: '5000',
        paidAt: PAID_AT,
        contractId: (fixture.target?.contractId as string | null) ?? null,
        ...data,
      })),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    installment: {
      update: jest.fn().mockResolvedValue({}),
    },
    reservation: {
      update: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn(),
  };
  m.$transaction.mockImplementation(async (ops: unknown) => {
    if (Array.isArray(ops)) return Promise.all(ops);
    if (typeof ops === 'function') {
      const tx = { deposit: m.deposit, installment: m.installment, reservation: m.reservation };
      return (ops as (tx: unknown) => Promise<unknown>)(tx);
    }
    return ops;
  });
  return m;
}

let mock = makePrismaMock();

describe('Deposits · booking-payment approval propagation + paid totals (Gap 2)', () => {
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
      imports: [ConfigModule.forRoot({ isGlobal: true }), MockPrismaModule, DepositsModule],
      providers: [
        { provide: APP_GUARD, useClass: FakeAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
      ],
    })
      .overrideProvider(DocumentsService)
      .useValue(documentsMock)
      .overrideProvider(NotificationsService)
      .useValue(notificationsMock)
      .compile();

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
    FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: ['deposits:verify'] };
    fixture.target = null;
    mock.deposit.findUnique.mockClear();
    mock.deposit.update.mockClear();
    mock.deposit.findMany.mockClear();
    mock.deposit.count.mockClear();
    mock.deposit.groupBy.mockClear();
    mock.installment.update.mockClear();
    mock.reservation.update.mockClear();
    notificationsMock.sendToUser.mockClear();
  });

  // ── approveProof — BOOKING_AMOUNT propagates to the reservation ──────────

  it('approving a BOOKING_AMOUNT proof flips the reservation booking payment to PAID', async () => {
    fixture.target = {
      id: BOOKING_DEPOSIT_ID,
      type: 'BOOKING_AMOUNT',
      reservationId: RES_ID,
      contractId: null,
      reviewStatus: 'PENDING_REVIEW',
      contract: null,
      installment: null,
      reservation: { id: RES_ID, bookingPaymentStatus: 'UNPAID' },
    };

    await request(app.getHttpServer())
      .post(`/deposits/${BOOKING_DEPOSIT_ID}/approve`)
      .send({})
      .expect(201);

    expect(mock.reservation.update).toHaveBeenCalledTimes(1);
    const args = mock.reservation.update.mock.calls[0]![0] as {
      where: { id: string };
      data: { bookingPaymentStatus: string; bookingPaidAt: Date };
    };
    expect(args.where.id).toBe(RES_ID);
    expect(args.data.bookingPaymentStatus).toBe('PAID');
    expect(args.data.bookingPaidAt).toEqual(PAID_AT);
    // A booking deposit has no installment — that side effect must not run.
    expect(mock.installment.update).not.toHaveBeenCalled();
  });

  it('is idempotent: re-approving an already-PAID booking deposit makes no writes', async () => {
    fixture.target = {
      id: BOOKING_DEPOSIT_ID,
      type: 'BOOKING_AMOUNT',
      reservationId: RES_ID,
      contractId: null,
      reviewStatus: 'APPROVED',
      contract: null,
      installment: null,
      reservation: { id: RES_ID, bookingPaymentStatus: 'PAID' },
    };

    await request(app.getHttpServer())
      .post(`/deposits/${BOOKING_DEPOSIT_ID}/approve`)
      .send({})
      .expect(201);

    expect(mock.deposit.update).not.toHaveBeenCalled();
    expect(mock.reservation.update).not.toHaveBeenCalled();
  });

  // ── approveProof — installment path still marks the installment PAID ─────

  it('approving an installment-linked proof marks the installment PAID and touches no reservation', async () => {
    fixture.target = {
      id: INSTALLMENT_DEPOSIT_ID,
      type: 'DOWN_PAYMENT',
      reservationId: null,
      contractId: 'cccccccc-1111-4111-8111-111111111111',
      reviewStatus: 'PENDING_REVIEW',
      contract: { customerId: CUSTOMER_ID },
      installment: { id: INST_ID, status: 'PENDING', dueDate: PAID_AT },
      reservation: null,
    };

    await request(app.getHttpServer())
      .post(`/deposits/${INSTALLMENT_DEPOSIT_ID}/approve`)
      .send({})
      .expect(201);

    expect(mock.installment.update).toHaveBeenCalledTimes(1);
    const args = mock.installment.update.mock.calls[0]![0] as {
      where: { id: string };
      data: { status: string; paidAt: Date };
    };
    expect(args.where.id).toBe(INST_ID);
    expect(args.data.status).toBe('PAID');
    expect(mock.reservation.update).not.toHaveBeenCalled();
  });

  // ── rejectProof — never marks anything paid ──────────────────────────────

  it('rejecting a proof writes REJECTED and marks nothing as paid', async () => {
    fixture.target = {
      id: INSTALLMENT_DEPOSIT_ID,
      type: 'INSTALLMENT',
      reservationId: null,
      contractId: 'cccccccc-1111-4111-8111-111111111111',
      reviewStatus: 'PENDING_REVIEW',
      contract: { customerId: CUSTOMER_ID },
      installment: { id: INST_ID, dueDate: PAID_AT },
      reservation: null,
    };

    await request(app.getHttpServer())
      .post(`/deposits/${INSTALLMENT_DEPOSIT_ID}/reject`)
      .send({ reason: 'الإيصال غير واضح' })
      .expect(201);

    const args = mock.deposit.update.mock.calls[0]![0] as { data: { reviewStatus: string } };
    expect(args.data.reviewStatus).toBe('REJECTED');
    expect(mock.installment.update).not.toHaveBeenCalled();
    expect(mock.reservation.update).not.toHaveBeenCalled();
  });

  // ── GET /me/deposits — scoping + paid totals ─────────────────────────────

  it('scopes /me/deposits to include reservation-linked booking deposits and excludes pending/rejected from paid totals', async () => {
    FakeAuthGuard.currentUser = { sub: CUSTOMER_ID, role: UserRole.CUSTOMER, codes: [] };

    await request(app.getHttpServer()).get('/me/deposits').expect(200);

    // findMany (the visible rows) is scoped by an OR that reaches the customer
    // through the contract AND through the reservation (direct + lead client).
    const findManyArgs = mock.deposit.findMany.mock.calls[0]![0] as {
      where: { AND: Array<{ OR?: unknown[] }> };
    };
    const json = JSON.stringify(findManyArgs.where);
    expect(json).toContain('contract');
    expect(json).toContain('reservation');
    expect(json).toContain('clientId');

    // Paid totals (groupBy) additionally exclude PENDING_REVIEW + REJECTED.
    const groupByArgs = mock.deposit.groupBy.mock.calls[0]![0] as { where: unknown };
    const groupJson = JSON.stringify(groupByArgs.where);
    expect(groupJson).toContain('PENDING_REVIEW');
    expect(groupJson).toContain('REJECTED');
  });
});
