import { CanActivate, ExecutionContext, Global, INestApplication, Module } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { UserRole } from '@prisma/client';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';
import { ProjectsModule } from '../projects.module';
import { PlanLimitService } from '../../../common/capabilities/plan-limit.service';
import { ProjectsController } from '../projects.controller';
import { PhasesModule } from '../../phases/phases.module';
import { BuildingsModule } from '../../buildings/buildings.module';
import { MediaModule } from '../../media/media.module';
import { R2Service } from '../../media/r2.service';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  PERMISSIONS_KEY,
  type PermissionsMeta,
} from '../../../common/decorators/permissions.decorator';

/**
 * Combined permissions spec for the project-inventory surface:
 *   * projects.controller.ts (9 handlers: 2 public + 7 admin/sales)
 *   * phases.module.ts (5 handlers)
 *   * buildings.module.ts (5 handlers)
 *   * media.module.ts (5 handlers)
 *
 * Verifies:
 *   * Per-route metadata; @Public() preserved on the two browse routes.
 *   * ADMIN bypass on every gated route; no permission DB lookup.
 *   * SALES with projects:read can read projects/phases/buildings.
 *   * SALES without projects:read gets structured 403 on read routes.
 *   * SALES is blocked at @Roles on every admin-only mutation regardless
 *     of permission grants.
 *   * Public browsing routes are unauthenticated and ungated.
 */

interface FakeUser {
  sub: string;
  role: UserRole;
  codes: string[];
}

class FakeAuthGuard implements CanActivate {
  static currentUser: FakeUser | null = null;
  canActivate(context: ExecutionContext): boolean {
    const reflector = new Reflector();
    const isPublic = reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
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
    project: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue({
        id: 'p1',
        name: { ar: 'م', en: 'P' },
        status: 'PUBLISHED',
        updatedAt: new Date('2026-01-01'),
      }),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'p-new',
        ...data,
      })),
      update: jest.fn().mockImplementation(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => ({
        ...data,
        id: where.id,
      })),
      delete: jest.fn().mockResolvedValue({ id: 'p1' }),
    },
    projectMedia: {
      create: jest.fn().mockResolvedValue({ id: 'pm1' }),
      delete: jest.fn().mockResolvedValue({ id: 'pm1' }),
    },
    unitMedia: {
      create: jest.fn().mockResolvedValue({ id: 'um1' }),
      delete: jest.fn().mockResolvedValue({ id: 'um1' }),
    },
    phase: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue({ id: 'ph1' }),
      create: jest.fn().mockResolvedValue({ id: 'ph-new' }),
      update: jest.fn().mockResolvedValue({ id: 'ph1' }),
      delete: jest.fn().mockResolvedValue({ id: 'ph1' }),
    },
    building: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue({ id: 'b1' }),
      create: jest.fn().mockResolvedValue({ id: 'b-new' }),
      update: jest.fn().mockResolvedValue({ id: 'b1' }),
      delete: jest.fn().mockResolvedValue({ id: 'b1' }),
    },
    unit: {
      findUnique: jest.fn().mockResolvedValue({ id: 'u1' }),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    // Prisma surfaces consulted by ProjectsService.remove() for safety checks.
    reservation: { count: jest.fn().mockResolvedValue(0) },
    contract: { count: jest.fn().mockResolvedValue(0) },
    maintenanceRequest: { count: jest.fn().mockResolvedValue(0) },
    visitRequest: { count: jest.fn().mockResolvedValue(0) },
    $transaction: jest.fn().mockImplementation(async (ops: unknown) => {
      if (Array.isArray(ops)) return Promise.all(ops);
      return ops;
    }),
  };
}

const r2Mock = {
  createPresignedUpload: jest
    .fn()
    .mockResolvedValue({ url: 'https://r2.example.com/upload', key: 'k', publicUrl: 'https://cdn/x' }),
};

