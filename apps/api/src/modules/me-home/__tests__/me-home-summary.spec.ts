import {
  CanActivate,
  ExecutionContext,
  Global,
  INestApplication,
  Module,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import request from 'supertest';
import { Prisma, UserRole } from '@prisma/client';
import { MeHomeModule } from '../me-home.module';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { PrismaService } from '../../../common/prisma/prisma.service';

const CUSTOMER_ID = 'cust-home-1';

const FUTURE_DATE = new Date(Date.now() + 30 * 86_400_000);  // 30 days ahead
const DUE_SOON_DATE = new Date(Date.now() + 7 * 86_400_000); // 7 days ahead
const PAST_DATE = new Date(Date.now() - 5 * 86_400_000);     // 5 days ago

class FakeAuthGuard implements CanActivate {
  static currentUser: { sub: string; role: UserRole } | null = null;
  canActivate(context: ExecutionContext): boolean {
    if (!FakeAuthGuard.currentUser) return false;
    const req = context.switchToHttp().getRequest();
    req.user = {
      sub: FakeAuthGuard.currentUser.sub,
      role: FakeAuthGuard.currentUser.role,
    };
    return true;
  }
}

const CONTRACT_MOCK = {
  id: 'contract-1',
  contractNumber: 'CON-2026-0004',
  signedAt: new Date('2026-06-03'),
  unit: {
    id: 'unit-1',
    code: 'SH-1201',
    type: '3BR',
    building: {
      phase: {
        project: { name: { ar: 'سولارا هايتس', en: 'Solara Heights' }, city: 'Makkah' },
      },
    },
  },
  installmentPlan: {
    totalMonths: 24,
    monthlyAmount: new Prisma.Decimal(119000),
  },
};

const INSTALLMENT_MOCK = {
  id: 'inst-1',
  amount: new Prisma.Decimal(119000),
  dueDate: FUTURE_DATE,
  status: 'PENDING',
  paidAt: new Date('2026-05-30'),
};

const MAINTENANCE_MOCK = [
  {
    id: 'req-1',
    status: 'IN_PROGRESS',
    priority: 'MEDIUM',
    createdAt: new Date('2026-06-01'),
    unit: { code: 'SH-1201' },
    items: [{ category: { name: { ar: 'كهرباء', en: 'Electrical' } } }],
    category: null,
  },
];

function makePrismaMock() {
  return {
    userPermission: { findMany: jest.fn().mockResolvedValue([]) },
    user: {
      findUnique: jest.fn().mockResolvedValue({ fullName: 'Amr Tarek' }),
    },
    contract: {
      findFirst: jest.fn().mockResolvedValue(CONTRACT_MOCK),
      count: jest.fn().mockResolvedValue(1),
    },
    installment: {
      count: jest.fn().mockResolvedValue(24),
      findFirst: jest.fn().mockResolvedValue(INSTALLMENT_MOCK),
    },
    maintenanceRequest: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue(MAINTENANCE_MOCK),
    },
    notification: {
      count: jest.fn().mockResolvedValue(3),
    },
  };
}

let mock = makePrismaMock();

