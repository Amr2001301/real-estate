/**
 * BRK-2 — a brokerage company's listings.
 *
 * - A brokerage admin adds primary / resale / rent listings; codes run per
 *   company (L-0001…); the kind tabs and status chips count on the server.
 * - A rent has no down payment; a primary sale names its developer; the
 *   unit type is the company's own.
 * - A rep adds and edits listings but does not delete one.
 * - Two brokerages never see each other's listings (list, read, edit,
 *   status, delete all answer as if the listing did not exist).
 * - A developer company does not reach the listings at all (NOT_FOR_DEVELOPER).
 */
import 'reflect-metadata';
import request from 'supertest';
import * as argon2 from 'argon2';
import { CompanyType, UserRole } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { bearer, loginAs } from '../helpers/login';
import { seedUnitTypesForCompany } from '../../src/modules/units/unit-type-defaults';

describe('BRK-2 — brokerage listings (e2e)', () => {
  let testApp: TestApp;
  const stamp = Date.now().toString().slice(-7);
  const companyIds: string[] = [];
  let aAdmin: string;
  let aRep: string;
  let aRepId: string;
  let bAdmin: string;
  let devAdmin: string;

  const http = () => request(testApp.app.getHttpServer());
  const as = <T extends request.Test>(token: string, r: T) => r.set('Authorization', bearer(token));

  async function brokerage(tag: string) {
    const raw = testApp.rawPrisma;
    const company = await raw.company.create({
      data: { name: `BRK2 ${tag} ${stamp}`, slug: `brk2-${tag}-${stamp}`, type: CompanyType.BROKERAGE },
      select: { id: true },
    });
    companyIds.push(company.id);
    await seedUnitTypesForCompany(raw, company.id);
    const staff = async (role: UserRole, who: string) => {
      const email = `brk2-${tag}-${who}-${stamp}@example.com`;
      const user = await raw.user.create({
        data: { companyId: company.id, role, fullName: `${tag} ${who}`, email, passwordHash: await argon2.hash('StrongPass1!'), locale: 'ar' },
        select: { id: true },
      });
      // Their role's codes, as a user created from the dashboard gets them.
      const codes = await raw.permission.findMany({ where: { code: { in: ['listings:read', 'listings:manage'] } }, select: { id: true } });
      await raw.userPermission.createMany({ data: codes.map((p) => ({ userId: user.id, permissionId: p.id })), skipDuplicates: true });
      return { id: user.id, token: await loginAs(testApp.app, email, 'StrongPass1!') };
    };
    return { id: company.id, admin: await staff(UserRole.ADMIN, 'admin'), rep: await staff(UserRole.SALES, 'rep') };
  }

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    const a = await brokerage('a');
    const b = await brokerage('b');
    aAdmin = a.admin.token;
    aRep = a.rep.token;
    aRepId = a.rep.id;
    bAdmin = b.admin.token;
    devAdmin = await loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!');
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    await raw.listing.deleteMany({ where: { companyId: { in: companyIds } } });
    const users = await raw.user.findMany({ where: { companyId: { in: companyIds } }, select: { id: true } });
    const ids = users.map((u) => u.id);
    await raw.userPermission.deleteMany({ where: { userId: { in: ids } } });
    await raw.refreshToken.deleteMany({ where: { userId: { in: ids } } });
    await raw.authSession.deleteMany({ where: { userId: { in: ids } } });
    await raw.auditLog.deleteMany({ where: { companyId: { in: companyIds } } });
    await raw.user.deleteMany({ where: { id: { in: ids } } });
    await raw.unitType.deleteMany({ where: { companyId: { in: companyIds } } });
    await raw.company.deleteMany({ where: { id: { in: companyIds } } });
  });

  const resale = { kind: 'RESALE', title: 'شقة 3 غرف بالتجمع', unitType: '3BR', city: 'القاهرة الجديدة', area: 165, price: 4_500_000 };

  it('BRK2-1: listings get per-company codes, and the list counts by kind and status', async () => {
    const one = await as(aAdmin, http().post('/v1/listings')).send(resale).expect(201);
    expect(one.body).toMatchObject({ code: 'L-0001', kind: 'RESALE', status: 'AVAILABLE', unitType: '3BR', usage: 'RESIDENTIAL' });
    const rent = await as(aAdmin, http().post('/v1/listings'))
      .send({ ...resale, kind: 'RENT', title: 'شقة مفروشة للإيجار', price: 25_000, ownerName: 'مالك', ownerPhone: '01001234567' })
      .expect(201);
    expect(rent.body.code).toBe('L-0002');
    await as(aAdmin, http().post('/v1/listings'))
      .send({ ...resale, kind: 'PRIMARY', title: 'وحدة من المطوّر', developerName: 'مطوّر', downPayment: 450_000 })
      .expect(201);
    // Another company starts its own numbering.
    const other = await as(bAdmin, http().post('/v1/listings')).send(resale).expect(201);
    expect(other.body.code).toBe('L-0001');

    await as(aAdmin, http().patch(`/v1/listings/${rent.body.id}/status`)).send({ status: 'CLOSED' }).expect(200);
    const list = await as(aAdmin, http().get('/v1/listings?kind=RESALE,RENT')).expect(200);
    expect(list.body.meta.total).toBe(2);
    expect(list.body.meta.facets.counts.kind).toMatchObject({ PRIMARY: 1, RESALE: 1, RENT: 1 });
    expect(list.body.meta.facets.counts.status).toMatchObject({ AVAILABLE: 1, CLOSED: 1 });
    const search = await as(aAdmin, http().get('/v1/listings?q=المطوّر')).expect(200);
    expect(search.body.data.map((l: { code: string }) => l.code)).toEqual(['L-0003']);
  });

  it('BRK2-2: a rent takes no down payment, a primary sale names its developer, the type is the company\'s', async () => {
    await as(aAdmin, http().post('/v1/listings')).send({ ...resale, kind: 'RENT', price: 20_000, downPayment: 5_000 }).expect(400);
    await as(aAdmin, http().post('/v1/listings')).send({ ...resale, kind: 'PRIMARY' }).expect(400);
    await as(aAdmin, http().post('/v1/listings')).send({ ...resale, unitType: 'no-such-type' }).expect(400);
    await as(aAdmin, http().post('/v1/listings')).send({ ...resale, photos: ['javascript:alert(1)'] }).expect(400);
  });

  it('BRK2-3: a rep adds and edits listings and is their agent, but does not delete', async () => {
    const mine = await as(aRep, http().post('/v1/listings')).send({ ...resale, title: 'من المندوب', agentId: aRepId }).expect(201);
    expect(mine.body.agent).toMatchObject({ id: aRepId });
    const edited = await as(aRep, http().patch(`/v1/listings/${mine.body.id}`)).send({ price: 4_200_000, district: 'التجمع الخامس' }).expect(200);
    expect(Number(edited.body.price)).toBe(4_200_000);
    expect(edited.body.district).toBe('التجمع الخامس');
    await as(aRep, http().delete(`/v1/listings/${mine.body.id}`)).expect(403);
    await as(aAdmin, http().delete(`/v1/listings/${mine.body.id}`)).expect(200);
  });

  it('BRK2-4: one brokerage never reaches another\'s listing, nor makes another company\'s user its agent', async () => {
    const theirs = await as(bAdmin, http().get('/v1/listings')).expect(200);
    const id = theirs.body.data[0].id as string;
    const list = await as(aAdmin, http().get('/v1/listings?pageSize=100')).expect(200);
    expect(list.body.data.map((l: { id: string }) => l.id)).not.toContain(id);
    await as(aAdmin, http().get(`/v1/listings/${id}`)).expect(404);
    await as(aAdmin, http().patch(`/v1/listings/${id}`)).send({ price: 1 }).expect(404);
    await as(aAdmin, http().patch(`/v1/listings/${id}/status`)).send({ status: 'WITHDRAWN' }).expect(404);
    await as(aAdmin, http().delete(`/v1/listings/${id}`)).expect(404);
    const after = await as(bAdmin, http().get(`/v1/listings/${id}`)).expect(200);
    expect(after.body).toMatchObject({ status: 'AVAILABLE', price: '4500000' });
    // Company A's rep is not company B's staff.
    await as(bAdmin, http().post('/v1/listings')).send({ ...resale, agentId: aRepId }).expect(400);
  });

  it('BRK2-5: a developer company does not reach the listings', async () => {
    const res = await as(devAdmin, http().get('/v1/listings')).expect(403);
    expect(res.body.code).toBe('NOT_FOR_DEVELOPER');
    await as(devAdmin, http().post('/v1/listings')).send(resale).expect(403);
  });
});
