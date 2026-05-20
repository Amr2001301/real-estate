import { CanActivate, ExecutionContext, Global, INestApplication, Module } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { UserRole } from '@prisma/client';
import { SettingsModule } from '../settings.module';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { PERMISSIONS_KEY, type PermissionsMeta } from '../../../common/decorators/permissions.decorator';

/**
 * Integration test for the settings module. Verifies that:
 *   * The full guard chain (FakeAuth → Roles → Permissions) is wired
 *     correctly for an ADMIN caller — production behavior preserved.
 *   * The @Permissions metadata is actually set on every settings handler
 *     (so a future refactor that removes the decorator would fail this test).
 *
 * The SALES-rejected-by-permissions case is covered exhaustively in
 * `apps/api/src/common/guards/__tests__/permissions.guard.spec.ts`.
 * Here we'd need to remove @Roles(ADMIN) to exercise that path, which we
 * deliberately don't (production behavior is the source of truth).
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
    setting: {
      findMany: jest.fn().mockResolvedValue([
        { key: 'system.locale', value: { en: 'en' }, updatedAt: new Date() },
      ]),
      findUnique: jest.fn().mockResolvedValue({
        key: 'system.locale',
        value: { en: 'en' },
        updatedAt: new Date(),
      }),
      upsert: jest.fn().mockImplementation(({ where, update, create }) => ({
        key: where.key,
        value: update.value ?? create.value,
        updatedAt: new Date(),
      })),
    },
  };
}

describe('Settings module · permissions enforcement', () => {
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
      imports: [MockPrismaModule, SettingsModule],
      providers: [
        Reflector,
        // Register FakeAuthGuard directly — easier than overriding JwtAuthGuard,
        // which extends AuthGuard('jwt') and pulls in the full passport setup.
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

  // ── Wiring: the decorator must be on every settings handler ──────────

  describe('@Permissions metadata is applied to every route', () => {
    type Handler = (...args: unknown[]) => unknown;
    function getMeta(handler: Handler): PermissionsMeta | undefined {
      return reflector.get<PermissionsMeta | undefined>(PERMISSIONS_KEY, handler);
    }

    it('GET /settings → settings:read', () => {
      const proto = Object.getPrototypeOf(getController('list'));
      expect(getMeta(proto.list)).toMatchObject({
        codes: ['settings:read'],
        adminBypass: true,
      });
    });
    it('GET /settings/:key → settings:read', () => {
      const proto = Object.getPrototypeOf(getController('get'));
      expect(getMeta(proto.get)).toMatchObject({ codes: ['settings:read'] });
    });
    it('PUT /settings/:key → settings:write', () => {
      const proto = Object.getPrototypeOf(getController('upsert'));
      expect(getMeta(proto.upsert)).toMatchObject({ codes: ['settings:write'] });
    });
    it('PATCH /settings/:key → settings:write', () => {
      const proto = Object.getPrototypeOf(getController('patch'));
      expect(getMeta(proto.patch)).toMatchObject({ codes: ['settings:write'] });
    });
  });

  // ── End-to-end: full guard chain accepts ADMIN ───────────────────────

  describe('GET /settings', () => {
    it('allows ADMIN — and does NOT call userPermission.findMany (bypass)', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer()).get('/settings').expect(200);
      expect(prismaMock.userPermission.findMany).not.toHaveBeenCalled();
    });

    it('rejects an unauthenticated request', async () => {
      FakeAuthGuard.currentUser = null;
      await request(app.getHttpServer()).get('/settings').expect(403);
    });

    it('rejects a SALES user (blocked by @Roles before permissions)', async () => {
      FakeAuthGuard.currentUser = { sub: 'sales-1', role: UserRole.SALES, codes: ['settings:read'] };
      const res = await request(app.getHttpServer()).get('/settings').expect(403);
      // RolesGuard fires first, so the body is its generic "Insufficient role".
      expect(res.body.message).toBe('Insufficient role');
    });
  });

  describe('PATCH /settings/:key', () => {
    it('allows ADMIN (bypass)', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer())
        .patch('/settings/system.locale')
        .send({ value: { en: 'en', ar: 'ar' } })
        .expect(200);
    });

    it('rejects SALES at the @Roles layer', async () => {
      FakeAuthGuard.currentUser = { sub: 'sales-1', role: UserRole.SALES, codes: ['settings:write'] };
      await request(app.getHttpServer())
        .patch('/settings/system.locale')
        .send({ value: { en: 'en' } })
        .expect(403);
    });
  });
});

// Tiny helper to grab the SettingsController instance via the
// SettingsModule's controllers list — used purely so the metadata test
// doesn't depend on the controller being exported from the module file.
function getController(_methodName: string): unknown {
  // The controller is registered with NestJS internally; we read the
  // metadata via the SettingsModule's declared class. To find it, we walk
  // the module's metadata via Reflect.
  const controllers = Reflect.getMetadata('controllers', SettingsModule) as unknown[] | undefined;
  if (!controllers || controllers.length === 0) {
    throw new Error('SettingsModule has no registered controllers');
  }
  // Construct an instance via the class to expose the prototype.
  const Ctor = controllers[0] as new () => unknown;
  return new Ctor();
}
