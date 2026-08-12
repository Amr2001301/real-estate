/**
 * Tests for dto.leadId validation guards in ReservationsService.create().
 *
 * Covers Bug B and Bug C fixes:
 *   Bug B — dto.leadId with no unit/stage validation (guards added)
 *   Bug C — client-linked reservation leadId not persisted back to reservation
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
import { LeadStage, ReservationStatus, UserRole } from '@prisma/client';
import { ReservationsModule } from '../reservations.module';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { PrismaService } from '../../../common/prisma/prisma.service';

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

const SALES_USER: FakeUser = { sub: 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b0001', role: UserRole.SALES, codes: ['reservations:create'] };
const UNIT_ID = 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d';
const LEAD_ID = 'b1b2c3d4-e5f6-4b1b-8c2d-3e4f5a6b7c8e';
const OTHER_UNIT_ID = 'c1b2c3d4-e5f6-4c1b-8c2d-3e4f5a6b7c8f';

const BASE_BODY = {
  unitId: UNIT_ID,
  leadId: LEAD_ID,
};

function makeUnit() {
  return {
    id: UNIT_ID,
    code: 'A101',
    status: 'AVAILABLE',
    price: 1000000,
    building: { phase: { projectId: 'project-1' } },
  };
}

function makeLead(overrides: Partial<{
  stage: string;
  unitInterestId: string | null;
  projectInterestId: string | null;
}> = {}) {
  return {
    id: LEAD_ID,
    stage: overrides.stage ?? 'INTERESTED',
    unitInterestId: overrides.unitInterestId ?? null,
    projectInterestId: overrides.projectInterestId ?? null,
  };
}

function makePrismaMock(leadOverrides: Parameters<typeof makeLead>[0] = {}) {
  const lead = makeLead(leadOverrides);
  const unit = makeUnit();

  const m = {
    userPermission: {
      findMany: jest.fn().mockImplementation(async () => {
        const u = FakeAuthGuard.currentUser;
        return (u?.codes ?? []).map((code) => ({ permission: { code } }));
      }),
    },
    lead: {
      findUnique: jest.fn().mockResolvedValue(lead),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({ id: 'new-lead-id' }),
    },
    unit: {
      findUnique: jest.fn().mockResolvedValue(unit),
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
    visitAppointment: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
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
    deposit: { create: jest.fn().mockResolvedValue({}), deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
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

async function buildApp(mock: ReturnType<typeof makePrismaMock>) {
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

// ─── WON/LOST guard ──────────────────────────────────────────────────────────

describe('POST /reservations — dto.leadId stage guard', () => {
  let app: INestApplication;

  beforeAll(async () => {
    FakeAuthGuard.currentUser = SALES_USER;
  });

  afterEach(async () => {
    await app?.close();
  });

  it('rejects 400 when lead stage is WON', async () => {
    const mock = makePrismaMock({ stage: LeadStage.WON });
    app = await buildApp(mock);
    const res = await request(app.getHttpServer())
      .post('/reservations')
      .send(BASE_BODY);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/WON/);
  });

  it('rejects 400 when lead stage is LOST', async () => {
    const mock = makePrismaMock({ stage: LeadStage.LOST });
    app = await buildApp(mock);
    const res = await request(app.getHttpServer())
      .post('/reservations')
      .send(BASE_BODY);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/LOST/);
  });
});

// ─── Unit mismatch guard ──────────────────────────────────────────────────────

describe('POST /reservations — dto.leadId unit mismatch guard', () => {
  let app: INestApplication;

  beforeAll(async () => {
    FakeAuthGuard.currentUser = SALES_USER;
  });

  afterEach(async () => {
    await app?.close();
  });

  it('rejects 400 when lead is scoped to a different unit', async () => {
    const mock = makePrismaMock({ stage: LeadStage.INTERESTED, unitInterestId: OTHER_UNIT_ID });
    app = await buildApp(mock);
    const res = await request(app.getHttpServer())
      .post('/reservations')
      .send(BASE_BODY);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/different unit/i);
  });

  it('allows 201 when lead unitInterestId matches dto.unitId', async () => {
    const mock = makePrismaMock({ stage: LeadStage.INTERESTED, unitInterestId: UNIT_ID });
    app = await buildApp(mock);
    const res = await request(app.getHttpServer())
      .post('/reservations')
      .send(BASE_BODY);
    expect(res.status).toBe(201);
  });
});

// ─── Generic lead safety check ────────────────────────────────────────────────

describe('POST /reservations — dto.leadId generic lead safety check', () => {
  let app: INestApplication;

  beforeAll(async () => {
    FakeAuthGuard.currentUser = SALES_USER;
  });

  afterEach(async () => {
    await app?.close();
  });

  it('rejects 400 when generic lead already has an active reservation', async () => {
    const mock = makePrismaMock({ stage: LeadStage.INTERESTED, unitInterestId: null, projectInterestId: null });
    mock.reservation.findFirst.mockResolvedValue({ id: 'existing-res' });
    app = await buildApp(mock);
    const res = await request(app.getHttpServer())
      .post('/reservations')
      .send(BASE_BODY);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/committed activities/i);
  });

  it('rejects 400 when generic lead has a unit-specific appointment', async () => {
    const mock = makePrismaMock({ stage: LeadStage.INTERESTED, unitInterestId: null, projectInterestId: null });
    mock.visitAppointment.findFirst.mockResolvedValue({ id: 'existing-appt' });
    app = await buildApp(mock);
    const res = await request(app.getHttpServer())
      .post('/reservations')
      .send(BASE_BODY);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/committed activities/i);
  });

  it('rejects 400 when generic lead has a linked contract', async () => {
    const mock = makePrismaMock({ stage: LeadStage.INTERESTED, unitInterestId: null, projectInterestId: null });
    mock.contract.findFirst.mockResolvedValue({ id: 'existing-contract' });
    app = await buildApp(mock);
    const res = await request(app.getHttpServer())
      .post('/reservations')
      .send(BASE_BODY);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/committed activities/i);
  });

  it('allows 201 and upgrades generic lead when no committed activities exist', async () => {
    const mock = makePrismaMock({ stage: LeadStage.INTERESTED, unitInterestId: null, projectInterestId: null });
    // Safety checks return null (clean generic lead) — the default mock already does this
    // but be explicit in case the mock is reused across tests.
    mock.reservation.findFirst.mockResolvedValue(null);
    mock.visitAppointment.findFirst.mockResolvedValue(null);
    mock.contract.findFirst.mockResolvedValue(null);
    // The default lead.findUnique mock already returns the lead with id, stage, unitInterestId=null.
    // No override needed — the same value serves both the top-level guard check and the
    // in-tx previousStage lookup.
    app = await buildApp(mock);
    const res = await request(app.getHttpServer())
      .post('/reservations')
      .send(BASE_BODY);
    expect(res.status).toBe(201);
    // Verify the generic lead was upgraded with unitInterestId and projectInterestId
    const updateCall = mock.lead.update.mock.calls.find(
      (c: any) => c[0]?.data?.unitInterestId === UNIT_ID,
    );
    expect(updateCall).toBeDefined();
  });
});

// ─── Client-linked path: leadId persisted back to reservation ─────────────────

describe('POST /reservations — client-linked path persists leadId (Bug C fix)', () => {
  let app: INestApplication;
  let mock: ReturnType<typeof makePrismaMock>;

  const CLIENT_UUID = 'd1b2c3d4-e5f6-4d1b-8c2d-3e4f5a6b7c9a';
  const MATCHED_LEAD_ID = 'e1b2c3d4-e5f6-4e1b-8c2d-3e4f5a6b7c9b';

  beforeAll(async () => {
    FakeAuthGuard.currentUser = SALES_USER;
    // Use clientId instead of leadId
    mock = makePrismaMock();
    mock.user.findUnique.mockResolvedValue({
      id: CLIENT_UUID,
      role: UserRole.CLIENT,
      active: true,
      fullName: 'Test Client',
      phone: '0501234567',
      email: null,
    });
    // matchOrCreateLeadForClient creates a new lead (lead.findFirst → null, lead.create → new)
    mock.lead.findFirst.mockResolvedValue(null);
    mock.lead.create.mockResolvedValue({ id: MATCHED_LEAD_ID });
    mock.lead.findUnique.mockResolvedValue(null);
    app = await buildApp(mock);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('calls reservation.update with the resolved leadId after matchOrCreate', async () => {
    const res = await request(app.getHttpServer())
      .post('/reservations')
      .send({ unitId: UNIT_ID, clientId: CLIENT_UUID });

    expect(res.status).toBe(201);
    const updateCall = mock.reservation.update.mock.calls.find(
      (c: any) => c[0]?.data?.leadId === MATCHED_LEAD_ID,
    );
    expect(updateCall).toBeDefined();
  });
});
