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
import request from 'supertest';
import { UserRole } from '@prisma/client';
import { BonusModule } from '../bonus.module';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { PrismaService } from '../../../common/prisma/prisma.service';

/**
 * Bonus entry lifecycle workflow.
 *
 * The bonus service is intentionally tiny — setEntryStatus toggles status
 * and stamps paidAt only on PAID. The tests guarantee that:
 *   - createEntry persists the input (salesId, ruleId, amount, period)
 *   - approveEntry → APPROVED, paidAt = null
 *   - payEntry     → PAID,     paidAt = Date
 *   - revertEntry (PATCH) only accepts PENDING (DTO is whitelisted)
 *   - missing entry id surfaces as 404 via ParseUUIDPipe
 */

const ENTRY_ID = 'e1111111-1111-4111-8111-111111111111';
const SALES_ID = 'a2222222-2222-4222-8222-222222222222';
const RULE_ID = 'a3333333-3333-4333-8333-333333333333';

interface EntryFixture {
  id: string;
  salesId: string;
  ruleId: string;
  amount: number;
  period: string;
  status: 'PENDING' | 'APPROVED' | 'PAID';
  paidAt: Date | null;
}

const fixture: { entry: EntryFixture } = { entry: {} as never };

function resetFixture() {
  fixture.entry = {
    id: ENTRY_ID,
    salesId: SALES_ID,
    ruleId: RULE_ID,
    amount: 1500,
    period: '2030-04',
    status: 'PENDING',
    paidAt: null,
  };
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
  return {
    userPermission: {
      findMany: jest.fn().mockImplementation(async () => {
        const u = FakeAuthGuard.currentUser;
        return (u?.codes ?? []).map((code) => ({ permission: { code } }));
      }),
    },
    bonusEntry: {
      create: jest.fn().mockImplementation(async ({ data }) => ({
        ...data,
        id: ENTRY_ID,
        status: 'PENDING',
        paidAt: null,
        createdAt: new Date(),
      })),
      update: jest.fn().mockImplementation(async ({ where, data }) => {
        fixture.entry = { ...fixture.entry, ...data, id: where.id };
        return fixture.entry;
      }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    bonusRule: {
      create: jest.fn().mockImplementation(async ({ data }) => ({ id: RULE_ID, ...data })),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockImplementation(async ({ where }) => ({ id: where.id })),
      update: jest.fn().mockImplementation(async ({ where, data }) => ({ id: where.id, ...data })),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    salesTarget: {
      upsert: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
    },
    $transaction: jest.fn().mockImplementation((arg: unknown) =>
      typeof arg === 'function'
        ? (arg as (tx: unknown) => Promise<unknown>)(mock)
        : Promise.all(arg as Promise<unknown>[]),
    ),
  };
}

let mock = makePrismaMock();

describe('Bonus · entry lifecycle workflow', () => {
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
      imports: [MockPrismaModule, BonusModule],
      providers: [
        { provide: APP_GUARD, useClass: FakeAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
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
    FakeAuthGuard.currentUser = {
      sub: 'admin-1',
      role: UserRole.ADMIN,
      codes: [
        'bonus:entries:create',
        'bonus:entries:approve',
        'bonus:entries:pay',
      ],
    };
    resetFixture();
    mock.bonusEntry.create.mockClear();
    mock.bonusEntry.update.mockClear();
    mock.bonusRule.create.mockClear();
    mock.bonusRule.update.mockClear();
    mock.bonusRule.updateMany.mockClear();
    mock.bonusRule.findUnique.mockClear();
  });

  // ── createEntry ─────────────────────────────────────────────────────────

  it('createEntry persists the salesId / ruleId / amount / period and lands in PENDING', async () => {
    const res = await request(app.getHttpServer())
      .post('/bonus-entries')
      .send({ salesId: SALES_ID, ruleId: RULE_ID, amount: 1500, period: '2030-04' })
      .expect(201);

    expect(mock.bonusEntry.create).toHaveBeenCalledTimes(1);
    const args = mock.bonusEntry.create.mock.calls[0]![0] as {
      data: { salesId: string; ruleId: string; period: string };
    };
    expect(args.data.salesId).toBe(SALES_ID);
    expect(args.data.ruleId).toBe(RULE_ID);
    expect(args.data.period).toBe('2030-04');
    expect(res.body).toMatchObject({ id: ENTRY_ID, status: 'PENDING', paidAt: null });
  });

  it('createEntry rejects negative amount (400)', async () => {
    await request(app.getHttpServer())
      .post('/bonus-entries')
      .send({ salesId: SALES_ID, ruleId: RULE_ID, amount: -10, period: '2030-04' })
      .expect(400);
    expect(mock.bonusEntry.create).not.toHaveBeenCalled();
  });

  // Manual create must NOT accept auto-commission fields (forbidNonWhitelisted),
  // so the admin UI can never mint a CONTRACT_AUTO / contract-linked entry.
  it('createEntry rejects source / contractId (400, whitelist)', async () => {
    await request(app.getHttpServer())
      .post('/bonus-entries')
      .send({ salesId: SALES_ID, ruleId: RULE_ID, amount: 100, period: '2030-04', source: 'CONTRACT_AUTO' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/bonus-entries')
      .send({ salesId: SALES_ID, ruleId: RULE_ID, amount: 100, period: '2030-04', contractId: ENTRY_ID })
      .expect(400);
    expect(mock.bonusEntry.create).not.toHaveBeenCalled();
  });

  // ── createRule · autoApplyOnSignedContract flag (Batch A) ────────────────

  it('createRule defaults autoApplyOnSignedContract to false', async () => {
    await request(app.getHttpServer())
      .post('/bonus-rules')
      .send({ name: 'بيع وحدة', percentage: 2 })
      .expect(201);
    const args = mock.bonusRule.create.mock.calls[0]![0] as {
      data: { autoApplyOnSignedContract: boolean };
    };
    expect(args.data.autoApplyOnSignedContract).toBe(false);
  });

  it('createRule persists autoApplyOnSignedContract = true when provided', async () => {
    const res = await request(app.getHttpServer())
      .post('/bonus-rules')
      .send({ name: 'بيع وحدة', percentage: 2, autoApplyOnSignedContract: true })
      .expect(201);
    const args = mock.bonusRule.create.mock.calls[0]![0] as {
      data: { autoApplyOnSignedContract: boolean };
    };
    expect(args.data.autoApplyOnSignedContract).toBe(true);
    expect(res.body).toMatchObject({ autoApplyOnSignedContract: true });
  });

  // ── createRule · single-auto invariant on create (Batch D) ───────────────

  it('creating a rule with auto=true disables auto on all existing rules', async () => {
    await request(app.getHttpServer())
      .post('/bonus-rules')
      .send({ name: 'بيع وحدة', percentage: 2, autoApplyOnSignedContract: true })
      .expect(201);

    expect(mock.bonusRule.updateMany).toHaveBeenCalledTimes(1);
    const many = mock.bonusRule.updateMany.mock.calls[0]![0] as {
      where: { autoApplyOnSignedContract: boolean };
      data: { autoApplyOnSignedContract: boolean };
    };
    expect(many.where.autoApplyOnSignedContract).toBe(true);
    expect(many.data.autoApplyOnSignedContract).toBe(false);
    expect(mock.bonusRule.create).toHaveBeenCalledTimes(1);
  });

  it('creating a rule with auto=false does not touch other rules (no updateMany)', async () => {
    await request(app.getHttpServer())
      .post('/bonus-rules')
      .send({ name: 'مكافأة خاصة', percentage: 1 })
      .expect(201);
    expect(mock.bonusRule.updateMany).not.toHaveBeenCalled();
    expect(mock.bonusRule.create).toHaveBeenCalledTimes(1);
  });

  // ── updateRule · PATCH /bonus-rules/:id (Batch C) ────────────────────────

  it('updateRule toggles active without touching other rules', async () => {
    await request(app.getHttpServer())
      .patch(`/bonus-rules/${RULE_ID}`)
      .send({ active: false })
      .expect(200);
    const args = mock.bonusRule.update.mock.calls[0]![0] as { data: { active: boolean } };
    expect(args.data.active).toBe(false);
    expect(mock.bonusRule.updateMany).not.toHaveBeenCalled();
  });

  it('enabling auto on one rule disables auto on all other rules', async () => {
    await request(app.getHttpServer())
      .patch(`/bonus-rules/${RULE_ID}`)
      .send({ autoApplyOnSignedContract: true })
      .expect(200);

    // Others turned off first…
    expect(mock.bonusRule.updateMany).toHaveBeenCalledTimes(1);
    const many = mock.bonusRule.updateMany.mock.calls[0]![0] as {
      where: { id: { not: string }; autoApplyOnSignedContract: boolean };
      data: { autoApplyOnSignedContract: boolean };
    };
    expect(many.where.id.not).toBe(RULE_ID);
    expect(many.where.autoApplyOnSignedContract).toBe(true);
    expect(many.data.autoApplyOnSignedContract).toBe(false);
    // …then this rule turned on.
    const one = mock.bonusRule.update.mock.calls[0]![0] as {
      data: { autoApplyOnSignedContract: boolean };
    };
    expect(one.data.autoApplyOnSignedContract).toBe(true);
  });

  it('disabling auto leaves other rules unchanged (no updateMany)', async () => {
    await request(app.getHttpServer())
      .patch(`/bonus-rules/${RULE_ID}`)
      .send({ autoApplyOnSignedContract: false })
      .expect(200);
    expect(mock.bonusRule.updateMany).not.toHaveBeenCalled();
    const one = mock.bonusRule.update.mock.calls[0]![0] as {
      data: { autoApplyOnSignedContract: boolean };
    };
    expect(one.data.autoApplyOnSignedContract).toBe(false);
  });

  it('updateRule rejects a negative percentage (400)', async () => {
    await request(app.getHttpServer())
      .patch(`/bonus-rules/${RULE_ID}`)
      .send({ percentage: -5 })
      .expect(400);
    expect(mock.bonusRule.update).not.toHaveBeenCalled();
  });

  it('updateRule is blocked for non-admins at the role gate (403)', async () => {
    FakeAuthGuard.currentUser = {
      sub: 'sales-1',
      role: UserRole.SALES,
      codes: ['bonus:rules:manage'], // even with the code, @Roles(ADMIN) blocks
    };
    await request(app.getHttpServer())
      .patch(`/bonus-rules/${RULE_ID}`)
      .send({ active: false })
      .expect(403);
    expect(mock.bonusRule.update).not.toHaveBeenCalled();
  });

  // ── approveEntry ────────────────────────────────────────────────────────

  it('approveEntry: status → APPROVED, paidAt stays null', async () => {
    await request(app.getHttpServer())
      .post(`/bonus-entries/${ENTRY_ID}/approve`)
      .send({})
      .expect(201);
    const args = mock.bonusEntry.update.mock.calls[0]![0] as {
      where: { id: string };
      data: { status: string; paidAt: Date | null };
    };
    expect(args.where.id).toBe(ENTRY_ID);
    expect(args.data.status).toBe('APPROVED');
    expect(args.data.paidAt).toBeNull();
  });

  // ── payEntry ────────────────────────────────────────────────────────────

  it('payEntry: status → PAID, paidAt stamped with a Date', async () => {
    await request(app.getHttpServer())
      .post(`/bonus-entries/${ENTRY_ID}/pay`)
      .send({})
      .expect(201);
    const args = mock.bonusEntry.update.mock.calls[0]![0] as {
      where: { id: string };
      data: { status: string; paidAt: Date | null };
    };
    expect(args.where.id).toBe(ENTRY_ID);
    expect(args.data.status).toBe('PAID');
    expect(args.data.paidAt).toBeInstanceOf(Date);
  });

  // ── PATCH /bonus-entries/:id is restricted to revert-to-PENDING ─────────

  it('PATCH /bonus-entries/:id accepts status=PENDING (revert path)', async () => {
    fixture.entry.status = 'APPROVED';
    await request(app.getHttpServer())
      .patch(`/bonus-entries/${ENTRY_ID}`)
      .send({ status: 'PENDING' })
      .expect(200);
    const args = mock.bonusEntry.update.mock.calls[0]![0] as {
      data: { status: string; paidAt: Date | null };
    };
    expect(args.data.status).toBe('PENDING');
    expect(args.data.paidAt).toBeNull();
  });

  it('PATCH /bonus-entries/:id rejects status=APPROVED (DTO whitelist, 400)', async () => {
    await request(app.getHttpServer())
      .patch(`/bonus-entries/${ENTRY_ID}`)
      .send({ status: 'APPROVED' })
      .expect(400);
    expect(mock.bonusEntry.update).not.toHaveBeenCalled();
  });

  it('PATCH /bonus-entries/:id rejects status=PAID (DTO whitelist, 400)', async () => {
    await request(app.getHttpServer())
      .patch(`/bonus-entries/${ENTRY_ID}`)
      .send({ status: 'PAID' })
      .expect(400);
    expect(mock.bonusEntry.update).not.toHaveBeenCalled();
  });

  // ── Param validation ────────────────────────────────────────────────────

  it('approveEntry rejects non-UUID id (400 via ParseUUIDPipe)', async () => {
    await request(app.getHttpServer())
      .post('/bonus-entries/not-a-uuid/approve')
      .send({})
      .expect(400);
    expect(mock.bonusEntry.update).not.toHaveBeenCalled();
  });
});
