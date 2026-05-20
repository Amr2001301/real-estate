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
import { BrokerReservationsController } from '../broker-reservations.controller';
import { BrokerReservationsService } from '../broker-reservations.service';
import { BrokerPortalReservationsService } from '../../broker-portal/broker-portal-reservations.service';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  PERMISSIONS_KEY,
  type PermissionsMeta,
} from '../../../common/decorators/permissions.decorator';

/**
 * Broker permissions · Batch 4 (broker reservations).
 *
 *   - list/findOne → broker_reservations:read (bypass; @Roles ADMIN + SALES).
 *   - POST → broker_reservations:create (bypass; @Roles ADMIN-only).
 *   - Broker portal authorization untouched (no portal files imported).
 */

const RES_ID = 'b1111111-1111-4111-8111-111111111111';
const BROKER_ID = 'b2222222-2222-4222-8222-222222222222';
const LEAD_ID = 'b3333333-3333-4333-8333-333333333333';
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
    reservation: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      findUnique: jest.fn().mockResolvedValue({ id: RES_ID, brokerId: BROKER_ID }),
    },
    // createOnBehalfOfBroker reads the broker first; null → 404 (business
    // validation runs after the gate passes).
    broker: { findUnique: jest.fn().mockResolvedValue(null) },
    $transaction: jest.fn().mockImplementation(async (ops: unknown) => {
      if (Array.isArray(ops)) return Promise.all(ops);
      return ops;
    }),
  };
}

describe('Broker reservations module · permissions enforcement', () => {
  let app: INestApplication;
  let prismaMock: ReturnType<typeof makePrismaMock>;
  let reflector: Reflector;
  let listSpy: jest.SpyInstance;
  let createSpy: jest.SpyInstance;

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
      controllers: [BrokerReservationsController],
      providers: [
        BrokerReservationsService,
        // Stubbed — the admin create path only reaches this after broker
        // validation, which our tests short-circuit with a 404.
        { provide: BrokerPortalReservationsService, useValue: {} },
      ],
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
    const svc = moduleRef.get(BrokerReservationsService);
    listSpy = jest.spyOn(svc, 'list');
    createSpy = jest.spyOn(svc, 'createOnBehalfOfBroker');

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
    listSpy.mockClear();
    createSpy.mockClear();
  });

  describe('@Permissions metadata', () => {
    const proto = BrokerReservationsController.prototype as unknown as Record<
      string,
      (...a: unknown[]) => unknown
    >;
    function getMeta(method: string): PermissionsMeta | undefined {
      return reflector.get<PermissionsMeta | undefined>(PERMISSIONS_KEY, proto[method]!);
    }

    it.each<[string]>([['list'], ['findOne']])(
      '%s → @Permissions(broker_reservations:read), bypass true',
      (method) => {
        expect(getMeta(method)).toMatchObject({
          codes: ['broker_reservations:read'],
          adminBypass: true,
        });
      },
    );

    it('createOnBehalfOfBroker → @Permissions(broker_reservations:create), bypass true', () => {
      expect(getMeta('createOnBehalfOfBroker')).toMatchObject({
        codes: ['broker_reservations:create'],
        adminBypass: true,
      });
    });
  });

  // ── Read ──────────────────────────────────────────────────────────────────

  it('ADMIN lists by bypass — no permission DB lookup', async () => {
    FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
    await request(app.getHttpServer()).get('/broker-reservations').expect(200);
    expect(prismaMock.userPermission.findMany).not.toHaveBeenCalled();
    expect(listSpy).toHaveBeenCalledTimes(1);
  });

  it('SALES WITH broker_reservations:read can list', async () => {
    FakeAuthGuard.currentUser = {
      sub: 'sales-1',
      role: UserRole.SALES,
      codes: ['broker_reservations:read'],
    };
    await request(app.getHttpServer()).get('/broker-reservations').expect(200);
    expect(prismaMock.userPermission.findMany).toHaveBeenCalled();
  });

  it('SALES WITHOUT broker_reservations:read → structured 403; service never runs', async () => {
    FakeAuthGuard.currentUser = { sub: 'sales-2', role: UserRole.SALES, codes: [] };
    const res = await request(app.getHttpServer()).get('/broker-reservations').expect(403);
    expect(res.body).toMatchObject({
      code: 'missing_permission',
      permissions: ['broker_reservations:read'],
    });
    expect(listSpy).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated requests', async () => {
    FakeAuthGuard.currentUser = null;
    await request(app.getHttpServer()).get('/broker-reservations').expect(403);
  });

  // ── Create ──────────────────────────────────────────────────────────────

  it('ADMIN creates by bypass; business validation still runs (404 for missing broker)', async () => {
    FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
    await request(app.getHttpServer())
      .post('/broker-reservations')
      .send({ brokerId: BROKER_ID, leadId: LEAD_ID, unitId: UNIT_ID })
      .expect(404);
    // Gate passed → the service ran and hit the missing-broker validation.
    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(prismaMock.userPermission.findMany).not.toHaveBeenCalled();
  });

  it('SALES with broker_reservations:create still blocked by @Roles (create is ADMIN-only)', async () => {
    FakeAuthGuard.currentUser = {
      sub: 'sales-1',
      role: UserRole.SALES,
      codes: ['broker_reservations:create'],
    };
    await request(app.getHttpServer())
      .post('/broker-reservations')
      .send({ brokerId: BROKER_ID, leadId: LEAD_ID, unitId: UNIT_ID })
      .expect(403);
    expect(createSpy).not.toHaveBeenCalled();
  });
});
