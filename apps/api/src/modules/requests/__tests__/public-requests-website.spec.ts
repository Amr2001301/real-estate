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
import { RequestsModule } from '../requests.module';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { PrismaService } from '../../../common/prisma/prisma.service';

/**
 * Public website lead intake: info/visit requests accept project/unit context,
 * stamp the Website lead source, and reject any internal/admin field thanks to
 * the global whitelist pipe (mirrored here).
 */

const WEBSITE_SOURCE_ID = 'src-website-uuid';
const PROJECT_ID = 'a1111111-1111-4111-8111-111111111111';
const UNIT_ID = 'b2222222-2222-4222-8222-222222222222';

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

function makePrismaMock() {
  return {
    userPermission: { findMany: jest.fn().mockResolvedValue([]) },
    leadSource: {
      findFirst: jest.fn().mockResolvedValue({ id: WEBSITE_SOURCE_ID }),
      create: jest.fn().mockResolvedValue({ id: WEBSITE_SOURCE_ID }),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({
        id: 'client-1',
        fullName: 'Visitor',
        phone: '+966500000000',
        email: null,
      }),
    },
    lead: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'lead-1',
        ...data,
      })),
    },
    infoRequest: {
      create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'info-1',
        ...data,
      })),
    },
    visitRequest: {
      create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'visit-1',
        ...data,
      })),
    },
    $transaction: jest.fn().mockImplementation(async (ops: unknown) => {
      if (Array.isArray(ops)) return Promise.all(ops);
      return ops;
    }),
  };
}

describe('Public website · info/visit request intake', () => {
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
      imports: [MockPrismaModule, RequestsModule],
      providers: [
        Reflector,
        { provide: APP_GUARD, useClass: FakeAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    // Mirror the production global pipe so whitelist rejection is exercised.
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
    mock.lead.create.mockClear();
    mock.infoRequest.create.mockClear();
    mock.visitRequest.create.mockClear();
    mock.leadSource.findFirst.mockClear();
  });

  it('info-request accepts project/unit and stamps the Website source on the lead', async () => {
    await request(app.getHttpServer())
      .post('/public/info-request')
      .send({
        message: 'مهتم بالمشروع',
        name: 'Visitor',
        phone: '+966500000000',
        projectId: PROJECT_ID,
        unitId: UNIT_ID,
      })
      .expect(201);

    const lead = mock.lead.create.mock.calls[0][0].data;
    expect(lead.sourceId).toBe(WEBSITE_SOURCE_ID);
    expect(lead.projectInterestId).toBe(PROJECT_ID);
    expect(lead.unitInterestId).toBe(UNIT_ID);

    const info = mock.infoRequest.create.mock.calls[0][0].data;
    expect(info).toMatchObject({ projectId: PROJECT_ID, unitId: UNIT_ID });
  });

  it('info-request rejects internal/admin fields (assignedSalesId/stage/status)', async () => {
    await request(app.getHttpServer())
      .post('/public/info-request')
      .send({
        message: 'hi',
        name: 'X',
        phone: '+966500000001',
        assignedSalesId: 'sales-1',
        stage: 'WON',
        status: 'APPROVED',
        sourceId: 'attacker-source',
      })
      .expect(400);
    expect(mock.lead.create).not.toHaveBeenCalled();
  });

  it('visit-request accepts project/unit and stamps the Website source', async () => {
    await request(app.getHttpServer())
      .post('/public/visit-request')
      .send({
        projectId: PROJECT_ID,
        unitId: UNIT_ID,
        preferredDate: '2030-07-01',
        name: 'Visitor',
        phone: '+966500000002',
      })
      .expect(201);

    const lead = mock.lead.create.mock.calls[0][0].data;
    expect(lead.sourceId).toBe(WEBSITE_SOURCE_ID);
    expect(lead.unitInterestId).toBe(UNIT_ID);

    const visit = mock.visitRequest.create.mock.calls[0][0].data;
    expect(visit).toMatchObject({ projectId: PROJECT_ID, unitId: UNIT_ID, source: 'WEBSITE' });
  });

  it('visit-request rejects assignedSalesId / internal workflow fields', async () => {
    await request(app.getHttpServer())
      .post('/public/visit-request')
      .send({
        projectId: PROJECT_ID,
        preferredDate: '2030-07-01',
        name: 'X',
        phone: '+966500000003',
        assignedSalesId: 'sales-1',
        status: 'APPROVED',
        requestStatus: 'CONTACTED',
      })
      .expect(400);
    expect(mock.visitRequest.create).not.toHaveBeenCalled();
  });
});
