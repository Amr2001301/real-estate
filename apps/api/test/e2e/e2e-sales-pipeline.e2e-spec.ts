/**
 * T3 — the sales pipeline before a reservation.
 *
 * - A rep can't reassign a lead through the general edit.
 * - WON comes from a converted reservation only; a lead with a live
 *   reservation can't be marked LOST.
 * - A sales manager sees and routes the unassigned queue, within their team.
 * - A reservation a manager books on a rep's lead credits the rep.
 * - A returning website visitor whose old lead is closed starts a new lead.
 * - A rep can't be double-booked for a visit.
 */
import 'reflect-metadata';
import request from 'supertest';
import { LeadStage, UnitStatus, UserRole } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

describe('T3 — sales pipeline (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  let salesToken: string;
  let managerToken: string;
  let companyId: string;
  let slug: string;
  let outsiderId: string;
  const stamp = Date.now().toString().slice(-7);
  const leadIds: string[] = [];
  const reservationIds: string[] = [];
  const apptIds: string[] = [];
  const startedAt = new Date();
  let unitId: string;

  const http = () => request(testApp.app.getHttpServer());
  const as = <T extends request.Test>(token: string, r: T) => r.set('Authorization', bearer(token));
  const newLead = async (assignedSalesId: string | null, phoneTail: string) => {
    const phone = `+2012${phoneTail.slice(-1)}${stamp}`; // a valid Egyptian mobile
    const client = await testApp.rawPrisma.user.create({
      data: { companyId, fullName: `T3 ${phoneTail}`, phone, role: UserRole.CLIENT, active: true },
    });
    const lead = await testApp.rawPrisma.lead.create({
      data: { companyId, clientId: client.id, fullName: `T3 ${phoneTail}`, phone, assignedSalesId, stage: LeadStage.NEW },
    });
    leadIds.push(lead.id);
    return lead;
  };

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    [adminToken, salesToken, managerToken] = await Promise.all([
      loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!'),
      loginAs(testApp.app, 'sales@example.com', 'SalesPass123!'),
      loginAs(testApp.app, 'manager@example.com', 'ManagerPass123!'),
    ]);
    const raw = testApp.rawPrisma;
    const admin = await raw.user.findUniqueOrThrow({
      where: { id: fixtures.userIds.adminId },
      select: { company: { select: { id: true, slug: true } } },
    });
    companyId = admin.company!.id;
    slug = admin.company!.slug;
    // A rep outside the manager's team.
    outsiderId = (
      await raw.user.create({
        data: { companyId, fullName: 'T3 Outsider', phone: `+20119${stamp}`, role: UserRole.SALES, active: true },
      })
    ).id;
    unitId = (
      await raw.unit.findFirstOrThrow({
        where: { companyId, status: UnitStatus.AVAILABLE },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      })
    ).id;
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    await raw.visitActivity.deleteMany({ where: { visitId: { in: apptIds } } });
    await raw.visitAppointment.deleteMany({ where: { id: { in: apptIds } } });
    for (const id of reservationIds) {
      await raw.reservationActivity.deleteMany({ where: { reservationId: id } });
      await raw.reservation.deleteMany({ where: { id } });
    }
    await raw.unitStatusHistory.deleteMany({ where: { unitId, changedAt: { gte: startedAt } } });
    await raw.unit.update({ where: { id: unitId }, data: { status: UnitStatus.AVAILABLE, reservationExpiresAt: null } });
    const phoneLeads = await raw.lead.findMany({ where: { phone: { endsWith: stamp } }, select: { id: true } });
    const all = [...new Set([...leadIds, ...phoneLeads.map((l) => l.id)])];
    await raw.infoRequest.deleteMany({ where: { leadId: { in: all } } });
    await raw.leadActivity.deleteMany({ where: { leadId: { in: all } } });
    await raw.leadNote.deleteMany({ where: { leadId: { in: all } } });
    await raw.lead.deleteMany({ where: { id: { in: all } } });
    await raw.user.deleteMany({ where: { phone: { endsWith: stamp }, role: UserRole.CLIENT } });
    await raw.user.delete({ where: { id: outsiderId } });
  });

  it('SP-1: a rep cannot hand a lead to someone else through the general edit', async () => {
    const lead = await newLead(fixtures.userIds.salesId, '201');
    await as(salesToken, http().patch(`/v1/leads/${lead.id}`)).send({ assignedSalesId: outsiderId }).expect(400);
    const after = await testApp.rawPrisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(after.assignedSalesId).toBe(fixtures.userIds.salesId);
  });

  it('SP-2: WON is never set by hand; a lead with a live reservation is not LOST', async () => {
    const lead = await newLead(fixtures.userIds.salesId, '202');
    await as(salesToken, http().patch(`/v1/leads/${lead.id}/stage`)).send({ stage: 'WON' }).expect(400);
    const res = await testApp.rawPrisma.reservation.create({
      data: {
        companyId,
        unitId,
        salesId: fixtures.userIds.salesId,
        leadId: lead.id,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 86_400_000),
        reservationNumber: `T3-${stamp}`,
      },
    });
    reservationIds.push(res.id);
    await as(salesToken, http().patch(`/v1/leads/${lead.id}/stage`)).send({ stage: 'LOST' }).expect(400);
    await testApp.rawPrisma.reservation.update({ where: { id: res.id }, data: { status: 'CANCELLED' } });
    await as(salesToken, http().patch(`/v1/leads/${lead.id}/stage`)).send({ stage: 'LOST' }).expect(200);
  });

  it('SP-3: a sales manager sees the unassigned queue and routes it within the team', async () => {
    const orphan = await newLead(null, '203');
    const queue = await as(managerToken, http().get('/v1/leads')).query({ unassigned: '1', pageSize: 200 }).expect(200);
    expect((queue.body.data as Array<{ id: string }>).map((l) => l.id)).toContain(orphan.id);
    await as(managerToken, http().get(`/v1/leads/${orphan.id}`)).expect(200);

    await as(managerToken, http().patch(`/v1/leads/${orphan.id}/assign`)).send({ assignedSalesId: outsiderId }).expect(403);
    await as(managerToken, http().patch(`/v1/leads/${orphan.id}/assign`))
      .send({ assignedSalesId: fixtures.userIds.salesId })
      .expect(200);
    const after = await testApp.rawPrisma.lead.findUniqueOrThrow({ where: { id: orphan.id } });
    expect(after.assignedSalesId).toBe(fixtures.userIds.salesId);

    // A rep never gets the queue — only their own leads.
    const repView = await as(salesToken, http().get('/v1/leads')).query({ unassigned: '1', pageSize: 200 }).expect(200);
    for (const l of repView.body.data as Array<{ assignedSalesId: string | null }>) {
      expect(l.assignedSalesId).toBe(fixtures.userIds.salesId);
    }
  });

  it("SP-4: a reservation the manager books on a rep's lead is the rep's sale", async () => {
    const lead = await newLead(fixtures.userIds.salesId, '204');
    const res = await as(managerToken, http().post('/v1/reservations'))
      .send({ unitId, leadId: lead.id, expiresInHours: 24 })
      .expect(201);
    const id: string = res.body.id ?? res.body.reservation?.id;
    reservationIds.push(id);
    const row = await testApp.rawPrisma.reservation.findUniqueOrThrow({ where: { id } });
    expect(row.salesId).toBe(fixtures.userIds.salesId);
    await as(adminToken, http().post(`/v1/reservations/${id}/cancel`)).send({ reason: 'T3 cleanup' }).expect(201);
  });

  it('SP-5: a returning visitor whose lead was lost starts a new lead', async () => {
    const old = await newLead(fixtures.userIds.salesId, '205');
    await testApp.rawPrisma.lead.update({ where: { id: old.id }, data: { stage: LeadStage.LOST } });
    await http()
      .post('/v1/public/info-request')
      .set('X-Tenant-Slug', slug)
      .send({ name: 'T3 Returning', phone: old.phone, message: 'Back again' })
      .then((r) => {
        if (r.status !== 201) throw new Error(`info-request ${r.status}: ${JSON.stringify(r.body)}`);
      });
    const leads = await testApp.rawPrisma.lead.findMany({ where: { phone: old.phone }, orderBy: { createdAt: 'asc' } });
    expect(leads).toHaveLength(2);
    expect(leads[0]!.stage).toBe(LeadStage.LOST);
    expect(leads[1]!.stage).toBe(LeadStage.NEW);
  });

  it('SP-6: a rep cannot be booked for two visits at the same time', async () => {
    const lead = await newLead(fixtures.userIds.salesId, '206');
    const project = await testApp.rawPrisma.unit.findUniqueOrThrow({
      where: { id: unitId },
      select: { building: { select: { phase: { select: { projectId: true } } } } },
    });
    const at = new Date(Date.now() + 3 * 86_400_000);
    at.setUTCHours(10, 0, 0, 0);
    const book = (when: Date) =>
      as(adminToken, http().post('/v1/visits/appointments')).send({
        leadId: lead.id,
        projectId: project.building.phase.projectId,
        scheduledAt: when.toISOString(),
        durationMinutes: 60,
        assignedSalesId: fixtures.userIds.salesId,
      });
    const first = await book(at);
    expect(first.status).toBe(201);
    apptIds.push(first.body.id);
    const clash = await book(new Date(at.getTime() + 30 * 60_000));
    expect(clash.status).toBe(409);
    const later = await book(new Date(at.getTime() + 90 * 60_000));
    expect(later.status).toBe(201);
    apptIds.push(later.body.id);
  });
});
