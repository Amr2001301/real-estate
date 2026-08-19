/**
 * TASK-TEST-002 — @PermissionsStrict cross-cutting audit
 *
 * Two sections:
 *
 * 1. METADATA AUDIT — reads decorator metadata for every @PermissionsStrict
 *    method across all modules and asserts adminBypass === false.  No HTTP
 *    server required; runs in milliseconds.  Catches any future regression
 *    where someone accidentally swaps @PermissionsStrict for @Permissions.
 *
 * 2. HTTP ENFORCEMENT — spins up a minimal NestJS app with the real
 *    RolesGuard + PermissionsGuard and verifies that the guard chain
 *    produces the correct HTTP responses for the reservations:approve
 *    strict endpoint (called out explicitly in PLATFORM_TASK_PLAN.md).
 *    Deposits:verify and broker-commissions:approve/reject/cancel are
 *    covered in their own module-level specs.
 */

import {
  CanActivate,
  Controller,
  ExecutionContext,
  Global,
  INestApplication,
  Module,
  Post,
} from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { UserRole } from '@prisma/client';

import { DepositsModule } from '../modules/deposits/deposits.module';
import { ReservationsModule } from '../modules/reservations/reservations.module';
import { ContractsModule } from '../modules/contracts/contracts.module';
import { BrokersModule } from '../modules/brokers/brokers.module';
import { BrokerLeadsModule } from '../modules/broker-leads/broker-leads.module';
import { BrokerPayoutsModule } from '../modules/broker-payouts/broker-payouts.module';
import { BrokerCommissionsModule } from '../modules/broker-commissions/broker-commissions.module';
import { BrokerUsersModule } from '../modules/broker-users/broker-users.module';
import { BonusModule } from '../modules/bonus/bonus.module';

import {
  PERMISSIONS_KEY,
  PermissionsStrict,
  type PermissionsMeta,
} from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { PrismaService } from '../common/prisma/prisma.service';

// ─── helpers ────────────────────────────────────────────────────────────────

function getControllers(mod: new () => unknown): Array<new () => unknown> {
  return (Reflect.getMetadata('controllers', mod) as Array<new () => unknown>) ?? [];
}

function strictMeta(proto: Record<string, unknown>, method: string): PermissionsMeta | undefined {
  return Reflect.getMetadata(PERMISSIONS_KEY, proto[method] as object) as
    | PermissionsMeta
    | undefined;
}

function assertStrict(proto: Record<string, unknown>, method: string, code: string) {
  const meta = strictMeta(proto, method);
  expect(meta).toBeDefined();
  expect(meta!.codes).toContain(code);
  expect(meta!.adminBypass).toBe(false);
}

// ─── Section 1: Metadata audit ──────────────────────────────────────────────

