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
import { BrokersController } from '../brokers.controller';
import { BrokersService } from '../brokers.service';
import { NotificationsService } from '../../notifications/notifications.module';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  PERMISSIONS_KEY,
  type PermissionsMeta,
} from '../../../common/decorators/permissions.decorator';

/**
 * Broker permissions · Batch 1 (brokers admin core).
 *
 *   - read/create/update routes carry bypass @Permissions codes.
 *   - The destructive status changes are split into dedicated strict routes
 *     POST /:id/suspend and POST /:id/terminate, each with its own code.
 *   - PATCH /:id/status survives as the non-destructive (ACTIVE/PENDING)
 *     route under brokers:update, with a DTO whitelist that rejects the
 *     destructive statuses (so the strict gate can't be bypassed).
 *   - Broker portal authorization is untouched (no portal files imported).
 */

const BROKER_ID = 'b1111111-1111-4111-8111-111111111111';

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
  return {
    userPermission: {
      findMany: jest.fn().mockImplementation(async () => {
        const u = FakeAuthGuard.currentUser;
        return (u?.codes ?? []).map((code) => ({ permission: { code } }));
      }),
    },
    broker: {
      findUnique: jest
        .fn()
        .mockImplementation(async ({ where }) => ({
          id: where.id ?? BROKER_ID,
          status: 'ACTIVE',
          notes: null,
          companyName: 'Test Co',
        })),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockImplementation(async ({ data }) => ({ id: BROKER_ID, ...data })),
      update: jest.fn().mockImplementation(async ({ where, data }) => ({
        id: where.id,
        status: 'ACTIVE',
        ...data,
      })),
    },
    brokerUser: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    $transaction: jest.fn().mockImplementation(async (ops: unknown) => {
      if (Array.isArray(ops)) return Promise.all(ops);
      return ops;
    }),
  };
}

