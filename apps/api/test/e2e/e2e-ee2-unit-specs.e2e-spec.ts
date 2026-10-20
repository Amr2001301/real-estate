/**
 * EE2 — F10. A unit had one area and nothing else: no finishing, no net
 * area, garden or roof, no view or orientation — the things a buyer asks
 * first. They are entered on the unit (and in the catalogue file), shown on
 * the public site, filter the lists, and are locked with the rest of what
 * was sold once the unit is in a live deal.
 */
import 'reflect-metadata';
import request from 'supertest';
import { Workbook } from 'exceljs';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';
import { UNITS_SHEET } from '../../src/common/utils/import-headers';

describe('EE2 — unit specs (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  let companyId: string;
  let buildingId: string;
  let projectId = '';
  const unitIds: string[] = [];
  const reservationIds: string[] = [];
  const stamp = Date.now().toString().slice(-7);
  const PROJECT = `EE2-P-${stamp}`;

  const http = () => request(testApp.app.getHttpServer());
  const asAdmin = <T extends request.Test>(r: T) => r.set('Authorization', bearer(adminToken));
  const createUnit = (n: number, extra: Record<string, unknown> = {}) =>
    asAdmin(http().post('/v1/units')).send({
      buildingId,
      code: `EE2-${stamp}-${n}`,
      type: '3BR',
      area: 180,
      bedrooms: 3,
      bathrooms: 2,
      floor: 0,
      price: 3_600_000,
      ...extra,
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
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    await raw.reservation.deleteMany({ where: { id: { in: reservationIds } } });
    const imported = projectId
      ? await raw.unit.findMany({ where: { building: { phase: { projectId } } }, select: { id: true } })
      : [];
    const ids = [...unitIds, ...imported.map((u) => u.id)];
    await raw.unitStatusHistory.deleteMany({ where: { unitId: { in: ids } } });
    await raw.auditLog.deleteMany({ where: { entityId: { in: ids } } });
    await raw.unit.deleteMany({ where: { id: { in: ids } } });
    if (projectId) await raw.project.deleteMany({ where: { id: projectId } });
  });

  it('EE2-1: a unit carries its specs, and the public site shows them', async () => {
    const res = await createUnit(1, {
      netArea: 150,
      gardenArea: 60,
      roofArea: 40.5,
      finishing: 'FULLY_FINISHED',
      view: 'LAGOON',
      orientation: 'NORTH_EAST',
    }).expect(201);
    unitIds.push(res.body.id);
    expect(res.body).toMatchObject({
      area: 180,
      netArea: 150,
      gardenArea: 60,
      roofArea: 40.5,
      terraceArea: null,
      landArea: null,
      finishing: 'FULLY_FINISHED',
      view: 'LAGOON',
      orientation: 'NORTH_EAST',
    });

    const pub = await http().get(`/v1/public/units/${res.body.id}`).expect(200);
    expect(pub.body).toMatchObject({ netArea: 150, gardenArea: 60, finishing: 'FULLY_FINISHED', view: 'LAGOON', orientation: 'NORTH_EAST' });

    // Bad values are refused.
    await createUnit(2, { finishing: 'GOLD' }).expect(400);
    await createUnit(3, { gardenArea: -5 }).expect(400);
  });

  it('EE2-2: a spec is changed or cleared; the lists filter by them', async () => {
    const other = await createUnit(4, { finishing: 'CORE_AND_SHELL', view: 'MAIN_STREET' }).expect(201);
    unitIds.push(other.body.id);

    const id = unitIds[0]!;
    const upd = await asAdmin(http().patch(`/v1/units/${id}`))
      .send({ gardenArea: null, terraceArea: 25, view: 'GARDEN' })
      .expect(200);
    expect(upd.body).toMatchObject({ gardenArea: null, terraceArea: 25, view: 'GARDEN', netArea: 150, finishing: 'FULLY_FINISHED' });

    const finished = await asAdmin(http().get(`/v1/units?q=EE2-${stamp}&finishing=FULLY_FINISHED`)).expect(200);
    expect(finished.body.data.map((u: { id: string }) => u.id)).toEqual([id]);
    const street = await http().get(`/v1/public/units?view=MAIN_STREET&pageSize=50`).expect(200);
    const streetIds = street.body.data.map((u: { id: string }) => u.id);
    expect(streetIds).toContain(other.body.id);
    expect(streetIds).not.toContain(id);
  });

  it('EE2-3: specs are locked with the rest once the unit is in a live deal', async () => {
    const id = unitIds[1]!;
    const r = await testApp.rawPrisma.reservation.create({
      data: {
        companyId,
        unitId: id,
        salesId: fixtures.userIds.adminId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      select: { id: true },
    });
    reservationIds.push(r.id);
    const res = await asAdmin(http().patch(`/v1/units/${id}`)).send({ finishing: 'FULLY_FINISHED' }).expect(409);
    expect(res.body.message).toContain('حجز أو عقد قائم');
    // The same values (the edit form sends every field) pass.
    await asAdmin(http().patch(`/v1/units/${id}`)).send({ finishing: 'CORE_AND_SHELL', view: 'MAIN_STREET' }).expect(200);
  });

  it('EE2-4: the catalogue file reads the specs — codes or Arabic names', async () => {
    const project = await testApp.rawPrisma.project.create({
      data: { companyId, code: PROJECT, name: { ar: 'مشروع EE2', en: 'EE2' }, description: { ar: '', en: '' }, city: 'Cairo', lat: 30, lng: 31 },
      select: { id: true },
    });
    projectId = project.id;
    const phase = await testApp.rawPrisma.phase.create({
      data: { companyId, projectId, code: 'EE2-PH', name: { ar: 'مرحلة', en: 'Phase' }, order: 0 },
      select: { id: true },
    });
    await testApp.rawPrisma.building.create({
      data: { companyId, phaseId: phase.id, code: 'EE2-B', name: 'B', order: 0 },
    });

    const file = async (rows: Array<Record<string, string | number>>) => {
      const wb = new Workbook();
      const ws = wb.addWorksheet(UNITS_SHEET.name);
      ws.addRow([...UNITS_SHEET.headers]);
      const f = UNITS_SHEET.fields;
      for (const r of rows) {
        const base: Record<string, string | number> = {
          [f.projectCode]: PROJECT,
          [f.phaseCode]: 'EE2-PH',
          [f.buildingCode]: 'EE2-B',
          [f.type]: 'Villa',
          [f.floor]: 0,
          [f.area]: 300,
          [f.price]: 9_000_000,
        };
        const row = { ...base, ...r };
        ws.addRow(UNITS_SHEET.headers.map((h) => row[h] ?? null));
      }
      return Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer);
    };
    const send = (buf: Buffer, path: 'preview' | 'import') =>
      asAdmin(http().post(`/v1/data-import/${path}`)).attach('file', buf, {
        filename: 'units.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
    const f = UNITS_SHEET.fields;

    const bad = await send(await file([{ [f.code]: 'V-1', [f.view]: 'قمر' }]), 'preview').expect(200);
    expect(bad.body.hasErrors).toBe(true);
    expect(JSON.stringify(bad.body.units)).toContain('غير معروف');

    const ok = await send(
      await file([
        {
          [f.code]: 'V-1',
          [f.landArea]: 450,
          [f.gardenArea]: 200,
          [f.finishing]: 'نصف تشطيب',
          [f.view]: 'club',
          [f.orientation]: 'بحري',
        },
      ]),
      'import',
    ).expect(200);
    expect(ok.body.success).toBe(true);
    const unit = await testApp.rawPrisma.unit.findFirstOrThrow({
      where: { code: 'V-1', building: { phase: { projectId } } },
      select: { landArea: true, gardenArea: true, finishing: true, view: true, orientation: true },
    });
    expect(unit).toEqual({ landArea: 450, gardenArea: 200, finishing: 'SEMI_FINISHED', view: 'CLUB', orientation: 'NORTH' });

    // The same file again changes nothing; a new finishing is an update.
    const again = await send(
      await file([{ [f.code]: 'V-1', [f.landArea]: 450, [f.finishing]: 'SEMI_FINISHED' }]),
      'preview',
    ).expect(200);
    expect(again.body.units).toMatchObject({ toCreate: 0, toUpdate: 0, unchanged: 1 });
    const changed = await send(await file([{ [f.code]: 'V-1', [f.finishing]: 'fully finished' }]), 'preview').expect(200);
    expect(changed.body.units).toMatchObject({ toUpdate: 1 });
  });
});
