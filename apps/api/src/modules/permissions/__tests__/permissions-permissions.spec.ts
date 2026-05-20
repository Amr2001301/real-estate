import { CanActivate, ExecutionContext, Global, INestApplication, Module } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { UserRole } from '@prisma/client';
import { PermissionsModule } from '../permissions.module';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  PERMISSIONS_KEY,
  type PermissionsMeta,
} from '../../../common/decorators/permissions.decorator';

/**
 * The PermissionsController class is declared internally inside
 * permissions.module.ts and is not exported. We reach it via the module's
 * `controllers` metadata so this test doesn't depend on file layout.
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
      groupBy: jest.fn().mockResolvedValue([]),
    },
    permission: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    $transaction: jest.fn().mockImplementation(async (ops: unknown) => {
      if (Array.isArray(ops)) return Promise.all(ops);
      // callback form — service only uses it inside updateForUser
      return ops;
    }),
  };
}

describe('Permissions module · permissions enforcement', () => {
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
      imports: [MockPrismaModule, PermissionsModule],
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
    prismaMock.userPermission.findMany.mockClear();
  });

  // ── Metadata: every handler must require permissions:manage ──────────

  describe('@Permissions metadata on every route', () => {
    const controllers = Reflect.getMetadata('controllers', PermissionsModule) as Array<
      new () => unknown
    >;
    const Ctor = controllers[0]!;
    const proto = Ctor.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;

    function getMeta(method: string): PermissionsMeta | undefined {
      return reflector.get<PermissionsMeta | undefined>(PERMISSIONS_KEY, proto[method]!);
    }

    it.each<[string]>([['list'], ['listForUser'], ['updateForUser']])(
      '%s → @Permissions(permissions:manage)',
      (method) => {
        expect(getMeta(method)).toMatchObject({
          codes: ['permissions:manage'],
          adminBypass: true,
        });
      },
    );
  });

  // ── End-to-end ───────────────────────────────────────────────────────

  describe('GET /permissions', () => {
    it('allows ADMIN by bypass (no DB read for permissions)', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer()).get('/permissions').expect(200);
      expect(prismaMock.userPermission.findMany).not.toHaveBeenCalled();
    });

    it('rejects a SALES user at the @Roles layer', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['permissions:manage'],
      };
      const res = await request(app.getHttpServer()).get('/permissions').expect(403);
      expect(res.body.message).toBe('Insufficient role');
      expect(prismaMock.userPermission.findMany).not.toHaveBeenCalled();
    });

    it('rejects unauthenticated requests', async () => {
      FakeAuthGuard.currentUser = null;
      await request(app.getHttpServer()).get('/permissions').expect(403);
    });
  });
});
