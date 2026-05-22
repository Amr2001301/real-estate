import { CanActivate, ExecutionContext, Global, INestApplication, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { UserRole } from '@prisma/client';
import { UnitMaintenanceItemsModule } from '../unit-maintenance-items.module';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { PrismaService } from '../../../common/prisma/prisma.service';

/**
 * Batch 13A — unit maintenance/warranty items CRUD.
 * Verifies ADMIN-only access, ownership/validation rules, the active-by-default
 * list, and the display-only computed warrantyStatus.
 */

const UNIT_ID = 'a1111111-1111-4111-8111-111111111111';
const MISSING_UNIT_ID = 'a2222222-2222-4222-8222-222222222222';
const CATEGORY_ID = 'b1111111-1111-4111-8111-111111111111';
const INACTIVE_CATEGORY_ID = 'b2222222-2222-4222-8222-222222222222';
const MISSING_CATEGORY_ID = 'b3333333-3333-4333-8333-333333333333';
const ITEM_ID = 'c1111111-1111-4111-8111-111111111111';
const FOREIGN_ITEM_ID = 'c2222222-2222-4222-8222-222222222222';
const WARRANTIED_ITEM_ID = 'c3333333-3333-4333-8333-333333333333';
const OTHER_UNIT_ID = 'a9999999-9999-4999-8999-999999999999';

const FUTURE = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
const PAST = new Date(Date.now() - 24 * 60 * 60 * 1000);

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
    req.user = { sub: FakeAuthGuard.currentUser.sub, role: FakeAuthGuard.currentUser.role, email: null, phone: null };
    return true;
  }
}

const listFixture: { rows: Array<Record<string, unknown>> } = { rows: [] };

function makePrismaMock() {
  return {
    userPermission: {
      findMany: jest.fn().mockImplementation(async () => {
        const u = FakeAuthGuard.currentUser;
        return (u?.codes ?? []).map((code) => ({ permission: { code } }));
      }),
    },
    unit: {
      findUnique: jest.fn().mockImplementation(async ({ where }: { where: { id: string } }) =>
        where.id === MISSING_UNIT_ID ? null : { id: where.id },
      ),
    },
    maintenanceCategory: {
      findUnique: jest.fn().mockImplementation(async ({ where }: { where: { id: string } }) => {
        if (where.id === CATEGORY_ID) return { id: where.id, active: true };
        if (where.id === INACTIVE_CATEGORY_ID) return { id: where.id, active: false };
        return null;
      }),
    },
    unitMaintenanceItem: {
      findMany: jest.fn().mockImplementation(async ({ where }: { where: { active?: boolean } }) =>
        listFixture.rows.filter((r) => where.active === undefined || r.active === where.active),
      ),
      findUnique: jest.fn().mockImplementation(async ({ where }: { where: { id: string } }) => {
        if (where.id === ITEM_ID) return { id: where.id, unitId: UNIT_ID, name: { ar: 'ع', en: 'en' }, warrantyStart: null, warrantyEnd: null };
        if (where.id === FOREIGN_ITEM_ID) return { id: where.id, unitId: OTHER_UNIT_ID, name: { ar: 'ع', en: 'en' }, warrantyStart: null, warrantyEnd: null };
        if (where.id === WARRANTIED_ITEM_ID) return { id: where.id, unitId: UNIT_ID, name: { ar: 'ع', en: 'en' }, warrantyStart: new Date('2030-01-01'), warrantyEnd: new Date('2031-01-01') };
        return null;
      }),
      create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'item-new',
        category: null,
        ...data,
      })),
      update: jest.fn().mockImplementation(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => ({
        id: where.id,
        unitId: UNIT_ID,
        category: null,
        warrantyEnd: null,
        ...data,
      })),
    },
  };
}

