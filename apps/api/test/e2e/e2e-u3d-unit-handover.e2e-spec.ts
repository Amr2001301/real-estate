/**
 * U3d — the unit handover (round-4 decision 1).
 *
 * - A signed contract's unit is not under warranty, and its customer cannot
 *   file maintenance, until the unit is handed over.
 * - Recording the handover (date + checklist) starts the warranties from its
 *   date and opens maintenance; it is recorded once, not in the future.
 * - After a swap, the new unit is the one handed over and its warranties
 *   start at the swap date.
 */
import 'reflect-metadata';
import request from 'supertest';
import { ContractStatus, UnitStatus, UserRole } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

const DAY = 86_400_000;
const day = (d: Date) => d.toISOString().slice(0, 10);

describe('U3d — unit handover (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  let customerToken: string;
  let companyId: string;
  let categoryId: string;
  let customerId: string;
  let units: Array<{ id: string; status: UnitStatus }>;
  let contractId: string;
  const itemIds: string[] = [];
  const stamp = Date.now().toString().slice(-8);
  const startedAt = new Date();

  const http = () => request(testApp.app.getHttpServer());
  const asAdmin = <T extends request.Test>(r: T) => r.set('Authorization', bearer(adminToken));
  const item = (unitId: string) =>
    testApp.rawPrisma.unitMaintenanceItem.findFirstOrThrow({ where: { unitId, id: { in: itemIds } } });
  const fileMaintenance = (unitId: string) =>
    http()
      .post('/v1/me/maintenance-requests')
      .set('Authorization', bearer(customerToken))
      .send({ unitId, categoryIds: [categoryId], description: 'U3d leak' });

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    adminToken = await loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!');
    const raw = testApp.rawPrisma;
    companyId = (await raw.user.findUniqueOrThrow({ where: { id: fixtures.userIds.adminId } })).companyId!;
    categoryId = (await raw.maintenanceCategory.findFirstOrThrow({ where: { companyId, active: true }, select: { id: true } })).id;
    customerId = (
      await raw.user.create({
        data: { companyId, role: UserRole.CUSTOMER, fullName: 'U3d Customer', phone: `+2018${stamp}`, locale: 'ar' },
        select: { id: true },
      })
    ).id;
    customerToken = await testApp.signAccessToken(customerId, UserRole.CUSTOMER);
    units = await raw.unit.findMany({
      where: { companyId, status: UnitStatus.AVAILABLE, contracts: { none: {} }, reservations: { none: {} } },
      select: { id: true, status: true },
      take: 2,
    });
    expect(units).toHaveLength(2);
    for (const u of units) {
      itemIds.push(
        (
          await raw.unitMaintenanceItem.create({
            data: { companyId, unitId: u.id, categoryId, name: { ar: 'سباكة', en: 'Plumbing' }, warrantyDurationMonthsSnapshot: 12 },
            select: { id: true },
          })
        ).id,
      );
    }
    await raw.unit.update({ where: { id: units[0]!.id }, data: { status: UnitStatus.SOLD } });
    contractId = (
      await raw.contract.create({
        data: {
          companyId, customerId, unitId: units[0]!.id, totalAmount: 100_000, status: ContractStatus.ACTIVE,
          signedAt: new Date(Date.now() - 20 * DAY), createdAt: new Date(Date.now() - 30 * DAY), contractNumber: `U3D-${stamp}`,
        },
        select: { id: true },
      })
    ).id;
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    await raw.maintenanceRequestItem.deleteMany({ where: { request: { customerId } } });
    await raw.maintenanceRequest.deleteMany({ where: { customerId } });
    await raw.unitHandover.deleteMany({ where: { contractId } });
    await raw.unitMaintenanceItem.deleteMany({ where: { id: { in: itemIds } } });
    await raw.auditLog.deleteMany({ where: { entityId: contractId, createdAt: { gte: startedAt } } });
    await raw.contractAmendment.deleteMany({ where: { contractId } });
    await raw.contract.deleteMany({ where: { id: contractId } });
    for (const u of units) await raw.unit.update({ where: { id: u.id }, data: { status: u.status } });
    await raw.notification.deleteMany({ where: { userId: customerId } });
    await raw.refreshToken.deleteMany({ where: { userId: customerId } });
    await raw.user.deleteMany({ where: { id: customerId } });
  });

  it('H-1: before the handover there is no warranty, and maintenance is not open', async () => {
    expect((await item(units[0]!.id)).warrantyStart).toBeNull();
    const res = await fileMaintenance(units[0]!.id);
    expect(res.status).toBe(400);
    expect(res.body.code ?? res.body.message?.code).toBe('MAINTENANCE_BEFORE_HANDOVER');
  });

  it('H-2: the handover starts the warranties from its date and opens maintenance — once', async () => {
    const future = day(new Date(Date.now() + 3 * DAY));
    expect((await asAdmin(http().post(`/v1/contracts/${contractId}/handover`)).send({ handedOverAt: future })).status).toBe(400);

    const handedOverAt = day(new Date(Date.now() - 2 * DAY));
    const res = await asAdmin(http().post(`/v1/contracts/${contractId}/handover`)).send({
      handedOverAt,
      checklist: [{ key: 'keys', done: true }, { key: 'meters', done: true }],
      notes: 'U3d handover',
    });
    expect(res.status).toBe(201);
    const warranty = await item(units[0]!.id);
    expect(day(warranty.warrantyStart!)).toBe(handedOverAt);
    expect(warranty.warrantyEnd).not.toBeNull();

    const detail = await asAdmin(http().get(`/v1/contracts/${contractId}`)).expect(200);
    expect(day(new Date(detail.body.handover.handedOverAt))).toBe(handedOverAt);
    expect(detail.body.handover.checklist).toEqual(
      expect.arrayContaining([{ key: 'keys', done: true }, { key: 'snags', done: false }]),
    );
    const mine = await http().get('/v1/contracts/me/contracts').set('Authorization', bearer(customerToken)).expect(200);
    expect(mine.body.data.find((c: { id: string }) => c.id === contractId).handover.handedOverAt).toBeTruthy();

    expect((await fileMaintenance(units[0]!.id)).status).toBe(201);
    expect((await asAdmin(http().post(`/v1/contracts/${contractId}/handover`)).send({ handedOverAt })).status).toBe(409);
  });

  it('H-3: after a swap the new unit is the one handed over, under warranty from the swap date', async () => {
    await testApp.rawPrisma.maintenanceRequest.updateMany({ where: { customerId }, data: { status: 'CLOSED' } });
    await asAdmin(http().post(`/v1/contracts/${contractId}/swap-unit`))
      .send({ unitId: units[1]!.id, totalAmount: 100_000, reason: 'U3d swap' })
      .expect(201);
    const handover = await testApp.rawPrisma.unitHandover.findUniqueOrThrow({ where: { contractId } });
    expect(handover.unitId).toBe(units[1]!.id);
    expect(day((await item(units[1]!.id)).warrantyStart!)).toBe(day(new Date()));
  });
});
