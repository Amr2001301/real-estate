import {
  CanActivate,
  ExecutionContext,
  Global,
  INestApplication,
  Module,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
  /** When set, optionally-authenticated routes resolve req.user from this. */
  static currentUser: { sub: string; role: string } | null = null;
  canActivate(context: ExecutionContext): boolean {
    const reflector = new Reflector();
    const isPublic = Boolean(
      reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]),
    );
    // Optional auth: when a fake user is set, plant it on req.user. Routes
    // without @OptionalAuth still pass through (the fake guard treats public
    // routes as fully open) — current production behaviour is preserved.
    if (FakeAuthGuard.currentUser) {
      const req = context.switchToHttp().getRequest<{ user?: unknown }>();
      req.user = {
        ...FakeAuthGuard.currentUser,
        email: null,
        phone: null,
      };
    }
    return isPublic;
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
      // P3 — NotificationsService.sendToRoles calls findMany; default to
      // no recipients so the notification is a silent no-op in these
      // tests (the lead-intake assertions don't care about it).
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({
        id: 'client-1',
        fullName: 'Visitor',
        phone: '+966500000000',
        email: null,
      }),
    },
    // P3 — Project lookup powers the notification payload's projectName.
    project: {
      findUnique: jest.fn().mockResolvedValue({ name: { ar: 'م', en: 'Project' } }),
    },
    unit: {
      findUnique: jest.fn().mockResolvedValue(null),
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
    // P13 — info_request_created fan-out delivery. user.findMany above resolves
    // recipients; send() then reads the template and writes a notification row.
    notificationTemplate: {
      findUnique: jest.fn().mockResolvedValue({
        code: 'info_request_created', channel: 'IN_APP',
        subject: { ar: 's', en: 's' }, body: { ar: 'b', en: 'b' },
      }),
    },
    notification: {
      create: jest.fn().mockResolvedValue({ id: 'n-1', sentAt: new Date() }),
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
      // P3 — RequestsModule now imports NotificationsModule which needs ConfigService.
      imports: [MockPrismaModule, ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), RequestsModule],
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
    mock.notification.create.mockClear();
    mock.user.findMany.mockClear();
    FakeAuthGuard.currentUser = null;
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

  // ── Required-field validation (drives the contact form's error mapping) ──

  it('info-request rejects a missing message', async () => {
    await request(app.getHttpServer())
      .post('/public/info-request')
      .send({ name: 'X', phone: '+966500000004' })
      .expect(400);
    expect(mock.infoRequest.create).not.toHaveBeenCalled();
  });

  it('visit-request rejects a missing projectId', async () => {
    await request(app.getHttpServer())
      .post('/public/visit-request')
      .send({ preferredDate: '2030-07-01', name: 'X', phone: '+966500000005' })
      .expect(400);
    expect(mock.visitRequest.create).not.toHaveBeenCalled();
  });

  it('visit-request rejects an invalid preferredDate', async () => {
    await request(app.getHttpServer())
      .post('/public/visit-request')
      .send({ projectId: PROJECT_ID, preferredDate: 'not-a-date', name: 'X', phone: '+966500000006' })
      .expect(400);
    expect(mock.visitRequest.create).not.toHaveBeenCalled();
  });

  // ── Bug-#1 regression: customer's message and HH:mm reach the admin view ──
  // Pre-fix the public path wrote only the legacy `notes` field and never
  // populated `preferredTime`, so admin tooling (which renders `requestNotes`
  // and `preferredTime` as separate columns) showed both as blank. The visit
  // submission now mirrors the message to both columns and derives HH:mm from
  // the submitted datetime.

  it('visit-request mirrors customer message to both notes and requestNotes', async () => {
    await request(app.getHttpServer())
      .post('/public/visit-request')
      .send({
        projectId: PROJECT_ID,
        preferredDate: '2030-07-01T14:30:00.000Z',
        notes: 'Please ring the doorbell twice',
        name: 'Visitor',
        phone: '+966500000010',
      })
      .expect(201);

    const visit = mock.visitRequest.create.mock.calls[0][0].data;
    expect(visit.notes).toBe('Please ring the doorbell twice');
    expect(visit.requestNotes).toBe('Please ring the doorbell twice');
  });

  it('visit-request derives preferredTime (HH:mm) from a submitted datetime', async () => {
    await request(app.getHttpServer())
      .post('/public/visit-request')
      .send({
        projectId: PROJECT_ID,
        preferredDate: '2030-07-01T09:15:00',
        name: 'Visitor',
        phone: '+966500000011',
      })
      .expect(201);

    const visit = mock.visitRequest.create.mock.calls[0][0].data;
    expect(typeof visit.preferredTime).toBe('string');
    expect(visit.preferredTime).toMatch(/^\d{2}:\d{2}$/);
    // Locale-independent assertion: the service uses local time; we only
    // require some HH:mm value is written (was null prior to the fix).
  });

  it('visit-request accepts an explicit preferredTime override and a customer email', async () => {
    await request(app.getHttpServer())
      .post('/public/visit-request')
      .send({
        projectId: PROJECT_ID,
        preferredDate: '2030-07-01T09:15:00',
        preferredTime: '11:30',
        email: 'visitor@example.com',
        name: 'Visitor',
        phone: '+966500000012',
      })
      .expect(201);

    const visit = mock.visitRequest.create.mock.calls[0][0].data;
    expect(visit.preferredTime).toBe('11:30');
    expect(visit.customerEmail).toBe('visitor@example.com');
  });

  // ── P3.1 — defensive userId self-heal on the public endpoints ─────────────
  // The public submission endpoints accept a Bearer when the visitor happens
  // to be signed in. CLIENT/CUSTOMER auto-attribute the row so the customer
  // sees it under /account/visits and /account/requests; other roles stay
  // anonymous-on-public so admins/sales/brokers can't accidentally pollute
  // their own users by hitting the wrong endpoint.

  it('visit-request without Bearer: row stays anonymous (userId=undefined)', async () => {
    await request(app.getHttpServer())
      .post('/public/visit-request')
      .send({
        projectId: PROJECT_ID,
        preferredDate: '2030-07-01',
        name: 'Visitor',
        phone: '+966500000020',
      })
      .expect(201);
    const visit = mock.visitRequest.create.mock.calls[0][0].data;
    // The Prisma `userId: undefined` shape means Prisma writes NULL — same as
    // explicit null. We assert it is not set to a real id.
    expect(visit.userId).toBeFalsy();
  });

  it('visit-request with CUSTOMER Bearer: userId is attached', async () => {
    FakeAuthGuard.currentUser = {
      sub: 'cust-1',
      role: 'CUSTOMER',
    };
    await request(app.getHttpServer())
      .post('/public/visit-request')
      .send({
        projectId: PROJECT_ID,
        preferredDate: '2030-07-01',
        name: 'Visitor',
        phone: '+966500000021',
      })
      .expect(201);
    const visit = mock.visitRequest.create.mock.calls[0][0].data;
    expect(visit.userId).toBe('cust-1');
  });

  it('visit-request with CLIENT Bearer: userId is attached', async () => {
    FakeAuthGuard.currentUser = { sub: 'client-1', role: 'CLIENT' };
    await request(app.getHttpServer())
      .post('/public/visit-request')
      .send({
        projectId: PROJECT_ID,
        preferredDate: '2030-07-01',
        name: 'Visitor',
        phone: '+966500000022',
      })
      .expect(201);
    const visit = mock.visitRequest.create.mock.calls[0][0].data;
    expect(visit.userId).toBe('client-1');
  });

  it.each(['ADMIN', 'SALES', 'SALES_MANAGER', 'BROKER', 'MAINTENANCE_SUPERVISOR'])(
    'visit-request with %s Bearer: userId stays unset (only portal roles self-attribute)',
    async (role) => {
      FakeAuthGuard.currentUser = { sub: `${role.toLowerCase()}-1`, role };
      await request(app.getHttpServer())
        .post('/public/visit-request')
        .send({
          projectId: PROJECT_ID,
          preferredDate: '2030-07-01',
          name: 'Visitor',
          phone: `+96650000${role.length.toString().padStart(4, '0')}`,
        })
        .expect(201);
      const visit = mock.visitRequest.create.mock.calls[0][0].data;
      expect(visit.userId).toBeFalsy();
    },
  );

  it('info-request inherits the same self-heal contract', async () => {
    FakeAuthGuard.currentUser = { sub: 'cust-2', role: 'CUSTOMER' };
    await request(app.getHttpServer())
      .post('/public/info-request')
      .send({ message: 'hello', name: 'C', phone: '+966500000030' })
      .expect(201);
    const info = mock.infoRequest.create.mock.calls[0][0].data;
    expect(info.userId).toBe('cust-2');
  });

  // ── P13 — Guest/Client/Customer attribution + admin notification ──────────

  it('GUEST info-request: row saved without userId, guest lead attached', async () => {
    // No Bearer (beforeEach resets currentUser to null) → guest submission.
    await request(app.getHttpServer())
      .post('/public/info-request')
      .send({ message: 'general inquiry', name: 'Guest', phone: '+966500000040' })
      .expect(201);
    const info = mock.infoRequest.create.mock.calls[0][0].data;
    expect(info.userId).toBeFalsy(); // saved without a userId
    expect(info.leadId).toBe('lead-1'); // still captured as a guest lead
  });

  it('CLIENT info-request: row saved WITH userId (no guest lead)', async () => {
    FakeAuthGuard.currentUser = { sub: 'client-9', role: 'CLIENT' };
    await request(app.getHttpServer())
      .post('/public/info-request')
      .send({ message: 'tell me more' })
      .expect(201);
    const info = mock.infoRequest.create.mock.calls[0][0].data;
    expect(info.userId).toBe('client-9');
    // Authenticated submitters don't spawn a guest lead.
    expect(mock.lead.create).not.toHaveBeenCalled();
  });

  it('info-request notifies ADMIN + SALES_MANAGER with a payload free of phone/email', async () => {
    // One recipient resolved for this call (sendToRoles → user.findMany).
    mock.user.findMany.mockResolvedValueOnce([{ id: 'admin-1' }]);
    await request(app.getHttpServer())
      .post('/public/info-request')
      .send({
        message: 'I want a callback',
        name: 'Reachable Guest',
        phone: '+966512345678',
        email: 'guest@example.com',
        projectId: PROJECT_ID,
      })
      .expect(201);

    // sendToRoles queried exactly ADMIN + SALES_MANAGER (never all SALES).
    const roleQuery = mock.user.findMany.mock.calls.at(-1)![0] as {
      where: { role: { in: string[] } };
    };
    expect(roleQuery.where.role.in.sort()).toEqual(['ADMIN', 'SALES_MANAGER']);

    // A DB notification row was written (no Firebase needed).
    expect(mock.notification.create).toHaveBeenCalledTimes(1);
    const notif = mock.notification.create.mock.calls[0][0].data as {
      templateCode: string;
      payload: Record<string, unknown>;
    };
    expect(notif.templateCode).toBe('info_request_created');
    // Safe payload: identity + context only.
    expect(notif.payload).toMatchObject({ customerName: 'Reachable Guest', projectName: 'م' });
    // CRITICAL: no phone/email/message leak into the notification payload.
    const serialised = JSON.stringify(notif.payload);
    expect(serialised).not.toContain('+966512345678');
    expect(serialised).not.toContain('guest@example.com');
    expect(serialised).not.toContain('I want a callback');
  });
});
