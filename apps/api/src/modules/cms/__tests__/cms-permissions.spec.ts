import { CanActivate, ExecutionContext, Global, INestApplication, Module } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { UserRole } from '@prisma/client';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';
import { CmsModule } from '../cms.module';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  PERMISSIONS_KEY,
  type PermissionsMeta,
} from '../../../common/decorators/permissions.decorator';

/**
 * Verifies the CMS permissions rollout:
 *   * Per-route metadata; @Public preserved on the four browse routes.
 *   * ADMIN bypass on every admin route; no permission DB lookup.
 *   * SALES is blocked at @Roles on every admin route even with the
 *     matching permission code; service is never invoked.
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
    cmsPage: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue({
        id: 'page-1',
        slug: 'about',
        title: { ar: 'عن الشركة', en: 'About' },
        body: { ar: '', en: '' },
        published: true,
      }),
      upsert: jest.fn().mockImplementation(async ({ where, create, update }) => ({
        id: 'page-new',
        slug: where.slug,
        ...create,
        ...update,
      })),
    },
    banner: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'banner-new',
        ...data,
      })),
      delete: jest.fn().mockResolvedValue({ id: 'banner-1' }),
    },
    article: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue({
        id: 'article-1',
        slug: 'news',
        title: { ar: 'خبر', en: 'News' },
        excerpt: { ar: '', en: '' },
        body: { ar: '', en: '' },
        published: true,
      }),
      upsert: jest.fn().mockImplementation(async ({ where, create, update }) => ({
        id: 'article-new',
        slug: where.slug,
        ...create,
        ...update,
      })),
    },
    $transaction: jest.fn().mockImplementation(async (ops: unknown) => {
      if (Array.isArray(ops)) return Promise.all(ops);
      return ops;
    }),
  };
}

describe('CMS module · permissions enforcement', () => {
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
      imports: [MockPrismaModule, CmsModule],
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
    mock.userPermission.findMany.mockClear();
    mock.cmsPage.upsert.mockClear();
    mock.banner.create.mockClear();
    mock.banner.delete.mockClear();
    mock.article.upsert.mockClear();
  });

  // ── Internal controller reached via Reflect.getMetadata ───────────────
  const controllers = Reflect.getMetadata('controllers', CmsModule) as Array<
    new () => unknown
  >;
  const Ctor = controllers[0]!;
  const proto = Ctor.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;

  function getMeta(method: string): PermissionsMeta | undefined {
    return reflector.get<PermissionsMeta | undefined>(PERMISSIONS_KEY, proto[method]!);
  }
  function isPublic(method: string): boolean | undefined {
    return reflector.get<boolean | undefined>(IS_PUBLIC_KEY, proto[method]!);
  }

  // ── Metadata ───────────────────────────────────────────────────────────

  describe('@Permissions metadata', () => {
    it.each<[string]>([
      ['publicBanners'],
      ['publicPage'],
      ['publicArticles'],
      ['publicArticle'],
    ])('%s — no permission metadata, @Public preserved', (m) => {
      expect(getMeta(m)).toBeUndefined();
      expect(isPublic(m)).toBe(true);
    });

    it.each<[string]>([['listPages'], ['upsertPage']])(
      '%s → cms:pages:manage, bypass true',
      (m) => {
        expect(getMeta(m)).toMatchObject({
          codes: ['cms:pages:manage'],
          adminBypass: true,
        });
      },
    );

    it.each<[string]>([['listBanners'], ['createBanner'], ['removeBanner']])(
      '%s → cms:banners:manage, bypass true',
      (m) => {
        expect(getMeta(m)).toMatchObject({
          codes: ['cms:banners:manage'],
          adminBypass: true,
        });
      },
    );

    it.each<[string]>([['listArticles'], ['upsertArticle']])(
      '%s → cms:articles:manage, bypass true',
      (m) => {
        expect(getMeta(m)).toMatchObject({
          codes: ['cms:articles:manage'],
          adminBypass: true,
        });
      },
    );
  });

  // ── Public routes ─────────────────────────────────────────────────────

  describe('Public browse routes', () => {
    it('unauthenticated GET /public/banners → 200; no permission DB lookup', async () => {
      FakeAuthGuard.currentUser = null;
      await request(app.getHttpServer()).get('/public/banners').expect(200);
      expect(mock.userPermission.findMany).not.toHaveBeenCalled();
    });

    it('unauthenticated GET /public/pages/:slug → 200', async () => {
      FakeAuthGuard.currentUser = null;
      await request(app.getHttpServer()).get('/public/pages/about').expect(200);
      expect(mock.userPermission.findMany).not.toHaveBeenCalled();
    });

    it('unauthenticated GET /public/articles → 200', async () => {
      FakeAuthGuard.currentUser = null;
      await request(app.getHttpServer()).get('/public/articles').expect(200);
    });

    it('unauthenticated GET /public/articles/:slug → 200', async () => {
      FakeAuthGuard.currentUser = null;
      await request(app.getHttpServer()).get('/public/articles/news').expect(200);
    });
  });

  // ── Admin routes — ADMIN bypass ───────────────────────────────────────

  describe('Admin routes (ADMIN bypass)', () => {
    beforeEach(() => {
      FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
    });

    it('GET /cms/pages → 200; no permission DB lookup', async () => {
      await request(app.getHttpServer()).get('/cms/pages').expect(200);
      expect(mock.userPermission.findMany).not.toHaveBeenCalled();
    });

    it('POST /cms/pages → 201; cmsPage.upsert called', async () => {
      await request(app.getHttpServer())
        .post('/cms/pages')
        .send({
          slug: 'privacy',
          title: { ar: 'الخصوصية', en: 'Privacy' },
          body: { ar: '...', en: '...' },
          published: true,
        })
        .expect(201);
      expect(mock.cmsPage.upsert).toHaveBeenCalledTimes(1);
    });

    it('GET /cms/banners → 200', async () => {
      await request(app.getHttpServer()).get('/cms/banners').expect(200);
    });

    it('POST /cms/banners → 201; banner.create called', async () => {
      await request(app.getHttpServer())
        .post('/cms/banners')
        .send({
          imageUrl: 'https://cdn/x.jpg',
          title: { ar: 'إعلان', en: 'Promo' },
          active: true,
          order: 1,
        })
        .expect(201);
      expect(mock.banner.create).toHaveBeenCalledTimes(1);
    });

    it('DELETE /cms/banners/:id → 200; banner.delete called', async () => {
      await request(app.getHttpServer())
        .delete('/cms/banners/a1111111-1111-4111-8111-111111111111')
        .expect(200);
      expect(mock.banner.delete).toHaveBeenCalledTimes(1);
    });

    it('GET /cms/articles → 200', async () => {
      await request(app.getHttpServer()).get('/cms/articles').expect(200);
    });

    it('POST /cms/articles → 201; article.upsert called', async () => {
      await request(app.getHttpServer())
        .post('/cms/articles')
        .send({
          slug: 'launch',
          title: { ar: 'إطلاق', en: 'Launch' },
          excerpt: { ar: 'م', en: 'X' },
          body: { ar: '...', en: '...' },
          published: false,
        })
        .expect(201);
      expect(mock.article.upsert).toHaveBeenCalledTimes(1);
    });
  });

  // ── Role enforcement — SALES blocked at @Roles ────────────────────────

  describe('SALES blocked at @Roles on admin routes', () => {
    it('SALES even with cms:pages:manage → 403 on POST /cms/pages; cmsPage.upsert NOT called', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['cms:pages:manage'],
      };
      await request(app.getHttpServer())
        .post('/cms/pages')
        .send({ slug: 'x', title: { ar: 'م', en: 'X' }, body: { ar: '', en: '' } })
        .expect(403);
      expect(mock.userPermission.findMany).not.toHaveBeenCalled();
      expect(mock.cmsPage.upsert).not.toHaveBeenCalled();
    });

    it('SALES even with cms:banners:manage → 403 on POST /cms/banners; banner.create NOT called', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['cms:banners:manage'],
      };
      await request(app.getHttpServer())
        .post('/cms/banners')
        .send({
          imageUrl: 'https://cdn/y.jpg',
          title: { ar: 'م', en: 'P' },
          active: true,
          order: 1,
        })
        .expect(403);
      expect(mock.banner.create).not.toHaveBeenCalled();
    });

    it('SALES even with cms:articles:manage → 403 on POST /cms/articles; article.upsert NOT called', async () => {
      FakeAuthGuard.currentUser = {
        sub: 'sales-1',
        role: UserRole.SALES,
        codes: ['cms:articles:manage'],
      };
      await request(app.getHttpServer())
        .post('/cms/articles')
        .send({
          slug: 'z',
          title: { ar: 'م', en: 'Z' },
          excerpt: { ar: '', en: '' },
          body: { ar: '', en: '' },
        })
        .expect(403);
      expect(mock.article.upsert).not.toHaveBeenCalled();
    });
  });
});
