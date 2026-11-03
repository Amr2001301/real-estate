/**
 * ST1 — the customer's statement of account (كشف حساب) in the customer app.
 * `GET /contracts/me/contracts/:id/statement` gives the customer the same
 * figures staff see on the contract page, for their own contract only, without
 * staff names (who reversed a payment) or internal deposit ids.
 */
import 'reflect-metadata';
import * as argon2 from 'argon2';
import request from 'supertest';
import { PlanPaymentType, UnitStatus, UserRole } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

describe('ST1 — customer statement of account (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  let companyId: string;
  let projectId = '';
  let unitId = '';
  let contractId = '';
  const customerIds: string[] = [];
  const stamp = Date.now().toString().slice(-7);

  const http = () => request(testApp.app.getHttpServer());
  const asAdmin = <T extends request.Test>(r: T) => r.set('Authorization', bearer(adminToken));
  const customer = async (n: number) => {
    const u = await testApp.rawPrisma.user.create({
      data: {
        companyId,
        role: UserRole.CUSTOMER,
        fullName: `ST1 Customer ${n} ${stamp}`,
        phone: `+2012${stamp}${n}`.slice(0, 13),
        email: `st1-${n}-${stamp}@example.com`,
        passwordHash: await argon2.hash('StrongPass1!'),
        locale: 'ar',
      },
      select: { id: true },
    });
    customerIds.push(u.id);
    return u.id;
  };
  const tokenOf = (n: number) =>
    loginAs(testApp.app, `st1-${n}-${stamp}@example.com`, 'StrongPass1!', 'customer');

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    adminToken = await loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!');
    const raw = testApp.rawPrisma;
    companyId = (await raw.user.findUniqueOrThrow({ where: { id: fixtures.userIds.adminId } }))
      .companyId!;
    projectId = (
      await raw.project.create({
        data: {
          companyId,
          code: `ST1-P-${stamp}`,
          name: { ar: 'مشروع ST1', en: 'ST1' },
          description: { ar: '', en: '' },
          city: 'Cairo',
          lat: 30,
          lng: 31,
        },
        select: { id: true },
      })
    ).id;
    const phaseId = (
      await raw.phase.create({
        data: {
          companyId,
          projectId,
          code: 'ST1-PH',
          name: { ar: 'مرحلة', en: 'Phase' },
          order: 0,
        },
        select: { id: true },
      })
    ).id;
    const buildingId = (
      await raw.building.create({
        data: { companyId, phaseId, code: 'ST1-B', name: 'B', order: 0 },
        select: { id: true },
      })
    ).id;
    unitId = (
      await raw.unit.create({
        data: {
          buildingId,
          companyId,
          code: `ST1-${stamp}`,
          type: '2BR',
          area: 100,
          price: 1_000_000,
          status: UnitStatus.AVAILABLE,
        },
        select: { id: true },
      })
    ).id;
    const owner = await customer(1);
    await customer(2);
    contractId = (
      await asAdmin(http().post('/v1/contracts'))
        .send({ customerId: owner, unitId, totalAmount: 1_000_000, downPayment: 100_000 })
        .expect(201)
    ).body.id;
    await asAdmin(http().post(`/v1/contracts/${contractId}/sign`))
      .send({ signedAt: new Date().toISOString() })
      .expect(201);
    await asAdmin(http().post('/v1/installment-plans'))
      .send({ contractId, totalMonths: 10, startsAt: '2027-02-01' })
      .expect(201);

    // A payment recorded, then reversed by staff: the reversal carries a staff name.
    const row = await raw.installment.findFirstOrThrow({
      where: { plan: { contractId }, type: PlanPaymentType.INSTALLMENT },
      orderBy: { dueDate: 'asc' },
    });
    const dep = await asAdmin(http().post('/v1/deposits'))
      .send({
        contractId,
        installmentId: row.id,
        amount: Number(row.amount),
        paymentMethod: 'CASH',
      })
      .expect(201);
    await asAdmin(http().post(`/v1/deposits/${dep.body.id}/reverse`))
      .send({ reason: 'ST1 wrong amount' })
      .expect(201);
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    const deposits = await raw.deposit.findMany({ where: { contractId }, select: { id: true } });
    const depositIds = deposits.map((d) => d.id);
    await raw.paymentCorrection.deleteMany({ where: { depositId: { in: depositIds } } });
    await raw.auditLog.deleteMany({
      where: { entityId: { in: [contractId, unitId, ...depositIds] } },
    });
    await raw.deposit.deleteMany({ where: { id: { in: depositIds } } });
    await raw.notification.deleteMany({ where: { userId: { in: customerIds } } });
    await raw.installment.deleteMany({ where: { plan: { contractId } } });
    await raw.installmentPlan.deleteMany({ where: { contractId } });
    await raw.bonusEntry.deleteMany({ where: { contractId } });
    await raw.document.deleteMany({ where: { ownerId: contractId } });
    if (contractId) await raw.contract.deleteMany({ where: { id: contractId } });
    await raw.unitStatusHistory.deleteMany({ where: { unitId } });
    if (unitId) await raw.unit.deleteMany({ where: { id: unitId } });
    if (projectId) await raw.project.deleteMany({ where: { id: projectId } });
    await raw.user.deleteMany({ where: { id: { in: customerIds } } });
  });

  it('ST1-1: the owner gets the same figures staff see, without staff names or deposit ids', async () => {
    const staff = (await asAdmin(http().get(`/v1/contracts/${contractId}/statement`)).expect(200))
      .body;
    const token = await tokenOf(1);
    const mine = (
      await http()
        .get(`/v1/contracts/me/contracts/${contractId}/statement`)
        .set('Authorization', bearer(token))
        .expect(200)
    ).body;
    expect(mine.totals).toEqual(staff.totals);
    expect(mine.asOf).toBe(staff.asOf);
    expect(mine.lines).toHaveLength(staff.lines.length);
    const reversal = mine.lines.find((l: { kind: string }) => l.kind === 'REVERSAL');
    expect(reversal).toMatchObject({ reason: 'ST1 wrong amount' });
    expect(staff.lines.find((l: { kind: string }) => l.kind === 'REVERSAL').by).toBeTruthy();
    for (const l of mine.lines) {
      expect(l).not.toHaveProperty('by');
      expect(l).not.toHaveProperty('depositId');
    }
  });

  it('ST1-2: another customer, and the staff route, are refused', async () => {
    const other = await tokenOf(2);
    await http()
      .get(`/v1/contracts/me/contracts/${contractId}/statement`)
      .set('Authorization', bearer(other))
      .expect(404);
    const owner = await tokenOf(1);
    await http()
      .get(`/v1/contracts/${contractId}/statement`)
      .set('Authorization', bearer(owner))
      .expect(403);
  });
});
