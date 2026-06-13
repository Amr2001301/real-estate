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
import { BonusModule } from '../bonus.module';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  PERMISSIONS_KEY,
  type PermissionsMeta,
} from '../../../common/decorators/permissions.decorator';

/**
 * Verifies the bonus permissions rollout:
 *   * Per-route metadata (rules + entries + approve/pay strict + revert + targets).
 *   * Read/create/manage bypass for ADMIN; SALES grants enable list reads.
 *   * Strict 403 from approve/pay when ADMIN lacks the code; side effects
 *     (`bonusEntry.update`) do not run.
 *   * The narrowed PATCH route rejects APPROVED/PAID via ValidationPipe.
 *   * Targets split (`:read` vs `:manage`) preserves SALES self-read access.
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

function makePrismaMock() {
  return {
    userPermission: {
      findMany: jest.fn().mockImplementation(async () => {
        const u = FakeAuthGuard.currentUser;
        return (u?.codes ?? []).map((code) => ({ permission: { code } }));
      }),
    },
    bonusRule: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation(async ({ data }) => ({ id: 'rule-1', ...data })),
    },
    bonusEntry: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation(async ({ data }) => ({ id: 'entry-1', ...data })),
      update: jest.fn().mockImplementation(async ({ where, data }) => ({
        id: where.id,
        status: data.status,
        paidAt: data.paidAt,
      })),
    },
    salesTarget: {
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn().mockImplementation(async ({ where, create }) => ({
        id: 'target-1',
        ...where.salesId_period,
        ...create,
      })),
    },
    user: {
      // Default: empty team — scope assertions use this to resolve managerId's team.
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
}

describe('Bonus module · permissions enforcement', () => {
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

    const moduleRef = await Test.createTestingModule({
      imports: [MockPrismaModule, BonusModule],
      providers: [
        Reflector,
        { provide: APP_GUARD, useClass: FakeAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
      ],
    }).compile();

    reflector = moduleRef.get(Reflector);
    app = moduleRef.createNestApplication();
    // Mirror production main.ts so the narrowed PATCH DTO actually rejects.
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
    prismaMock.bonusEntry.update.mockClear();
    prismaMock.bonusEntry.create.mockClear();
    prismaMock.bonusRule.create.mockClear();
    prismaMock.salesTarget.upsert.mockClear();
    prismaMock.user.findMany.mockClear();
    // Reset to empty-team default so scope assertions work without a team in scope
    prismaMock.user.findMany.mockResolvedValue([]);
  });

  // ── Metadata ───────────────────────────────────────────────────────────

  describe('@Permissions metadata', () => {
    const controllers = Reflect.getMetadata('controllers', BonusModule) as Array<
      new () => unknown
    >;
    const Ctor = controllers[0]!;
    const proto = Ctor.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;

    function getMeta(method: string): PermissionsMeta | undefined {
      return reflector.get<PermissionsMeta | undefined>(PERMISSIONS_KEY, proto[method]!);
    }

    it.each<[string, string]>([
      ['listRules', 'bonus:rules:manage'],
      ['createRule', 'bonus:rules:manage'],
    ])('%s → @Permissions(%s), bypass true', (method, code) => {
      expect(getMeta(method)).toMatchObject({ codes: [code], adminBypass: true });
    });

    it('createEntry → bonus:entries:create, bypass true', () => {
      expect(getMeta('createEntry')).toMatchObject({
        codes: ['bonus:entries:create'],
        adminBypass: true,
      });
    });
    it('listEntries → bonus:entries:read, bypass true', () => {
      expect(getMeta('listEntries')).toMatchObject({
        codes: ['bonus:entries:read'],
        adminBypass: true,
      });
    });
    it('approveEntry → bonus:entries:approve, bypass FALSE (strict)', () => {
      expect(getMeta('approveEntry')).toMatchObject({
        codes: ['bonus:entries:approve'],
        adminBypass: false,
      });
    });
    it('payEntry → bonus:entries:pay, bypass FALSE (strict)', () => {
      expect(getMeta('payEntry')).toMatchObject({
        codes: ['bonus:entries:pay'],
        adminBypass: false,
      });
    });
    it('setEntryStatus (PATCH revert) → bonus:entries:approve, bypass true', () => {
      expect(getMeta('setEntryStatus')).toMatchObject({
        codes: ['bonus:entries:approve'],
        adminBypass: true,
      });
    });
    it('listTargets → targets:read, bypass true', () => {
      expect(getMeta('listTargets')).toMatchObject({
        codes: ['targets:read'],
        adminBypass: true,
      });
    });
    it('upsertTarget → targets:manage, bypass true', () => {
      expect(getMeta('upsertTarget')).toMatchObject({
        codes: ['targets:manage'],
        adminBypass: true,
      });
    });
  });

  // ── Read routes ────────────────────────────────────────────────────────

  describe('GET /bonus-entries', () => {
    it('ADMIN bypasses — no permission DB lookup', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer()).get('/bonus-entries').expect(200);
      expect(prismaMock.userPermission.findMany).not.toHaveBeenCalled();
    });

    it('SALES with bonus:entries:read → 200', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['bonus:entries:read'],
      };
      await request(app.getHttpServer()).get('/bonus-entries').expect(200);
      expect(prismaMock.userPermission.findMany).toHaveBeenCalledTimes(1);
    });

    it('SALES without bonus:entries:read → structured 403', async () => {
      FakeAuthGuard.currentUser = { sub: 'sales-2', role: UserRole.SALES, codes: [] };
      const res = await request(app.getHttpServer()).get('/bonus-entries').expect(403);
      expect(res.body).toMatchObject({
        code: 'missing_permission',
        permissions: ['bonus:entries:read'],
      });
    });
  });

  describe('GET /sales-targets', () => {
    it('SALES with targets:read → 200', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['targets:read'],
      };
      await request(app.getHttpServer()).get('/sales-targets').expect(200);
    });

    it('SALES without targets:read → structured 403', async () => {
      FakeAuthGuard.currentUser = { sub: 'sales-2', role: UserRole.SALES, codes: [] };
      const res = await request(app.getHttpServer()).get('/sales-targets').expect(403);
      expect(res.body).toMatchObject({
        code: 'missing_permission',
        permissions: ['targets:read'],
      });
    });
  });

  // ── Create / manage routes (ADMIN bypass) ──────────────────────────────

  describe('Create / manage routes — ADMIN bypass', () => {
    it('POST /bonus-rules — ADMIN bypasses', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer())
        .post('/bonus-rules')
        .send({ name: 'Q3 rule', percentage: 5 })
        .expect(201);
      expect(prismaMock.bonusRule.create).toHaveBeenCalledTimes(1);
    });

    it('POST /bonus-entries — ADMIN bypasses', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer())
        .post('/bonus-entries')
        .send({
          salesId: 'a1111111-1111-4111-8111-111111111111',
          ruleId: 'b2222222-2222-4222-8222-222222222222',
          amount: 1000,
          period: '2026-05',
        })
        .expect(201);
      expect(prismaMock.bonusEntry.create).toHaveBeenCalledTimes(1);
    });

    it('POST /sales-targets — ADMIN bypasses', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer())
        .post('/sales-targets')
        .send({
          salesId: 'a1111111-1111-4111-8111-111111111111',
          period: '2026-05',
          amountTarget: 100000,
          unitsTarget: 4,
        })
        .expect(201);
      expect(prismaMock.salesTarget.upsert).toHaveBeenCalledTimes(1);
    });
  });

  // ── SALES_MANAGER target management ────────────────────────────────────────

  describe('POST /sales-targets — SALES_MANAGER scope', () => {
    const MANAGER_ID = 'b3333333-3333-4333-8333-333333333333';
    const TEAM_SALES_ID = 'c4444444-4444-4444-8444-444444444444';
    const OTHER_SALES_ID = 'a1111111-1111-4111-8111-111111111111';

    it('SALES_MANAGER with targets:manage + own salesId → 201', async () => {
      FakeAuthGuard.currentUser = {
        sub: MANAGER_ID,
        role: UserRole.SALES_MANAGER,
        codes: ['targets:manage'],
      };
      await request(app.getHttpServer())
        .post('/sales-targets')
        .send({ salesId: MANAGER_ID, period: '2026-06', amountTarget: 200000, unitsTarget: 6 })
        .expect(201);
      expect(prismaMock.salesTarget.upsert).toHaveBeenCalledTimes(1);
    });

    it('SALES_MANAGER with targets:manage + in-team salesId → 201', async () => {
      // Mock team: manager has TEAM_SALES_ID as a direct report
      prismaMock.user.findMany.mockResolvedValueOnce([{ id: TEAM_SALES_ID }]);
      FakeAuthGuard.currentUser = {
        sub: MANAGER_ID,
        role: UserRole.SALES_MANAGER,
        codes: ['targets:manage'],
      };
      await request(app.getHttpServer())
        .post('/sales-targets')
        .send({ salesId: TEAM_SALES_ID, period: '2026-06', amountTarget: 150000, unitsTarget: 3 })
        .expect(201);
      expect(prismaMock.salesTarget.upsert).toHaveBeenCalledTimes(1);
    });

    it('SALES_MANAGER with targets:manage + out-of-scope salesId → 403', async () => {
      FakeAuthGuard.currentUser = {
        sub: MANAGER_ID,
        role: UserRole.SALES_MANAGER,
        codes: ['targets:manage'],
      };
      const res = await request(app.getHttpServer())
        .post('/sales-targets')
        .send({ salesId: OTHER_SALES_ID, period: '2026-06', amountTarget: 100000, unitsTarget: 4 })
        .expect(403);
      expect(res.body.message).toContain('outside your team');
      expect(prismaMock.salesTarget.upsert).not.toHaveBeenCalled();
    });

    it('SALES_MANAGER without targets:manage → structured 403', async () => {
      FakeAuthGuard.currentUser = {
        sub: MANAGER_ID,
        role: UserRole.SALES_MANAGER,
        codes: [],
      };
      const res = await request(app.getHttpServer())
        .post('/sales-targets')
        .send({ salesId: MANAGER_ID, period: '2026-06', amountTarget: 200000, unitsTarget: 6 })
        .expect(403);
      expect(res.body).toMatchObject({ code: 'missing_permission', permissions: ['targets:manage'] });
      expect(prismaMock.salesTarget.upsert).not.toHaveBeenCalled();
    });
  });

  // ── Strict approve ─────────────────────────────────────────────────────

  describe('POST /bonus-entries/:id/approve (strict)', () => {
    const PATH = '/bonus-entries/00000000-0000-0000-0000-000000000001/approve';

    it('ADMIN WITHOUT bonus:entries:approve → structured 403; no update', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      const res = await request(app.getHttpServer()).post(PATH).send({}).expect(403);
      expect(res.body).toMatchObject({
        code: 'missing_permission',
        permissions: ['bonus:entries:approve'],
      });
      expect(prismaMock.bonusEntry.update).not.toHaveBeenCalled();
    });

    it('ADMIN WITH bonus:entries:approve → 201; bonus entry updated to APPROVED', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'admin-2',
        role: UserRole.ADMIN,
        codes: ['bonus:entries:approve'],
      };
      await request(app.getHttpServer()).post(PATH).send({}).expect(201);
      expect(prismaMock.bonusEntry.update).toHaveBeenCalledTimes(1);
      const call = prismaMock.bonusEntry.update.mock.calls[0]![0] as {
        data: { status: string; paidAt: Date | null };
      };
      expect(call.data.status).toBe('APPROVED');
      expect(call.data.paidAt).toBeNull();
    });

    it('SALES even with bonus:entries:approve → 403 from @Roles', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['bonus:entries:approve'],
      };
      const res = await request(app.getHttpServer()).post(PATH).send({}).expect(403);
      expect(res.body.message).toBe('Insufficient role');
      expect(prismaMock.userPermission.findMany).not.toHaveBeenCalled();
      expect(prismaMock.bonusEntry.update).not.toHaveBeenCalled();
    });
  });

  // ── Strict pay ─────────────────────────────────────────────────────────

  describe('POST /bonus-entries/:id/pay (strict)', () => {
    const PATH = '/bonus-entries/00000000-0000-0000-0000-000000000001/pay';

    it('ADMIN WITHOUT bonus:entries:pay → structured 403; no update', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      const res = await request(app.getHttpServer()).post(PATH).send({}).expect(403);
      expect(res.body).toMatchObject({
        code: 'missing_permission',
        permissions: ['bonus:entries:pay'],
      });
      expect(prismaMock.bonusEntry.update).not.toHaveBeenCalled();
    });

    it('ADMIN WITH bonus:entries:pay → 201; bonus entry updated to PAID with paidAt set', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'admin-2',
        role: UserRole.ADMIN,
        codes: ['bonus:entries:pay'],
      };
      await request(app.getHttpServer()).post(PATH).send({}).expect(201);
      expect(prismaMock.bonusEntry.update).toHaveBeenCalledTimes(1);
      const call = prismaMock.bonusEntry.update.mock.calls[0]![0] as {
        data: { status: string; paidAt: Date | null };
      };
      expect(call.data.status).toBe('PAID');
      expect(call.data.paidAt).toBeInstanceOf(Date);
    });

    it('SALES even with bonus:entries:pay → 403 from @Roles', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['bonus:entries:pay'],
      };
      await request(app.getHttpServer()).post(PATH).send({}).expect(403);
      expect(prismaMock.bonusEntry.update).not.toHaveBeenCalled();
    });
  });

  // ── PATCH narrowing ────────────────────────────────────────────────────

  describe('PATCH /bonus-entries/:id (revert-only)', () => {
    const PATH = '/bonus-entries/00000000-0000-0000-0000-000000000001';

    it('PATCH with status PENDING → 200 (revert path works)', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer())
        .patch(PATH)
        .send({ status: 'PENDING' })
        .expect(200);
      expect(prismaMock.bonusEntry.update).toHaveBeenCalledTimes(1);
      const call = prismaMock.bonusEntry.update.mock.calls[0]![0] as {
        data: { status: string };
      };
      expect(call.data.status).toBe('PENDING');
    });

    it('PATCH with status APPROVED → 400 from ValidationPipe; no update', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      const res = await request(app.getHttpServer())
        .patch(PATH)
        .send({ status: 'APPROVED' })
        .expect(400);
      expect(JSON.stringify(res.body)).toContain('status');
      expect(prismaMock.bonusEntry.update).not.toHaveBeenCalled();
    });

    it('PATCH with status PAID → 400 from ValidationPipe; no update', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      const res = await request(app.getHttpServer())
        .patch(PATH)
        .send({ status: 'PAID' })
        .expect(400);
      expect(JSON.stringify(res.body)).toContain('status');
      expect(prismaMock.bonusEntry.update).not.toHaveBeenCalled();
    });
  });
});
