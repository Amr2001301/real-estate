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
 * - An owner's mandate (resale / rent): one at a time, cancel, counted in the
 *   home's alerts when it ends within 14 days.
 * - A rent is let: the listing reads as rented, its months are owed, a month
 *   is recorded once, unpaid rent counts in the alerts; ending it relists.
 * - A visit is booked on a listing for a lead (the lead moves to VISIT), with
 *   no visit request filed; another company's listing is refused.
 * - The morning reminders reach the agent once: a mandate ending, a tenancy
 *   ending, a month's rent unpaid; a second run sends nothing.
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
    await raw.visitActivity.deleteMany({ where: { visit: { companyId: { in: companyIds } } } });
    await raw.visitAppointment.deleteMany({ where: { companyId: { in: companyIds } } });
    await raw.leadActivity.deleteMany({ where: { lead: { companyId: { in: companyIds } } } });
    await raw.leadNote.deleteMany({ where: { lead: { companyId: { in: companyIds } } } });
    const leadClients = (await raw.lead.findMany({ where: { companyId: { in: companyIds } }, select: { clientId: true } })).map((l) => l.clientId);
    await raw.lead.deleteMany({ where: { companyId: { in: companyIds } } });
    await raw.user.deleteMany({ where: { id: { in: leadClients }, role: UserRole.CLIENT } });
    await raw.notification.deleteMany({ where: { companyId: { in: companyIds } } });
    await raw.rentPayment.deleteMany({ where: { companyId: { in: companyIds } } });
    await raw.tenancy.deleteMany({ where: { companyId: { in: companyIds } } });
    await raw.listingMandate.deleteMany({ where: { companyId: { in: companyIds } } });
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

  const isoDay = (offsetDays: number) => new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);

  it('BRK2-6: an owner\'s mandate — one at a time, cancelled, ending soon counted', async () => {
    const l = await as(aAdmin, http().post('/v1/listings')).send({ ...resale, title: 'تفويض' }).expect(201);
    await as(aAdmin, http().post(`/v1/listings/${l.body.id}/mandates`))
      .send({ kind: 'EXCLUSIVE', commissionPct: 2.5, commissionAmount: 50_000, startDate: isoDay(-30), endDate: isoDay(10) })
      .expect(400);
    const m = await as(aAdmin, http().post(`/v1/listings/${l.body.id}/mandates`))
      .send({ kind: 'EXCLUSIVE', commissionPct: 2.5, startDate: isoDay(-30), endDate: isoDay(10) })
      .expect(201);
    expect(m.body).toMatchObject({ state: 'ACTIVE', expiringSoon: true });
    await as(aAdmin, http().post(`/v1/listings/${l.body.id}/mandates`)).send({ kind: 'OPEN', commissionPct: 2, startDate: isoDay(0), endDate: isoDay(60) }).expect(409);
    const alerts = await as(aRep, http().get('/v1/listings/alerts')).expect(200);
    expect(alerts.body.mandatesExpiring).toBeGreaterThanOrEqual(1);
    // Company B cannot cancel it.
    await as(bAdmin, http().post(`/v1/listings/mandates/${m.body.id}/cancel`)).expect(404);
    await as(aAdmin, http().post(`/v1/listings/mandates/${m.body.id}/cancel`)).expect(201);
    const terms = await as(aAdmin, http().get(`/v1/listings/${l.body.id}/terms`)).expect(200);
    expect(terms.body.mandates[0].state).toBe('CANCELLED');
    // A primary sale has no owner's mandate.
    const primary = await as(aAdmin, http().post('/v1/listings')).send({ ...resale, kind: 'PRIMARY', developerName: 'مطوّر' }).expect(201);
    await as(aAdmin, http().post(`/v1/listings/${primary.body.id}/mandates`)).send({ kind: 'OPEN', commissionPct: 2, startDate: isoDay(0), endDate: isoDay(30) }).expect(400);
  });

  it('BRK2-7: a rent is let, its months are owed and recorded once, ending it relists', async () => {
    const l = await as(aAdmin, http().post('/v1/listings')).send({ ...resale, kind: 'RENT', title: 'للإيجار', price: 30_000 }).expect(201);
    const t = await as(aRep, http().post(`/v1/listings/${l.body.id}/tenancies`))
      .send({ tenantName: 'مستأجر', tenantPhone: '01009998887', startDate: isoDay(-70), endDate: isoDay(294), monthlyRent: 30_000, paymentDay: 1 })
      .expect(201);
    // A year's lease (the end one day short of a year) owes 12 months.
    expect(t.body.schedule).toHaveLength(12);
    expect(t.body.summary.overdueCount).toBeGreaterThanOrEqual(2);
    expect((await as(aAdmin, http().get(`/v1/listings/${l.body.id}`)).expect(200)).body.status).toBe('CLOSED');
    await as(aAdmin, http().post(`/v1/listings/${l.body.id}/tenancies`))
      .send({ tenantName: 'آخر', tenantPhone: '01000000000', startDate: isoDay(0), endDate: isoDay(100), monthlyRent: 1, paymentDay: 1 })
      .expect(409);

    const first = t.body.schedule[0].period as string;
    const paid = await as(aRep, http().post(`/v1/listings/tenancies/${t.body.id}/payments`)).send({ period: first, amount: 30_000, paidOn: isoDay(-60) }).expect(201);
    expect(paid.body.schedule[0].state).toBe('PAID');
    await as(aRep, http().post(`/v1/listings/tenancies/${t.body.id}/payments`)).send({ period: first, amount: 30_000, paidOn: isoDay(-60) }).expect(409);
    await as(aRep, http().post(`/v1/listings/tenancies/${t.body.id}/payments`)).send({ period: '2099-01', amount: 1, paidOn: isoDay(0) }).expect(400);
    // Company B reaches none of it.
    await as(bAdmin, http().post(`/v1/listings/tenancies/${t.body.id}/payments`)).send({ period: t.body.schedule[1].period, amount: 1, paidOn: isoDay(0) }).expect(404);
    await as(bAdmin, http().get(`/v1/listings/${l.body.id}/terms`)).expect(404);

    const alerts = await as(aAdmin, http().get('/v1/listings/alerts')).expect(200);
    expect(alerts.body.rentOverdue).toBeGreaterThanOrEqual(1);
    expect((await as(bAdmin, http().get('/v1/listings/alerts')).expect(200)).body.rentOverdue).toBe(0);

    // A rep does not undo a payment; the admin does.
    const paymentId = (await testApp.rawPrisma.rentPayment.findFirstOrThrow({ where: { tenancyId: t.body.id } })).id;
    await as(aRep, http().delete(`/v1/listings/rent-payments/${paymentId}`)).expect(403);
    await as(aAdmin, http().delete(`/v1/listings/rent-payments/${paymentId}`)).expect(200);

    await as(aAdmin, http().post(`/v1/listings/tenancies/${t.body.id}/end`)).expect(201);
    expect((await as(aAdmin, http().get(`/v1/listings/${l.body.id}`)).expect(200)).body.status).toBe('AVAILABLE');
    // A sale listing is never let.
    const sale = await as(aAdmin, http().post('/v1/listings')).send(resale).expect(201);
    await as(aAdmin, http().post(`/v1/listings/${sale.body.id}/tenancies`))
      .send({ tenantName: 'مستأجر', tenantPhone: '01000000000', startDate: isoDay(0), endDate: isoDay(100), monthlyRent: 1, paymentDay: 1 })
      .expect(400);
  });

  it('BRK2-8: a visit is booked on a listing for a lead — no visit request — and another company\'s listing is refused', async () => {
    const l = await as(aAdmin, http().post('/v1/listings')).send({ ...resale, title: 'للمعاينة' }).expect(201);
    const lead = await as(aAdmin, http().post('/v1/leads')).send({ fullName: 'عميل وساطة', phone: `0100${stamp}`.slice(0, 11), allowDuplicate: true }).expect(201);
    const when = new Date(Date.now() + 3 * 86_400_000).toISOString();
    const visit = await as(aAdmin, http().post('/v1/visits/appointments')).send({ leadId: lead.body.id, listingId: l.body.id, scheduledAt: when }).expect(201);
    expect(visit.body).toMatchObject({ listingId: l.body.id, projectId: null, visitRequestId: null });
    expect(visit.body.listing).toMatchObject({ code: l.body.code });
    const raw = testApp.rawPrisma;
    expect((await raw.lead.findUniqueOrThrow({ where: { id: lead.body.id } })).stage).toBe('VISIT');
    // Neither a project nor a listing, or both: refused.
    await as(aAdmin, http().post('/v1/visits/appointments')).send({ leadId: lead.body.id, scheduledAt: when }).expect(400);
    // Company B's listing is not company A's.
    const theirs = (await as(bAdmin, http().get('/v1/listings')).expect(200)).body.data[0].id as string;
    await as(aAdmin, http().post('/v1/visits/appointments')).send({ leadId: lead.body.id, listingId: theirs, scheduledAt: when }).expect(400);
    const list = await as(aAdmin, http().get(`/v1/visits/appointments?leadId=${lead.body.id}`)).expect(200);
    expect(list.body.data[0].listing).toMatchObject({ id: l.body.id });
  });

  it('BRK2-9: the morning reminders reach the agent once', async () => {
    const raw = testApp.rawPrisma;
    const l = await as(aAdmin, http().post('/v1/listings'))
      .send({ ...resale, kind: 'RENT', title: 'تذكيرات', price: 10_000, agentId: aRepId })
      .expect(201);
    await as(aAdmin, http().post(`/v1/listings/${l.body.id}/mandates`)).send({ kind: 'OPEN', commissionAmount: 10_000, startDate: isoDay(-200), endDate: isoDay(5) }).expect(201);
    await as(aAdmin, http().post(`/v1/listings/${l.body.id}/tenancies`))
      .send({ tenantName: 'مستأجر التذكير', tenantPhone: '01011112222', startDate: isoDay(-40), endDate: isoDay(20), monthlyRent: 10_000, paymentDay: 1 })
      .expect(201);
    const run = () => testApp.runCronJob('listing-reminders');
    await run();
    const sent = await raw.notification.findMany({ where: { userId: aRepId }, select: { templateCode: true } });
    const codes = sent.map((n) => n.templateCode);
    expect(codes).toEqual(expect.arrayContaining(['listing_mandate_expiring', 'tenancy_ending', 'rent_due']));
    const before = sent.length;
    await run();
    expect(await raw.notification.count({ where: { userId: aRepId } })).toBe(before);
  });
});
