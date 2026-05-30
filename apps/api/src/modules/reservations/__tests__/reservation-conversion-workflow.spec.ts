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

/**
 * Reservation → Contract conversion workflow.
 *
 * Where the permissions spec asserts "the gate fires", this spec asserts the
 * downstream side effects of a successful POST /reservations/:id/convert:
 *   - contract is created (unsigned) with broker attribution inherited
 *   - unit transitions to SOLD with audit row
 *   - installment plan + DOWN_PAYMENT + monthly + FINAL_PAYMENT rows materialize
 *     when the reservation carries a duration snapshot
 *   - CLIENT promotion to CUSTOMER
 *   - reservation moves to CONVERTED with activity row
 *   - lead advances to WON when in a bumpable stage
 *   - booking-payment confirmation creates the booking-amount deposit
 *
 * The mock keeps a single mutable reservation fixture; tests mutate the
 * fixture to exercise branches (snapshot present / absent, broker / no
 * broker, etc.) before issuing the HTTP request.
 */

const RESERVATION_ID = 'a1111111-1111-4111-8111-111111111111';
const PATH_CONVERT = `/reservations/${RESERVATION_ID}/convert`;
const PATH_BOOKING_CONFIRM = `/reservations/${RESERVATION_ID}/booking-payment/confirm`;

type RStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED' | 'CONVERTED';

interface DecimalLike {
  gt: (n: number) => boolean;
  lte: (n: number) => boolean;
  toString: () => string;
}

function decimal(n: number): DecimalLike {
  return {
    gt: (x: number) => n > x,
    lte: (x: number) => n <= x,
    toString: () => String(n),
  };
}

interface ReservationFixture {
  id: string;
  reservationNumber: string;
  status: RStatus;
  unitId: string;
  leadId: string | null;
  clientId: string | null;
  contract: { id: string } | null;
  bookingAmount: DecimalLike;
  bookingPaymentStatus: 'UNPAID' | 'PENDING' | 'PAID' | 'WAIVED';
  brokerId: string | null;
  brokerAgentId: string | null;
  installmentPlanTemplateId: string | null;
  selectedDurationMonths: number | null;
  selectedIncreasePercentage: DecimalLike | null;
  snapshotDownPaymentAmount: DecimalLike | null;
  snapshotFinancedAmount: DecimalLike | null;
  snapshotMonthlyInstallment: DecimalLike | null;
  snapshotTotalPayable: DecimalLike | null;
  snapshotFinalPaymentAmount: DecimalLike | null;
  unit: {
    id: string;
    code: string;
    status: 'AVAILABLE' | 'RESERVED' | 'SOLD';
    price: number;
    building: { phase: { projectId: string } };
  };
  lead: { id: string; clientId: string | null; stage: string } | null;
  client: { id: string } | null;
}

const fixture: { reservation: ReservationFixture } = {
  reservation: {} as never,
};

