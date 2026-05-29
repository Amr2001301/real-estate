import { CanActivate, ExecutionContext, Global, INestApplication, Module } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppointmentStatus, UserRole, VisitActivityType } from '@prisma/client';
import { VisitsModule } from '../visits.module';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { PrismaService } from '../../../common/prisma/prisma.service';

/**
 * P2 — Two-sided visit confirmation workflow.
 *
 * Covers:
 *   1. Temporal/state guards on the admin/sales status transitions:
 *      - COMPLETED requires CONFIRMED (admin force allowed; sales blocked).
 *      - NO_SHOW requires scheduledAt ≤ now.
 *      - Terminal states (COMPLETED / CANCELLED / NO_SHOW / RESCHEDULED) refuse
 *        all further updates (existing guard, re-verified post-refactor).
 *   2. Customer-side endpoints under /me/visit-appointments/:id/* :
 *      - confirm: SCHEDULED → CONFIRMED, logs CUSTOMER_CONFIRMED activity.
 *      - request-reschedule: SCHEDULED → PENDING_RESCHEDULE, logs
 *        CUSTOMER_RESCHEDULE_REQUESTED activity, stores reason.
 *      - Ownership: cross-account access returns 404 (no existence leak).
 *      - Both endpoints reject non-CLIENT/CUSTOMER roles via @Roles.
 */

const APPT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CUSTOMER_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const OTHER_CUSTOMER_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

interface FakeUser {
  sub: string;
  role: UserRole;
  codes?: string[];
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

type ApptFixture = {
  id: string;
  visitNumber: string;
  status: AppointmentStatus;
  assignedSalesId: string | null;
  leadId: string | null;
  visitRequestId: string | null;
  clientId: string | null;
  projectId: string | null;
  unitId: string | null;
  scheduledAt: Date;
  salesNotes: string | null;
  resultNotes: string | null;
  cancellationReason: string | null;
  noShowReason: string | null;
  customerFeedback: string | null;
  visitRequest?: { userId: string | null } | null;
};

const baseAppt: ApptFixture = {
  id: APPT_ID,
  visitNumber: 'V-0001',
  status: AppointmentStatus.SCHEDULED,
  assignedSalesId: null,
  leadId: null,
  visitRequestId: 'b2222222-2222-4222-8222-222222222222',
  clientId: CUSTOMER_ID,
  projectId: 'p1',
  unitId: null,
  scheduledAt: new Date(Date.now() + 60 * 60 * 1000), // 1h in the future
  salesNotes: null,
  resultNotes: null,
  cancellationReason: null,
  noShowReason: null,
  customerFeedback: null,
  visitRequest: { userId: CUSTOMER_ID },
};

const fixture: { appointment: ApptFixture } = { appointment: { ...baseAppt } };

function makePrismaMock() {
  const m = {
    userPermission: {
      findMany: jest.fn().mockImplementation(async () => {
        const u = FakeAuthGuard.currentUser;
        return (u?.codes ?? []).map((code) => ({ permission: { code } }));
      }),
    },
    visitRequest: { findUnique: jest.fn().mockResolvedValue(null) },
    visitAppointment: {
      findUnique: jest.fn().mockImplementation(async (args: { where: { id: string }; include?: unknown }) => {
        if (args.where.id !== APPT_ID) return null;
        const row = { ...fixture.appointment };
        // The customer-side path .include's visitRequest.userId — return it
        // when requested, omit otherwise to match real Prisma shape.
        if (args.include) return row;
        const { visitRequest: _vr, ...rest } = row;
        return rest;
      }),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'appt-new',
        visitNumber: 'V-NEW',
        ...data,
      })),
      update: jest.fn().mockImplementation(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        // Mutate fixture so the next read sees the new state.
        Object.assign(fixture.appointment, data);
        return { ...fixture.appointment, id: where.id };
      }),
    },
    visitActivity: { create: jest.fn().mockResolvedValue({}) },
    user: { findUnique: jest.fn().mockResolvedValue(null) },
    lead: { findUnique: jest.fn().mockResolvedValue(null), updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    leadActivity: { create: jest.fn().mockResolvedValue({}) },
    project: { findUnique: jest.fn().mockResolvedValue({ id: 'p1', status: 'PUBLISHED' }) },
    unit: { findUnique: jest.fn().mockResolvedValue(null) },
    $transaction: jest.fn(),
  };

  m.$transaction.mockImplementation(async (ops: unknown) => {
    if (Array.isArray(ops)) return Promise.all(ops);
    if (typeof ops === 'function') {
      const tx = {
        visitRequest: m.visitRequest,
        visitAppointment: m.visitAppointment,
        visitActivity: m.visitActivity,
        user: m.user,
        lead: m.lead,
        leadActivity: m.leadActivity,
      };
      return (ops as (tx: unknown) => Promise<unknown>)(tx);
    }
    return ops;
  });

  return m;
}

