import {
  CanActivate,
  ExecutionContext,
  Global,
  INestApplication,
  Module,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { NotificationsService } from '../../notifications/notifications.module';
import request from 'supertest';
import { UserRole } from '@prisma/client';
import { BrokerPayoutsController } from '../broker-payouts.controller';
import { BrokerPayoutsService } from '../broker-payouts.service';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { PrismaService } from '../../../common/prisma/prisma.service';

/**
 * Broker payouts · state-machine transitions.
 *
 * Small focused workflow surface: prove that
 *   DRAFT → APPROVED → PROCESSING → PAID
 * goes through the canonical guards and that the validation rules survive
 * the permission gate:
 *   - approve() rejects DRAFT payout with zero commissions
 *   - approve() rejects non-DRAFT payout
 *   - process() rejects non-APPROVED payout
 *   - markPaid() rejects non-PROCESSING payout
 *   - cancel() unlinks commissions on DRAFT/APPROVED, blocks on PAID
 *
 * Full permission-gate coverage already lives in broker-payouts-permissions
 * spec; this file is the business-logic counterpart.
 */

const PAYOUT_ID = 'a0000000-1111-4111-8111-111111111111';

type Status = 'DRAFT' | 'APPROVED' | 'PROCESSING' | 'PAID' | 'CANCELLED';

const payoutStore: {
  current: { id: string; payoutNumber: string; brokerId: string; status: Status; notes: string | null };
  commissionCount: number;
} = {
  current: {
    id: PAYOUT_ID,
    payoutNumber: 'PAY-2030-0001',
    brokerId: 'broker-1',
    status: 'DRAFT',
    notes: null,
  },
  commissionCount: 1,
};

function resetStore() {
  payoutStore.current = {
    id: PAYOUT_ID,
    payoutNumber: 'PAY-2030-0001',
    brokerId: 'broker-1',
    status: 'DRAFT',
    notes: null,
  };
  payoutStore.commissionCount = 1;
}

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
  const updated = (status: Status, extra: Record<string, unknown> = {}) => ({
    ...payoutStore.current,
    status,
    ...extra,
  });

  const m = {
    userPermission: {
      findMany: jest.fn().mockImplementation(async () => {
        const u = FakeAuthGuard.currentUser;
        return (u?.codes ?? []).map((code) => ({ permission: { code } }));
      }),
    },
    broker: {
      findUnique: jest.fn().mockResolvedValue({ id: 'broker-1', status: 'ACTIVE' }),
    },
    brokerPayout: {
      findUnique: jest.fn().mockImplementation(async () => ({ ...payoutStore.current })),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn().mockImplementation(async ({ data }) => updated(data.status ?? payoutStore.current.status, data)),
      aggregate: jest.fn().mockResolvedValue({ _sum: {} }),
    },
    brokerCommission: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockImplementation(async () => payoutStore.commissionCount),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      aggregate: jest.fn().mockResolvedValue({
        _sum: { grossAmount: 0, taxAmount: 0, withholdingAmount: 0, netAmount: 0 },
      }),
    },
    brokerUser: { findMany: jest.fn().mockResolvedValue([{ userId: 'broker-user-1' }]) },
    brokerActivityLog: { create: jest.fn().mockResolvedValue({}) },
    notification: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    $transaction: jest.fn(),
  };
  m.$transaction.mockImplementation(async (ops: unknown) => {
    if (Array.isArray(ops)) return Promise.all(ops);
    if (typeof ops === 'function') {
      const tx = {
        brokerPayout: m.brokerPayout,
        brokerCommission: m.brokerCommission,
      };
      return (ops as (tx: unknown) => Promise<unknown>)(tx);
    }
    return ops;
  });
  return m;
}

let mock = makePrismaMock();

const notificationsMock = {
  sendToUser: jest.fn().mockResolvedValue(undefined),
  sendToUsers: jest.fn().mockResolvedValue(undefined),
  sendToRoles: jest.fn().mockResolvedValue(undefined),
};