function resetFixture() {
  fixture.reservation = {
    id: RESERVATION_ID,
    reservationNumber: 'RES-0001',
    status: 'APPROVED',
    unitId: 'unit-1',
    leadId: 'lead-1',
    clientId: 'client-1',
    contract: null,
    bookingAmount: decimal(1000),
    bookingPaymentStatus: 'PAID',
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
      create: jest.fn().mockResolvedValue({ id: 'r-new' }),
      update: jest.fn().mockImplementation(async ({ where, data }) => ({
        ...fixture.reservation,
        ...data,
        id: where.id,
      })),
    },
    reservationActivity: {
      create: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
    },
    reservationNote: { create: jest.fn().mockResolvedValue({}) },
    leadActivity: { create: jest.fn().mockResolvedValue({}) },
    unit: {
      findUnique: jest.fn().mockImplementation(async () => fixture.reservation.unit),
      update: jest.fn().mockResolvedValue({}),
    },
    unitStatusHistory: { create: jest.fn().mockResolvedValue({}) },
    user: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      // P12 — NotificationsService.send reads the recipient locale for push.
      findUnique: jest.fn().mockResolvedValue({ locale: 'ar' }),
    },
    contract: {
      findMany: jest.fn().mockResolvedValue([]),
      // P12 — ContractsService.handleConvertedContract looks the contract up
      // (buildContractPayload, owner-exists check, notify lookup).
      findUnique: jest.fn().mockResolvedValue({
        id: 'contract-new',
        customerId: 'client-1',
        contractNumber: 'C-0001',
        unit: { code: 'A101', building: { phase: { project: { name: { ar: 'مشروع' } } } } },
      }),
      create: jest.fn().mockImplementation(async ({ data }) => ({
        id: 'contract-new',
        contractNumber: data.contractNumber,
        ...data,
      })),
    },
    installmentPlan: { create: jest.fn().mockResolvedValue({ id: 'plan-1' }) },
    installment: {
      create: jest.fn().mockResolvedValue({}),
      createMany: jest.fn().mockResolvedValue({ count: 12 }),
    },
    deposit: {
      create: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    lead: { update: jest.fn().mockResolvedValue({}) },
    brokerUser: { findMany: jest.fn().mockResolvedValue([]) },
    // P12 — contract-document linking (after the tx) + notification delivery.
    document: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(async ({ data }) => ({ id: 'doc-1', ...data })),
    },
    notification: {
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn().mockResolvedValue({ id: 'n-1', sentAt: new Date() }),
    },
    notificationTemplate: {
      findUnique: jest.fn().mockResolvedValue({
        code: 'tpl', channel: 'IN_APP',
        subject: { ar: 's', en: 's' }, body: { ar: 'b', en: 'b' },
      }),
    },
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

