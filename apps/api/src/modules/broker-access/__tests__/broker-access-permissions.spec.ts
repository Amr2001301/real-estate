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
import { BrokerAccessController } from '../broker-access.controller';
import { BrokerAccessService } from '../broker-access.service';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  PERMISSIONS_KEY,
  type PermissionsMeta,
} from '../../../common/decorators/permissions.decorator';

/**
 * Broker permissions · Batch 2 (broker access).
 *
 *   - read route → broker_access:read (bypass).
 *   - grant/revoke project + unit routes → broker_access:manage (bypass).
 *     No strict gate: access management is reversible and routinely adjusted,
 *     unlike firm suspend/terminate.
 *   - Broker portal authorization untouched (no portal files imported).
 */

const BROKER_ID = 'b1111111-1111-4111-8111-111111111111';
const PROJECT_ID = 'b3333333-3333-4333-8333-333333333333';
const UNIT_ID = 'b4444444-4444-4444-8444-444444444444';

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
      findUnique: jest.fn().mockResolvedValue({ id: BROKER_ID, status: 'ACTIVE' }),
    },
    project: {
      findUnique: jest.fn().mockResolvedValue({ id: PROJECT_ID, status: 'PUBLISHED' }),
    },
    unit: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: UNIT_ID, building: { phase: { projectId: PROJECT_ID } } }),
    },
    brokerProjectAccess: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'pa1' }),
      update: jest.fn().mockResolvedValue({ id: 'pa1', active: false }),
    },
    brokerUnitAccess: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'ua1' }),
      update: jest.fn().mockResolvedValue({ id: 'ua1', active: false }),
    },
    $transaction: jest.fn().mockImplementation(async (ops: unknown) => {
      if (Array.isArray(ops)) return Promise.all(ops);
      return ops;
    }),
  };
}

describe('Broker access module · permissions enforcement', () => {
  let app: INestApplication;
  let prismaMock: ReturnType<typeof makePrismaMock>;
  let reflector: Reflector;

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
      controllers: [BrokerAccessController],
      providers: [BrokerAccessService],
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
    prismaMock.brokerProjectAccess.create.mockClear();
    prismaMock.brokerProjectAccess.update.mockClear();
    prismaMock.brokerProjectAccess.findUnique.mockClear();
    prismaMock.brokerProjectAccess.findUnique.mockResolvedValue(null);
    prismaMock.brokerUnitAccess.create.mockClear();
    prismaMock.brokerUnitAccess.update.mockClear();
  });

  // ── Metadata ────────────────────────────────────────────────────────────

  describe('@Permissions metadata', () => {
    const proto = BrokerAccessController.prototype as unknown as Record<
      string,
      (...a: unknown[]) => unknown
    >;
    function getMeta(method: string): PermissionsMeta | undefined {
      return reflector.get<PermissionsMeta | undefined>(PERMISSIONS_KEY, proto[method]!);
    }

    it('list → @Permissions(broker_access:read), bypass true', () => {
      expect(getMeta('list')).toMatchObject({
        codes: ['broker_access:read'],
        adminBypass: true,
      });
    });

    it.each<[string]>([['grantProject'], ['revokeProject'], ['grantUnit'], ['revokeUnit']])(
      '%s → @Permissions(broker_access:manage), bypass true',
      (method) => {
        expect(getMeta(method)).toMatchObject({
          codes: ['broker_access:manage'],
          adminBypass: true,
        });
      },
    );
  });

  // ── Behavior ──────────────────────────────────────────────────────────────

  describe('access routes (bypass)', () => {
    it('ADMIN reads access without a permission DB lookup', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer()).get(`/brokers/${BROKER_ID}/access`).expect(200);
      expect(prismaMock.userPermission.findMany).not.toHaveBeenCalled();
    });

    it('ADMIN grants project access by bypass', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer())
        .post(`/brokers/${BROKER_ID}/access/projects`)
        .send({ projectId: PROJECT_ID })
        .expect(201);
      expect(prismaMock.brokerProjectAccess.create).toHaveBeenCalled();
    });

    it('ADMIN grants unit access by bypass', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer())
        .post(`/brokers/${BROKER_ID}/access/units`)
        .send({ unitId: UNIT_ID })
        .expect(201);
      expect(prismaMock.brokerUnitAccess.create).toHaveBeenCalled();
    });

    it('ADMIN revokes project access by bypass', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      // The grant must exist for a soft-revoke to apply.
      prismaMock.brokerProjectAccess.findUnique.mockResolvedValueOnce({ id: 'pa1' });
      await request(app.getHttpServer())
        .delete(`/brokers/${BROKER_ID}/access/projects/${PROJECT_ID}`)
        .expect(200);
      expect(prismaMock.brokerProjectAccess.update).toHaveBeenCalled();
    });

    it('rejects SALES at the @Roles layer (access mgmt is ADMIN-only)', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['broker_access:read', 'broker_access:manage'],
      };
      await request(app.getHttpServer()).get(`/brokers/${BROKER_ID}/access`).expect(403);
      expect(prismaMock.userPermission.findMany).not.toHaveBeenCalled();
    });

    it('rejects unauthenticated requests', async () => {
      FakeAuthGuard.currentUser = null;
      await request(app.getHttpServer()).get(`/brokers/${BROKER_ID}/access`).expect(403);
    });
  });
});
