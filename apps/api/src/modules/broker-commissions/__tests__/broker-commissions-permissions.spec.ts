import { CanActivate, ExecutionContext, Global, INestApplication, Module } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { NotificationsService } from '../../notifications/notifications.module';
import request from 'supertest';
import { UserRole } from '@prisma/client';
import { BrokerCommissionsController } from '../broker-commissions.controller';
import { BrokerCommissionsService } from '../broker-commissions.service';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  PERMISSIONS_KEY,
  type PermissionsMeta,
} from '../../../common/decorators/permissions.decorator';

/**
 * Verifies the broker-commissions admin permissions rollout:
 *   * Per-route metadata (read + 3 strict).
 *   * ADMIN bypass on read; structured 403 from strict routes for ADMIN
 *     missing the code, with side-effect mocks proving nothing fired.
 *   * SALES blocked by @Roles on every state-change route.
 *   * Cancel payout-coupling check still runs after permission passes.
 *
 * Broker portal commission routes (/broker-portal/commissions) are NOT
 * exercised here — they are gated by BrokerScopeGuard +
 * BrokerCommissionsViewerGuard, not by admin UserPermission, and live in a
 * different controller that this batch does not touch.
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

interface CommissionFixture {
  id: string;
  commissionNumber: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  notes: string | null;
  brokerId: string;
  payoutId: string | null;
  contractId: string;
  contract: {
    contractNumber: string;
    reservation: { leadId: string | null } | null;
  };
}

const commissionStore: { current: CommissionFixture } = {
  current: {
    id: '00000000-0000-0000-0000-000000000001',
    commissionNumber: 'COM-2026-0001',
    status: 'PENDING',
    notes: null,
    brokerId: 'broker-1',
    payoutId: null,
    contractId: 'contract-1',
    contract: { contractNumber: 'CT-0001', reservation: { leadId: 'lead-1' } },
  },
};

// Optional payout fixture used only by the cancel-with-payout test.
const payoutStore: { current: { id: string; payoutNumber: string; status: string } | null } = {
  current: null,
};

function makePrismaMock() {
  const updated = (status: string) => ({
    ...commissionStore.current,
    status,
    approvedById: null,
    rejectedById: null,
    contractId: commissionStore.current.contractId,
  });

  return {
    userPermission: {
      findMany: jest.fn().mockImplementation(async () => {
        const u = FakeAuthGuard.currentUser;
        return (u?.codes ?? []).map((code) => ({ permission: { code } }));
      }),
    },
    brokerCommission: {
      // Called by both `assertExists` (small select) and `writeActivity`
      // (joined select). Returning a superset is safe.
      findUnique: jest.fn().mockImplementation(async () => ({ ...commissionStore.current })),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn().mockImplementation(async ({ data }) => updated(data.status ?? 'PENDING')),
    },
    brokerPayout: {
      findUnique: jest.fn().mockImplementation(async () => payoutStore.current),
    },
    brokerUser: { findMany: jest.fn().mockResolvedValue([{ userId: 'broker-user-1' }]) },
    leadActivity: { create: jest.fn().mockResolvedValue({}) },
    notification: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    $transaction: jest.fn().mockImplementation(async (ops: unknown) => {
      if (Array.isArray(ops)) return Promise.all(ops);
      return ops;
    }),
  };
}

const notificationsMock = {
  sendToUser: jest.fn().mockResolvedValue(undefined),
  sendToUsers: jest.fn().mockResolvedValue(undefined),
  sendToRoles: jest.fn().mockResolvedValue(undefined),
};

describe('Broker-commissions module · permissions enforcement', () => {
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
      controllers: [BrokerCommissionsController],
      providers: [{ provide: NotificationsService, useValue: notificationsMock }, BrokerCommissionsService],
    })
    class TestBrokerCommissionsModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [TestBrokerCommissionsModule],
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
    prismaMock.brokerCommission.update.mockClear();
    prismaMock.brokerPayout.findUnique.mockClear();
    prismaMock.leadActivity.create.mockClear();
    notificationsMock.sendToUsers.mockClear();
    // Reset fixtures.
    commissionStore.current = {
      id: '00000000-0000-0000-0000-000000000001',
      commissionNumber: 'COM-2026-0001',
      status: 'PENDING',
      notes: null,
      brokerId: 'broker-1',
      payoutId: null,
      contractId: 'contract-1',
      contract: { contractNumber: 'CT-0001', reservation: { leadId: 'lead-1' } },
    };
    payoutStore.current = null;
  });

  // ── Metadata ───────────────────────────────────────────────────────────

  describe('@Permissions metadata', () => {
    const proto = BrokerCommissionsController.prototype as unknown as Record<
      string,
      (...a: unknown[]) => unknown
    >;
    function getMeta(method: string): PermissionsMeta | undefined {
      return reflector.get<PermissionsMeta | undefined>(PERMISSIONS_KEY, proto[method]!);
    }

    it('list → broker_commissions:read, bypass true', () => {
      expect(getMeta('list')).toMatchObject({
        codes: ['broker_commissions:read'],
        adminBypass: true,
      });
    });
    it('findOne → broker_commissions:read, bypass true', () => {
      expect(getMeta('findOne')).toMatchObject({
        codes: ['broker_commissions:read'],
        adminBypass: true,
      });
    });
    it('approve → broker_commissions:approve, bypass FALSE (strict)', () => {
      expect(getMeta('approve')).toMatchObject({
        codes: ['broker_commissions:approve'],
        adminBypass: false,
      });
    });
    it('reject → broker_commissions:reject, bypass FALSE (strict)', () => {
      expect(getMeta('reject')).toMatchObject({
        codes: ['broker_commissions:reject'],
        adminBypass: false,
      });
    });
    it('cancel → broker_commissions:cancel, bypass FALSE (strict)', () => {
      expect(getMeta('cancel')).toMatchObject({
        codes: ['broker_commissions:cancel'],
        adminBypass: false,
      });
    });
  });

  // ── GET /broker-commissions ─────────────────────────────────────────────

  describe('GET /broker-commissions', () => {
    it('ADMIN bypasses — no permission DB lookup', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer()).get('/broker-commissions').expect(200);
      expect(prismaMock.userPermission.findMany).not.toHaveBeenCalled();
    });

    it('SALES with broker_commissions:read can list (single DB lookup)', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['broker_commissions:read'],
      };
      await request(app.getHttpServer()).get('/broker-commissions').expect(200);
      expect(prismaMock.userPermission.findMany).toHaveBeenCalledTimes(1);
    });

    it('SALES without broker_commissions:read returns structured 403', async () => {
      FakeAuthGuard.currentUser = { sub: 'sales-2', role: UserRole.SALES, codes: [] };
      const res = await request(app.getHttpServer()).get('/broker-commissions').expect(403);
      expect(res.body).toMatchObject({
        code: 'missing_permission',
        permissions: ['broker_commissions:read'],
      });
    });

    it('rejects unauthenticated requests', async () => {
      FakeAuthGuard.currentUser = null;
      await request(app.getHttpServer()).get('/broker-commissions').expect(403);
    });
  });

  // ── PATCH /broker-commissions/:id/approve (strict) ─────────────────────

  describe('PATCH /broker-commissions/:id/approve (strict)', () => {
    const PATH = '/broker-commissions/00000000-0000-0000-0000-000000000001/approve';

    it('ADMIN WITHOUT broker_commissions:approve → structured 403; no side effects', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      const res = await request(app.getHttpServer()).patch(PATH).send({}).expect(403);
      expect(res.body).toMatchObject({
        code: 'missing_permission',
        permissions: ['broker_commissions:approve'],
      });
      expect(prismaMock.brokerCommission.update).not.toHaveBeenCalled();
      expect(prismaMock.leadActivity.create).not.toHaveBeenCalled();
      expect(notificationsMock.sendToUsers).not.toHaveBeenCalled();
    });

    it('ADMIN WITH broker_commissions:approve → 200; side effects fire', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'admin-2',
        role: UserRole.ADMIN,
        codes: ['broker_commissions:approve'],
      };
      await request(app.getHttpServer()).patch(PATH).send({}).expect(200);
      expect(prismaMock.brokerCommission.update).toHaveBeenCalledTimes(1);
      expect(prismaMock.leadActivity.create).toHaveBeenCalledTimes(1);
      expect(notificationsMock.sendToUsers).toHaveBeenCalled();
    });

    it('SALES even with broker_commissions:approve → 403 from @Roles', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['broker_commissions:approve'],
      };
      const res = await request(app.getHttpServer()).patch(PATH).send({}).expect(403);
      expect(res.body.message).toBe('Insufficient role');
      expect(prismaMock.userPermission.findMany).not.toHaveBeenCalled();
      expect(prismaMock.brokerCommission.update).not.toHaveBeenCalled();
    });
  });

  // ── PATCH /broker-commissions/:id/reject (strict) ──────────────────────

  describe('PATCH /broker-commissions/:id/reject (strict)', () => {
    const PATH = '/broker-commissions/00000000-0000-0000-0000-000000000001/reject';
    const BODY = { reason: 'Invalid contract data' };

    it('ADMIN WITHOUT broker_commissions:reject → structured 403; no side effects', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      const res = await request(app.getHttpServer()).patch(PATH).send(BODY).expect(403);
      expect(res.body).toMatchObject({
        code: 'missing_permission',
        permissions: ['broker_commissions:reject'],
      });
      expect(prismaMock.brokerCommission.update).not.toHaveBeenCalled();
      expect(prismaMock.leadActivity.create).not.toHaveBeenCalled();
      expect(notificationsMock.sendToUsers).not.toHaveBeenCalled();
    });

    it('ADMIN WITH broker_commissions:reject → 200; side effects fire', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'admin-2',
        role: UserRole.ADMIN,
        codes: ['broker_commissions:reject'],
      };
      await request(app.getHttpServer()).patch(PATH).send(BODY).expect(200);
      expect(prismaMock.brokerCommission.update).toHaveBeenCalledTimes(1);
      expect(prismaMock.leadActivity.create).toHaveBeenCalledTimes(1);
      expect(notificationsMock.sendToUsers).toHaveBeenCalled();
    });
  });

  // ── PATCH /broker-commissions/:id/cancel (strict) ──────────────────────

  describe('PATCH /broker-commissions/:id/cancel (strict)', () => {
    const PATH = '/broker-commissions/00000000-0000-0000-0000-000000000001/cancel';
    const BODY = { reason: 'Contract voided' };

    it('ADMIN WITHOUT broker_commissions:cancel → structured 403; no side effects, no payout lookup', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      const res = await request(app.getHttpServer()).patch(PATH).send(BODY).expect(403);
      expect(res.body).toMatchObject({
        code: 'missing_permission',
        permissions: ['broker_commissions:cancel'],
      });
      // Crucially: even the payout-coupling check (a service-level read) must
      // not have run, because the guard short-circuited before the handler.
      expect(prismaMock.brokerPayout.findUnique).not.toHaveBeenCalled();
      expect(prismaMock.brokerCommission.update).not.toHaveBeenCalled();
      expect(prismaMock.leadActivity.create).not.toHaveBeenCalled();
      expect(notificationsMock.sendToUsers).not.toHaveBeenCalled();
    });

    it('ADMIN WITH broker_commissions:cancel, commission unlinked → 200; side effects fire', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'admin-2',
        role: UserRole.ADMIN,
        codes: ['broker_commissions:cancel'],
      };
      await request(app.getHttpServer()).patch(PATH).send(BODY).expect(200);
      expect(prismaMock.brokerCommission.update).toHaveBeenCalledTimes(1);
      expect(prismaMock.leadActivity.create).toHaveBeenCalledTimes(1);
      expect(notificationsMock.sendToUsers).toHaveBeenCalled();
    });

    it('ADMIN WITH the code, but commission linked to PAID payout → 409 (business logic runs after permission passes)', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'admin-2',
        role: UserRole.ADMIN,
        codes: ['broker_commissions:cancel'],
      };
      commissionStore.current.payoutId = 'payout-1';
      payoutStore.current = { id: 'payout-1', payoutNumber: 'PAY-0001', status: 'PAID' };

      await request(app.getHttpServer()).patch(PATH).send(BODY).expect(409);
      // Payout-coupling check DID run (proves business logic runs after the
      // permission gate passed).
      expect(prismaMock.brokerPayout.findUnique).toHaveBeenCalledTimes(1);
      // No state mutation, no side effects.
      expect(prismaMock.brokerCommission.update).not.toHaveBeenCalled();
      expect(prismaMock.leadActivity.create).not.toHaveBeenCalled();
      expect(notificationsMock.sendToUsers).not.toHaveBeenCalled();
    });
  });
});
