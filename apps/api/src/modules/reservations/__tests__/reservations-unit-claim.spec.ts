/**
 * Race-condition regression tests for the unit reservation atomic claim.
 *
 * The fix (reservations.module.ts) replaced an unconditional tx.unit.update
 * with a conditional tx.unit.updateMany({ where: { id, status: AVAILABLE } }).
 * If count === 0 the unit was already claimed and the entire transaction is
 * rolled back before any Reservation row is written.
 *
 * Test 1 — Happy path: updateMany returns count=1 → 201 + reservation created.
 * Test 2 — Pre-transaction guard: unit already RESERVED → 409 before transaction.
 * Test 3 — Concurrent claim: two requests race; updateMany returns count=1 then
 *           count=0. Exactly one 201, one 409, reservation.create called once.
 */
import {
  CanActivate,
  ExecutionContext,
  Global,
  INestApplication,
  Module,
  ValidationPipe,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import request from 'supertest';
import { UserRole } from '@prisma/client';
import { ReservationsModule } from '../reservations.module';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { PrismaService } from '../../../common/prisma/prisma.service';

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

const SALES_USER = {
  sub: 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b0001',
  role: UserRole.SALES,
  codes: ['reservations:create'],
};
const UNIT_ID = 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d';
const LEAD_ID = 'b1b2c3d4-e5f6-4b1b-8c2d-3e4f5a6b7c8e';

const BASE_BODY = { unitId: UNIT_ID, leadId: LEAD_ID };

function makeMock(unitStatus: 'AVAILABLE' | 'RESERVED' = 'AVAILABLE') {
  const m = {
    userPermission: {
      findMany: jest.fn().mockImplementation(async () => {
        const u = FakeAuthGuard.currentUser;
        return (u?.codes ?? []).map((code) => ({ permission: { code } }));
      }),
    },
    lead: {
      findUnique: jest.fn().mockResolvedValue({
        id: LEAD_ID,
        stage: 'INTERESTED',
        unitInterestId: UNIT_ID,
        projectInterestId: null,
      }),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({ id: 'new-lead-id' }),
    },
    unit: {
      findUnique: jest.fn().mockResolvedValue({
        id: UNIT_ID,
        code: 'A101',
        status: unitStatus,
        price: 1_000_000,
        building: { phase: { projectId: 'project-1' } },
      }),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    reservation: {
      findFirst: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({
        id: 'new-res-id',
        reservationNumber: 'RES-001',
        unitId: UNIT_ID,
        leadId: LEAD_ID,
        clientId: null,
      }),
      update: jest.fn().mockResolvedValue({}),
    },
    visitAppointment: { findFirst: jest.fn().mockResolvedValue(null) },
    contract: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    reservationActivity: { create: jest.fn().mockResolvedValue({}) },
    leadActivity: { create: jest.fn().mockResolvedValue({}) },
    unitStatusHistory: { create: jest.fn().mockResolvedValue({}) },
    user: {
      findUnique: jest.fn().mockResolvedValue(null),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    installmentPlan: { create: jest.fn().mockResolvedValue({ id: 'plan-1' }) },
    installment: { create: jest.fn().mockResolvedValue({}) },
    deposit: {
      create: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    notificationTemplate: { upsert: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn(),
  };

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
        lead: m.lead,
      };
      return (ops as (tx: unknown) => Promise<unknown>)(tx);
    }
    return ops;
  });

  return m;
}

async function buildApp(mock: ReturnType<typeof makeMock>) {
  @Global()
  @Module({
    providers: [{ provide: PrismaService, useValue: mock }],
    exports: [PrismaService],
  })
  class MockPrismaModule {}

  const moduleRef = await Test.createTestingModule({
    imports: [
      MockPrismaModule,
      ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
      ReservationsModule,
    ],
    providers: [
      { provide: APP_GUARD, useClass: FakeAuthGuard },
      { provide: APP_GUARD, useClass: RolesGuard },
      { provide: APP_GUARD, useClass: PermissionsGuard },
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  await app.init();
  return app;
}

describe('POST /reservations — unit claim race condition', () => {
  let app: INestApplication;

  beforeAll(() => {
    FakeAuthGuard.currentUser = SALES_USER;
  });

  afterEach(async () => {
    await app?.close();
  });

  it('Test 1 — happy path: atomic claim succeeds, reservation row is created (201)', async () => {
    const mock = makeMock('AVAILABLE');
    app = await buildApp(mock);

    const res = await request(app.getHttpServer())
      .post('/reservations')
      .send(BASE_BODY);

    expect(res.status).toBe(201);
    expect(mock.unit.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: UNIT_ID, status: 'AVAILABLE' }),
      }),
    );
    expect(mock.reservation.create).toHaveBeenCalledTimes(1);
  });

  it('Test 2 — already-reserved unit: pre-transaction check throws 409, no transaction entered', async () => {
    const mock = makeMock('RESERVED');
    app = await buildApp(mock);

    const res = await request(app.getHttpServer())
      .post('/reservations')
      .send(BASE_BODY);

    expect(res.status).toBe(409);
    // The fast-fail outside the transaction must fire before updateMany is reached.
    expect(mock.unit.updateMany).not.toHaveBeenCalled();
    expect(mock.reservation.create).not.toHaveBeenCalled();
  });

  it('Test 3 — concurrent claim: exactly one wins, exactly one reservation row written', async () => {
    const mock = makeMock('AVAILABLE');
    // Simulate the race: first caller claims the unit; second finds it gone.
    mock.unit.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    app = await buildApp(mock);

    const [r1, r2] = await Promise.all([
      request(app.getHttpServer()).post('/reservations').send(BASE_BODY),
      request(app.getHttpServer()).post('/reservations').send(BASE_BODY),
    ]);

    const statuses = [r1.status, r2.status].sort();
    // Exactly one success, exactly one conflict — regardless of which request wins.
    expect(statuses).toEqual([201, 409]);
    // The losing request must not have written a Reservation row.
    expect(mock.reservation.create).toHaveBeenCalledTimes(1);
  });
});