describe('@PermissionsStrict metadata audit — all modules', () => {
  // ── deposits ──────────────────────────────────────────────────────────────
  describe('DepositsController', () => {
    const [Ctor] = getControllers(DepositsModule);
    const proto = (Ctor as { prototype: Record<string, unknown> }).prototype;

    it('verify → deposits:verify, adminBypass false', () =>
      assertStrict(proto, 'verify', 'deposits:verify'));
    it('approveProof → deposits:verify, adminBypass false', () =>
      assertStrict(proto, 'approveProof', 'deposits:verify'));
    it('rejectProof → deposits:verify, adminBypass false', () =>
      assertStrict(proto, 'rejectProof', 'deposits:verify'));
  });

  // ── reservations ──────────────────────────────────────────────────────────
  describe('ReservationsController', () => {
    const [Ctor] = getControllers(ReservationsModule);
    const proto = (Ctor as { prototype: Record<string, unknown> }).prototype;

    it('approveReservation → reservations:approve, adminBypass false', () =>
      assertStrict(proto, 'approveReservation', 'reservations:approve'));
    it('rejectReservation → reservations:reject, adminBypass false', () =>
      assertStrict(proto, 'rejectReservation', 'reservations:reject'));
    it('cancelReservation → reservations:cancel, adminBypass false', () =>
      assertStrict(proto, 'cancelReservation', 'reservations:cancel'));
    it('convertReservation → reservations:convert, adminBypass false', () =>
      assertStrict(proto, 'convertReservation', 'reservations:convert'));
    it('confirmBookingPayment → reservations:booking-payment, adminBypass false', () =>
      assertStrict(proto, 'confirmBookingPayment', 'reservations:booking-payment'));
    it('unconfirmBookingPayment → reservations:booking-payment, adminBypass false', () =>
      assertStrict(proto, 'unconfirmBookingPayment', 'reservations:booking-payment'));
  });

  // ── contracts ─────────────────────────────────────────────────────────────
  describe('ContractsController', () => {
    const [Ctor] = getControllers(ContractsModule);
    const proto = (Ctor as { prototype: Record<string, unknown> }).prototype;

    it('sign → contracts:sign, adminBypass false', () =>
      assertStrict(proto, 'sign', 'contracts:sign'));
  });

  // ── brokers ───────────────────────────────────────────────────────────────
  describe('BrokersController', () => {
    const [Ctor] = getControllers(BrokersModule);
    const proto = (Ctor as { prototype: Record<string, unknown> }).prototype;

    it('suspend → brokers:suspend, adminBypass false', () =>
      assertStrict(proto, 'suspend', 'brokers:suspend'));
    it('terminate → brokers:terminate, adminBypass false', () =>
      assertStrict(proto, 'terminate', 'brokers:terminate'));
  });

  // ── broker-leads ──────────────────────────────────────────────────────────
  describe('BrokerLeadsController', () => {
    const [Ctor] = getControllers(BrokerLeadsModule);
    const proto = (Ctor as { prototype: Record<string, unknown> }).prototype;

    it('approve → broker_leads:approve, adminBypass false', () =>
      assertStrict(proto, 'approve', 'broker_leads:approve'));
    it('reject → broker_leads:reject, adminBypass false', () =>
      assertStrict(proto, 'reject', 'broker_leads:reject'));
    it('markDuplicate → broker_leads:reject, adminBypass false', () =>
      assertStrict(proto, 'markDuplicate', 'broker_leads:reject'));
  });

  // ── broker-payouts ────────────────────────────────────────────────────────
  describe('BrokerPayoutsController', () => {
    const [Ctor] = getControllers(BrokerPayoutsModule);
    const proto = (Ctor as { prototype: Record<string, unknown> }).prototype;

    it('approve → broker_payouts:approve, adminBypass false', () =>
      assertStrict(proto, 'approve', 'broker_payouts:approve'));
    it('process → broker_payouts:process, adminBypass false', () =>
      assertStrict(proto, 'process', 'broker_payouts:process'));
    it('markPaid → broker_payouts:pay, adminBypass false', () =>
      assertStrict(proto, 'markPaid', 'broker_payouts:pay'));
    it('cancel → broker_payouts:cancel, adminBypass false', () =>
      assertStrict(proto, 'cancel', 'broker_payouts:cancel'));
  });

  // ── broker-commissions ────────────────────────────────────────────────────
  describe('BrokerCommissionsController', () => {
    const [Ctor] = getControllers(BrokerCommissionsModule);
    const proto = (Ctor as { prototype: Record<string, unknown> }).prototype;

    it('approve → broker_commissions:approve, adminBypass false', () =>
      assertStrict(proto, 'approve', 'broker_commissions:approve'));
    it('reject → broker_commissions:reject, adminBypass false', () =>
      assertStrict(proto, 'reject', 'broker_commissions:reject'));
    it('cancel → broker_commissions:cancel, adminBypass false', () =>
      assertStrict(proto, 'cancel', 'broker_commissions:cancel'));
  });

  // ── bonus ────────────────────────────────────────────────────────────────
  describe('BonusController', () => {
    const [Ctor] = getControllers(BonusModule);
    const proto = (Ctor as { prototype: Record<string, unknown> }).prototype;

    it('approveEntry → bonus:entries:approve, adminBypass false', () =>
      assertStrict(proto, 'approveEntry', 'bonus:entries:approve'));
    it('payEntry → bonus:entries:pay, adminBypass false', () =>
      assertStrict(proto, 'payEntry', 'bonus:entries:pay'));
  });

  // ── broker-users ──────────────────────────────────────────────────────────
  describe('BrokerUsersController', () => {
    const [Ctor] = getControllers(BrokerUsersModule);
    const proto = (Ctor as { prototype: Record<string, unknown> }).prototype;

    it('updateStatus → broker_users:remove, adminBypass false', () =>
      assertStrict(proto, 'updateStatus', 'broker_users:remove'));
  });
});

