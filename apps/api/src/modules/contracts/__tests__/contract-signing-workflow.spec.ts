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
import { ContractsModule } from '../contracts.module';
import { DocumentsService } from '../../documents/documents.module';
import { BrokerCommissionsService } from '../../broker-commissions/broker-commissions.service';
import { BonusService } from '../../bonus/bonus.module';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { PrismaService } from '../../../common/prisma/prisma.service';

/**
 * Contract signing workflow.
 *
 * Focus on:
 *   - POST /contracts/:id/sign sets signedAt
 *   - sign() is idempotent on already-signed contracts
 *   - broker-attributed signing triggers materializeFromContract()
 *   - non-broker signing does NOT invoke commission materialization
 *   - signing failures in side effects don't prevent the contract from
 *     becoming signed (best-effort: commission warning is swallowed)
 *
 * BrokerCommissionsService is mocked at the DI boundary so we observe the
 * exact call shape without re-running its internal Prisma writes (that
 * service has its own test surface).
 */

const CONTRACT_ID = 'c1111111-1111-4111-8111-111111111111';
const PATH_SIGN = `/contracts/${CONTRACT_ID}/sign`;

interface ContractFixture {
  id: string;
  contractNumber: string | null;
  signedAt: Date | null;
  unitId: string;
  customerId: string;
  brokerId: string | null;
  brokerAgentId: string | null;
  reservationId: string | null;
  pdfUrl: string | null;
  reservation:
    | { reservationNumber: string | null; leadId: string | null; salesId: string }
    | null;
}

const fixture: { contract: ContractFixture } = { contract: {} as never };

// Unit maintenance items the warranty hook reads/updates on sign.
type WarrantyItem = {
  id: string;
  warrantyDurationMonthsSnapshot: number | null;
  category: { warrantyDurationMonths: number | null } | null;
};
const warrantyFixture: { items: WarrantyItem[] } = { items: [] };

function resetFixture() {
  fixture.contract = {
    id: CONTRACT_ID,
    contractNumber: 'CT-0001',
    signedAt: null,
    unitId: 'unit-1',
    customerId: 'cust-1',
    pdfUrl: null,
    brokerId: null,
    brokerAgentId: null,
    reservationId: null,
    reservation: null,
  };
  warrantyFixture.items = [];
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
      findUnique: jest.fn().mockImplementation(async () => ({ ...fixture.contract })),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn().mockImplementation(async ({ where, data }) => ({
        ...fixture.contract,
        ...data,
        id: where.id,
      })),
    },
    leadActivity: { create: jest.fn().mockResolvedValue({}) },
    brokerUser: { findMany: jest.fn().mockResolvedValue([]) },
    notification: {
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
      // P4 — NotificationsService.send uses prisma.notification.create.
      create: jest.fn().mockResolvedValue({ id: 'n-1', sentAt: new Date() }),
    },
    notificationTemplate: {
      findUnique: jest.fn().mockResolvedValue({
        code: 'tpl', channel: 'IN_APP',
        subject: { ar: 's', en: 's' }, body: { ar: 'b', en: 'b' },
      }),
    },
    unit: { findUnique: jest.fn().mockResolvedValue({ id: 'u', status: 'AVAILABLE' }) },
    unitMaintenanceItem: {
      findMany: jest.fn().mockImplementation(async () => warrantyFixture.items),
      update: jest.fn().mockImplementation(async ({ where, data }) => ({ id: where.id, ...data })),
    },
    document: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    $transaction: jest.fn().mockImplementation(async (ops: unknown) => {
      if (Array.isArray(ops)) return Promise.all(ops);
      if (typeof ops === 'function') return (ops as (tx: unknown) => Promise<unknown>)(m);
      return ops;
    }),
  };
  return m;
}

const brokerCommissionsMock = {
  materializeFromContract: jest
    .fn<Promise<{ status: string }>, [string]>()
    .mockResolvedValue({ status: 'created' }),
};

// ContractsModule imports DocumentsModule; override so tests never touch R2.
const documentsMock = {
  create: jest.fn().mockImplementation(async (uploadedById: string, dto: Record<string, unknown>) => ({
    id: 'doc-1',
    uploadedById,
    ...dto,
  })),
};

