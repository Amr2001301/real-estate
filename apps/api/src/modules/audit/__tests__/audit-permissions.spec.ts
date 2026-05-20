import { CanActivate, ExecutionContext, Global, INestApplication, Module } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { UserRole } from '@prisma/client';
import { AuditModule } from '../audit.module';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  PERMISSIONS_KEY,
  type PermissionsMeta,
} from '../../../common/decorators/permissions.decorator';

/**
 * Verifies:
 *   * Every audit route carries @Permissions('audit:read') with adminBypass.
 *   * ADMIN traffic bypasses the permission gate (no DB call for permissions).
 *   * Non-admin traffic is blocked at the @Roles layer before the permission
 *     gate is consulted.
 *   * Unauthenticated traffic is rejected.
 *
 * The AuditController class is internal to audit.module.ts (not exported),
 * so we discover it through the module's `controllers` metadata.
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
  const emptyGroupBy = jest.fn().mockResolvedValue([]);
  const countResolvingZero = jest.fn().mockResolvedValue(0);

  return {
    userPermission: {
      findMany: jest.fn().mockImplementation(async () => {
        const u = FakeAuthGuard.currentUser;
        return (u?.codes ?? []).map((code) => ({ permission: { code } }));
      }),
    },
    auditLog: {
      findMany: jest.fn().mockResolvedValue([]),
      count: countResolvingZero,
      findUnique: jest.fn().mockResolvedValue(null),
      groupBy: emptyGroupBy,
    },
    user: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    // AuditService.list / .summary both use $transaction([…]).
    $transaction: jest.fn().mockImplementation(async (ops: unknown) => {
      if (Array.isArray(ops)) return Promise.all(ops);
      return ops;
    }),
  };
}

describe('Audit module · permissions enforcement', () => {
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
      imports: [MockPrismaModule, AuditModule],
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

  // ── Metadata: every audit handler must require audit:read ─────────────

  describe('@Permissions metadata on every route', () => {
    const controllers = Reflect.getMetadata('controllers', AuditModule) as Array<
      new () => unknown
    >;
    const Ctor = controllers[0]!;
    const proto = Ctor.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;

    function getMeta(method: string): PermissionsMeta | undefined {
      return reflector.get<PermissionsMeta | undefined>(PERMISSIONS_KEY, proto[method]!);
    }

    it.each<[string]>([['list'], ['findOne'], ['summary']])(
      '%s → @Permissions(audit:read)',
      (method) => {
        expect(getMeta(method)).toMatchObject({
          codes: ['audit:read'],
          adminBypass: true,
        });
      },
    );
  });

  // ── End-to-end via GET /audit-logs ─────────────────────────────────────

  describe('GET /audit-logs', () => {
    it('allows ADMIN — no permission DB lookup (bypass)', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer()).get('/audit-logs').expect(200);
      expect(prismaMock.userPermission.findMany).not.toHaveBeenCalled();
    });

    it('rejects SALES at the @Roles layer (permission DB never queried)', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['audit:read'], // even with the code, @Roles(ADMIN) blocks
      };
      const res = await request(app.getHttpServer()).get('/audit-logs').expect(403);
      expect(res.body.message).toBe('Insufficient role');
      expect(prismaMock.userPermission.findMany).not.toHaveBeenCalled();
    });

    it('rejects unauthenticated requests', async () => {
      FakeAuthGuard.currentUser = null;
      await request(app.getHttpServer()).get('/audit-logs').expect(403);
    });
  });

  // ── End-to-end via GET /operations/summary ─────────────────────────────

  describe('GET /operations/summary', () => {
    it('allows ADMIN — no permission DB lookup (bypass)', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer()).get('/operations/summary').expect(200);
      expect(prismaMock.userPermission.findMany).not.toHaveBeenCalled();
    });

    it('rejects a CUSTOMER at the @Roles layer', async () => {
      FakeAuthGuard.currentUser = { sub: 'cust-1', role: UserRole.CUSTOMER, codes: ['audit:read'] };
      await request(app.getHttpServer()).get('/operations/summary').expect(403);
      expect(prismaMock.userPermission.findMany).not.toHaveBeenCalled();
    });
  });
});
