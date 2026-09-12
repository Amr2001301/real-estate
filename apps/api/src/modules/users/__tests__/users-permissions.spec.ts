import { CanActivate, CallHandler, ExecutionContext, Global, INestApplication, Injectable, Module, NestInterceptor } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import request from 'supertest';
import { Observable } from 'rxjs';
import { UserRole } from '@prisma/client';
import { UsersModule } from '../users.module';
import { UsersController } from '../users.controller';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { enterTenantContext } from '../../../common/tenant/tenant-context';
import {
  PERMISSIONS_KEY,
  type PermissionsMeta,
} from '../../../common/decorators/permissions.decorator';

/**
 * Mirrors apps/api/src/modules/settings/__tests__/settings-permissions.spec.ts.
 * Verifies:
 *   * Every admin user-management route is annotated with the expected
 *     @Permissions code.
 *   * Self-profile routes (/users/me, PATCH /users/me) are NOT annotated.
 *   * ADMIN bypasses the permission gate (no DB call for permissions).
 *   * The guard chain returns the standard 403 from @Roles when a non-admin
 *     tries to hit an admin route.
 */

const TEST_COMPANY_ID = 'test-co-00000000-0000-4000-8000-000000000001';

// MT-003/MT-004/MT-005: UsersService now calls getRequiredCompanyId() on every
// data-access method. The real TenantContextInterceptor isn't wired in this test
// module (it reads from the JWT, which isn't set up here). This lightweight
// interceptor runs before the handler and injects a fake tenant context so the
// service layer doesn't throw MissingTenantContextError.
@Injectable()
class FakeTenantInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    enterTenantContext({ companyId: TEST_COMPANY_ID, bypass: false, isPublic: false });
    return next.handle();
  }
}

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

const FAKE_USER_ROW = {
  id: 'u1',
  email: 'someone@example.com',
  phone: null,
  fullName: 'Test User',
  role: UserRole.SALES,
  active: true,
  locale: 'ar',
  createdAt: new Date(),
  updatedAt: new Date(),
  lastLoginAt: null,
  deletedAt: null,
  managerId: null,
  manager: null,
  avatarUrl: null,
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
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      // MT-005: findOne now uses findFirst; me() routes through findOne.
      findFirst: jest.fn().mockResolvedValue(FAKE_USER_ROW),
      findUnique: jest.fn().mockResolvedValue(FAKE_USER_ROW),
      create: jest.fn(),
      update: jest.fn(),
    },
    // UsersService.findAll uses $transaction([findMany, count]).
    $transaction: jest.fn().mockImplementation(async (ops: unknown) => {
      if (Array.isArray(ops)) return Promise.all(ops);
      return ops;
    }),
  };
}

describe('Users module · permissions enforcement', () => {
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
      imports: [MockPrismaModule, ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), UsersModule],
      providers: [
        Reflector,
        { provide: APP_INTERCEPTOR, useClass: FakeTenantInterceptor },
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
    prismaMock.userPermission.findMany.mockClear();
  });

  // ── Wiring: per-route metadata ───────────────────────────────────────

  describe('@Permissions metadata on admin routes', () => {
    const proto = UsersController.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;
    function getMeta(method: string): PermissionsMeta | undefined {
      return reflector.get<PermissionsMeta | undefined>(PERMISSIONS_KEY, proto[method]!);
    }

    it.each<[string, string]>([
      ['create',     'users:create'],
      ['findAll',    'users:read'],
      ['findOne',    'users:read'],
      ['update',     'users:update'],
      ['activate',   'users:activate'],
      ['deactivate', 'users:deactivate'],
    ])('%s → @Permissions(%s)', (method, code) => {
      expect(getMeta(method)).toMatchObject({ codes: [code], adminBypass: true });
    });
  });

  describe('self-profile routes are NOT permission-gated', () => {
    const proto = UsersController.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;
    function getMeta(method: string): PermissionsMeta | undefined {
      return Reflect.getMetadata(PERMISSIONS_KEY, proto[method]!) as PermissionsMeta | undefined;
    }

    it('GET /users/me has no @Permissions', () => {
      expect(getMeta('me')).toBeUndefined();
    });
    it('PATCH /users/me has no @Permissions', () => {
      expect(getMeta('updateMe')).toBeUndefined();
    });
  });

  // ── End-to-end: ADMIN bypass + role gate ─────────────────────────────

  describe('GET /users (admin route)', () => {
    it('allows ADMIN without consulting userPermission table', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer()).get('/users').expect(200);
      expect(prismaMock.userPermission.findMany).not.toHaveBeenCalled();
    });

    it('rejects a SALES user at the @Roles layer (before permissions)', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['users:read'], // even with the code, @Roles(ADMIN) blocks
      };
      const res = await request(app.getHttpServer()).get('/users').expect(403);
      expect(res.body.message).toBe('Insufficient role');
      // PermissionsGuard never ran — RolesGuard short-circuited.
      expect(prismaMock.userPermission.findMany).not.toHaveBeenCalled();
    });

    it('rejects an unauthenticated request', async () => {
      FakeAuthGuard.currentUser = null;
      await request(app.getHttpServer()).get('/users').expect(403);
    });
  });

  describe('GET /users/me (self route)', () => {
    it('allows any authenticated SALES user — no role, no permission', async () => {
      FakeAuthGuard.currentUser = { sub: 'sales-1', role: UserRole.SALES, codes: [] };
      await request(app.getHttpServer()).get('/users/me').expect(200);
      // confirms PermissionsGuard didn't fire on the self route
      expect(prismaMock.userPermission.findMany).not.toHaveBeenCalled();
    });

    it('allows a CUSTOMER — self route is open to every authenticated role', async () => {
      FakeAuthGuard.currentUser = { sub: 'cust-1', role: UserRole.CUSTOMER, codes: [] };
      await request(app.getHttpServer()).get('/users/me').expect(200);
    });
  });
});
