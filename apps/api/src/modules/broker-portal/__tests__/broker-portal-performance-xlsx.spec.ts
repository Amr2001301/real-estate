import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  INestApplication,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { UserRole } from '@prisma/client';
import { Workbook } from 'exceljs';
import { BrokerPortalController } from '../broker-portal.controller';
import { BrokerPortalPerformanceService } from '../broker-portal-performance.service';
import { BrokerPortalService } from '../broker-portal.service';
import { BrokerPortalLeadsService } from '../broker-portal-leads.service';
import { BrokerPortalVisitsService } from '../broker-portal-visits.service';
import { BrokerPortalActivityService } from '../broker-portal-activity.service';
import { BrokerPortalReservationsService } from '../broker-portal-reservations.service';
import { BrokerPortalContractsService } from '../broker-portal-contracts.service';
import { BrokerPortalCommissionsService } from '../broker-portal-commissions.service';
import { BrokerPortalPayoutsService } from '../broker-portal-payouts.service';
import { BrokerPortalTeamService } from '../broker-portal-team.service';
import { BrokerScopeGuard } from '../../../common/guards/broker-scope.guard';
import { BrokerManagerGuard } from '../../../common/guards/broker-manager.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { createReportWorkbook, addTitledTable, workbookToBuffer } from '../../../common/utils/xlsx';

/**
 * P15.5 — broker-portal performance XLSX export.
 *
 * Two layers:
 *   1. Service scoping (the security core): the broker firm is ALWAYS
 *      scope.brokerId (from the token), non-managers are pinned to their own
 *      agent, and a manager requesting an out-of-firm agent is rejected — so a
 *      broker can never export another broker's data.
 *   2. Controller wiring: correct content-type + attachment, real PK bytes,
 *      and BROKER-only access (non-broker roles 403), with the CSV twin intact.
 */

