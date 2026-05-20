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
      create: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
    },
    salesTarget: {
      upsert: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
    },
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
