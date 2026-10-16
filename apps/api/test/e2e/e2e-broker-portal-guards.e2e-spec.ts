/**
 * R1 — broker portal guards.
 *
 * One unit, one booking even when two reservations race; a phone that
 * belongs to staff is never adopted (and nobody's stored profile is echoed
 * back); an agent without the commission permission sees no money, and a
 * non-manager agent sees only their own work.
 */
import 'reflect-metadata';
import request from 'supertest';
import { ReservationStatus, UnitStatus } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

describe('R1 — broker portal guards (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let brokerToken: string;
  const startedAt = new Date();
  const stamp = Date.now().toString().slice(-8);

  const http = () => request(testApp.app.getHttpServer());

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    brokerToken = await loginAs(testApp.app, fixtures.users.BROKER_1.email, fixtures.users.BROKER_1.password);
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    const created = await raw.reservation.findMany({
      where: { leadId: fixtures.flowD.broker1ApprovedLeadId, createdAt: { gte: startedAt } },
      select: { id: true, unitId: true },
    });
    for (const r of created) {
      await raw.reservationActivity.deleteMany({ where: { reservationId: r.id } });
      await raw.reservation.delete({ where: { id: r.id } });
      await raw.unit.update({ where: { id: r.unitId }, data: { status: UnitStatus.AVAILABLE, reservationExpiresAt: null } });
      await raw.unitStatusHistory.deleteMany({ where: { unitId: r.unitId, changedAt: { gte: startedAt } } });
    }
    await raw.lead.deleteMany({ where: { brokerId: { not: null }, createdAt: { gte: startedAt }, fullName: { startsWith: 'R1 ' } } });
  });

  it('R1-1: two reservations racing for one unit — exactly one wins', async () => {
    const unit = await testApp.rawPrisma.unit.findFirstOrThrow({
      where: {
        status: UnitStatus.AVAILABLE,
        building: { phase: { projectId: fixtures.projects.p1Id } },
        reservations: { none: { status: { in: [ReservationStatus.PENDING, ReservationStatus.APPROVED] } } },
        // Free for real: other specs may leave an AVAILABLE unit under a live contract.
        contracts: { none: { status: { not: 'CANCELLED' }, deletedAt: null } },
      },
      select: { id: true },
    });
    const body = {
      leadId: fixtures.flowD.broker1ApprovedLeadId,
      unitId: unit.id,
      installmentPlanTemplateId: fixtures.flowD.planTemplateP1Id,
      selectedDurationOptionId: fixtures.flowD.planP1DurationOptionId,
      expiresInHours: 72,
    };
    const post = () => http().post('/v1/portal/reservations').set('Authorization', bearer(brokerToken)).send(body);
    const results = await Promise.all([post(), post()]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    const live = await testApp.rawPrisma.reservation.count({
      where: { unitId: unit.id, status: { in: [ReservationStatus.PENDING, ReservationStatus.APPROVED] } },
    });
    expect(live).toBe(1);
  });

  it('R1-1b: reservation numbers run per company — another company holding the next number does not block ours', async () => {
    const raw = testApp.rawPrisma;
    const admin = await raw.user.findUniqueOrThrow({ where: { id: fixtures.userIds.adminId }, select: { companyId: true } });
    const prefix = `RES-${new Date().getFullYear()}-`;
    const ours = await raw.reservation.findMany({
      where: { companyId: admin.companyId, reservationNumber: { startsWith: prefix } },
      select: { reservationNumber: true },
    });
    const next = `${prefix}${String(Math.max(0, ...ours.map((r) => parseInt(r.reservationNumber!.slice(prefix.length), 10) || 0)) + 1).padStart(4, '0')}`;

    const other = await raw.company.create({ data: { name: 'R1 Other Co', slug: `r1-other-${stamp}` }, select: { id: true } });
    const anyRes = await raw.reservation.findFirstOrThrow({ select: { unitId: true, salesId: true, clientId: true } });
    const foreign = await raw.reservation.create({
      data: { ...anyRes, companyId: other.id, reservationNumber: next, status: ReservationStatus.CANCELLED, expiresAt: new Date() },
      select: { id: true },
    });
    try {
      const unit = await raw.unit.findFirstOrThrow({
        where: {
          status: UnitStatus.AVAILABLE,
          building: { phase: { projectId: fixtures.projects.p1Id } },
          reservations: { none: { status: { in: [ReservationStatus.PENDING, ReservationStatus.APPROVED] } } },
        // Free for real: other specs may leave an AVAILABLE unit under a live contract.
        contracts: { none: { status: { not: 'CANCELLED' }, deletedAt: null } },
        },
        select: { id: true },
      });
      const res = await http().post('/v1/portal/reservations').set('Authorization', bearer(brokerToken)).send({
        leadId: fixtures.flowD.broker1ApprovedLeadId,
        unitId: unit.id,
        installmentPlanTemplateId: fixtures.flowD.planTemplateP1Id,
        selectedDurationOptionId: fixtures.flowD.planP1DurationOptionId,
        expiresInHours: 72,
      });
      expect(res.status).toBe(201);
      expect(res.body.reservationNumber).toBe(next);
    } finally {
      await raw.reservation.delete({ where: { id: foreign.id } });
      await raw.company.delete({ where: { id: other.id } });
    }
  });

  it('R1-2: a staff phone is refused without revealing whose it is; a new lead echoes what the broker typed', async () => {
    const raw = testApp.rawPrisma;
    const sales = await raw.user.findUniqueOrThrow({ where: { id: fixtures.userIds.salesId }, select: { phone: true } });
    const staffPhone = sales.phone ?? `+2010${stamp}`;
    if (!sales.phone) await raw.user.update({ where: { id: fixtures.userIds.salesId }, data: { phone: staffPhone } });
    try {
      const refused = await http()
        .post('/v1/portal/leads')
        .set('Authorization', bearer(brokerToken))
        .send({ fullName: 'R1 Probe', phone: staffPhone });
      expect(refused.status).toBe(409);
      expect(JSON.stringify(refused.body)).not.toContain('@');
    } finally {
      if (!sales.phone) await raw.user.update({ where: { id: fixtures.userIds.salesId }, data: { phone: null } });
    }

    const ok = await http()
      .post('/v1/portal/leads')
      .set('Authorization', bearer(brokerToken))
      .send({ fullName: 'R1 New Buyer', phone: `+2011${stamp}` });
    expect(ok.status).toBe(201);
    expect(ok.body.fullName).toBe('R1 New Buyer');
    expect(Object.keys(ok.body.client ?? {})).toEqual(['id']);
    expect(ok.body).not.toHaveProperty('duplicateOfId');
  });

  it('R1-3: an agent without the commission permission sees no money; a non-manager sees only their own work', async () => {
    const raw = testApp.rawPrisma;
    const link = await raw.brokerUser.findUniqueOrThrow({
      where: { userId: fixtures.userIds.broker1UserId },
      select: { canViewCommissions: true, isPrimaryContact: true, canManageBrokerUsers: true },
    });
    await raw.brokerUser.update({
      where: { userId: fixtures.userIds.broker1UserId },
      data: { canViewCommissions: false, isPrimaryContact: false, canManageBrokerUsers: false },
    });
    // A lead of the same firm submitted by another agent.
    const other = await raw.user.create({
      data: { companyId: (await raw.user.findUniqueOrThrow({ where: { id: fixtures.userIds.broker1UserId } })).companyId, role: 'BROKER', fullName: 'R1 Other Agent', email: `r1-agent-${stamp}@example.com`, locale: 'ar' },
      select: { id: true, companyId: true },
    });
    const broker = await raw.broker.findFirstOrThrow({ where: { code: fixtures.brokerCodes.BROKER_1 }, select: { id: true } });
    const colleagueClient = await raw.user.create({
      data: { companyId: other.companyId, role: 'CLIENT', fullName: 'R1 Colleague Client', phone: `+2012${stamp}`, locale: 'ar' },
      select: { id: true },
    });
    const foreignLead = await raw.lead.create({
      data: {
        companyId: other.companyId,
        clientId: colleagueClient.id,
        fullName: 'R1 Colleague Lead',
        phone: `+2012${stamp}`,
        brokerId: broker.id,
        brokerAgentId: other.id,
        stage: 'NEW',
      },
      select: { id: true },
    });
    try {
      const reservations = await http().get('/v1/portal/reservations').set('Authorization', bearer(brokerToken));
      expect(reservations.status).toBe(200);
      for (const r of reservations.body.data) {
        expect(r.commissionLockedPct).toBeNull();
        expect(r.commissionLockedAmount).toBeNull();
      }
      const leads = await http().get('/v1/portal/leads').set('Authorization', bearer(brokerToken));
      expect(leads.status).toBe(200);
      expect(leads.body.data.map((l: { id: string }) => l.id)).not.toContain(foreignLead.id);
      await http().get(`/v1/portal/leads/${foreignLead.id}`).set('Authorization', bearer(brokerToken)).expect(404);
    } finally {
      await raw.brokerUser.update({ where: { userId: fixtures.userIds.broker1UserId }, data: link });
      await raw.lead.delete({ where: { id: foreignLead.id } });
      await raw.user.deleteMany({ where: { id: { in: [other.id, colleagueClient.id] } } });
    }
  });
});
