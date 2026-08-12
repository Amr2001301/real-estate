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
import { UserRole } from '@prisma/client';
import { DepositsModule } from '../deposits.module';
import { DocumentsService } from '../../documents/documents.module';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { PrismaService } from '../../../common/prisma/prisma.service';

// DepositsModule now imports DocumentsModule (for receipt-document linking).
// Override the service so tests never touch R2; ConfigModule satisfies its deps.
const documentsMock = {
  create: jest.fn().mockImplementation(async (uploadedById: string, dto: Record<string, unknown>) => ({
    id: 'doc-1',
    uploadedById,
    ...dto,
  })),
};

/**
 * Deposits recording + verification workflow.
 *
 *   record():
 *     - creates a Deposit row with the type mapped from the installment type
 *     - marks the installment PAID (status + paidAt)
 *     - rejects partial / over-payment / already-paid / orphan installments
 *   verify():
 *     - flips the verified flag without touching unrelated columns
 *
 * Real DepositsService methods run against a mocked PrismaService.
 */

const CONTRACT_ID = 'cccccccc-1111-4111-8111-111111111111';
const INSTALLMENT_ID = 'aaaaaaaa-2222-4222-8222-222222222222';
const DEPOSIT_ID = 'dddddddd-3333-4333-8333-333333333333';

interface InstallmentFixture {
  id: string;
  type: 'DOWN_PAYMENT' | 'INSTALLMENT' | 'FINAL_PAYMENT';
  status: 'PENDING' | 'PAID' | 'OVERDUE';
  amount: number;
}

const fixture: { contract: { id: string } | null; installment: InstallmentFixture | null } = {
  contract: { id: CONTRACT_ID },
  installment: null,
};

