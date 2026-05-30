import { CanActivate, ExecutionContext, Global, INestApplication, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { UserRole } from '@prisma/client';
import { DepositsModule } from '../deposits.module';
import { DocumentsService } from '../../documents/documents.module';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { PrismaService } from '../../../common/prisma/prisma.service';

// DepositsModule imports DocumentsModule; override the service so tests never
// touch R2, and ConfigModule satisfies the (unused-here) R2/Config deps.
const documentsMock = { create: jest.fn().mockResolvedValue({ id: 'doc-1' }) };
import {
  PERMISSIONS_KEY,
  type PermissionsMeta,
} from '../../../common/decorators/permissions.decorator';

/**
 * First batch that exercises @PermissionsStrict over HTTP — the PATCH verify
 * route requires deposits:verify even from an ADMIN. This is the first place
 * the structured 403 body from PermissionsGuard surfaces in an integration
 * test instead of only in a guard unit test.
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
  const zero = () => jest.fn().mockResolvedValue(0);
  const emptyArr = () => jest.fn().mockResolvedValue([]);
  const sumZero = () => jest.fn().mockResolvedValue({ _sum: { amount: 0 } });

  return {
    userPermission: {
      findMany: jest.fn().mockImplementation(async () => {
        const u = FakeAuthGuard.currentUser;
        return (u?.codes ?? []).map((code) => ({ permission: { code } }));
      }),
    },
    deposit: {
      findMany: emptyArr(),
      count: zero(),
      aggregate: sumZero(),
      groupBy: jest.fn().mockResolvedValue([]),
      // P11 — verify() now reads the row first to keep reviewStatus in
      // lockstep. Provide a no-op default so existing perms tests still pass.
      findUnique: jest.fn().mockImplementation(async ({ where }) => ({
        id: where.id,
        receiptUrl: null,
        reviewStatus: 'NO_PROOF',
      })),
      update: jest.fn().mockImplementation(async ({ where, data }) => ({
        id: where.id,
        ...data,
        amount: '0',
        paidAt: new Date(),
        type: 'BOOKING_AMOUNT',
      })),
    },
    $transaction: jest.fn().mockImplementation(async (ops: unknown) => {
      if (Array.isArray(ops)) return Promise.all(ops);
      return ops;
    }),
  };
}

describe('Deposits module · permissions enforcement', () => {
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
      imports: [ConfigModule.forRoot({ isGlobal: true }), MockPrismaModule, DepositsModule],
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
    prismaMock.userPermission.findMany.mockClear();
    prismaMock.deposit.update.mockClear();
  });

  // ── Metadata: per-route mapping ─────────────────────────────────────────

  describe('@Permissions metadata', () => {
    const controllers = Reflect.getMetadata('controllers', DepositsModule) as Array<
      new () => unknown
    >;
    const Ctor = controllers[0]!;
    const proto = Ctor.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;

    function getMeta(method: string): PermissionsMeta | undefined {
      return reflector.get<PermissionsMeta | undefined>(PERMISSIONS_KEY, proto[method]!);
    }

    it('record (POST /deposits) → deposits:register, adminBypass true', () => {
      expect(getMeta('record')).toMatchObject({
        codes: ['deposits:register'],
        adminBypass: true,
      });
    });
    it('list (GET /deposits) → deposits:read, adminBypass true', () => {
      expect(getMeta('list')).toMatchObject({
        codes: ['deposits:read'],
        adminBypass: true,
      });
    });
    it('verify (PATCH /deposits/:id/verify) → deposits:verify, adminBypass FALSE (strict)', () => {
      expect(getMeta('verify')).toMatchObject({
        codes: ['deposits:verify'],
        adminBypass: false,
      });
    });
    it('myDeposits (GET /me/deposits) → no permission metadata (customer self-route)', () => {
      expect(getMeta('myDeposits')).toBeUndefined();
    });
    it('findOne (GET /deposits/:id) → deposits:read, adminBypass true', () => {
      expect(getMeta('findOne')).toMatchObject({ codes: ['deposits:read'], adminBypass: true });
    });
    it('attachReceipt (POST /deposits/:id/receipt) → deposits:register, adminBypass true', () => {
      expect(getMeta('attachReceipt')).toMatchObject({ codes: ['deposits:register'], adminBypass: true });
    });
  });

  // ── New document routes — role gating ─────────────────────────────────
  describe('Deposit document routes (Batch B)', () => {
    const ID = '00000000-0000-0000-0000-000000000001';

    it('SALES is blocked from POST /deposits/:id/receipt at @Roles (admin-only)', async () => {
      FakeAuthGuard.currentUser = { sub: 'sales-1', role: UserRole.SALES, codes: ['deposits:register'] };
      const res = await request(app.getHttpServer())
        .post(`/deposits/${ID}/receipt`)
        .send({ receiptUrl: 'https://cdn.example/r.pdf' })
        .expect(403);
      expect(res.body.message).toBe('Insufficient role');
      expect(prismaMock.userPermission.findMany).not.toHaveBeenCalled();
    });

    it('SALES is blocked from GET /deposits/:id at @Roles (detail is admin-only)', async () => {
      FakeAuthGuard.currentUser = { sub: 'sales-2', role: UserRole.SALES, codes: ['deposits:read'] };
      const res = await request(app.getHttpServer()).get(`/deposits/${ID}`).expect(403);
      expect(res.body.message).toBe('Insufficient role');
    });

    it('CUSTOMER is blocked from GET /deposits/:id at @Roles', async () => {
      FakeAuthGuard.currentUser = { sub: 'cust-1', role: UserRole.CUSTOMER, codes: [] };
      await request(app.getHttpServer()).get(`/deposits/${ID}`).expect(403);
    });
  });

  // ── GET /deposits  (role allows ADMIN + SALES; permission gates each) ─

  describe('GET /deposits', () => {
    it('ADMIN bypasses — no permission DB lookup', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer()).get('/deposits').expect(200);
      expect(prismaMock.userPermission.findMany).not.toHaveBeenCalled();
    });

    it('SALES WITH deposits:read is allowed (single permission DB lookup)', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['deposits:read'],
      };
      await request(app.getHttpServer()).get('/deposits').expect(200);
      expect(prismaMock.userPermission.findMany).toHaveBeenCalledTimes(1);
    });

    it('SALES WITHOUT deposits:read returns structured 403', async () => {
      FakeAuthGuard.currentUser = { sub: 'sales-2', role: UserRole.SALES, codes: [] };
      const res = await request(app.getHttpServer()).get('/deposits').expect(403);
      expect(res.body).toMatchObject({
        code: 'missing_permission',
        permissions: ['deposits:read'],
      });
    });

    it('rejects unauthenticated requests', async () => {
      FakeAuthGuard.currentUser = null;
      await request(app.getHttpServer()).get('/deposits').expect(403);
    });
  });

  // ── POST /deposits  (admin-only at @Roles layer) ──────────────────────

  describe('POST /deposits', () => {
    it('rejects SALES even when deposits:register is granted (blocked by @Roles)', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['deposits:register'],
      };
      const res = await request(app.getHttpServer())
        .post('/deposits')
        .send({})
        .expect(403);
      expect(res.body.message).toBe('Insufficient role');
      // PermissionsGuard never ran.
      expect(prismaMock.userPermission.findMany).not.toHaveBeenCalled();
    });
  });

  // ── PATCH /deposits/:id/verify  (STRICT — first HTTP-level strict test) ─

  describe('PATCH /deposits/:id/verify (strict)', () => {
    const PATH = '/deposits/00000000-0000-0000-0000-000000000001/verify';

    it('ADMIN WITHOUT deposits:verify returns structured 403 from PermissionsGuard', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      const res = await request(app.getHttpServer())
        .patch(PATH)
        .send({ verified: true })
        .expect(403);
      expect(res.body).toMatchObject({
        code: 'missing_permission',
        permissions: ['deposits:verify'],
      });
      // PermissionsGuard DID query the DB — strict mode means no admin bypass.
      expect(prismaMock.userPermission.findMany).toHaveBeenCalledTimes(1);
      // The handler was never reached.
      expect(prismaMock.deposit.update).not.toHaveBeenCalled();
    });

    it('ADMIN WITH deposits:verify can verify', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'admin-2',
        role: UserRole.ADMIN,
        codes: ['deposits:verify'],
      };
      await request(app.getHttpServer())
        .patch(PATH)
        .send({ verified: true })
        .expect(200);
      expect(prismaMock.deposit.update).toHaveBeenCalledTimes(1);
    });

    it('SALES is rejected at @Roles before permissions are consulted', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['deposits:verify'],
      };
      const res = await request(app.getHttpServer())
        .patch(PATH)
        .send({ verified: true })
        .expect(403);
      expect(res.body.message).toBe('Insufficient role');
      expect(prismaMock.userPermission.findMany).not.toHaveBeenCalled();
    });
  });

  // ── GET /me/deposits  (customer self-route, unguarded by permissions) ─

  describe('GET /me/deposits (customer self-route)', () => {
    it('allows CUSTOMER without any permission grants', async () => {
      FakeAuthGuard.currentUser = { sub: 'cust-1', role: UserRole.CUSTOMER, codes: [] };
      await request(app.getHttpServer()).get('/me/deposits').expect(200);
      expect(prismaMock.userPermission.findMany).not.toHaveBeenCalled();
    });

    it('rejects ADMIN at @Roles (route is CUSTOMER-only)', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer()).get('/me/deposits').expect(403);
    });
  });
});
