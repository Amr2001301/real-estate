/**
 * ChequeLifecycleService — unit tests.
 *
 * Covers (09-reversal-design.md §3.3, §3.4 Sub-case A, §3.4 Sub-case B, §6.2, §8.1 Step B+C):
 *   - every valid transition in the state machine succeeds
 *   - every invalid transition throws BadRequestException
 *   - Sub-case A bounce: PENDING_REVIEW deposits → REJECTED; installments unchanged;
 *     zero PaymentCorrection rows
 *   - Sub-case B bounce: APPROVED deposits stay APPROVED; PaymentCorrection(REVERSAL) written;
 *     installment reopened; paidAt NOT cleared; lastCorrectionId set
 *   - bounce with operator penalty > 0 creates a BOUNCE_PENALTY installment;
 *     penalty = 0 creates none
 *   - operator-entered values override the Settings suggestion and are stored
 * Integration (S1 walkthrough steps 1-3):
 *   - walk the scenario exactly and assert final state matches the design
 */

import {
  CallHandler,
  CanActivate,
  ExecutionContext,
  Global,
  INestApplication,
  Injectable,
  Module,
  NestInterceptor,
  ValidationPipe,
} from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { Observable } from 'rxjs';
import {
  DepositReviewStatus,
  PaymentInstrumentStatus,
  PaymentInstrumentType,
  PlanPaymentType,
  UserRole,
} from '@prisma/client';
import { ConfigModule } from '@nestjs/config';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { enterTenantContext } from '../../../common/tenant/tenant-context';
import { PaymentInstrumentsModule } from '../payment-instruments.module';
import { NotificationsService } from '../../notifications/notifications.module';

// ── Fixed IDs ────────────────────────────────────────────────────────────────

const COMPANY_A = 'aaaaaaaa-0000-4000-8000-000000000001';
const ADMIN_ID  = 'bbbbbbbb-0000-4000-8000-000000000002';
const PI_ID     = 'cccccccc-0000-4000-8000-000000000003';
const DEP1_ID   = 'dddddddd-0000-4000-8000-000000000004';
const DEP2_ID   = 'eeeeeeee-0000-4000-8000-000000000005';
const INST1_ID  = 'ffffffff-0000-4000-8000-000000000006';
const INST2_ID  = 'aaaaaaaa-1111-4000-8000-000000000007';
const PLAN_ID   = 'bbbbbbbb-1111-4000-8000-000000000008';

// ── Fake tenant interceptor ───────────────────────────────────────────────────

@Injectable()
class FakeTenantInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return new Observable(subscriber => {
      enterTenantContext({ companyId: COMPANY_A, bypass: false, isPublic: false });
      next.handle().subscribe(subscriber);
    });
  }
}

// ── Fake auth guard ───────────────────────────────────────────────────────────

class FakeAuthGuard implements CanActivate {
  static user: { sub: string; role: UserRole; codes: string[] } = {
    sub: ADMIN_ID,
    role: UserRole.ADMIN,
    codes: ['payment-instruments:manage', 'payment-instruments:bounce'],
  };

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    req.user = { sub: FakeAuthGuard.user.sub, role: FakeAuthGuard.user.role, email: null, phone: null };
    return true;
  }
}

// ── Fixture state ────────────────────────────────────────────────────────────

interface PIFixture {
  id: string;
  type: PaymentInstrumentType;
  status: PaymentInstrumentStatus;
  chequeNumber: string | null;
  referenceNumber: string | null;
  bounceReason: string | null;
  bounceDate: Date | null;
  clearingDate: Date | null;
  replacedById: string | null;
  companyId: string;
  deposits: DepositFixture[];
}

interface DepositFixture {
  id: string;
  reviewStatus: DepositReviewStatus;
  installmentId: string | null;
  installment: { id: string; status: string; dueDate: Date; planId: string } | null;
}

const installmentPlanMap: Record<string, { contract: { customerId: string } }> = {
  [PLAN_ID]: { contract: { customerId: 'cust-001' } },
};

const createdInstallments: Array<{ id: string; type: string; planId: string; amount: unknown; status: string }> = [];
const createdAuditLogs: Array<{ action: string; entityId: string; after: unknown }> = [];

let piFixture: PIFixture | null = null;

function resetPendingClearance() {
  createdInstallments.length = 0;
  createdAuditLogs.length = 0;
  piFixture = {
    id: PI_ID,
    type: PaymentInstrumentType.CHEQUE,
    status: PaymentInstrumentStatus.PENDING_CLEARANCE,
    chequeNumber: 'CH-001',
    referenceNumber: null,
    bounceReason: null,
    bounceDate: null,
    clearingDate: null,
    replacedById: null,
    companyId: COMPANY_A,
    deposits: [],
  };
}

