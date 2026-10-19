/**
 * DD1 — a contract signed before the company used the system. It is entered
 * with its real signing date, quietly: no "contract signed" notifications
 * and no broker commission or sales bonus for a sale made back then. Its
 * schedule starts in the past, so every row due before it was entered shows
 * unpaid; what the customer paid back then is marked paid in one go, each
 * row on its own due date (the reports count it in that month).
 */
import 'reflect-metadata';
import request from 'supertest';
import { UnitStatus, UserRole } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';
import { companyTimeZone, startOfLocalToday } from '../../src/common/time/company-timezone';

describe('DD1 — contract signed before the system (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  let companyId: string;
  let buildingId: string;
  let customerId = '';
  const unitIds: string[] = [];
  const contractIds: string[] = [];
  const stamp = Date.now().toString().slice(-7);

  const http = () => request(testApp.app.getHttpServer());
  const asAdmin = <T extends request.Test>(r: T) => r.set('Authorization', bearer(adminToken));

  const freshUnit = async (n: number) => {
    const unit = await testApp.rawPrisma.unit.create({
      data: {
        buildingId,
        companyId,
        code: `DD1-${stamp}-${n}`,
        type: '2BR',
        area: 120,
        price: 1_200_000,
        status: UnitStatus.AVAILABLE,
      },
      select: { id: true },
    });
    unitIds.push(unit.id);
    return unit.id;
  };
  const createContract = async (n: number, preSystem?: boolean) => {
    const res = await asAdmin(http().post('/v1/contracts'))
      .send({
        customerId,
        unitId: await freshUnit(n),
        totalAmount: 1_200_000,
        downPayment: 200_000,
        lateFeesApply: true,
        ...(preSystem ? { preSystem: true } : {}),
      })
      .expect(201);
    contractIds.push(res.body.id);
    return res.body.id as string;
  };
  const rowsOf = (contractId: string) =>
    testApp.rawPrisma.installment.findMany({
      where: { plan: { contractId } },
      orderBy: [{ dueDate: 'asc' }, { type: 'asc' }],
      select: { id: true, type: true, status: true, dueDate: true, paidAt: true },
    });

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    adminToken = await loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!');
    companyId = (
      await testApp.rawPrisma.user.findUniqueOrThrow({ where: { id: fixtures.userIds.adminId } })
    ).companyId!;
    buildingId = (
      await testApp.rawPrisma.building.findFirstOrThrow({
        where: { phase: { projectId: fixtures.projects.p1Id } },
        select: { id: true },
      })
    ).id;
    customerId = (
      await testApp.rawPrisma.user.create({
        data: {
          companyId,
          role: UserRole.CUSTOMER,
          fullName: `DD1 Customer ${stamp}`,
          phone: `+2010${stamp}9`.slice(0, 13),
          locale: 'ar',
        },
        select: { id: true },
      })
    ).id;
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    await raw.deposit.deleteMany({ where: { contractId: { in: contractIds } } });
    await raw.installment.deleteMany({ where: { plan: { contractId: { in: contractIds } } } });
    await raw.installmentPlan.deleteMany({ where: { contractId: { in: contractIds } } });
    await raw.bonusEntry.deleteMany({ where: { contractId: { in: contractIds } } });
    await raw.document.deleteMany({ where: { ownerId: { in: contractIds } } });
    await raw.auditLog.deleteMany({ where: { entityId: { in: [...contractIds, ...unitIds] } } });
    await raw.notification.deleteMany({ where: { userId: customerId } });
    await raw.contract.deleteMany({ where: { id: { in: contractIds } } });
    await raw.unitStatusHistory.deleteMany({ where: { unitId: { in: unitIds } } });
    await raw.unit.deleteMany({ where: { id: { in: unitIds } } });
    await raw.user.deleteMany({ where: { id: customerId } });
  });

  it('DD1-1: signed on its real date, quietly — no notification, no bonus', async () => {
    const id = await createContract(1, true);
    const signed = await asAdmin(http().post(`/v1/contracts/${id}/sign`))
      .send({ signedAt: '2025-01-15T10:00:00.000Z' })
      .expect(201);
    expect(signed.body.status).toBe('ACTIVE');
    const contract = await testApp.rawPrisma.contract.findUniqueOrThrow({
      where: { id },
      select: { preSystem: true, signedAt: true },
    });
    expect(contract.preSystem).toBe(true);
    expect(contract.signedAt?.toISOString()).toBe('2025-01-15T10:00:00.000Z');
    expect(
      await testApp.rawPrisma.notification.count({
        where: { userId: customerId, templateCode: 'contract_signed_customer' },
      }),
    ).toBe(0);
    expect(await testApp.rawPrisma.bonusEntry.count({ where: { contractId: id } })).toBe(0);
  });

  it('DD1-2: what was paid before entry is marked paid, each row on its due date', async () => {
    const id = contractIds[0]!;
    await asAdmin(http().post('/v1/installment-plans'))
      .send({ contractId: id, totalMonths: 40, startsAt: '2025-02-01T00:00:00.000Z' })
      .expect(201);
    const entered = startOfLocalToday(await companyTimeZone(testApp.rawPrisma, companyId));

    // Up to the end of June 2026 first (the customer fell behind after).
    const first = await asAdmin(http().post('/v1/deposits/paid-before-system'))
      .send({ contractId: id, upTo: '2026-06-30' })
      .expect(201);
    let rows = await rowsOf(id);
    const juneEnd = new Date('2026-07-01T00:00:00.000Z');
    const paidFirst = rows.filter((r) => r.dueDate < juneEnd);
    expect(first.body.count).toBe(paidFirst.length);
    expect(paidFirst.length).toBe(18); // the down payment + Feb 2025 … Jun 2026
    for (const r of paidFirst) {
      expect(r.status).toBe('PAID');
      expect(r.paidAt?.toISOString()).toBe(r.dueDate.toISOString());
    }
    expect(rows.filter((r) => r.dueDate >= juneEnd).every((r) => r.status !== 'PAID')).toBe(true);

    // Then everything else due before the contract was entered.
    await asAdmin(http().post('/v1/deposits/paid-before-system')).send({ contractId: id }).expect(201);
    rows = await rowsOf(id);
    expect(rows.filter((r) => r.dueDate < entered).every((r) => r.status === 'PAID')).toBe(true);
    expect(rows.filter((r) => r.dueDate >= entered).every((r) => r.status !== 'PAID')).toBe(true);

    const deposits = await testApp.rawPrisma.deposit.findMany({
      where: { contractId: id },
      select: { paymentMethod: true, paidAt: true, installment: { select: { dueDate: true } } },
    });
    expect(deposits.length).toBe(rows.filter((r) => r.status === 'PAID').length);
    for (const d of deposits) {
      expect(d.paymentMethod).toBe('OTHER');
      expect(d.paidAt.toISOString()).toBe(d.installment!.dueDate.toISOString());
    }

    // Nothing left before entry.
    await asAdmin(http().post('/v1/deposits/paid-before-system')).send({ contractId: id }).expect(400);
  });

  it('DD1-3: only a contract signed before the system', async () => {
    const id = await createContract(2);
    await asAdmin(http().post('/v1/installment-plans'))
      .send({ contractId: id, totalMonths: 10, startsAt: '2025-02-01T00:00:00.000Z' })
      .expect(201);
    const res = await asAdmin(http().post('/v1/deposits/paid-before-system'))
      .send({ contractId: id })
      .expect(400);
    expect(res.body.message).toContain('ليس سابقاً على النظام');
  });
});
