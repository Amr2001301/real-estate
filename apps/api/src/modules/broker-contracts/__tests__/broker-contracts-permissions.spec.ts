import {
  CanActivate,
  ExecutionContext,
  Global,
  INestApplication,
  Module,
} from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { UserRole } from '@prisma/client';
import { BrokerContractsController } from '../broker-contracts.controller';
import { BrokerContractsService } from '../broker-contracts.service';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  PERMISSIONS_KEY,
  type PermissionsMeta,
} from '../../../common/decorators/permissions.decorator';

/**
 * Broker permissions · Batch 4 (broker contracts).
 *
 *   - list/findOne → broker_contracts:read (bypass; @Roles allows ADMIN +
 *     SALES, so a SALES user must hold the code).
 *   - Broker portal authorization untouched (no portal files imported).
 */

const CONTRACT_ID = 'b1111111-1111-4111-8111-111111111111';

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
    contract: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      findUnique: jest.fn().mockResolvedValue({
        id: CONTRACT_ID,
        brokerId: 'broker-1',
        reservationId: null,
      }),
    },
    reservation: { findUnique: jest.fn().mockResolvedValue(null) },
    $transaction: jest.fn().mockImplementation(async (ops: unknown) => {
      if (Array.isArray(ops)) return Promise.all(ops);
      return ops;
    }),
  };
}

describe('Broker contracts module · permissions enforcement', () => {
  let app: INestApplication;
  let prismaMock: ReturnType<typeof makePrismaMock>;
  let reflector: Reflector;
  let listSpy: jest.SpyInstance;

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
      controllers: [BrokerContractsController],
      providers: [BrokerContractsService],
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
    listSpy = jest.spyOn(moduleRef.get(BrokerContractsService), 'list');

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    FakeAuthGuard.currentUser = null;
    prismaMock.userPermission.findMany.mockClear();
    listSpy.mockClear();
  });

  describe('@Permissions metadata', () => {
    const proto = BrokerContractsController.prototype as unknown as Record<
      string,
      (...a: unknown[]) => unknown
    >;
    it.each<[string]>([['list'], ['findOne']])(
      '%s → @Permissions(broker_contracts:read), bypass true',
      (method) => {
        expect(
          reflector.get<PermissionsMeta | undefined>(PERMISSIONS_KEY, proto[method]!),
        ).toMatchObject({ codes: ['broker_contracts:read'], adminBypass: true });
      },
    );
  });

  it('ADMIN lists by bypass — no permission DB lookup', async () => {
    FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
    await request(app.getHttpServer()).get('/broker-contracts').expect(200);
    expect(prismaMock.userPermission.findMany).not.toHaveBeenCalled();
    expect(listSpy).toHaveBeenCalledTimes(1);
  });

  it('ADMIN reads one contract by bypass', async () => {
    FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
    await request(app.getHttpServer()).get(`/broker-contracts/${CONTRACT_ID}`).expect(200);
  });

  it('SALES WITH broker_contracts:read can list (DB lookup occurs)', async () => {
    FakeAuthGuard.currentUser = {
      sub: 'sales-1',
      role: UserRole.SALES,
      codes: ['broker_contracts:read'],
    };
    await request(app.getHttpServer()).get('/broker-contracts').expect(200);
    expect(prismaMock.userPermission.findMany).toHaveBeenCalled();
  });

  it('SALES WITHOUT broker_contracts:read → structured 403; service never runs', async () => {
    FakeAuthGuard.currentUser = { sub: 'sales-2', role: UserRole.SALES, codes: [] };
    const res = await request(app.getHttpServer()).get('/broker-contracts').expect(403);
    expect(res.body).toMatchObject({
      code: 'missing_permission',
      permissions: ['broker_contracts:read'],
    });
    expect(listSpy).not.toHaveBeenCalled();
  });

  it('CUSTOMER blocked at the @Roles layer even with the code', async () => {
    FakeAuthGuard.currentUser = {
      sub: 'cust-1',
      role: UserRole.CUSTOMER,
      codes: ['broker_contracts:read'],
    };
    await request(app.getHttpServer()).get('/broker-contracts').expect(403);
    expect(prismaMock.userPermission.findMany).not.toHaveBeenCalled();
    expect(listSpy).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated requests', async () => {
    FakeAuthGuard.currentUser = null;
    await request(app.getHttpServer()).get('/broker-contracts').expect(403);
  });
});