describe('UnitMaintenanceItems · CRUD + permissions', () => {
  let app: INestApplication;
  let mock: ReturnType<typeof makePrismaMock>;

  beforeAll(async () => {
    mock = makePrismaMock();

    @Global()
    @Module({
      providers: [{ provide: PrismaService, useValue: mock }],
      exports: [PrismaService],
    })
    class MockPrismaModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [MockPrismaModule, UnitMaintenanceItemsModule],
      providers: [
        { provide: APP_GUARD, useClass: FakeAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    FakeAuthGuard.currentUser = null;
    listFixture.rows = [];
    mock.unitMaintenanceItem.create.mockClear();
    mock.unitMaintenanceItem.update.mockClear();
    mock.unitMaintenanceItem.findMany.mockClear();
  });

  const base = `/units/${UNIT_ID}/maintenance-items`;
  const admin: FakeUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };

  describe('POST (create)', () => {
    it('ADMIN creates an item; response carries computed warrantyStatus', async () => {
      FakeAuthGuard.currentUser = admin;
      const res = await request(app.getHttpServer())
        .post(base)
        .send({ ar: 'تكييف', en: 'AC', warrantyEnd: FUTURE.toISOString() })
        .expect(201);
      expect(mock.unitMaintenanceItem.create).toHaveBeenCalledTimes(1);
      expect(res.body.id).toBe('item-new');
      expect(res.body.warrantyStatus).toBe('IN_WARRANTY');
    });

    it('computes OUT_OF_WARRANTY for a past warrantyEnd', async () => {
      FakeAuthGuard.currentUser = admin;
      const res = await request(app.getHttpServer())
        .post(base)
        .send({ ar: 'سباكة', en: 'Plumbing', warrantyEnd: PAST.toISOString() })
        .expect(201);
      expect(res.body.warrantyStatus).toBe('OUT_OF_WARRANTY');
    });

    it('computes UNKNOWN when no warrantyEnd', async () => {
      FakeAuthGuard.currentUser = admin;
      const res = await request(app.getHttpServer())
        .post(base)
        .send({ ar: 'أبواب', en: 'Doors' })
        .expect(201);
      expect(res.body.warrantyStatus).toBe('UNKNOWN');
    });

    it('accepts a valid active category', async () => {
      FakeAuthGuard.currentUser = admin;
      await request(app.getHttpServer())
        .post(base)
        .send({ ar: 'تكييف', en: 'AC', categoryId: CATEGORY_ID })
        .expect(201);
    });

    it('rejects a missing unit (404, no create)', async () => {
      FakeAuthGuard.currentUser = admin;
      await request(app.getHttpServer())
        .post(`/units/${MISSING_UNIT_ID}/maintenance-items`)
        .send({ ar: 'تكييف', en: 'AC' })
        .expect(404);
      expect(mock.unitMaintenanceItem.create).not.toHaveBeenCalled();
    });

    it('rejects a missing category (400, no create)', async () => {
      FakeAuthGuard.currentUser = admin;
      await request(app.getHttpServer())
        .post(base)
        .send({ ar: 'تكييف', en: 'AC', categoryId: MISSING_CATEGORY_ID })
        .expect(400);
      expect(mock.unitMaintenanceItem.create).not.toHaveBeenCalled();
    });

    it('rejects an inactive category (400)', async () => {
      FakeAuthGuard.currentUser = admin;
      await request(app.getHttpServer())
        .post(base)
        .send({ ar: 'تكييف', en: 'AC', categoryId: INACTIVE_CATEGORY_ID })
        .expect(400);
    });

    it('rejects warrantyEnd before warrantyStart (400)', async () => {
      FakeAuthGuard.currentUser = admin;
      await request(app.getHttpServer())
        .post(base)
        .send({ ar: 'تكييف', en: 'AC', warrantyStart: FUTURE.toISOString(), warrantyEnd: PAST.toISOString() })
        .expect(400);
      expect(mock.unitMaintenanceItem.create).not.toHaveBeenCalled();
    });
  });

  describe('GET (list)', () => {
    beforeEach(() => {
      listFixture.rows = [
        { id: 'active-1', unitId: UNIT_ID, active: true, warrantyEnd: FUTURE, name: { ar: 'ع', en: 'AC' }, category: null },
        { id: 'inactive-1', unitId: UNIT_ID, active: false, warrantyEnd: null, name: { ar: 'ع', en: 'Old' }, category: null },
      ];
    });

    it('returns only active items by default', async () => {
      FakeAuthGuard.currentUser = admin;
      const res = await request(app.getHttpServer()).get(base).expect(200);
      expect(res.body.map((r: { id: string }) => r.id)).toEqual(['active-1']);
      expect(res.body[0].warrantyStatus).toBe('IN_WARRANTY');
    });

    it('includeInactive=true returns inactive items too', async () => {
      FakeAuthGuard.currentUser = admin;
      const res = await request(app.getHttpServer()).get(`${base}?includeInactive=true`).expect(200);
      expect(res.body.map((r: { id: string }) => r.id)).toEqual(['active-1', 'inactive-1']);
    });
  });

  describe('PATCH (update / soft-deactivate)', () => {
    it('updates fields on an item belonging to the unit', async () => {
      FakeAuthGuard.currentUser = admin;
      await request(app.getHttpServer())
        .patch(`${base}/${ITEM_ID}`)
        .send({ supplierName: 'Acme', notes: 'replaced compressor' })
        .expect(200);
      const call = mock.unitMaintenanceItem.update.mock.calls[0]![0] as { data: Record<string, unknown> };
      expect(call.data.supplierName).toBe('Acme');
      expect(call.data.notes).toBe('replaced compressor');
    });

    it('soft-deactivates with active=false', async () => {
      FakeAuthGuard.currentUser = admin;
      await request(app.getHttpServer()).patch(`${base}/${ITEM_ID}`).send({ active: false }).expect(200);
      const call = mock.unitMaintenanceItem.update.mock.calls[0]![0] as { data: Record<string, unknown> };
      expect(call.data.active).toBe(false);
    });

    it('rejects an item that belongs to another unit (404, no update)', async () => {
      FakeAuthGuard.currentUser = admin;
      await request(app.getHttpServer()).patch(`${base}/${FOREIGN_ITEM_ID}`).send({ active: false }).expect(404);
      expect(mock.unitMaintenanceItem.update).not.toHaveBeenCalled();
    });

    it('rejects deactivating an item whose warranty has already started (400, no update)', async () => {
      FakeAuthGuard.currentUser = admin;
      await request(app.getHttpServer()).patch(`${base}/${WARRANTIED_ITEM_ID}`).send({ active: false }).expect(400);
      expect(mock.unitMaintenanceItem.update).not.toHaveBeenCalled();
    });

    it('rejects warrantyEnd before warrantyStart on update (400)', async () => {
      FakeAuthGuard.currentUser = admin;
      await request(app.getHttpServer())
        .patch(`${base}/${ITEM_ID}`)
        .send({ warrantyStart: FUTURE.toISOString(), warrantyEnd: PAST.toISOString() })
        .expect(400);
      expect(mock.unitMaintenanceItem.update).not.toHaveBeenCalled();
    });
  });

  describe('Role enforcement', () => {
    it.each<[UserRole]>([
      [UserRole.SALES],
      [UserRole.SALES_MANAGER],
      [UserRole.MAINTENANCE_SUPERVISOR],
      [UserRole.CUSTOMER],
    ])('%s cannot create items (403)', async (role) => {
      FakeAuthGuard.currentUser = { sub: 'u-1', role, codes: ['maintenance:items:manage', 'maintenance:read'] };
      await request(app.getHttpServer()).post(base).send({ ar: 'x', en: 'x' }).expect(403);
      expect(mock.unitMaintenanceItem.create).not.toHaveBeenCalled();
    });

    it('unauthenticated request is rejected (403)', async () => {
      FakeAuthGuard.currentUser = null;
      await request(app.getHttpServer()).get(base).expect(403);
    });
  });
});
