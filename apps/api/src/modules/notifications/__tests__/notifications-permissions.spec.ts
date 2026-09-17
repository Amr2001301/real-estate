import { CallHandler, CanActivate, ExecutionContext, Global, INestApplication, Module, NestInterceptor } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { UserRole } from '@prisma/client';
import { Observable } from 'rxjs';
import { NotificationsModule } from '../notifications.module';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { enterTenantContext } from '../../../common/tenant/tenant-context';
import { FirebaseService } from '../../../common/firebase/firebase.service';
import {
  PERMISSIONS_KEY,
  type PermissionsMeta,
} from '../../../common/decorators/permissions.decorator';

/**
 * Verifies the notifications permissions rollout:
 *   * Per-route metadata: 3 admin routes gated, 4 /me self-service routes
 *     intentionally left WITHOUT permission decorators.
 *   * ADMIN bypass on admin routes — no permission DB lookup.
 *   * CUSTOMER / BROKER / SALES with zero permissions can use the four
 *     /me routes (no admin permission required).
 *   * SALES with the admin codes is still blocked at @Roles on admin routes.
 *   * /me queries/updates remain server-scoped to user.sub.
 *   * Template lookup failure still surfaces as the existing service error.
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

// upsertTemplate calls getRequiredCompanyId() (ALS). Provide a minimal fake
// interceptor so the ALS context is set for every request in this test module.
class FakeTenantInterceptor implements NestInterceptor {
  intercept(_: ExecutionContext, next: CallHandler): Observable<unknown> {
    enterTenantContext({ companyId: 'test-company-id', bypass: false, isPublic: false });
    return next.handle();
  }
}

const fixture: { templateExists: boolean } = { templateExists: true };

function makePrismaMock() {
  return {
    userPermission: {
      findMany: jest.fn().mockImplementation(async () => {
        const u = FakeAuthGuard.currentUser;
        return (u?.codes ?? []).map((code) => ({ permission: { code } }));
      }),
    },
    notificationTemplate: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockImplementation(async () =>
        fixture.templateExists
          ? { code: 'visit_approved', channel: 'IN_APP', subject: {}, body: {}, active: true }
          : null,
      ),
      upsert: jest.fn().mockImplementation(async ({ where, create, update }) => ({
        code: where.code,
        ...create,
        ...update,
      })),
    },
    notification: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'notif-new',
        ...data,
      })),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({ locale: 'ar', email: null }),
      findFirst:  jest.fn().mockResolvedValue({ locale: 'ar', email: null }),
      findMany:   jest.fn().mockResolvedValue([{ id: 'u-1' }]),
    },
    deviceToken: {
      upsert: jest.fn().mockImplementation(async ({ where, create, update }) => ({
        token: where.token,
        ...create,
        ...update,
      })),
    },
    $transaction: jest.fn().mockImplementation(async (ops: unknown) => {
      if (Array.isArray(ops)) return Promise.all(ops);
      return ops;
    }),
    // upsertTemplate calls $queryRaw to detect cross-tenant code conflicts before
    // upserting. Return empty array (no conflict) by default so the upsert proceeds.
    $queryRaw: jest.fn().mockResolvedValue([]),
  };
}

describe('Notifications module · permissions enforcement', () => {
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
      imports: [MockPrismaModule, ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), NotificationsModule],
      providers: [
        Reflector,
        { provide: APP_INTERCEPTOR, useClass: FakeTenantInterceptor },
        { provide: APP_GUARD, useClass: FakeAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
      ],
    })
      // FirebaseService needs ConfigService at runtime; stub it as disabled.
      .overrideProvider(FirebaseService)
      .useValue({ enabled: false, messaging: () => null })
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
    fixture.templateExists = true;
    mock.userPermission.findMany.mockClear();
    mock.notificationTemplate.findMany.mockClear();
    mock.notificationTemplate.findUnique.mockClear();
    mock.notificationTemplate.upsert.mockClear();
    mock.notification.create.mockClear();
    mock.notification.update.mockClear();
    mock.notification.findMany.mockClear();
    mock.notification.updateMany.mockClear();
    mock.deviceToken.upsert.mockClear();
  });

  // ── Internal controller via Reflect.getMetadata ───────────────────────
  const controllers = Reflect.getMetadata('controllers', NotificationsModule) as Array<
    new () => unknown
  >;
  const Ctor = controllers[0]!;
  const proto = Ctor.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;

  function getMeta(method: string): PermissionsMeta | undefined {
    return reflector.get<PermissionsMeta | undefined>(PERMISSIONS_KEY, proto[method]!);
  }

  // ── Metadata ──────────────────────────────────────────────────────────

  describe('@Permissions metadata', () => {
    it.each<[string]>([['listTemplates'], ['upsertTemplate']])(
      '%s → notifications:templates:manage, adminBypass true',
      (m) => {
        expect(getMeta(m)).toMatchObject({
          codes: ['notifications:templates:manage'],
          adminBypass: true,
        });
      },
    );

    it('send → notifications:send, adminBypass true', () => {
      expect(getMeta('send')).toMatchObject({
        codes: ['notifications:send'],
        adminBypass: true,
      });
    });

    it.each<[string]>([['broadcast'], ['previewBroadcast']])(
      '%s → notifications:send, adminBypass true',
      (m) => {
        expect(getMeta(m)).toMatchObject({
          codes: ['notifications:send'],
          adminBypass: true,
        });
      },
    );

    it.each<[string]>([['myList'], ['markRead'], ['markAllRead'], ['registerDevice']])(
      '%s — no permission metadata (self-service)',
      (m) => {
        expect(getMeta(m)).toBeUndefined();
      },
    );
  });

  // ── Admin bypass ──────────────────────────────────────────────────────

  describe('Admin bypass on admin routes', () => {
    beforeEach(() => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
    });

    it('GET /notification-templates → 200; no permission DB lookup', async () => {
      await request(app.getHttpServer()).get('/notification-templates').expect(200);
      expect(mock.userPermission.findMany).not.toHaveBeenCalled();
      expect(mock.notificationTemplate.findMany).toHaveBeenCalled();
    });

    it('POST /notification-templates → 201; template.upsert called', async () => {
      await request(app.getHttpServer())
        .post('/notification-templates')
        .send({
          code: 'visit_approved',
          channel: 'IN_APP',
          subject: { ar: 'تم', en: 'Approved' },
          body: { ar: 'تم اعتماد الزيارة', en: 'Your visit has been approved' },
          active: true,
        })
        .expect(201);
      expect(mock.notificationTemplate.upsert).toHaveBeenCalledTimes(1);
    });

    it('POST /notification-templates with emailEnabled:true → 201; emailEnabled passed to upsert', async () => {
      await request(app.getHttpServer())
        .post('/notification-templates')
        .send({
          code: 'deposit_recorded',
          channel: 'PUSH',
          ar_subject: 'تم تسجيل دفعة',
          en_subject: 'Deposit recorded',
          ar_body: 'نص',
          en_body: 'Body',
          emailEnabled: true,
        })
        .expect(201);
      expect(mock.notificationTemplate.upsert).toHaveBeenCalledTimes(1);
      const upsertCall = mock.notificationTemplate.upsert.mock.calls[0]![0] as {
        create: { emailEnabled: boolean };
        update: { emailEnabled: boolean | undefined };
      };
      expect(upsertCall.create.emailEnabled).toBe(true);
      expect(upsertCall.update.emailEnabled).toBe(true);
    });

    it('cross-tenant code conflict → 403; upsert NOT called even when emailEnabled is in payload', async () => {
      // $queryRaw returns a companyId that is not the current tenant's ('test-company-id')
      mock.$queryRaw.mockResolvedValueOnce([{ companyId: 'other-company-id' }]);
      await request(app.getHttpServer())
        .post('/notification-templates')
        .send({
          code: 'deposit_recorded',
          channel: 'PUSH',
          ar_subject: 'تم',
          en_subject: 'Done',
          ar_body: 'نص',
          en_body: 'Body',
          emailEnabled: true,
        })
        .expect(403);
      expect(mock.notificationTemplate.upsert).not.toHaveBeenCalled();
    });

    it('POST /notifications/send → 201; template lookup + notification.create both run', async () => {
      await request(app.getHttpServer())
        .post('/notifications/send')
        .send({
          userId: 'a1111111-1111-4111-8111-111111111111',
          templateCode: 'visit_approved',
          payload: { visitId: 'v1' },
        })
        .expect(201);
      expect(mock.notificationTemplate.findUnique).toHaveBeenCalledTimes(1);
      expect(mock.notification.create).toHaveBeenCalledTimes(1);
    });
  });

  // ── Self-service routes ──────────────────────────────────────────────

  describe('Self-service /me/* routes (no permission required)', () => {
    it('CUSTOMER with zero permissions → 200 on GET /me/notifications; scoped to user.sub', async () => {
      FakeAuthGuard.currentUser = { sub: 'cust-1', role: UserRole.CUSTOMER, codes: [] };
      await request(app.getHttpServer()).get('/me/notifications').expect(200);
      expect(mock.userPermission.findMany).not.toHaveBeenCalled();
      const call = mock.notification.findMany.mock.calls[0]![0] as { where: { userId: string } };
      expect(call.where.userId).toBe('cust-1');
    });

    it('BROKER with zero permissions → 200 on PATCH /me/notifications/read-all; scoped to user.sub', async () => {
      FakeAuthGuard.currentUser = { sub: 'broker-1', role: UserRole.BROKER, codes: [] };
      await request(app.getHttpServer()).patch('/me/notifications/read-all').expect(200);
      expect(mock.notification.updateMany).toHaveBeenCalledTimes(1);
      const call = mock.notification.updateMany.mock.calls[0]![0] as {
        where: { userId: string };
      };
      expect(call.where.userId).toBe('broker-1');
    });

    it('SALES with zero permissions → 201 on POST /me/devices; deviceToken.upsert called for user.sub', async () => {
      FakeAuthGuard.currentUser = { sub: 'sales-1', role: UserRole.SALES, codes: [] };
      await request(app.getHttpServer())
        .post('/me/devices')
        .send({ token: 'fcm-abc-123', platform: 'web' })
        .expect(201);
      expect(mock.deviceToken.upsert).toHaveBeenCalledTimes(1);
      const call = mock.deviceToken.upsert.mock.calls[0]![0] as {
        create: { userId: string };
      };
      expect(call.create.userId).toBe('sales-1');
    });

    it('unauthenticated GET /me/notifications → 403', async () => {
      FakeAuthGuard.currentUser = null;
      await request(app.getHttpServer()).get('/me/notifications').expect(403);
    });
  });

  // ── Role enforcement on admin routes ──────────────────────────────────

  describe('SALES blocked at @Roles on admin routes', () => {
    it('SALES even with notifications:templates:manage → 403 on POST /notification-templates; upsert NOT called', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['notifications:templates:manage'],
      };
      await request(app.getHttpServer())
        .post('/notification-templates')
        .send({
          code: 'x',
          channel: 'IN_APP',
          subject: { ar: '', en: '' },
          body: { ar: '', en: '' },
        })
        .expect(403);
      expect(mock.userPermission.findMany).not.toHaveBeenCalled();
      expect(mock.notificationTemplate.upsert).not.toHaveBeenCalled();
    });

    it('SALES even with notifications:send → 403 on POST /notifications/send; template lookup + create NOT called', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['notifications:send'],
      };
      await request(app.getHttpServer())
        .post('/notifications/send')
        .send({
          userId: 'a1111111-1111-4111-8111-111111111111',
          templateCode: 'visit_approved',
        })
        .expect(403);
      expect(mock.notificationTemplate.findUnique).not.toHaveBeenCalled();
      expect(mock.notification.create).not.toHaveBeenCalled();
    });
  });

  // ── Broadcast endpoints ───────────────────────────────────────────────────

  describe('Admin broadcast endpoints (ADMIN-only)', () => {
    const BROADCAST_BODY = {
      title_ar: 'عنوان',
      title_en: 'Title',
      body_ar: 'نص',
      body_en: 'Body',
      target: 'ALL_CUSTOMERS',
      channel: 'IN_APP',
    };

    it('ADMIN → 201 on POST /notifications/broadcast; notification.create called', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer())
        .post('/notifications/broadcast')
        .send(BROADCAST_BODY)
        .expect(201);
      expect(mock.notification.create).toHaveBeenCalled();
    });

    it('ADMIN → 201 on POST /notifications/broadcast/preview; notification.create NOT called', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      mock.notification.create.mockClear();
      await request(app.getHttpServer())
        .post('/notifications/broadcast/preview')
        .send({ target: 'ALL_CUSTOMERS' })
        .expect(201);
      expect(mock.notification.create).not.toHaveBeenCalled();
    });

    it('SALES (with notifications:send) → 403 on POST /notifications/broadcast', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['notifications:send'],
      };
      await request(app.getHttpServer())
        .post('/notifications/broadcast')
        .send(BROADCAST_BODY)
        .expect(403);
      expect(mock.notification.create).not.toHaveBeenCalled();
    });

    it('CUSTOMER with zero permissions → 403 on POST /notifications/broadcast', async () => {
      FakeAuthGuard.currentUser = { sub: 'cust-1', role: UserRole.CUSTOMER, codes: [] };
      await request(app.getHttpServer())
        .post('/notifications/broadcast')
        .send(BROADCAST_BODY)
        .expect(403);
    });

    it('BROKER with zero permissions → 403 on POST /notifications/broadcast/preview', async () => {
      FakeAuthGuard.currentUser = { sub: 'broker-1', role: UserRole.BROKER, codes: [] };
      await request(app.getHttpServer())
        .post('/notifications/broadcast/preview')
        .send({ target: 'ALL_CUSTOMERS' })
        .expect(403);
    });

    it('unauthenticated → 403 on POST /notifications/broadcast', async () => {
      FakeAuthGuard.currentUser = null;
      await request(app.getHttpServer())
        .post('/notifications/broadcast')
        .send(BROADCAST_BODY)
        .expect(403);
    });
  });

  // ── Business validation survives the gate ────────────────────────────

  describe('Business validation', () => {
    it('ADMIN bypass + POST /notifications/send with non-existent templateCode → fails; notification.create NOT called', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      fixture.templateExists = false;
      const res = await request(app.getHttpServer())
        .post('/notifications/send')
        .send({
          userId: 'a1111111-1111-4111-8111-111111111111',
          templateCode: 'no_such_template',
        });
      // The service throws a plain Error (not HttpException), so Nest surfaces 500.
      expect([400, 500]).toContain(res.status);
      expect(mock.notificationTemplate.findUnique).toHaveBeenCalledTimes(1);
      expect(mock.notification.create).not.toHaveBeenCalled();
    });
  });
});