function resetDeposited(depositStatuses: DepositReviewStatus[] = [DepositReviewStatus.PENDING_REVIEW, DepositReviewStatus.PENDING_REVIEW]) {
  createdInstallments.length = 0;
  createdAuditLogs.length = 0;
  mock.paymentCorrection.create.mockClear();
  mock.installment.update.mockClear();
  piFixture = {
    id: PI_ID,
    type: PaymentInstrumentType.CHEQUE,
    status: PaymentInstrumentStatus.DEPOSITED,
    chequeNumber: 'CH-001',
    referenceNumber: null,
    bounceReason: null,
    bounceDate: null,
    clearingDate: null,
    replacedById: null,
    companyId: COMPANY_A,
    deposits: [
      {
        id: DEP1_ID,
        reviewStatus: depositStatuses[0]!,
        installmentId: INST1_ID,
        installment: { id: INST1_ID, status: 'PENDING', dueDate: new Date('2026-12-01'), planId: PLAN_ID },
      },
      {
        id: DEP2_ID,
        reviewStatus: depositStatuses[1]!,
        installmentId: INST2_ID,
        installment: { id: INST2_ID, status: 'PENDING', dueDate: new Date('2027-01-01'), planId: PLAN_ID },
      },
    ],
  };
}

function resetBounced() {
  createdInstallments.length = 0;
  createdAuditLogs.length = 0;
  piFixture = {
    id: PI_ID,
    type: PaymentInstrumentType.CHEQUE,
    status: PaymentInstrumentStatus.BOUNCED,
    chequeNumber: 'CH-001',
    referenceNumber: null,
    bounceReason: 'Insufficient funds',
    bounceDate: new Date('2027-01-08'),
    clearingDate: null,
    replacedById: null,
    companyId: COMPANY_A,
    deposits: [],
  };
}

// ── Mock Prisma ───────────────────────────────────────────────────────────────

function makePrismaMock() {
  const instIdGen = { n: 0 };

  const m = {
    userPermission: {
      findMany: jest.fn().mockImplementation(async () =>
        FakeAuthGuard.user.codes.map((code) => ({ permission: { code } })),
      ),
    },
    paymentInstrument: {
      findFirst: jest.fn().mockImplementation(async ({ where }: { where: { id: string; companyId: string } }) => {
        if (!piFixture) return null;
        if (piFixture.id !== where.id || piFixture.companyId !== where.companyId) return null;
        return { ...piFixture };
      }),
      create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'new-pi-' + Date.now(),
        ...data,
      })),
      update: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
        if (piFixture) Object.assign(piFixture, data);
        return { ...piFixture, ...data };
      }),
    },
    deposit: {
      updateMany: jest.fn().mockResolvedValue({ count: 2 }),
    },
    installment: {
      updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      update: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
        instIdGen.n += 1;
        const row = { id: `penalty-inst-${instIdGen.n}`, ...data };
        createdInstallments.push(row as unknown as typeof createdInstallments[0]);
        return row;
      }),
    },
    paymentCorrection: {
      create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        id: `corr-${Date.now()}`,
        ...data,
      })),
    },
    installmentPlan: {
      findFirst: jest.fn().mockImplementation(async ({ where }: { where: { id: string } }) =>
        installmentPlanMap[where.id] ?? null,
      ),
    },
    auditLog: {
      create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
        createdAuditLogs.push(data as unknown as typeof createdAuditLogs[0]);
        return { id: 'audit-1', ...data };
      }),
    },
    $transaction: jest.fn().mockImplementation(async (fn: unknown) => {
      if (typeof fn === 'function') {
        return fn({
          paymentInstrument: m.paymentInstrument,
          deposit: m.deposit,
          installment: m.installment,
          paymentCorrection: m.paymentCorrection,
          auditLog: m.auditLog,
        });
      }
      return fn;
    }),
  };
  return m;
}

let mock = makePrismaMock();

// ── Bootstrap ─────────────────────────────────────────────────────────────────

let app: INestApplication;

const notifMock = { sendToUser: jest.fn().mockResolvedValue(undefined) };

