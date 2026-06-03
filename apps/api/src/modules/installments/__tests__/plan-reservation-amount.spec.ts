import { CanActivate, ExecutionContext, Global, INestApplication, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { UserRole } from '@prisma/client';
import { InstallmentsModule } from '../installments.module';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { PrismaService } from '../../../common/prisma/prisma.service';

/**
 * Plan template booking/reservation amount — fixed vs percentage (mirrors the
 * down-payment pattern). PERCENTAGE on a template computes against netPrice for
 * its own schedule; the percent is stored and re-applied to the unit price at
 * reservation creation (covered by the reservations module).
 */

const PROJECT_ID = 'a1111111-1111-4111-8111-111111111111';
const UNIT_ID = 'b2222222-2222-4222-8222-222222222222';

class FakeAuthGuard implements CanActivate {
  static currentUser: { sub: string; role: UserRole; codes: string[] } | null = null;
  canActivate(context: ExecutionContext): boolean {
    if (!FakeAuthGuard.currentUser) return false;
    const req = context.switchToHttp().getRequest();
    req.user = { sub: FakeAuthGuard.currentUser.sub, role: FakeAuthGuard.currentUser.role };
    return true;
  }
}

function makePrismaMock() {
  const m = {
    userPermission: { findMany: jest.fn().mockResolvedValue([]) },
    unit: {
      findUnique: jest.fn().mockResolvedValue({
        id: UNIT_ID,
        building: { phase: { projectId: PROJECT_ID } },
      }),
    },
    installmentPlanTemplate: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'tpl-new',
        ...data,
      })),
      // findOne() after the tx commits.
      findUnique: jest.fn().mockResolvedValue({
        id: 'tpl-new',
        name: 'x',
        status: 'DRAFT',
        projectId: PROJECT_ID,
        unitId: UNIT_ID,
        netPrice: 0,
        reservationAmount: 0,
        downPaymentAmount: 0,
        durationOptions: [],
        scheduleItems: [],
        project: null,
        unit: null,
        createdBy: null,
      }),
    },
    planTemplateScheduleItem: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
    installmentPlanDurationOption: {
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    $transaction: jest.fn(),
  };
  m.$transaction.mockImplementation(async (ops: unknown) => {
    if (Array.isArray(ops)) return Promise.all(ops);
    if (typeof ops === 'function') {
      const tx = {
        installmentPlanTemplate: m.installmentPlanTemplate,
        planTemplateScheduleItem: m.planTemplateScheduleItem,
        installmentPlanDurationOption: m.installmentPlanDurationOption,
      };
      return (ops as (tx: unknown) => Promise<unknown>)(tx);
    }
    return ops;
  });
  return m;
}

let mock = makePrismaMock();

const baseBody = {
  name: 'Test plan',
  projectId: PROJECT_ID,
  unitId: UNIT_ID,
  totalPrice: 1_000_000,
  discountAmount: 0,
  downPaymentType: 'FIXED',
  downPaymentValue: 50_000,
  installmentsCount: 12,
  frequency: 'MONTHLY',
  startDateRule: 'MANUAL',
};

function createData() {
  return mock.installmentPlanTemplate.create.mock.calls[0]![0].data as Record<string, unknown>;
}

