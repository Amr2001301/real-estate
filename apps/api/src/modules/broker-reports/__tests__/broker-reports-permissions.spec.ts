import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  Module,
} from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { UserRole } from '@prisma/client';
import { BrokerReportsController } from '../broker-reports.controller';
import { BrokerReportsService } from '../broker-reports.service';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  PERMISSIONS_KEY,
  type PermissionsMeta,
} from '../../../common/decorators/permissions.decorator';

/**
 * Broker permissions · Batch 4 (broker reports).
 *
 *   - Controller-level @Permissions('broker_reports:read') gates every report
 *     read + CSV export route. PermissionsGuard resolves via
 *     getAllAndOverride([handler, class]), so the class-level metadata applies
 *     to handlers without their own decorator.
 *   - @Roles(ADMIN) at the controller keeps the surface ADMIN-only.
 *   - The service is stubbed: this spec asserts the permission/role gate, not
 *     report aggregation logic.
 *   - Broker portal authorization untouched (no portal files imported).
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

const serviceMock = {
  summary: jest.fn().mockResolvedValue({ totalBrokers: 0 }),
  topBrokers: jest.fn().mockResolvedValue({ data: [] }),
  agents: jest.fn().mockResolvedValue({ data: [] }),
  projects: jest.fn().mockResolvedValue({ data: [] }),
  summaryCsv: jest.fn().mockResolvedValue('﻿المؤشر,القيمة\r\n'),
  topBrokersCsv: jest.fn().mockResolvedValue('﻿col\r\n'),
  brokerDetailCsv: jest.fn().mockResolvedValue('﻿col\r\n'),
  brokerDetail: jest.fn().mockResolvedValue({ broker: {} }),
};

const permissionMock = {
  userPermission: {
    findMany: jest.fn().mockImplementation(async () => {
      const u = FakeAuthGuard.currentUser;
      return (u?.codes ?? []).map((code) => ({ permission: { code } }));
    }),
  },
};

describe('Broker reports module · permissions enforcement', () => {
  let app: INestApplication;
  let reflector: Reflector;

  beforeAll(async () => {
    @Module({
      controllers: [BrokerReportsController],
      providers: [
        Reflector,
        { provide: BrokerReportsService, useValue: serviceMock },
        { provide: PrismaService, useValue: permissionMock },
        { provide: APP_GUARD, useClass: FakeAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
      ],
    })
    class TestModule {}

    const moduleRef = await Test.createTestingModule({ imports: [TestModule] }).compile();
    reflector = moduleRef.get(Reflector);
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    FakeAuthGuard.currentUser = null;
    permissionMock.userPermission.findMany.mockClear();
    Object.values(serviceMock).forEach((fn) => fn.mockClear());
  });

  it('controller-level @Permissions(broker_reports:read), bypass true', () => {
    const meta = reflector.get<PermissionsMeta | undefined>(
      PERMISSIONS_KEY,
      BrokerReportsController,
    );
    expect(meta).toMatchObject({ codes: ['broker_reports:read'], adminBypass: true });
  });

  it('ADMIN reads summary by bypass — no permission DB lookup', async () => {
    FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
    await request(app.getHttpServer()).get('/broker-reports/summary').expect(200);
    expect(permissionMock.userPermission.findMany).not.toHaveBeenCalled();
    expect(serviceMock.summary).toHaveBeenCalledTimes(1);
  });

  it('CSV export returns text/csv after the gate passes', async () => {
    FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
    const res = await request(app.getHttpServer())
      .get('/broker-reports/export/summary.csv')
      .expect(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('broker-summary.csv');
    expect(serviceMock.summaryCsv).toHaveBeenCalledTimes(1);
  });

  it('SALES blocked at the @Roles layer (broker-reports is ADMIN-only); service never runs', async () => {
    FakeAuthGuard.currentUser = {
      sub: 'sales-1',
      role: UserRole.SALES,
      codes: ['broker_reports:read'],
    };
    await request(app.getHttpServer()).get('/broker-reports/summary').expect(403);
    expect(permissionMock.userPermission.findMany).not.toHaveBeenCalled();
    expect(serviceMock.summary).not.toHaveBeenCalled();
  });

  it('SALES blocked from CSV export too; export generation never runs', async () => {
    FakeAuthGuard.currentUser = { sub: 'sales-1', role: UserRole.SALES, codes: [] };
    await request(app.getHttpServer())
      .get('/broker-reports/export/summary.csv')
      .expect(403);
    expect(serviceMock.summaryCsv).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated requests', async () => {
    FakeAuthGuard.currentUser = null;
    await request(app.getHttpServer()).get('/broker-reports/summary').expect(403);
  });
});
