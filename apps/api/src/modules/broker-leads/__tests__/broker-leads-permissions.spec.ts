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
import { ConfigModule } from '@nestjs/config';
import { NotificationsService } from '../../notifications/notifications.module';
import request from 'supertest';
import { UserRole } from '@prisma/client';
import { BrokerLeadsController } from '../broker-leads.controller';
import { BrokerLeadsService } from '../broker-leads.service';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  PERMISSIONS_KEY,
  type PermissionsMeta,
} from '../../../common/decorators/permissions.decorator';

/**
 * Broker permissions · Batch 3 (broker leads).
 *
 *   - list/findOne → broker_leads:read (bypass; @Roles allows ADMIN + SALES,
 *     so a SALES user must hold the code).
 *   - approve → strict broker_leads:approve.
 *   - reject + mark-duplicate → strict broker_leads:reject (mark-duplicate is
 *     a rejection variant, terminal DUPLICATE state).
 *   - Broker portal authorization untouched (no portal files imported).
 */

const LEAD_ID = 'b1111111-1111-4111-8111-111111111111';
const SALES_ID = 'b2222222-2222-4222-8222-222222222222';

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
  const m = {
    userPermission: {
      findMany: jest.fn().mockImplementation(async () => {
        const u = FakeAuthGuard.currentUser;
        return (u?.codes ?? []).map((code) => ({ permission: { code } }));
      }),
    },
    lead: {
      findUnique: jest.fn().mockResolvedValue({
        id: LEAD_ID,
        brokerId: 'broker-1',
        brokerApprovalStatus: 'PENDING',
        stage: 'NEW',
      }),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn().mockImplementation(async ({ where, data }) => ({
        id: where.id,
        ...data,
      })),
    },
    leadActivity: { create: jest.fn().mockResolvedValue({}) },
    leadNote: { create: jest.fn().mockResolvedValue({}) },
    brokerUser: { findMany: jest.fn().mockResolvedValue([]) },
    notification: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
    $transaction: jest.fn(),
  };
  m.$transaction.mockImplementation(async (ops: unknown) => {
    if (Array.isArray(ops)) return Promise.all(ops);
    if (typeof ops === 'function') {
      return (ops as (tx: unknown) => Promise<unknown>)({
        lead: m.lead,
        leadActivity: m.leadActivity,
        leadNote: m.leadNote,
      });
    }
    return ops;
  });
  return m;
}

const notificationsMock = {
  sendToUser: jest.fn().mockResolvedValue(undefined),
  sendToUsers: jest.fn().mockResolvedValue(undefined),
  sendToRoles: jest.fn().mockResolvedValue(undefined),
};

