/**
 * ST2 — an unsigned contract with payments due tells staff, never the
 * customer: the sales person on the deal, their sales manager and the
 * admins. Once when a payment is due, then once a week while it stays
 * unsigned; a signed, cancelled or not-yet-due contract alerts no one.
 */
import 'reflect-metadata';
import { ContractStatus, ReservationStatus, UnitStatus } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';

const CODE = 'unsigned_contract_due';
const DAY = 24 * 60 * 60_000;

describe('ST2 — unsigned contract alerts (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let companyId = '';
  let projectId = '';
  let buildingId = '';
  let salesManagerBefore: string | null = null;
  const contractIds: string[] = [];
  const unitIds: string[] = [];
  const reservationIds: string[] = [];
  const stamp = Date.now().toString().slice(-7);
  const started = new Date();

  const sent = async (userId: string, contractId: string) =>
    (
      await testApp.rawPrisma.notification.findMany({
        where: { userId, templateCode: CODE, createdAt: { gte: started } },
        select: { payload: true },
      })
    ).filter((n) => (n.payload as { contractId?: string }).contractId === contractId).length;

  /** A contract on its own unit, made from a reservation by the seeded sales rep. */
  const contract = async (
    n: number,
    opts: { status: ContractStatus; dueInDays: number; cancelled?: boolean },
  ) => {
    const raw = testApp.rawPrisma;
    const unit = await raw.unit.create({
      data: {
        companyId,
        buildingId,
        code: `ST2-U${n}-${stamp}`,
        type: 'APARTMENT',
        area: 100,
        price: 1_000_000,
        status: UnitStatus.SOLD,
      },
      select: { id: true },
    });
    unitIds.push(unit.id);
    const reservation = await raw.reservation.create({
      data: {
        companyId,
        unitId: unit.id,
        salesId: fixtures.userIds.salesId,
        clientId: fixtures.userIds.customer1UserId,
        expiresAt: new Date(Date.now() - DAY),
        status: ReservationStatus.CONVERTED,
      },
      select: { id: true },
    });
    reservationIds.push(reservation.id);
    const c = await raw.contract.create({
      data: {
        companyId,
        customerId: fixtures.userIds.customer1UserId,
        unitId: unit.id,
        reservationId: reservation.id,
        contractNumber: `ST2-${n}-${stamp}`,
        totalAmount: 1_000_000,
        downPayment: 100_000,
        status: opts.status,
        signedAt: opts.status === ContractStatus.ACTIVE ? new Date() : null,
        cancelledAt: opts.cancelled ? new Date() : null,
      },
      select: { id: true },
    });
    contractIds.push(c.id);
    await raw.installmentPlan.create({
      data: {
        companyId,
        contractId: c.id,
        totalMonths: 10,
        monthlyAmount: 90_000,
        startsAt: new Date(),
        cancelledAt: opts.cancelled ? new Date() : null,
        installments: {
          create: [
            {
              companyId,
              type: 'DOWN_PAYMENT',
              dueDate: new Date(Date.now() + opts.dueInDays * DAY),
              amount: 100_000,
            },
            {
              companyId,
              type: 'INSTALLMENT',
              dueDate: new Date(Date.now() + (opts.dueInDays + 30) * DAY),
              amount: 90_000,
            },
          ],
        },
      },
    });
    return c.id;
  };

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    const raw = testApp.rawPrisma;
    companyId = (await raw.user.findUniqueOrThrow({ where: { id: fixtures.userIds.adminId } }))
      .companyId!;
    // The rep reports to the seeded sales manager for this suite.
    const rep = await raw.user.findUniqueOrThrow({ where: { id: fixtures.userIds.salesId } });
    salesManagerBefore = rep.managerId;
    await raw.user.update({
      where: { id: rep.id },
      data: { managerId: fixtures.userIds.managerId },
    });
    projectId = (
      await raw.project.create({
        data: {
          companyId,
          code: `ST2-${stamp}`,
          name: { ar: 'مشروع', en: 'ST2' },
          description: { ar: 'و', en: 'd' },
          city: 'Cairo',
          lat: 30,
          lng: 31,
        },
      })
    ).id;
    const phase = await raw.phase.create({
      data: { companyId, projectId, code: `ST2-PH-${stamp}`, name: { ar: 'م', en: 'P' } },
    });
    buildingId = (
      await raw.building.create({
        data: { companyId, phaseId: phase.id, code: `ST2-B-${stamp}`, name: 'B' },
      })
    ).id;
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    await raw.user.update({
      where: { id: fixtures.userIds.salesId },
      data: { managerId: salesManagerBefore },
    });
    await raw.notification.deleteMany({
      where: { templateCode: CODE, createdAt: { gte: started } },
    });
    await raw.installment.deleteMany({ where: { plan: { contractId: { in: contractIds } } } });
    await raw.installmentPlan.deleteMany({ where: { contractId: { in: contractIds } } });
    await raw.contract.deleteMany({ where: { id: { in: contractIds } } });
    await raw.reservation.deleteMany({ where: { id: { in: reservationIds } } });
    await raw.unit.deleteMany({ where: { id: { in: unitIds } } });
    await raw.building.deleteMany({ where: { id: buildingId } });
    await raw.phase.deleteMany({ where: { projectId } });
    await raw.project.deleteMany({ where: { id: projectId } });
  });

  it('ST2-1: the rep, their manager and the admins hear of it; the customer never does', async () => {
    const id = await contract(1, { status: ContractStatus.UNSIGNED, dueInDays: -3 });
    await testApp.runCronJob('unsigned-contract-alerts');
    expect(await sent(fixtures.userIds.salesId, id)).toBe(1);
    expect(await sent(fixtures.userIds.managerId, id)).toBe(1);
    expect(await sent(fixtures.userIds.adminId, id)).toBe(1);
    expect(await sent(fixtures.userIds.customer1UserId, id)).toBe(0);
    const n = await testApp.rawPrisma.notification.findFirstOrThrow({
      where: { userId: fixtures.userIds.adminId, templateCode: CODE, createdAt: { gte: started } },
    });
    // Only the down payment is due yet.
    expect(n.payload).toMatchObject({
      entityType: 'contract',
      entityId: id,
      count: 1,
      total: '100,000',
    });
  });

  it('ST2-2: no second alert within the week, another one after it', async () => {
    const id = contractIds[0]!;
    await testApp.runCronJob('unsigned-contract-alerts');
    expect(await sent(fixtures.userIds.salesId, id)).toBe(1);
    // A week on: the earlier alerts are older than seven days.
    await testApp.rawPrisma.notification.updateMany({
      where: { templateCode: CODE, payload: { path: ['contractId'], equals: id } },
      data: { createdAt: new Date(Date.now() - 8 * DAY) },
    });
    await testApp.runCronJob('unsigned-contract-alerts');
    const rows = await testApp.rawPrisma.notification.count({
      where: {
        userId: fixtures.userIds.salesId,
        templateCode: CODE,
        payload: { path: ['contractId'], equals: id },
      },
    });
    expect(rows).toBe(2);
  });

  it('ST2-3: signed, cancelled and not-yet-due contracts alert no one', async () => {
    const signed = await contract(2, { status: ContractStatus.ACTIVE, dueInDays: -3 });
    const cancelled = await contract(3, {
      status: ContractStatus.CANCELLED,
      dueInDays: -3,
      cancelled: true,
    });
    const later = await contract(4, { status: ContractStatus.UNSIGNED, dueInDays: 5 });
    await testApp.runCronJob('unsigned-contract-alerts');
    for (const id of [signed, cancelled, later]) {
      expect(await sent(fixtures.userIds.adminId, id)).toBe(0);
    }
  });
});
