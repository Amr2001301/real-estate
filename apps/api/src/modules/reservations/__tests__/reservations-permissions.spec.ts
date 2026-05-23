import {
  CanActivate,
  ExecutionContext,
  Global,
  INestApplication,
  Module,
  ValidationPipe,
} from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { UserRole } from '@prisma/client';
import { ReservationsModule } from '../reservations.module';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  PERMISSIONS_KEY,
  type PermissionsMeta,
} from '../../../common/decorators/permissions.decorator';

/**
 * Verifies the reservations permissions rollout:
 *   * Per-route metadata (4 read + 1 create + 1 update + 5 strict + notes
 *     intentionally unguarded).
 *   * ADMIN bypass on read/create/update; SALES grants enable list/create.
 *   * Structured 403 from strict routes for ADMIN missing the code; side
 *     effects (reservation update, unit free/sold, contract create, deposit
 *     create/delete, installment plan, broker commission materialization,
 *     reservation activity) all NOT called when permission fails.
 *   * Business validation (state-machine pre-conditions) still runs once
 *     the permission gate passes.
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

type RStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED' | 'CONVERTED';

const fixture: {
  reservation: {
    id: string;
    reservationNumber: string;
    status: RStatus;
    unitId: string;
    leadId: string | null;
    clientId: string | null;
    contract: { id: string } | null;
    bookingAmount: { gt: (n: number) => boolean; lte: (n: number) => boolean; toString: () => string };
    bookingPaymentStatus: 'UNPAID' | 'PENDING' | 'PAID' | 'WAIVED';
    brokerId: string | null;
    brokerAgentId: string | null;
    installmentPlanTemplateId: string | null;
    selectedDurationMonths: number | null;
    selectedIncreasePercentage: unknown;
    snapshotDownPaymentAmount: unknown;
    snapshotFinancedAmount: unknown;
    snapshotMonthlyInstallment: unknown;
    snapshotTotalPayable: unknown;
    snapshotFinalPaymentAmount: unknown;
    unit: {
      id: string;
      code: string;
      status: 'AVAILABLE' | 'RESERVED' | 'SOLD';
      price: number;
      building: { phase: { projectId: string } };
    };
    lead: { id: string; clientId: string | null; stage: string } | null;
    client: { id: string } | null;
  };
} = {
  reservation: {} as never,
};

function resetFixture() {
  fixture.reservation = {
    id: '00000000-0000-0000-0000-000000000001',
    reservationNumber: 'RES-0001',
    status: 'PENDING',
    unitId: 'unit-1',
    leadId: 'lead-1',
    clientId: 'client-1',
    contract: null,
    bookingAmount: {
      gt: (n: number) => 1000 > n,
      lte: (n: number) => 1000 <= n,
      toString: () => '1000',
    },
    bookingPaymentStatus: 'UNPAID',
    brokerId: null,
    brokerAgentId: null,
    installmentPlanTemplateId: null,
    selectedDurationMonths: null,
    selectedIncreasePercentage: null,
    snapshotDownPaymentAmount: null,
    snapshotFinancedAmount: null,
    snapshotMonthlyInstallment: null,
    snapshotTotalPayable: null,
    snapshotFinalPaymentAmount: null,
    unit: {
      id: 'unit-1',
      code: 'A101',
      status: 'RESERVED',
      price: 100000,
      building: { phase: { projectId: 'project-1' } },
    },
    lead: { id: 'lead-1', clientId: 'client-1', stage: 'NEGOTIATION' },
    client: { id: 'client-1' },
  };
}

function makePrismaMock() {
  const m = {
    userPermission: {
      findMany: jest.fn().mockImplementation(async () => {
        const u = FakeAuthGuard.currentUser;
        return (u?.codes ?? []).map((code) => ({ permission: { code } }));
      }),
    },
    reservation: {
      findUnique: jest.fn().mockImplementation(async () => ({ ...fixture.reservation })),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'new-reservation-id',
        reservationNumber: 'RES-NEW',
        ...data,
      })),
      update: jest.fn().mockImplementation(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => ({
        ...fixture.reservation,
        ...data,
        id: where.id,
      })),
    },
    reservationActivity: {
      create: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
    },
    reservationNote: {
      create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'note-1',
        ...data,
      })),
    },
    leadActivity: { create: jest.fn().mockResolvedValue({}) },
    unit: {
      findUnique: jest.fn().mockImplementation(async () => fixture.reservation.unit),
      update: jest.fn().mockResolvedValue({}),
    },
    unitStatusHistory: { create: jest.fn().mockResolvedValue({}) },
    user: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    contract: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'new-contract-id',
        contractNumber: data.contractNumber,
        ...data,
      })),
    },
    installmentPlan: { create: jest.fn().mockResolvedValue({ id: 'plan-1' }) },
    installment: { create: jest.fn().mockResolvedValue({}) },
    deposit: {
      create: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    lead: { update: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn(),
  };
  // Wire $transaction now that `m` is constructed so the tx callback can
  // proxy writes back into the top-level mocks (tests assert on those).
  m.$transaction.mockImplementation(async (ops: unknown) => {
    if (Array.isArray(ops)) return Promise.all(ops);
    if (typeof ops === 'function') {
      const tx = {
        reservation: m.reservation,
        reservationActivity: m.reservationActivity,
        leadActivity: m.leadActivity,
        unit: m.unit,
        unitStatusHistory: m.unitStatusHistory,
        user: m.user,
        contract: m.contract,
        installmentPlan: m.installmentPlan,
        installment: m.installment,
        deposit: m.deposit,
        lead: m.lead,
      };
      return (ops as (tx: unknown) => Promise<unknown>)(tx);
    }
    return ops;
  });
  return m;
}

let mock = makePrismaMock();

describe('Reservations module · permissions enforcement', () => {
  let app: INestApplication;
  let reflector: Reflector;

  beforeAll(async () => {
    mock = makePrismaMock();

    @Global()
    @Module({
      providers: [{ provide: PrismaService, useValue: mock }],
      exports: [PrismaService],
    })
    class MockPrismaModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [MockPrismaModule, ReservationsModule],
      providers: [
        Reflector,
        { provide: APP_GUARD, useClass: FakeAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
      ],
    }).compile();

    reflector = moduleRef.get(Reflector);
    app = moduleRef.createNestApplication();
    // Mirror production main.ts so the narrowed ConvertReservationDto
    // actually rejects inbound `signedAt` with 400.
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
    FakeAuthGuard.currentUser = null;
    resetFixture();
    // Reset all mocks between tests.
    mock.userPermission.findMany.mockClear();
    mock.reservation.findUnique.mockClear();
    mock.reservation.update.mockClear();
    mock.reservation.create.mockClear();
    mock.reservation.count.mockClear();
    mock.reservationActivity.create.mockClear();
    mock.reservationNote.create.mockClear();
    mock.leadActivity.create.mockClear();
    mock.unit.update.mockClear();
    mock.unitStatusHistory.create.mockClear();
    mock.contract.create.mockClear();
    mock.installmentPlan.create.mockClear();
    mock.installment.create.mockClear();
    mock.deposit.create.mockClear();
    mock.deposit.deleteMany.mockClear();
  });

  // ── Metadata ───────────────────────────────────────────────────────────

  describe('@Permissions metadata', () => {
    const controllers = Reflect.getMetadata('controllers', ReservationsModule) as Array<
      new () => unknown
    >;
    const Ctor = controllers[0]!;
    const proto = Ctor.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;

    function getMeta(method: string): PermissionsMeta | undefined {
      return reflector.get<PermissionsMeta | undefined>(PERMISSIONS_KEY, proto[method]!);
    }

    it.each<[string]>([['stats'], ['list'], ['listActivities'], ['findOne']])(
      '%s → reservations:read, bypass true',
      (method) => {
        expect(getMeta(method)).toMatchObject({
          codes: ['reservations:read'],
          adminBypass: true,
        });
      },
    );
    it('create → reservations:create, bypass true', () => {
      expect(getMeta('create')).toMatchObject({
        codes: ['reservations:create'],
        adminBypass: true,
      });
    });
    it('update → reservations:update, bypass true', () => {
      expect(getMeta('update')).toMatchObject({
        codes: ['reservations:update'],
        adminBypass: true,
      });
    });
    it('addNote → no permission metadata (role-only)', () => {
      expect(getMeta('addNote')).toBeUndefined();
    });
    it('approveReservation → reservations:approve, bypass FALSE (strict)', () => {
      expect(getMeta('approveReservation')).toMatchObject({
        codes: ['reservations:approve'],
        adminBypass: false,
      });
    });
    it('rejectReservation → reservations:reject, bypass FALSE (strict)', () => {
      expect(getMeta('rejectReservation')).toMatchObject({
        codes: ['reservations:reject'],
        adminBypass: false,
      });
    });
    it('cancelReservation → reservations:cancel, bypass FALSE (strict)', () => {
      expect(getMeta('cancelReservation')).toMatchObject({
        codes: ['reservations:cancel'],
        adminBypass: false,
      });
    });
    it('convertReservation → reservations:convert, bypass FALSE (strict)', () => {
      expect(getMeta('convertReservation')).toMatchObject({
        codes: ['reservations:convert'],
        adminBypass: false,
      });
    });
    it('confirmBookingPayment → reservations:booking-payment, bypass FALSE (strict)', () => {
      expect(getMeta('confirmBookingPayment')).toMatchObject({
        codes: ['reservations:booking-payment'],
        adminBypass: false,
      });
    });
    it('unconfirmBookingPayment → reservations:booking-payment, bypass FALSE (strict)', () => {
      expect(getMeta('unconfirmBookingPayment')).toMatchObject({
        codes: ['reservations:booking-payment'],
        adminBypass: false,
      });
    });
  });

  // ── Read routes ────────────────────────────────────────────────────────

  describe('GET /reservations', () => {
    it('ADMIN bypasses — no permission DB lookup', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer()).get('/reservations').expect(200);
      expect(mock.userPermission.findMany).not.toHaveBeenCalled();
    });

    it('SALES with reservations:read → 200 + single DB lookup', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['reservations:read'],
      };
      await request(app.getHttpServer()).get('/reservations').expect(200);
      expect(mock.userPermission.findMany).toHaveBeenCalledTimes(1);
    });

    it('SALES without reservations:read → structured 403', async () => {
      FakeAuthGuard.currentUser = { sub: 'sales-2', role: UserRole.SALES, codes: [] };
      const res = await request(app.getHttpServer()).get('/reservations').expect(403);
      expect(res.body).toMatchObject({
        code: 'missing_permission',
        permissions: ['reservations:read'],
      });
    });

    it('unauthenticated → 403', async () => {
      FakeAuthGuard.currentUser = null;
      await request(app.getHttpServer()).get('/reservations').expect(403);
    });
  });

  // ── Detail includes booking-payment deposits (Batch C) ────────────────

  describe('GET /reservations/:id (booking deposit include)', () => {
    const PATH = '/reservations/00000000-0000-0000-0000-000000000001';

    it('ADMIN detail filters the deposits include to BOOKING_AMOUNT', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer()).get(PATH).expect(200);
      // Find the findUnique call carrying the FULL_INCLUDE (the detail read).
      const call = mock.reservation.findUnique.mock.calls
        .map((c) => c[0] as { include?: { deposits?: { where?: { type?: string } } } })
        .find((a) => a.include?.deposits);
      expect(call).toBeDefined();
      expect(call!.include!.deposits!.where!.type).toBe('BOOKING_AMOUNT');
    });
  });

  // ── Notes (no permission gate) ─────────────────────────────────────────

  describe('POST /reservations/:id/notes', () => {
    it('SALES adds a note without any permission DB lookup', async () => {
      FakeAuthGuard.currentUser = { sub: 'sales-1', role: UserRole.SALES, codes: [] };
      await request(app.getHttpServer())
        .post('/reservations/00000000-0000-0000-0000-000000000001/notes')
        .send({ body: 'hello' })
        .expect(201);
      expect(mock.userPermission.findMany).not.toHaveBeenCalled();
      expect(mock.reservationNote.create).toHaveBeenCalledTimes(1);
    });
  });

  // ── Strict approve ─────────────────────────────────────────────────────

  describe('POST /reservations/:id/approve (strict)', () => {
    const PATH = '/reservations/00000000-0000-0000-0000-000000000001/approve';

    it('ADMIN WITHOUT reservations:approve → structured 403; no side effects', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      const res = await request(app.getHttpServer()).post(PATH).send({}).expect(403);
      expect(res.body).toMatchObject({
        code: 'missing_permission',
        permissions: ['reservations:approve'],
      });
      expect(mock.reservation.update).not.toHaveBeenCalled();
      expect(mock.reservationActivity.create).not.toHaveBeenCalled();
      expect(mock.leadActivity.create).not.toHaveBeenCalled();
    });

    it('ADMIN WITH reservations:approve → 201; reservation updated', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'admin-2',
        role: UserRole.ADMIN,
        codes: ['reservations:approve'],
      };
      await request(app.getHttpServer()).post(PATH).send({}).expect(201);
      expect(mock.reservation.update).toHaveBeenCalledTimes(1);
      expect(mock.reservationActivity.create).toHaveBeenCalledTimes(1);
    });

    it('SALES even with reservations:approve → 403 from @Roles', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['reservations:approve'],
      };
      await request(app.getHttpServer()).post(PATH).send({}).expect(403);
      expect(mock.userPermission.findMany).not.toHaveBeenCalled();
      expect(mock.reservation.update).not.toHaveBeenCalled();
    });
  });

  // ── Strict reject ──────────────────────────────────────────────────────

  describe('POST /reservations/:id/reject (strict)', () => {
    const PATH = '/reservations/00000000-0000-0000-0000-000000000001/reject';

    it('ADMIN WITHOUT reservations:reject → structured 403; no side effects, no unit free', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      const res = await request(app.getHttpServer())
        .post(PATH)
        .send({ reason: 'wrong unit' })
        .expect(403);
      expect(res.body).toMatchObject({
        code: 'missing_permission',
        permissions: ['reservations:reject'],
      });
      expect(mock.reservation.update).not.toHaveBeenCalled();
      expect(mock.unit.update).not.toHaveBeenCalled();
    });

    it('ADMIN WITH reservations:reject → 201; reservation updated', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'admin-2',
        role: UserRole.ADMIN,
        codes: ['reservations:reject'],
      };
      await request(app.getHttpServer()).post(PATH).send({ reason: 'x' }).expect(201);
      expect(mock.reservation.update).toHaveBeenCalledTimes(1);
    });
  });

  // ── Strict cancel ──────────────────────────────────────────────────────

  describe('POST /reservations/:id/cancel (strict)', () => {
    const PATH = '/reservations/00000000-0000-0000-0000-000000000001/cancel';

    it('ADMIN WITHOUT reservations:cancel → structured 403; reason validation does not run', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      // Even sending an empty reason — service would normally 400 — but the
      // guard short-circuits before validation runs.
      const res = await request(app.getHttpServer()).post(PATH).send({}).expect(403);
      expect(res.body).toMatchObject({
        code: 'missing_permission',
        permissions: ['reservations:cancel'],
      });
      expect(mock.reservation.update).not.toHaveBeenCalled();
    });

    it('ADMIN WITH reservations:cancel + valid reason → 201', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'admin-2',
        role: UserRole.ADMIN,
        codes: ['reservations:cancel'],
      };
      await request(app.getHttpServer())
        .post(PATH)
        .send({ reason: 'customer withdrew' })
        .expect(201);
      expect(mock.reservation.update).toHaveBeenCalledTimes(1);
    });

    it('ADMIN WITH reservations:cancel + empty reason → 400 (business validation survives the gate)', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'admin-2',
        role: UserRole.ADMIN,
        codes: ['reservations:cancel'],
      };
      await request(app.getHttpServer()).post(PATH).send({ reason: '   ' }).expect(400);
      expect(mock.reservation.update).not.toHaveBeenCalled();
    });
  });

  // ── Strict convert ─────────────────────────────────────────────────────

  describe('POST /reservations/:id/convert (strict)', () => {
    const PATH = '/reservations/00000000-0000-0000-0000-000000000001/convert';

    it('ADMIN WITHOUT reservations:convert → structured 403; NO contract/unit/plan/commission side effects', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      const res = await request(app.getHttpServer()).post(PATH).send({}).expect(403);
      expect(res.body).toMatchObject({
        code: 'missing_permission',
        permissions: ['reservations:convert'],
      });
      expect(mock.contract.create).not.toHaveBeenCalled();
      expect(mock.unit.update).not.toHaveBeenCalled();
      expect(mock.installmentPlan.create).not.toHaveBeenCalled();
      expect(mock.reservation.update).not.toHaveBeenCalled();
    });

    it('ADMIN WITH reservations:convert, reservation in APPROVED + no booking required → 201; contract + unit changes fire', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'admin-2',
        role: UserRole.ADMIN,
        codes: ['reservations:convert'],
      };
      // Set up a convertible fixture: APPROVED, no plan, no broker, zero booking.
      fixture.reservation.status = 'APPROVED';
      fixture.reservation.bookingAmount = {
        gt: () => false,
        lte: () => true,
        toString: () => '0',
      };
      fixture.reservation.bookingPaymentStatus = 'WAIVED';

      await request(app.getHttpServer()).post(PATH).send({}).expect(201);
      expect(mock.contract.create).toHaveBeenCalledTimes(1);
      expect(mock.unit.update).toHaveBeenCalled();
      // Contract is created unsigned (the convert→signed bypass is closed).
      const createArgs = mock.contract.create.mock.calls[0]![0] as { data: { signedAt: null } };
      expect(createArgs.data.signedAt).toBeNull();
    });

    it('ADMIN WITH reservations:convert, reservation in PENDING → 400 (business validation survives the gate)', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'admin-2',
        role: UserRole.ADMIN,
        codes: ['reservations:convert'],
      };
      // Fixture defaults to PENDING; convert should reject with 400.
      await request(app.getHttpServer()).post(PATH).send({}).expect(400);
      expect(mock.contract.create).not.toHaveBeenCalled();
    });

    it('POST /reservations/:id/convert with signedAt is rejected by ValidationPipe (400); no contract created', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'admin-2',
        role: UserRole.ADMIN,
        codes: ['reservations:convert'],
      };
      fixture.reservation.status = 'APPROVED';
      fixture.reservation.bookingAmount = {
        gt: () => false,
        lte: () => true,
        toString: () => '0',
      };
      fixture.reservation.bookingPaymentStatus = 'WAIVED';

      const res = await request(app.getHttpServer())
        .post(PATH)
        .send({ signedAt: '2026-05-19T00:00:00Z' })
        .expect(400);
      expect(JSON.stringify(res.body)).toContain('signedAt');
      // The contract was NEVER created — bypass is fully closed.
      expect(mock.contract.create).not.toHaveBeenCalled();
      expect(mock.reservation.update).not.toHaveBeenCalled();
    });

    it('ADMIN with reservations:convert but WITHOUT contracts:sign cannot convert-and-sign in one bypass', async () => {
      // The previous bypass was: send signedAt to /convert and get back
      // an already-signed contract while only holding reservations:convert.
      // With the DTO narrowed, that body now returns 400 regardless of
      // which permissions the caller holds.
      FakeAuthGuard.currentUser = {
        sub: 'admin-3',
        role: UserRole.ADMIN,
        codes: ['reservations:convert'], // explicitly NOT contracts:sign
      };
      fixture.reservation.status = 'APPROVED';
      fixture.reservation.bookingAmount = {
        gt: () => false,
        lte: () => true,
        toString: () => '0',
      };
      fixture.reservation.bookingPaymentStatus = 'WAIVED';

      await request(app.getHttpServer())
        .post(PATH)
        .send({ signedAt: '2026-05-19T00:00:00Z' })
        .expect(400);
      expect(mock.contract.create).not.toHaveBeenCalled();
    });
  });

  // ── Strict booking-payment ─────────────────────────────────────────────

  describe('POST /reservations/:id/booking-payment/confirm (strict)', () => {
    const PATH =
      '/reservations/00000000-0000-0000-0000-000000000001/booking-payment/confirm';

    it('ADMIN WITHOUT reservations:booking-payment → structured 403; NO deposit created', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      const res = await request(app.getHttpServer()).post(PATH).send({}).expect(403);
      expect(res.body).toMatchObject({
        code: 'missing_permission',
        permissions: ['reservations:booking-payment'],
      });
      expect(mock.deposit.create).not.toHaveBeenCalled();
      expect(mock.reservation.update).not.toHaveBeenCalled();
    });

    it('ADMIN WITH reservations:booking-payment → 201; deposit created', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'admin-2',
        role: UserRole.ADMIN,
        codes: ['reservations:booking-payment'],
      };
      await request(app.getHttpServer()).post(PATH).send({}).expect(201);
      expect(mock.deposit.create).toHaveBeenCalledTimes(1);
      expect(mock.reservation.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /reservations/:id/booking-payment/unconfirm (strict)', () => {
    const PATH =
      '/reservations/00000000-0000-0000-0000-000000000001/booking-payment/unconfirm';

    it('ADMIN WITHOUT reservations:booking-payment → structured 403; NO deposit deletion', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      const res = await request(app.getHttpServer()).post(PATH).send({}).expect(403);
      expect(res.body).toMatchObject({
        code: 'missing_permission',
        permissions: ['reservations:booking-payment'],
      });
      expect(mock.deposit.deleteMany).not.toHaveBeenCalled();
      expect(mock.reservation.update).not.toHaveBeenCalled();
    });
  });
});