// ─── Section 2: HTTP enforcement — reservations:approve ─────────────────────
//
// Spins up a minimal NestJS app with a thin stub controller that mirrors the
// real ReservationsController's decorator stack for the approve endpoint.
// Tests that the real guard chain (FakeAuth → RolesGuard → PermissionsGuard)
// produces the correct HTTP responses without needing the real service layer.

interface FakeUser {
  sub: string;
  role: UserRole;
  codes: string[];
}

class FakeAuthGuard implements CanActivate {
  static currentUser: FakeUser | null = null;
  canActivate(context: ExecutionContext): boolean {
    if (!FakeAuthGuard.currentUser) return false;
    const req = context.switchToHttp().getRequest<{ user: unknown }>();
    req.user = {
      sub: FakeAuthGuard.currentUser.sub,
      role: FakeAuthGuard.currentUser.role,
      email: null,
      phone: null,
    };
    return true;
  }
}

@Controller('reservations')
class StubReservationsController {
  @Roles(UserRole.ADMIN)
  @PermissionsStrict('reservations:approve')
  @Post(':id/approve')
  approveReservation() {
    return { ok: true };
  }

  @Roles(UserRole.ADMIN)
  @PermissionsStrict('reservations:reject')
  @Post(':id/reject')
  rejectReservation() {
    return { ok: true };
  }

  @Roles(UserRole.ADMIN)
  @PermissionsStrict('reservations:cancel')
  @Post(':id/cancel')
  cancelReservation() {
    return { ok: true };
  }

  @Roles(UserRole.ADMIN)
  @PermissionsStrict('reservations:convert')
  @Post(':id/convert')
  convertReservation() {
    return { ok: true };
  }

  @Roles(UserRole.ADMIN)
  @PermissionsStrict('reservations:booking-payment')
  @Post(':id/booking-payment/confirm')
  confirmBookingPayment() {
    return { ok: true };
  }

  @Roles(UserRole.ADMIN)
  @PermissionsStrict('reservations:booking-payment')
  @Post(':id/booking-payment/unconfirm')
  unconfirmBookingPayment() {
    return { ok: true };
  }
}

const prismaMock = {
  userPermission: {
    findMany: jest.fn().mockImplementation(async () => {
      const u = FakeAuthGuard.currentUser;
      return (u?.codes ?? []).map((code: string) => ({ permission: { code } }));
    }),
  },
};