describe('Broker leads module · permissions enforcement', () => {
  let app: INestApplication;
  let prismaMock: ReturnType<typeof makePrismaMock>;
  let reflector: Reflector;
  let approveSpy: jest.SpyInstance;
  let rejectSpy: jest.SpyInstance;
  let markDuplicateSpy: jest.SpyInstance;

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
      controllers: [BrokerLeadsController],
      providers: [{ provide: NotificationsService, useValue: notificationsMock }, BrokerLeadsService],
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
    const svc = moduleRef.get(BrokerLeadsService);
    approveSpy = jest.spyOn(svc, 'approve');
    rejectSpy = jest.spyOn(svc, 'reject');
    markDuplicateSpy = jest.spyOn(svc, 'markDuplicate');

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
    prismaMock.lead.update.mockClear();
    prismaMock.lead.findUnique.mockClear();
    prismaMock.lead.findUnique.mockResolvedValue({
      id: LEAD_ID,
      brokerId: 'broker-1',
      brokerApprovalStatus: 'PENDING',
      stage: 'NEW',
    });
    approveSpy.mockClear();
    rejectSpy.mockClear();
    markDuplicateSpy.mockClear();
  });

  // ── Metadata ────────────────────────────────────────────────────────────

  describe('@Permissions metadata', () => {
    const proto = BrokerLeadsController.prototype as unknown as Record<
      string,
      (...a: unknown[]) => unknown
    >;
    function getMeta(method: string): PermissionsMeta | undefined {
      return reflector.get<PermissionsMeta | undefined>(PERMISSIONS_KEY, proto[method]!);
    }

    it.each<[string]>([['list'], ['findOne']])(
      '%s → @Permissions(broker_leads:read), bypass true',
      (method) => {
        expect(getMeta(method)).toMatchObject({
          codes: ['broker_leads:read'],
          adminBypass: true,
        });
      },
    );

    it('approve → @PermissionsStrict(broker_leads:approve), bypass false', () => {
      expect(getMeta('approve')).toMatchObject({
        codes: ['broker_leads:approve'],
        adminBypass: false,
      });
    });

    it.each<[string]>([['reject'], ['markDuplicate']])(
      '%s → @PermissionsStrict(broker_leads:reject), bypass false',
      (method) => {
        expect(getMeta(method)).toMatchObject({
          codes: ['broker_leads:reject'],
          adminBypass: false,
        });
      },
    );
  });

  // ── Read behavior ─────────────────────────────────────────────────────────

  describe('GET /broker-leads (read)', () => {
    it('ADMIN lists by bypass — no permission DB lookup', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer()).get('/broker-leads').expect(200);
      expect(prismaMock.userPermission.findMany).not.toHaveBeenCalled();
    });

    it('SALES WITH broker_leads:read can list (bypass does not apply to SALES)', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['broker_leads:read'],
      };
      await request(app.getHttpServer()).get('/broker-leads').expect(200);
      expect(prismaMock.userPermission.findMany).toHaveBeenCalled();
    });

    it('SALES WITHOUT broker_leads:read → structured 403', async () => {
      FakeAuthGuard.currentUser = { sub: 'sales-2', role: UserRole.SALES, codes: [] };
      const res = await request(app.getHttpServer()).get('/broker-leads').expect(403);
      expect(res.body).toMatchObject({
        code: 'missing_permission',
        permissions: ['broker_leads:read'],
      });
    });

    it('rejects unauthenticated requests', async () => {
      FakeAuthGuard.currentUser = null;
      await request(app.getHttpServer()).get('/broker-leads').expect(403);
    });

    it('CUSTOMER blocked at the @Roles layer even with the code', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'cust-1',
        role: UserRole.CUSTOMER,
        codes: ['broker_leads:read'],
      };
      await request(app.getHttpServer()).get('/broker-leads').expect(403);
      expect(prismaMock.userPermission.findMany).not.toHaveBeenCalled();
    });
  });

  // ── Approve (strict) ────────────────────────────────────────────────────

  describe('PATCH /broker-leads/:id/approve (strict)', () => {
    it('ADMIN WITHOUT broker_leads:approve → structured 403; service never called', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      const res = await request(app.getHttpServer())
        .patch(`/broker-leads/${LEAD_ID}/approve`)
        .send({})
        .expect(403);
      expect(res.body).toMatchObject({
        code: 'missing_permission',
        permissions: ['broker_leads:approve'],
      });
      expect(approveSpy).not.toHaveBeenCalled();
      expect(prismaMock.lead.update).not.toHaveBeenCalled();
    });

    it('ADMIN WITH broker_leads:approve can approve (lead → APPROVED)', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'admin-2',
        role: UserRole.ADMIN,
        codes: ['broker_leads:approve'],
      };
      await request(app.getHttpServer())
        .patch(`/broker-leads/${LEAD_ID}/approve`)
        .send({})
        .expect(200);
      expect(approveSpy).toHaveBeenCalledTimes(1);
      const args = prismaMock.lead.update.mock.calls[0]![0] as {
        data: { brokerApprovalStatus: string };
      };
      expect(args.data.brokerApprovalStatus).toBe('APPROVED');
    });

    it('holding broker_leads:reject does NOT authorize approve (structured 403)', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'admin-3',
        role: UserRole.ADMIN,
        codes: ['broker_leads:reject'],
      };
      const res = await request(app.getHttpServer())
        .patch(`/broker-leads/${LEAD_ID}/approve`)
        .send({})
        .expect(403);
      expect(res.body).toMatchObject({ permissions: ['broker_leads:approve'] });
      expect(approveSpy).not.toHaveBeenCalled();
    });

    it('business validation still runs after the gate (404 for non-broker lead)', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'admin-2',
        role: UserRole.ADMIN,
        codes: ['broker_leads:approve'],
      };
      prismaMock.lead.findUnique.mockResolvedValueOnce(null);
      await request(app.getHttpServer())
        .patch(`/broker-leads/${LEAD_ID}/approve`)
        .send({})
        .expect(404);
    });

    it('SALES with broker_leads:approve still blocked by @Roles (approve is ADMIN-only)', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['broker_leads:approve'],
      };
      await request(app.getHttpServer())
        .patch(`/broker-leads/${LEAD_ID}/approve`)
        .send({})
        .expect(403);
      expect(approveSpy).not.toHaveBeenCalled();
    });
  });

  // ── Reject (strict) ───────────────────────────────────────────────────────

  describe('PATCH /broker-leads/:id/reject (strict)', () => {
    it('ADMIN WITHOUT broker_leads:reject → structured 403; service never called', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      const res = await request(app.getHttpServer())
        .patch(`/broker-leads/${LEAD_ID}/reject`)
        .send({ reason: 'incomplete' })
        .expect(403);
      expect(res.body).toMatchObject({
        code: 'missing_permission',
        permissions: ['broker_leads:reject'],
      });
      expect(rejectSpy).not.toHaveBeenCalled();
      expect(prismaMock.lead.update).not.toHaveBeenCalled();
    });

    it('ADMIN WITH broker_leads:reject can reject', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'admin-2',
        role: UserRole.ADMIN,
        codes: ['broker_leads:reject'],
      };
      await request(app.getHttpServer())
        .patch(`/broker-leads/${LEAD_ID}/reject`)
        .send({ reason: 'incomplete' })
        .expect(200);
      expect(rejectSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ── Mark duplicate (strict, reuses reject code) ───────────────────────────

  describe('PATCH /broker-leads/:id/mark-duplicate (strict, broker_leads:reject)', () => {
    it('ADMIN WITHOUT broker_leads:reject cannot mark duplicate (structured 403)', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      const res = await request(app.getHttpServer())
        .patch(`/broker-leads/${LEAD_ID}/mark-duplicate`)
        .send({})
        .expect(403);
      expect(res.body).toMatchObject({
        code: 'missing_permission',
        permissions: ['broker_leads:reject'],
      });
      expect(markDuplicateSpy).not.toHaveBeenCalled();
      expect(prismaMock.lead.update).not.toHaveBeenCalled();
    });

    it('ADMIN WITH broker_leads:reject can mark duplicate (lead → DUPLICATE)', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'admin-2',
        role: UserRole.ADMIN,
        codes: ['broker_leads:reject'],
      };
      await request(app.getHttpServer())
        .patch(`/broker-leads/${LEAD_ID}/mark-duplicate`)
        .send({ reason: 'dupe of #123' })
        .expect(200);
      expect(markDuplicateSpy).toHaveBeenCalledTimes(1);
      const args = prismaMock.lead.update.mock.calls[0]![0] as {
        data: { brokerApprovalStatus: string };
      };
      expect(args.data.brokerApprovalStatus).toBe('DUPLICATE');
    });
  });
});