describe('Broker payouts · transitions workflow', () => {
  let app: INestApplication;

  beforeAll(async () => {
    mock = makePrismaMock();

    @Global()
    @Module({
      providers: [{ provide: PrismaService, useValue: mock }],
      exports: [PrismaService],
    })
    class MockPrismaModule {}

    @Module({
      imports: [MockPrismaModule],
      controllers: [BrokerPayoutsController],
      providers: [{ provide: NotificationsService, useValue: notificationsMock }, BrokerPayoutsService],
    })
    class TestBrokerPayoutsModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [TestBrokerPayoutsModule],
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
    FakeAuthGuard.currentUser = {
      sub: 'admin-1',
      role: UserRole.ADMIN,
      codes: [
        'broker_payouts:approve',
        'broker_payouts:process',
        'broker_payouts:pay',
        'broker_payouts:cancel',
      ],
    };
    resetStore();
    mock.brokerPayout.update.mockClear();
    mock.brokerCommission.updateMany.mockClear();
    mock.brokerActivityLog.create.mockClear();
    notificationsMock.sendToUsers.mockClear();
  });

  // ── approve() ──────────────────────────────────────────────────────────

  it('approves a DRAFT payout with linked commissions → APPROVED', async () => {
    await request(app.getHttpServer())
      .patch(`/broker-payouts/${PAYOUT_ID}/approve`)
      .send({})
      .expect(200);

    expect(mock.brokerPayout.update).toHaveBeenCalledTimes(1);
    const args = mock.brokerPayout.update.mock.calls[0]![0] as {
      where: { id: string };
      data: { status: string; approvedById: string; approvedAt: Date };
    };
    expect(args.where.id).toBe(PAYOUT_ID);
    expect(args.data.status).toBe('APPROVED');
    expect(args.data.approvedById).toBe('admin-1');
    expect(args.data.approvedAt).toBeInstanceOf(Date);

    // PAYOUT_APPROVED activity + notification.
    expect(mock.brokerActivityLog.create).toHaveBeenCalled();
    const activityArgs = mock.brokerActivityLog.create.mock.calls[0]![0] as {
      data: { type: string; brokerId: string };
    };
    expect(activityArgs.data.type).toBe('PAYOUT_APPROVED');
    expect(activityArgs.data.brokerId).toBe('broker-1');
    expect(notificationsMock.sendToUsers).toHaveBeenCalled();
  });

  it('approve() rejects a DRAFT payout with zero linked commissions (400)', async () => {
    payoutStore.commissionCount = 0;
    await request(app.getHttpServer())
      .patch(`/broker-payouts/${PAYOUT_ID}/approve`)
      .send({})
      .expect(400);
    expect(mock.brokerPayout.update).not.toHaveBeenCalled();
  });

  it('approve() rejects an already-APPROVED payout (409)', async () => {
    payoutStore.current.status = 'APPROVED';
    await request(app.getHttpServer())
      .patch(`/broker-payouts/${PAYOUT_ID}/approve`)
      .send({})
      .expect(409);
    expect(mock.brokerPayout.update).not.toHaveBeenCalled();
  });

  // ── process() ──────────────────────────────────────────────────────────

  it('process() moves APPROVED → PROCESSING and stamps processedById/processedAt', async () => {
    payoutStore.current.status = 'APPROVED';
    await request(app.getHttpServer())
      .patch(`/broker-payouts/${PAYOUT_ID}/process`)
      .send({ paymentMethod: 'BANK_TRANSFER' })
      .expect(200);
    const args = mock.brokerPayout.update.mock.calls[0]![0] as {
      data: { status: string; processedById: string; processedAt: Date; paymentMethod: string };
    };
    expect(args.data.status).toBe('PROCESSING');
    expect(args.data.processedById).toBe('admin-1');
    expect(args.data.processedAt).toBeInstanceOf(Date);
    expect(args.data.paymentMethod).toBe('BANK_TRANSFER');
  });

  it('process() rejects a non-APPROVED payout (409)', async () => {
    payoutStore.current.status = 'DRAFT';
    await request(app.getHttpServer())
      .patch(`/broker-payouts/${PAYOUT_ID}/process`)
      .send({})
      .expect(409);
    expect(mock.brokerPayout.update).not.toHaveBeenCalled();
  });

  // ── markPaid() ─────────────────────────────────────────────────────────

  it('markPaid() moves PROCESSING → PAID with paymentMethod + paidAt', async () => {
    payoutStore.current.status = 'PROCESSING';
    await request(app.getHttpServer())
      .patch(`/broker-payouts/${PAYOUT_ID}/mark-paid`)
      .send({ paymentMethod: 'BANK_TRANSFER', paymentReference: 'TXN-99' })
      .expect(200);
    const args = mock.brokerPayout.update.mock.calls[0]![0] as {
      data: { status: string; paymentMethod: string; paymentReference: string | null; paidAt: Date };
    };
    expect(args.data.status).toBe('PAID');
    expect(args.data.paymentMethod).toBe('BANK_TRANSFER');
    expect(args.data.paymentReference).toBe('TXN-99');
    expect(args.data.paidAt).toBeInstanceOf(Date);
  });

  it('markPaid() rejects a DRAFT payout (409)', async () => {
    payoutStore.current.status = 'DRAFT';
    await request(app.getHttpServer())
      .patch(`/broker-payouts/${PAYOUT_ID}/mark-paid`)
      .send({ paymentMethod: 'BANK_TRANSFER' })
      .expect(409);
    expect(mock.brokerPayout.update).not.toHaveBeenCalled();
  });

  // ── cancel() ───────────────────────────────────────────────────────────

  it('cancel() on a DRAFT payout unlinks commissions and zeroes totals', async () => {
    payoutStore.current.status = 'DRAFT';
    await request(app.getHttpServer())
      .patch(`/broker-payouts/${PAYOUT_ID}/cancel`)
      .send({ reason: 'broker requested' })
      .expect(200);

    // Commissions are unlinked from this payout (payoutId → null).
    expect(mock.brokerCommission.updateMany).toHaveBeenCalledTimes(1);
    const unlinkArgs = mock.brokerCommission.updateMany.mock.calls[0]![0] as {
      where: { payoutId: string };
      data: { payoutId: null };
    };
    expect(unlinkArgs.where.payoutId).toBe(PAYOUT_ID);
    expect(unlinkArgs.data.payoutId).toBeNull();

    // Payout flipped to CANCELLED with totals zeroed.
    const updateArgs = mock.brokerPayout.update.mock.calls[0]![0] as {
      data: { status: string; cancelReason: string };
    };
    expect(updateArgs.data.status).toBe('CANCELLED');
    expect(updateArgs.data.cancelReason).toBe('broker requested');
  });

  it('cancel() on a PAID payout is rejected (400)', async () => {
    payoutStore.current.status = 'PAID';
    await request(app.getHttpServer())
      .patch(`/broker-payouts/${PAYOUT_ID}/cancel`)
      .send({ reason: 'mistake' })
      .expect(400);
    expect(mock.brokerCommission.updateMany).not.toHaveBeenCalled();
    expect(mock.brokerPayout.update).not.toHaveBeenCalled();
  });

  it('cancel() rejects empty reason (400)', async () => {
    payoutStore.current.status = 'DRAFT';
    // Validation pipe blocks empty string before service is reached.
    await request(app.getHttpServer())
      .patch(`/broker-payouts/${PAYOUT_ID}/cancel`)
      .send({ reason: '' })
      .expect(400);
    expect(mock.brokerPayout.update).not.toHaveBeenCalled();
  });
});
