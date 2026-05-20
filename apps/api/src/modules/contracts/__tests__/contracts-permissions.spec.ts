import {
  CanActivate,
  ExecutionContext,
  Global,
  INestApplication,
  Module,
  ValidationPipe,
} from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { UserRole } from '@prisma/client';
import { ContractsModule } from '../contracts.module';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { BrokerCommissionsService } from '../../broker-commissions/broker-commissions.service';
import {
  PERMISSIONS_KEY,
  type PermissionsMeta,
} from '../../../common/decorators/permissions.decorator';

/**
 * Verifies the contracts permissions rollout, including the new strict
 * sign route. Covers:
 *   * Per-route metadata for all 6 handlers (5 admin + 1 customer-self).
 *   * Read/update/sign happy paths and rejection paths.
 *   * Strict 403 body from PermissionsGuard for ADMIN missing contracts:sign.
 *   * Side-effect invocations: they run only when permission passes AND the
 *     contract was previously unsigned.
 *   * PATCH /contracts/:id with `signedAt` is rejected by ValidationPipe.
 */

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

interface ContractFixture {
  id: string;
  contractNumber: string;
  signedAt: Date | null;
  brokerId: string | null;
  brokerAgentId: string | null;
  reservationId: string | null;
  reservation: { reservationNumber: string; leadId: string | null; salesId: string | null } | null;
}

// Mutable so each test can swap which contract `findUnique` returns.
const contractStore: { current: ContractFixture } = {
  current: {
    id: '00000000-0000-0000-0000-000000000001',
    contractNumber: 'CT-0001',
    signedAt: null,
    brokerId: 'broker-1',
    brokerAgentId: 'agent-1',
    reservationId: 'res-1',
    reservation: { reservationNumber: 'R-0001', leadId: 'lead-1', salesId: 'sales-rep-1' },
  },
};

function makePrismaMock() {
  // Tx-scope mocks: separate spies so the create() path's $transaction
  // callback can be asserted independently of any top-level usage.
  const txContractCreate = jest.fn().mockImplementation(async ({ data }) => ({
    id: 'new-contract-id',
    contractNumber: 'CT-NEW',
    ...data,
  }));
  const txUserUpdateMany = jest.fn().mockResolvedValue({ count: 0 });
  const txUnitUpdate = jest.fn().mockResolvedValue({});
  const txUnitStatusHistoryCreate = jest.fn().mockResolvedValue({});

  const mock = {
    userPermission: {
      findMany: jest.fn().mockImplementation(async () => {
        const u = FakeAuthGuard.currentUser;
        return (u?.codes ?? []).map((code) => ({ permission: { code } }));
      }),
    },
    contract: {
      findUnique: jest.fn().mockImplementation(async () => ({ ...contractStore.current })),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn().mockImplementation(async ({ where, data }) => ({
        id: where.id,
        contractNumber: contractStore.current.contractNumber,
        ...data,
      })),
    },
    unit: {
      findUnique: jest.fn().mockResolvedValue({ id: 'unit-1', status: 'AVAILABLE' }),
    },
    leadActivity: { create: jest.fn().mockResolvedValue({}) },
    brokerUser: { findMany: jest.fn().mockResolvedValue([{ userId: 'broker-user-1' }]) },
    notification: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    // Expose tx-scope mocks so tests can assert what create() did.
    _tx: {
      contractCreate: txContractCreate,
      userUpdateMany: txUserUpdateMany,
      unitUpdate: txUnitUpdate,
      unitStatusHistoryCreate: txUnitStatusHistoryCreate,
    },
    $transaction: jest.fn().mockImplementation(async (ops: unknown) => {
      if (Array.isArray(ops)) return Promise.all(ops);
      if (typeof ops === 'function') {
        const tx: Record<string, unknown> = {
          contract: { create: txContractCreate },
          user: { updateMany: txUserUpdateMany },
          unit: { update: txUnitUpdate },
          unitStatusHistory: { create: txUnitStatusHistoryCreate },
        };
        return (ops as (tx: unknown) => Promise<unknown>)(tx);
      }
      return ops;
    }),
  };
  return mock;
}