describe('Reservations · conversion workflow', () => {
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
      imports: [MockPrismaModule, ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), ReservationsModule],
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
      codes: ['reservations:convert', 'reservations:booking-payment'],
    };
    resetFixture();
    for (const grp of Object.values(mock)) {
      if (typeof grp === 'object' && grp !== null) {
        for (const v of Object.values(grp)) {
          if (typeof v === 'function' && 'mockClear' in v) {
            (v as jest.Mock).mockClear();
          }
        }
      }
    }
  });

  // ── Happy path: minimum-shape APPROVED reservation, no plan, no broker ──

  it('converts an APPROVED reservation: contract (unsigned) + unit SOLD + reservation CONVERTED + lead WON', async () => {
    // Use the default fixture (APPROVED, paid booking, no plan, no broker).
    const res = await request(app.getHttpServer())
      .post(PATH_CONVERT)
      .send({})
      .expect(201);

    // Contract is created exactly once, with signedAt = null (the legacy
    // convert→signed bypass is closed).
    expect(mock.contract.create).toHaveBeenCalledTimes(1);
    const contractArgs = mock.contract.create.mock.calls[0]![0] as {
      data: { signedAt: Date | null; brokerId: string | null; brokerAgentId: string | null };
    };
    expect(contractArgs.data.signedAt).toBeNull();
    expect(contractArgs.data.brokerId).toBeNull();

    // Unit transitions to SOLD with an audit row.
    const unitUpdateArgs = mock.unit.update.mock.calls[0]![0] as {
      data: { status: string; reservationExpiresAt: null };
    };
    expect(unitUpdateArgs.data.status).toBe('SOLD');
    expect(mock.unitStatusHistory.create).toHaveBeenCalledTimes(1);

    // Reservation row is updated to CONVERTED and gets a CONVERTED activity.
    const reservationUpdate = mock.reservation.update.mock.calls[0]![0] as {
      data: { status: string };
    };
    expect(reservationUpdate.data.status).toBe('CONVERTED');
    const activityArgs = mock.reservationActivity.create.mock.calls[0]![0] as {
      data: { type: string };
    };
    expect(activityArgs.data.type).toBe('CONVERTED');

    // CLIENT → CUSTOMER promotion is attempted for the customer.
    expect(mock.user.updateMany).toHaveBeenCalled();
    const userUpdateArgs = mock.user.updateMany.mock.calls[0]![0] as {
      where: { role: string };
      data: { role: string };
    };
    expect(userUpdateArgs.where.role).toBe('CLIENT');
    expect(userUpdateArgs.data.role).toBe('CUSTOMER');

    // No snapshot ⇒ no installment plan rows.
    expect(mock.installmentPlan.create).not.toHaveBeenCalled();
    expect(mock.installment.create).not.toHaveBeenCalled();
    expect(mock.installment.createMany).not.toHaveBeenCalled();

    // Lead advances to WON because seed stage is NEGOTIATION (bumpable).
    const leadUpdate = mock.lead.update.mock.calls[0]?.[0] as
      | { data: { stage: string } }
      | undefined;
    expect(leadUpdate?.data.stage).toBe('WON');

    expect(res.body).toMatchObject({ contractId: 'contract-new' });
  });

  // ── Installment plan materialization ─────────────────────────────────────

  it('materializes installment plan + DOWN_PAYMENT + monthly + FINAL_PAYMENT rows when snapshot is present', async () => {
    fixture.reservation.installmentPlanTemplateId = 'tpl-1';
    fixture.reservation.selectedDurationMonths = 12;
    fixture.reservation.selectedIncreasePercentage = decimal(5);
    fixture.reservation.snapshotDownPaymentAmount = decimal(20000);
    fixture.reservation.snapshotFinancedAmount = decimal(85000);
    fixture.reservation.snapshotMonthlyInstallment = decimal(7100);
    fixture.reservation.snapshotTotalPayable = decimal(105000);
    fixture.reservation.snapshotFinalPaymentAmount = decimal(0);

    await request(app.getHttpServer())
      .post(PATH_CONVERT)
      .send({ startsAt: '2030-01-01T00:00:00Z' })
      .expect(201);

    expect(mock.installmentPlan.create).toHaveBeenCalledTimes(1);
    const planArgs = mock.installmentPlan.create.mock.calls[0]![0] as {
      data: { totalMonths: number; frequency: string };
    };
    expect(planArgs.data.totalMonths).toBe(12);
    expect(planArgs.data.frequency).toBe('MONTHLY');

    // DOWN_PAYMENT row (downPayment > 0) + monthly rows (createMany once with 12 rows).
    const downPaymentCreate = mock.installment.create.mock.calls.find(
      (c) => (c[0] as { data: { type: string } }).data.type === 'DOWN_PAYMENT',
    );
    expect(downPaymentCreate).toBeDefined();
    expect(mock.installment.createMany).toHaveBeenCalledTimes(1);
    const monthlyArgs = mock.installment.createMany.mock.calls[0]![0] as {
      data: Array<{ type: string }>;
    };
    expect(monthlyArgs.data).toHaveLength(12);
    expect(monthlyArgs.data.every((r) => r.type === 'INSTALLMENT')).toBe(true);
  });

  it('skips FINAL_PAYMENT row when snapshotFinalPaymentAmount is zero or absent', async () => {
    fixture.reservation.installmentPlanTemplateId = 'tpl-1';
    fixture.reservation.selectedDurationMonths = 6;
    fixture.reservation.selectedIncreasePercentage = decimal(0);
    fixture.reservation.snapshotDownPaymentAmount = decimal(10000);
    fixture.reservation.snapshotFinancedAmount = decimal(30000);
    fixture.reservation.snapshotMonthlyInstallment = decimal(5000);
    fixture.reservation.snapshotTotalPayable = decimal(40000);
    fixture.reservation.snapshotFinalPaymentAmount = decimal(0);

    await request(app.getHttpServer())
      .post(PATH_CONVERT)
      .send({ startsAt: '2030-01-01T00:00:00Z' })
      .expect(201);

    const finalCreate = mock.installment.create.mock.calls.find(
      (c) => (c[0] as { data: { type: string } }).data.type === 'FINAL_PAYMENT',
    );
    expect(finalCreate).toBeUndefined();
  });

  // ── Business validation: state machine + booking payment + snapshot ─────

  it('rejects conversion when reservation status is not APPROVED (400)', async () => {
    fixture.reservation.status = 'PENDING';
    await request(app.getHttpServer()).post(PATH_CONVERT).send({}).expect(400);
    expect(mock.contract.create).not.toHaveBeenCalled();
    expect(mock.unit.update).not.toHaveBeenCalled();
  });

  it('rejects conversion when booking payment is still UNPAID and amount > 0 (400)', async () => {
    fixture.reservation.bookingPaymentStatus = 'UNPAID';
    fixture.reservation.bookingAmount = decimal(2500); // > 0
    await request(app.getHttpServer()).post(PATH_CONVERT).send({}).expect(400);
    expect(mock.contract.create).not.toHaveBeenCalled();
  });

  it('rejects conversion when reservation is already linked to a contract (400)', async () => {
    fixture.reservation.contract = { id: 'existing-contract' };
    await request(app.getHttpServer()).post(PATH_CONVERT).send({}).expect(400);
    expect(mock.contract.create).not.toHaveBeenCalled();
    expect(mock.reservation.update).not.toHaveBeenCalled();
  });

  it('rejects conversion when plan template is set but snapshot fields are missing (400)', async () => {
    fixture.reservation.installmentPlanTemplateId = 'tpl-1';
    fixture.reservation.selectedDurationMonths = null; // missing
    await request(app.getHttpServer())
      .post(PATH_CONVERT)
      .send({ startsAt: '2030-01-01T00:00:00Z' })
      .expect(400);
    expect(mock.contract.create).not.toHaveBeenCalled();
  });

  it('rejects conversion when duration is set but startsAt is missing (400)', async () => {
    fixture.reservation.installmentPlanTemplateId = 'tpl-1';
    fixture.reservation.selectedDurationMonths = 6;
    fixture.reservation.selectedIncreasePercentage = decimal(0);
    fixture.reservation.snapshotDownPaymentAmount = decimal(0);
    fixture.reservation.snapshotFinancedAmount = decimal(30000);
    fixture.reservation.snapshotMonthlyInstallment = decimal(5000);
    fixture.reservation.snapshotTotalPayable = decimal(30000);
    await request(app.getHttpServer()).post(PATH_CONVERT).send({}).expect(400);
    expect(mock.installmentPlan.create).not.toHaveBeenCalled();
  });

  // ── Convert→sign bypass remains closed ──────────────────────────────────

  it('rejects POST /convert when signedAt is supplied (400, ValidationPipe whitelist)', async () => {
    const res = await request(app.getHttpServer())
      .post(PATH_CONVERT)
      .send({ signedAt: '2030-05-19T00:00:00Z' })
      .expect(400);
    expect(JSON.stringify(res.body)).toContain('signedAt');
    expect(mock.contract.create).not.toHaveBeenCalled();
  });

  // ── Broker attribution inherited from reservation ───────────────────────

  it('inherits broker attribution from the source reservation when present', async () => {
    fixture.reservation.brokerId = 'broker-1';
    fixture.reservation.brokerAgentId = 'agent-1';

    await request(app.getHttpServer()).post(PATH_CONVERT).send({}).expect(201);

    const contractArgs = mock.contract.create.mock.calls[0]![0] as {
      data: { brokerId: string | null; brokerAgentId: string | null; signedAt: Date | null };
    };
    expect(contractArgs.data.brokerId).toBe('broker-1');
    expect(contractArgs.data.brokerAgentId).toBe('agent-1');
    // Still unsigned — broker commission only materializes on /contracts/:id/sign.
    expect(contractArgs.data.signedAt).toBeNull();
  });

  // ── P12 — contract document linking + customer notifications ─────────────

  it('converting with an uploaded pdfUrl registers a CUSTOMER_VISIBLE CONTRACT document linked to the contract', async () => {
    await request(app.getHttpServer())
      .post(PATH_CONVERT)
      .send({
        pdfUrl: 'https://cdn.example/contract.pdf',
        fileName: 'contract.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 4096,
      })
      .expect(201);

    // The uploaded file becomes a first-class Document owned by the contract,
    // customer-visible so it shows in the Documents Center AND downloads via
    // the signed-download endpoint.
    expect(mock.document.create).toHaveBeenCalledTimes(1);
    const docData = mock.document.create.mock.calls[0]![0] as {
      data: {
        ownerType: string;
        ownerId: string;
        category: string;
        visibility: string;
        fileUrl: string;
        fileName: string;
      };
    };
    expect(docData.data).toMatchObject({
      ownerType: 'CONTRACT',
      ownerId: 'contract-new',
      category: 'CONTRACT',
      visibility: 'CUSTOMER_VISIBLE',
      fileUrl: 'https://cdn.example/contract.pdf',
      fileName: 'contract.pdf',
    });

    // Both customer notifications fire: contract created + document available.
    const firedCodes = mock.notification.create.mock.calls.map(
      (c) => (c[0] as { data: { templateCode: string } }).data.templateCode,
    );
    expect(firedCodes).toContain('contract_created_customer');
    expect(firedCodes).toContain('contract_document_available');
  });

  it('converting without a pdfUrl notifies contract_created_customer but registers no document', async () => {
    await request(app.getHttpServer()).post(PATH_CONVERT).send({}).expect(201);

    expect(mock.document.create).not.toHaveBeenCalled();
    const firedCodes = mock.notification.create.mock.calls.map(
      (c) => (c[0] as { data: { templateCode: string } }).data.templateCode,
    );
    expect(firedCodes).toContain('contract_created_customer');
    expect(firedCodes).not.toContain('contract_document_available');
  });

  // ── Booking-payment confirmation ────────────────────────────────────────

  it('confirms booking payment: marks reservation PAID + deletes prior BOOKING_AMOUNT deposit + creates a new one', async () => {
    fixture.reservation.status = 'PENDING';
    fixture.reservation.bookingPaymentStatus = 'UNPAID';
    fixture.reservation.bookingAmount = decimal(1500);

    await request(app.getHttpServer())
      .post(PATH_BOOKING_CONFIRM)
      .send({ paidAt: '2030-01-15T00:00:00Z', note: 'cash at office' })
      .expect(201);

    // Reservation row updated.
    const updateArgs = mock.reservation.update.mock.calls[0]![0] as {
      data: { bookingPaymentStatus: string; bookingPaidAt: Date };
    };
    expect(updateArgs.data.bookingPaymentStatus).toBe('PAID');
    expect(updateArgs.data.bookingPaidAt).toBeInstanceOf(Date);

    // Old deposit (if any) removed before creating the new one — guarantees
    // idempotence under repeated confirm calls.
    expect(mock.deposit.deleteMany).toHaveBeenCalledTimes(1);
    expect(mock.deposit.create).toHaveBeenCalledTimes(1);
    const depositArgs = mock.deposit.create.mock.calls[0]![0] as {
      data: { type: string; reservationId: string; verified: boolean; contractId: null };
    };
    expect(depositArgs.data.type).toBe('BOOKING_AMOUNT');
    expect(depositArgs.data.verified).toBe(true);
    expect(depositArgs.data.contractId).toBeNull();

    // BOOKING_PAYMENT_CONFIRMED activity row written.
    const activityArgs = mock.reservationActivity.create.mock.calls[0]![0] as {
      data: { type: string };
    };
    expect(activityArgs.data.type).toBe('BOOKING_PAYMENT_CONFIRMED');
  });

  it('rejects booking payment confirm when reservation is already CONVERTED (400)', async () => {
    fixture.reservation.status = 'CONVERTED';
    await request(app.getHttpServer())
      .post(PATH_BOOKING_CONFIRM)
      .send({})
      .expect(400);
    expect(mock.deposit.create).not.toHaveBeenCalled();
    expect(mock.reservation.update).not.toHaveBeenCalled();
  });

  it('rejects booking payment confirm when booking amount is zero (400)', async () => {
    fixture.reservation.status = 'PENDING';
    fixture.reservation.bookingAmount = decimal(0);
    await request(app.getHttpServer())
      .post(PATH_BOOKING_CONFIRM)
      .send({})
      .expect(400);
    expect(mock.deposit.create).not.toHaveBeenCalled();
  });
});