beforeAll(async () => {
  mock = makePrismaMock();

  @Global()
  @Module({
    providers: [{ provide: PrismaService, useValue: mock }],
    exports: [PrismaService],
  })
  class MockPrismaModule {}

  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true }),
      MockPrismaModule,
      PaymentInstrumentsModule,
    ],
    providers: [
      { provide: APP_GUARD, useClass: FakeAuthGuard },
      { provide: APP_GUARD, useClass: RolesGuard },
      { provide: APP_GUARD, useClass: PermissionsGuard },
      { provide: APP_INTERCEPTOR, useClass: FakeTenantInterceptor },
    ],
  })
    .overrideProvider(NotificationsService)
    .useValue(notifMock)
    .compile();

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

afterAll(async () => { await app.close(); });

beforeEach(() => {
  mock.paymentInstrument.findFirst.mockClear();
  mock.paymentInstrument.update.mockClear();
  mock.paymentInstrument.create.mockClear();
  mock.deposit.updateMany.mockClear();
  mock.installment.updateMany.mockClear();
  mock.installment.create.mockClear();
  mock.auditLog.create.mockClear();
  notifMock.sendToUser.mockClear();
  FakeAuthGuard.user = {
    sub: ADMIN_ID,
    role: UserRole.ADMIN,
    codes: ['payment-instruments:manage', 'payment-instruments:bounce'],
  };
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. State machine — valid transitions
// ─────────────────────────────────────────────────────────────────────────────

describe('valid state-machine transitions', () => {
  it('PENDING_CLEARANCE → DEPOSITED via POST /:id/deposit', async () => {
    resetPendingClearance();
    await request(app.getHttpServer()).post(`/payment-instruments/${PI_ID}/deposit`).expect(200);
    expect(mock.paymentInstrument.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: PaymentInstrumentStatus.DEPOSITED }) }),
    );
  });

  it('PENDING_CLEARANCE → CANCELLED via POST /:id/cancel', async () => {
    resetPendingClearance();
    await request(app.getHttpServer()).post(`/payment-instruments/${PI_ID}/cancel`).expect(200);
    expect(mock.paymentInstrument.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: PaymentInstrumentStatus.CANCELLED }) }),
    );
  });

  it('DEPOSITED → CLEARED via POST /:id/clear — marks linked deposits APPROVED and installments PAID', async () => {
    resetDeposited();
    await request(app.getHttpServer()).post(`/payment-instruments/${PI_ID}/clear`).send({}).expect(200);
    // instrument set to CLEARED
    expect(mock.paymentInstrument.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: PaymentInstrumentStatus.CLEARED }) }),
    );
    // deposits approved
    expect(mock.deposit.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ reviewStatus: DepositReviewStatus.APPROVED, verified: true }),
      }),
    );
    // installments paid
    expect(mock.installment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PAID' }),
      }),
    );
  });

  it('DEPOSITED → BOUNCED (Sub-case A) via POST /:id/bounce', async () => {
    resetDeposited();
    await request(app.getHttpServer())
      .post(`/payment-instruments/${PI_ID}/bounce`)
      .send({ bounceReason: 'Insufficient funds', bounceDate: '2027-01-08', penaltyAmount: 0 })
      .expect(200);
    expect(mock.paymentInstrument.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: PaymentInstrumentStatus.BOUNCED }) }),
    );
  });

  it('BOUNCED → REPLACED via POST /:id/replace', async () => {
    resetBounced();
    await request(app.getHttpServer())
      .post(`/payment-instruments/${PI_ID}/replace`)
      .send({ type: PaymentInstrumentType.CHEQUE, chequeNumber: 'CH-002', chequeDueDate: '2027-03-01' })
      .expect(201);
    expect(mock.paymentInstrument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: PaymentInstrumentStatus.PENDING_CLEARANCE }),
      }),
    );
    expect(mock.paymentInstrument.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: PaymentInstrumentStatus.REPLACED }),
      }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. State machine — invalid transitions
// ─────────────────────────────────────────────────────────────────────────────