function resetFixture() {
  fixture.contract = { id: CONTRACT_ID };
  fixture.installment = {
    id: INSTALLMENT_ID,
    type: 'INSTALLMENT',
    status: 'PENDING',
    amount: 5000,
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
    contract: {
      findUnique: jest.fn().mockImplementation(async () => fixture.contract),
    },
    installment: {
      findFirst: jest.fn().mockImplementation(async () => fixture.installment),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    deposit: {
      findUnique: jest.fn().mockImplementation(async ({ where }) => ({
        id: where.id,
        type: 'INSTALLMENT',
        amount: '5000',
        verified: false,
        receiptUrl: null,
        contractId: CONTRACT_ID,
      })),
      create: jest.fn().mockImplementation(async ({ data }) => ({
        id: DEPOSIT_ID,
        ...data,
      })),
      update: jest.fn().mockImplementation(async ({ where, data }) => ({
        id: where.id,
        ...data,
        amount: '5000',
        paidAt: new Date(),
        type: 'INSTALLMENT',
        verified: data.verified,
      })),
    },
    document: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    $transaction: jest.fn(),
  };
  m.$transaction.mockImplementation(async (ops: unknown) => {
    if (Array.isArray(ops)) return Promise.all(ops);
    if (typeof ops === 'function') {
      const tx = { deposit: m.deposit, installment: m.installment };
      return (ops as (tx: unknown) => Promise<unknown>)(tx);
    }
    return ops;
  });
  return m;
}

let mock = makePrismaMock();

describe('Deposits · recording + verification workflow', () => {
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

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    FakeAuthGuard.currentUser = {
      sub: 'admin-1',
      role: UserRole.ADMIN,
      codes: ['deposits:register', 'deposits:verify'],
    };
    resetFixture();
    mock.contract.findUnique.mockClear();
    mock.installment.findFirst.mockClear();
    mock.installment.update.mockClear();
    mock.installment.updateMany.mockClear();
    mock.deposit.create.mockClear();
    mock.deposit.update.mockClear();
    mock.document.findFirst.mockClear();
    mock.document.findFirst.mockResolvedValue(null);
    documentsMock.create.mockClear();
  });

  // ── record() happy paths per installment type ──────────────────────────

  it('records an INSTALLMENT deposit, marks installment PAID, and maps to DepositType.INSTALLMENT', async () => {
    const res = await request(app.getHttpServer())
      .post('/deposits')
      .send({
        contractId: CONTRACT_ID,
        installmentId: INSTALLMENT_ID,
        amount: 5000,
        paidAt: '2030-03-15T00:00:00Z',
      })
      .expect(201);

    expect(mock.deposit.create).toHaveBeenCalledTimes(1);
    const depArgs = mock.deposit.create.mock.calls[0]![0] as {
      data: { type: string; contractId: string; installmentId: string };
    };
    expect(depArgs.data.type).toBe('INSTALLMENT');
    expect(depArgs.data.contractId).toBe(CONTRACT_ID);
    expect(depArgs.data.installmentId).toBe(INSTALLMENT_ID);

    expect(mock.installment.updateMany).toHaveBeenCalledTimes(1);
    const instArgs = mock.installment.updateMany.mock.calls[0]![0] as {
      where: { id: string; status: { not: string } };
      data: { status: string; paidAt: Date };
    };
    expect(instArgs.where.id).toBe(INSTALLMENT_ID);
    expect(instArgs.where.status).toEqual({ not: 'PAID' });
    expect(instArgs.data.status).toBe('PAID');
    expect(instArgs.data.paidAt).toBeInstanceOf(Date);

    expect(res.body).toMatchObject({ id: DEPOSIT_ID });
  });

  it('maps DOWN_PAYMENT installment → DepositType.DOWN_PAYMENT', async () => {
    fixture.installment!.type = 'DOWN_PAYMENT';
    fixture.installment!.amount = 20000;
    await request(app.getHttpServer())
      .post('/deposits')
      .send({ contractId: CONTRACT_ID, installmentId: INSTALLMENT_ID, amount: 20000 })
      .expect(201);
    const depArgs = mock.deposit.create.mock.calls[0]![0] as { data: { type: string } };
    expect(depArgs.data.type).toBe('DOWN_PAYMENT');
  });

  it('maps FINAL_PAYMENT installment → DepositType.FINAL_PAYMENT', async () => {
    fixture.installment!.type = 'FINAL_PAYMENT';
    fixture.installment!.amount = 7500;
    await request(app.getHttpServer())
      .post('/deposits')
      .send({ contractId: CONTRACT_ID, installmentId: INSTALLMENT_ID, amount: 7500 })
      .expect(201);
    const depArgs = mock.deposit.create.mock.calls[0]![0] as { data: { type: string } };
    expect(depArgs.data.type).toBe('FINAL_PAYMENT');
  });

  // ── record() validation paths ──────────────────────────────────────────

  it('rejects payment when the contract does not exist (404)', async () => {
    fixture.contract = null;
    await request(app.getHttpServer())
      .post('/deposits')
      .send({ contractId: CONTRACT_ID, installmentId: INSTALLMENT_ID, amount: 5000 })
      .expect(404);
    expect(mock.deposit.create).not.toHaveBeenCalled();
    expect(mock.installment.update).not.toHaveBeenCalled();
  });

  it('rejects payment when the installment does not belong to this contract (400)', async () => {
    fixture.installment = null;
    await request(app.getHttpServer())
      .post('/deposits')
      .send({ contractId: CONTRACT_ID, installmentId: INSTALLMENT_ID, amount: 5000 })
      .expect(400);
    expect(mock.deposit.create).not.toHaveBeenCalled();
    expect(mock.installment.update).not.toHaveBeenCalled();
  });

  it('rejects double-payment when the installment is already PAID (400)', async () => {
    fixture.installment!.status = 'PAID';
    await request(app.getHttpServer())
      .post('/deposits')
      .send({ contractId: CONTRACT_ID, installmentId: INSTALLMENT_ID, amount: 5000 })
      .expect(400);
    expect(mock.deposit.create).not.toHaveBeenCalled();
  });

  it('rejects partial payment (amount < installment.amount, 400)', async () => {
    await request(app.getHttpServer())
      .post('/deposits')
      .send({ contractId: CONTRACT_ID, installmentId: INSTALLMENT_ID, amount: 4000 })
      .expect(400);
    expect(mock.deposit.create).not.toHaveBeenCalled();
    expect(mock.installment.update).not.toHaveBeenCalled();
  });

  it('rejects over-payment (amount > installment.amount, 400)', async () => {
    await request(app.getHttpServer())
      .post('/deposits')
      .send({ contractId: CONTRACT_ID, installmentId: INSTALLMENT_ID, amount: 6000 })
      .expect(400);
    expect(mock.deposit.create).not.toHaveBeenCalled();
    expect(mock.installment.update).not.toHaveBeenCalled();
  });

  // ── verify() flips only the verified column ────────────────────────────

  it('verify(): flips verified true/false and keeps reviewStatus in lockstep (P11)', async () => {
    const res1 = await request(app.getHttpServer())
      .patch(`/deposits/${DEPOSIT_ID}/verify`)
      .send({ verified: true })
      .expect(200);
    expect(mock.deposit.update).toHaveBeenCalledTimes(1);
    const args1 = mock.deposit.update.mock.calls[0]![0] as {
      where: { id: string };
      data: Record<string, unknown>;
    };
    expect(args1.where.id).toBe(DEPOSIT_ID);
    // P11 — verified=true now mirrors reviewStatus=APPROVED to keep legacy
    // and new fields in lockstep (see deposits.module.ts verify()).
    expect(args1.data).toEqual({ verified: true, reviewStatus: 'APPROVED' });
    expect(res1.body.verified).toBe(true);

    // Flipping back to false with no receipt → NO_PROOF; rejectionReason
    // cleared. (The default mock deposit has receiptUrl=null.)
    mock.deposit.update.mockClear();
    await request(app.getHttpServer())
      .patch(`/deposits/${DEPOSIT_ID}/verify`)
      .send({ verified: false })
      .expect(200);
    const args2 = mock.deposit.update.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(args2.data).toEqual({
      verified: false,
      reviewStatus: 'NO_PROOF',
      rejectionReason: null,
    });
  });

  it('verify(): rejects body without the verified flag (400)', async () => {
    await request(app.getHttpServer())
      .patch(`/deposits/${DEPOSIT_ID}/verify`)
      .send({})
      .expect(400);
    expect(mock.deposit.update).not.toHaveBeenCalled();
  });

  // ── Receipt document linking (Batch B) ─────────────────────────────────

  it('record() with receiptUrl links a DEPOSIT/RECEIPT document', async () => {
    await request(app.getHttpServer())
      .post('/deposits')
      .send({
        contractId: CONTRACT_ID,
        installmentId: INSTALLMENT_ID,
        amount: 5000,
        receiptUrl: 'https://cdn.example/receipt.pdf',
      })
      .expect(201);
    expect(documentsMock.create).toHaveBeenCalledTimes(1);
    const [uploadedById, dto] = documentsMock.create.mock.calls[0]!;
    expect(uploadedById).toBe('admin-1');
    expect(dto).toMatchObject({
      ownerType: 'DEPOSIT',
      ownerId: DEPOSIT_ID,
      category: 'RECEIPT',
      fileUrl: 'https://cdn.example/receipt.pdf',
      visibility: 'ADMIN_ONLY',
    });
  });

  it('record() without receiptUrl links no document', async () => {
    await request(app.getHttpServer())
      .post('/deposits')
      .send({ contractId: CONTRACT_ID, installmentId: INSTALLMENT_ID, amount: 5000 })
      .expect(201);
    expect(documentsMock.create).not.toHaveBeenCalled();
  });

  it('record() does not duplicate a receipt document that already exists', async () => {
    mock.document.findFirst.mockResolvedValueOnce({ id: 'existing-doc' });
    await request(app.getHttpServer())
      .post('/deposits')
      .send({
        contractId: CONTRACT_ID,
        installmentId: INSTALLMENT_ID,
        amount: 5000,
        receiptUrl: 'https://cdn.example/receipt.pdf',
      })
      .expect(201);
    expect(documentsMock.create).not.toHaveBeenCalled();
  });

  it('record() still succeeds when document linking throws (best-effort)', async () => {
    documentsMock.create.mockRejectedValueOnce(new Error('docs down'));
    await request(app.getHttpServer())
      .post('/deposits')
      .send({
        contractId: CONTRACT_ID,
        installmentId: INSTALLMENT_ID,
        amount: 5000,
        receiptUrl: 'https://cdn.example/receipt.pdf',
      })
      .expect(201);
    expect(mock.deposit.create).toHaveBeenCalledTimes(1);
  });

  it('POST /deposits/:id/receipt updates receiptUrl and links a document', async () => {
    const res = await request(app.getHttpServer())
      .post(`/deposits/${DEPOSIT_ID}/receipt`)
      .send({ receiptUrl: 'https://cdn.example/late-receipt.pdf', title: 'إيصال تحويل' })
      .expect(201);
    const updateArgs = mock.deposit.update.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(updateArgs.data.receiptUrl).toBe('https://cdn.example/late-receipt.pdf');
    expect(documentsMock.create).toHaveBeenCalledTimes(1);
    expect(res.body.document).toBeDefined();
  });

  it('GET /deposits/:id returns the deposit detail', async () => {
    const res = await request(app.getHttpServer()).get(`/deposits/${DEPOSIT_ID}`).expect(200);
    expect(res.body.id).toBe(DEPOSIT_ID);
  });
});
