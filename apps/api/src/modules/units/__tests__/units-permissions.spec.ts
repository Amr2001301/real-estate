import { CanActivate, ExecutionContext, Global, INestApplication, Module } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { UserRole } from '@prisma/client';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';
import { UnitsModule } from '../units.module';
import { UnitsController } from '../units.controller';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  PERMISSIONS_KEY,
  type PermissionsMeta,
} from '../../../common/decorators/permissions.decorator';

/**
 * Verifies the units permissions rollout:
 *   * Per-route metadata; @Public preserved on /public/units routes.
 *   * ADMIN bypass + SALES with units:read covers list/get/calculator.
 *   * SALES without units:read gets structured 403; service never called.
 *   * Admin-only mutations remain blocked by @Roles for SALES regardless
 *     of permission grants.
 *   * Status route writes UnitStatusHistory after the gate passes.
 *   * DELETE refuses SOLD units and refuses linked reservations/contracts.
 */

interface FakeUser {
  sub: string;
  role: UserRole;
  codes: string[];
}

class FakeAuthGuard implements CanActivate {
  static currentUser: FakeUser | null = null;
  canActivate(context: ExecutionContext): boolean {
    const reflector = new Reflector();
    const isPublic = reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
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

const fixture: {
  unit: {
    id: string;
    code: string;
    status: 'AVAILABLE' | 'RESERVED' | 'SOLD';
    reservationExpiresAt: Date | null;
    price: number;
    updatedAt: Date;
  };
  blockers: { reservations: number; contracts: number; maintenance: number };
} = {
  unit: {
    id: 'a1111111-1111-4111-8111-111111111111',
    code: 'A-101',
    status: 'AVAILABLE',
    reservationExpiresAt: null,
    price: 100000,
    updatedAt: new Date('2026-01-01'),
  },
  blockers: { reservations: 0, contracts: 0, maintenance: 0 },
};

function makePrismaMock() {
  const m = {
    userPermission: {
      findMany: jest.fn().mockImplementation(async () => {
        const u = FakeAuthGuard.currentUser;
        return (u?.codes ?? []).map((code) => ({ permission: { code } }));
      }),
    },
    unit: {
      findMany: jest.fn().mockResolvedValue([]),
      // findOne(publicOnly=true) traverses unit.building.phase.project.status,
      // so return the nested include shape.
      findUnique: jest.fn().mockImplementation(async () => ({
        ...fixture.unit,
        media: [],
        history: [],
        building: {
          id: 'b-1',
          phase: { id: 'ph-1', project: { id: 'p-1', status: 'PUBLISHED' } },
        },
      })),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'u-new',
        ...data,
      })),
      update: jest.fn().mockImplementation(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => ({
        ...fixture.unit,
        ...data,
        id: where.id,
      })),
      delete: jest.fn().mockResolvedValue({ id: fixture.unit.id }),
    },
    unitStatusHistory: { create: jest.fn().mockResolvedValue({}) },
    reservation: { count: jest.fn().mockImplementation(async () => fixture.blockers.reservations) },
    contract: { count: jest.fn().mockImplementation(async () => fixture.blockers.contracts) },
    maintenanceRequest: { count: jest.fn().mockImplementation(async () => fixture.blockers.maintenance) },
    $transaction: jest.fn(),
  };

  m.$transaction.mockImplementation(async (ops: unknown) => {
    if (Array.isArray(ops)) return Promise.all(ops);
    if (typeof ops === 'function') {
      const tx = {
        unit: m.unit,
        unitStatusHistory: m.unitStatusHistory,
      };
      return (ops as (tx: unknown) => Promise<unknown>)(tx);
    }
    return ops;
  });

  return m;
}

