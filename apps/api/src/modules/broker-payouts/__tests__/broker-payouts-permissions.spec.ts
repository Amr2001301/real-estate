import { CanActivate, ExecutionContext, Global, INestApplication, Module } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { UserRole } from '@prisma/client';
import { BrokerPayoutsController } from '../broker-payouts.controller';
import { BrokerPayoutsService } from '../broker-payouts.service';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  PERMISSIONS_KEY,
  type PermissionsMeta,
} from '../../../common/decorators/permissions.decorator';

/**
 * Verifies the broker-payouts admin permissions rollout:
 *   * Per-route metadata (3 read + 1 create + 2 update + 4 strict).
 *   * ADMIN bypass on every non-strict route; structured 403 from strict
 *     routes for ADMIN missing the code, with side-effect mocks proving
 *     nothing fired.
 *   * SALES blocked by @Roles on every route (payouts are admin-only).
 *   * Business validation (e.g. "approve with 0 commissions → 400") still
 *     runs once the permission gate passes.
 *
 * Broker portal payout routes are NOT exercised — they are guarded by
 * BrokerScopeGuard + BrokerCommissionsViewerGuard in broker-portal.controller.ts,
 * which this batch does not touch.
 */

interface FakeUser {
  sub: string;
  role: UserRole;
  codes: string[];
}

class FakeAuthGuard implements CanActivate {
  static currentUser: FakeUser | null = null;
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

type Status = 'DRAFT' | 'APPROVED' | 'PROCESSING' | 'PAID' | 'CANCELLED';

// Mutable so each test can set the starting state assertExists/assertPayoutInStatus sees.
const payoutStore: {
  current: {
    id: string;
    payoutNumber: string;
    brokerId: string;
    status: Status;
    notes: string | null;
  };
  commissionCount: number;
} = {
  current: {
    id: '00000000-0000-0000-0000-000000000001',
    payoutNumber: 'PAY-2026-0001',
    brokerId: 'broker-1',
    status: 'DRAFT',
    notes: null,
  },
  commissionCount: 1, // default: payout has 1 linked commission
};

function makePrismaMock() {
  const updated = (status: Status) => ({
    ...payoutStore.current,
    status,
  });

  return {
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
      create: jest.fn().mockImplementation(async ({ data }) => ({
        id: 'new-payout-id',
        ...data,
      })),
      update: jest.fn().mockImplementation(async ({ data }) => updated(data.status ?? 'DRAFT')),
      aggregate: jest.fn().mockResolvedValue({ _sum: {} }),
    },
    brokerCommission: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockImplementation(async () => payoutStore.commissionCount),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      aggregate: jest.fn().mockResolvedValue({
        _sum: {
          grossAmount: 0,
          taxAmount: 0,
          withholdingAmount: 0,
          netAmount: 0,
        },
      }),
    },
    brokerUser: { findMany: jest.fn().mockResolvedValue([{ userId: 'broker-user-1' }]) },
    brokerActivityLog: { create: jest.fn().mockResolvedValue({}) },
    notification: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    $transaction: jest.fn().mockImplementation(async (ops: unknown) => {
      if (Array.isArray(ops)) return Promise.all(ops);
      if (typeof ops === 'function') {
        const tx: Record<string, unknown> = {
          brokerPayout: {
            create: jest.fn().mockImplementation(async ({ data }) => ({
              id: 'new-payout-id',
              ...data,
            })),
            update: jest.fn().mockImplementation(async ({ data }) => updated(data.status ?? 'DRAFT')),
          },
          brokerCommission: {
            updateMany: jest.fn().mockResolvedValue({ count: 0 }),
            aggregate: jest.fn().mockResolvedValue({
              _sum: {
                grossAmount: 0,
                taxAmount: 0,
                withholdingAmount: 0,
                netAmount: 0,
              },
            }),
          },
        };
        return (ops as (tx: unknown) => Promise<unknown>)(tx);
      }
      return ops;
    }),
  };
}