function makeBrokerCommissionsMock() {
  return {
    materializeFromContract: jest.fn().mockResolvedValue({ status: 'created' }),
  };
}

describe('Contracts module · permissions enforcement', () => {
  let app: INestApplication;
  let prismaMock: ReturnType<typeof makePrismaMock>;
  let brokerCommissionsMock: ReturnType<typeof makeBrokerCommissionsMock>;
  let reflector: Reflector;

  beforeAll(async () => {
    prismaMock = makePrismaMock();
    brokerCommissionsMock = makeBrokerCommissionsMock();

    @Global()
    @Module({
      providers: [{ provide: PrismaService, useValue: prismaMock }],
      exports: [PrismaService],
    })
    class MockPrismaModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [MockPrismaModule, ContractsModule],
      providers: [
        Reflector,
        { provide: APP_GUARD, useClass: FakeAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
      ],
    })
      .overrideProvider(BrokerCommissionsService)
      .useValue(brokerCommissionsMock)
      .compile();

    reflector = moduleRef.get(Reflector);
    app = moduleRef.createNestApplication();
    // Mirror the production main.ts ValidationPipe — this is what rejects
    // `signedAt` on PATCH /contracts/:id with a 400.
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
    FakeAuthGuard.currentUser = null;
    prismaMock.userPermission.findMany.mockClear();
    prismaMock.contract.update.mockClear();
    prismaMock.leadActivity.create.mockClear();
    prismaMock.notification.createMany.mockClear();
    prismaMock._tx.contractCreate.mockClear();
    prismaMock._tx.userUpdateMany.mockClear();
    prismaMock._tx.unitUpdate.mockClear();
    prismaMock._tx.unitStatusHistoryCreate.mockClear();
    brokerCommissionsMock.materializeFromContract.mockClear();
    // Reset contract to unsigned state.
    contractStore.current = {
      id: '00000000-0000-0000-0000-000000000001',
      contractNumber: 'CT-0001',
      signedAt: null,
      brokerId: 'broker-1',
      brokerAgentId: 'agent-1',
      reservationId: 'res-1',
      reservation: { reservationNumber: 'R-0001', leadId: 'lead-1', salesId: 'sales-rep-1' },
    };
  });

  // ── Metadata ───────────────────────────────────────────────────────────

  describe('@Permissions metadata', () => {
    const controllers = Reflect.getMetadata('controllers', ContractsModule) as Array<
      new () => unknown
    >;
    const Ctor = controllers[0]!;
    const proto = Ctor.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;

    function getMeta(method: string): PermissionsMeta | undefined {
      return reflector.get<PermissionsMeta | undefined>(PERMISSIONS_KEY, proto[method]!);
    }

    it('create → contracts:upload, bypass true', () => {
      expect(getMeta('create')).toMatchObject({ codes: ['contracts:upload'], adminBypass: true });
    });
    it('list → contracts:read, bypass true', () => {
      expect(getMeta('list')).toMatchObject({ codes: ['contracts:read'], adminBypass: true });
    });
    it('get → contracts:read, bypass true', () => {
      expect(getMeta('get')).toMatchObject({ codes: ['contracts:read'], adminBypass: true });
    });
    it('update → contracts:update, bypass true', () => {
      expect(getMeta('update')).toMatchObject({ codes: ['contracts:update'], adminBypass: true });
    });
    it('sign → contracts:sign, bypass FALSE (strict)', () => {
      expect(getMeta('sign')).toMatchObject({ codes: ['contracts:sign'], adminBypass: false });
    });
    it('myContracts → no permission metadata', () => {
      expect(getMeta('myContracts')).toBeUndefined();
    });
  });

  // ── Read routes ────────────────────────────────────────────────────────

  describe('GET /contracts', () => {
    it('ADMIN bypasses — no permission DB lookup', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer()).get('/contracts').expect(200);
      expect(prismaMock.userPermission.findMany).not.toHaveBeenCalled();
    });

    it('SALES WITH contracts:read is allowed (single DB lookup)', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['contracts:read'],
      };
      await request(app.getHttpServer()).get('/contracts').expect(200);
      expect(prismaMock.userPermission.findMany).toHaveBeenCalledTimes(1);
    });

    it('SALES WITHOUT contracts:read returns structured 403', async () => {
      FakeAuthGuard.currentUser = { sub: 'sales-2', role: UserRole.SALES, codes: [] };
      const res = await request(app.getHttpServer()).get('/contracts').expect(403);
      expect(res.body).toMatchObject({
        code: 'missing_permission',
        permissions: ['contracts:read'],
      });
    });

    it('rejects unauthenticated requests', async () => {
      FakeAuthGuard.currentUser = null;
      await request(app.getHttpServer()).get('/contracts').expect(403);
    });
  });

  // ── Create route — signedAt-at-create is closed ─────────────────────────

  describe('POST /contracts', () => {
    const VALID_BODY = {
      customerId: 'a1111111-1111-4111-8111-111111111111',
      unitId: 'b2222222-2222-4222-8222-222222222222',
      totalAmount: 100000,
      downPayment: 10000,
      pdfUrl: 'https://r2.example.com/contracts/new.pdf',
    };

    it('ADMIN can create a contract without signedAt — no signing side effects fire', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer()).post('/contracts').send(VALID_BODY).expect(201);
      expect(prismaMock._tx.contractCreate).toHaveBeenCalledTimes(1);
      // Created contracts are unsigned by construction.
      const createArgs = prismaMock._tx.contractCreate.mock.calls[0]![0] as { data: { signedAt: null } };
      expect(createArgs.data.signedAt).toBeNull();
      // No signing side effects.
      expect(prismaMock.leadActivity.create).not.toHaveBeenCalled();
      expect(prismaMock.notification.createMany).not.toHaveBeenCalled();
      expect(brokerCommissionsMock.materializeFromContract).not.toHaveBeenCalled();
    });

    it('POST /contracts with signedAt is rejected by ValidationPipe (400); no contract created', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      const res = await request(app.getHttpServer())
        .post('/contracts')
        .send({ ...VALID_BODY, signedAt: '2026-05-19T00:00:00Z' })
        .expect(400);
      expect(JSON.stringify(res.body)).toContain('signedAt');
      expect(prismaMock._tx.contractCreate).not.toHaveBeenCalled();
      // And, crucially, NO signing side effects either.
      expect(prismaMock.leadActivity.create).not.toHaveBeenCalled();
      expect(prismaMock.notification.createMany).not.toHaveBeenCalled();
      expect(brokerCommissionsMock.materializeFromContract).not.toHaveBeenCalled();
    });

    it('ADMIN with contracts:upload but NOT contracts:sign cannot create-and-sign (bypass closed)', async () => {
      // The "old bypass" was: send signedAt at create-time and skip /sign.
      // With the DTO narrowed, that body is now a 400 regardless of which
      // permissions the caller holds.
      FakeAuthGuard.currentUser = {
        sub: 'admin-1',
        role: UserRole.ADMIN,
        codes: ['contracts:upload'], // explicitly NOT contracts:sign
      };
      await request(app.getHttpServer())
        .post('/contracts')
        .send({ ...VALID_BODY, signedAt: '2026-05-19T00:00:00Z' })
        .expect(400);
      expect(prismaMock._tx.contractCreate).not.toHaveBeenCalled();
    });
  });

  // ── Update route ───────────────────────────────────────────────────────

  describe('PATCH /contracts/:id', () => {
    const PATH = '/contracts/00000000-0000-0000-0000-000000000001';

    it('ADMIN can update pdfUrl', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer())
        .patch(PATH)
        .send({ pdfUrl: 'https://r2.example.com/contracts/abc.pdf' })
        .expect(200);
      expect(prismaMock.contract.update).toHaveBeenCalledTimes(1);
    });

    it('PATCH with signedAt is rejected by ValidationPipe (400)', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      const res = await request(app.getHttpServer())
        .patch(PATH)
        .send({ pdfUrl: 'https://r2.example.com/contracts/abc.pdf', signedAt: '2026-05-19T00:00:00Z' })
        .expect(400);
      // class-validator surfaces an array message; check it mentions signedAt.
      expect(JSON.stringify(res.body)).toContain('signedAt');
      // Crucially: no contract write, no side effects.
      expect(prismaMock.contract.update).not.toHaveBeenCalled();
      expect(brokerCommissionsMock.materializeFromContract).not.toHaveBeenCalled();
    });

    it('SALES with contracts:update is still blocked by @Roles(ADMIN)', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['contracts:update'],
      };
      const res = await request(app.getHttpServer())
        .patch(PATH)
        .send({ pdfUrl: 'x' })
        .expect(403);
      expect(res.body.message).toBe('Insufficient role');
      expect(prismaMock.userPermission.findMany).not.toHaveBeenCalled();
    });
  });

  // ── Sign route (strict) ────────────────────────────────────────────────

  describe('POST /contracts/:id/sign (strict)', () => {
    const PATH = '/contracts/00000000-0000-0000-0000-000000000001/sign';
    const BODY = { signedAt: '2026-05-19T00:00:00Z' };

    it('ADMIN WITHOUT contracts:sign returns structured 403; no side effects fire', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      const res = await request(app.getHttpServer()).post(PATH).send(BODY).expect(403);
      expect(res.body).toMatchObject({
        code: 'missing_permission',
        permissions: ['contracts:sign'],
      });
      // Permission DB IS queried (strict mode means no admin bypass).
      expect(prismaMock.userPermission.findMany).toHaveBeenCalledTimes(1);
      // None of the side effects ran.
      expect(prismaMock.contract.update).not.toHaveBeenCalled();
      expect(prismaMock.leadActivity.create).not.toHaveBeenCalled();
      expect(prismaMock.notification.createMany).not.toHaveBeenCalled();
      expect(brokerCommissionsMock.materializeFromContract).not.toHaveBeenCalled();
    });

    it('ADMIN WITH contracts:sign can sign — all side effects fire', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'admin-2',
        role: UserRole.ADMIN,
        codes: ['contracts:sign'],
      };
      await request(app.getHttpServer()).post(PATH).send(BODY).expect(201);
      expect(prismaMock.contract.update).toHaveBeenCalledTimes(1);
      expect(prismaMock.leadActivity.create).toHaveBeenCalledTimes(1);
      expect(prismaMock.notification.createMany).toHaveBeenCalledTimes(1);
      expect(brokerCommissionsMock.materializeFromContract).toHaveBeenCalledTimes(1);
    });

    it('signing an already-signed contract is idempotent: no update, no side effects', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'admin-2',
        role: UserRole.ADMIN,
        codes: ['contracts:sign'],
      };
      contractStore.current.signedAt = new Date('2026-05-18T00:00:00Z');
      await request(app.getHttpServer()).post(PATH).send(BODY).expect(201);
      expect(prismaMock.contract.update).not.toHaveBeenCalled();
      expect(prismaMock.leadActivity.create).not.toHaveBeenCalled();
      expect(prismaMock.notification.createMany).not.toHaveBeenCalled();
      expect(brokerCommissionsMock.materializeFromContract).not.toHaveBeenCalled();
    });

    it('SALES even with contracts:sign is blocked by @Roles(ADMIN)', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['contracts:sign'],
      };
      const res = await request(app.getHttpServer()).post(PATH).send(BODY).expect(403);
      expect(res.body.message).toBe('Insufficient role');
      expect(prismaMock.userPermission.findMany).not.toHaveBeenCalled();
      expect(prismaMock.contract.update).not.toHaveBeenCalled();
    });

    it('rejects unauthenticated requests', async () => {
      FakeAuthGuard.currentUser = null;
      await request(app.getHttpServer()).post(PATH).send(BODY).expect(403);
    });
  });

  // ── Customer self-route ────────────────────────────────────────────────

  describe('GET /contracts/me/contracts', () => {
    it('CUSTOMER reads their contracts without any permission lookup', async () => {
      FakeAuthGuard.currentUser = { sub: 'cust-1', role: UserRole.CUSTOMER, codes: [] };
      await request(app.getHttpServer()).get('/contracts/me/contracts').expect(200);
      expect(prismaMock.userPermission.findMany).not.toHaveBeenCalled();
    });

    it('ADMIN is blocked at @Roles (route is CUSTOMER-only)', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer()).get('/contracts/me/contracts').expect(403);
    });
  });
});
