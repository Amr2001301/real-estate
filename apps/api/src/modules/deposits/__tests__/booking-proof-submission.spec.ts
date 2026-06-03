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
import { Prisma, UserRole } from '@prisma/client';
import { DepositsModule } from '../deposits.module';
import { DocumentsService } from '../../documents/documents.module';
import { NotificationsService } from '../../notifications/notifications.module';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { PrismaService } from '../../../common/prisma/prisma.service';

/**
 * Gap 3 — customer submits a payment proof for a reservation's BOOKING_AMOUNT
 * via POST /me/deposits with `reservationId`. Covers the new branch plus
 * backward-compatibility of the installment (`installmentId`) path.
 */

const CUSTOMER_ID = 'cust-1';
const OTHER_CUSTOMER_ID = 'cust-2';
const RES_ID = 'eeeeeeee-1111-4111-8111-111111111111';
const INST_ID = 'aaaaaaaa-2222-4222-8222-222222222222';
const NEW_DEPOSIT_ID = 'dddddddd-cccc-4ccc-8ccc-cccccccccccc';

const documentsMock = { create: jest.fn().mockResolvedValue({ id: 'doc-1' }) };
const notificationsMock = {
  sendToUser: jest.fn().mockResolvedValue(undefined),
  sendToUsers: jest.fn().mockResolvedValue(undefined),
  sendToRoles: jest.fn().mockResolvedValue(undefined),
};

type Reservation = Record<string, unknown> | null;
type Installment = Record<string, unknown> | null;
const fixture: { reservation: Reservation; installment: Installment } = {
  reservation: null,
  installment: null,
};

function resetFixture() {
  fixture.reservation = {
    id: RES_ID,
    clientId: CUSTOMER_ID,
    reservationNumber: 'R-2026-1',
    bookingAmount: new Prisma.Decimal(50000),
    bookingPaymentStatus: 'UNPAID',
    lead: null,
    unit: { building: { phase: { projectId: 'proj-1' } } },
    deposits: [],
  };
  fixture.installment = {
    id: INST_ID,
    type: 'DOWN_PAYMENT',
    status: 'PENDING',
    amount: new Prisma.Decimal(20000),
    dueDate: new Date('2030-05-01T00:00:00.000Z'),
    plan: { contractId: 'contract-1', contract: { id: 'contract-1', customerId: CUSTOMER_ID } },
  };
}

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
    userPermission: {
      findMany: jest.fn().mockImplementation(async () => {
        const u = FakeAuthGuard.currentUser;
        return (u?.codes ?? []).map((code) => ({ permission: { code } }));
      }),
    },
    user: { findMany: jest.fn().mockResolvedValue([]) },
    reservation: {
      findUnique: jest.fn().mockImplementation(async () => fixture.reservation),
      update: jest.fn().mockResolvedValue({}),
    },
    installment: {
      findFirst: jest.fn().mockImplementation(async () => fixture.installment),
    },
    deposit: {
      // Used by resolveProjectIdForDeposit on the installment path.
      findUnique: jest.fn().mockResolvedValue({ contract: null }),
      create: jest.fn().mockImplementation(async ({ data }) => ({
        id: NEW_DEPOSIT_ID,
        ...data,
        amount: data.amount ?? new Prisma.Decimal(0),
      })),
      update: jest.fn().mockImplementation(async ({ where, data }) => ({
        id: where.id,
        amount: new Prisma.Decimal(50000),
        reservationId: RES_ID,
        ...data,
      })),
    },
  };
  return m;
}

let mock = makePrismaMock();

