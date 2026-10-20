/**
 * EE1 — F10. Units could only be typed from a fixed residential list
 * (Studio … Penthouse): a shop, an office, a clinic or a garage could not be
 * entered. Each company now has its own unit types (defaults + its own), a
 * type carries a usage (residential, commercial, administrative, medical,
 * parking), and only a residential unit has bedrooms.
 */
import 'reflect-metadata';
import request from 'supertest';
import { UserRole } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';
import { DEFAULT_UNIT_TYPES } from '../../src/modules/units/unit-type-defaults';

describe('EE1 — unit types and usage (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  let companyId: string;
  let buildingId: string;
  let superId = '';
  let newCompanyId = '';
  const unitIds: string[] = [];
  const typeIds: string[] = [];
  const stamp = Date.now().toString().slice(-7);

  const http = () => request(testApp.app.getHttpServer());
  const asAdmin = <T extends request.Test>(r: T) => r.set('Authorization', bearer(adminToken));
  const createUnit = (n: number, type: string, bedrooms = 3) =>
    asAdmin(http().post('/v1/units')).send({
      buildingId,
      code: `EE1-${stamp}-${n}`,
      type,
      area: 80,
      bedrooms,
      bathrooms: 1,
      floor: 0,
      price: 900_000,
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
    await raw.unitStatusHistory.deleteMany({ where: { unitId: { in: unitIds } } });
    await raw.unit.deleteMany({ where: { id: { in: unitIds } } });
    await raw.unitType.deleteMany({ where: { id: { in: typeIds } } });
    if (newCompanyId) {
      await raw.unitType.deleteMany({ where: { companyId: newCompanyId } });
      await raw.leadSource.deleteMany({ where: { companyId: newCompanyId } });
      await raw.setting.deleteMany({ where: { companyId: newCompanyId } });
      await raw.companyDomain.deleteMany({ where: { companyId: newCompanyId } });
      await raw.auditLog.deleteMany({ where: { companyId: newCompanyId } });
      await raw.company.deleteMany({ where: { id: newCompanyId } });
    }
    if (superId) await raw.user.deleteMany({ where: { id: superId } });
  });

  it('EE1-1: a new company starts with the default types, shops to garages', async () => {
    superId = (
      await testApp.rawPrisma.user.create({
        data: { role: UserRole.SUPER_ADMIN, fullName: 'EE1 Platform', email: `ee1-super-${stamp}@example.com`, locale: 'en' },
        select: { id: true },
      })
    ).id;
    const superToken = await testApp.signAccessToken(superId, 'SUPER_ADMIN');
    const created = await http()
      .post('/v1/super-admin/companies')
      .set('Authorization', bearer(superToken))
      .send({ name: `EE1 Co ${stamp}`, slug: `ee1-co-${stamp}`, country: 'EG' })
      .expect(201);
    newCompanyId = created.body.company.id;
    const types = await testApp.rawPrisma.unitType.findMany({
      where: { companyId: newCompanyId },
      select: { code: true, usage: true },
    });
    expect(types.map((t) => t.code).sort()).toEqual(DEFAULT_UNIT_TYPES.map((t) => t.code).sort());
    expect(types.find((t) => t.code === 'Garage')?.usage).toBe('PARKING');
    expect(types.find((t) => t.code === 'Clinic')?.usage).toBe('MEDICAL');
  });

  it('EE1-2: an office is entered — any spelling — with its usage and no bedrooms', async () => {
    const res = await createUnit(1, 'office', 3).expect(201);
    unitIds.push(res.body.id);
    expect(res.body.type).toBe('Office');
    expect(res.body.usage).toBe('ADMINISTRATIVE');
    expect(res.body.bedrooms).toBe(0);

    // By its Arabic name too.
    const shop = await createUnit(2, 'محل تجاري').expect(201);
    unitIds.push(shop.body.id);
    expect(shop.body.type).toBe('Shop');
    expect(shop.body.usage).toBe('COMMERCIAL');
  });

  it('EE1-3: an unknown or switched-off type is refused, with what to do', async () => {
    const unknown = await createUnit(3, 'Spaceship').expect(400);
    expect(unknown.body.message).toContain('غير موجود');

    const added = await asAdmin(http().post('/v1/unit-types'))
      .send({ ar: `صيدلية ${stamp}`, en: `Pharmacy ${stamp}`, usage: 'MEDICAL' })
      .expect(201);
    typeIds.push(added.body.id);
    const ok = await createUnit(4, `Pharmacy ${stamp}`).expect(201);
    unitIds.push(ok.body.id);
    expect(ok.body.usage).toBe('MEDICAL');

    await asAdmin(http().patch(`/v1/unit-types/${added.body.id}`)).send({ active: false }).expect(200);
    const off = await createUnit(5, `Pharmacy ${stamp}`).expect(400);
    expect(off.body.message).toContain('موقوف');

    // A type's usage change carries to its units.
    await asAdmin(http().patch(`/v1/unit-types/${added.body.id}`)).send({ usage: 'COMMERCIAL' }).expect(200);
    const unit = await testApp.rawPrisma.unit.findUniqueOrThrow({ where: { id: ok.body.id }, select: { usage: true } });
    expect(unit.usage).toBe('COMMERCIAL');

    // Duplicate names are refused.
    await asAdmin(http().post('/v1/unit-types')).send({ ar: 'فيلا', en: `Villa ${stamp}`, usage: 'RESIDENTIAL' }).expect(409);
  });

  it('EE1-4: units filter by usage and carry their type name', async () => {
    const res = await asAdmin(http().get(`/v1/units?usage=ADMINISTRATIVE&q=EE1-${stamp}&pageSize=50`))
      .set('Accept-Language', 'ar')
      .expect(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].type).toBe('Office');
    // The name in the reader's language (LocaleInterceptor).
    expect(res.body.data[0].typeName).toBe('مكتب إداري');

    const pub = await http().get('/v1/public/unit-types').expect(200);
    const codes = (pub.body as Array<{ code: string; active: boolean }>).map((t) => t.code);
    expect(codes).toEqual(expect.arrayContaining(['Office', 'Shop', 'Garage']));
    expect(codes).not.toContain(`Pharmacy ${stamp}`);
    expect(companyId).toBeTruthy();
  });
});
