/**
 * EE3 — F10. Units are priced by the meter: the price is the price per
 * meter × the gross area, and follows the area. A new price per meter is
 * applied to a whole project, phase or building at once — to the units for
 * sale only: a reserved or sold unit keeps the price of its deal.
 */
import 'reflect-metadata';
import request from 'supertest';
import { Workbook } from 'exceljs';
import { UnitStatus } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';
import { UNITS_SHEET } from '../../src/common/utils/import-headers';

describe('EE3 — price per meter (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  let companyId: string;
  let projectId = '';
  let phaseId = '';
  let buildingId = '';
  let otherBuildingId = '';
  const reservationIds: string[] = [];
  const stamp = Date.now().toString().slice(-7);
  const PROJECT = `EE3-P-${stamp}`;

  const http = () => request(testApp.app.getHttpServer());
  const asAdmin = <T extends request.Test>(r: T) => r.set('Authorization', bearer(adminToken));
  const createUnit = (code: string, extra: Record<string, unknown>, building = buildingId) =>
    asAdmin(http().post('/v1/units')).send({ buildingId: building, code, type: '2BR', area: 100, bedrooms: 2, floor: 1, ...extra });
  const priceOf = async (id: string) => {
    const u = await testApp.rawPrisma.unit.findUniqueOrThrow({ where: { id }, select: { price: true, pricePerMeter: true } });
    return { price: Number(u.price), pricePerMeter: u.pricePerMeter === null ? null : Number(u.pricePerMeter) };
  };

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    adminToken = await loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!');
    companyId = (
      await testApp.rawPrisma.user.findUniqueOrThrow({ where: { id: fixtures.userIds.adminId } })
    ).companyId!;
    const raw = testApp.rawPrisma;
    projectId = (
      await raw.project.create({
        data: { companyId, code: PROJECT, name: { ar: 'مشروع EE3', en: 'EE3' }, description: { ar: '', en: '' }, city: 'Cairo', lat: 30, lng: 31 },
        select: { id: true },
      })
    ).id;
    phaseId = (
      await raw.phase.create({
        data: { companyId, projectId, code: 'EE3-PH', name: { ar: 'مرحلة', en: 'Phase' }, order: 0 },
        select: { id: true },
      })
    ).id;
    buildingId = (
      await raw.building.create({ data: { companyId, phaseId, code: 'EE3-B1', name: 'B1', order: 0 }, select: { id: true } })
    ).id;
    otherBuildingId = (
      await raw.building.create({ data: { companyId, phaseId, code: 'EE3-B2', name: 'B2', order: 1 }, select: { id: true } })
    ).id;
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    await raw.reservation.deleteMany({ where: { id: { in: reservationIds } } });
    const ids = (await raw.unit.findMany({ where: { building: { phaseId } }, select: { id: true } })).map((u) => u.id);
    await raw.unitStatusHistory.deleteMany({ where: { unitId: { in: ids } } });
    await raw.auditLog.deleteMany({ where: { entityId: { in: ids } } });
    await raw.unit.deleteMany({ where: { id: { in: ids } } });
    if (projectId) await raw.project.deleteMany({ where: { id: projectId } });
  });

  it('EE3-1: a unit priced by the meter — its price follows the area', async () => {
    const res = await createUnit('M-1', { pricePerMeter: 25_000 }).expect(201);
    const id = res.body.id as string;
    expect(await priceOf(id)).toEqual({ price: 2_500_000, pricePerMeter: 25_000 });

    // Neither a price nor a price per meter.
    const none = await createUnit('M-2', {}).expect(400);
    expect(none.body.message).toContain('سعر المتر');

    await asAdmin(http().patch(`/v1/units/${id}`)).send({ area: 120.5 }).expect(200);
    expect(await priceOf(id)).toEqual({ price: 3_012_500, pricePerMeter: 25_000 });

    // A whole price sent for it would be lost — refused; the same one passes.
    await asAdmin(http().patch(`/v1/units/${id}`)).send({ price: 2_000_000 }).expect(400);
    await asAdmin(http().patch(`/v1/units/${id}`)).send({ price: 3_012_500 }).expect(200);

    // Back to a whole price.
    await asAdmin(http().patch(`/v1/units/${id}`)).send({ pricePerMeter: null, price: 2_900_000 }).expect(200);
    expect(await priceOf(id)).toEqual({ price: 2_900_000, pricePerMeter: null });
    await asAdmin(http().patch(`/v1/units/${id}`)).send({ pricePerMeter: 30_000 }).expect(200);
    expect(await priceOf(id)).toEqual({ price: 3_615_000, pricePerMeter: 30_000 });

    const pub = await http().get(`/v1/units/${id}`).set('Authorization', bearer(adminToken)).expect(200);
    expect(Number(pub.body.pricePerMeter)).toBe(30_000);
  });

  it('EE3-2: a building is repriced — the units for sale only', async () => {
    const a = (await createUnit('R-A', { price: 1_000_000, area: 80 }).expect(201)).body.id as string;
    const shop = (await createUnit('R-S', { price: 1_500_000, area: 50, type: 'Shop' }).expect(201)).body.id as string;
    const held = (await createUnit('R-H', { price: 1_200_000, area: 90 }).expect(201)).body.id as string;
    const other = (await createUnit('R-O', { price: 1_100_000, area: 70 }, otherBuildingId).expect(201)).body.id as string;
    // A live booking holds `held`.
    await testApp.rawPrisma.unit.update({ where: { id: held }, data: { status: UnitStatus.RESERVED } });
    reservationIds.push(
      (
        await testApp.rawPrisma.reservation.create({
          data: { companyId, unitId: held, salesId: fixtures.userIds.adminId, status: 'APPROVED', expiresAt: new Date(Date.now() + 864e5) },
          select: { id: true },
        })
      ).id,
    );

    const preview = await asAdmin(http().post('/v1/units/reprice'))
      .send({ buildingId, pricePerMeter: 20_000, dryRun: true })
      .expect(200);
    // M-1, R-A and R-S are for sale; R-H is held.
    expect(preview.body).toEqual({ updated: 3, kept: 1, stalePlans: 0 });
    expect((await priceOf(a)).price).toBe(1_000_000);

    // One type only.
    const shops = await asAdmin(http().post('/v1/units/reprice'))
      .send({ buildingId, type: 'shop', pricePerMeter: 40_000 })
      .expect(200);
    expect(shops.body).toMatchObject({ updated: 1, kept: 0 });
    expect(await priceOf(shop)).toEqual({ price: 2_000_000, pricePerMeter: 40_000 });

    const done = await asAdmin(http().post('/v1/units/reprice')).send({ buildingId, pricePerMeter: 20_000 }).expect(200);
    expect(done.body).toMatchObject({ updated: 3, kept: 1 });
    expect(await priceOf(a)).toEqual({ price: 1_600_000, pricePerMeter: 20_000 });
    expect(await priceOf(held)).toEqual({ price: 1_200_000, pricePerMeter: null });
    expect(await priceOf(other)).toEqual({ price: 1_100_000, pricePerMeter: null });

    // The whole phase: the other building too.
    const phase = await asAdmin(http().post('/v1/units/reprice')).send({ phaseId, pricePerMeter: 21_000 }).expect(200);
    expect(phase.body).toMatchObject({ updated: 4, kept: 1 });
    expect(await priceOf(other)).toEqual({ price: 1_470_000, pricePerMeter: 21_000 });
  });

  it('EE3-3: the scope must be given, and be this company’s', async () => {
    await asAdmin(http().post('/v1/units/reprice')).send({ pricePerMeter: 20_000 }).expect(400);
    await asAdmin(http().post('/v1/units/reprice'))
      .send({ projectId: '00000000-0000-4000-8000-000000000999', pricePerMeter: 20_000 })
      .expect(404);
    await asAdmin(http().post('/v1/units/reprice')).send({ buildingId, pricePerMeter: -1 }).expect(400);
  });

  it('EE3-4: the catalogue file prices by the meter', async () => {
    const f = UNITS_SHEET.fields;
    const file = async (rows: Array<Record<string, string | number>>) => {
      const wb = new Workbook();
      const ws = wb.addWorksheet(UNITS_SHEET.name);
      ws.addRow([...UNITS_SHEET.headers]);
      for (const r of rows) {
        const row: Record<string, string | number> = {
          [f.projectCode]: PROJECT,
          [f.phaseCode]: 'EE3-PH',
          [f.buildingCode]: 'EE3-B1',
          [f.type]: 'Villa',
          [f.floor]: 0,
          ...r,
        };
        ws.addRow(UNITS_SHEET.headers.map((h) => row[h] ?? null));
      }
      return Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer);
    };
    const send = async (rows: Array<Record<string, string | number>>) =>
      asAdmin(http().post('/v1/data-import/import'))
        .attach('file', await file(rows), {
          filename: 'units.xlsx',
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        })
        .expect(200);

    const res = await send([{ [f.code]: 'F-1', [f.area]: 250, [f.pricePerMeter]: 18_000 }]);
    expect(res.body.success).toBe(true);
    const unit = await testApp.rawPrisma.unit.findFirstOrThrow({
      where: { code: 'F-1', buildingId },
      select: { id: true },
    });
    expect(await priceOf(unit.id)).toEqual({ price: 4_500_000, pricePerMeter: 18_000 });

    // A new area: the price follows (the price cell is not read).
    await send([{ [f.code]: 'F-1', [f.area]: 260, [f.price]: 1 }]);
    expect(await priceOf(unit.id)).toEqual({ price: 4_680_000, pricePerMeter: 18_000 });
  });
});