describe('GET /me/home-summary', () => {
  let app: INestApplication;

  beforeAll(async () => {
    mock = makePrismaMock();

    @Global()
    @Module({
      providers: [{ provide: PrismaService, useValue: mock }],
      exports: [PrismaService],
    })
    class MockPrismaModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [
        MockPrismaModule,
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        MeHomeModule,
      ],
      providers: [
        { provide: APP_GUARD, useClass: FakeAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    FakeAuthGuard.currentUser = { sub: CUSTOMER_ID, role: UserRole.CUSTOMER };
    mock.user.findUnique.mockClear();
    mock.contract.findFirst.mockClear();
    mock.contract.count.mockClear();
    mock.installment.count.mockClear();
    mock.installment.findFirst.mockClear();
    mock.maintenanceRequest.count.mockClear();
    mock.maintenanceRequest.findMany.mockClear();
    mock.notification.count.mockClear();
  });

  it('returns complete response shape with all required top-level keys', async () => {
    const res = await request(app.getHttpServer())
      .get('/me/home-summary')
      .expect(200);

    expect(res.body).toMatchObject({
      profile: {
        displayName: 'Amr Tarek',
        customerType: 'OWNER',
        ownedUnitsCount: 1,
        avatarInitials: 'AT',
      },
      notifications: { unreadCount: 3 },
      primaryAction: expect.objectContaining({ type: expect.any(String) }),
      primaryProperty: expect.objectContaining({
        contractId: 'contract-1',
        unitCode: 'SH-1201',
        projectName: { ar: 'سولارا هايتس', en: 'Solara Heights' },
        city: 'Makkah',
        status: 'OWNED',
      }),
      installments: expect.objectContaining({
        totalCount: 24,
        paidCount: 24,
        overdueCount: 24,
        lastPaidAt: '2026-05-30T00:00:00.000Z',
      }),
      maintenance: expect.objectContaining({ openCount: 0 }),
    });
  });

  it('scopes all queries to the caller (no cross-customer read)', async () => {
    await request(app.getHttpServer()).get('/me/home-summary').expect(200);

    expect(mock.contract.findFirst.mock.calls[0]![0].where.customerId).toBe(CUSTOMER_ID);
    expect(mock.maintenanceRequest.findMany.mock.calls[0]![0].where.customerId).toBe(CUSTOMER_ID);
    expect(mock.notification.count.mock.calls[0]![0].where.userId).toBe(CUSTOMER_ID);
    const installCountWhere = mock.installment.count.mock.calls[0]![0].where;
    expect(installCountWhere.plan.contract.customerId).toBe(CUSTOMER_ID);
  });

  it('rejects unauthenticated requests with 403', async () => {
    FakeAuthGuard.currentUser = null;
    await request(app.getHttpServer()).get('/me/home-summary').expect(403);
  });

  it('rejects non-CUSTOMER roles with 403', async () => {
    FakeAuthGuard.currentUser = { sub: CUSTOMER_ID, role: UserRole.ADMIN };
    await request(app.getHttpServer()).get('/me/home-summary').expect(403);
  });

  it('primaryAction is OVERDUE_INSTALLMENT when nextDue status is OVERDUE', async () => {
    mock.installment.findFirst.mockResolvedValueOnce({
      id: 'inst-overdue',
      amount: new Prisma.Decimal(50000),
      dueDate: PAST_DATE,
      status: 'OVERDUE',
    });
    const res = await request(app.getHttpServer())
      .get('/me/home-summary')
      .expect(200);
    expect(res.body.primaryAction.type).toBe('OVERDUE_INSTALLMENT');
    expect(res.body.primaryAction.severity).toBe('danger');
    expect(res.body.installments.nextDue?.status).toBe('OVERDUE');
  });

  it('primaryAction is OVERDUE_INSTALLMENT for PENDING past dueDate (cron-gap guard)', async () => {
    mock.installment.findFirst.mockResolvedValueOnce({
      id: 'inst-pending-overdue',
      amount: new Prisma.Decimal(50000),
      dueDate: PAST_DATE,
      status: 'PENDING',
    });
    const res = await request(app.getHttpServer())
      .get('/me/home-summary')
      .expect(200);
    expect(res.body.primaryAction.type).toBe('OVERDUE_INSTALLMENT');
    expect(res.body.installments.nextDue?.status).toBe('OVERDUE');
  });

  it('primaryAction is DUE_SOON_INSTALLMENT when nextDue is within 14 days', async () => {
    mock.installment.findFirst.mockResolvedValueOnce({
      id: 'inst-due-soon',
      amount: new Prisma.Decimal(119000),
      dueDate: DUE_SOON_DATE,
      status: 'PENDING',
    });
    const res = await request(app.getHttpServer())
      .get('/me/home-summary')
      .expect(200);
    expect(res.body.primaryAction.type).toBe('DUE_SOON_INSTALLMENT');
    expect(res.body.primaryAction.severity).toBe('warning');
  });

  it('primaryAction is MAINTENANCE_UPDATE when open requests exist and no nextDue', async () => {
    mock.installment.findFirst.mockResolvedValueOnce(null);
    mock.maintenanceRequest.count.mockResolvedValueOnce(2);
    const res = await request(app.getHttpServer())
      .get('/me/home-summary')
      .expect(200);
    expect(res.body.primaryAction.type).toBe('MAINTENANCE_UPDATE');
    expect(res.body.primaryAction.severity).toBe('info');
    expect(res.body.maintenance.openCount).toBe(2);
  });

  it('primaryAction is NO_ACTION_REQUIRED when no installments and no open maintenance', async () => {
    mock.installment.findFirst.mockResolvedValueOnce(null);
    mock.maintenanceRequest.count.mockResolvedValueOnce(0);
    const res = await request(app.getHttpServer())
      .get('/me/home-summary')
      .expect(200);
    expect(res.body.primaryAction.type).toBe('NO_ACTION_REQUIRED');
    expect(res.body.primaryAction.severity).toBe('success');
    expect(res.body.primaryAction.cta.route).toBe('my-units');
  });

  it('customerType is CUSTOMER when no contracts exist at all', async () => {
    mock.contract.findFirst.mockResolvedValueOnce(null);
    // Q2 (ownedUnitsCount) = 0 → triggers Q9 (pendingCount)
    mock.contract.count
      .mockResolvedValueOnce(0) // Q2
      .mockResolvedValueOnce(0); // Q9
    const res = await request(app.getHttpServer())
      .get('/me/home-summary')
      .expect(200);
    expect(res.body.profile.customerType).toBe('CUSTOMER');
    expect(res.body.primaryProperty).toBeNull();
  });

  it('customerType is BUYER when unsigned contracts exist but no signed ones', async () => {
    mock.contract.findFirst.mockResolvedValueOnce(null);
    mock.contract.count
      .mockResolvedValueOnce(0) // Q2: ownedUnitsCount = 0
      .mockResolvedValueOnce(1); // Q9: pendingCount = 1 → BUYER
    const res = await request(app.getHttpServer())
      .get('/me/home-summary')
      .expect(200);
    expect(res.body.profile.customerType).toBe('BUYER');
  });

  it('maintenance recentRequests resolve categoryName from items then legacy category', async () => {
    mock.maintenanceRequest.findMany.mockResolvedValueOnce([
      {
        id: 'req-multi',
        status: 'OPEN',
        priority: null,
        createdAt: new Date('2026-06-10'),
        unit: { code: 'SH-1202' },
        items: [{ category: { name: { ar: 'سباكة', en: 'Plumbing' } } }],
        category: { name: { ar: 'كهرباء', en: 'Electrical' } },
      },
      {
        id: 'req-legacy',
        status: 'ASSIGNED',
        priority: 'HIGH',
        createdAt: new Date('2026-06-09'),
        unit: { code: 'SH-1202' },
        items: [],
        category: { name: { ar: 'تكييف', en: 'AC' } },
      },
    ]);
    const res = await request(app.getHttpServer())
      .get('/me/home-summary')
      .expect(200);
    const [first, second] = res.body.maintenance.recentRequests;
    // items[0] takes priority over legacy category
    expect(first.categoryName).toEqual({ ar: 'سباكة', en: 'Plumbing' });
    // falls back to legacy category when items is empty
    expect(second.categoryName).toEqual({ ar: 'تكييف', en: 'AC' });
    // null priority defaults to 'MEDIUM'
    expect(first.priority).toBe('MEDIUM');
  });
});
