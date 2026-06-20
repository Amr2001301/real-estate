import { CanActivate, ExecutionContext, Global, INestApplication, Module } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { UserRole } from '@prisma/client';
import { LeadsController } from '../leads.controller';
import { LeadsService } from '../leads.service';
import { NotificationsService } from '../../notifications/notifications.module';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  PERMISSIONS_KEY,
  type PermissionsMeta,
} from '../../../common/decorators/permissions.decorator';

/**
 * Verifies the leads permissions rollout:
 *   * Per-route metadata for every handler.
 *   * ADMIN bypass on every route.
 *   * SALES grants enable read/create/update/advance-stage/note.
 *   * SALES is blocked at @Roles on assign + lead-sources create (admin-only).
 *   * SALES self-scoping (`effectiveSalesId = user.sub`) is preserved.
 *
 * The leads controller mounts at @Controller() so paths are root-relative.
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

interface ListCall {
  where?: { assignedSalesId?: string; [k: string]: unknown };
  [k: string]: unknown;
}

function makePrismaMock() {
  const findManyArgs: ListCall[] = [];

  const m = {
    userPermission: {
      findMany: jest.fn().mockImplementation(async () => {
        const u = FakeAuthGuard.currentUser;
        return (u?.codes ?? []).map((code) => ({ permission: { code } }));
      }),
    },
    leadSource: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'src-1',
        ...data,
      })),
    },
    lead: {
      findMany: jest.fn().mockImplementation(async (args: ListCall) => {
        findManyArgs.push(args);
        return [];
      }),
      findUnique: jest.fn().mockResolvedValue({
        id: 'lead-1',
        stage: 'NEW',
        assignedSalesId: null,
        clientId: 'client-1',
        fullName: 'Test',
        phone: '0500000000',
        email: null,
      }),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'lead-new',
        ...data,
      })),
      update: jest.fn().mockImplementation(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => ({
        ...data,
        id: where.id,
      })),
    },
    leadActivity: { create: jest.fn().mockResolvedValue({}) },
    leadNote: {
      create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'note-1',
        ...data,
      })),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'client-1',
        role: 'CLIENT',
        fullName: 'Existing Client',
        phone: '0500000000',
        email: null,
      }),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'client-new',
        ...data,
      })),
    },
    $transaction: jest.fn(),
    _capturedListArgs: findManyArgs,
  };

  m.$transaction.mockImplementation(async (ops: unknown) => {
    if (Array.isArray(ops)) return Promise.all(ops);
    if (typeof ops === 'function') {
      const tx = {
        lead: m.lead,
        leadActivity: m.leadActivity,
        leadNote: m.leadNote,
        user: m.user,
        leadSource: m.leadSource,
      };
      return (ops as (tx: unknown) => Promise<unknown>)(tx);
    }
    return ops;
  });

  return m;
}

describe('Leads module · permissions enforcement', () => {
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

    const notificationsServiceMock = {
      sendToUser: jest.fn().mockResolvedValue(undefined),
      sendToUsers: jest.fn().mockResolvedValue(undefined),
      sendToRoles: jest.fn().mockResolvedValue(undefined),
    };

    @Module({
      imports: [MockPrismaModule],
      controllers: [LeadsController],
      providers: [
        LeadsService,
        { provide: NotificationsService, useValue: notificationsServiceMock },
      ],
    })
    class TestLeadsModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [TestLeadsModule],
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
    mock.leadSource.findMany.mockClear();
    mock.leadSource.create.mockClear();
    mock.lead.findMany.mockClear();
    mock.lead.count.mockClear();
    mock.lead.create.mockClear();
    mock.lead.update.mockClear();
    mock.leadActivity.create.mockClear();
    mock.leadNote.create.mockClear();
    mock.user.findFirst.mockClear();
    mock.user.create.mockClear();
    mock._capturedListArgs.length = 0;
  });

  // ── Metadata ───────────────────────────────────────────────────────────

  describe('@Permissions metadata', () => {
    const proto = LeadsController.prototype as unknown as Record<
      string,
      (...a: unknown[]) => unknown
    >;
    function getMeta(method: string): PermissionsMeta | undefined {
      return reflector.get<PermissionsMeta | undefined>(PERMISSIONS_KEY, proto[method]!);
    }

    it.each<[string, string]>([
      ['listSources', 'leads:read'],
      ['pipeline', 'leads:read'],
      ['list', 'leads:read'],
      ['get', 'leads:read'],
    ])('%s → @Permissions(%s), bypass true', (method, code) => {
      expect(getMeta(method)).toMatchObject({ codes: [code], adminBypass: true });
    });

    it('createSource → lead_sources:manage, bypass true', () => {
      expect(getMeta('createSource')).toMatchObject({
        codes: ['lead_sources:manage'],
        adminBypass: true,
      });
    });
    it('create → leads:create, bypass true', () => {
      expect(getMeta('create')).toMatchObject({ codes: ['leads:create'], adminBypass: true });
    });
    it('update → leads:update, bypass true', () => {
      expect(getMeta('update')).toMatchObject({ codes: ['leads:update'], adminBypass: true });
    });
    it('updateStage → leads:advance-stage, bypass true', () => {
      expect(getMeta('updateStage')).toMatchObject({
        codes: ['leads:advance-stage'],
        adminBypass: true,
      });
    });
    it('assign → leads:assign, bypass true', () => {
      expect(getMeta('assign')).toMatchObject({ codes: ['leads:assign'], adminBypass: true });
    });
    it('addNote → leads:note, bypass true', () => {
      expect(getMeta('addNote')).toMatchObject({ codes: ['leads:note'], adminBypass: true });
    });
  });

  // ── Read routes ────────────────────────────────────────────────────────

  describe('GET /leads', () => {
    it('ADMIN bypasses — no permission DB lookup', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer()).get('/leads').expect(200);
      expect(mock.userPermission.findMany).not.toHaveBeenCalled();
    });

    it('SALES with leads:read → 200', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['leads:read'],
      };
      await request(app.getHttpServer()).get('/leads').expect(200);
      expect(mock.userPermission.findMany).toHaveBeenCalledTimes(1);
    });

    it('SALES without leads:read → structured 403', async () => {
      FakeAuthGuard.currentUser = { sub: 'sales-2', role: UserRole.SALES, codes: [] };
      const res = await request(app.getHttpServer()).get('/leads').expect(403);
      expect(res.body).toMatchObject({
        code: 'missing_permission',
        permissions: ['leads:read'],
      });
    });

    it('unauthenticated → 403', async () => {
      FakeAuthGuard.currentUser = null;
      await request(app.getHttpServer()).get('/leads').expect(403);
    });

    it('SALES self-scoping preserved: ?salesId=other is rewritten to caller', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-caller',
        role: UserRole.SALES,
        codes: ['leads:read'],
      };
      await request(app.getHttpServer())
        .get('/leads?salesId=other-sales-id')
        .expect(200);
      // Service was called via prisma.lead.findMany; assert the where clause
      // contains the caller's id, not the query param.
      expect(mock._capturedListArgs.length).toBeGreaterThan(0);
      const where = mock._capturedListArgs[0]!.where ?? {};
      expect(where.assignedSalesId).toBe('sales-caller');
    });
  });

  // ── Create / update / note ─────────────────────────────────────────────

  describe('Create / update / note', () => {
    it('ADMIN bypasses POST /leads', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer())
        .post('/leads')
        .send({ fullName: 'New', phone: '0501111111' })
        .expect(201);
      expect(mock.lead.create).toHaveBeenCalledTimes(1);
    });

    it('SALES with leads:create → 201', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['leads:create'],
      };
      await request(app.getHttpServer())
        .post('/leads')
        .send({ fullName: 'New', phone: '0501111112' })
        .expect(201);
    });

    it('SALES without leads:create → structured 403', async () => {
      FakeAuthGuard.currentUser = { sub: 'sales-2', role: UserRole.SALES, codes: [] };
      const res = await request(app.getHttpServer())
        .post('/leads')
        .send({ fullName: 'X', phone: '0500000001' })
        .expect(403);
      expect(res.body).toMatchObject({
        code: 'missing_permission',
        permissions: ['leads:create'],
      });
      expect(mock.lead.create).not.toHaveBeenCalled();
    });

    it('SALES with leads:update → 200 on PATCH /leads/:id', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['leads:update'],
      };
      await request(app.getHttpServer())
        .patch('/leads/00000000-0000-0000-0000-000000000001')
        .send({ fullName: 'Updated' })
        .expect(200);
      expect(mock.lead.update).toHaveBeenCalledTimes(1);
    });

    it('SALES without leads:note → structured 403 on POST /leads/:id/notes', async () => {
      FakeAuthGuard.currentUser = { sub: 'sales-2', role: UserRole.SALES, codes: [] };
      const res = await request(app.getHttpServer())
        .post('/leads/00000000-0000-0000-0000-000000000001/notes')
        .send({ body: 'note text' })
        .expect(403);
      expect(res.body).toMatchObject({
        code: 'missing_permission',
        permissions: ['leads:note'],
      });
      expect(mock.leadNote.create).not.toHaveBeenCalled();
    });
  });

  // ── Stage / assign / sources ───────────────────────────────────────────

  describe('Stage / assign / sources', () => {
    const STAGE_PATH = '/leads/00000000-0000-0000-0000-000000000001/stage';
    const ASSIGN_PATH = '/leads/00000000-0000-0000-0000-000000000001/assign';

    it('SALES with leads:advance-stage → 200', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['leads:advance-stage'],
      };
      await request(app.getHttpServer())
        .patch(STAGE_PATH)
        .send({ stage: 'INTERESTED' })
        .expect(200);
      expect(mock.lead.update).toHaveBeenCalledTimes(1);
    });

    it('SALES without leads:advance-stage → structured 403; lead.update NOT called', async () => {
      FakeAuthGuard.currentUser = { sub: 'sales-2', role: UserRole.SALES, codes: [] };
      const res = await request(app.getHttpServer())
        .patch(STAGE_PATH)
        .send({ stage: 'INTERESTED' })
        .expect(403);
      expect(res.body).toMatchObject({
        code: 'missing_permission',
        permissions: ['leads:advance-stage'],
      });
      expect(mock.lead.update).not.toHaveBeenCalled();
    });

    it('SALES even with leads:assign → 403 from @Roles (assign is ADMIN-only)', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['leads:assign'],
      };
      const res = await request(app.getHttpServer())
        .patch(ASSIGN_PATH)
        .send({ salesId: 'sales-target' })
        .expect(403);
      expect(res.body.message).toBe('Insufficient role');
      // PermissionsGuard never ran — RolesGuard short-circuited.
      expect(mock.userPermission.findMany).not.toHaveBeenCalled();
      expect(mock.lead.update).not.toHaveBeenCalled();
    });

    it('ADMIN bypasses PATCH /leads/:id/assign', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer())
        .patch(ASSIGN_PATH)
        .send({ salesId: 'sales-target' })
        .expect(200);
      expect(mock.lead.update).toHaveBeenCalledTimes(1);
    });

    it('SALES even with lead_sources:manage → 403 from @Roles (POST /lead-sources is ADMIN-only)', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['lead_sources:manage'],
      };
      const res = await request(app.getHttpServer())
        .post('/lead-sources')
        .send({ name: 'Website' })
        .expect(403);
      expect(res.body.message).toBe('Insufficient role');
      expect(mock.userPermission.findMany).not.toHaveBeenCalled();
      expect(mock.leadSource.create).not.toHaveBeenCalled();
    });
  });
});
