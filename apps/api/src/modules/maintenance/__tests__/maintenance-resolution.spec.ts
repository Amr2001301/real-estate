import {
  CanActivate,
  ExecutionContext,
  Global,
  INestApplication,
  Module,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { MaintenanceStatus, MaintenanceReviewStatus, UserRole } from '@prisma/client';
import { MaintenanceModule, MaintenanceService } from '../maintenance.module';
import { DocumentsService } from '../../documents/documents.module';
import { NotificationsService } from '../../notifications/notifications.module';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { PrismaService } from '../../../common/prisma/prisma.service';

/**
 * Phase A — maintenance resolution loop: customer confirm+rating, supervisor
 * confirm, complaint, and the unresolved cron sweep. Real MaintenanceService
 * runs against a mocked PrismaService; DocumentsService + NotificationsService
 * are stubbed.
 */

const CUSTOMER_ID = 'e5555555-5555-4555-8555-555555555555';
const OTHER_ID = 'aaaa1111-1111-4111-8111-111111111111';
const SUPERVISOR_ID = 'f6666666-6666-4666-8666-666666666666';
const REQ_ID = 'bbbb2222-2222-4222-8222-222222222222';
const DAY_MS = 24 * 60 * 60 * 1000;

type Req = {
  id: string;
  customerId: string;
  assignedAdminId: string | null;
  status: MaintenanceStatus;
  reviewStatus: MaintenanceReviewStatus;
  dueAt: Date | null;
  complaintAt: Date | null;
  unresolvedAt: Date | null;
  customerConfirmedResolutionAt: Date | null;
  supervisorConfirmedResolutionAt: Date | null;
  customerRating: number | null;
};

function baseReq(): Req {
  return {
    id: REQ_ID,
    customerId: CUSTOMER_ID,
    assignedAdminId: SUPERVISOR_ID,
    status: MaintenanceStatus.RESOLVED,
    reviewStatus: MaintenanceReviewStatus.APPROVED,
    dueAt: null,
    complaintAt: null,
    unresolvedAt: null,
    customerConfirmedResolutionAt: null,
    supervisorConfirmedResolutionAt: null,
    customerRating: null,
  };
}

const fixture: { req: Req } = { req: baseReq() };

class FakeAuthGuard implements CanActivate {
  static currentUser: { sub: string; role: UserRole } | null = null;
  canActivate(context: ExecutionContext): boolean {
    if (!FakeAuthGuard.currentUser) return false;
    const r = context.switchToHttp().getRequest();
    r.user = { sub: FakeAuthGuard.currentUser.sub, role: FakeAuthGuard.currentUser.role };
    return true;
  }
}

const documentsMock = { listForOwner: jest.fn().mockResolvedValue([]) };
const notificationsMock = {
  sendToUser: jest.fn().mockResolvedValue(undefined),
  sendToUsers: jest.fn().mockResolvedValue(undefined),
  sendToRoles: jest.fn().mockResolvedValue(undefined),
};

function makePrismaMock() {
  const m = {
    userPermission: { findMany: jest.fn().mockResolvedValue([]) },
    maintenanceRequest: {
      // requireRequest / assert* / notifyContext all hit findUnique; return the
      // fixture with the relations the response/notify paths read.
      findUnique: jest.fn().mockImplementation(async () => ({
        ...fixture.req,
        unit: { code: 'U-1' },
        category: { id: 'c1', name: { ar: 'x', en: 'x' } },
        assignedAdmin: null,
      })),
      update: jest.fn().mockImplementation(async ({ data }: { data: Partial<Req> }) => {
        Object.assign(fixture.req, data);
        return { ...fixture.req };
      }),
      findMany: jest.fn().mockImplementation(async () => {
        const r = fixture.req;
        const qualifies =
          r.complaintAt != null &&
          r.unresolvedAt == null &&
          r.complaintAt.getTime() <= Date.now() - DAY_MS &&
          r.status !== MaintenanceStatus.RESOLVED &&
          r.status !== MaintenanceStatus.CLOSED;
        return qualifies ? [{ id: r.id }] : [];
      }),
      updateMany: jest.fn().mockImplementation(async () => {
        if (fixture.req.unresolvedAt == null) {
          fixture.req.unresolvedAt = new Date();
          return { count: 1 };
        }
        return { count: 0 };
      }),
    },
  };
  return m;
}

let mock = makePrismaMock();

describe('Maintenance · resolution loop (Phase A)', () => {
  let app: INestApplication;
  let svc: MaintenanceService;

  beforeAll(async () => {
    mock = makePrismaMock();

    @Global()
    @Module({
      providers: [{ provide: PrismaService, useValue: mock }],
      exports: [PrismaService],
    })
    class MockPrismaModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [MockPrismaModule, ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), MaintenanceModule],
      providers: [
        { provide: APP_GUARD, useClass: FakeAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
      ],
    })
      .overrideProvider(DocumentsService)
      .useValue(documentsMock)
      .overrideProvider(NotificationsService)
      .useValue(notificationsMock)
      .compile();

    svc = moduleRef.get(MaintenanceService);
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
  });

  afterAll(async () => app.close());

  beforeEach(() => {
    fixture.req = baseReq();
    mock.maintenanceRequest.update.mockClear();
  });

  // ── Customer confirm + rating ────────────────────────────────────────────

  it('customer confirms a RESOLVED request with rating → resolvedBy=CUSTOMER', async () => {
    FakeAuthGuard.currentUser = { sub: CUSTOMER_ID, role: UserRole.CUSTOMER };
    await request(app.getHttpServer())
      .post(`/me/maintenance-requests/${REQ_ID}/confirm-resolution`)
      .send({ rating: 5, note: 'شكراً' })
      .expect(201);
    const data = mock.maintenanceRequest.update.mock.calls[0]![0].data;
    expect(data.customerRating).toBe(5);
    expect(data.customerConfirmedResolutionAt).toBeInstanceOf(Date);
    expect(data.resolvedBy).toBe('CUSTOMER');
  });

  it('customer confirm sets resolvedBy=BOTH when supervisor already confirmed', async () => {
    FakeAuthGuard.currentUser = { sub: CUSTOMER_ID, role: UserRole.CUSTOMER };
    fixture.req.supervisorConfirmedResolutionAt = new Date();
    await request(app.getHttpServer())
      .post(`/me/maintenance-requests/${REQ_ID}/confirm-resolution`)
      .send({ rating: 4 })
      .expect(201);
    expect(mock.maintenanceRequest.update.mock.calls[0]![0].data.resolvedBy).toBe('BOTH');
  });

  it('rejects customer confirm before RESOLVED (400)', async () => {
    FakeAuthGuard.currentUser = { sub: CUSTOMER_ID, role: UserRole.CUSTOMER };
    fixture.req.status = MaintenanceStatus.IN_PROGRESS;
    await request(app.getHttpServer())
      .post(`/me/maintenance-requests/${REQ_ID}/confirm-resolution`)
      .send({ rating: 5 })
      .expect(400);
    expect(mock.maintenanceRequest.update).not.toHaveBeenCalled();
  });

  it("returns 404 for another customer's request", async () => {
    FakeAuthGuard.currentUser = { sub: OTHER_ID, role: UserRole.CUSTOMER };
    await request(app.getHttpServer())
      .post(`/me/maintenance-requests/${REQ_ID}/confirm-resolution`)
      .send({ rating: 5 })
      .expect(404);
    expect(mock.maintenanceRequest.update).not.toHaveBeenCalled();
  });

  it('rejects a second customer confirm (400)', async () => {
    FakeAuthGuard.currentUser = { sub: CUSTOMER_ID, role: UserRole.CUSTOMER };
    fixture.req.customerConfirmedResolutionAt = new Date();
    await request(app.getHttpServer())
      .post(`/me/maintenance-requests/${REQ_ID}/confirm-resolution`)
      .send({ rating: 5 })
      .expect(400);
    expect(mock.maintenanceRequest.update).not.toHaveBeenCalled();
  });

  it('rejects rating outside 1–5 (400 via validation)', async () => {
    FakeAuthGuard.currentUser = { sub: CUSTOMER_ID, role: UserRole.CUSTOMER };
    await request(app.getHttpServer())
      .post(`/me/maintenance-requests/${REQ_ID}/confirm-resolution`)
      .send({ rating: 6 })
      .expect(400);
  });

  // ── Supervisor confirm ─────────────────────────────────────────────────────

  it('assigned supervisor confirms → resolvedBy=SUPERVISOR', async () => {
    FakeAuthGuard.currentUser = { sub: SUPERVISOR_ID, role: UserRole.MAINTENANCE_SUPERVISOR };
    await request(app.getHttpServer())
      .post(`/me/maintenance-requests/${REQ_ID}/supervisor-confirm`)
      .send({})
      .expect(201);
    const data = mock.maintenanceRequest.update.mock.calls[0]![0].data;
    expect(data.supervisorConfirmedResolutionAt).toBeInstanceOf(Date);
    expect(data.resolvedBy).toBe('SUPERVISOR');
  });

  it('rejects supervisor confirm on an unassigned request (404)', async () => {
    FakeAuthGuard.currentUser = { sub: OTHER_ID, role: UserRole.MAINTENANCE_SUPERVISOR };
    await request(app.getHttpServer())
      .post(`/me/maintenance-requests/${REQ_ID}/supervisor-confirm`)
      .send({})
      .expect(404);
    expect(mock.maintenanceRequest.update).not.toHaveBeenCalled();
  });

  // ── Complaint ────────────────────────────────────────────────────────────

  it('customer can complain when ≥24h overdue', async () => {
    FakeAuthGuard.currentUser = { sub: CUSTOMER_ID, role: UserRole.CUSTOMER };
    fixture.req.status = MaintenanceStatus.IN_PROGRESS;
    fixture.req.dueAt = new Date(Date.now() - 25 * 60 * 60 * 1000);
    await request(app.getHttpServer())
      .post(`/me/maintenance-requests/${REQ_ID}/complaint`)
      .send({})
      .expect(201);
    expect(mock.maintenanceRequest.update.mock.calls[0]![0].data.complaintAt).toBeInstanceOf(Date);
  });

  it('rejects a complaint before 24h overdue (400)', async () => {
    FakeAuthGuard.currentUser = { sub: CUSTOMER_ID, role: UserRole.CUSTOMER };
    fixture.req.status = MaintenanceStatus.IN_PROGRESS;
    fixture.req.dueAt = new Date(Date.now() - 60 * 60 * 1000); // 1h overdue
    await request(app.getHttpServer())
      .post(`/me/maintenance-requests/${REQ_ID}/complaint`)
      .send({})
      .expect(400);
    expect(mock.maintenanceRequest.update).not.toHaveBeenCalled();
  });

  it('rejects a duplicate complaint (400)', async () => {
    FakeAuthGuard.currentUser = { sub: CUSTOMER_ID, role: UserRole.CUSTOMER };
    fixture.req.status = MaintenanceStatus.IN_PROGRESS;
    fixture.req.dueAt = new Date(Date.now() - 25 * 60 * 60 * 1000);
    fixture.req.complaintAt = new Date(Date.now() - 60 * 60 * 1000);
    await request(app.getHttpServer())
      .post(`/me/maintenance-requests/${REQ_ID}/complaint`)
      .send({})
      .expect(400);
    expect(mock.maintenanceRequest.update).not.toHaveBeenCalled();
  });

  // ── Unresolved cron ────────────────────────────────────────────────────────

  it('markUnresolved flags an old complaint and is idempotent', async () => {
    fixture.req.status = MaintenanceStatus.IN_PROGRESS;
    fixture.req.complaintAt = new Date(Date.now() - 25 * 60 * 60 * 1000);
    fixture.req.unresolvedAt = null;

    const first = await svc.markUnresolved();
    expect(first.marked).toBe(1);
    expect(fixture.req.unresolvedAt).toBeInstanceOf(Date);

    // Re-run: nothing left to flag.
    const second = await svc.markUnresolved();
    expect(second.scanned).toBe(0);
    expect(second.marked).toBe(0);
  });

  it('markUnresolved ignores complaints younger than the window', async () => {
    fixture.req.status = MaintenanceStatus.IN_PROGRESS;
    fixture.req.complaintAt = new Date(Date.now() - 60 * 60 * 1000); // 1h
    fixture.req.unresolvedAt = null;
    const res = await svc.markUnresolved();
    expect(res.scanned).toBe(0);
  });
});