describe('Units module · permissions enforcement', () => {
  let app: INestApplication;
  let mock: ReturnType<typeof makePrismaMock>;
  let reflector: Reflector;

  beforeAll(async () => {
    mock = makePrismaMock();

    @Global()
    @Module({
      providers: [{ provide: PrismaService, useValue: mock }],
      exports: [PrismaService],
    })
    class MockPrismaModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [MockPrismaModule, UnitsModule],
      providers: [
        Reflector,
        { provide: APP_GUARD, useClass: FakeAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
      ],
    }).compile();

    reflector = moduleRef.get(Reflector);
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    FakeAuthGuard.currentUser = null;
    mock.userPermission.findMany.mockClear();
    mock.unit.findMany.mockClear();
    mock.unit.create.mockClear();
    mock.unit.update.mockClear();
    mock.unit.delete.mockClear();
    mock.unitStatusHistory.create.mockClear();
    // Reset fixture to AVAILABLE + no blockers.
    fixture.unit = {
      id: 'a1111111-1111-4111-8111-111111111111',
      code: 'A-101',
      status: 'AVAILABLE',
      reservationExpiresAt: null,
      price: 100000,
      updatedAt: new Date('2026-01-01'),
    };
    fixture.blockers = { reservations: 0, contracts: 0, maintenance: 0 };
  });

  const Ctor = UnitsController as unknown as new () => unknown;
  const proto = Ctor.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;
  function getMeta(method: string): PermissionsMeta | undefined {
    return reflector.get<PermissionsMeta | undefined>(PERMISSIONS_KEY, proto[method]!);
  }
  function isPublic(method: string): boolean | undefined {
    return reflector.get<boolean | undefined>(IS_PUBLIC_KEY, proto[method]!);
  }

  // ── Metadata ───────────────────────────────────────────────────────────

  describe('@Permissions metadata', () => {
    it.each<[string]>([['publicList'], ['publicGet']])('%s — no permission metadata, @Public preserved', (m) => {
      expect(getMeta(m)).toBeUndefined();
      expect(isPublic(m)).toBe(true);
    });

    it.each<[string]>([['list'], ['get'], ['calc']])('%s → units:read, bypass true', (m) => {
      expect(getMeta(m)).toMatchObject({ codes: ['units:read'], adminBypass: true });
    });

    it('create → units:create, bypass true', () => {
      expect(getMeta('create')).toMatchObject({ codes: ['units:create'], adminBypass: true });
    });
    it('update → units:update, bypass true', () => {
      expect(getMeta('update')).toMatchObject({ codes: ['units:update'], adminBypass: true });
    });
    it('setStatus → units:change-status, bypass true', () => {
      expect(getMeta('setStatus')).toMatchObject({
        codes: ['units:change-status'],
        adminBypass: true,
      });
    });
    it('remove → units:delete, bypass true', () => {
      expect(getMeta('remove')).toMatchObject({ codes: ['units:delete'], adminBypass: true });
    });
  });

  // ── Public routes ─────────────────────────────────────────────────────

  describe('Public browse routes', () => {
    it('unauthenticated GET /public/units → 200; no permission DB lookup', async () => {
      FakeAuthGuard.currentUser = null;
      await request(app.getHttpServer()).get('/public/units').expect(200);
      expect(mock.userPermission.findMany).not.toHaveBeenCalled();
    });

    it('unauthenticated GET /public/units/:id → 200', async () => {
      FakeAuthGuard.currentUser = null;
      await request(app.getHttpServer())
        .get(`/public/units/${fixture.unit.id}`)
        .expect(200);
    });
  });

  // ── Read routes ───────────────────────────────────────────────────────

  describe('Read routes', () => {
    it('ADMIN bypasses GET /units — no permission DB lookup', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer()).get('/units').expect(200);
      expect(mock.userPermission.findMany).not.toHaveBeenCalled();
    });

    it('SALES with units:read → 200 on GET /units', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['units:read'],
      };
      await request(app.getHttpServer()).get('/units').expect(200);
      expect(mock.userPermission.findMany).toHaveBeenCalledTimes(1);
    });

    it('SALES with units:read → 201 on POST /units/calc-installment', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['units:read'],
      };
      await request(app.getHttpServer())
        .post('/units/calc-installment')
        .send({
          unitPrice: 100000,
          downPayment: 10000,
          months: 12,
          increasePercentage: 0,
        })
        .expect(201);
    });

    it('SALES without units:read → structured 403 on GET /units; service not called', async () => {
      FakeAuthGuard.currentUser = { sub: 'sales-2', role: UserRole.SALES, codes: [] };
      const res = await request(app.getHttpServer()).get('/units').expect(403);
      expect(res.body).toMatchObject({
        code: 'missing_permission',
        permissions: ['units:read'],
      });
      expect(mock.unit.findMany).not.toHaveBeenCalled();
    });

    it('unauthenticated GET /units → 403', async () => {
      FakeAuthGuard.currentUser = null;
      await request(app.getHttpServer()).get('/units').expect(403);
    });
  });

  // ── Admin mutations ───────────────────────────────────────────────────

  describe('Admin mutations', () => {
    const VALID_CREATE = {
      buildingId: 'b2222222-2222-4222-8222-222222222222',
      code: 'A-999',
      type: '2BR',
      area: 120,
      bedrooms: 2,
      bathrooms: 2,
      floor: 1,
      price: 100000,
    };

    it('ADMIN bypass on POST /units → 201; unit.create called', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer()).post('/units').send(VALID_CREATE).expect(201);
      expect(mock.unit.create).toHaveBeenCalled();
    });

    it('ADMIN bypass on PATCH /units/:id → 200; unit.update called', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer())
        .patch(`/units/${fixture.unit.id}`)
        .send({ price: 110000 })
        .expect(200);
      expect(mock.unit.update).toHaveBeenCalled();
    });

    it('ADMIN bypass on PATCH /units/:id/status → 200; UnitStatusHistory written', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer())
        .patch(`/units/${fixture.unit.id}/status`)
        .send({ status: 'RESERVED', reason: 'manual hold' })
        .expect(200);
      expect(mock.unit.update).toHaveBeenCalled();
      expect(mock.unitStatusHistory.create).toHaveBeenCalledTimes(1);
    });

    it('ADMIN bypass on DELETE /units/:id (AVAILABLE, no blockers) → 200', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer()).delete(`/units/${fixture.unit.id}`).expect(200);
      expect(mock.unit.delete).toHaveBeenCalled();
    });

    it('SALES even with units:update → 403 from @Roles; unit.update NOT called', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['units:update'],
      };
      await request(app.getHttpServer())
        .patch(`/units/${fixture.unit.id}`)
        .send({ price: 90000 })
        .expect(403);
      expect(mock.userPermission.findMany).not.toHaveBeenCalled();
      expect(mock.unit.update).not.toHaveBeenCalled();
    });

    it('SALES even with units:change-status → 403 from @Roles; no update or history write', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['units:change-status'],
      };
      await request(app.getHttpServer())
        .patch(`/units/${fixture.unit.id}/status`)
        .send({ status: 'AVAILABLE' })
        .expect(403);
      expect(mock.unit.update).not.toHaveBeenCalled();
      expect(mock.unitStatusHistory.create).not.toHaveBeenCalled();
    });

    it('SALES even with units:delete → 403 from @Roles; unit.delete NOT called', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['units:delete'],
      };
      await request(app.getHttpServer())
        .delete(`/units/${fixture.unit.id}`)
        .expect(403);
      expect(mock.unit.delete).not.toHaveBeenCalled();
    });
  });

  // ── Business validation survives the gate ─────────────────────────────

  describe('Business validation — DELETE blockers', () => {
    it('ADMIN bypass + unit is SOLD → 400; unit.delete NOT called', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      fixture.unit.status = 'SOLD';
      await request(app.getHttpServer()).delete(`/units/${fixture.unit.id}`).expect(400);
      expect(mock.unit.delete).not.toHaveBeenCalled();
    });

    it('ADMIN bypass + linked reservations/contracts/maintenance → 409; unit.delete NOT called', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      fixture.blockers = { reservations: 1, contracts: 2, maintenance: 0 };
      await request(app.getHttpServer()).delete(`/units/${fixture.unit.id}`).expect(409);
      expect(mock.unit.delete).not.toHaveBeenCalled();
    });
  });
});