// ── 1. Service-level scoping ────────────────────────────────────────────────
describe('BrokerPortalPerformanceService.exportXlsx · scoping', () => {
  const SCOPE = { brokerId: 'broker-A', brokerUserId: 'bu-1', brokerAgentUserId: 'u-self' };
  let reports: { brokerDetailXlsx: jest.Mock; brokerDetailCsv: jest.Mock };
  let prisma: { brokerUser: { findUnique: jest.Mock; findFirst: jest.Mock } };
  let svc: BrokerPortalPerformanceService;

  beforeEach(() => {
    reports = {
      brokerDetailXlsx: jest.fn().mockResolvedValue(Buffer.from([0x50, 0x4b, 0x03, 0x04])),
      brokerDetailCsv: jest.fn(),
    };
    prisma = { brokerUser: { findUnique: jest.fn(), findFirst: jest.fn() } };
    svc = new BrokerPortalPerformanceService(prisma as never, reports as never);
  });

  it('always scopes to scope.brokerId — never a request param (manager, firm-wide)', async () => {
    prisma.brokerUser.findUnique.mockResolvedValue({
      userId: 'u-self', brokerId: 'broker-A', isPrimaryContact: true, canManageBrokerUsers: false,
    });
    await svc.exportXlsx(SCOPE, {});
    expect(reports.brokerDetailXlsx).toHaveBeenCalledWith(
      'broker-A',
      expect.objectContaining({ brokerAgentId: undefined }),
    );
  });

  it('pins a non-manager to their OWN agent, ignoring a requested brokerAgentId', async () => {
    prisma.brokerUser.findUnique.mockResolvedValue({
      userId: 'u-self', brokerId: 'broker-A', isPrimaryContact: false, canManageBrokerUsers: false,
    });
    // Attempt to peek at a colleague — must be ignored.
    await svc.exportXlsx(SCOPE, { brokerAgentId: 'u-colleague' });
    expect(reports.brokerDetailXlsx).toHaveBeenCalledWith(
      'broker-A',
      expect.objectContaining({ brokerAgentId: 'u-self' }),
    );
  });

  it('rejects a manager requesting an agent from ANOTHER firm (no cross-broker leak)', async () => {
    prisma.brokerUser.findUnique.mockResolvedValue({
      userId: 'u-self', brokerId: 'broker-A', isPrimaryContact: true, canManageBrokerUsers: false,
    });
    prisma.brokerUser.findFirst.mockResolvedValue(null); // requested agent not in broker-A
    await expect(svc.exportXlsx(SCOPE, { brokerAgentId: 'agent-of-broker-B' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(reports.brokerDetailXlsx).not.toHaveBeenCalled();
  });

  it('returns the brokerDetailXlsx buffer for the broker\'s own firm', async () => {
    prisma.brokerUser.findUnique.mockResolvedValue({
      userId: 'u-self', brokerId: 'broker-A', isPrimaryContact: true, canManageBrokerUsers: false,
    });
    const out = await svc.exportXlsx(SCOPE, {});
    expect(out.subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  });
});

// ── 2. Controller wiring (headers + PK + role gate) ─────────────────────────

class FakeAuthGuard implements CanActivate {
  static role: UserRole | null = null;
  canActivate(context: ExecutionContext): boolean {
    if (!FakeAuthGuard.role) return false;
    const req = context.switchToHttp().getRequest();
    req.user = { sub: 'broker-user-1', role: FakeAuthGuard.role };
    return true;
  }
}

/** Fake BrokerScopeGuard: injects a fixed broker-A scope (as the real guard does). */
const fakeScopeGuard = {
  canActivate: (ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    req.brokerId = 'broker-A';
    req.brokerUserId = 'bu-1';
    req.brokerAgentUserId = 'u-self';
    return true;
  },
};

/** A real, small workbook so the content-type + PK + load assertions are real. */
async function sampleWorkbook(): Promise<Buffer> {
  const wb = createReportWorkbook();
  const ws = wb.addWorksheet('الملخص');
  addTitledTable(ws, {
    title: 'تقرير الوسيط — وساطة الرياض',
    filters: [['من', '2026-01-01'], ['إلى', '2026-05-31']],
    headers: ['المؤشر', 'القيمة'],
    rows: [['عقود موقّعة', 3]],
    widths: [30, 18],
  });
  return workbookToBuffer(wb);
}

describe('GET /portal/performance/export.xlsx · controller wiring', () => {
  let app: INestApplication;
  const performanceMock = {
    exportXlsx: jest.fn(async () => sampleWorkbook()),
    exportCsv: jest.fn(),
    forBroker: jest.fn(),
    agents: jest.fn(),
  };

  beforeAll(async () => {
    const stub = {};
    const moduleRef = await Test.createTestingModule({
      controllers: [BrokerPortalController],
      providers: [
        { provide: BrokerPortalService, useValue: stub },
        { provide: BrokerPortalLeadsService, useValue: stub },
        { provide: BrokerPortalVisitsService, useValue: stub },
        { provide: BrokerPortalActivityService, useValue: stub },
        { provide: BrokerPortalReservationsService, useValue: stub },
        { provide: BrokerPortalContractsService, useValue: stub },
        { provide: BrokerPortalCommissionsService, useValue: stub },
        { provide: BrokerPortalPayoutsService, useValue: stub },
        { provide: BrokerPortalPerformanceService, useValue: performanceMock },
        { provide: BrokerPortalTeamService, useValue: stub },
        // Needed only so the never-triggered BrokerCommissionsViewerGuard can construct.
        { provide: PrismaService, useValue: {} },
        { provide: APP_GUARD, useClass: FakeAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    })
      .overrideGuard(BrokerScopeGuard)
      .useValue(fakeScopeGuard)
      .overrideGuard(BrokerManagerGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => app?.close());
  beforeEach(() => {
    FakeAuthGuard.role = null;
    performanceMock.exportXlsx.mockClear();
  });

  function fetchXlsx(path: string) {
    return request(app.getHttpServer())
      .get(path)
      .buffer()
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
  }

  it('returns a real XLSX (PK) + content-type/attachment for a BROKER', async () => {
    FakeAuthGuard.role = UserRole.BROKER;
    const res = await fetchXlsx('/portal/performance/export.xlsx').expect(200);
    expect(res.headers['content-type']).toContain('spreadsheetml.sheet');
    expect(res.headers['content-disposition']).toContain('my-performance.xlsx');
    expect((res.body as Buffer).subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    // exportXlsx was invoked with the token-derived scope (broker-A) — not a param.
    expect(performanceMock.exportXlsx).toHaveBeenCalledWith(
      expect.objectContaining({ brokerId: 'broker-A' }),
      expect.anything(),
    );
  });

  it('opens with the expected sheet + applied filters, no fakes', async () => {
    FakeAuthGuard.role = UserRole.BROKER;
    const res = await fetchXlsx('/portal/performance/export.xlsx').expect(200);
    const wb = new Workbook();
    await wb.xlsx.load(res.body as unknown as ArrayBuffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['الملخص']);
    const flat: string[] = [];
    wb.eachSheet((ws) => ws.eachRow((r) => r.eachCell((c) => flat.push(String(c.value ?? '')))));
    const all = flat.join(' ');
    expect(all).toContain('تقرير الوسيط');
    expect(all).toContain('عوامل التصفية');
    expect(all).not.toMatch(/أحمد منصور|بيانات تجريبية|74%/);
  });

  it('is forbidden for non-BROKER roles (ADMIN / SALES / CUSTOMER)', async () => {
    for (const role of [UserRole.ADMIN, UserRole.SALES, UserRole.CUSTOMER]) {
      FakeAuthGuard.role = role;
      await request(app.getHttpServer()).get('/portal/performance/export.xlsx').expect(403);
    }
  });
});
