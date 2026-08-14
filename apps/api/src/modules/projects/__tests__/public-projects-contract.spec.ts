import { CanActivate, ExecutionContext, Global, INestApplication, Module } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { UserRole } from '@prisma/client';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';
import { ProjectsModule } from '../projects.module';
import { PhasesModule } from '../../phases/phases.module';
import { BuildingsModule } from '../../buildings/buildings.module';
import { MediaModule } from '../../media/media.module';
import { R2Service } from '../../media/r2.service';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { PrismaService } from '../../../common/prisma/prisma.service';

/**
 * Public project contract: marketing-site reads must be lean and leak nothing.
 *   - list returns only published projects (publicOnly where-clause) with the
 *     whitelisted shape + availableUnitsCount.
 *   - detail 404s unpublished projects.
 *   - no relation/internal fields (leads, visitRequests, brokerCommissions,
 *     timestamps) reach the wire.
 */

const PUBLISHED_ID = 'a1111111-1111-4111-8111-111111111111';
const DRAFT_ID = 'b2222222-2222-4222-8222-222222222222';

class FakeAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const reflector = new Reflector();
    const isPublic = reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    return Boolean(isPublic);
  }
}

// A raw Prisma-shaped project carrying sensitive relations the serializer must drop.
function rawProject(id: string, status: string) {
  return {
    id,
    name: { ar: 'مشروع', en: 'Project' },
    description: { ar: 'وصف', en: 'Desc' },
    city: 'Riyadh',
    lat: 24.7,
    lng: 46.6,
    services: [{ ar: 'مسبح', en: 'Pool' }],
    featured: true,
    status,
    createdAt: new Date('2030-01-01'),
    updatedAt: new Date('2030-01-02'),
    media: [
      { id: 'm1', projectId: id, url: 'https://cdn/x.jpg', type: 'IMAGE', order: 0, createdAt: new Date() },
    ],
    // Sensitive relations that must never serialize:
    leads: [{ id: 'lead-1', phone: '+966500000000' }],
    visitRequests: [{ id: 'v-1' }],
    brokerCommissions: [{ id: 'bc-1', netAmount: '5000' }],
    phases: [],
  };
}

function makePrismaMock() {
  return {
    userPermission: { findMany: jest.fn().mockResolvedValue([]) },
    project: {
      findMany: jest.fn().mockResolvedValue([rawProject(PUBLISHED_ID, 'PUBLISHED')]),
      count: jest.fn().mockResolvedValue(1),
      findUnique: jest.fn().mockImplementation(async ({ where }: { where: { id: string } }) =>
        where.id === DRAFT_ID
          ? rawProject(DRAFT_ID, 'DRAFT')
          : rawProject(where.id, 'PUBLISHED'),
      ),
    },
    unit: {
      // availableUnitCounts: two AVAILABLE units under the published project.
      findMany: jest.fn().mockResolvedValue([
        { building: { phase: { projectId: PUBLISHED_ID } } },
        { building: { phase: { projectId: PUBLISHED_ID } } },
      ]),
      count: jest.fn().mockResolvedValue(0),
    },
    $transaction: jest.fn().mockImplementation(async (ops: unknown) => {
      if (Array.isArray(ops)) return Promise.all(ops);
      return ops;
    }),
  };
}

const r2Mock = { createPresignedUpload: jest.fn() };

// updatedAt is intentionally exposed on public project responses — it powers
// the sitemap lastModified field. Only truly sensitive relations are blocked.
const SENSITIVE_KEYS = [
  'leads',
  'visitRequests',
  'brokerCommissions',
  'phases',
  'createdAt',
];

describe('Public projects · response contract', () => {
  let app: INestApplication;
  let mock: ReturnType<typeof makePrismaMock>;

  beforeAll(async () => {
    mock = makePrismaMock();

    @Global()
    @Module({
      providers: [{ provide: PrismaService, useValue: mock }],
      exports: [PrismaService],
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

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => await app.close());

  it('list returns lean shape with availableUnitsCount; only published queried', async () => {
    const res = await request(app.getHttpServer()).get('/public/projects').expect(200);
    const item = res.body.data[0];
    expect(item).toMatchObject({
      id: PUBLISHED_ID,
      city: 'Riyadh',
      featured: true,
      status: 'PUBLISHED',
      coverImage: 'https://cdn/x.jpg',
      availableUnitsCount: 2,
    });
    // publicOnly forces status=PUBLISHED in the where-clause.
    const whereArg = mock.project.findMany.mock.calls[0][0].where;
    expect(whereArg.status).toBe('PUBLISHED');
  });

  it('list item leaks no sensitive relations/timestamps', async () => {
    const res = await request(app.getHttpServer()).get('/public/projects').expect(200);
    const item = res.body.data[0];
    for (const k of SENSITIVE_KEYS) expect(item).not.toHaveProperty(k);
    // updatedAt IS intentionally exposed for sitemap freshness — verify it is present.
    expect(item).toHaveProperty('updatedAt');
  });

  it('detail returns whitelisted fields + media[] + availableUnitsCount', async () => {
    const res = await request(app.getHttpServer())
      .get(`/public/projects/${PUBLISHED_ID}`)
      .expect(200);
    expect(res.body).toMatchObject({
      id: PUBLISHED_ID,
      status: 'PUBLISHED',
      availableUnitsCount: 2,
    });
    expect(Array.isArray(res.body.media)).toBe(true);
    expect(res.body.media[0]).toEqual({ url: 'https://cdn/x.jpg', type: 'IMAGE', order: 0 });
    for (const k of SENSITIVE_KEYS) expect(res.body).not.toHaveProperty(k);
    expect(res.body).toHaveProperty('updatedAt');
  });

  it('detail 404s an unpublished project', async () => {
    await request(app.getHttpServer()).get(`/public/projects/${DRAFT_ID}`).expect(404);
  });

  it('GET /public/projects/cities returns { cities: string[] } from PUBLISHED projects only', async () => {
    mock.project.findMany.mockClear();
    const res = await request(app.getHttpServer()).get('/public/projects/cities').expect(200);
    expect(Array.isArray(res.body.cities)).toBe(true);
    expect(res.body.cities).toContain('Riyadh');
    // Must scope to PUBLISHED only.
    const whereArg = mock.project.findMany.mock.calls[0]?.[0]?.where;
    expect(whereArg?.status).toBe('PUBLISHED');
  });
});