describe('invalid state-machine transitions are rejected with 400', () => {
  it('CLEARED is terminal — POST /:id/deposit on CLEARED throws', async () => {
    piFixture = { ...piFixture!, status: PaymentInstrumentStatus.CLEARED };
    await request(app.getHttpServer()).post(`/payment-instruments/${PI_ID}/deposit`).expect(400);
  });

  it('CANCELLED is terminal — POST /:id/clear on CANCELLED throws', async () => {
    piFixture = { ...piFixture!, status: PaymentInstrumentStatus.CANCELLED };
    await request(app.getHttpServer()).post(`/payment-instruments/${PI_ID}/clear`).send({}).expect(400);
  });

  it('REPLACED is terminal — POST /:id/bounce on REPLACED throws', async () => {
    piFixture = { ...piFixture!, status: PaymentInstrumentStatus.REPLACED };
    await request(app.getHttpServer())
      .post(`/payment-instruments/${PI_ID}/bounce`)
      .send({ bounceReason: 'x', bounceDate: '2027-01-08', penaltyAmount: 0 })
      .expect(400);
  });

  it('PENDING_CLEARANCE → BOUNCED is not a valid transition', async () => {
    resetPendingClearance();
    await request(app.getHttpServer())
      .post(`/payment-instruments/${PI_ID}/bounce`)
      .send({ bounceReason: 'x', bounceDate: '2027-01-08', penaltyAmount: 0 })
      .expect(400);
  });

  it('DEPOSITED → CANCELLED is not a valid transition', async () => {
    resetDeposited();
    await request(app.getHttpServer()).post(`/payment-instruments/${PI_ID}/cancel`).expect(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Sub-case A bounce: PENDING_REVIEW deposits → REJECTED, installments unchanged, zero corrections
// ─────────────────────────────────────────────────────────────────────────────

describe('Sub-case A bounce — PENDING_REVIEW deposits become REJECTED', () => {
  beforeEach(() => resetDeposited());

  it('sets both PENDING_REVIEW deposits to REJECTED with a structured rejectionReason', async () => {
    await request(app.getHttpServer())
      .post(`/payment-instruments/${PI_ID}/bounce`)
      .send({ bounceReason: 'Insufficient funds', bounceDate: '2027-01-08', penaltyAmount: 0 })
      .expect(200);

    expect(mock.deposit.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: [DEP1_ID, DEP2_ID] } },
        data: expect.objectContaining({
          reviewStatus: DepositReviewStatus.REJECTED,
          rejectionReason: expect.stringContaining('CH-001'),
        }),
      }),
    );
  });

  it('rejectionReason contains the bounce date', async () => {
    await request(app.getHttpServer())
      .post(`/payment-instruments/${PI_ID}/bounce`)
      .send({ bounceReason: 'Insufficient funds', bounceDate: '2027-01-08', penaltyAmount: 0 })
      .expect(200);

    const call = mock.deposit.updateMany.mock.calls[0]![0] as {
      data: { rejectionReason: string };
    };
    expect(call.data.rejectionReason).toContain('2027-01-08');
  });

  it('does NOT call installment.updateMany — installments are unchanged', async () => {
    await request(app.getHttpServer())
      .post(`/payment-instruments/${PI_ID}/bounce`)
      .send({ bounceReason: 'Insufficient funds', bounceDate: '2027-01-08', penaltyAmount: 0 })
      .expect(200);

    expect(mock.installment.updateMany).not.toHaveBeenCalled();
  });

  it('writes ZERO PaymentCorrection rows', async () => {
    await request(app.getHttpServer())
      .post(`/payment-instruments/${PI_ID}/bounce`)
      .send({ bounceReason: 'Insufficient funds', bounceDate: '2027-01-08', penaltyAmount: 0 })
      .expect(200);

    expect(mock.paymentCorrection.create).not.toHaveBeenCalled();
  });

  it('writes an AuditLog entry with action=payment-instrument.bounced, subCase=A, correctionRowsWritten=0', async () => {
    await request(app.getHttpServer())
      .post(`/payment-instruments/${PI_ID}/bounce`)
      .send({ bounceReason: 'Insufficient funds', bounceDate: '2027-01-08', penaltyAmount: 0 })
      .expect(200);

    expect(createdAuditLogs).toHaveLength(1);
    const log = createdAuditLogs[0]!;
    expect(log.action).toBe('payment-instrument.bounced');
    expect(log.entityId).toBe(PI_ID);
    const after = log.after as Record<string, unknown>;
    expect(after.subCase).toBe('A');
    expect(after.correctionRowsWritten).toBe(0);
    expect(after.penaltyInstallmentId).toBeNull();
    expect(after.depositsSetToRejected).toEqual([DEP1_ID, DEP2_ID]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Bounce penalty — BOUNCE_PENALTY installment created only when penaltyAmount > 0
// ─────────────────────────────────────────────────────────────────────────────

describe('bounce penalty installment', () => {
  beforeEach(() => resetDeposited());

  it('penaltyAmount = 0 → no BOUNCE_PENALTY installment created', async () => {
    await request(app.getHttpServer())
      .post(`/payment-instruments/${PI_ID}/bounce`)
      .send({ bounceReason: 'Insufficient funds', bounceDate: '2027-01-08', penaltyAmount: 0 })
      .expect(200);

    expect(mock.installment.create).not.toHaveBeenCalled();
  });

  it('penaltyAmount > 0 → BOUNCE_PENALTY installment created with the operator-entered amount', async () => {
    await request(app.getHttpServer())
      .post(`/payment-instruments/${PI_ID}/bounce`)
      .send({
        bounceReason: 'Insufficient funds',
        bounceDate: '2027-01-08',
        penaltyAmount: 2500,
        penaltyDueDate: '2027-02-01',
      })
      .expect(200);

    expect(mock.installment.create).toHaveBeenCalledTimes(1);
    const args = mock.installment.create.mock.calls[0]![0] as {
      data: { type: string; amount: unknown; planId: string; dueDate: Date };
    };
    expect(args.data.type).toBe(PlanPaymentType.BOUNCE_PENALTY);
    expect(args.data.planId).toBe(PLAN_ID);
    expect(Number(args.data.amount)).toBe(2500);
    expect(args.data.dueDate).toBeInstanceOf(Date);
  });

  it('penaltyDueDate required when penaltyAmount > 0', async () => {
    await request(app.getHttpServer())
      .post(`/payment-instruments/${PI_ID}/bounce`)
      .send({ bounceReason: 'Insufficient funds', bounceDate: '2027-01-08', penaltyAmount: 1000 })
      .expect(400);
  });

  it('BOUNCE_PENALTY installment id is captured in the AuditLog entry', async () => {
    await request(app.getHttpServer())
      .post(`/payment-instruments/${PI_ID}/bounce`)
      .send({
        bounceReason: 'Insufficient funds',
        bounceDate: '2027-01-08',
        penaltyAmount: 1500,
        penaltyDueDate: '2027-02-15',
      })
      .expect(200);

    const log = createdAuditLogs[0]!;
    const after = log.after as Record<string, unknown>;
    expect(after.penaltyInstallmentId).not.toBeNull();
    expect(typeof after.penaltyInstallmentId).toBe('string');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Operator-entered values are stored (not the Settings suggestion)
// ─────────────────────────────────────────────────────────────────────────────

describe('operator values are stored verbatim', () => {
  beforeEach(() => resetDeposited());

  it('the exact bounceReason text the operator entered is stored on the PI', async () => {
    const operatorReason = 'Drawn on a closed account (account #12345 closed 2026-10-01)';
    await request(app.getHttpServer())
      .post(`/payment-instruments/${PI_ID}/bounce`)
      .send({ bounceReason: operatorReason, bounceDate: '2027-01-08', penaltyAmount: 0 })
      .expect(200);

    expect(mock.paymentInstrument.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ bounceReason: operatorReason }),
      }),
    );
  });

  it('the exact penaltyAmount the operator entered is stored (not a Settings default)', async () => {
    const operatorPenalty = 7777;
    await request(app.getHttpServer())
      .post(`/payment-instruments/${PI_ID}/bounce`)
      .send({
        bounceReason: 'Test',
        bounceDate: '2027-01-08',
        penaltyAmount: operatorPenalty,
        penaltyDueDate: '2027-02-01',
      })
      .expect(200);

    const args = mock.installment.create.mock.calls[0]![0] as {
      data: { amount: unknown };
    };
    expect(Number(args.data.amount)).toBe(operatorPenalty);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Sub-case B bounce — APPROVED deposits: PaymentCorrection written, installment reopened
// ─────────────────────────────────────────────────────────────────────────────

describe('Sub-case B bounce — APPROVED deposits get a PaymentCorrection(REVERSAL)', () => {
  function resetDepositedApproved(
    statuses: DepositReviewStatus[] = [DepositReviewStatus.APPROVED, DepositReviewStatus.APPROVED],
  ) {
    createdInstallments.length = 0;
    createdAuditLogs.length = 0;
    mock.paymentCorrection.create.mockClear();
    mock.installment.update.mockClear();
    piFixture = {
      id: PI_ID,
      type: PaymentInstrumentType.CHEQUE,
      status: PaymentInstrumentStatus.DEPOSITED,
      chequeNumber: 'CH-001',
      referenceNumber: null,
      bounceReason: null,
      bounceDate: null,
      clearingDate: null,
      replacedById: null,
      companyId: COMPANY_A,
      deposits: [
        {
          id: DEP1_ID,
          reviewStatus: statuses[0]!,
          installmentId: INST1_ID,
          installment: { id: INST1_ID, status: 'PAID', dueDate: new Date('2026-01-01'), planId: PLAN_ID },
        },
        {
          id: DEP2_ID,
          reviewStatus: statuses[1]!,
          installmentId: INST2_ID,
          installment: { id: INST2_ID, status: 'PAID', dueDate: new Date('2027-01-01'), planId: PLAN_ID },
        },
      ],
    };
  }

  it('returns 200 (no longer 501)', async () => {
    resetDepositedApproved();
    await request(app.getHttpServer())
      .post(`/payment-instruments/${PI_ID}/bounce`)
      .send({ bounceReason: 'Fraud', bounceDate: '2027-01-08', penaltyAmount: 0 })
      .expect(200);
  });

  it('writes one PaymentCorrection(REVERSAL) per APPROVED deposit', async () => {
    resetDepositedApproved();
    await request(app.getHttpServer())
      .post(`/payment-instruments/${PI_ID}/bounce`)
      .send({ bounceReason: 'Fraud', bounceDate: '2027-01-08', penaltyAmount: 0 })
      .expect(200);

    expect(mock.paymentCorrection.create).toHaveBeenCalledTimes(2);
    const firstCall = mock.paymentCorrection.create.mock.calls[0]![0] as {
      data: { type: string; depositId: string; sourceInstallmentId: string; reason: string };
    };
    expect(firstCall.data.type).toBe('REVERSAL');
    expect(firstCall.data.depositId).toBe(DEP1_ID);
    expect(firstCall.data.sourceInstallmentId).toBe(INST1_ID);
    expect(firstCall.data.reason).toBe('Fraud');
  });

  it('calls installment.update (NOT updateMany) once per APPROVED deposit', async () => {
    resetDepositedApproved();
    await request(app.getHttpServer())
      .post(`/payment-instruments/${PI_ID}/bounce`)
      .send({ bounceReason: 'Fraud', bounceDate: '2027-01-08', penaltyAmount: 0 })
      .expect(200);

    expect(mock.installment.update).toHaveBeenCalledTimes(2);
    // Hard Rule 2: paidAt MUST NOT appear in any installment.update call
    const calls = mock.installment.update.mock.calls as Array<[{ where: unknown; data: { status: string; paidAt?: unknown } }]>;
    for (const [call] of calls) {
      expect(call.data.paidAt).toBeUndefined();
    }
  });

  it('does NOT call deposit.updateMany (reviewStatus stays APPROVED — Hard Rule 2)', async () => {
    resetDepositedApproved();
    await request(app.getHttpServer())
      .post(`/payment-instruments/${PI_ID}/bounce`)
      .send({ bounceReason: 'Fraud', bounceDate: '2027-01-08', penaltyAmount: 0 })
      .expect(200);

    expect(mock.deposit.updateMany).not.toHaveBeenCalled();
  });

  it('REOPEN_AS_OVERDUE: past-due installment gets status OVERDUE', async () => {
    resetDepositedApproved([DepositReviewStatus.APPROVED, DepositReviewStatus.APPROVED]);
    // Both installments have past dueDates (2026-01-01, earlier in the series)
    await request(app.getHttpServer())
      .post(`/payment-instruments/${PI_ID}/bounce`)
      .send({
        bounceReason: 'Fraud',
        bounceDate: '2027-01-08',
        penaltyAmount: 0,
        installmentAction: 'REOPEN_AS_OVERDUE',
      })
      .expect(200);

    const calls = mock.installment.update.mock.calls as Array<[{ where: unknown; data: { status: string; paidAt?: unknown } }]>;
    // INST1 dueDate=2026-01-01 → OVERDUE; INST2 dueDate=2027-01-01 → depends on run date
    expect(calls[0]![0].data.status).toBe('OVERDUE');
    // Hard Rule 2: paidAt MUST NOT appear in any installment.update call
    for (const [call] of calls) {
      expect(call.data.paidAt).toBeUndefined();
    }
  });

  it('REOPEN_AS_PENDING: all installments get status PENDING regardless of dueDate', async () => {
    resetDepositedApproved();
    await request(app.getHttpServer())
      .post(`/payment-instruments/${PI_ID}/bounce`)
      .send({
        bounceReason: 'Fraud',
        bounceDate: '2027-01-08',
        penaltyAmount: 0,
        installmentAction: 'REOPEN_AS_PENDING',
      })
      .expect(200);

    const calls = mock.installment.update.mock.calls as Array<[{ where: unknown; data: { status: string; paidAt?: unknown } }]>;
    for (const [call] of calls) {
      expect(call.data.status).toBe('PENDING');
      // Hard Rule 2: paidAt MUST NOT appear in any installment.update call
      expect(call.data.paidAt).toBeUndefined();
    }
  });

  it('AuditLog subCase=B, correctionRowsWritten=2', async () => {
    resetDepositedApproved();
    await request(app.getHttpServer())
      .post(`/payment-instruments/${PI_ID}/bounce`)
      .send({ bounceReason: 'Fraud', bounceDate: '2027-01-08', penaltyAmount: 0 })
      .expect(200);

    expect(createdAuditLogs).toHaveLength(1);
    const after = createdAuditLogs[0]!.after as Record<string, unknown>;
    expect(after.subCase).toBe('B');
    expect(after.correctionRowsWritten).toBe(2);
  });

  it('mixed: PENDING_REVIEW gets REJECTED, APPROVED gets PaymentCorrection, AuditLog subCase=A+B', async () => {
    resetDepositedApproved([DepositReviewStatus.APPROVED, DepositReviewStatus.PENDING_REVIEW]);
    await request(app.getHttpServer())
      .post(`/payment-instruments/${PI_ID}/bounce`)
      .send({ bounceReason: 'Fraud', bounceDate: '2027-01-08', penaltyAmount: 0 })
      .expect(200);

    // DEP2 is PENDING_REVIEW → updateMany called with [DEP2_ID]
    expect(mock.deposit.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: [DEP2_ID] } } }),
    );
    // DEP1 is APPROVED → one correction written
    expect(mock.paymentCorrection.create).toHaveBeenCalledTimes(1);
    const after = createdAuditLogs[0]!.after as Record<string, unknown>;
    expect(after.subCase).toBe('A+B');
    expect(after.correctionRowsWritten).toBe(1);
    // Hard Rule 2: paidAt MUST NOT appear in the installment.update call for DEP1
    const instCalls = mock.installment.update.mock.calls as Array<[{ data: { paidAt?: unknown } }]>;
    for (const [call] of instCalls) {
      expect(call.data.paidAt).toBeUndefined();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Authorization — bounce endpoint requires ADMIN + strict permission
// ─────────────────────────────────────────────────────────────────────────────

describe('authorization', () => {
  beforeEach(() => resetDeposited());

  it('SALES_MANAGER cannot access POST /:id/bounce (roles gate)', async () => {
    FakeAuthGuard.user = {
      sub: 'sm-01',
      role: UserRole.SALES_MANAGER,
      codes: ['payment-instruments:manage', 'payment-instruments:bounce'],
    };
    await request(app.getHttpServer())
      .post(`/payment-instruments/${PI_ID}/bounce`)
      .send({ bounceReason: 'x', bounceDate: '2027-01-08', penaltyAmount: 0 })
      .expect(403);
  });

  it('ADMIN without payment-instruments:bounce is blocked by @PermissionsStrict', async () => {
    FakeAuthGuard.user = {
      sub: ADMIN_ID,
      role: UserRole.ADMIN,
      codes: ['payment-instruments:manage'],  // missing bounce
    };
    await request(app.getHttpServer())
      .post(`/payment-instruments/${PI_ID}/bounce`)
      .send({ bounceReason: 'x', bounceDate: '2027-01-08', penaltyAmount: 0 })
      .expect(403);
  });

  it('SALES_MANAGER CAN create an instrument (payment-instruments:manage)', async () => {
    FakeAuthGuard.user = {
      sub: 'sm-01',
      role: UserRole.SALES_MANAGER,
      codes: ['payment-instruments:manage'],
    };
    piFixture = null;
    await request(app.getHttpServer())
      .post('/payment-instruments')
      .send({ type: PaymentInstrumentType.CHEQUE, chequeNumber: 'CH-999' })
      .expect(201);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. Integration — S1 walkthrough steps 1–3 state assertions
// ─────────────────────────────────────────────────────────────────────────────

describe('S1 walkthrough — steps 1–3', () => {
  /**
   * Step 1: Admin creates CHEQUE instrument for installments 3, 4, 5.
   * Step 2: Admin marks it DEPOSITED.
   * Step 3: Bank returns it BOUNCED (Sub-case A). Operator enters EGP 0 penalty.
   *
   * Expected final state per design §4.6:
   * - PI1: BOUNCED, bounceDate set, bounceReason set
   * - D3, D4, D5: REJECTED with rejectionReason naming the cheque and bounce date
   * - Inst3, Inst4, Inst5: unchanged (PENDING/OVERDUE)
   * - No PaymentCorrection rows
   * - No BOUNCE_PENALTY installment (penalty = 0)
   * - AuditLog: action=payment-instrument.bounced, subCase=A, correctionRowsWritten=0, penaltyInstallmentId=null
   */
  it('completes all three steps and reaches the expected final state', async () => {
    createdInstallments.length = 0;
    createdAuditLogs.length = 0;

    // Step 1: create instrument
    mock.paymentInstrument.create.mockResolvedValueOnce({
      id: PI_ID,
      type: PaymentInstrumentType.CHEQUE,
      chequeNumber: 'CH-001',
      drawerBankName: 'Banque Misr',
      chequeDueDate: new Date('2027-01-05'),
      status: PaymentInstrumentStatus.PENDING_CLEARANCE,
      companyId: COMPANY_A,
      recordedById: ADMIN_ID,
    });

    const createRes = await request(app.getHttpServer())
      .post('/payment-instruments')
      .send({
        type: 'CHEQUE',
        chequeNumber: 'CH-001',
        drawerBankName: 'Banque Misr',
        chequeDueDate: '2027-01-05',
      })
      .expect(201);

    expect(createRes.body.status).toBe(PaymentInstrumentStatus.PENDING_CLEARANCE);
    expect(createRes.body.chequeNumber).toBe('CH-001');

    // Step 2: PENDING_CLEARANCE → DEPOSITED
    resetPendingClearance();
    await request(app.getHttpServer())
      .post(`/payment-instruments/${PI_ID}/deposit`)
      .expect(200);

    expect(piFixture?.status).toBe(PaymentInstrumentStatus.DEPOSITED);

    // Step 3: DEPOSITED → BOUNCED (Sub-case A, zero penalty)
    // Re-configure fixture as DEPOSITED with 3 PENDING_REVIEW deposits
    piFixture = {
      id: PI_ID,
      type: PaymentInstrumentType.CHEQUE,
      status: PaymentInstrumentStatus.DEPOSITED,
      chequeNumber: 'CH-001',
      referenceNumber: null,
      bounceReason: null,
      bounceDate: null,
      clearingDate: null,
      replacedById: null,
      companyId: COMPANY_A,
      deposits: [
        {
          id: DEP1_ID,
          reviewStatus: DepositReviewStatus.PENDING_REVIEW,
          installmentId: INST1_ID,
          installment: { id: INST1_ID, status: 'OVERDUE', dueDate: new Date('2026-12-01'), planId: PLAN_ID },
        },
        {
          id: DEP2_ID,
          reviewStatus: DepositReviewStatus.PENDING_REVIEW,
          installmentId: INST2_ID,
          installment: { id: INST2_ID, status: 'PENDING', dueDate: new Date('2027-01-01'), planId: PLAN_ID },
        },
        {
          id: 'dep3-id',
          reviewStatus: DepositReviewStatus.PENDING_REVIEW,
          installmentId: 'inst3-id',
          installment: { id: 'inst3-id', status: 'PENDING', dueDate: new Date('2027-02-01'), planId: PLAN_ID },
        },
      ],
    };

    await request(app.getHttpServer())
      .post(`/payment-instruments/${PI_ID}/bounce`)
      .send({
        bounceReason: 'Insufficient funds',
        bounceDate: '2027-01-08',
        penaltyAmount: 0,
      })
      .expect(200);

    // ── S1 Step 3 assertions ──────────────────────────────────────────────

    // PI: BOUNCED with correct fields
    expect(piFixture?.status).toBe(PaymentInstrumentStatus.BOUNCED);
    expect(piFixture?.bounceReason).toBe('Insufficient funds');
    expect(piFixture?.bounceDate).toEqual(new Date('2027-01-08'));

    // Deposits: all three set to REJECTED
    expect(mock.deposit.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: [DEP1_ID, DEP2_ID, 'dep3-id'] } },
        data: expect.objectContaining({ reviewStatus: DepositReviewStatus.REJECTED }),
      }),
    );

    // Installments: NOT touched
    expect(mock.installment.updateMany).not.toHaveBeenCalled();

    // No BOUNCE_PENALTY installment
    expect(mock.installment.create).not.toHaveBeenCalled();

    // AuditLog: subCase A, correctionRowsWritten=0, penaltyInstallmentId=null
    expect(createdAuditLogs).toHaveLength(1);
    const auditEntry = createdAuditLogs[0]!;
    const after = auditEntry.after as Record<string, unknown>;
    expect(after.subCase).toBe('A');
    expect(after.correctionRowsWritten).toBe(0);
    expect(after.penaltyInstallmentId).toBeNull();
    expect(after.affectedDepositIds).toEqual([DEP1_ID, DEP2_ID, 'dep3-id']);
  });
});