describe('Plan template · reservation amount fixed/percentage', () => {
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
      imports: [MockPrismaModule, ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), InstallmentsModule],
      providers: [
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
    FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
    mock.installmentPlanTemplate.create.mockClear();
  });

  it('FIXED: stores the value verbatim as the computed amount', async () => {
    await request(app.getHttpServer())
      .post('/installment-plan-templates')
      .send({ ...baseBody, reservationAmountType: 'FIXED', reservationAmountValue: 50_000 })
      .expect(201);
    const data = createData();
    expect(data.reservationAmountType).toBe('FIXED');
    expect(String(data.reservationAmountValue)).toBe('50000');
    expect(String(data.reservationAmount)).toBe('50000');
  });

  it('PERCENTAGE: computes reservationAmount = netPrice × pct ÷ 100 and stores the percent', async () => {
    await request(app.getHttpServer())
      .post('/installment-plan-templates')
      .send({ ...baseBody, reservationAmountType: 'PERCENTAGE', reservationAmountValue: 10 })
      .expect(201);
    const data = createData();
    expect(data.reservationAmountType).toBe('PERCENTAGE');
    expect(String(data.reservationAmountValue)).toBe('10');
    expect(String(data.reservationAmount)).toBe('100000'); // 10% of 1,000,000
  });

  it('rejects percentage > 100', async () => {
    await request(app.getHttpServer())
      .post('/installment-plan-templates')
      .send({ ...baseBody, reservationAmountType: 'PERCENTAGE', reservationAmountValue: 150 })
      .expect(400);
    expect(mock.installmentPlanTemplate.create).not.toHaveBeenCalled();
  });

  it('rejects percentage <= 0', async () => {
    await request(app.getHttpServer())
      .post('/installment-plan-templates')
      .send({ ...baseBody, reservationAmountType: 'PERCENTAGE', reservationAmountValue: 0 })
      .expect(400);
    expect(mock.installmentPlanTemplate.create).not.toHaveBeenCalled();
  });

  it('legacy payload (reservationAmount only) still works as FIXED', async () => {
    await request(app.getHttpServer())
      .post('/installment-plan-templates')
      .send({ ...baseBody, reservationAmount: 50_000 })
      .expect(201);
    const data = createData();
    expect(data.reservationAmountType).toBe('FIXED');
    expect(String(data.reservationAmount)).toBe('50000');
    expect(String(data.reservationAmountValue)).toBe('50000');
  });

  // ── Discount fixed/percentage ──────────────────────────────────────────────

  it('discount FIXED: stores value as the amount; netPrice = total − discount', async () => {
    await request(app.getHttpServer())
      .post('/installment-plan-templates')
      .send({ ...baseBody, discountType: 'FIXED', discountValue: 50_000 })
      .expect(201);
    const data = createData();
    expect(data.discountType).toBe('FIXED');
    expect(String(data.discountValue)).toBe('50000');
    expect(String(data.discountAmount)).toBe('50000');
    expect(String(data.netPrice)).toBe('950000');
  });

  it('discount PERCENTAGE: amount = totalPrice × pct ÷ 100', async () => {
    await request(app.getHttpServer())
      .post('/installment-plan-templates')
      .send({ ...baseBody, discountType: 'PERCENTAGE', discountValue: 10 })
      .expect(201);
    const data = createData();
    expect(data.discountType).toBe('PERCENTAGE');
    expect(String(data.discountValue)).toBe('10');
    expect(String(data.discountAmount)).toBe('100000'); // 10% of 1,000,000
    expect(String(data.netPrice)).toBe('900000');
  });

  it('zero discount is allowed (FIXED, value 0)', async () => {
    await request(app.getHttpServer())
      .post('/installment-plan-templates')
      .send({ ...baseBody, discountType: 'FIXED', discountValue: 0 })
      .expect(201);
    const data = createData();
    expect(String(data.discountAmount)).toBe('0');
    expect(String(data.netPrice)).toBe('1000000');
  });

  it('rejects discount percentage > 100', async () => {
    await request(app.getHttpServer())
      .post('/installment-plan-templates')
      .send({ ...baseBody, discountType: 'PERCENTAGE', discountValue: 150 })
      .expect(400);
    expect(mock.installmentPlanTemplate.create).not.toHaveBeenCalled();
  });

  it('legacy discount payload (discountAmount only) still works as FIXED', async () => {
    await request(app.getHttpServer())
      .post('/installment-plan-templates')
      .send({ ...baseBody, discountAmount: 50_000 })
      .expect(201);
    const data = createData();
    expect(data.discountType).toBe('FIXED');
    expect(String(data.discountAmount)).toBe('50000');
    expect(String(data.discountValue)).toBe('50000');
  });
});