describe('Broker-payouts module · permissions enforcement', () => {
  let app: INestApplication;
  let prismaMock: ReturnType<typeof makePrismaMock>;
  let reflector: Reflector;

  beforeAll(async () => {
    prismaMock = makePrismaMock();

    @Global()
    @Module({
      providers: [{ provide: PrismaService, useValue: prismaMock }],
      exports: [PrismaService],
    })
    class MockPrismaModule {}

    @Module({
      imports: [MockPrismaModule],
      controllers: [BrokerPayoutsController],
      providers: [BrokerPayoutsService],
    })
    class TestBrokerPayoutsModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [TestBrokerPayoutsModule],
      providers: [
        Reflector,
        { provide: APP_GUARD, useClass: FakeAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
      ],
    }).compile();

    reflector = moduleRef.get(Reflector);
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    FakeAuthGuard.currentUser = null;
    prismaMock.userPermission.findMany.mockClear();
    prismaMock.brokerPayout.update.mockClear();
    prismaMock.brokerCommission.updateMany.mockClear();
    prismaMock.brokerActivityLog.create.mockClear();
    prismaMock.notification.createMany.mockClear();
    // Reset fixture to DRAFT with a linked commission.
    payoutStore.current = {
      id: '00000000-0000-0000-0000-000000000001',
      payoutNumber: 'PAY-2026-0001',
      brokerId: 'broker-1',
      status: 'DRAFT',
      notes: null,
    };
    payoutStore.commissionCount = 1;
  });

  // ── Metadata ───────────────────────────────────────────────────────────

  describe('@Permissions metadata', () => {
    const proto = BrokerPayoutsController.prototype as unknown as Record<
      string,
      (...a: unknown[]) => unknown
    >;
    function getMeta(method: string): PermissionsMeta | undefined {
      return reflector.get<PermissionsMeta | undefined>(PERMISSIONS_KEY, proto[method]!);
    }

    it.each<[string, string]>([
      ['eligible', 'broker_payouts:read'],
      ['list', 'broker_payouts:read'],
      ['findOne', 'broker_payouts:read'],
    ])('%s → @Permissions(%s), bypass true', (method, code) => {
      expect(getMeta(method)).toMatchObject({ codes: [code], adminBypass: true });
    });

    it('create → broker_payouts:create, bypass true', () => {
      expect(getMeta('create')).toMatchObject({
        codes: ['broker_payouts:create'],
        adminBypass: true,
      });
    });

    it.each<[string]>([['addCommissions'], ['removeCommissions']])(
      '%s → broker_payouts:update, bypass true',
      (method) => {
        expect(getMeta(method)).toMatchObject({
          codes: ['broker_payouts:update'],
          adminBypass: true,
        });
      },
    );

    it('approve → broker_payouts:approve, bypass FALSE (strict)', () => {
      expect(getMeta('approve')).toMatchObject({
        codes: ['broker_payouts:approve'],
        adminBypass: false,
      });
    });
    it('process → broker_payouts:process, bypass FALSE (strict)', () => {
      expect(getMeta('process')).toMatchObject({
        codes: ['broker_payouts:process'],
        adminBypass: false,
      });
    });
    it('markPaid → broker_payouts:pay, bypass FALSE (strict)', () => {
      expect(getMeta('markPaid')).toMatchObject({
        codes: ['broker_payouts:pay'],
        adminBypass: false,
      });
    });
    it('cancel → broker_payouts:cancel, bypass FALSE (strict)', () => {
      expect(getMeta('cancel')).toMatchObject({
        codes: ['broker_payouts:cancel'],
        adminBypass: false,
      });
    });
  });

  // ── Read routes ────────────────────────────────────────────────────────

  describe('Read routes (ADMIN-only at @Roles)', () => {
    it('GET /broker-payouts — ADMIN bypasses, no permission DB lookup', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer()).get('/broker-payouts').expect(200);
      expect(prismaMock.userPermission.findMany).not.toHaveBeenCalled();
    });

    it('GET /broker-payouts — unauthenticated → 403', async () => {
      FakeAuthGuard.currentUser = null;
      await request(app.getHttpServer()).get('/broker-payouts').expect(403);
    });

    it('GET /broker-payouts — SALES with broker_payouts:read → 403 from @Roles (admin-only route)', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['broker_payouts:read'],
      };
      const res = await request(app.getHttpServer()).get('/broker-payouts').expect(403);
      expect(res.body.message).toBe('Insufficient role');
      expect(prismaMock.userPermission.findMany).not.toHaveBeenCalled();
    });
  });

  // ── Create / update (DRAFT-only) ───────────────────────────────────────

  describe('POST /broker-payouts (create)', () => {
    const BODY = { brokerId: 'broker-1' };

    it('ADMIN bypasses → payout draft created; activity + notification side effects fire', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer()).post('/broker-payouts').send(BODY).expect(201);
      expect(prismaMock.userPermission.findMany).not.toHaveBeenCalled();
      expect(prismaMock.brokerActivityLog.create).toHaveBeenCalledTimes(1);
      expect(prismaMock.notification.createMany).toHaveBeenCalledTimes(1);
    });

    it('SALES even with broker_payouts:create → 403 from @Roles', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['broker_payouts:create'],
      };
      const res = await request(app.getHttpServer()).post('/broker-payouts').send(BODY).expect(403);
      expect(res.body.message).toBe('Insufficient role');
    });
  });

  describe('POST /broker-payouts/:id/add-commissions', () => {
    const PATH = '/broker-payouts/00000000-0000-0000-0000-000000000001/add-commissions';
    const BODY = { commissionIds: [] }; // empty → service no-ops on the update, succeeds

    it('ADMIN bypasses on DRAFT payout', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer()).post(PATH).send(BODY).expect(201);
      expect(prismaMock.userPermission.findMany).not.toHaveBeenCalled();
    });
  });

  describe('POST /broker-payouts/:id/remove-commissions', () => {
    const PATH = '/broker-payouts/00000000-0000-0000-0000-000000000001/remove-commissions';
    const BODY = { commissionIds: [] };

    it('ADMIN bypasses on DRAFT payout', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer()).post(PATH).send(BODY).expect(201);
      expect(prismaMock.userPermission.findMany).not.toHaveBeenCalled();
    });
  });

  // ── Strict transitions ─────────────────────────────────────────────────

  describe('PATCH /broker-payouts/:id/approve (strict)', () => {
    const PATH = '/broker-payouts/00000000-0000-0000-0000-000000000001/approve';

    it('ADMIN WITHOUT broker_payouts:approve → structured 403; no side effects', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      const res = await request(app.getHttpServer()).patch(PATH).send({}).expect(403);
      expect(res.body).toMatchObject({
        code: 'missing_permission',
        permissions: ['broker_payouts:approve'],
      });
      expect(prismaMock.brokerPayout.update).not.toHaveBeenCalled();
      expect(prismaMock.brokerActivityLog.create).not.toHaveBeenCalled();
      expect(prismaMock.notification.createMany).not.toHaveBeenCalled();
    });

    it('ADMIN WITH broker_payouts:approve → 200; side effects fire', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'admin-2',
        role: UserRole.ADMIN,
        codes: ['broker_payouts:approve'],
      };
      await request(app.getHttpServer()).patch(PATH).send({}).expect(200);
      expect(prismaMock.brokerPayout.update).toHaveBeenCalledTimes(1);
      expect(prismaMock.brokerActivityLog.create).toHaveBeenCalledTimes(1);
      expect(prismaMock.notification.createMany).toHaveBeenCalledTimes(1);
    });

    it('ADMIN WITH the code, but payout has 0 commissions → 400 (business logic survives permission gate)', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'admin-2',
        role: UserRole.ADMIN,
        codes: ['broker_payouts:approve'],
      };
      payoutStore.commissionCount = 0;
      const res = await request(app.getHttpServer()).patch(PATH).send({}).expect(400);
      expect(res.body.message).toContain('no commissions');
      expect(prismaMock.brokerPayout.update).not.toHaveBeenCalled();
      expect(prismaMock.brokerActivityLog.create).not.toHaveBeenCalled();
      expect(prismaMock.notification.createMany).not.toHaveBeenCalled();
    });

    it('SALES even with broker_payouts:approve → 403 from @Roles', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['broker_payouts:approve'],
      };
      const res = await request(app.getHttpServer()).patch(PATH).send({}).expect(403);
      expect(res.body.message).toBe('Insufficient role');
      expect(prismaMock.userPermission.findMany).not.toHaveBeenCalled();
      expect(prismaMock.brokerPayout.update).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /broker-payouts/:id/process (strict)', () => {
    const PATH = '/broker-payouts/00000000-0000-0000-0000-000000000001/process';

    it('ADMIN WITHOUT broker_payouts:process → structured 403; no side effects', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      const res = await request(app.getHttpServer()).patch(PATH).send({}).expect(403);
      expect(res.body).toMatchObject({
        code: 'missing_permission',
        permissions: ['broker_payouts:process'],
      });
      expect(prismaMock.brokerPayout.update).not.toHaveBeenCalled();
      expect(prismaMock.brokerActivityLog.create).not.toHaveBeenCalled();
      expect(prismaMock.notification.createMany).not.toHaveBeenCalled();
    });

    it('ADMIN WITH broker_payouts:process → 200; side effects fire (on APPROVED payout)', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'admin-2',
        role: UserRole.ADMIN,
        codes: ['broker_payouts:process'],
      };
      payoutStore.current.status = 'APPROVED';
      await request(app.getHttpServer()).patch(PATH).send({}).expect(200);
      expect(prismaMock.brokerPayout.update).toHaveBeenCalledTimes(1);
      expect(prismaMock.brokerActivityLog.create).toHaveBeenCalledTimes(1);
      expect(prismaMock.notification.createMany).toHaveBeenCalledTimes(1);
    });
  });

  describe('PATCH /broker-payouts/:id/mark-paid (strict)', () => {
    const PATH = '/broker-payouts/00000000-0000-0000-0000-000000000001/mark-paid';
    const BODY = { paymentMethod: 'BANK_TRANSFER' };

    it('ADMIN WITHOUT broker_payouts:pay → structured 403; no side effects', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      const res = await request(app.getHttpServer()).patch(PATH).send(BODY).expect(403);
      expect(res.body).toMatchObject({
        code: 'missing_permission',
        permissions: ['broker_payouts:pay'],
      });
      expect(prismaMock.brokerPayout.update).not.toHaveBeenCalled();
      expect(prismaMock.brokerActivityLog.create).not.toHaveBeenCalled();
      expect(prismaMock.notification.createMany).not.toHaveBeenCalled();
    });

    it('ADMIN WITH broker_payouts:pay → 200; side effects fire (on PROCESSING payout)', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'admin-2',
        role: UserRole.ADMIN,
        codes: ['broker_payouts:pay'],
      };
      payoutStore.current.status = 'PROCESSING';
      await request(app.getHttpServer()).patch(PATH).send(BODY).expect(200);
      expect(prismaMock.brokerPayout.update).toHaveBeenCalledTimes(1);
      expect(prismaMock.brokerActivityLog.create).toHaveBeenCalledTimes(1);
      expect(prismaMock.notification.createMany).toHaveBeenCalledTimes(1);
    });
  });

  describe('PATCH /broker-payouts/:id/cancel (strict)', () => {
    const PATH = '/broker-payouts/00000000-0000-0000-0000-000000000001/cancel';
    const BODY = { reason: 'Cancelled by operator' };

    it('ADMIN WITHOUT broker_payouts:cancel → structured 403; no side effects, no commission unlinking', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      const res = await request(app.getHttpServer()).patch(PATH).send(BODY).expect(403);
      expect(res.body).toMatchObject({
        code: 'missing_permission',
        permissions: ['broker_payouts:cancel'],
      });
      expect(prismaMock.brokerPayout.update).not.toHaveBeenCalled();
      // No commission unlink — this is the service's $transaction body which
      // the guard prevents from running.
      expect(prismaMock.brokerCommission.updateMany).not.toHaveBeenCalled();
      expect(prismaMock.brokerActivityLog.create).not.toHaveBeenCalled();
      expect(prismaMock.notification.createMany).not.toHaveBeenCalled();
    });

    it('ADMIN WITH broker_payouts:cancel → 200; side effects fire on DRAFT payout', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'admin-2',
        role: UserRole.ADMIN,
        codes: ['broker_payouts:cancel'],
      };
      await request(app.getHttpServer()).patch(PATH).send(BODY).expect(200);
      // The cancel path runs its mutation inside $transaction(callback), so
      // the top-level brokerPayout.update mock is not directly invoked.
      // Side effects (activity + notification) DO run after the transaction.
      expect(prismaMock.brokerActivityLog.create).toHaveBeenCalledTimes(1);
      expect(prismaMock.notification.createMany).toHaveBeenCalledTimes(1);
    });
  });
});
