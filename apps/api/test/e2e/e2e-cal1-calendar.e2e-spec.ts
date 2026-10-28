/**
 * CAL1 — the sales calendar: visits booked, follow-ups due, calls logged,
 * reservations running out and contracts signed between two company days,
 * in the caller's scope (a reservation or contract is its reservation's rep's).
 */
import 'reflect-metadata';
import request from 'supertest';
import { ContractStatus, ReservationStatus, UnitStatus, UserRole } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

const DAY = 24 * 60 * 60 * 1000;
const cairoDay = (d: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

describe('CAL1 — sales calendar (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  let salesToken: string;
  let companyId: string;
  let otherRepId: string;
  const stamp = Date.now().toString().slice(-7);
  const clientIds: string[] = [];
  const leadIds: string[] = [];
  const visitIds: string[] = [];
  let mine: { lead: string; visit: string; note: string };
  let theirs: string;
  let units: Array<{ id: string; status: UnitStatus }> = [];
  const reservationIds: string[] = [];
  const contractIds: string[] = [];

  const http = () => request(testApp.app.getHttpServer());
  const as = <T extends request.Test>(token: string, r: T) => r.set('Authorization', bearer(token));
  const tomorrow = new Date(Date.now() + DAY);
  const from = cairoDay(new Date(Date.now() - DAY));
  const to = cairoDay(new Date(Date.now() + 3 * DAY));

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    [adminToken, salesToken] = await Promise.all([
      loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!'),
      loginAs(testApp.app, 'sales@example.com', 'SalesPass123!'),
    ]);
    const raw = testApp.rawPrisma;
    companyId = (await raw.user.findUniqueOrThrow({ where: { id: fixtures.userIds.salesId }, select: { companyId: true } })).companyId!;
    otherRepId = (await raw.user.create({ data: { companyId, fullName: 'CAL1 Other', phone: `+20127${stamp}`, role: UserRole.SALES, active: true } })).id;
    const lead = async (n: number, assignedSalesId: string) => {
      const c = await raw.user.create({ data: { companyId, fullName: `CAL1 ${n}`, phone: `+2016${n}${stamp}`, role: UserRole.CLIENT, active: true } });
      clientIds.push(c.id);
      const l = await raw.lead.create({
        data: { companyId, clientId: c.id, fullName: `CAL1 Lead ${n}`, phone: c.phone!, assignedSalesId, nextActionAt: tomorrow, nextActionType: 'MEETING' },
      });
      leadIds.push(l.id);
      return { leadId: l.id, clientId: c.id };
    };
    const a = await lead(1, fixtures.userIds.salesId);
    const b = await lead(2, otherRepId);
    const visit = await raw.visitAppointment.create({
      data: { companyId, visitNumber: `CAL1-${stamp}`, leadId: a.leadId, clientId: a.clientId, assignedSalesId: fixtures.userIds.salesId, scheduledAt: new Date(Date.now() + 2 * DAY) },
    });
    visitIds.push(visit.id);
    const note = await raw.leadNote.create({
      data: { companyId, leadId: a.leadId, salesId: fixtures.userIds.salesId, body: 'CAL1 call', kind: 'CALL', callResult: 'ANSWERED' },
    });
    mine = { lead: a.leadId, visit: visit.id, note: note.id };
    theirs = b.leadId;
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    await raw.contract.deleteMany({ where: { id: { in: contractIds } } });
    await raw.reservation.deleteMany({ where: { id: { in: reservationIds } } });
    for (const u of units) await raw.unit.update({ where: { id: u.id }, data: { status: u.status } });
    await raw.visitAppointment.deleteMany({ where: { id: { in: visitIds } } });
    await raw.leadNote.deleteMany({ where: { leadId: { in: leadIds } } });
    await raw.lead.deleteMany({ where: { id: { in: leadIds } } });
    await raw.user.deleteMany({ where: { id: { in: [...clientIds, otherRepId] } } });
  });

  it('CAL1-1: a rep sees their visits, follow-ups and logged calls, not another rep’s', async () => {
    const body = (await as(salesToken, http().get('/v1/leads/calendar').query({ from, to })).expect(200)).body;
    const ids = (type: string) => body.events.filter((e: { type: string }) => e.type === type).map((e: { id: string }) => e.id);
    expect(ids('visit')).toContain(mine.visit);
    expect(ids('follow_up')).toContain(mine.lead);
    expect(ids('done')).toContain(mine.note);
    expect(ids('follow_up')).not.toContain(theirs);
    const f = body.events.find((e: { id: string }) => e.id === mine.lead);
    expect(f).toMatchObject({ kind: 'MEETING', customer: 'CAL1 Lead 1' });
    expect(body.timeZone).toBeTruthy();
  });

  it('CAL1-2: the admin sees everyone, or one rep; bad ranges are refused', async () => {
    const all = (await as(adminToken, http().get('/v1/leads/calendar').query({ from, to })).expect(200)).body;
    expect(all.events.map((e: { id: string }) => e.id)).toEqual(expect.arrayContaining([mine.lead, theirs]));
    const one = (await as(adminToken, http().get('/v1/leads/calendar').query({ from, to, salesId: otherRepId })).expect(200)).body;
    expect(one.events.map((e: { id: string }) => e.id)).toEqual([theirs]);

    await as(adminToken, http().get('/v1/leads/calendar').query({ from: 'x', to })).expect(400);
    await as(adminToken, http().get('/v1/leads/calendar').query({ from: to, to: from })).expect(400);
    await as(adminToken, http().get('/v1/leads/calendar').query({ from: '2026-01-01', to: '2026-03-31' })).expect(400);
  });

  it('CAL1-3: reservations running out and contracts signed, on the reservation rep’s calendar', async () => {
    const raw = testApp.rawPrisma;
    units = await raw.unit.findMany({
      where: { companyId, status: UnitStatus.AVAILABLE, contracts: { none: {} }, reservations: { none: {} } },
      select: { id: true, status: true },
      take: 3,
    });
    expect(units).toHaveLength(3);
    await raw.unit.updateMany({ where: { id: { in: units.map((u) => u.id) } }, data: { status: UnitStatus.RESERVED } });
    const reserve = async (i: number, salesId: string, status: ReservationStatus) => {
      const r = await raw.reservation.create({
        data: { companyId, unitId: units[i]!.id, salesId, clientId: clientIds[0], leadId: mine.lead, status, expiresAt: tomorrow, reservationNumber: `CAL1-R${i}-${stamp}` },
      });
      reservationIds.push(r.id);
      return r.id;
    };
    const expiring = await reserve(0, fixtures.userIds.salesId, ReservationStatus.APPROVED);
    const otherExpiring = await reserve(1, otherRepId, ReservationStatus.PENDING);
    const converted = await reserve(2, fixtures.userIds.salesId, ReservationStatus.CONVERTED);
    const contract = await raw.contract.create({
      data: { companyId, customerId: clientIds[0]!, unitId: units[2]!.id, reservationId: converted, totalAmount: 1_000_000, status: ContractStatus.ACTIVE, signedAt: new Date(), contractNumber: `CAL1-C-${stamp}` },
    });
    contractIds.push(contract.id);

    const body = (await as(salesToken, http().get('/v1/leads/calendar').query({ from, to })).expect(200)).body;
    const ids = (type: string) => body.events.filter((e: { type: string }) => e.type === type).map((e: { id: string }) => e.id);
    expect(ids('reservation_expiry')).toContain(expiring);
    // Converted is no longer running out; another rep's is not mine.
    expect(ids('reservation_expiry')).not.toContain(converted);
    expect(ids('reservation_expiry')).not.toContain(otherExpiring);
    expect(ids('contract_signed')).toContain(contract.id);
    expect(body.events.find((e: { id: string }) => e.id === expiring)).toMatchObject({ status: 'APPROVED', customer: 'CAL1 1', ref: `CAL1-R0-${stamp}` });
    expect(body.events.find((e: { id: string }) => e.id === contract.id)).toMatchObject({ customer: 'CAL1 1', ref: `CAL1-C-${stamp}` });

    const other = (await as(adminToken, http().get('/v1/leads/calendar').query({ from, to, salesId: otherRepId })).expect(200)).body;
    expect(other.events.map((e: { id: string }) => e.id)).toEqual(expect.arrayContaining([theirs, otherExpiring]));
    expect(other.events.map((e: { id: string }) => e.id)).not.toContain(contract.id);

    // A cancelled contract leaves the calendar.
    await raw.contract.update({ where: { id: contract.id }, data: { status: ContractStatus.CANCELLED } });
    const after = (await as(salesToken, http().get('/v1/leads/calendar').query({ from, to })).expect(200)).body;
    expect(after.events.map((e: { id: string }) => e.id)).not.toContain(contract.id);
  });
});