const bonusServiceMock = {
  materializeFromSignedContract: jest
    .fn<Promise<{ status: string }>, [string]>()
    .mockResolvedValue({ status: 'created' }),
};

let mock = makePrismaMock();

describe('Contracts · signing workflow', () => {
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
      imports: [ConfigModule.forRoot({ isGlobal: true }), MockPrismaModule, ContractsModule],
      providers: [
        { provide: APP_GUARD, useClass: FakeAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
      ],
    })
      .overrideProvider(BrokerCommissionsService)
      .useValue(brokerCommissionsMock)
      .overrideProvider(BonusService)
      .useValue(bonusServiceMock)
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
      codes: ['contracts:sign'],
    };
    resetFixture();
    mock.contract.findUnique.mockClear();
    mock.contract.update.mockClear();
    mock.unitMaintenanceItem.findMany.mockClear();
    mock.unitMaintenanceItem.update.mockClear();
    mock.document.findFirst.mockClear();
    mock.document.findFirst.mockResolvedValue(null);
    documentsMock.create.mockClear();
    mock.leadActivity.create.mockClear();
    mock.brokerUser.findMany.mockClear();
    mock.notification.create.mockClear();
    brokerCommissionsMock.materializeFromContract.mockClear();
    brokerCommissionsMock.materializeFromContract.mockResolvedValue({ status: 'created' });
    bonusServiceMock.materializeFromSignedContract.mockClear();
    bonusServiceMock.materializeFromSignedContract.mockResolvedValue({ status: 'created' });
  });

  // ── Happy path: non-broker contract ─────────────────────────────────────

  it('sets signedAt on a non-broker contract and skips commission materialization', async () => {
    await request(app.getHttpServer())
      .post(PATH_SIGN)
      .send({ signedAt: '2030-05-19T00:00:00Z' })
      .expect(201);

    expect(mock.contract.update).toHaveBeenCalledTimes(1);
    const updateArgs = mock.contract.update.mock.calls[0]![0] as {
      where: { id: string };
      data: { signedAt: Date };
    };
    expect(updateArgs.where.id).toBe(CONTRACT_ID);
    expect(updateArgs.data.signedAt).toBeInstanceOf(Date);

    // No broker attribution → broker side effects don't fire, but the SALES
    // commission generation runs for every newly-signed contract (broker or not).
    expect(brokerCommissionsMock.materializeFromContract).not.toHaveBeenCalled();
    expect(mock.brokerUser.findMany).not.toHaveBeenCalled();
    expect(mock.notification.create).not.toHaveBeenCalled();
    expect(bonusServiceMock.materializeFromSignedContract).toHaveBeenCalledTimes(1);
    expect(bonusServiceMock.materializeFromSignedContract).toHaveBeenCalledWith(CONTRACT_ID);
  });

  it('signing also triggers sales commission generation for a broker contract', async () => {
    fixture.contract.brokerId = 'broker-1';
    fixture.contract.reservationId = 'r-1';
    fixture.contract.reservation = {
      reservationNumber: 'RES-0001',
      leadId: 'lead-1',
      salesId: 'sales-1',
    };

    await request(app.getHttpServer())
      .post(PATH_SIGN)
      .send({ signedAt: '2030-05-19T00:00:00Z' })
      .expect(201);

    // Both ledgers materialize independently from the same signing event.
    expect(brokerCommissionsMock.materializeFromContract).toHaveBeenCalledTimes(1);
    expect(bonusServiceMock.materializeFromSignedContract).toHaveBeenCalledTimes(1);
    expect(bonusServiceMock.materializeFromSignedContract).toHaveBeenCalledWith(CONTRACT_ID);
  });

  it('contract is signed even when sales commission generation throws (best-effort)', async () => {
    bonusServiceMock.materializeFromSignedContract.mockRejectedValueOnce(
      new Error('bonus downstream blew up'),
    );

    await request(app.getHttpServer())
      .post(PATH_SIGN)
      .send({ signedAt: '2030-05-19T00:00:00Z' })
      .expect(201);

    // Sign still succeeded and persisted signedAt.
    expect(mock.contract.update).toHaveBeenCalledTimes(1);
  });

  // ── Warranty start on sign (Batch 13C) ─────────────────────────────────

  it('starts warranties for the unit active items, freezing duration + computing end', async () => {
    warrantyFixture.items = [
      { id: 'ui-plumbing', warrantyDurationMonthsSnapshot: null, category: { warrantyDurationMonths: 12 } },
      { id: 'ui-electrical', warrantyDurationMonthsSnapshot: null, category: { warrantyDurationMonths: 24 } },
    ];
    await request(app.getHttpServer())
      .post(PATH_SIGN)
      .send({ signedAt: '2030-05-19T00:00:00Z' })
      .expect(201);

    expect(mock.unitMaintenanceItem.update).toHaveBeenCalledTimes(2);
    const calls = mock.unitMaintenanceItem.update.mock.calls.map((c) => c[0] as { where: { id: string }; data: Record<string, unknown> });
    const plumbing = calls.find((c) => c.where.id === 'ui-plumbing')!;
    expect(new Date(plumbing.data.warrantyStart as Date).toISOString()).toBe('2030-05-19T00:00:00.000Z');
    expect(plumbing.data.warrantyDurationMonthsSnapshot).toBe(12);
    expect(new Date(plumbing.data.warrantyEnd as Date).toISOString()).toBe('2031-05-19T00:00:00.000Z');
    const electrical = calls.find((c) => c.where.id === 'ui-electrical')!;
    expect(new Date(electrical.data.warrantyEnd as Date).toISOString()).toBe('2032-05-19T00:00:00.000Z');
  });

  it('prefers an existing item duration snapshot over the category duration', async () => {
    // Item already carries a frozen 2-year snapshot; category now says 3 years.
    // The snapshot wins, so a later category change never alters a sold warranty.
    warrantyFixture.items = [
      { id: 'ui-1', warrantyDurationMonthsSnapshot: 24, category: { warrantyDurationMonths: 36 } },
    ];
    await request(app.getHttpServer())
      .post(PATH_SIGN)
      .send({ signedAt: '2030-05-19T00:00:00Z' })
      .expect(201);
    const call = mock.unitMaintenanceItem.update.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(call.data.warrantyDurationMonthsSnapshot).toBe(24);
    expect(new Date(call.data.warrantyEnd as Date).toISOString()).toBe('2032-05-19T00:00:00.000Z');
  });

  it('leaves warrantyEnd null when no duration is known', async () => {
    warrantyFixture.items = [
      { id: 'ui-1', warrantyDurationMonthsSnapshot: null, category: { warrantyDurationMonths: null } },
    ];
    await request(app.getHttpServer())
      .post(PATH_SIGN)
      .send({ signedAt: '2030-05-19T00:00:00Z' })
      .expect(201);
    const call = mock.unitMaintenanceItem.update.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(call.data.warrantyStart).toBeInstanceOf(Date);
    expect(call.data.warrantyEnd ?? null).toBeNull();
  });

  it('signing twice does not re-snapshot (idempotent — already-signed returns early)', async () => {
    fixture.contract.signedAt = new Date('2030-04-01T00:00:00Z');
    warrantyFixture.items = [
      { id: 'ui-1', warrantyDurationMonthsSnapshot: null, category: { warrantyDurationMonths: 12 } },
    ];
    await request(app.getHttpServer())
      .post(PATH_SIGN)
      .send({ signedAt: '2030-05-19T00:00:00Z' })
      .expect(201);
    expect(mock.unitMaintenanceItem.update).not.toHaveBeenCalled();
  });

  // ── Contract PDF document linking (Batch A) ────────────────────────────

  it('signing with an existing pdfUrl links a CONTRACT document', async () => {
    fixture.contract.pdfUrl = 'https://cdn.example/contract.pdf';
    await request(app.getHttpServer())
      .post(PATH_SIGN)
      .send({ signedAt: '2030-05-19T00:00:00Z' })
      .expect(201);
    expect(documentsMock.create).toHaveBeenCalledTimes(1);
    const [uploadedById, dto] = documentsMock.create.mock.calls[0]!;
    expect(uploadedById).toBe('admin-1');
    expect(dto).toMatchObject({
      ownerType: 'CONTRACT',
      ownerId: CONTRACT_ID,
      category: 'CONTRACT',
      fileUrl: 'https://cdn.example/contract.pdf',
      // P12 — the contract file is the customer's contract, so it is now
      // registered CUSTOMER_VISIBLE (downloadable via signed-download).
      visibility: 'CUSTOMER_VISIBLE',
    });
  });

  it('signing without a pdfUrl links no document', async () => {
    fixture.contract.pdfUrl = null;
    await request(app.getHttpServer())
      .post(PATH_SIGN)
      .send({ signedAt: '2030-05-19T00:00:00Z' })
      .expect(201);
    expect(documentsMock.create).not.toHaveBeenCalled();
  });

  it('signing does not duplicate a contract document that already exists', async () => {
    fixture.contract.pdfUrl = 'https://cdn.example/contract.pdf';
    mock.document.findFirst.mockResolvedValueOnce({ id: 'existing-doc' });
    await request(app.getHttpServer())
      .post(PATH_SIGN)
      .send({ signedAt: '2030-05-19T00:00:00Z' })
      .expect(201);
    expect(documentsMock.create).not.toHaveBeenCalled();
  });

  it('signing still succeeds when document linking throws (best-effort)', async () => {
    fixture.contract.pdfUrl = 'https://cdn.example/contract.pdf';
    documentsMock.create.mockRejectedValueOnce(new Error('docs down'));
    await request(app.getHttpServer())
      .post(PATH_SIGN)
      .send({ signedAt: '2030-05-19T00:00:00Z' })
      .expect(201);
    expect(mock.contract.update).toHaveBeenCalledTimes(1);
  });

  it('PATCH /contracts/:id with pdfUrl sets pdfUrl and links a CONTRACT document', async () => {
    await request(app.getHttpServer())
      .patch(`/contracts/${CONTRACT_ID}`)
      .send({ pdfUrl: 'https://cdn.example/attached.pdf' })
      .expect(200);
    const updateArgs = mock.contract.update.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(updateArgs.data.pdfUrl).toBe('https://cdn.example/attached.pdf');
    expect(documentsMock.create).toHaveBeenCalledTimes(1);
    expect(documentsMock.create.mock.calls[0]![1]).toMatchObject({
      ownerType: 'CONTRACT',
      ownerId: CONTRACT_ID,
      category: 'CONTRACT',
      fileUrl: 'https://cdn.example/attached.pdf',
    });
  });

  // ── Idempotence on a contract that is already signed ────────────────────

  it('signing an already-signed contract is idempotent: no update, no commission re-trigger', async () => {
    fixture.contract.signedAt = new Date('2030-04-01T00:00:00Z');
    fixture.contract.brokerId = 'broker-1'; // even a broker contract is idempotent

    await request(app.getHttpServer())
      .post(PATH_SIGN)
      .send({ signedAt: '2030-05-19T00:00:00Z' })
      .expect(201);

    // The pre-read happens twice in the idempotent path (one for `before`,
    // one to return current state). What matters is that no UPDATE fires
    // and no side effects run.
    expect(mock.contract.update).not.toHaveBeenCalled();
    expect(brokerCommissionsMock.materializeFromContract).not.toHaveBeenCalled();
    expect(mock.leadActivity.create).not.toHaveBeenCalled();
    expect(mock.notification.create).not.toHaveBeenCalled();
    // Re-signing must not re-generate the sales commission.
    expect(bonusServiceMock.materializeFromSignedContract).not.toHaveBeenCalled();
  });

  // ── Broker-attributed contract: commission materializes ─────────────────

  it('signing a broker-attributed contract triggers materializeFromContract exactly once', async () => {
    fixture.contract.brokerId = 'broker-1';
    fixture.contract.brokerAgentId = 'agent-1';
    fixture.contract.reservationId = 'r-1';
    fixture.contract.reservation = {
      reservationNumber: 'RES-0001',
      leadId: 'lead-1',
      salesId: 'sales-1',
    };

    await request(app.getHttpServer())
      .post(PATH_SIGN)
      .send({ signedAt: '2030-05-19T00:00:00Z' })
      .expect(201);

    expect(mock.contract.update).toHaveBeenCalledTimes(1);
    expect(brokerCommissionsMock.materializeFromContract).toHaveBeenCalledTimes(1);
    expect(brokerCommissionsMock.materializeFromContract).toHaveBeenCalledWith(CONTRACT_ID);
  });

  it('broker portal activity + notifications fire on broker contract sign', async () => {
    fixture.contract.brokerId = 'broker-1';
    fixture.contract.reservationId = 'r-1';
    fixture.contract.reservation = {
      reservationNumber: 'RES-0001',
      leadId: 'lead-1',
      salesId: 'sales-1',
    };
    mock.brokerUser.findMany.mockResolvedValueOnce([
      { userId: 'broker-user-a' },
      { userId: 'broker-user-b' },
    ]);

    await request(app.getHttpServer())
      .post(PATH_SIGN)
      .send({ signedAt: '2030-05-19T00:00:00Z' })
      .expect(201);

    // broker_contract_signed activity row on the source lead.
    expect(mock.leadActivity.create).toHaveBeenCalledTimes(1);
    const actArgs = mock.leadActivity.create.mock.calls[0]![0] as {
      data: { leadId: string; type: string };
    };
    expect(actArgs.data.type).toBe('broker_contract_signed');
    expect(actArgs.data.leadId).toBe('lead-1');

    // P4 — notifications now flow through NotificationsService.send which
    // creates ONE row per recipient. Expected for a broker contract sign:
    // 3 broker_contract_signed (2 broker users + sales) + 1 contract_signed_customer.
    const notifyCalls = mock.notification.create.mock.calls.map(
      (c: unknown[]) => (c[0] as { data: { userId: string; templateCode: string } }).data,
    );
    const brokerCalls = notifyCalls.filter(
      (d) => d.templateCode === 'broker_contract_signed',
    );
    expect(brokerCalls).toHaveLength(3);
    expect(new Set(brokerCalls.map((n) => n.userId))).toEqual(
      new Set(['broker-user-a', 'broker-user-b', 'sales-1']),
    );
    expect(notifyCalls.some((d) => d.templateCode === 'contract_signed_customer')).toBe(
      true,
    );
  });

  // ── Best-effort: commission materialization failure does NOT break sign ─

  it('contract is signed even when materializeFromContract throws (best-effort side effect)', async () => {
    fixture.contract.brokerId = 'broker-1';
    fixture.contract.reservationId = 'r-1';
    fixture.contract.reservation = {
      reservationNumber: 'RES-0001',
      leadId: 'lead-1',
      salesId: 'sales-1',
    };
    brokerCommissionsMock.materializeFromContract.mockRejectedValueOnce(
      new Error('downstream blew up'),
    );

    await request(app.getHttpServer())
      .post(PATH_SIGN)
      .send({ signedAt: '2030-05-19T00:00:00Z' })
      .expect(201);

    // The signing UPDATE must still have committed.
    expect(mock.contract.update).toHaveBeenCalledTimes(1);
  });

  // ── DTO + validation ────────────────────────────────────────────────────

  it('rejects POST /sign without signedAt (400)', async () => {
    await request(app.getHttpServer()).post(PATH_SIGN).send({}).expect(400);
    expect(mock.contract.update).not.toHaveBeenCalled();
  });

  it('rejects POST /sign with an unrecognised field (400, ValidationPipe whitelist)', async () => {
    await request(app.getHttpServer())
      .post(PATH_SIGN)
      .send({ signedAt: '2030-05-19T00:00:00Z', mode: 'force' })
      .expect(400);
    expect(mock.contract.update).not.toHaveBeenCalled();
  });

  it('returns 404 when the contract does not exist', async () => {
    mock.contract.findUnique.mockResolvedValueOnce(null);
    await request(app.getHttpServer())
      .post(PATH_SIGN)
      .send({ signedAt: '2030-05-19T00:00:00Z' })
      .expect(404);
    expect(mock.contract.update).not.toHaveBeenCalled();
  });
});
