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
import { AppointmentStatus, UserRole } from '@prisma/client';
import { VisitsModule } from '../visits.module';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { PrismaService } from '../../../common/prisma/prisma.service';

/**
 * Gap 7 — visit feedback/ratings.
 *   Customer: POST /me/visit-appointments/:id/feedback
 *     - allowed only after COMPLETED, one-time, owner-only, rating 1–5.
 *   Sales:    POST /visits/appointments/:id/sales-feedback
 *     - allowed only after COMPLETED, assigned-scope, rating optional but a
 *       fully-empty submission is rejected.
 * Real VisitsService runs against a mocked PrismaService; the dedicated columns
 * are asserted on the update payloads.
 */

const APPT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CUSTOMER_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const OTHER_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const SALES_ID = 'ssssssss-ssss-4sss-8sss-ssssssssssss';

class FakeAuthGuard implements CanActivate {
  static currentUser: { sub: string; role: UserRole; codes?: string[] } | null = null;
  canActivate(context: ExecutionContext): boolean {
    if (!FakeAuthGuard.currentUser) return false;
    const req = context.switchToHttp().getRequest();
    req.user = { sub: FakeAuthGuard.currentUser.sub, role: FakeAuthGuard.currentUser.role };
    return true;
  }
}

type Appt = Record<string, unknown>;
const baseAppt = (): Appt => ({
  id: APPT_ID,
  visitNumber: 'V-1',
  status: AppointmentStatus.COMPLETED,
  assignedSalesId: SALES_ID,
  leadId: null,
  visitRequestId: 'b2222222-2222-4222-8222-222222222222',
  clientId: CUSTOMER_ID,
  projectId: 'p1',
  unitId: null,
  scheduledAt: new Date(Date.now() - 60 * 60 * 1000),
  customerRating: null,
  customerRatingText: null,
  customerRatingSubmittedAt: null,
  salesRating: null,
  salesRatingText: null,
  salesRatingSubmittedAt: null,
  visitRequest: { userId: CUSTOMER_ID },
});

const fixture: { appt: Appt } = { appt: baseAppt() };

function makePrismaMock() {
  const m = {
    userPermission: {
      findMany: jest.fn().mockImplementation(async () =>
        (FakeAuthGuard.currentUser?.codes ?? []).map((code) => ({ permission: { code } })),
      ),
    },
    visitAppointment: {
      findUnique: jest.fn().mockImplementation(async (args: { where: { id: string } }) =>
        args.where.id === APPT_ID ? { ...fixture.appt } : null,
      ),
      update: jest.fn().mockImplementation(async ({ where, data }: { where: { id: string }; data: Appt }) => {
        Object.assign(fixture.appt, data);
        return { ...fixture.appt, id: where.id };
      }),
    },
    visitActivity: { create: jest.fn().mockResolvedValue({}) },
    user: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn(),
  };
  m.$transaction.mockImplementation(async (ops: unknown) => {
    if (Array.isArray(ops)) return Promise.all(ops);
    if (typeof ops === 'function') {
      const tx = { visitAppointment: m.visitAppointment, visitActivity: m.visitActivity };
      return (ops as (tx: unknown) => Promise<unknown>)(tx);
    }
    return ops;
  });
  return m;
}

let mock = makePrismaMock();