describe('Reservations @PermissionsStrict — HTTP enforcement', () => {
  let app: INestApplication;

  beforeAll(async () => {
    @Global()
    @Module({
      providers: [{ provide: PrismaService, useValue: prismaMock }],
      exports: [PrismaService],
    })
    class MockPrismaModule {}

    @Module({
      imports: [MockPrismaModule],
      controllers: [StubReservationsController],
    })
    class TestModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [TestModule],
      providers: [
        { provide: APP_GUARD, useClass: FakeAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());

  beforeEach(() => {
    FakeAuthGuard.currentUser = null;
    prismaMock.userPermission.findMany.mockClear();
  });

  const ID = '00000000-0000-0000-0000-000000000001';

  // ── reservations:approve ─────────────────────────────────────────────────

  describe('POST /reservations/:id/approve', () => {
    const PATH = `/reservations/${ID}/approve`;

    it('ADMIN WITHOUT reservations:approve → structured 403; no side effects', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      const res = await request(app.getHttpServer()).post(PATH).send({}).expect(403);
      expect(res.body).toMatchObject({
        code: 'missing_permission',
        permissions: ['reservations:approve'],
      });
      // Strict mode: permissions DB was queried (no admin bypass).
      expect(prismaMock.userPermission.findMany).toHaveBeenCalledTimes(1);
    });

    it('ADMIN WITH reservations:approve → 200', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'admin-2',
        role: UserRole.ADMIN,
        codes: ['reservations:approve'],
      };
      const res = await request(app.getHttpServer()).post(PATH).send({}).expect(201);
      expect(res.body).toMatchObject({ ok: true });
    });

    it('SALES WITH reservations:approve → 403 from @Roles (not permissions)', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['reservations:approve'],
      };
      const res = await request(app.getHttpServer()).post(PATH).send({}).expect(403);
      expect(res.body.message).toBe('Insufficient role');
      // RolesGuard blocked before PermissionsGuard ran.
      expect(prismaMock.userPermission.findMany).not.toHaveBeenCalled();
    });

    it('unauthenticated → 403', async () => {
      FakeAuthGuard.currentUser = null;
      await request(app.getHttpServer()).post(PATH).send({}).expect(403);
      expect(prismaMock.userPermission.findMany).not.toHaveBeenCalled();
    });
  });

  // ── reservations:reject ──────────────────────────────────────────────────

  describe('POST /reservations/:id/reject', () => {
    const PATH = `/reservations/${ID}/reject`;

    it('ADMIN WITHOUT reservations:reject → structured 403', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      const res = await request(app.getHttpServer()).post(PATH).send({ reason: 'test' }).expect(403);
      expect(res.body).toMatchObject({
        code: 'missing_permission',
        permissions: ['reservations:reject'],
      });
    });

    it('ADMIN WITH reservations:reject → 200', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'admin-2',
        role: UserRole.ADMIN,
        codes: ['reservations:reject'],
      };
      await request(app.getHttpServer()).post(PATH).send({ reason: 'test' }).expect(201);
    });
  });

  // ── reservations:cancel ──────────────────────────────────────────────────

  describe('POST /reservations/:id/cancel', () => {
    const PATH = `/reservations/${ID}/cancel`;

    it('ADMIN WITHOUT reservations:cancel → structured 403', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      const res = await request(app.getHttpServer()).post(PATH).send({ reason: 'test' }).expect(403);
      expect(res.body).toMatchObject({
        code: 'missing_permission',
        permissions: ['reservations:cancel'],
      });
    });

    it('ADMIN WITH reservations:cancel → 200', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'admin-2',
        role: UserRole.ADMIN,
        codes: ['reservations:cancel'],
      };
      await request(app.getHttpServer()).post(PATH).send({ reason: 'test' }).expect(201);
    });
  });

  // ── reservations:convert ─────────────────────────────────────────────────

  describe('POST /reservations/:id/convert', () => {
    const PATH = `/reservations/${ID}/convert`;

    it('ADMIN WITHOUT reservations:convert → structured 403', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      const res = await request(app.getHttpServer()).post(PATH).send({}).expect(403);
      expect(res.body).toMatchObject({
        code: 'missing_permission',
        permissions: ['reservations:convert'],
      });
    });

    it('ADMIN WITH reservations:convert → 200', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'admin-2',
        role: UserRole.ADMIN,
        codes: ['reservations:convert'],
      };
      await request(app.getHttpServer()).post(PATH).send({}).expect(201);
    });
  });

  // ── reservations:booking-payment ─────────────────────────────────────────

  describe('POST /reservations/:id/booking-payment/confirm', () => {
    const PATH = `/reservations/${ID}/booking-payment/confirm`;

    it('ADMIN WITHOUT reservations:booking-payment → structured 403', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      const res = await request(app.getHttpServer()).post(PATH).send({}).expect(403);
      expect(res.body).toMatchObject({
        code: 'missing_permission',
        permissions: ['reservations:booking-payment'],
      });
    });

    it('ADMIN WITH reservations:booking-payment → 200', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'admin-2',
        role: UserRole.ADMIN,
        codes: ['reservations:booking-payment'],
      };
      await request(app.getHttpServer()).post(PATH).send({}).expect(201);
    });
  });

  describe('POST /reservations/:id/booking-payment/unconfirm', () => {
    const PATH = `/reservations/${ID}/booking-payment/unconfirm`;

    it('ADMIN WITHOUT reservations:booking-payment → structured 403', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      const res = await request(app.getHttpServer()).post(PATH).send({}).expect(403);
      expect(res.body).toMatchObject({
        code: 'missing_permission',
        permissions: ['reservations:booking-payment'],
      });
    });

    it('ADMIN WITH reservations:booking-payment → 200', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'admin-2',
        role: UserRole.ADMIN,
        codes: ['reservations:booking-payment'],
      };
      await request(app.getHttpServer()).post(PATH).send({}).expect(201);
    });
  });
});
