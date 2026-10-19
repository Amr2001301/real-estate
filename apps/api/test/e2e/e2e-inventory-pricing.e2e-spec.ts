/**
 * T4 — inventory and pricing.
 *
 * - A building with a sold or reserved unit can't be deleted (it cascaded).
 * - A unit in a live deal keeps its price and details.
 * - RESERVED isn't set by hand; SOLD without a contract needs a reason.
 * - A discount above the company cap needs the approve-discount permission.
 * - An archived project's units can't be reserved.
 */
import 'reflect-metadata';
import request from 'supertest';
import * as argon2 from 'argon2';
import { ProjectStatus, UnitStatus, UserRole } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

describe('T4 — inventory & pricing (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  let limitedToken: string;
  let companyId: string;
  let projectId: string;
  let buildingId: string;
  let soldUnitId: string;
  let freeUnitId: string;
  let reservationId: string | null = null;
  const stamp = Date.now().toString().slice(-7);
  const limitedEmail = `ip-admin-${stamp}@example.com`;
  const contractIds: string[] = [];
  const startedAt = new Date();

  const http = () => request(testApp.app.getHttpServer());
  const as = <T extends request.Test>(token: string, r: T) => r.set('Authorization', bearer(token));

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    adminToken = await loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!');
    const raw = testApp.rawPrisma;
    companyId = (await raw.user.findUniqueOrThrow({ where: { id: fixtures.userIds.adminId } })).companyId!;
    // An admin without the approve-discount permission.
    await raw.user.create({
      data: {
        companyId,
        email: limitedEmail,
        passwordHash: await argon2.hash('ChangeMe123!'),
        fullName: 'IP Limited Admin',
        role: UserRole.ADMIN,
        active: true,
      },
    });
    limitedToken = await loginAs(testApp.app, limitedEmail, 'ChangeMe123!');

    projectId = (
      await raw.project.create({
        data: {
          companyId,
          code: `IP-${stamp}`,
          name: { ar: 'مشروع اختبار', en: 'IP Project' },
          description: { ar: 'و', en: 'd' },
          city: 'Cairo',
          lat: 30,
          lng: 31,
          status: ProjectStatus.PUBLISHED,
        },
      })
    ).id;
    const phase = await raw.phase.create({ data: { companyId, projectId, code: `IP-PH-${stamp}`, name: { ar: 'م', en: 'P' } } });
    buildingId = (await raw.building.create({ data: { companyId, phaseId: phase.id, code: `IP-B-${stamp}`, name: 'B' } })).id;
    const unit = (code: string, status: UnitStatus) =>
      raw.unit.create({
        data: { companyId, buildingId, code, type: 'APARTMENT', area: 100, bedrooms: 2, bathrooms: 1, floor: 1, price: 1_000_000, status },
      });
    soldUnitId = (await unit(`IP-S-${stamp}`, UnitStatus.SOLD)).id;
    freeUnitId = (await unit(`IP-F-${stamp}`, UnitStatus.AVAILABLE)).id;
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    await raw.setting.deleteMany({ where: { companyId, key: 'pricing.maxDiscountPct' } });
    await raw.auditLog.deleteMany({ where: { action: { startsWith: 'pricing.discount' }, createdAt: { gte: startedAt } } });
    await raw.contract.deleteMany({ where: { id: { in: contractIds } } });
    if (reservationId) {
      await raw.reservationActivity.deleteMany({ where: { reservationId } });
      await raw.reservation.deleteMany({ where: { id: reservationId } });
    }
    await raw.unitStatusHistory.deleteMany({ where: { unitId: { in: [soldUnitId, freeUnitId] } } });
    await raw.unit.deleteMany({ where: { buildingId } });
    await raw.building.deleteMany({ where: { id: buildingId } });
    await raw.phase.deleteMany({ where: { projectId } });
    await raw.project.deleteMany({ where: { id: projectId } });
    await raw.refreshToken.deleteMany({ where: { user: { email: limitedEmail } } });
    await raw.user.deleteMany({ where: { email: limitedEmail } });
  });

  it('IP-1: a building with a sold unit is not deleted', async () => {
    await as(adminToken, http().delete(`/v1/buildings/${buildingId}`)).expect(409);
    expect(await testApp.rawPrisma.unit.count({ where: { buildingId } })).toBe(2);
  });

  it('IP-2: a unit in a live deal keeps its price; unchanged values still save', async () => {
    const res = await as(adminToken, http().post('/v1/reservations'))
      .send({ unitId: freeUnitId, clientId: fixtures.userIds.customer1UserId, expiresInHours: 24 })
      .expect(201);
    reservationId = res.body.id ?? res.body.reservation?.id;
    await as(adminToken, http().patch(`/v1/units/${freeUnitId}`)).send({ price: 900_000 }).expect(409);
    await as(adminToken, http().patch(`/v1/units/${freeUnitId}`)).send({ price: 1_000_000, area: 100 }).expect(200);
    await as(adminToken, http().post(`/v1/reservations/${reservationId}/cancel`)).send({ reason: 'IP cleanup' }).expect(201);
  });

  it('IP-3: RESERVED and SOLD are never set by hand — a sale is a contract (F9)', async () => {
    await as(adminToken, http().patch(`/v1/units/${freeUnitId}/status`)).send({ status: 'RESERVED' }).expect(400);
    await as(adminToken, http().patch(`/v1/units/${freeUnitId}/status`)).send({ status: 'SOLD' }).expect(400);
    // A reason no longer makes a sale: one made before the system is
    // entered as a contract.
    await as(adminToken, http().patch(`/v1/units/${freeUnitId}/status`))
      .send({ status: 'SOLD', reason: 'sold before the system' })
      .expect(400);
    const created = await as(adminToken, http().post('/v1/units')).send({
      buildingId,
      code: `IP-SOLD-${Date.now().toString().slice(-6)}`,
      type: '2BR',
      area: 100,
      bedrooms: 2,
      bathrooms: 1,
      floor: 1,
      price: 1_000_000,
      status: 'SOLD',
    });
    expect(created.status).toBe(400);
    expect(created.body.message).toContain('البيع يتم بعقد');
    expect((await testApp.rawPrisma.unit.findUniqueOrThrow({ where: { id: freeUnitId } })).status).toBe('AVAILABLE');
  });

  it('IP-4: a discount above the cap needs the approve-discount permission', async () => {
    await as(adminToken, http().patch('/v1/settings/pricing.maxDiscountPct')).send({ value: 5 }).expect(200);
    const sell = (token: string) =>
      as(token, http().post('/v1/contracts')).send({
        unitId: freeUnitId,
        customerId: fixtures.userIds.customer1UserId,
        totalAmount: 900_000, // 10% off
      });
    const refused = await sell(limitedToken);
    expect(refused.status).toBe(403);
    const approved = await sell(adminToken);
    expect(approved.status).toBe(201);
    contractIds.push(approved.body.id);
    const log = await testApp.rawPrisma.auditLog.findFirst({
      where: { action: 'pricing.discount-approved', entityId: freeUnitId, createdAt: { gte: startedAt } },
    });
    expect(log).not.toBeNull();
    await testApp.rawPrisma.contract.deleteMany({ where: { id: { in: contractIds } } });
    await testApp.rawPrisma.unit.update({ where: { id: freeUnitId }, data: { status: UnitStatus.AVAILABLE } });
  });

  it("IP-5: an archived project's units can't be reserved", async () => {
    await testApp.rawPrisma.project.update({ where: { id: projectId }, data: { status: ProjectStatus.ARCHIVED } });
    await as(adminToken, http().post('/v1/reservations'))
      .send({ unitId: freeUnitId, clientId: fixtures.userIds.customer1UserId, expiresInHours: 24 })
      .expect(400);
  });
});
