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
import request from 'supertest';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';
import { UnitsModule } from '../units.module';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { PrismaService } from '../../../common/prisma/prisma.service';

/**
 * Public unit contract: lean shape, comparison-ready, leaks nothing internal
 * (history/actor, reservationExpiresAt, reservations/contracts), defaults the
 * listing to AVAILABLE, and forwards basic filters into the where-clause.
 */

const PUBLISHED_UNIT = 'a1111111-1111-4111-8111-111111111111';
const DRAFT_UNIT = 'b2222222-2222-4222-8222-222222222222';

class FakeAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const reflector = new Reflector();
    return Boolean(
      reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]),
    );
  }
}

function rawUnit(id: string, projectStatus: string) {
  return {
    id,
    code: 'A-101',
    type: '2BR',
    area: 120.5,
    bedrooms: 2,
    bathrooms: 2,
    floor: 3,
    price: '750000.00',
    status: 'AVAILABLE',
    reservationExpiresAt: new Date('2030-06-01'),
    createdAt: new Date('2030-01-01'),
    updatedAt: new Date('2030-01-02'),
    media: [
      { id: 'um1', unitId: id, url: 'https://cdn/u.jpg', type: 'IMAGE', order: 0, createdAt: new Date() },
    ],
    history: [{ id: 'h1', reason: 'manual fix', changedById: 'admin-1' }],
    reservations: [{ id: 'r1' }],
    contracts: [{ id: 'c1' }],
    building: {
      id: 'b-1',
      name: 'Tower A',
      phase: {
        id: 'ph-1',
        project: {
          id: 'p-1',
          name: { ar: 'مشروع', en: 'Project' },
          city: 'Riyadh',
          status: projectStatus,
          // sensitive fields on the nested project that must not surface:
          lat: 24.7,
          lng: 46.6,
          featured: true,
        },
      },
    },
  };
}

function makePrismaMock() {
  return {
    userPermission: { findMany: jest.fn().mockResolvedValue([]) },
    unit: {
      findMany: jest.fn().mockResolvedValue([rawUnit(PUBLISHED_UNIT, 'PUBLISHED')]),
      count: jest.fn().mockResolvedValue(1),
      findUnique: jest.fn().mockImplementation(async ({ where }: { where: { id: string } }) =>
        rawUnit(where.id, where.id === DRAFT_UNIT ? 'DRAFT' : 'PUBLISHED'),
      ),
    },
    $transaction: jest.fn().mockImplementation(async (ops: unknown) => {
      if (Array.isArray(ops)) return Promise.all(ops);
      return ops;
    }),
  };
}

const SENSITIVE_KEYS = [
  'reservationExpiresAt',
  'history',
  'reservations',
  'contracts',
  'building',
  'buildingId',
  'createdAt',
  'updatedAt',
];

describe('Public units · response contract', () => {
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
      imports: [MockPrismaModule, UnitsModule],
      providers: [
        Reflector,
        { provide: APP_GUARD, useClass: FakeAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    // Mirror the production global pipe so query params transform to numbers.
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

  afterAll(async () => await app.close());

  beforeEach(() => {
    mock.unit.findMany.mockClear();
    mock.unit.findUnique.mockClear();
  });

  it('list defaults to AVAILABLE and only published projects', async () => {
    await request(app.getHttpServer()).get('/public/units').expect(200);
    const where = mock.unit.findMany.mock.calls[0][0].where;
    expect(where.status).toBe('AVAILABLE');
    expect(where.building.phase.project.status).toBe('PUBLISHED');
  });

  it('list forwards projectId / type / bathrooms / price / bedrooms filters', async () => {
    const projectId = 'c3333333-3333-4333-8333-333333333333';
    await request(app.getHttpServer())
      .get(
        `/public/units?projectId=${projectId}&type=villa&bathrooms=3&priceMin=500000&priceMax=900000&bedrooms=2`,
      )
      .expect(200);
    const where = mock.unit.findMany.mock.calls[0][0].where;
    // projectId and the public PUBLISHED constraint compose together.
    expect(where.building.phase.projectId).toBe(projectId);
    expect(where.building.phase.project.status).toBe('PUBLISHED');
    expect(where.type).toBe('villa');
    expect(where.bathrooms).toBe(3);
    expect(where.bedrooms).toBe(2);
    expect(where.price).toBeDefined();
  });

  it('list forwards a city filter through the project relation', async () => {
    await request(app.getHttpServer()).get('/public/units?city=الرياض').expect(200);
    const where = mock.unit.findMany.mock.calls[0][0].where;
    expect(where.building.phase.project.city).toBe('الرياض');
    expect(where.building.phase.project.status).toBe('PUBLISHED');
  });

  it('list item is comparison-ready and leaks nothing internal', async () => {
    const res = await request(app.getHttpServer()).get('/public/units').expect(200);
    const item = res.body.data[0];
    expect(item).toMatchObject({
      id: PUBLISHED_UNIT,
      type: '2BR',
      area: 120.5,
      bedrooms: 2,
      bathrooms: 2,
      floor: 3,
      price: '750000', // serialized Decimal string
      status: 'AVAILABLE',
      coverImage: 'https://cdn/u.jpg',
    });
    expect(item.project).toEqual({ id: 'p-1', name: { ar: 'مشروع', en: 'Project' }, city: 'Riyadh' });
    // Nested project must not carry status/lat/lng/featured.
    expect(item.project).not.toHaveProperty('status');
    expect(item.project).not.toHaveProperty('lat');
    for (const k of SENSITIVE_KEYS) expect(item).not.toHaveProperty(k);
  });

  it('detail includes all comparison fields + media[] and leaks nothing', async () => {
    const res = await request(app.getHttpServer())
      .get(`/public/units/${PUBLISHED_UNIT}`)
      .expect(200);
    expect(res.body).toMatchObject({
      id: PUBLISHED_UNIT,
      price: '750000',
      area: 120.5,
      bedrooms: 2,
      bathrooms: 2,
      floor: 3,
      status: 'AVAILABLE',
      type: '2BR',
    });
    expect(res.body.project).toMatchObject({ id: 'p-1', city: 'Riyadh' });
    expect(Array.isArray(res.body.media)).toBe(true);
    for (const k of SENSITIVE_KEYS) expect(res.body).not.toHaveProperty(k);
    // History must not be queried for the public path.
    expect(mock.unit.findUnique.mock.calls[0][0].include.history).toBeUndefined();
  });

  it('detail 404s a unit under an unpublished project', async () => {
    await request(app.getHttpServer()).get(`/public/units/${DRAFT_UNIT}`).expect(404);
  });
});