describe('Project surface · permissions enforcement (projects + phases + buildings + media)', () => {
  let app: INestApplication;
  let mock: ReturnType<typeof makePrismaMock>;
  let reflector: Reflector;

  beforeAll(async () => {
    mock = makePrismaMock();

    @Global()
    @Module({
      providers: [
        { provide: PrismaService, useValue: mock },
        { provide: PlanLimitService, useValue: { checkProjectLimit: jest.fn().mockResolvedValue(undefined) } },
      ],
      exports: [PrismaService, PlanLimitService],
    })
    class MockPrismaModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [MockPrismaModule, ProjectsModule, PhasesModule, BuildingsModule, MediaModule],
      providers: [
        Reflector,
        { provide: APP_GUARD, useClass: FakeAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
      ],
    })
      .overrideProvider(R2Service)
      .useValue(r2Mock)
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
    mock.userPermission.findMany.mockClear();
    mock.project.findMany.mockClear();
    mock.project.create.mockClear();
    mock.project.update.mockClear();
    mock.project.delete.mockClear();
    mock.phase.findMany.mockClear();
    mock.phase.create.mockClear();
    mock.building.findMany.mockClear();
    mock.building.create.mockClear();
    mock.projectMedia.create.mockClear();
    r2Mock.createPresignedUpload.mockClear();
  });

  // ── Internal controllers reached via Reflect.getMetadata ──────────────
  function controllerOf(moduleClass: unknown): new () => unknown {
    const controllers = Reflect.getMetadata('controllers', moduleClass as object) as Array<
      new () => unknown
    >;
    return controllers[0]!;
  }
  const ProjectsCtor = ProjectsController as unknown as new () => unknown; // exported, but DI ctor
  const PhasesCtor = controllerOf(PhasesModule);
  const BuildingsCtor = controllerOf(BuildingsModule);
  const MediaCtor = controllerOf(MediaModule);

  function getMeta(Ctor: new () => unknown, method: string): PermissionsMeta | undefined {
    const proto = Ctor.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;
    return reflector.get<PermissionsMeta | undefined>(PERMISSIONS_KEY, proto[method]!);
  }
  function isPublic(Ctor: new () => unknown, method: string): boolean | undefined {
    const proto = Ctor.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;
    return reflector.get<boolean | undefined>(IS_PUBLIC_KEY, proto[method]!);
  }

  // ── Projects controller metadata ──────────────────────────────────────

  describe('projects.controller.ts metadata', () => {
    it('publicList + publicGet — no permission metadata, @Public preserved', () => {
      expect(getMeta(ProjectsCtor, 'publicList')).toBeUndefined();
      expect(getMeta(ProjectsCtor, 'publicGet')).toBeUndefined();
      expect(isPublic(ProjectsCtor, 'publicList')).toBe(true);
      expect(isPublic(ProjectsCtor, 'publicGet')).toBe(true);
    });

    it.each<[string]>([['list'], ['get']])('%s → projects:read, bypass true', (m) => {
      expect(getMeta(ProjectsCtor, m)).toMatchObject({
        codes: ['projects:read'],
        adminBypass: true,
      });
    });
    it('create → projects:create', () => {
      expect(getMeta(ProjectsCtor, 'create')).toMatchObject({
        codes: ['projects:create'],
        adminBypass: true,
      });
    });
    it('update → projects:update', () => {
      expect(getMeta(ProjectsCtor, 'update')).toMatchObject({
        codes: ['projects:update'],
        adminBypass: true,
      });
    });
    it('remove → projects:delete', () => {
      expect(getMeta(ProjectsCtor, 'remove')).toMatchObject({
        codes: ['projects:delete'],
        adminBypass: true,
      });
    });
    it.each<[string]>([['publish'], ['archive']])('%s → projects:publish', (m) => {
      expect(getMeta(ProjectsCtor, m)).toMatchObject({
        codes: ['projects:publish'],
        adminBypass: true,
      });
    });
  });

  // ── Phases / Buildings / Media metadata ───────────────────────────────

  describe('phases / buildings / media metadata', () => {
    it.each<[string]>([['list'], ['get']])('phases.%s → projects:read', (m) => {
      expect(getMeta(PhasesCtor, m)).toMatchObject({
        codes: ['projects:read'],
        adminBypass: true,
      });
    });
    it.each<[string]>([['create'], ['update'], ['remove']])('phases.%s → phases:manage', (m) => {
      expect(getMeta(PhasesCtor, m)).toMatchObject({
        codes: ['phases:manage'],
        adminBypass: true,
      });
    });

    it.each<[string]>([['list'], ['get']])('buildings.%s → projects:read', (m) => {
      expect(getMeta(BuildingsCtor, m)).toMatchObject({
        codes: ['projects:read'],
        adminBypass: true,
      });
    });
    it.each<[string]>([['create'], ['update'], ['remove']])('buildings.%s → buildings:manage', (m) => {
      expect(getMeta(BuildingsCtor, m)).toMatchObject({
        codes: ['buildings:manage'],
        adminBypass: true,
      });
    });

    it.each<[string]>([
      ['presign'],
      ['attachProject'],
      ['attachUnit'],
      ['removeProject'],
      ['removeUnit'],
    ])('media.%s → project_media:manage', (m) => {
      expect(getMeta(MediaCtor, m)).toMatchObject({
        codes: ['project_media:manage'],
        adminBypass: true,
      });
    });
  });

  // ── Public routes — unauthenticated access ────────────────────────────

  describe('Public browse routes', () => {
    it('unauthenticated GET /public/projects → 200; no permission DB lookup', async () => {
      FakeAuthGuard.currentUser = null;
      await request(app.getHttpServer()).get('/public/projects').expect(200);
      expect(mock.userPermission.findMany).not.toHaveBeenCalled();
    });

    it('unauthenticated GET /public/projects/:id → 200', async () => {
      FakeAuthGuard.currentUser = null;
      await request(app.getHttpServer())
        .get('/public/projects/a1111111-1111-4111-8111-111111111111')
        .expect(200);
    });
  });

  // ── Read routes ───────────────────────────────────────────────────────

  describe('Read routes', () => {
    it('ADMIN bypasses GET /projects — no permission DB lookup', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer()).get('/projects').expect(200);
      expect(mock.userPermission.findMany).not.toHaveBeenCalled();
    });

    it('SALES with projects:read → 200 (projects + phases + buildings)', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['projects:read'],
      };
      await request(app.getHttpServer()).get('/projects').expect(200);
      await request(app.getHttpServer()).get('/phases').expect(200);
      await request(app.getHttpServer()).get('/buildings').expect(200);
    });

    it('SALES without projects:read → structured 403 on GET /projects', async () => {
      FakeAuthGuard.currentUser = { sub: 'sales-2', role: UserRole.SALES, codes: [] };
      const res = await request(app.getHttpServer()).get('/projects').expect(403);
      expect(res.body).toMatchObject({
        code: 'missing_permission',
        permissions: ['projects:read'],
      });
      // Service call never happened.
      expect(mock.project.findMany).not.toHaveBeenCalled();
    });

    it('SALES without projects:read → structured 403 on GET /phases (side-effect isolation)', async () => {
      FakeAuthGuard.currentUser = { sub: 'sales-2', role: UserRole.SALES, codes: [] };
      const res = await request(app.getHttpServer()).get('/phases').expect(403);
      expect(res.body).toMatchObject({
        code: 'missing_permission',
        permissions: ['projects:read'],
      });
      expect(mock.phase.findMany).not.toHaveBeenCalled();
    });

    it('unauthenticated GET /projects → 403', async () => {
      FakeAuthGuard.currentUser = null;
      await request(app.getHttpServer()).get('/projects').expect(403);
    });
  });

  // ── Admin mutations ───────────────────────────────────────────────────

  describe('Admin mutations', () => {
    const VALID_CREATE = { name: { ar: 'م', en: 'P' }, city: 'Riyadh', services: [] };

    it('ADMIN bypass on POST /projects → 201; project.create called', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer()).post('/projects').send(VALID_CREATE).expect(201);
      expect(mock.project.create).toHaveBeenCalled();
    });

    it('ADMIN bypass on PATCH /projects/:id/publish → 200', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer())
        .patch('/projects/a1111111-1111-4111-8111-111111111111/publish')
        .expect(200);
      expect(mock.project.update).toHaveBeenCalled();
    });

    it('ADMIN bypass on DELETE /projects/:id → 200', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer())
        .delete('/projects/a1111111-1111-4111-8111-111111111111')
        .expect(200);
      expect(mock.project.delete).toHaveBeenCalled();
    });

    it('SALES even with projects:update → 403 from @Roles', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['projects:update'],
      };
      await request(app.getHttpServer())
        .patch('/projects/a1111111-1111-4111-8111-111111111111')
        .send({ city: 'Jeddah' })
        .expect(403);
      expect(mock.userPermission.findMany).not.toHaveBeenCalled();
      expect(mock.project.update).not.toHaveBeenCalled();
    });

    it('SALES even with projects:delete → 403 from @Roles', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['projects:delete'],
      };
      await request(app.getHttpServer())
        .delete('/projects/a1111111-1111-4111-8111-111111111111')
        .expect(403);
      expect(mock.project.delete).not.toHaveBeenCalled();
    });
  });

  // ── Phases / Buildings / Media admin mutations ────────────────────────

  describe('Phases / Buildings / Media admin actions', () => {
    it('ADMIN bypass on POST /phases → 201; phase.create called', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer())
        .post('/phases')
        .send({
          projectId: 'a1111111-1111-4111-8111-111111111111',
          name: { ar: 'م', en: 'P' },
          order: 1,
        })
        .expect(201);
      expect(mock.phase.create).toHaveBeenCalled();
    });

    it('ADMIN bypass on POST /buildings → 201', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer())
        .post('/buildings')
        .send({
          phaseId: 'a1111111-1111-4111-8111-111111111111',
          name: 'B1',
          totalFloors: 5,
          order: 1,
        })
        .expect(201);
      expect(mock.building.create).toHaveBeenCalled();
    });

    it('ADMIN bypass on POST /media/presign → 201; R2Service called', async () => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
      await request(app.getHttpServer())
        .post('/media/presign')
        .send({ contentType: 'image/jpeg', folder: 'projects', sizeBytes: 1024 })
        .expect(201);
      expect(r2Mock.createPresignedUpload).toHaveBeenCalled();
    });

    it('SALES even with phases:manage → 403 from @Roles on POST /phases', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['phases:manage'],
      };
      await request(app.getHttpServer())
        .post('/phases')
        .send({ projectId: 'a1111111-1111-4111-8111-111111111111', name: { ar: 'م', en: 'P' }, order: 1 })
        .expect(403);
      expect(mock.userPermission.findMany).not.toHaveBeenCalled();
      expect(mock.phase.create).not.toHaveBeenCalled();
    });

    it('SALES even with buildings:manage → 403 from @Roles on POST /buildings', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['buildings:manage'],
      };
      await request(app.getHttpServer())
        .post('/buildings')
        .send({
          phaseId: 'a1111111-1111-4111-8111-111111111111',
          name: 'B1',
          totalFloors: 5,
          order: 1,
        })
        .expect(403);
      expect(mock.building.create).not.toHaveBeenCalled();
    });

    it('SALES even with project_media:manage → 403 from @Roles on POST /media/presign', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['project_media:manage'],
      };
      await request(app.getHttpServer())
        .post('/media/presign')
        .send({ contentType: 'image/jpeg', folder: 'projects', sizeBytes: 1024 })
        .expect(403);
      expect(r2Mock.createPresignedUpload).not.toHaveBeenCalled();
    });
  });
});
