import { CanActivate, ExecutionContext, Global, INestApplication, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { UserRole } from '@prisma/client';
import { ReportsModule } from '../reports.module';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { PrismaService } from '../../../common/prisma/prisma.service';

/**
 * F5 — documents/receipts health. A fixture-driven Prisma mock evaluates the
 * deposit/contract `where` (verified, receiptUrl conditions, signedAt/pdfUrl,
 * and the `id.notIn` doc-owner exclusion) against an in-memory dataset so the
 * health counts/amounts reflect real owner+category document existence.
 */

class FakeAuthGuard implements CanActivate {
  static currentUser: { sub: string; role: UserRole; codes: string[] } | null = null;
  canActivate(context: ExecutionContext): boolean {
    if (!FakeAuthGuard.currentUser) return false;
    const req = context.switchToHttp().getRequest();
    req.user = { sub: FakeAuthGuard.currentUser.sub, role: FakeAuthGuard.currentUser.role, email: null, phone: null };
    return true;
  }
}

interface Dep { id: string; verified: boolean; receiptUrl: string | null; amount: number }
interface Con { id: string; signedAt: Date | null; pdfUrl: string | null; totalAmount: number }

// d3 has a RECEIPT document; c3 has a CONTRACT document.
const DEPOSITS: Dep[] = [
  { id: 'd1', verified: true, receiptUrl: null, amount: 100 },
  { id: 'd2', verified: true, receiptUrl: 'https://u/2.pdf', amount: 200 },
  { id: 'd3', verified: true, receiptUrl: null, amount: 300 },
  { id: 'd4', verified: false, receiptUrl: null, amount: 400 },
];
const DEP_DOC_OWNERS = ['d3'];
const CONTRACTS: Con[] = [
  { id: 'c1', signedAt: new Date('2030-01-01'), pdfUrl: null, totalAmount: 1000 },
  { id: 'c2', signedAt: null, pdfUrl: 'https://u/c2.pdf', totalAmount: 2000 },
  { id: 'c3', signedAt: new Date('2030-02-01'), pdfUrl: null, totalAmount: 3000 },
];
const CONTRACT_DOC_OWNERS = ['c3'];

// Merge an `{ AND: [...] }` where into a single predicate (no opts filters in
// this test, so each AND has one element).
function flat(where: Record<string, unknown>): Record<string, unknown> {
  if (Array.isArray(where.AND)) return Object.assign({}, ...(where.AND as Record<string, unknown>[]));
  return where;
}

function depMatches(dep: Dep, where: Record<string, unknown>): boolean {
  const p = flat(where);
  if (p.verified !== undefined && dep.verified !== p.verified) return false;
  const id = p.id as { notIn?: string[] } | undefined;
  if (id?.notIn && id.notIn.includes(dep.id)) return false;
  if (p.receiptUrl !== undefined) {
    const r = p.receiptUrl as null | { not: null };
    if (r === null && dep.receiptUrl !== null) return false;
    if (r && 'not' in r && r.not === null && dep.receiptUrl === null) return false;
  }
  if (Array.isArray(p.OR)) {
    const ok = (p.OR as Array<{ receiptUrl?: string | null }>).some(
      (o) => (o.receiptUrl === null && dep.receiptUrl === null) || (o.receiptUrl === '' && dep.receiptUrl === ''),
    );
    if (!ok) return false;
  }
  return true;
}

function conMatches(con: Con, where: Record<string, unknown>): boolean {
  const p = flat(where);
  const id = p.id as { notIn?: string[] } | undefined;
  if (id?.notIn && id.notIn.includes(con.id)) return false;
  if (p.signedAt !== undefined) {
    const s = p.signedAt as { not: null };
    if (s.not === null && con.signedAt === null) return false;
  }
  if (p.pdfUrl !== undefined) {
    const pf = p.pdfUrl as { not: null };
    if (pf.not === null && con.pdfUrl === null) return false;
  }
  return true;
}

function makePrismaMock() {
  const aggDep = jest.fn().mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
    const rows = DEPOSITS.filter((d) => depMatches(d, where));
    return { _sum: { amount: rows.reduce((a, d) => a + d.amount, 0) }, _count: { _all: rows.length } };
  });
  const aggCon = jest.fn().mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
    const rows = CONTRACTS.filter((c) => conMatches(c, where));
    return { _sum: { totalAmount: rows.reduce((a, c) => a + c.totalAmount, 0) }, _count: { _all: rows.length } };
  });
  const zeroAgg = jest.fn().mockResolvedValue({ _sum: {}, _count: { _all: 0 } });
  const emptyArr = jest.fn().mockResolvedValue([]);
  const zero = jest.fn().mockResolvedValue(0);
  return {
    userPermission: { findMany: jest.fn().mockResolvedValue([]) },
    contract: { count: zero, aggregate: aggCon, findMany: emptyArr },
    deposit: { count: zero, aggregate: aggDep, findMany: emptyArr, groupBy: emptyArr },
    installment: { count: zero, aggregate: zeroAgg, findMany: emptyArr },
    reservation: { groupBy: emptyArr, count: zero, aggregate: jest.fn().mockResolvedValue({ _sum: { bookingAmount: 0 } }) },
    bonusEntry: { aggregate: zeroAgg },
    brokerCommission: { aggregate: jest.fn().mockResolvedValue({ _sum: { netAmount: 0 }, _count: { _all: 0 } }) },
    brokerPayout: { groupBy: emptyArr },
    document: {
      findMany: jest.fn().mockImplementation(async ({ where }: { where: { ownerType: string } }) =>
        where.ownerType === 'DEPOSIT'
          ? DEP_DOC_OWNERS.map((ownerId) => ({ ownerId }))
          : CONTRACT_DOC_OWNERS.map((ownerId) => ({ ownerId })),
      ),
    },
  };
}

