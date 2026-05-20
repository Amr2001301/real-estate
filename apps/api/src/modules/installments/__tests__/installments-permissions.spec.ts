import { CanActivate, ExecutionContext, Global, INestApplication, Module } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { UserRole } from '@prisma/client';
import { InstallmentsModule } from '../installments.module';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  PERMISSIONS_KEY,
  type PermissionsMeta,
} from '../../../common/decorators/permissions.decorator';

/**
 * Verifies the installments permissions rollout. Two controllers in this
 * module:
 *   * InstallmentsController          — 2 routes (legacy plan create + plan-by-contract).
 *   * PlanTemplatesController         — 8 routes (CRUD + activate/deactivate + stats).
 *
 * Permission codes:
 *   * installments:read     — list/detail/stats/by-contract reads.
 *   * installments:manage   — create plan + create/update/delete templates.
 *   * installments:activate — activate/deactivate templates.
 *
 * No @PermissionsStrict in this batch — template activation flips a status
 * flag; existing reservations snapshot their plan at creation time, so a
 * deactivation cannot break a live deal. ADMIN-only at @Roles for all
 * mutations preserves the existing security floor.
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

const fixture: { contractExists: boolean } = { contractExists: true };

function makePrismaMock() {
  return {
    userPermission: {
      findMany: jest.fn().mockImplementation(async () => {
        const u = FakeAuthGuard.currentUser;
        return (u?.codes ?? []).map((code) => ({ permission: { code } }));
      }),
    },
    contract: {
      findUnique: jest.fn().mockImplementation(async () =>
        fixture.contractExists
          ? { id: 'a1111111-1111-4111-8111-111111111111', signedAt: new Date() }
          : null,
      ),
    },
    installmentPlan: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'plan-1',
        contractId: 'a1111111-1111-4111-8111-111111111111',
        totalMonths: 12,
        monthlyAmount: 1000,
      }),
      upsert: jest.fn().mockResolvedValue({ id: 'plan-1' }),
      create: jest.fn().mockResolvedValue({ id: 'plan-new' }),
    },
    installment: {
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    installmentPlanTemplate: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue({
        id: 'tpl-1',
        name: 'Std Plan',
        status: 'DRAFT',
        projectId: 'p1',
        unitId: null,
        durationOptions: [],
        scheduleItems: [],
      }),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'tpl-new',
        ...data,
      })),
      update: jest.fn().mockImplementation(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => ({
        id: where.id,
        ...data,
      })),
      delete: jest.fn().mockResolvedValue({ id: 'tpl-1' }),
    },
    installmentPlanDurationOption: {
      findMany: jest.fn().mockResolvedValue([]),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    planTemplateScheduleItem: {
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    project: {
      findUnique: jest.fn().mockResolvedValue({ id: 'p1' }),
    },
    unit: {
      // validateUnit() reads unit.building.phase.projectId — provide the
      // nested include shape so create() doesn't trip on undefined access.
      findUnique: jest.fn().mockResolvedValue({
        id: 'u1',
        building: { phase: { projectId: 'a1111111-1111-4111-8111-111111111111' } },
      }),
    },
    $transaction: jest.fn(),
  };
}

let mock = makePrismaMock();
mock.$transaction.mockImplementation(async (ops: unknown) => {
  if (Array.isArray(ops)) return Promise.all(ops);
  if (typeof ops === 'function') {
    const tx = {
      contract: mock.contract,
      installmentPlan: mock.installmentPlan,
      installment: mock.installment,
      installmentPlanTemplate: mock.installmentPlanTemplate,
      installmentPlanDurationOption: mock.installmentPlanDurationOption,
      planTemplateScheduleItem: mock.planTemplateScheduleItem,
    };
    return (ops as (tx: unknown) => Promise<unknown>)(tx);
  }
  return ops;
});

describe('Installments module · permissions enforcement', () => {
  let app: INestApplication;
  let reflector: Reflector;

  beforeAll(async () => {
    mock = makePrismaMock();
    mock.$transaction.mockImplementation(async (ops: unknown) => {
      if (Array.isArray(ops)) return Promise.all(ops);
      if (typeof ops === 'function') {
        const tx = {
          contract: mock.contract,
          installmentPlan: mock.installmentPlan,
          installment: mock.installment,
          installmentPlanTemplate: mock.installmentPlanTemplate,
          installmentPlanDurationOption: mock.installmentPlanDurationOption,
          planTemplateScheduleItem: mock.planTemplateScheduleItem,
        };
        return (ops as (tx: unknown) => Promise<unknown>)(tx);
      }
      return ops;
    });

    @Global()
    @Module({
      providers: [{ provide: PrismaService, useValue: mock }],
      exports: [PrismaService],
    })
    class MockPrismaModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [MockPrismaModule, InstallmentsModule],
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
    fixture.contractExists = true;
    mock.userPermission.findMany.mockClear();
    mock.installmentPlanTemplate.findMany.mockClear();
    mock.installmentPlanTemplate.create.mockClear();
    mock.installmentPlanTemplate.update.mockClear();
    mock.installmentPlanTemplate.delete.mockClear();
    mock.installmentPlan.findUnique.mockClear();
    mock.installmentPlan.upsert.mockClear();
    mock.installmentPlan.create.mockClear();
  });

  // ── Controller metadata helpers ───────────────────────────────────────
  // Both controllers live in installments.module.ts as internal classes.
  const controllers = Reflect.getMetadata('controllers', InstallmentsModule) as Array<
    new () => unknown
  >;
  // Order is module-declaration order: InstallmentsController, PlanTemplatesController.
  const InstallmentsCtor = controllers[0]!;
  const PlanTemplatesCtor = controllers[1]!;

  function getMeta(Ctor: new () => unknown, method: string): PermissionsMeta | undefined {
    const proto = Ctor.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;
    return reflector.get<PermissionsMeta | undefined>(PERMISSIONS_KEY, proto[method]!);
  }

  // ── Metadata ──────────────────────────────────────────────────────────

  describe('@Permissions metadata · InstallmentsController', () => {
    it('create (POST /installment-plans) → installments:manage, bypass true', () => {
      expect(getMeta(InstallmentsCtor, 'create')).toMatchObject({
        codes: ['installments:manage'],
        adminBypass: true,
      });
    });
    it('byContract (GET /contracts/:contractId/installment-plan) → installments:read', () => {
      expect(getMeta(InstallmentsCtor, 'byContract')).toMatchObject({
        codes: ['installments:read'],
        adminBypass: true,
      });
    });
  });

  describe('@Permissions metadata · PlanTemplatesController', () => {
    it.each<[string]>([['list'], ['stats'], ['findOne']])(
      '%s → installments:read, bypass true',
      (m) => {
        expect(getMeta(PlanTemplatesCtor, m)).toMatchObject({
          codes: ['installments:read'],
          adminBypass: true,
        });
      },
    );

    it.each<[string]>([['create'], ['update'], ['remove']])(
      '%s → installments:manage, bypass true',
      (m) => {
        expect(getMeta(PlanTemplatesCtor, m)).toMatchObject({
          codes: ['installments:manage'],
          adminBypass: true,
        });
      },
    );

    it.each<[string]>([['activate'], ['deactivate']])(
      '%s → installments:activate, bypass true',
      (m) => {
        expect(getMeta(PlanTemplatesCtor, m)).toMatchObject({
          codes: ['installments:activate'],
          adminBypass: true,
        });
      },
    );
  });

  // ── Admin bypass ──────────────────────────────────────────────────────

  describe('ADMIN bypass', () => {
    beforeEach(() => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
    });

    it('GET /installment-plan-templates → 200; no permission DB lookup', async () => {
      await request(app.getHttpServer()).get('/installment-plan-templates').expect(200);
      expect(mock.userPermission.findMany).not.toHaveBeenCalled();
    });

    it('GET /installment-plan-templates/stats → 200', async () => {
      await request(app.getHttpServer()).get('/installment-plan-templates/stats').expect(200);
    });

    it('GET /contracts/:id/installment-plan → 200 (cross-controller read)', async () => {
      await request(app.getHttpServer())
        .get('/contracts/a1111111-1111-4111-8111-111111111111/installment-plan')
        .expect(200);
      expect(mock.installmentPlan.findUnique).toHaveBeenCalled();
    });

    it('POST /installment-plan-templates → 201; template.create called', async () => {
      await request(app.getHttpServer())
        .post('/installment-plan-templates')
        .send({
          name: 'Test plan',
          projectId: 'a1111111-1111-4111-8111-111111111111',
          totalPrice: 100000,
          discountAmount: 0,
          netPrice: 100000,
          reservationAmount: 5000,
          downPaymentType: 'FIXED',
          downPaymentValue: 10000,
          downPaymentAmount: 10000,
          frequency: 'MONTHLY',
          startDateRule: 'MANUAL',
          installmentsCount: 12,
          durationOptions: [{ durationMonths: 12, increasePercentage: 0, order: 1 }],
        })
        .expect(201);
      expect(mock.installmentPlanTemplate.create).toHaveBeenCalled();
    });

    it('POST /installment-plan-templates/:id/activate → 201; template.update called', async () => {
      await request(app.getHttpServer())
        .post('/installment-plan-templates/a1111111-1111-4111-8111-111111111111/activate')
        .expect(201);
      expect(mock.installmentPlanTemplate.update).toHaveBeenCalled();
    });

    it('POST /installment-plan-templates/:id/deactivate → 201; template.update called', async () => {
      await request(app.getHttpServer())
        .post('/installment-plan-templates/a1111111-1111-4111-8111-111111111111/deactivate')
        .expect(201);
      expect(mock.installmentPlanTemplate.update).toHaveBeenCalled();
    });

    it('DELETE /installment-plan-templates/:id → 200; template.delete called', async () => {
      await request(app.getHttpServer())
        .delete('/installment-plan-templates/a1111111-1111-4111-8111-111111111111')
        .expect(200);
      expect(mock.installmentPlanTemplate.delete).toHaveBeenCalled();
    });
  });

  // ── SALES with installments:read ──────────────────────────────────────

  describe('SALES with installments:read', () => {
    beforeEach(() => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['installments:read'],
      };
    });

    it('can list templates', async () => {
      await request(app.getHttpServer()).get('/installment-plan-templates').expect(200);
      expect(mock.userPermission.findMany).toHaveBeenCalledTimes(1);
    });

    it('can read a contract installment plan', async () => {
      await request(app.getHttpServer())
        .get('/contracts/a1111111-1111-4111-8111-111111111111/installment-plan')
        .expect(200);
    });
  });

  // ── SALES without installments:read ───────────────────────────────────

  describe('SALES without installments:read', () => {
    beforeEach(() => {
      FakeAuthGuard.currentUser = { sub: 'sales-2', role: UserRole.SALES, codes: [] };
    });

    it('GET /installment-plan-templates → structured 403; service NOT called', async () => {
      const res = await request(app.getHttpServer())
        .get('/installment-plan-templates')
        .expect(403);
      expect(res.body).toMatchObject({
        code: 'missing_permission',
        permissions: ['installments:read'],
      });
      expect(mock.installmentPlanTemplate.findMany).not.toHaveBeenCalled();
    });

    it('GET /contracts/:id/installment-plan → structured 403; service NOT called', async () => {
      const res = await request(app.getHttpServer())
        .get('/contracts/a1111111-1111-4111-8111-111111111111/installment-plan')
        .expect(403);
      expect(res.body.code).toBe('missing_permission');
      expect(mock.installmentPlan.findUnique).not.toHaveBeenCalled();
    });
  });

  // ── SALES blocked at @Roles on admin-only routes ──────────────────────

  describe('SALES with admin codes still blocked by @Roles', () => {
    it('SALES with installments:manage → 403 on POST /installment-plan-templates', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['installments:manage'],
      };
      await request(app.getHttpServer())
        .post('/installment-plan-templates')
        .send({ name: 'x', projectId: 'p1' })
        .expect(403);
      // RolesGuard rejects before PermissionsGuard runs.
      expect(mock.userPermission.findMany).not.toHaveBeenCalled();
      expect(mock.installmentPlanTemplate.create).not.toHaveBeenCalled();
    });

    it('SALES with installments:activate → 403 on POST /:id/activate', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['installments:activate'],
      };
      await request(app.getHttpServer())
        .post('/installment-plan-templates/a1111111-1111-4111-8111-111111111111/activate')
        .expect(403);
      expect(mock.installmentPlanTemplate.update).not.toHaveBeenCalled();
    });
  });

  // ── Unauthenticated ───────────────────────────────────────────────────

  describe('Unauthenticated', () => {
    it('GET /installment-plan-templates → 403', async () => {
      FakeAuthGuard.currentUser = null;
      await request(app.getHttpServer()).get('/installment-plan-templates').expect(403);
    });
  });

  // ── Business validation survives the gate ────────────────────────────

  describe('Business validation', () => {
    it('ADMIN bypass + POST /installment-plans with non-existent contractId → fails; plan NOT created', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      fixture.contractExists = false;
      const res = await request(app.getHttpServer())
        .post('/installment-plans')
        .send({
          contractId: 'a1111111-1111-4111-8111-111111111111',
          totalMonths: 12,
          monthlyAmount: 1000,
          startsAt: '2099-01-01T00:00:00Z',
        });
      // Service throws NotFoundException → 404 (or BadRequestException → 400).
      expect([400, 404]).toContain(res.status);
      expect(mock.contract.findUnique).toHaveBeenCalledTimes(1);
      // No plan was upserted/created.
      expect(mock.installmentPlan.upsert).not.toHaveBeenCalled();
      expect(mock.installmentPlan.create).not.toHaveBeenCalled();
    });
  });
});
