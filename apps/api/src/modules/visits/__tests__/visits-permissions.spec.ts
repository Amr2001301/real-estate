import { CanActivate, ExecutionContext, Global, INestApplication, Module } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { UserRole } from '@prisma/client';
import { VisitsModule } from '../visits.module';
import { VisitsController } from '../visits.controller';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  PERMISSIONS_KEY,
  type PermissionsMeta,
} from '../../../common/decorators/permissions.decorator';

/**
 * Verifies the visits permissions rollout:
 *   * Per-route metadata across the canonical + new POST status routes.
 *   * ADMIN bypass on every route; SALES grants enable read + the four
 *     appointment status transitions.
 *   * SALES is blocked at @Roles on admin-only routes (request review,
 *     schedule, reschedule, assign) regardless of permission grants.
 *   * Legacy PATCH /visits/appointments/:id/status returns 404 (removed).
 *   * Business validation (state-machine) still runs after permission passes.
 *
 * The legacy /visit-requests routes live in `requests.module.ts` (not
 * exercised here — verified via a separate metadata-only assertion path is
 * unnecessary because that controller is in a different module).
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

const fixture: {
  appointment: {
    id: string;
    visitNumber: string;
    status: 'SCHEDULED' | 'CONFIRMED' | 'PENDING_RESCHEDULE' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW' | 'RESCHEDULED';
    assignedSalesId: string | null;
    leadId: string | null;
    visitRequestId: string | null;
    scheduledAt: Date;
    salesNotes: string | null;
    resultNotes: string | null;
    cancellationReason: string | null;
    noShowReason: string | null;
    customerFeedback: string | null;
  };
} = {
  appointment: {
    id: 'a1111111-1111-4111-8111-111111111111',
    visitNumber: 'V-0001',
    status: 'SCHEDULED',
    assignedSalesId: null,
    leadId: 'lead-1',
    visitRequestId: 'b2222222-2222-4222-8222-222222222222',
    // Default: 1h in the future. Per-transition tests override this when they
    // need a past time (e.g. NO_SHOW happy path).
    scheduledAt: new Date(Date.now() + 60 * 60 * 1000),
    salesNotes: null,
    resultNotes: null,
    cancellationReason: null,
    noShowReason: null,
    customerFeedback: null,
  },
};

function makePrismaMock() {
  const m = {
    userPermission: {
      findMany: jest.fn().mockImplementation(async () => {
        const u = FakeAuthGuard.currentUser;
        return (u?.codes ?? []).map((code) => ({ permission: { code } }));
      }),
    },
    visitRequest: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'b2222222-2222-4222-8222-222222222222',
        requestNumber: 'R-0001',
        customerName: 'Customer',
        customerPhone: '0500000000',
        customerEmail: null,
        requestStatus: 'NEW',
        assignedSalesId: null,
        leadId: 'lead-1',
      }),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn().mockImplementation(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => ({
        id: where.id,
        ...data,
      })),
      create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'req-new',
        requestNumber: 'R-NEW',
        ...data,
      })),
    },
    visitAppointment: {
      findUnique: jest.fn().mockImplementation(async () => ({ ...fixture.appointment })),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'appt-new',
        visitNumber: 'V-NEW',
        ...data,
      })),
      update: jest.fn().mockImplementation(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => ({
        ...fixture.appointment,
        ...data,
        id: where.id,
      })),
    },
    visitActivity: { create: jest.fn().mockResolvedValue({}) },
    user: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'sales-1',
        role: 'SALES',
        fullName: 'Sales User',
      }),
    },
    lead: {
      findUnique: jest.fn().mockResolvedValue({ id: 'lead-1' }),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    leadActivity: { create: jest.fn().mockResolvedValue({}) },
    project: { findUnique: jest.fn().mockResolvedValue({ id: 'project-1', status: 'PUBLISHED' }) },
    unit: { findUnique: jest.fn().mockResolvedValue({ id: 'unit-1' }) },
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

describe('Visits module · permissions enforcement', () => {
  let app: INestApplication;
  let mock: ReturnType<typeof makePrismaMock>;
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
      imports: [MockPrismaModule, VisitsModule],
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
    mock.userPermission.findMany.mockClear();
    mock.visitRequest.update.mockClear();
    mock.visitAppointment.update.mockClear();
    mock.visitAppointment.create.mockClear();
    mock.visitActivity.create.mockClear();
    // Reset fixture (SCHEDULED, unassigned, so SALES is blocked by service
    // scope unless tests set assignedSalesId to caller's id).
    fixture.appointment = {
      id: 'a1111111-1111-4111-8111-111111111111',
      visitNumber: 'V-0001',
      status: 'SCHEDULED',
      assignedSalesId: null,
      leadId: 'lead-1',
      visitRequestId: 'b2222222-2222-4222-8222-222222222222',
      scheduledAt: new Date(Date.now() + 60 * 60 * 1000),
      salesNotes: null,
      resultNotes: null,
      cancellationReason: null,
      noShowReason: null,
      customerFeedback: null,
    };
  });

  // ── Metadata ───────────────────────────────────────────────────────────

  describe('@Permissions metadata', () => {
    const proto = VisitsController.prototype as unknown as Record<
      string,
      (...a: unknown[]) => unknown
    >;
    function getMeta(method: string): PermissionsMeta | undefined {
      return reflector.get<PermissionsMeta | undefined>(PERMISSIONS_KEY, proto[method]!);
    }

    it.each<[string]>([
      ['stats'],
      ['listRequests'],
      ['getRequest'],
      ['listAppointments'],
      ['getAppointment'],
    ])('%s → visits:read, bypass true', (method) => {
      expect(getMeta(method)).toMatchObject({ codes: ['visits:read'], adminBypass: true });
    });

    it('updateRequest → visits:approve, bypass true', () => {
      expect(getMeta('updateRequest')).toMatchObject({
        codes: ['visits:approve'],
        adminBypass: true,
      });
    });
    it('scheduleVisit → visits:schedule, bypass true', () => {
      expect(getMeta('scheduleVisit')).toMatchObject({
        codes: ['visits:schedule'],
        adminBypass: true,
      });
    });
    it('createDirect → visits:create, bypass true', () => {
      expect(getMeta('createDirect')).toMatchObject({
        codes: ['visits:create'],
        adminBypass: true,
      });
    });
    it('confirmAppointment → visits:confirm, bypass true', () => {
      expect(getMeta('confirmAppointment')).toMatchObject({
        codes: ['visits:confirm'],
        adminBypass: true,
      });
    });
    it('completeAppointment → visits:complete, bypass true', () => {
      expect(getMeta('completeAppointment')).toMatchObject({
        codes: ['visits:complete'],
        adminBypass: true,
      });
    });
    it('cancelAppointment → visits:cancel, bypass true', () => {
      expect(getMeta('cancelAppointment')).toMatchObject({
        codes: ['visits:cancel'],
        adminBypass: true,
      });
    });
    it('noShowAppointment → visits:no-show, bypass true', () => {
      expect(getMeta('noShowAppointment')).toMatchObject({
        codes: ['visits:no-show'],
        adminBypass: true,
      });
    });
    it('reschedule → visits:reschedule, bypass true', () => {
      expect(getMeta('reschedule')).toMatchObject({
        codes: ['visits:reschedule'],
        adminBypass: true,
      });
    });
    it('assign → visits:assign, bypass true', () => {
      expect(getMeta('assign')).toMatchObject({
        codes: ['visits:assign'],
        adminBypass: true,
      });
    });

    it('legacy `updateStatus` handler is absent', () => {
      expect(proto.updateStatus).toBeUndefined();
    });
  });

  // ── Read routes ────────────────────────────────────────────────────────

  describe('Read routes', () => {
    it('ADMIN bypasses GET /visits/appointments — no permission DB lookup', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer()).get('/visits/appointments').expect(200);
      expect(mock.userPermission.findMany).not.toHaveBeenCalled();
    });

    it('SALES with visits:read → 200', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['visits:read'],
      };
      await request(app.getHttpServer()).get('/visits/appointments').expect(200);
      expect(mock.userPermission.findMany).toHaveBeenCalledTimes(1);
    });

    it('SALES without visits:read → structured 403', async () => {
      FakeAuthGuard.currentUser = { sub: 'sales-2', role: UserRole.SALES, codes: [] };
      const res = await request(app.getHttpServer()).get('/visits/appointments').expect(403);
      expect(res.body).toMatchObject({
        code: 'missing_permission',
        permissions: ['visits:read'],
      });
    });

    it('unauthenticated → 403', async () => {
      FakeAuthGuard.currentUser = null;
      await request(app.getHttpServer()).get('/visits/appointments').expect(403);
    });
  });

  // ── Visit request actions (admin-only at @Roles) ───────────────────────

  describe('Visit request actions', () => {
    const REQ = '/visits/requests/b2222222-2222-4222-8222-222222222222';

    it('ADMIN bypasses PATCH /visits/requests/:id', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer())
        .patch(REQ)
        .send({ status: 'UNDER_REVIEW' })
        .expect(200);
      expect(mock.visitRequest.update).toHaveBeenCalled();
    });

    it('SALES even with visits:approve → 403 from @Roles (route is ADMIN-only)', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['visits:approve'],
      };
      const res = await request(app.getHttpServer())
        .patch(REQ)
        .send({ status: 'UNDER_REVIEW' })
        .expect(403);
      expect(res.body.message).toBe('Insufficient role');
      expect(mock.userPermission.findMany).not.toHaveBeenCalled();
    });

    it('SALES even with visits:schedule → 403 from @Roles on /schedule (ADMIN-only)', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['visits:schedule'],
      };
      await request(app.getHttpServer())
        .post(`${REQ}/schedule`)
        .send({ scheduledAt: '2099-05-19T10:00:00Z', assignedSalesId: 'sales-1' })
        .expect(403);
      expect(mock.userPermission.findMany).not.toHaveBeenCalled();
    });
  });

  // ── Appointment creation ───────────────────────────────────────────────

  describe('POST /visits/appointments', () => {
    const BODY = {
      projectId: 'a1111111-1111-4111-8111-111111111111',
      scheduledAt: '2099-05-19T10:00:00Z',
      // Walk-in path — required by service when no leadId/clientId.
      customerName: 'Walk-in Customer',
      customerPhone: '0500000000',
    };

    it('SALES with visits:create can create direct appointment', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['visits:create'],
      };
      await request(app.getHttpServer())
        .post('/visits/appointments')
        .send(BODY)
        .expect(201);
      expect(mock.visitAppointment.create).toHaveBeenCalled();
    });

    it('SALES without visits:create → structured 403', async () => {
      FakeAuthGuard.currentUser = { sub: 'sales-2', role: UserRole.SALES, codes: [] };
      const res = await request(app.getHttpServer())
        .post('/visits/appointments')
        .send(BODY)
        .expect(403);
      expect(res.body).toMatchObject({
        code: 'missing_permission',
        permissions: ['visits:create'],
      });
      expect(mock.visitAppointment.create).not.toHaveBeenCalled();
    });
  });

  // ── Appointment status routes (new) ────────────────────────────────────

  describe.each<[string, string, string]>([
    ['confirm', 'visits:confirm', 'CONFIRMED'],
    ['complete', 'visits:complete', 'COMPLETED'],
    ['cancel', 'visits:cancel', 'CANCELLED'],
    ['no-show', 'visits:no-show', 'NO_SHOW'],
  ])('POST /visits/appointments/:id/%s', (action, code, status) => {
    const PATH = `/visits/appointments/a1111111-1111-4111-8111-111111111111/${action}`;

    // P2 guards: COMPLETED requires CONFIRMED first, NO_SHOW requires the
    // visit's scheduledAt to be in the past. Seed the fixture per action so
    // each happy-path test exercises a legal transition.
    function seedHappyPathFixture() {
      if (status === 'COMPLETED') fixture.appointment.status = 'CONFIRMED';
      if (status === 'NO_SHOW') {
        fixture.appointment.status = 'CONFIRMED';
        fixture.appointment.scheduledAt = new Date(Date.now() - 60 * 60 * 1000);
      }
    }

    it(`ADMIN bypasses → 201; appointment updated with status=${status}`, async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      seedHappyPathFixture();
      await request(app.getHttpServer()).post(PATH).send({}).expect(201);
      const call = mock.visitAppointment.update.mock.calls[0]![0] as {
        data: { status: string };
      };
      expect(call.data.status).toBe(status);
      expect(mock.visitActivity.create).toHaveBeenCalledTimes(1);
    });

    it(`SALES with ${code} (and assigned to appointment) can call`, async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: [code],
      };
      seedHappyPathFixture();
      fixture.appointment.assignedSalesId = 'sales-1';
      await request(app.getHttpServer()).post(PATH).send({}).expect(201);
      expect(mock.visitAppointment.update).toHaveBeenCalled();
    });

    it(`SALES without ${code} → structured 403; appointment NOT updated; activity NOT created`, async () => {
      FakeAuthGuard.currentUser = { sub: 'sales-2', role: UserRole.SALES, codes: [] };
      const res = await request(app.getHttpServer()).post(PATH).send({}).expect(403);
      expect(res.body).toMatchObject({
        code: 'missing_permission',
        permissions: [code],
      });
      expect(mock.visitAppointment.update).not.toHaveBeenCalled();
      expect(mock.visitActivity.create).not.toHaveBeenCalled();
    });
  });

  // ── Business validation survives the permission gate ───────────────────

  describe('Appointment status — business validation', () => {
    it('ADMIN bypass + confirm on a CANCELLED appointment → 400 (state-machine survives the gate)', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      fixture.appointment.status = 'CANCELLED'; // FINAL — cannot be re-transitioned
      await request(app.getHttpServer())
        .post('/visits/appointments/a1111111-1111-4111-8111-111111111111/confirm')
        .send({})
        .expect(400);
      expect(mock.visitAppointment.update).not.toHaveBeenCalled();
    });
  });

  // ── Admin-only appointment actions ─────────────────────────────────────

  describe('Admin-only appointment actions (reschedule / assign)', () => {
    it('SALES with visits:reschedule → 403 from @Roles', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['visits:reschedule'],
      };
      await request(app.getHttpServer())
        .post('/visits/appointments/a1111111-1111-4111-8111-111111111111/reschedule')
        .send({ scheduledAt: '2099-06-01T10:00:00Z' })
        .expect(403);
      expect(mock.userPermission.findMany).not.toHaveBeenCalled();
    });

    it('SALES with visits:assign → 403 from @Roles', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['visits:assign'],
      };
      await request(app.getHttpServer())
        .patch('/visits/appointments/a1111111-1111-4111-8111-111111111111/assign')
        .send({ assignedSalesId: 'sales-2' })
        .expect(403);
      expect(mock.userPermission.findMany).not.toHaveBeenCalled();
    });
  });

  // ── Legacy PATCH /:id/status — removed ────────────────────────────────

  describe('Legacy PATCH /visits/appointments/:id/status', () => {
    it('returns 404 (route removed)', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer())
        .patch('/visits/appointments/a1111111-1111-4111-8111-111111111111/status')
        .send({ status: 'CONFIRMED' })
        .expect(404);
      expect(mock.visitAppointment.update).not.toHaveBeenCalled();
    });
  });
});