describe('Brokers module · permissions enforcement', () => {
  let app: INestApplication;
  let prismaMock: ReturnType<typeof makePrismaMock>;
  let reflector: Reflector;
  // Spy on the service so we can prove a blocked strict route never invokes it.
  let suspendSpy: jest.SpyInstance;
  let terminateSpy: jest.SpyInstance;

  beforeAll(async () => {
    prismaMock = makePrismaMock();

    @Global()
    @Module({
      providers: [{ provide: PrismaService, useValue: prismaMock }],
      exports: [PrismaService],
    })
    class MockPrismaModule {}

    const notificationsServiceMock = {
      sendToUser: jest.fn().mockResolvedValue(undefined),
      sendToUsers: jest.fn().mockResolvedValue(undefined),
      sendToRoles: jest.fn().mockResolvedValue(undefined),
    };

    @Module({
      imports: [MockPrismaModule],
      controllers: [BrokersController],
      providers: [
        BrokersService,
        { provide: NotificationsService, useValue: notificationsServiceMock },
      ],
    })
    class TestBrokersModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [TestBrokersModule],
      providers: [
        Reflector,
        { provide: APP_GUARD, useClass: FakeAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
      ],
    }).compile();

    reflector = moduleRef.get(Reflector);
    const svc = moduleRef.get(BrokersService);
    suspendSpy = jest.spyOn(svc, 'suspend');
    terminateSpy = jest.spyOn(svc, 'terminate');

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
    prismaMock.broker.update.mockClear();
    prismaMock.broker.create.mockClear();
    suspendSpy.mockClear();
    terminateSpy.mockClear();
  });

  // ── Metadata ────────────────────────────────────────────────────────────

  describe('@Permissions metadata', () => {
    const proto = BrokersController.prototype as unknown as Record<
      string,
      (...a: unknown[]) => unknown
    >;
    function getMeta(method: string): PermissionsMeta | undefined {
      return reflector.get<PermissionsMeta | undefined>(PERMISSIONS_KEY, proto[method]!);
    }

    it.each<[string, string]>([
      ['findAll', 'brokers:read'],
      ['findOne', 'brokers:read'],
      ['create', 'brokers:create'],
      ['update', 'brokers:update'],
      ['updateStatus', 'brokers:update'],
    ])('%s → @Permissions(%s), bypass true', (method, code) => {
      expect(getMeta(method)).toMatchObject({ codes: [code], adminBypass: true });
    });

    it.each<[string, string]>([
      ['suspend', 'brokers:suspend'],
      ['terminate', 'brokers:terminate'],
    ])('%s → @PermissionsStrict(%s), bypass false', (method, code) => {
      expect(getMeta(method)).toMatchObject({ codes: [code], adminBypass: false });
    });
  });

  // ── Read / create / update — ADMIN bypass ───────────────────────────────

  describe('read/create/update routes (bypass)', () => {
    it('ADMIN lists brokers without a permission DB lookup', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer()).get('/brokers').expect(200);
      expect(prismaMock.userPermission.findMany).not.toHaveBeenCalled();
    });

    it('ADMIN reads one broker by bypass', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer()).get(`/brokers/${BROKER_ID}`).expect(200);
      expect(prismaMock.userPermission.findMany).not.toHaveBeenCalled();
    });

    it('ADMIN updates a broker by bypass', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer())
        .patch(`/brokers/${BROKER_ID}`)
        .send({ city: 'Cairo' })
        .expect(200);
      expect(prismaMock.broker.update).toHaveBeenCalled();
    });

    it('rejects SALES at the @Roles layer (brokers admin is ADMIN-only)', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['brokers:read'],
      };
      await request(app.getHttpServer()).get('/brokers').expect(403);
      expect(prismaMock.userPermission.findMany).not.toHaveBeenCalled();
    });

    it('rejects unauthenticated requests', async () => {
      FakeAuthGuard.currentUser = null;
      await request(app.getHttpServer()).get('/brokers').expect(403);
    });
  });

  // ── PATCH /status — non-destructive only ────────────────────────────────

  describe('PATCH /brokers/:id/status (non-destructive, brokers:update)', () => {
    it('ADMIN can reactivate (status=ACTIVE) by bypass', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer())
        .patch(`/brokers/${BROKER_ID}/status`)
        .send({ status: 'ACTIVE' })
        .expect(200);
      expect(prismaMock.broker.update).toHaveBeenCalled();
    });

    it('rejects SUSPENDED through the generic route (DTO whitelist, 400)', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer())
        .patch(`/brokers/${BROKER_ID}/status`)
        .send({ status: 'SUSPENDED' })
        .expect(400);
      expect(prismaMock.broker.update).not.toHaveBeenCalled();
    });

    it('rejects TERMINATED through the generic route (DTO whitelist, 400)', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer())
        .patch(`/brokers/${BROKER_ID}/status`)
        .send({ status: 'TERMINATED' })
        .expect(400);
      expect(prismaMock.broker.update).not.toHaveBeenCalled();
    });
  });

  // ── Strict suspend ──────────────────────────────────────────────────────

  describe('POST /brokers/:id/suspend (strict)', () => {
    it('ADMIN WITHOUT brokers:suspend → structured 403; service never called', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      const res = await request(app.getHttpServer())
        .post(`/brokers/${BROKER_ID}/suspend`)
        .send({ reason: 'late docs' })
        .expect(403);
      expect(res.body).toMatchObject({
        code: 'missing_permission',
        permissions: ['brokers:suspend'],
      });
      expect(suspendSpy).not.toHaveBeenCalled();
      expect(prismaMock.broker.update).not.toHaveBeenCalled();
    });

    it('ADMIN WITH brokers:suspend can suspend (service runs, broker updated)', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'admin-2',
        role: UserRole.ADMIN,
        codes: ['brokers:suspend'],
      };
      await request(app.getHttpServer())
        .post(`/brokers/${BROKER_ID}/suspend`)
        .send({ reason: 'late docs' })
        .expect(201);
      expect(suspendSpy).toHaveBeenCalledTimes(1);
      const updateArgs = prismaMock.broker.update.mock.calls[0]![0] as {
        data: { status: string };
      };
      expect(updateArgs.data.status).toBe('SUSPENDED');
    });

    it('holding brokers:terminate does NOT authorize suspend (structured 403)', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'admin-3',
        role: UserRole.ADMIN,
        codes: ['brokers:terminate'],
      };
      const res = await request(app.getHttpServer())
        .post(`/brokers/${BROKER_ID}/suspend`)
        .send({})
        .expect(403);
      expect(res.body).toMatchObject({ permissions: ['brokers:suspend'] });
      expect(suspendSpy).not.toHaveBeenCalled();
    });

    it('business validation still runs after the gate passes (404 for missing broker)', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'admin-2',
        role: UserRole.ADMIN,
        codes: ['brokers:suspend'],
      };
      prismaMock.broker.findUnique.mockResolvedValueOnce(null);
      await request(app.getHttpServer())
        .post(`/brokers/${BROKER_ID}/suspend`)
        .send({})
        .expect(404);
    });
  });

  // ── Strict terminate ────────────────────────────────────────────────────

  describe('POST /brokers/:id/terminate (strict)', () => {
    it('ADMIN WITHOUT brokers:terminate → structured 403; service never called', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      const res = await request(app.getHttpServer())
        .post(`/brokers/${BROKER_ID}/terminate`)
        .send({})
        .expect(403);
      expect(res.body).toMatchObject({
        code: 'missing_permission',
        permissions: ['brokers:terminate'],
      });
      expect(terminateSpy).not.toHaveBeenCalled();
      expect(prismaMock.broker.update).not.toHaveBeenCalled();
    });

    it('ADMIN WITH brokers:terminate can terminate (status TERMINATED)', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'admin-2',
        role: UserRole.ADMIN,
        codes: ['brokers:terminate'],
      };
      await request(app.getHttpServer())
        .post(`/brokers/${BROKER_ID}/terminate`)
        .send({ reason: 'contract ended' })
        .expect(201);
      expect(terminateSpy).toHaveBeenCalledTimes(1);
      const updateArgs = prismaMock.broker.update.mock.calls[0]![0] as {
        data: { status: string };
      };
      expect(updateArgs.data.status).toBe('TERMINATED');
    });
  });
});