describe('Deposits · customer booking-amount proof submission (Gap 3)', () => {
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
      imports: [ConfigModule.forRoot({ isGlobal: true }), MockPrismaModule, DepositsModule],
      providers: [
        { provide: APP_GUARD, useClass: FakeAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
      ],
    })
      .overrideProvider(DocumentsService)
      .useValue(documentsMock)
      .overrideProvider(NotificationsService)
      .useValue(notificationsMock)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    FakeAuthGuard.currentUser = { sub: CUSTOMER_ID, role: UserRole.CUSTOMER, codes: [] };
    resetFixture();
    mock.reservation.findUnique.mockClear();
    mock.reservation.update.mockClear();
    mock.installment.findFirst.mockClear();
    mock.deposit.create.mockClear();
    mock.deposit.update.mockClear();
    mock.user.findMany.mockClear();
    documentsMock.create.mockClear();
    notificationsMock.sendToUser.mockClear();
  });

  const bookingBody = {
    reservationId: RES_ID,
    paidAt: '2030-04-10T00:00:00.000Z',
    paymentMethod: 'BANK_TRANSFER',
    receiptUrl: 'https://cdn.example/booking-proof.pdf',
  };

  it('creates a BOOKING_AMOUNT deposit, sets the reservation PENDING, and notifies staff', async () => {
    await request(app.getHttpServer()).post('/me/deposits').send(bookingBody).expect(201);

    expect(mock.deposit.create).toHaveBeenCalledTimes(1);
    const createArgs = mock.deposit.create.mock.calls[0]![0] as {
      data: { type: string; reservationId: string; contractId: null; amount: unknown };
    };
    expect(createArgs.data.type).toBe('BOOKING_AMOUNT');
    expect(createArgs.data.reservationId).toBe(RES_ID);
    expect(createArgs.data.contractId).toBeNull();
    // Amount is the reservation's authoritative bookingAmount.
    expect(String(createArgs.data.amount)).toBe('50000');

    // Reservation reflects "awaiting review".
    const resvArgs = mock.reservation.update.mock.calls[0]![0] as {
      where: { id: string };
      data: { bookingPaymentStatus: string };
    };
    expect(resvArgs.where.id).toBe(RES_ID);
    expect(resvArgs.data.bookingPaymentStatus).toBe('PENDING');
  });

  it("returns 404 for another customer's reservation (no existence leak)", async () => {
    (fixture.reservation as Record<string, unknown>).clientId = OTHER_CUSTOMER_ID;
    await request(app.getHttpServer()).post('/me/deposits').send(bookingBody).expect(404);
    expect(mock.deposit.create).not.toHaveBeenCalled();
  });

  it('allows ownership through the linked lead client', async () => {
    (fixture.reservation as Record<string, unknown>).clientId = null;
    (fixture.reservation as Record<string, unknown>).lead = { clientId: CUSTOMER_ID };
    await request(app.getHttpServer()).post('/me/deposits').send(bookingBody).expect(201);
    expect(mock.deposit.create).toHaveBeenCalledTimes(1);
  });

  it('rejects when the booking is already PAID (400)', async () => {
    (fixture.reservation as Record<string, unknown>).bookingPaymentStatus = 'PAID';
    await request(app.getHttpServer()).post('/me/deposits').send(bookingBody).expect(400);
    expect(mock.deposit.create).not.toHaveBeenCalled();
  });

  it('rejects when the booking is WAIVED (400)', async () => {
    (fixture.reservation as Record<string, unknown>).bookingPaymentStatus = 'WAIVED';
    await request(app.getHttpServer()).post('/me/deposits').send(bookingBody).expect(400);
    expect(mock.deposit.create).not.toHaveBeenCalled();
  });

  it('blocks a duplicate pending booking proof (400)', async () => {
    (fixture.reservation as Record<string, unknown>).deposits = [{ reviewStatus: 'PENDING_REVIEW' }];
    await request(app.getHttpServer()).post('/me/deposits').send(bookingBody).expect(400);
    expect(mock.deposit.create).not.toHaveBeenCalled();
  });

  it('allows resubmission after a previous rejection (creates a fresh proof)', async () => {
    (fixture.reservation as Record<string, unknown>).deposits = [{ reviewStatus: 'REJECTED' }];
    await request(app.getHttpServer()).post('/me/deposits').send(bookingBody).expect(201);
    expect(mock.deposit.create).toHaveBeenCalledTimes(1);
  });

  it('rejects a body with neither installmentId nor reservationId (400)', async () => {
    await request(app.getHttpServer())
      .post('/me/deposits')
      .send({ paidAt: bookingBody.paidAt, paymentMethod: 'CASH', receiptUrl: bookingBody.receiptUrl })
      .expect(400);
  });

  it('still supports the installment proof path (backward compatible)', async () => {
    await request(app.getHttpServer())
      .post('/me/deposits')
      .send({
        installmentId: INST_ID,
        amount: 20000,
        paidAt: '2030-04-10T00:00:00.000Z',
        paymentMethod: 'BANK_TRANSFER',
        receiptUrl: 'https://cdn.example/inst-proof.pdf',
      })
      .expect(201);
    expect(mock.installment.findFirst).toHaveBeenCalledTimes(1);
    const createArgs = mock.deposit.create.mock.calls[0]![0] as { data: { type: string; installmentId: string } };
    expect(createArgs.data.type).toBe('DOWN_PAYMENT');
    expect(createArgs.data.installmentId).toBe(INST_ID);
    // The booking-only reservation write must not run on the installment path.
    expect(mock.reservation.update).not.toHaveBeenCalled();
  });
});
