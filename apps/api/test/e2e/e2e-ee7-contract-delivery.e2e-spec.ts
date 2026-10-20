/**
 * EE7 — F10. A signed contract keeps the handover date it promised: the
 * unit's date at signing (or the one the contract states). When the phase's
 * or the unit's date moves past it, the contract shows the delay, the
 * delayed-contracts filter finds it, and the customer is told — once per
 * slip.
 */
import 'reflect-metadata';
import request from 'supertest';
import { UnitStatus, UserRole } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

describe('EE7 — the contract handover date (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  let companyId: string;
  let projectId = '';
  let phaseId = '';
  let buildingId = '';
  let customerId = '';
  const unitIds: string[] = [];
  const contractIds: string[] = [];
  const stamp = Date.now().toString().slice(-7);

  const http = () => request(testApp.app.getHttpServer());
  const asAdmin = <T extends request.Test>(r: T) => r.set('Authorization', bearer(adminToken));
  const notices = () =>
    testApp.rawPrisma.notification.count({ where: { userId: customerId, templateCode: 'delivery_delayed_customer' } });
  const signedContract = async (n: number, sign: Record<string, unknown> = {}) => {
    const unit = await testApp.rawPrisma.unit.create({
      data: { buildingId, companyId, code: `EE7-${stamp}-${n}`, type: '2BR', area: 100, price: 2_000_000, status: UnitStatus.AVAILABLE },
      select: { id: true },
    });
    unitIds.push(unit.id);
    const created = await asAdmin(http().post('/v1/contracts'))
      .send({ customerId, unitId: unit.id, totalAmount: 2_000_000, downPayment: 200_000 })
      .expect(201);
    contractIds.push(created.body.id);
    await asAdmin(http().post(`/v1/contracts/${created.body.id}/sign`))
      .send({ signedAt: new Date().toISOString(), ...sign })
      .expect(201);
    return { contractId: created.body.id as string, unitId: unit.id };
  };
  const contract = async (id: string) => (await asAdmin(http().get(`/v1/contracts/${id}`)).expect(200)).body;
  const delayedIds = async () =>
    ((await asAdmin(http().get('/v1/contracts?deliveryDelayed=true&pageSize=100')).expect(200)).body.data as Array<{ id: string }>).map(
      (c) => c.id,
    );

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    adminToken = await loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!');
    const raw = testApp.rawPrisma;
    companyId = (await raw.user.findUniqueOrThrow({ where: { id: fixtures.userIds.adminId } })).companyId!;
    projectId = (
      await raw.project.create({
        data: { companyId, code: `EE7-P-${stamp}`, name: { ar: 'مشروع EE7', en: 'EE7' }, description: { ar: '', en: '' }, city: 'Cairo', lat: 30, lng: 31 },
        select: { id: true },
      })
    ).id;
    phaseId = (
      await raw.phase.create({
        data: { companyId, projectId, code: 'EE7-PH', name: { ar: 'مرحلة', en: 'Phase' }, order: 0, deliveryDate: new Date('2027-06-30T00:00:00Z') },
        select: { id: true },
      })
    ).id;
    buildingId = (await raw.building.create({ data: { companyId, phaseId, code: 'EE7-B', name: 'B', order: 0 }, select: { id: true } })).id;
    customerId = (
      await raw.user.create({
        data: { companyId, role: UserRole.CUSTOMER, fullName: `EE7 Customer ${stamp}`, phone: `+2011${stamp}7`.slice(0, 13), locale: 'ar' },
        select: { id: true },
      })
    ).id;
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    await raw.notification.deleteMany({ where: { userId: customerId } });
    await raw.installment.deleteMany({ where: { plan: { contractId: { in: contractIds } } } });
    await raw.installmentPlan.deleteMany({ where: { contractId: { in: contractIds } } });
    await raw.bonusEntry.deleteMany({ where: { contractId: { in: contractIds } } });
    await raw.document.deleteMany({ where: { ownerId: { in: contractIds } } });
    await raw.auditLog.deleteMany({ where: { entityId: { in: [...contractIds, ...unitIds] } } });
    await raw.contract.deleteMany({ where: { id: { in: contractIds } } });
    await raw.unitStatusHistory.deleteMany({ where: { unitId: { in: unitIds } } });
    await raw.unit.deleteMany({ where: { id: { in: unitIds } } });
    if (projectId) await raw.project.deleteMany({ where: { id: projectId } });
    if (customerId) await raw.user.deleteMany({ where: { id: customerId } });
  });

  it('EE7-1: signing records the handover date the contract promises', async () => {
    const a = await signedContract(1);
    const b = await signedContract(2, { deliveryDate: '2027-03-31' });
    const ca = await contract(a.contractId);
    expect(ca.deliveryDate.slice(0, 10)).toBe('2027-06-30');
    expect(ca).toMatchObject({ expectedDeliveryDate: '2027-06-30', deliveryDelayDays: 0 });
    const cb = await contract(b.contractId);
    expect(cb.deliveryDate.slice(0, 10)).toBe('2027-03-31');
    expect(cb.deliveryDelayDays).toBe(91); // 31 Mar → 30 Jun
    expect(await delayedIds()).toEqual(expect.arrayContaining([b.contractId]));
    expect(await delayedIds()).not.toContain(a.contractId);
  });

  it('EE7-2: the phase moving past it shows the delay and tells the customer — once per slip', async () => {
    const [a, b] = contractIds;
    const before = await notices();
    await asAdmin(http().patch(`/v1/phases/${phaseId}`)).send({ deliveryDate: '2027-12-31' }).expect(200);
    // Both contracts now slip (a: newly, b: further).
    expect(await notices()).toBe(before + 2);
    const ca = await contract(a!);
    expect(ca).toMatchObject({ expectedDeliveryDate: '2027-12-31', deliveryDelayDays: 184 });
    expect(ca.deliveryDate.slice(0, 10)).toBe('2027-06-30');
    expect(await delayedIds()).toEqual(expect.arrayContaining([a, b]));

    // Earlier again but still late: no new notice. Later again: one each.
    await asAdmin(http().patch(`/v1/phases/${phaseId}`)).send({ deliveryDate: '2027-09-30' }).expect(200);
    expect(await notices()).toBe(before + 2);
    await asAdmin(http().patch(`/v1/phases/${phaseId}`)).send({ deliveryDate: '2028-01-31' }).expect(200);
    expect(await notices()).toBe(before + 4);
  });

  it("EE7-3: the unit's own date counts; the contract's date can be corrected", async () => {
    const [a] = contractIds;
    const unitId = unitIds[0]!;
    // Its own date, before the promised one: on time again.
    await asAdmin(http().patch(`/v1/units/${unitId}`)).send({ deliveryDate: '2027-05-31' }).expect(200);
    expect(await contract(a!)).toMatchObject({ expectedDeliveryDate: '2027-05-31', deliveryDelayDays: 0 });
    expect(await delayedIds()).not.toContain(a);

    // Pushed past it on the unit: told.
    const before = await notices();
    await asAdmin(http().patch(`/v1/units/${unitId}`)).send({ deliveryDate: '2027-08-31' }).expect(200);
    expect(await notices()).toBe(before + 1);

    // The contract's date corrected to what was actually agreed.
    await asAdmin(http().patch(`/v1/contracts/${a}`)).send({ deliveryDate: '2027-09-30' }).expect(200);
    expect(await contract(a!)).toMatchObject({ deliveryDelayDays: 0 });
  });
});