describe('Reports · documents/receipts health (F5)', () => {
  let app: INestApplication;
  let health: {
    depositsMissingReceipt: { count: number; amount: string };
    verifiedDepositsMissingReceiptDocument: { count: number; amount: string };
    depositsWithLegacyReceiptUrlMissingDocument: { count: number; amount: string };
    signedContractsMissingDocument: { count: number; amount: string };
    contractsWithLegacyPdfUrlMissingDocument: { count: number; amount: string };
  };

  beforeAll(async () => {
    const mock = makePrismaMock();

    @Global()
    @Module({ providers: [{ provide: PrismaService, useValue: mock }], exports: [PrismaService] })
    class MockPrismaModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [MockPrismaModule, ReportsModule],
      providers: [
        { provide: APP_GUARD, useClass: FakeAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    FakeAuthGuard.currentUser = { sub: 'admin-1', role: UserRole.ADMIN, codes: [] };
    const res = await request(app.getHttpServer()).get('/reports/financial-dashboard').expect(200);
    health = res.body.documentsHealth;
  });

  afterAll(async () => await app.close());

  it('counts verified deposits with no receiptUrl and no receipt document', () => {
    // d1 only (d3 has a doc, d4 not verified, d2 has receiptUrl).
    expect(health.depositsMissingReceipt).toEqual({ count: 1, amount: '100' });
  });

  it('counts verified deposits with no receipt document (excludes those that have one)', () => {
    // d1 + d2 (d3 excluded via doc owner-id, d4 not verified).
    expect(health.verifiedDepositsMissingReceiptDocument).toEqual({ count: 2, amount: '300' });
  });

  it('counts legacy receiptUrl deposits missing a linked document', () => {
    // d2 only (has receiptUrl, no doc).
    expect(health.depositsWithLegacyReceiptUrlMissingDocument).toEqual({ count: 1, amount: '200' });
  });

  it('counts signed contracts with no contract document', () => {
    // c1 only (c3 has a doc, c2 not signed).
    expect(health.signedContractsMissingDocument).toEqual({ count: 1, amount: '1000' });
  });

  it('counts legacy pdfUrl contracts missing a linked document', () => {
    // c2 only.
    expect(health.contractsWithLegacyPdfUrlMissingDocument).toEqual({ count: 1, amount: '2000' });
  });
});