describe('Visits · feedback/ratings (Gap 7)', () => {
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
      imports: [MockPrismaModule, ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), VisitsModule],
      providers: [
        { provide: APP_GUARD, useClass: FakeAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
  });

  afterAll(async () => app.close());

  beforeEach(() => {
    fixture.appt = baseAppt();
    mock.visitAppointment.update.mockClear();
    mock.visitActivity.create.mockClear();
  });

  // ── Customer feedback ────────────────────────────────────────────────────

  it('customer submits a rating on a COMPLETED visit → 201, writes dedicated columns', async () => {
    FakeAuthGuard.currentUser = { sub: CUSTOMER_ID, role: UserRole.CUSTOMER };
    await request(app.getHttpServer())
      .post(`/me/visit-appointments/${APPT_ID}/feedback`)
      .send({ rating: 5, comment: 'تجربة ممتازة' })
      .expect(201);
    const data = mock.visitAppointment.update.mock.calls[0]![0].data;
    expect(data.customerRating).toBe(5);
    expect(data.customerRatingText).toBe('تجربة ممتازة');
    expect(data.customerRatingSubmittedAt).toBeInstanceOf(Date);
    // Sales columns are untouched.
    expect(data.salesRating).toBeUndefined();
  });

  it('rejects customer feedback before completion (400)', async () => {
    FakeAuthGuard.currentUser = { sub: CUSTOMER_ID, role: UserRole.CUSTOMER };
    fixture.appt.status = AppointmentStatus.SCHEDULED;
    await request(app.getHttpServer())
      .post(`/me/visit-appointments/${APPT_ID}/feedback`)
      .send({ rating: 4 })
      .expect(400);
    expect(mock.visitAppointment.update).not.toHaveBeenCalled();
  });

  it("returns 404 for another customer's visit (no existence leak)", async () => {
    FakeAuthGuard.currentUser = { sub: OTHER_ID, role: UserRole.CUSTOMER };
    fixture.appt.clientId = CUSTOMER_ID;
    fixture.appt.visitRequest = { userId: CUSTOMER_ID };
    await request(app.getHttpServer())
      .post(`/me/visit-appointments/${APPT_ID}/feedback`)
      .send({ rating: 4 })
      .expect(404);
    expect(mock.visitAppointment.update).not.toHaveBeenCalled();
  });

  it('rejects a second submission (one-time, 400)', async () => {
    FakeAuthGuard.currentUser = { sub: CUSTOMER_ID, role: UserRole.CUSTOMER };
    fixture.appt.customerRatingSubmittedAt = new Date();
    await request(app.getHttpServer())
      .post(`/me/visit-appointments/${APPT_ID}/feedback`)
      .send({ rating: 4 })
      .expect(400);
    expect(mock.visitAppointment.update).not.toHaveBeenCalled();
  });

  it('rejects rating outside 1–5 (400 via validation)', async () => {
    FakeAuthGuard.currentUser = { sub: CUSTOMER_ID, role: UserRole.CUSTOMER };
    await request(app.getHttpServer())
      .post(`/me/visit-appointments/${APPT_ID}/feedback`)
      .send({ rating: 6 })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/me/visit-appointments/${APPT_ID}/feedback`)
      .send({ rating: 0 })
      .expect(400);
  });

  it('blocks non-customer roles via @Roles (403)', async () => {
    FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN };
    await request(app.getHttpServer())
      .post(`/me/visit-appointments/${APPT_ID}/feedback`)
      .send({ rating: 5 })
      .expect(403);
  });

  // ── Sales feedback ─────────────────────────────────────────────────────────

  it('assigned sales submits feedback on a COMPLETED visit → 201', async () => {
    FakeAuthGuard.currentUser = { sub: SALES_ID, role: UserRole.SALES, codes: ['visits:complete'] };
    await request(app.getHttpServer())
      .post(`/visits/appointments/${APPT_ID}/sales-feedback`)
      .send({ rating: 4, notes: 'عميل جاد' })
      .expect(201);
    const data = mock.visitAppointment.update.mock.calls[0]![0].data;
    expect(data.salesRating).toBe(4);
    expect(data.salesRatingText).toBe('عميل جاد');
    expect(data.salesRatingSubmittedAt).toBeInstanceOf(Date);
  });

  it('rejects sales feedback before completion (400)', async () => {
    FakeAuthGuard.currentUser = { sub: SALES_ID, role: UserRole.SALES, codes: ['visits:complete'] };
    fixture.appt.status = AppointmentStatus.SCHEDULED;
    await request(app.getHttpServer())
      .post(`/visits/appointments/${APPT_ID}/sales-feedback`)
      .send({ rating: 4 })
      .expect(400);
    expect(mock.visitAppointment.update).not.toHaveBeenCalled();
  });

  it('rejects an empty sales submission (no rating, no notes, 400)', async () => {
    FakeAuthGuard.currentUser = { sub: SALES_ID, role: UserRole.SALES, codes: ['visits:complete'] };
    await request(app.getHttpServer())
      .post(`/visits/appointments/${APPT_ID}/sales-feedback`)
      .send({})
      .expect(400);
    expect(mock.visitAppointment.update).not.toHaveBeenCalled();
  });

  it('blocks a non-assigned SALES rep via scope (403)', async () => {
    FakeAuthGuard.currentUser = { sub: OTHER_ID, role: UserRole.SALES, codes: ['visits:complete'] };
    await request(app.getHttpServer())
      .post(`/visits/appointments/${APPT_ID}/sales-feedback`)
      .send({ rating: 3 })
      .expect(403);
    expect(mock.visitAppointment.update).not.toHaveBeenCalled();
  });
});
