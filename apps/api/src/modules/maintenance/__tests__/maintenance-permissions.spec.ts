import { CanActivate, ExecutionContext, Global, INestApplication, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { UserRole, MaintenanceStatus, MaintenancePriority, MaintenanceReviewStatus } from '@prisma/client';
import { ROLES_KEY } from '../../../common/decorators/roles.decorator';
import { MaintenanceModule } from '../maintenance.module';
import { DocumentsService } from '../../documents/documents.module';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  PERMISSIONS_KEY,
  type PermissionsMeta,
} from '../../../common/decorators/permissions.decorator';

/**
 * Verifies the maintenance permissions rollout:
 *   * Per-route metadata for the 7 surviving handlers + absence of the
 *     legacy `update` multiplexer.
 *   * GET /maintenance-categories stays role-only (no permission gate) so
 *     CUSTOMER can still read categories.
 *   * Customer self-service routes have no permission metadata.
 *   * Legacy PATCH /maintenance-requests/:id returns 404.
 *   * ADMIN bypass works on the new POST /assign and /status routes.
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

// Mutable fixtures so individual tests control the current request status and
// the users returned for assignee/customer validation.
const ADMIN_ASSIGNEE = 'd4444444-4444-4444-8444-444444444444';
const CUSTOMER_ID = 'e5555555-5555-4555-8555-555555555555';
const SUPERVISOR_ID = 'f6666666-6666-4666-8666-666666666666';
const SUPERVISOR_ASSIGNEE = 'a7777777-7777-4777-8777-777777777777';
const INACTIVE_SUPERVISOR = 'b8888888-8888-4888-8888-888888888888';
const MISSING_REQUEST_ID = 'c9999999-9999-4999-8999-999999999999';
// Mutable request state so update() mutations are visible to the post-action
// notification re-reads (mirrors how the real row reflects the update).
const fixture: {
  requestStatus: MaintenanceStatus;
  assignedAdminId: string | null;
  reviewStatus: MaintenanceReviewStatus;
} = {
  requestStatus: MaintenanceStatus.OPEN,
  assignedAdminId: null,
  // Default APPROVED so existing operational/supervisor tests behave as before;
  // approval-gate tests set this to PENDING/REJECTED explicitly.
  reviewStatus: MaintenanceReviewStatus.APPROVED,
};

// Request-item rows the approval flow reads (handlingSlaMinutesSnapshot → dueAt).
const requestItemsFixture: { rows: Array<{ handlingSlaMinutesSnapshot: number | null }> } = {
  rows: [],
};

// Mutable category fixture so tests control the snapshot (priority/SLA) the
// request inherits and whether a duplicate code already exists.
const categoryFixture: {
  priority: MaintenancePriority;
  slaDurationMinutes: number | null;
  codeExists: boolean;
} = {
  priority: MaintenancePriority.HIGH,
  slaDurationMinutes: 1440,
  codeExists: false,
};

// Contracts the customer-units endpoint reads from; each entry nests the unit
// exactly as the service selects it.
type ContractRow = {
  unit: {
    id: string;
    code: string;
    type: string;
    status: string;
    floor: number;
    building: { id: string; name: string };
  };
};
const contractFixture: { rows: ContractRow[] } = { rows: [] };

// Documents the (mocked) listForOwner draws from; tests set these per case.
type DocRow = { id: string; visibility: string };
const documentFixture: { rows: DocRow[] } = { rows: [] };

// DocumentsService is overridden so the maintenance suite never touches R2 /
// the documents prisma tables — those have their own spec. listForOwner honors
// the optional visibility filter so we can assert the maintenance layer passes
// CUSTOMER_VISIBLE (hiding ADMIN_ONLY supervisor photos from customers).
const documentsMock = {
  presign: jest.fn().mockResolvedValue({
    uploadUrl: 'https://r2.example/upload',
    key: 'documents/2026-05-22/x.jpg',
    publicUrl: 'https://cdn.example/documents/2026-05-22/x.jpg',
  }),
  create: jest.fn().mockImplementation(async (uploadedById: string, dto: Record<string, unknown>) => ({
    id: 'doc-1',
    uploadedById,
    ...dto,
  })),
  listForOwner: jest.fn().mockImplementation(
    async (_ownerType: string, _ownerId: string, _limit: number, visibility?: string) =>
      documentFixture.rows.filter((d) => !visibility || d.visibility === visibility),
  ),
};

function makePrismaMock() {
  return {
    userPermission: {
      findMany: jest.fn().mockImplementation(async () => {
        const u = FakeAuthGuard.currentUser;
        return (u?.codes ?? []).map((code) => ({ permission: { code } }));
      }),
    },
    user: {
      findUnique: jest.fn().mockImplementation(async ({ where }: { where: { id: string } }) => {
        if (where.id === ADMIN_ASSIGNEE) return { id: where.id, role: UserRole.ADMIN, active: true };
        if (where.id === CUSTOMER_ID) return { id: where.id, role: UserRole.CUSTOMER, active: true };
        if (where.id === SUPERVISOR_ASSIGNEE) {
          return { id: where.id, role: UserRole.MAINTENANCE_SUPERVISOR, active: true };
        }
        if (where.id === INACTIVE_SUPERVISOR) {
          return { id: where.id, role: UserRole.MAINTENANCE_SUPERVISOR, active: false };
        }
        return null;
      }),
      // Active admins for the "created" fan-out.
      findMany: jest.fn().mockResolvedValue([{ id: 'admin-a' }, { id: 'admin-b' }]),
    },
    notification: {
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    maintenanceCategory: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockImplementation(
        async ({ where }: { where: { id?: string; code?: string } }) => {
          // Duplicate-prevention lookup by normalized code.
          if (where.code !== undefined) {
            return categoryFixture.codeExists ? { id: 'cat-existing', code: where.code } : null;
          }
          // Lookup by id — the row a request snapshots its priority/SLA from.
          return {
            id: where.id,
            name: { ar: 'ع', en: 'en' },
            active: true,
            code: 'cat',
            priority: categoryFixture.priority,
            slaDurationMinutes: categoryFixture.slaDurationMinutes,
          };
        },
      ),
      create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'cat-new',
        ...data,
      })),
      update: jest.fn().mockImplementation(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => ({
        id: where.id,
        ...data,
      })),
    },
    maintenanceRequest: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      findUnique: jest.fn().mockImplementation(async ({ where }: { where: { id: string } }) =>
        where.id === MISSING_REQUEST_ID
          ? null
          : {
              id: where.id,
              status: fixture.requestStatus,
              reviewStatus: fixture.reviewStatus,
              priority: MaintenancePriority.MEDIUM,
              dueAt: null,
              approvedAt: null,
              rejectedAt: null,
              description: 'desc',
              createdAt: new Date(),
              updatedAt: new Date(),
              assignedAdminId: fixture.assignedAdminId,
              customerId: CUSTOMER_ID,
              customer: null,
              unit: { code: 'A-101' },
              category: null,
              assignedAdmin: null,
              items: [],
            },
      ),
      create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'req-new',
        ...data,
      })),
      update: jest.fn().mockImplementation(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        // Reflect the update so post-action notification re-reads see new state.
        if (typeof data.status === 'string') fixture.requestStatus = data.status as MaintenanceStatus;
        if (typeof data.assignedAdminId === 'string') fixture.assignedAdminId = data.assignedAdminId;
        return { id: where.id, ...data };
      }),
    },
    unit: {
      findUnique: jest.fn().mockResolvedValue({ id: 'unit-1', status: 'SOLD' }),
    },
    unitMaintenanceItem: {
      // No unit items by default → request items snapshot warranty as UNKNOWN.
      findMany: jest.fn().mockResolvedValue([]),
    },
    maintenanceRequestItem: {
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
      findMany: jest.fn().mockImplementation(async () => requestItemsFixture.rows),
    },
    contract: {
      findMany: jest.fn().mockImplementation(async () => contractFixture.rows),
    },
    $transaction: jest.fn().mockImplementation(async (ops: unknown) => {
      if (Array.isArray(ops)) return Promise.all(ops);
      return ops;
    }),
  };
}

describe('Maintenance module · permissions enforcement', () => {
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
      // ConfigModule (global) satisfies R2Service inside the DocumentsModule the
      // MaintenanceModule now imports; DocumentsService itself is overridden.
      imports: [ConfigModule.forRoot({ isGlobal: true }), MockPrismaModule, MaintenanceModule],
      providers: [
        Reflector,
        { provide: APP_GUARD, useClass: FakeAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
      ],
    })
      .overrideProvider(DocumentsService)
      .useValue(documentsMock)
      .compile();

    reflector = moduleRef.get(Reflector);
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    FakeAuthGuard.currentUser = null;
    fixture.requestStatus = MaintenanceStatus.OPEN;
    fixture.assignedAdminId = null;
    fixture.reviewStatus = MaintenanceReviewStatus.APPROVED;
    requestItemsFixture.rows = [];
    mock.maintenanceRequestItem.createMany.mockClear();
    mock.maintenanceRequestItem.findMany.mockClear();
    mock.unitMaintenanceItem.findMany.mockClear();
    categoryFixture.priority = MaintenancePriority.HIGH;
    categoryFixture.slaDurationMinutes = 1440;
    categoryFixture.codeExists = false;
    contractFixture.rows = [];
    documentFixture.rows = [];
    documentsMock.presign.mockClear();
    documentsMock.create.mockClear();
    documentsMock.listForOwner.mockClear();
    mock.contract.findMany.mockClear();
    mock.userPermission.findMany.mockClear();
    mock.maintenanceRequest.create.mockClear();
    mock.maintenanceRequest.update.mockClear();
    mock.maintenanceRequest.findUnique.mockClear();
    mock.maintenanceRequest.findMany.mockClear();
    mock.maintenanceCategory.create.mockClear();
    mock.maintenanceCategory.update.mockClear();
    mock.user.findUnique.mockClear();
    mock.user.findMany.mockClear();
    mock.notification.createMany.mockClear();
    mock.notification.createMany.mockResolvedValue({ count: 0 });
  });

  // ── Metadata — controller is internal to the module ───────────────────

  const controllers = Reflect.getMetadata('controllers', MaintenanceModule) as Array<
    new () => unknown
  >;
  const Ctor = controllers[0]!;
  const proto = Ctor.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;

  function getPermissions(method: string): PermissionsMeta | undefined {
    return reflector.get<PermissionsMeta | undefined>(PERMISSIONS_KEY, proto[method]!);
  }
  function getRoles(method: string): UserRole[] | undefined {
    return reflector.get<UserRole[] | undefined>(ROLES_KEY, proto[method]!);
  }

  describe('@Permissions metadata', () => {
    it('listCategories → no permission metadata (role-only; preserves CUSTOMER flow)', () => {
      expect(getPermissions('listCategories')).toBeUndefined();
      expect(getRoles('listCategories')).toEqual([UserRole.ADMIN, UserRole.CUSTOMER]);
    });

    it.each<[string]>([['createCategory'], ['updateCategory']])(
      '%s → maintenance:categories:manage, adminBypass true',
      (method) => {
        expect(getPermissions(method)).toMatchObject({
          codes: ['maintenance:categories:manage'],
          adminBypass: true,
        });
      },
    );

    it('create (customer self-service) → no permission metadata, CUSTOMER-only', () => {
      expect(getPermissions('create')).toBeUndefined();
      expect(getRoles('create')).toEqual([UserRole.CUSTOMER]);
    });

    it('myList (self-service) → no permission metadata, CUSTOMER + supervisor', () => {
      expect(getPermissions('myList')).toBeUndefined();
      expect(getRoles('myList')).toEqual([UserRole.CUSTOMER, UserRole.MAINTENANCE_SUPERVISOR]);
    });

    it('myStatus (supervisor mobile) → no permission metadata, supervisor-only', () => {
      expect(getPermissions('myStatus')).toBeUndefined();
      expect(getRoles('myStatus')).toEqual([UserRole.MAINTENANCE_SUPERVISOR]);
    });

    it.each<[string]>([['myDetail'], ['myPresign'], ['myCreateDocument']])(
      '%s (scoped self-service) → no permission metadata, supervisor + customer',
      (method) => {
        expect(getPermissions(method)).toBeUndefined();
        expect(getRoles(method)).toEqual([UserRole.MAINTENANCE_SUPERVISOR, UserRole.CUSTOMER]);
      },
    );

    it('list (admin) → maintenance:read, adminBypass true', () => {
      expect(getPermissions('list')).toMatchObject({
        codes: ['maintenance:read'],
        adminBypass: true,
      });
    });

    it('assignRequest → maintenance:assign, adminBypass true', () => {
      expect(getPermissions('assignRequest')).toMatchObject({
        codes: ['maintenance:assign'],
        adminBypass: true,
      });
    });

    it('setRequestStatus → maintenance:resolve, adminBypass true', () => {
      expect(getPermissions('setRequestStatus')).toMatchObject({
        codes: ['maintenance:resolve'],
        adminBypass: true,
      });
    });

    it('legacy `update` handler is absent (route split landed)', () => {
      expect(proto.update).toBeUndefined();
    });
  });

  // ── Read / category / customer flows ──────────────────────────────────

  describe('GET /maintenance-requests (admin)', () => {
    it('ADMIN bypasses — no permission DB lookup', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer()).get('/maintenance-requests').expect(200);
      expect(mock.userPermission.findMany).not.toHaveBeenCalled();
    });

    it('unauthenticated → 403', async () => {
      FakeAuthGuard.currentUser = null;
      await request(app.getHttpServer()).get('/maintenance-requests').expect(403);
    });
  });

  describe('GET /maintenance-categories (role-only)', () => {
    it('ADMIN reads categories — no permission DB lookup', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer()).get('/maintenance-categories').expect(200);
      expect(mock.userPermission.findMany).not.toHaveBeenCalled();
    });

    it('CUSTOMER reads categories with zero permissions — no DB lookup, no 403', async () => {
      FakeAuthGuard.currentUser = { sub: 'cust-1', role: UserRole.CUSTOMER, codes: [] };
      await request(app.getHttpServer()).get('/maintenance-categories').expect(200);
      expect(mock.userPermission.findMany).not.toHaveBeenCalled();
    });
  });

  describe('Customer self-service /me/maintenance-requests', () => {
    it('CUSTOMER creates own request with zero permissions', async () => {
      FakeAuthGuard.currentUser = { sub: 'cust-1', role: UserRole.CUSTOMER, codes: [] };
      await request(app.getHttpServer())
        .post('/me/maintenance-requests')
        .send({
          unitId: 'a1111111-1111-4111-8111-111111111111',
          categoryId: 'b2222222-2222-4222-8222-222222222222',
          description: 'AC not working in bedroom',
        })
        .expect(201);
      expect(mock.userPermission.findMany).not.toHaveBeenCalled();
      expect(mock.maintenanceRequest.create).toHaveBeenCalledTimes(1);
    });

    it('CUSTOMER lists own requests with zero permissions', async () => {
      FakeAuthGuard.currentUser = { sub: 'cust-1', role: UserRole.CUSTOMER, codes: [] };
      await request(app.getHttpServer()).get('/me/maintenance-requests').expect(200);
      expect(mock.userPermission.findMany).not.toHaveBeenCalled();
    });

    it('ADMIN is blocked at @Roles on POST /me/maintenance-requests (CUSTOMER-only)', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer())
        .post('/me/maintenance-requests')
        .send({
          unitId: 'a1111111-1111-4111-8111-111111111111',
          categoryId: 'b2222222-2222-4222-8222-222222222222',
          description: 'should-be-blocked',
        })
        .expect(403);
      expect(mock.maintenanceRequest.create).not.toHaveBeenCalled();
    });
  });

  // ── Admin actions (new POST routes) ────────────────────────────────────

  describe('GET /maintenance-requests/:id (detail)', () => {
    const PATH = '/maintenance-requests/c3333333-3333-4333-8333-333333333333';

    it('ADMIN reads detail (maintenance:read, admin bypass)', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      const res = await request(app.getHttpServer()).get(PATH).expect(200);
      expect(res.body.id).toBe('c3333333-3333-4333-8333-333333333333');
      expect(mock.userPermission.findMany).not.toHaveBeenCalled();
    });

    it('CUSTOMER is blocked at @Roles (admin detail is ADMIN-only)', async () => {
      FakeAuthGuard.currentUser = { sub: 'cust-1', role: UserRole.CUSTOMER, codes: [] };
      await request(app.getHttpServer()).get(PATH).expect(403);
    });
  });

  describe('POST /maintenance-requests/:id/assign', () => {
    const PATH = '/maintenance-requests/c3333333-3333-4333-8333-333333333333/assign';

    it('assigning an OPEN request auto-advances status to ASSIGNED', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      fixture.requestStatus = MaintenanceStatus.OPEN;
      await request(app.getHttpServer()).post(PATH).send({ assignedAdminId: ADMIN_ASSIGNEE }).expect(201);
      const call = mock.maintenanceRequest.update.mock.calls[0]![0] as { data: Record<string, unknown> };
      expect(call.data.assignedAdminId).toBe(ADMIN_ASSIGNEE);
      expect(call.data.status).toBe(MaintenanceStatus.ASSIGNED);
    });

    it('assigning a non-OPEN request does not downgrade status', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      fixture.requestStatus = MaintenanceStatus.IN_PROGRESS;
      await request(app.getHttpServer()).post(PATH).send({ assignedAdminId: ADMIN_ASSIGNEE }).expect(201);
      const call = mock.maintenanceRequest.update.mock.calls[0]![0] as { data: Record<string, unknown> };
      expect(call.data.assignedAdminId).toBe(ADMIN_ASSIGNEE);
      expect(call.data.status).toBeUndefined();
    });

    it('rejects an assignee that is not an admin user (400)', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer())
        .post(PATH)
        .send({ assignedAdminId: '99999999-9999-4999-8999-999999999999' }) // unknown user
        .expect(400);
      expect(mock.maintenanceRequest.update).not.toHaveBeenCalled();
    });

    it('SALES even with maintenance:assign → 403 from @Roles (route is ADMIN-only)', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['maintenance:assign'],
      };
      await request(app.getHttpServer())
        .post(PATH)
        .send({ assignedAdminId: ADMIN_ASSIGNEE })
        .expect(403);
      expect(mock.userPermission.findMany).not.toHaveBeenCalled();
      expect(mock.maintenanceRequest.update).not.toHaveBeenCalled();
    });
  });

  describe('POST /maintenance-requests/:id/status (transition guard)', () => {
    const PATH = '/maintenance-requests/c3333333-3333-4333-8333-333333333333/status';

    it('valid transition IN_PROGRESS → RESOLVED succeeds', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      fixture.requestStatus = MaintenanceStatus.IN_PROGRESS;
      await request(app.getHttpServer()).post(PATH).send({ status: 'RESOLVED' }).expect(201);
      const call = mock.maintenanceRequest.update.mock.calls[0]![0] as { data: Record<string, unknown> };
      expect(call.data.status).toBe('RESOLVED');
      expect(call.data.assignedAdminId).toBeUndefined();
    });

    it('valid transition OPEN → ASSIGNED succeeds', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      fixture.requestStatus = MaintenanceStatus.OPEN;
      await request(app.getHttpServer()).post(PATH).send({ status: 'ASSIGNED' }).expect(201);
      expect(mock.maintenanceRequest.update).toHaveBeenCalledTimes(1);
    });

    it('invalid transition OPEN → RESOLVED is rejected (400, no update)', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      fixture.requestStatus = MaintenanceStatus.OPEN;
      await request(app.getHttpServer()).post(PATH).send({ status: 'RESOLVED' }).expect(400);
      expect(mock.maintenanceRequest.update).not.toHaveBeenCalled();
    });

    it('CLOSED is terminal — any transition is rejected (400)', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      fixture.requestStatus = MaintenanceStatus.CLOSED;
      await request(app.getHttpServer()).post(PATH).send({ status: 'IN_PROGRESS' }).expect(400);
      expect(mock.maintenanceRequest.update).not.toHaveBeenCalled();
    });
  });

  describe('POST /maintenance-requests (admin create-on-behalf)', () => {
    const PATH = '/maintenance-requests';
    const base = {
      customerId: CUSTOMER_ID,
      unitId: 'a1111111-1111-4111-8111-111111111111',
      categoryId: 'b2222222-2222-4222-8222-222222222222',
      description: 'Leaking pipe reported by phone',
    };

    it('ADMIN creates a request → status OPEN when no assignee', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer()).post(PATH).send(base).expect(201);
      const call = mock.maintenanceRequest.create.mock.calls[0]![0] as { data: Record<string, unknown> };
      expect(call.data.customerId).toBe(CUSTOMER_ID);
      expect(call.data.status).toBe(MaintenanceStatus.OPEN);
      expect(call.data.assignedAdminId).toBeNull();
    });

    it('ADMIN creates with assignee → status ASSIGNED', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer())
        .post(PATH)
        .send({ ...base, assignedAdminId: ADMIN_ASSIGNEE })
        .expect(201);
      const call = mock.maintenanceRequest.create.mock.calls[0]![0] as { data: Record<string, unknown> };
      expect(call.data.status).toBe(MaintenanceStatus.ASSIGNED);
      expect(call.data.assignedAdminId).toBe(ADMIN_ASSIGNEE);
    });

    it('rejects a customerId that is not a CUSTOMER (400)', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer())
        .post(PATH)
        .send({ ...base, customerId: ADMIN_ASSIGNEE }) // an ADMIN, not a customer
        .expect(400);
      expect(mock.maintenanceRequest.create).not.toHaveBeenCalled();
    });

    it('SALES even with maintenance:create → 403 (route is ADMIN-only)', async () => {
      FakeAuthGuard.currentUser = { sub: 'sales-1', role: UserRole.SALES, codes: ['maintenance:create'] };
      await request(app.getHttpServer()).post(PATH).send(base).expect(403);
      expect(mock.maintenanceRequest.create).not.toHaveBeenCalled();
    });
  });

  // ── Notifications (best-effort fan-out) ────────────────────────────────
  function templatesSent(): string[] {
    return mock.notification.createMany.mock.calls.flatMap(
      (c) => (c[0] as { data: Array<{ templateCode: string }> }).data.map((d) => d.templateCode),
    );
  }

  describe('Maintenance notifications', () => {
    const CREATE = '/maintenance-requests';
    const ID = 'c3333333-3333-4333-8333-333333333333';
    const base = {
      customerId: CUSTOMER_ID,
      unitId: 'a1111111-1111-4111-8111-111111111111',
      categoryId: 'b2222222-2222-4222-8222-222222222222',
      description: 'Leaking pipe reported by phone',
    };

    it('admin create (no assignee) notifies staff with maintenance_request_created', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer()).post(CREATE).send(base).expect(201);
      expect(templatesSent()).toContain('maintenance_request_created');
    });

    it('admin create with assignee notifies the assignee with maintenance_request_assigned', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer())
        .post(CREATE)
        .send({ ...base, assignedAdminId: ADMIN_ASSIGNEE })
        .expect(201);
      const sent = templatesSent();
      expect(sent).toContain('maintenance_request_created');
      expect(sent).toContain('maintenance_request_assigned');
    });

    it('assign notifies assignee + customer (status_changed)', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      fixture.requestStatus = MaintenanceStatus.OPEN;
      await request(app.getHttpServer())
        .post(`${CREATE}/${ID}/assign`)
        .send({ assignedAdminId: ADMIN_ASSIGNEE })
        .expect(201);
      const sent = templatesSent();
      expect(sent).toContain('maintenance_request_assigned');
      expect(sent).toContain('maintenance_request_status_changed');
    });

    it('status → RESOLVED uses the resolved template', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      fixture.requestStatus = MaintenanceStatus.IN_PROGRESS;
      await request(app.getHttpServer()).post(`${CREATE}/${ID}/status`).send({ status: 'RESOLVED' }).expect(201);
      expect(templatesSent()).toContain('maintenance_request_resolved');
    });

    it('status → CLOSED uses the closed template', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      fixture.requestStatus = MaintenanceStatus.RESOLVED;
      await request(app.getHttpServer()).post(`${CREATE}/${ID}/status`).send({ status: 'CLOSED' }).expect(201);
      expect(templatesSent()).toContain('maintenance_request_closed');
    });

    it('intermediate status → IN_PROGRESS uses status_changed template', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      fixture.requestStatus = MaintenanceStatus.OPEN;
      await request(app.getHttpServer()).post(`${CREATE}/${ID}/status`).send({ status: 'IN_PROGRESS' }).expect(201);
      expect(templatesSent()).toContain('maintenance_request_status_changed');
    });

    it('no-op same-status change does NOT notify (and does NOT update)', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      fixture.requestStatus = MaintenanceStatus.IN_PROGRESS;
      await request(app.getHttpServer()).post(`${CREATE}/${ID}/status`).send({ status: 'IN_PROGRESS' }).expect(201);
      expect(mock.maintenanceRequest.update).not.toHaveBeenCalled();
      expect(mock.notification.createMany).not.toHaveBeenCalled();
    });

    it('notification failure does NOT fail the maintenance action', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      fixture.requestStatus = MaintenanceStatus.IN_PROGRESS;
      mock.notification.createMany.mockRejectedValueOnce(new Error('notify blew up'));
      // Status change still succeeds (201) despite the notification failure.
      await request(app.getHttpServer()).post(`${CREATE}/${ID}/status`).send({ status: 'RESOLVED' }).expect(201);
      expect(mock.maintenanceRequest.update).toHaveBeenCalledTimes(1);
    });
  });

  // ── Category management — SALES blocked at @Roles ─────────────────────

  describe('POST /maintenance-categories', () => {
    it('SALES even with maintenance:categories:manage → 403 from @Roles (route is ADMIN-only)', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['maintenance:categories:manage'],
      };
      await request(app.getHttpServer())
        .post('/maintenance-categories')
        .send({ ar: 'كهرباء', en: 'Electrical' })
        .expect(403);
      expect(mock.maintenanceCategory.create).not.toHaveBeenCalled();
    });
  });

  // ── Category priority / SLA + duplicate prevention (Batch 8) ──────────
  describe('POST /maintenance-categories (priority + SLA)', () => {
    function createCall() {
      return mock.maintenanceCategory.create.mock.calls[0]![0] as { data: Record<string, unknown> };
    }

    it('stores priority and converts SLA hours → minutes (24h = 1440)', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer())
        .post('/maintenance-categories')
        .send({ ar: 'سباكة', en: 'Plumbing', priority: 'URGENT', slaValue: 24, slaUnit: 'HOURS' })
        .expect(201);
      const { data } = createCall();
      expect(data.priority).toBe('URGENT');
      expect(data.slaDurationMinutes).toBe(1440);
      expect(data.code).toBe('plumbing');
    });

    it('converts SLA days → minutes (3d = 4320)', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer())
        .post('/maintenance-categories')
        .send({ ar: 'كهرباء', en: 'Electrical', slaValue: 3, slaUnit: 'DAYS' })
        .expect(201);
      expect(createCall().data.slaDurationMinutes).toBe(4320);
    });

    it('defaults priority to MEDIUM and SLA to null when omitted', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer())
        .post('/maintenance-categories')
        .send({ ar: 'دهان', en: 'Painting' })
        .expect(201);
      const { data } = createCall();
      expect(data.priority).toBe('MEDIUM');
      expect(data.slaDurationMinutes).toBeNull();
    });

    it('rejects a duplicate code with 400 and does not create a second row', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      categoryFixture.codeExists = true;
      await request(app.getHttpServer())
        .post('/maintenance-categories')
        .send({ ar: 'سباكة', en: 'Plumbing' })
        .expect(400);
      expect(mock.maintenanceCategory.create).not.toHaveBeenCalled();
    });

    it('rejects SLA value provided without a unit (400)', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer())
        .post('/maintenance-categories')
        .send({ ar: 'سباكة', en: 'Plumbing', slaValue: 5 })
        .expect(400);
      expect(mock.maintenanceCategory.create).not.toHaveBeenCalled();
    });

    it('rejects an SLA beyond the 365-day maximum (400)', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer())
        .post('/maintenance-categories')
        .send({ ar: 'سباكة', en: 'Plumbing', slaValue: 366, slaUnit: 'DAYS' })
        .expect(400);
      expect(mock.maintenanceCategory.create).not.toHaveBeenCalled();
    });
  });

  // ── Request snapshots category priority + dueAt at creation (Batch 8) ──
  describe('Request snapshots category priority/SLA on create', () => {
    const base = {
      customerId: CUSTOMER_ID,
      unitId: 'a1111111-1111-4111-8111-111111111111',
      categoryId: 'b2222222-2222-4222-8222-222222222222',
      description: 'Leaking pipe reported by phone',
    };

    it('copies category priority and computes dueAt from the category SLA', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      categoryFixture.priority = MaintenancePriority.URGENT;
      categoryFixture.slaDurationMinutes = 1440;
      await request(app.getHttpServer()).post('/maintenance-requests').send(base).expect(201);
      const { data } = mock.maintenanceRequest.create.mock.calls[0]![0] as { data: Record<string, unknown> };
      expect(data.priority).toBe(MaintenancePriority.URGENT);
      expect(data.dueAt).toBeInstanceOf(Date);
    });

    it('leaves dueAt null when the category has no SLA', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      categoryFixture.priority = MaintenancePriority.LOW;
      categoryFixture.slaDurationMinutes = null;
      await request(app.getHttpServer()).post('/maintenance-requests').send(base).expect(201);
      const { data } = mock.maintenanceRequest.create.mock.calls[0]![0] as { data: Record<string, unknown> };
      expect(data.priority).toBe(MaintenancePriority.LOW);
      expect(data.dueAt).toBeNull();
    });
  });

  // ── Customer-owned units endpoint (Batch 9) ───────────────────────────
  describe('GET /customers/:id/maintenance-units', () => {
    const PATH = `/customers/${CUSTOMER_ID}/maintenance-units`;
    const MISSING = '/customers/99999999-9999-4999-8999-999999999999/maintenance-units';
    const NON_CUSTOMER = `/customers/${ADMIN_ASSIGNEE}/maintenance-units`;

    function unitRow(id: string, code: string): ContractRow {
      return {
        unit: { id, code, type: '2BR', status: 'SOLD', floor: 3, building: { id: 'b1', name: 'Tower A' } },
      };
    }

    it('ADMIN (maintenance:read) gets only units from that customer contracts', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      contractFixture.rows = [unitRow('u-1', 'A-101'), unitRow('u-2', 'A-102')];
      const res = await request(app.getHttpServer()).get(PATH).expect(200);
      expect(res.body.map((u: { id: string }) => u.id)).toEqual(['u-1', 'u-2']);
      const call = mock.contract.findMany.mock.calls[0]![0] as { where: { customerId: string } };
      expect(call.where.customerId).toBe(CUSTOMER_ID);
    });

    it('dedupes duplicate contracts for the same unit', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      contractFixture.rows = [unitRow('u-1', 'A-101'), unitRow('u-1', 'A-101'), unitRow('u-2', 'A-102')];
      const res = await request(app.getHttpServer()).get(PATH).expect(200);
      expect(res.body.map((u: { id: string }) => u.id)).toEqual(['u-1', 'u-2']);
    });

    it('returns [] when the customer has no contracts', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      contractFixture.rows = [];
      const res = await request(app.getHttpServer()).get(PATH).expect(200);
      expect(res.body).toEqual([]);
    });

    it('rejects a non-CUSTOMER user id with 400 (no contract lookup)', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer()).get(NON_CUSTOMER).expect(400);
      expect(mock.contract.findMany).not.toHaveBeenCalled();
    });

    it('returns 404 for a missing customer', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer()).get(MISSING).expect(404);
      expect(mock.contract.findMany).not.toHaveBeenCalled();
    });

    it.each<[UserRole]>([[UserRole.SALES], [UserRole.SALES_MANAGER], [UserRole.CUSTOMER]])(
      '%s is blocked at @Roles (ADMIN-only)',
      async (role) => {
        FakeAuthGuard.currentUser = { sub: 'u-1', role, codes: ['maintenance:read'] };
        await request(app.getHttpServer()).get(PATH).expect(403);
        expect(mock.contract.findMany).not.toHaveBeenCalled();
      },
    );
  });

  // ── MAINTENANCE_SUPERVISOR assignment + mobile surface (Batch 10) ──────
  describe('Assigning a MAINTENANCE_SUPERVISOR', () => {
    const PATH = '/maintenance-requests/c3333333-3333-4333-8333-333333333333/assign';

    it('accepts an active supervisor as assignee', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      fixture.requestStatus = MaintenanceStatus.OPEN;
      await request(app.getHttpServer()).post(PATH).send({ assignedAdminId: SUPERVISOR_ASSIGNEE }).expect(201);
      const call = mock.maintenanceRequest.update.mock.calls[0]![0] as { data: Record<string, unknown> };
      expect(call.data.assignedAdminId).toBe(SUPERVISOR_ASSIGNEE);
      expect(call.data.status).toBe(MaintenanceStatus.ASSIGNED);
    });

    it('rejects an inactive supervisor (400, no update)', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer()).post(PATH).send({ assignedAdminId: INACTIVE_SUPERVISOR }).expect(400);
      expect(mock.maintenanceRequest.update).not.toHaveBeenCalled();
    });
  });

  describe('Supervisor mobile surface (/me)', () => {
    const ID = 'c3333333-3333-4333-8333-333333333333';
    const supervisor = { sub: SUPERVISOR_ID, role: UserRole.MAINTENANCE_SUPERVISOR, codes: [] };

    describe('GET /me/maintenance-requests', () => {
      it('returns only requests assigned to the supervisor', async () => {
        FakeAuthGuard.currentUser = supervisor;
        await request(app.getHttpServer()).get('/me/maintenance-requests').expect(200);
        const call = mock.maintenanceRequest.findMany.mock.calls[0]![0] as { where: Record<string, unknown> };
        expect(call.where.assignedAdminId).toBe(SUPERVISOR_ID);
        expect(call.where.customerId).toBeUndefined();
      });
    });

    describe('GET /me/maintenance-requests/:id', () => {
      it('returns the assigned request (with documents)', async () => {
        FakeAuthGuard.currentUser = supervisor;
        fixture.assignedAdminId = SUPERVISOR_ID;
        const res = await request(app.getHttpServer()).get(`/me/maintenance-requests/${ID}`).expect(200);
        expect(res.body.id).toBe(ID);
        expect(documentsMock.listForOwner).toHaveBeenCalledWith('MAINTENANCE_REQUEST', ID, 20);
      });

      it('returns 404 for a request assigned to someone else', async () => {
        FakeAuthGuard.currentUser = supervisor;
        fixture.assignedAdminId = ADMIN_ASSIGNEE; // not this supervisor
        await request(app.getHttpServer()).get(`/me/maintenance-requests/${ID}`).expect(404);
      });
    });

    describe('POST /me/maintenance-requests/:id/status', () => {
      it('ASSIGNED → IN_PROGRESS succeeds', async () => {
        FakeAuthGuard.currentUser = supervisor;
        fixture.assignedAdminId = SUPERVISOR_ID;
        fixture.requestStatus = MaintenanceStatus.ASSIGNED;
        await request(app.getHttpServer()).post(`/me/maintenance-requests/${ID}/status`).send({ status: 'IN_PROGRESS' }).expect(201);
        const call = mock.maintenanceRequest.update.mock.calls[0]![0] as { data: Record<string, unknown> };
        expect(call.data.status).toBe('IN_PROGRESS');
      });

      it('IN_PROGRESS → RESOLVED succeeds', async () => {
        FakeAuthGuard.currentUser = supervisor;
        fixture.assignedAdminId = SUPERVISOR_ID;
        fixture.requestStatus = MaintenanceStatus.IN_PROGRESS;
        await request(app.getHttpServer()).post(`/me/maintenance-requests/${ID}/status`).send({ status: 'RESOLVED' }).expect(201);
        const call = mock.maintenanceRequest.update.mock.calls[0]![0] as { data: Record<string, unknown> };
        expect(call.data.status).toBe('RESOLVED');
      });

      it('cannot CLOSE a request (400, no update)', async () => {
        FakeAuthGuard.currentUser = supervisor;
        fixture.assignedAdminId = SUPERVISOR_ID;
        fixture.requestStatus = MaintenanceStatus.RESOLVED;
        await request(app.getHttpServer()).post(`/me/maintenance-requests/${ID}/status`).send({ status: 'CLOSED' }).expect(400);
        expect(mock.maintenanceRequest.update).not.toHaveBeenCalled();
      });

      it('cannot drive a foreign request (404)', async () => {
        FakeAuthGuard.currentUser = supervisor;
        fixture.assignedAdminId = ADMIN_ASSIGNEE;
        fixture.requestStatus = MaintenanceStatus.ASSIGNED;
        await request(app.getHttpServer()).post(`/me/maintenance-requests/${ID}/status`).send({ status: 'IN_PROGRESS' }).expect(404);
        expect(mock.maintenanceRequest.update).not.toHaveBeenCalled();
      });
    });

    describe('Supervisor document upload', () => {
      it('presign is scoped to the assigned request', async () => {
        FakeAuthGuard.currentUser = supervisor;
        fixture.assignedAdminId = SUPERVISOR_ID;
        await request(app.getHttpServer())
          .post(`/me/maintenance-requests/${ID}/documents/presign`)
          .send({ contentType: 'image/jpeg', sizeBytes: 1024, fileName: 'before.jpg' })
          .expect(201);
        expect(documentsMock.presign).toHaveBeenCalledTimes(1);
      });

      it('create forces ownerType/ownerId/category/visibility', async () => {
        FakeAuthGuard.currentUser = supervisor;
        fixture.assignedAdminId = SUPERVISOR_ID;
        await request(app.getHttpServer())
          .post(`/me/maintenance-requests/${ID}/documents`)
          .send({ title: 'Before repair', fileUrl: 'https://cdn.example/x.jpg' })
          .expect(201);
        const [uploadedById, dto] = documentsMock.create.mock.calls[0]!;
        expect(uploadedById).toBe(SUPERVISOR_ID);
        expect(dto).toMatchObject({
          ownerType: 'MAINTENANCE_REQUEST',
          ownerId: ID,
          category: 'IMAGE',
          visibility: 'ADMIN_ONLY',
        });
      });

      it('returns 404 when uploading to a foreign request', async () => {
        FakeAuthGuard.currentUser = supervisor;
        fixture.assignedAdminId = ADMIN_ASSIGNEE;
        await request(app.getHttpServer())
          .post(`/me/maintenance-requests/${ID}/documents`)
          .send({ title: 'x', fileUrl: 'https://cdn.example/x.jpg' })
          .expect(404);
        expect(documentsMock.create).not.toHaveBeenCalled();
      });
    });

    describe('Supervisor is blocked from admin maintenance routes', () => {
      it('cannot assign (admin route, 403)', async () => {
        FakeAuthGuard.currentUser = supervisor;
        await request(app.getHttpServer())
          .post(`/maintenance-requests/${ID}/assign`)
          .send({ assignedAdminId: ADMIN_ASSIGNEE })
          .expect(403);
      });

      it('cannot admin-create a request (403)', async () => {
        FakeAuthGuard.currentUser = supervisor;
        await request(app.getHttpServer())
          .post('/maintenance-requests')
          .send({
            customerId: CUSTOMER_ID,
            unitId: 'a1111111-1111-4111-8111-111111111111',
            categoryId: 'b2222222-2222-4222-8222-222222222222',
            description: 'should be blocked',
          })
          .expect(403);
        expect(mock.maintenanceRequest.create).not.toHaveBeenCalled();
      });

      it('cannot access the admin list or detail (403)', async () => {
        FakeAuthGuard.currentUser = supervisor;
        await request(app.getHttpServer()).get('/maintenance-requests').expect(403);
        await request(app.getHttpServer()).get(`/maintenance-requests/${ID}`).expect(403);
      });
    });
  });

  // ── Customer maintenance photo upload (Batch 11) ──────────────────────
  describe('Customer photo upload (/me)', () => {
    const ID = 'c3333333-3333-4333-8333-333333333333';
    // The prisma mock always returns customerId === CUSTOMER_ID for a request.
    const customer = { sub: CUSTOMER_ID, role: UserRole.CUSTOMER, codes: [] };
    const otherCustomer = { sub: '11111111-2222-4333-8444-555555555555', role: UserRole.CUSTOMER, codes: [] };

    it('presigns for the customer own request', async () => {
      FakeAuthGuard.currentUser = customer;
      await request(app.getHttpServer())
        .post(`/me/maintenance-requests/${ID}/documents/presign`)
        .send({ contentType: 'image/jpeg', sizeBytes: 2048, fileName: 'leak.jpg' })
        .expect(201);
      expect(documentsMock.presign).toHaveBeenCalledTimes(1);
    });

    it('creates a CUSTOMER_VISIBLE IMAGE forced to the request owner', async () => {
      FakeAuthGuard.currentUser = customer;
      await request(app.getHttpServer())
        .post(`/me/maintenance-requests/${ID}/documents`)
        .send({ title: 'Leak under sink', fileUrl: 'https://cdn.example/leak.jpg' })
        .expect(201);
      const [uploadedById, dto] = documentsMock.create.mock.calls[0]!;
      expect(uploadedById).toBe(CUSTOMER_ID);
      expect(dto).toMatchObject({
        ownerType: 'MAINTENANCE_REQUEST',
        ownerId: ID,
        category: 'IMAGE',
        visibility: 'CUSTOMER_VISIBLE',
      });
    });

    it('cannot upload to another customer request (404, ownership checked before the service)', async () => {
      FakeAuthGuard.currentUser = otherCustomer;
      await request(app.getHttpServer())
        .post(`/me/maintenance-requests/${ID}/documents`)
        .send({ title: 'x', fileUrl: 'https://cdn.example/x.jpg' })
        .expect(404);
      expect(documentsMock.create).not.toHaveBeenCalled();
    });

    it('cannot presign for another customer request (404)', async () => {
      FakeAuthGuard.currentUser = otherCustomer;
      await request(app.getHttpServer())
        .post(`/me/maintenance-requests/${ID}/documents/presign`)
        .send({ contentType: 'image/jpeg', sizeBytes: 2048 })
        .expect(404);
      expect(documentsMock.presign).not.toHaveBeenCalled();
    });

    it.each<[UserRole]>([[UserRole.ADMIN], [UserRole.SALES], [UserRole.BROKER]])(
      '%s cannot use the customer/supervisor upload route (403)',
      async (role) => {
        FakeAuthGuard.currentUser = { sub: 'u-1', role, codes: ['documents:upload', 'maintenance:read'] };
        await request(app.getHttpServer())
          .post(`/me/maintenance-requests/${ID}/documents`)
          .send({ title: 'x', fileUrl: 'https://cdn.example/x.jpg' })
          .expect(403);
        expect(documentsMock.create).not.toHaveBeenCalled();
      },
    );
  });

  // ── Customer maintenance detail read-back (Batch 12) ──────────────────
  describe('Customer detail (/me)', () => {
    const ID = 'c3333333-3333-4333-8333-333333333333';
    const customer = { sub: CUSTOMER_ID, role: UserRole.CUSTOMER, codes: [] };
    const otherCustomer = { sub: '11111111-2222-4333-8444-555555555555', role: UserRole.CUSTOMER, codes: [] };

    it('returns the customer own request detail', async () => {
      FakeAuthGuard.currentUser = customer;
      const res = await request(app.getHttpServer()).get(`/me/maintenance-requests/${ID}`).expect(200);
      expect(res.body.id).toBe(ID);
      expect(res.body).toHaveProperty('status');
      expect(res.body).toHaveProperty('documents');
    });

    it('includes CUSTOMER_VISIBLE documents and excludes ADMIN_ONLY', async () => {
      FakeAuthGuard.currentUser = customer;
      documentFixture.rows = [
        { id: 'd-visible', visibility: 'CUSTOMER_VISIBLE' },
        { id: 'd-internal', visibility: 'ADMIN_ONLY' },
      ];
      const res = await request(app.getHttpServer()).get(`/me/maintenance-requests/${ID}`).expect(200);
      const ids = res.body.documents.map((d: { id: string }) => d.id);
      expect(ids).toEqual(['d-visible']);
      expect(documentsMock.listForOwner).toHaveBeenCalledWith('MAINTENANCE_REQUEST', ID, 50, 'CUSTOMER_VISIBLE');
    });

    it('returns 404 for a request filed by another customer', async () => {
      FakeAuthGuard.currentUser = otherCustomer;
      await request(app.getHttpServer()).get(`/me/maintenance-requests/${ID}`).expect(404);
      expect(documentsMock.listForOwner).not.toHaveBeenCalled();
    });

    it('returns 404 for a missing request', async () => {
      FakeAuthGuard.currentUser = customer;
      await request(app.getHttpServer()).get(`/me/maintenance-requests/${MISSING_REQUEST_ID}`).expect(404);
    });

    it.each<[UserRole]>([[UserRole.ADMIN], [UserRole.SALES], [UserRole.BROKER]])(
      '%s is blocked from the self-service detail route (403)',
      async (role) => {
        FakeAuthGuard.currentUser = { sub: 'u-1', role, codes: ['maintenance:read'] };
        await request(app.getHttpServer()).get(`/me/maintenance-requests/${ID}`).expect(403);
      },
    );
  });

  // ── Category warranty duration (Batch 13C) ────────────────────────────
  describe('POST /maintenance-categories (warranty duration)', () => {
    function createCall() {
      return mock.maintenanceCategory.create.mock.calls[0]![0] as { data: Record<string, unknown> };
    }

    it('stores warranty years as months (2y = 24)', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer())
        .post('/maintenance-categories')
        .send({ ar: 'كهرباء', en: 'Electrical', warrantyValue: 2, warrantyUnit: 'YEARS' })
        .expect(201);
      expect(createCall().data.warrantyDurationMonths).toBe(24);
    });

    it('stores warranty months directly (18m = 18)', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer())
        .post('/maintenance-categories')
        .send({ ar: 'سباكة', en: 'Plumbing', warrantyValue: 18, warrantyUnit: 'MONTHS' })
        .expect(201);
      expect(createCall().data.warrantyDurationMonths).toBe(18);
    });

    it('defaults warrantyDurationMonths to null when omitted', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer())
        .post('/maintenance-categories')
        .send({ ar: 'دهان', en: 'Painting' })
        .expect(201);
      expect(createCall().data.warrantyDurationMonths).toBeNull();
    });

    it('rejects a warranty value without a unit (400)', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer())
        .post('/maintenance-categories')
        .send({ ar: 'سباكة', en: 'Plumbing', warrantyValue: 2 })
        .expect(400);
      expect(mock.maintenanceCategory.create).not.toHaveBeenCalled();
    });
  });

  // ── Approval-based SLA + multi-category requests (Batch 13C) ───────────
  describe('Approval gate + multi-category requests', () => {
    const ID = 'c3333333-3333-4333-8333-333333333333';
    const base = {
      customerId: CUSTOMER_ID,
      unitId: 'a1111111-1111-4111-8111-111111111111',
      description: 'Leaking pipe + power outage',
    };

    it('customer create starts PENDING with no dueAt and writes request items', async () => {
      FakeAuthGuard.currentUser = { sub: CUSTOMER_ID, role: UserRole.CUSTOMER, codes: [] };
      await request(app.getHttpServer())
        .post('/me/maintenance-requests')
        .send({
          unitId: base.unitId,
          categoryIds: [
            'b2222222-2222-4222-8222-222222222222',
            'b2222222-2222-4222-8222-222222222223',
          ],
          description: base.description,
        })
        .expect(201);
      const { data } = mock.maintenanceRequest.create.mock.calls[0]![0] as { data: Record<string, unknown> };
      expect(data.reviewStatus).toBe('PENDING');
      expect(data.dueAt ?? null).toBeNull();
      expect(mock.maintenanceRequestItem.createMany).toHaveBeenCalledTimes(1);
      const itemsArg = mock.maintenanceRequestItem.createMany.mock.calls[0]![0] as { data: unknown[] };
      expect(itemsArg.data).toHaveLength(2);
    });

    it('admin create starts APPROVED and computes dueAt immediately', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      categoryFixture.slaDurationMinutes = 1440;
      await request(app.getHttpServer())
        .post('/maintenance-requests')
        .send({ ...base, categoryId: 'b2222222-2222-4222-8222-222222222222' })
        .expect(201);
      const { data } = mock.maintenanceRequest.create.mock.calls[0]![0] as { data: Record<string, unknown> };
      expect(data.reviewStatus).toBe('APPROVED');
      expect(data.approvedAt).toBeInstanceOf(Date);
      expect(data.dueAt).toBeInstanceOf(Date);
      expect(data.maxHandlingSlaMinutesSnapshot).toBe(1440);
    });

    it('approve computes dueAt from the MAX handling SLA across items (1d + 2d → +2d)', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      fixture.reviewStatus = MaintenanceReviewStatus.PENDING;
      requestItemsFixture.rows = [
        { handlingSlaMinutesSnapshot: 1440 }, // 1 day
        { handlingSlaMinutesSnapshot: 2880 }, // 2 days
      ];
      const before = Date.now();
      await request(app.getHttpServer()).post(`/maintenance-requests/${ID}/approve`).expect(201);
      const { data } = mock.maintenanceRequest.update.mock.calls[0]![0] as { data: Record<string, unknown> };
      expect(data.reviewStatus).toBe('APPROVED');
      expect(data.maxHandlingSlaMinutesSnapshot).toBe(2880);
      const due = new Date(data.dueAt as Date).getTime();
      expect(due).toBeGreaterThanOrEqual(before + 2880 * 60_000 - 5000);
    });

    it('approve leaves dueAt null when no item has an SLA', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      fixture.reviewStatus = MaintenanceReviewStatus.PENDING;
      requestItemsFixture.rows = [{ handlingSlaMinutesSnapshot: null }];
      await request(app.getHttpServer()).post(`/maintenance-requests/${ID}/approve`).expect(201);
      const { data } = mock.maintenanceRequest.update.mock.calls[0]![0] as { data: Record<string, unknown> };
      expect(data.dueAt ?? null).toBeNull();
      expect(data.maxHandlingSlaMinutesSnapshot ?? null).toBeNull();
    });

    it('approve is rejected for a non-pending request (400)', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      fixture.reviewStatus = MaintenanceReviewStatus.APPROVED;
      await request(app.getHttpServer()).post(`/maintenance-requests/${ID}/approve`).expect(400);
      expect(mock.maintenanceRequest.update).not.toHaveBeenCalled();
    });

    it('reject sets REJECTED with no dueAt', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      fixture.reviewStatus = MaintenanceReviewStatus.PENDING;
      await request(app.getHttpServer()).post(`/maintenance-requests/${ID}/reject`).expect(201);
      const { data } = mock.maintenanceRequest.update.mock.calls[0]![0] as { data: Record<string, unknown> };
      expect(data.reviewStatus).toBe('REJECTED');
      expect(data.rejectedAt).toBeInstanceOf(Date);
      expect(data.dueAt ?? null).toBeNull();
    });

    it('reject is rejected for a non-pending request (400)', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      fixture.reviewStatus = MaintenanceReviewStatus.REJECTED;
      await request(app.getHttpServer()).post(`/maintenance-requests/${ID}/reject`).expect(400);
      expect(mock.maintenanceRequest.update).not.toHaveBeenCalled();
    });

    it('SALES cannot approve (403)', async () => {
      FakeAuthGuard.currentUser = { sub: 'sales-1', role: UserRole.SALES, codes: ['maintenance:resolve'] };
      await request(app.getHttpServer()).post(`/maintenance-requests/${ID}/approve`).expect(403);
    });

    it('supervisor cannot progress a PENDING (unapproved) request (400)', async () => {
      FakeAuthGuard.currentUser = { sub: SUPERVISOR_ID, role: UserRole.MAINTENANCE_SUPERVISOR, codes: [] };
      fixture.assignedAdminId = SUPERVISOR_ID;
      fixture.reviewStatus = MaintenanceReviewStatus.PENDING;
      fixture.requestStatus = MaintenanceStatus.ASSIGNED;
      await request(app.getHttpServer())
        .post(`/me/maintenance-requests/${ID}/status`)
        .send({ status: 'IN_PROGRESS' })
        .expect(400);
      expect(mock.maintenanceRequest.update).not.toHaveBeenCalled();
    });

    it('supervisor cannot progress a REJECTED request (400)', async () => {
      FakeAuthGuard.currentUser = { sub: SUPERVISOR_ID, role: UserRole.MAINTENANCE_SUPERVISOR, codes: [] };
      fixture.assignedAdminId = SUPERVISOR_ID;
      fixture.reviewStatus = MaintenanceReviewStatus.REJECTED;
      fixture.requestStatus = MaintenanceStatus.ASSIGNED;
      await request(app.getHttpServer())
        .post(`/me/maintenance-requests/${ID}/status`)
        .send({ status: 'IN_PROGRESS' })
        .expect(400);
    });

    it('supervisor list is filtered to APPROVED requests', async () => {
      FakeAuthGuard.currentUser = { sub: SUPERVISOR_ID, role: UserRole.MAINTENANCE_SUPERVISOR, codes: [] };
      await request(app.getHttpServer()).get('/me/maintenance-requests').expect(200);
      const call = mock.maintenanceRequest.findMany.mock.calls[0]![0] as { where: Record<string, unknown> };
      expect(call.where.assignedAdminId).toBe(SUPERVISOR_ID);
      expect(call.where.reviewStatus).toBe('APPROVED');
    });

    // Warranty snapshot on the request's items, derived from the unit item's
    // warrantyEnd at creation time.
    const CAT = 'b2222222-2222-4222-8222-222222222222';

    function itemSnapshots() {
      const arg = mock.maintenanceRequestItem.createMany.mock.calls[0]![0] as {
        data: Array<{ warrantyStatusSnapshot: string }>;
      };
      return arg.data;
    }

    it('snapshots IN_WARRANTY when the unit item warranty is still active', async () => {
      FakeAuthGuard.currentUser = { sub: CUSTOMER_ID, role: UserRole.CUSTOMER, codes: [] };
      mock.unitMaintenanceItem.findMany.mockResolvedValueOnce([
        { id: 'ui-1', categoryId: CAT, warrantyEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) },
      ]);
      await request(app.getHttpServer())
        .post('/me/maintenance-requests')
        .send({ unitId: base.unitId, categoryId: CAT, description: base.description })
        .expect(201);
      expect(itemSnapshots()[0]!.warrantyStatusSnapshot).toBe('IN_WARRANTY');
    });

    it('snapshots OUT_OF_WARRANTY when the unit item warranty has lapsed', async () => {
      FakeAuthGuard.currentUser = { sub: CUSTOMER_ID, role: UserRole.CUSTOMER, codes: [] };
      mock.unitMaintenanceItem.findMany.mockResolvedValueOnce([
        { id: 'ui-1', categoryId: CAT, warrantyEnd: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      ]);
      await request(app.getHttpServer())
        .post('/me/maintenance-requests')
        .send({ unitId: base.unitId, categoryId: CAT, description: base.description })
        .expect(201);
      expect(itemSnapshots()[0]!.warrantyStatusSnapshot).toBe('OUT_OF_WARRANTY');
    });

    it('snapshots UNKNOWN when there is no matching unit item', async () => {
      FakeAuthGuard.currentUser = { sub: CUSTOMER_ID, role: UserRole.CUSTOMER, codes: [] };
      // default mock: unitMaintenanceItem.findMany → []
      await request(app.getHttpServer())
        .post('/me/maintenance-requests')
        .send({ unitId: base.unitId, categoryId: CAT, description: base.description })
        .expect(201);
      expect(itemSnapshots()[0]!.warrantyStatusSnapshot).toBe('UNKNOWN');
    });
  });

  // ── Legacy PATCH /:id removed ──────────────────────────────────────────

  describe('Legacy PATCH /maintenance-requests/:id', () => {
    it('returns 404 (route removed)', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer())
        .patch('/maintenance-requests/c3333333-3333-4333-8333-333333333333')
        .send({ status: 'IN_PROGRESS' })
        .expect(404);
      expect(mock.maintenanceRequest.update).not.toHaveBeenCalled();
    });
  });
});