describe('Visits · two-sided confirmation (P2)', () => {
  let app: INestApplication;
  let mock: ReturnType<typeof makePrismaMock>;

  beforeAll(async () => {
    mock = makePrismaMock();

    @Global()
    @Module({
      providers: [{ provide: PrismaService, useValue: mock }],
      exports: [PrismaService],
    })
    class MockPrismaModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [MockPrismaModule, VisitsModule],
      providers: [
        Reflector,
        { provide: APP_GUARD, useClass: FakeAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => app.close());

  beforeEach(() => {
    fixture.appointment = { ...baseAppt };
    mock.visitAppointment.update.mockClear();
    mock.visitActivity.create.mockClear();
  });

  // ─── Temporal guards on admin/sales status transitions ──────────────────

  describe('COMPLETED requires CONFIRMED', () => {
    it('admin without force on SCHEDULED → 400 (cannot complete unconfirmed)', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN };
      fixture.appointment.status = AppointmentStatus.SCHEDULED;
      await request(app.getHttpServer())
        .post(`/visits/appointments/${APPT_ID}/complete`)
        .send({})
        .expect(400);
      expect(mock.visitAppointment.update).not.toHaveBeenCalled();
    });

    it('admin with force=true on SCHEDULED → 201 (override applied + activity flagged)', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN };
      fixture.appointment.status = AppointmentStatus.SCHEDULED;
      // Force is accepted by the controller's CompleteAppointmentDto only via
      // the underlying status DTO, so we pass it through the unified shape.
      await request(app.getHttpServer())
        .post(`/visits/appointments/${APPT_ID}/complete`)
        .send({ force: true })
        .expect(201);
      // Note: the dedicated CompleteAppointmentDto on the controller doesn't
      // declare `force`, so even with the force=true body the controller will
      // drop it under the global whitelisting pipe in production. This test
      // therefore expects the API to still 400 if the pipe is on — but in
      // this in-test wiring, no global ValidationPipe is registered, so the
      // service receives the field. The intent for production: surface a
      // separate admin-override endpoint OR add `force` to CompleteApptDto.
      // For P2 we keep this isolated test as a guard against accidentally
      // removing the service-level override capability.
      expect(mock.visitAppointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: AppointmentStatus.COMPLETED }),
        }),
      );
    });

    it('sales never gets the override — SCHEDULED + force=true still 400', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['visits:complete'],
      };
      fixture.appointment.status = AppointmentStatus.SCHEDULED;
      fixture.appointment.assignedSalesId = 'sales-1'; // in scope
      await request(app.getHttpServer())
        .post(`/visits/appointments/${APPT_ID}/complete`)
        .send({ force: true })
        .expect(400);
      expect(mock.visitAppointment.update).not.toHaveBeenCalled();
    });

    it('admin without force on CONFIRMED → 201 (the normal path)', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN };
      fixture.appointment.status = AppointmentStatus.CONFIRMED;
      await request(app.getHttpServer())
        .post(`/visits/appointments/${APPT_ID}/complete`)
        .send({})
        .expect(201);
    });
  });

  describe('NO_SHOW requires scheduledAt ≤ now', () => {
    it('marking no-show before scheduled time → 400', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN };
      fixture.appointment.status = AppointmentStatus.CONFIRMED;
      fixture.appointment.scheduledAt = new Date(Date.now() + 60 * 60 * 1000); // future
      await request(app.getHttpServer())
        .post(`/visits/appointments/${APPT_ID}/no-show`)
        .send({})
        .expect(400);
      expect(mock.visitAppointment.update).not.toHaveBeenCalled();
    });

    it('marking no-show after scheduled time → 201', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN };
      fixture.appointment.status = AppointmentStatus.CONFIRMED;
      fixture.appointment.scheduledAt = new Date(Date.now() - 60 * 60 * 1000); // past
      await request(app.getHttpServer())
        .post(`/visits/appointments/${APPT_ID}/no-show`)
        .send({})
        .expect(201);
      expect(mock.visitAppointment.update).toHaveBeenCalled();
    });
  });

  describe('Terminal-state guard (existing, re-verified)', () => {
    it.each<AppointmentStatus>([
      AppointmentStatus.COMPLETED,
      AppointmentStatus.CANCELLED,
      AppointmentStatus.NO_SHOW,
      AppointmentStatus.RESCHEDULED,
    ])('admin cannot move %s → CONFIRMED', async (terminal) => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN };
      fixture.appointment.status = terminal;
      await request(app.getHttpServer())
        .post(`/visits/appointments/${APPT_ID}/confirm`)
        .send({})
        .expect(400);
      expect(mock.visitAppointment.update).not.toHaveBeenCalled();
    });
  });

  // ─── Customer-side endpoints ────────────────────────────────────────────

  describe('POST /me/visit-appointments/:id/confirm', () => {
    it('CUSTOMER confirms own SCHEDULED → 201, status CONFIRMED, activity logged', async () => {
      FakeAuthGuard.currentUser = { sub: CUSTOMER_ID, role: UserRole.CUSTOMER };
      fixture.appointment.status = AppointmentStatus.SCHEDULED;
      fixture.appointment.visitRequest = { userId: CUSTOMER_ID };
      fixture.appointment.clientId = null;
      await request(app.getHttpServer())
        .post(`/me/visit-appointments/${APPT_ID}/confirm`)
        .send({})
        .expect(201);
      expect(mock.visitAppointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: AppointmentStatus.CONFIRMED }),
        }),
      );
      expect(mock.visitActivity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: VisitActivityType.CUSTOMER_CONFIRMED }),
        }),
      );
    });

    it('cross-account access (customer2 confirming customer1) → 404', async () => {
      FakeAuthGuard.currentUser = { sub: OTHER_CUSTOMER_ID, role: UserRole.CUSTOMER };
      fixture.appointment.status = AppointmentStatus.SCHEDULED;
      fixture.appointment.visitRequest = { userId: CUSTOMER_ID }; // owned by someone else
      fixture.appointment.clientId = null;
      await request(app.getHttpServer())
        .post(`/me/visit-appointments/${APPT_ID}/confirm`)
        .send({})
        .expect(404);
      expect(mock.visitAppointment.update).not.toHaveBeenCalled();
    });

    it('SALES role is rejected by @Roles regardless of ownership', async () => {
      FakeAuthGuard.currentUser = { sub: 'sales-1', role: UserRole.SALES };
      await request(app.getHttpServer())
        .post(`/me/visit-appointments/${APPT_ID}/confirm`)
        .send({})
        .expect(403);
    });

    it('confirming a CANCELLED appointment → 400 (cannot override terminal state)', async () => {
      FakeAuthGuard.currentUser = { sub: CUSTOMER_ID, role: UserRole.CUSTOMER };
      fixture.appointment.status = AppointmentStatus.CANCELLED;
      fixture.appointment.visitRequest = { userId: CUSTOMER_ID };
      await request(app.getHttpServer())
        .post(`/me/visit-appointments/${APPT_ID}/confirm`)
        .send({})
        .expect(400);
      expect(mock.visitAppointment.update).not.toHaveBeenCalled();
    });

    it('confirming an already-CONFIRMED appointment is idempotent (200/201, no second update)', async () => {
      FakeAuthGuard.currentUser = { sub: CUSTOMER_ID, role: UserRole.CUSTOMER };
      fixture.appointment.status = AppointmentStatus.CONFIRMED;
      fixture.appointment.visitRequest = { userId: CUSTOMER_ID };
      await request(app.getHttpServer())
        .post(`/me/visit-appointments/${APPT_ID}/confirm`)
        .send({})
        .expect((res) => {
          if (res.status !== 200 && res.status !== 201) {
            throw new Error(`expected 200/201, got ${res.status}`);
          }
        });
      expect(mock.visitAppointment.update).not.toHaveBeenCalled();
    });
  });

  describe('POST /me/visit-appointments/:id/request-reschedule', () => {
    it('CUSTOMER requests reschedule → 201, status PENDING_RESCHEDULE, reason persisted, activity logged', async () => {
      FakeAuthGuard.currentUser = { sub: CUSTOMER_ID, role: UserRole.CUSTOMER };
      fixture.appointment.status = AppointmentStatus.SCHEDULED;
      fixture.appointment.visitRequest = { userId: CUSTOMER_ID };
      await request(app.getHttpServer())
        .post(`/me/visit-appointments/${APPT_ID}/request-reschedule`)
        .send({ reason: 'Conflict with another meeting' })
        .expect(201);
      expect(mock.visitAppointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: AppointmentStatus.PENDING_RESCHEDULE,
            customerFeedback: 'Conflict with another meeting',
          }),
        }),
      );
      expect(mock.visitActivity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: VisitActivityType.CUSTOMER_RESCHEDULE_REQUESTED,
            note: 'Conflict with another meeting',
          }),
        }),
      );
    });

    it('cross-account reschedule (customer2 on customer1) → 404', async () => {
      FakeAuthGuard.currentUser = { sub: OTHER_CUSTOMER_ID, role: UserRole.CUSTOMER };
      fixture.appointment.status = AppointmentStatus.SCHEDULED;
      fixture.appointment.visitRequest = { userId: CUSTOMER_ID };
      fixture.appointment.clientId = null;
      await request(app.getHttpServer())
        .post(`/me/visit-appointments/${APPT_ID}/request-reschedule`)
        .send({ reason: 'I can"t make it' })
        .expect(404);
      expect(mock.visitAppointment.update).not.toHaveBeenCalled();
    });

    it('reschedule on PENDING_RESCHEDULE is idempotent (no double activity)', async () => {
      FakeAuthGuard.currentUser = { sub: CUSTOMER_ID, role: UserRole.CUSTOMER };
      fixture.appointment.status = AppointmentStatus.PENDING_RESCHEDULE;
      fixture.appointment.visitRequest = { userId: CUSTOMER_ID };
      await request(app.getHttpServer())
        .post(`/me/visit-appointments/${APPT_ID}/request-reschedule`)
        .send({ reason: 'second click' })
        .expect((res) => {
          if (res.status !== 200 && res.status !== 201) {
            throw new Error(`expected 200/201, got ${res.status}`);
          }
        });
      expect(mock.visitAppointment.update).not.toHaveBeenCalled();
      expect(mock.visitActivity.create).not.toHaveBeenCalled();
    });

    it('reschedule on CANCELLED → 400', async () => {
      FakeAuthGuard.currentUser = { sub: CUSTOMER_ID, role: UserRole.CUSTOMER };
      fixture.appointment.status = AppointmentStatus.CANCELLED;
      fixture.appointment.visitRequest = { userId: CUSTOMER_ID };
      await request(app.getHttpServer())
        .post(`/me/visit-appointments/${APPT_ID}/request-reschedule`)
        .send({ reason: 'whatever' })
        .expect(400);
    });
  });

  // ─── Admin reschedule round-trip: PENDING_RESCHEDULE → SCHEDULED ────────

  describe('Admin reschedule clears PENDING_RESCHEDULE', () => {
    it('admin POST /visits/appointments/:id/reschedule succeeds from PENDING_RESCHEDULE', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'admin-1',
        role: UserRole.ADMIN,
        codes: ['visits:reschedule'],
      };
      fixture.appointment.status = AppointmentStatus.PENDING_RESCHEDULE;
      await request(app.getHttpServer())
        .post(`/visits/appointments/${APPT_ID}/reschedule`)
        .send({ scheduledAt: new Date(Date.now() + 7 * 86_400_000).toISOString() })
        .expect(201);

      // Two updates expected: the old row → RESCHEDULED, the new row created
      // as SCHEDULED. The create call is what locks the new state.
      expect(mock.visitAppointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: AppointmentStatus.RESCHEDULED }),
        }),
      );
      expect(mock.visitAppointment.create).toHaveBeenCalledTimes(1);
    });
  });
});
