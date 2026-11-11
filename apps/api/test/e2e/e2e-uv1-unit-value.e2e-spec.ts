/**
 * UV1 — «قيمة وحدتك»: an owner's unit valued today against what they paid,
 * from the company's current price per meter for units like it in the same
 * project. Off until the company turns it on; only a rise shows unless it
 * asks for falls too; nothing without a price to compare.
 */
import 'reflect-metadata';
import request from 'supertest';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { bearer, loginAs } from '../helpers/login';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';

const t = (ar: string, en = ar) => ({ ar, en });

describe('UV1 — unit value (e2e)', () => {
  let testApp: TestApp;
  let adminToken: string;
  let customerToken: string;
  let otherCustomerToken: string;
  let companyId: string;
  let projectId: string;
  let forSaleId: string;
  let ownedId: string;
  let contractId: string;
  let customerId: string;
  let fixtures: E2EFixtures;
  const stamp = Date.now().toString().slice(-7);
  const TYPE = `UV${stamp}`;

  const http = () => request(testApp.app.getHttpServer());
  const asAdmin = <T extends request.Test>(r: T) => r.set('Authorization', bearer(adminToken));
  const setting = (key: string, value: boolean) => asAdmin(http().patch(`/v1/settings/${key}`)).send({ value }).expect(200);
  const values = (token = customerToken) => http().get('/v1/me/unit-values').set('Authorization', bearer(token)).expect(200);
  const mine = async () => (await values()).body.items.filter((i: { contractId: string }) => i.contractId === contractId);

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    [adminToken, customerToken, otherCustomerToken] = await Promise.all([
      loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!'),
      loginAs(testApp.app, fixtures.users.CUSTOMER_1.email, fixtures.users.CUSTOMER_1.password, 'customer'),
      loginAs(testApp.app, fixtures.users.CUSTOMER_2.email, fixtures.users.CUSTOMER_2.password, 'customer'),
    ]);
    companyId = (await testApp.rawPrisma.user.findUniqueOrThrow({ where: { id: fixtures.userIds.adminId } })).companyId!;
    customerId = (await testApp.rawPrisma.contract.findUniqueOrThrow({ where: { id: fixtures.flowE.customer1ContractId } })).customerId;
    // A project of its own: one unit owned by customer1 (bought at 30,000/m²)
    // and one of the same type for sale.
    const p = await testApp.rawPrisma.project.create({
      data: { companyId, code: `UV1-${stamp}`, name: t('مشروع القيمة', 'Value'), description: t('—'), city: 'دمياط الجديدة', lat: 31.4, lng: 31.8 },
      select: { id: true },
    });
    projectId = p.id;
    const phase = await testApp.rawPrisma.phase.create({ data: { companyId, projectId, name: t('المرحلة 1') }, select: { id: true } });
    const building = await testApp.rawPrisma.building.create({ data: { companyId, phaseId: phase.id, name: 'B1' }, select: { id: true } });
    const unit = (code: string, price: number, status: 'AVAILABLE' | 'SOLD') =>
      testApp.rawPrisma.unit.create({
        data: { companyId, buildingId: building.id, code, type: TYPE, area: 100, price, pricePerMeter: price / 100, status },
        select: { id: true },
      });
    ownedId = (await unit(`UV1-O-${stamp}`, 3_000_000, 'SOLD')).id;
    forSaleId = (await unit(`UV1-A-${stamp}`, 2_800_000, 'AVAILABLE')).id;
    contractId = (
      await testApp.rawPrisma.contract.create({
        data: { companyId, customerId, unitId: ownedId, totalAmount: 3_000_000, status: 'ACTIVE', signedAt: new Date('2025-06-01T00:00:00Z') },
        select: { id: true },
      })
    ).id;
  });

  afterAll(async () => {
    await testApp.rawPrisma.setting.deleteMany({ where: { companyId, key: { in: ['unitValue.enabled', 'unitValue.showDecrease', 'unitValue.notifyRise'] } } });
    await testApp.rawPrisma.notification.deleteMany({ where: { userId: customerId, templateCode: 'unit_value_rise_customer' } });
    await testApp.rawPrisma.contract.deleteMany({ where: { id: contractId } });
    await testApp.rawPrisma.project.deleteMany({ where: { id: projectId } });
  });

  it('UV1-1: nothing while the company has it off (the default)', async () => {
    await testApp.rawPrisma.setting.deleteMany({ where: { companyId, key: 'unitValue.enabled' } });
    expect((await values()).body).toEqual({ enabled: false, items: [] });
  });

  it('UV1-2: on — a fall (28,000/m² now) stays hidden unless the company shows falls', async () => {
    await setting('unitValue.enabled', true);
    expect(await mine()).toEqual([]);
    await setting('unitValue.showDecrease', true);
    const [item] = await mine();
    expect(item).toMatchObject({ purchasePrice: '3000000.00', currentPricePerMeter: '28000.00', gain: '-200000.00', gainPct: -6.7, basis: 'TYPE', source: 'MARKET' });
    await setting('unitValue.showDecrease', false);
  });

  it('UV1-3: a reprice moves the value, is recorded for the chart, and shows the rise', async () => {
    await asAdmin(http().post('/v1/units/reprice')).send({ projectId, type: TYPE, pricePerMeter: 36_000 }).expect(200);
    const [item] = await mine();
    expect(item).toMatchObject({ currentPricePerMeter: '36000.00', currentValue: '3600000.00', gain: '600000.00', gainPct: 20 });
    expect(item.history[0]).toEqual({ date: '2025-06-01T00:00:00.000Z', pricePerMeter: 30_000 });
    expect(item.history.at(-1).pricePerMeter).toBe(36_000);
    const recorded = await testApp.rawPrisma.unitPriceRate.findMany({ where: { projectId, unitType: TYPE, source: 'MARKET' } });
    expect(recorded.map((r) => Number(r.pricePerMeter))).toContain(36_000);
  });

  it('UV1-4: sold out — the company’s own figure values it; with none at all, nothing shows', async () => {
    await testApp.rawPrisma.unit.update({ where: { id: forSaleId }, data: { status: 'SOLD' } });
    expect(await mine()).toEqual([]);
    const rates = await asAdmin(http().put(`/v1/projects/${projectId}/price-rates`)).send({ unitType: TYPE.toLowerCase(), pricePerMeter: 40_000 }).expect(200);
    expect(rates.body.types).toEqual([
      expect.objectContaining({ unitType: TYPE, units: 2, forSale: 0, marketPricePerMeter: null, manual: expect.objectContaining({ pricePerMeter: '40000.00' }) }),
    ]);
    const [item] = await mine();
    expect(item).toMatchObject({ currentPricePerMeter: '40000.00', gain: '1000000.00', source: 'MANUAL' });
  });

  it('UV1-5: another customer does not see it, and a customer cannot set prices', async () => {
    const other = (await values(otherCustomerToken)).body.items as Array<{ contractId: string }>;
    expect(other.some((i) => i.contractId === contractId)).toBe(false);
    await http()
      .put(`/v1/projects/${projectId}/price-rates`)
      .set('Authorization', bearer(customerToken))
      .send({ pricePerMeter: 1 })
      .expect(403);
  });

  it('UV1-6: the owner is told the value rose — once in 30 days, again only for a further rise, never when the company turns it off', async () => {
    const notices = () =>
      testApp.rawPrisma.notification.findMany({
        where: { userId: customerId, templateCode: 'unit_value_rise_customer', payload: { path: ['contractId'], equals: contractId } },
        orderBy: { createdAt: 'asc' },
      });
    await testApp.rawPrisma.notification.deleteMany({ where: { userId: customerId, templateCode: 'unit_value_rise_customer' } });

    // Off by the company → nothing.
    await setting('unitValue.notifyRise', false);
    await testApp.runCronJob('unit-value-rise');
    expect(await notices()).toHaveLength(0);

    // On (the default): 4,000,000 today against 3,000,000 paid.
    await testApp.rawPrisma.setting.deleteMany({ where: { companyId, key: 'unitValue.notifyRise' } });
    await testApp.runCronJob('unit-value-rise');
    const [first] = await notices();
    expect(first).toBeDefined();
    expect(first!.payload).toMatchObject({ entityType: 'unit_value', contractId, amount: '4000000.00', gainPct: '33.3' });
    expect(first!.companyId).toBe(companyId);

    // Again the same day → no second notice.
    await testApp.runCronJob('unit-value-rise');
    expect(await notices()).toHaveLength(1);

    // 31 days later with no further rise → none; after a 2.5% rise → one more.
    await testApp.rawPrisma.notification.update({ where: { id: first!.id }, data: { createdAt: new Date(Date.now() - 31 * 24 * 60 * 60_000) } });
    await testApp.runCronJob('unit-value-rise');
    expect(await notices()).toHaveLength(1);
    await asAdmin(http().put(`/v1/projects/${projectId}/price-rates`)).send({ unitType: TYPE, pricePerMeter: 41_000 }).expect(200);
    await testApp.runCronJob('unit-value-rise');
    const all = await notices();
    expect(all).toHaveLength(2);
    expect(all[1]!.payload).toMatchObject({ amount: '4100000.00' });
  });
});
