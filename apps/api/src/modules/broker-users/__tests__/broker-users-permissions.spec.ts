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
import { BrokerUsersController } from '../broker-users.controller';
import { BrokerUsersService } from '../broker-users.service';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  PERMISSIONS_KEY,
  type PermissionsMeta,
} from '../../../common/decorators/permissions.decorator';

/**
 * Broker permissions · Batch 2 (broker users).
 *
 *   - list/invite/update routes carry bypass @Permissions codes.
 *   - PATCH /broker-users/:id/status is strict broker_users:remove because it
 *     can SUSPEND/REMOVE an agent — gating the whole route is the conservative
 *     choice.
 *   - Broker portal authorization untouched (no portal files imported).
 */

const BROKER_ID = 'b1111111-1111-4111-8111-111111111111';
const BU_ID = 'b2222222-2222-4222-8222-222222222222';

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

function makePrismaMock() {
  const m = {
    userPermission: {
      findMany: jest.fn().mockImplementation(async () => {
        const u = FakeAuthGuard.currentUser;
        return (u?.codes ?? []).map((code) => ({ permission: { code } }));
      }),
    },
    broker: {
      findUnique: jest.fn().mockResolvedValue({ id: BROKER_ID, status: 'ACTIVE' }),
    },
    brokerUser: {
      findUnique: jest.fn().mockResolvedValue({
        id: BU_ID,
        status: 'ACTIVE',
        joinedAt: new Date(),
        userId: 'u1',
        brokerId: BROKER_ID,
        user: { id: 'u1', fullName: 'Agent', email: null, phone: null },
      }),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: BU_ID }),
      update: jest.fn().mockImplementation(async ({ where, data }) => ({
        id: where.id,
        ...data,
      })),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'u1' }),
      update: jest.fn().mockResolvedValue({ id: 'u1' }),
    },
    $transaction: jest.fn(),
  };
  // Function-form $transaction proxies to the top-level mocks so create/update
  // tx writes resolve (tests assert on those top-level fns).
  m.$transaction.mockImplementation(async (ops: unknown) => {
    if (Array.isArray(ops)) return Promise.all(ops);
    if (typeof ops === 'function') {
      return (ops as (tx: unknown) => Promise<unknown>)({
        brokerUser: m.brokerUser,
        user: m.user,
      });
    }
    return ops;
  });
  return m;
}

describe('Broker users module · permissions enforcement', () => {
  let app: INestApplication;
  let prismaMock: ReturnType<typeof makePrismaMock>;
  let reflector: Reflector;
  let updateStatusSpy: jest.SpyInstance;

  beforeAll(async () => {
    prismaMock = makePrismaMock();

    @Global()
    @Module({
      providers: [{ provide: PrismaService, useValue: prismaMock }],
      exports: [PrismaService],
    })
    class MockPrismaModule {}

    @Module({
      imports: [MockPrismaModule],
      controllers: [BrokerUsersController],
      providers: [BrokerUsersService],
    })
    class TestModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [TestModule],
      providers: [
        Reflector,
        { provide: APP_GUARD, useClass: FakeAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
      ],
    }).compile();

    reflector = moduleRef.get(Reflector);
    updateStatusSpy = jest.spyOn(moduleRef.get(BrokerUsersService), 'updateStatus');

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
    FakeAuthGuard.currentUser = null;
    prismaMock.userPermission.findMany.mockClear();
    prismaMock.brokerUser.update.mockClear();
    prismaMock.brokerUser.findUnique.mockClear();
    updateStatusSpy.mockClear();
  });

  // ── Metadata ────────────────────────────────────────────────────────────

  describe('@Permissions metadata', () => {
    const proto = BrokerUsersController.prototype as unknown as Record<
      string,
      (...a: unknown[]) => unknown
    >;
    function getMeta(method: string): PermissionsMeta | undefined {
      return reflector.get<PermissionsMeta | undefined>(PERMISSIONS_KEY, proto[method]!);
    }

    it.each<[string, string]>([
      ['listByBroker', 'broker_users:read'],
      ['create', 'broker_users:invite'],
      ['update', 'broker_users:update'],
    ])('%s → @Permissions(%s), bypass true', (method, code) => {
      expect(getMeta(method)).toMatchObject({ codes: [code], adminBypass: true });
    });

    it('updateStatus → @PermissionsStrict(broker_users:remove), bypass false', () => {
      expect(getMeta('updateStatus')).toMatchObject({
        codes: ['broker_users:remove'],
        adminBypass: false,
      });
    });
  });

  // ── Bypass routes ────────────────────────────────────────────────────────

  describe('list/invite/update (bypass)', () => {
    it('ADMIN lists broker users without a permission DB lookup', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer()).get(`/brokers/${BROKER_ID}/users`).expect(200);
      expect(prismaMock.userPermission.findMany).not.toHaveBeenCalled();
    });

    it('ADMIN invites a broker user by bypass', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer())
        .post(`/brokers/${BROKER_ID}/users`)
        .send({ fullName: 'New Agent', email: 'agent@example.com' })
        .expect(201);
    });

    it('ADMIN updates a broker user by bypass', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer())
        .patch(`/broker-users/${BU_ID}`)
        .send({ jobTitle: 'Senior Agent' })
        .expect(200);
    });

    it('rejects SALES at the @Roles layer', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['broker_users:read'],
      };
      await request(app.getHttpServer()).get(`/brokers/${BROKER_ID}/users`).expect(403);
      expect(prismaMock.userPermission.findMany).not.toHaveBeenCalled();
    });

    it('rejects unauthenticated requests', async () => {
      FakeAuthGuard.currentUser = null;
      await request(app.getHttpServer()).get(`/brokers/${BROKER_ID}/users`).expect(403);
    });
  });

  // ── Strict status route ───────────────────────────────────────────────────

  describe('PATCH /broker-users/:id/status (strict broker_users:remove)', () => {
    it('ADMIN WITHOUT broker_users:remove → structured 403; service never called', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      const res = await request(app.getHttpServer())
        .patch(`/broker-users/${BU_ID}/status`)
        .send({ status: 'REMOVED' })
        .expect(403);
      expect(res.body).toMatchObject({
        code: 'missing_permission',
        permissions: ['broker_users:remove'],
      });
      expect(updateStatusSpy).not.toHaveBeenCalled();
      expect(prismaMock.brokerUser.update).not.toHaveBeenCalled();
    });

    it('ADMIN WITH broker_users:remove can change status (SUSPENDED)', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'admin-2',
        role: UserRole.ADMIN,
        codes: ['broker_users:remove'],
      };
      await request(app.getHttpServer())
        .patch(`/broker-users/${BU_ID}/status`)
        .send({ status: 'SUSPENDED' })
        .expect(200);
      expect(updateStatusSpy).toHaveBeenCalledTimes(1);
      const args = prismaMock.brokerUser.update.mock.calls[0]![0] as {
        data: { status: string };
      };
      expect(args.data.status).toBe('SUSPENDED');
    });

    it('business validation still runs after the gate (404 for missing broker user)', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'admin-2',
        role: UserRole.ADMIN,
        codes: ['broker_users:remove'],
      };
      prismaMock.brokerUser.findUnique.mockResolvedValueOnce(null);
      await request(app.getHttpServer())
        .patch(`/broker-users/${BU_ID}/status`)
        .send({ status: 'REMOVED' })
        .expect(404);
    });
  });
});
