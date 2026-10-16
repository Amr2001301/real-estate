/**
 * Q3 — a sales person who leaves.
 *
 * Their open work moves to a colleague in one step (closed work keeps its
 * history), deactivation cuts every session and push token, nothing new can
 * be assigned to them, and automatic notifications stop reaching them.
 */
import 'reflect-metadata';
import request from 'supertest';
import { LeadStage, ReservationStatus, UserRole } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

describe('Q3 — offboarding a sales person (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  let companyId: string;
  let leaverId: string;
  let openLeadId: string;
  let wonLeadId: string;
  let reservationId: string;
  const stamp = Date.now().toString().slice(-8);

  const http = () => request(testApp.app.getHttpServer());

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    adminToken = await loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!');
    const raw = testApp.rawPrisma;
    const admin = await raw.user.findUniqueOrThrow({ where: { id: fixtures.userIds.adminId }, select: { companyId: true } });
    companyId = admin.companyId!;

    const leaver = await raw.user.create({
      data: { companyId, role: UserRole.SALES, fullName: 'Q3 Leaver', email: `q3-leaver-${stamp}@example.com`, locale: 'ar' },
      select: { id: true },
    });
    leaverId = leaver.id;
    const client = await raw.user.create({
      data: { companyId, role: UserRole.CLIENT, fullName: 'Q3 Client', phone: `+2011${stamp}`, locale: 'ar' },
      select: { id: true },
    });
    const lead = (stage: LeadStage) =>
      raw.lead.create({
        data: { companyId, clientId: client.id, fullName: 'Q3 Client', phone: `+2011${stamp}`, stage, assignedSalesId: leaverId },
        select: { id: true },
      });
    openLeadId = (await lead(LeadStage.NEGOTIATION)).id;
    wonLeadId = (await lead(LeadStage.WON)).id;
    const unit = await raw.unit.findFirstOrThrow({ where: { companyId }, select: { id: true } });
    reservationId = (
      await raw.reservation.create({
        data: {
          companyId,
          unitId: unit.id,
          salesId: leaverId,
          clientId: client.id,
          status: ReservationStatus.PENDING,
          expiresAt: new Date(Date.now() + 86_400_000),
        },
        select: { id: true },
      })
    ).id;
    await raw.refreshToken.create({
      data: { userId: leaverId, tokenHash: `q3-${stamp}`, expiresAt: new Date(Date.now() + 30 * 86_400_000) },
    });
    await raw.deviceToken.create({ data: { userId: leaverId, token: `q3-device-${stamp}`, platform: 'android' } });
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    await raw.reservation.deleteMany({ where: { id: reservationId } }).catch(() => void 0);
    await raw.lead.deleteMany({ where: { id: { in: [openLeadId, wonLeadId] } } }).catch(() => void 0);
  });

  it('Q3-1: handing over to an inactive user is refused (400)', async () => {
    const res = await http()
      .post(`/v1/users/${leaverId}/offboard`)
      .set('Authorization', bearer(adminToken))
      .send({ toUserId: leaverId });
    expect(res.status).toBe(400);
  });

  it('Q3-2: open work moves to the colleague; won leads keep their owner', async () => {
    const res = await http()
      .post(`/v1/users/${leaverId}/offboard`)
      .set('Authorization', bearer(adminToken))
      .send({ toUserId: fixtures.userIds.salesId });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ leads: 1, reservations: 1 });
    const raw = testApp.rawPrisma;
    expect((await raw.lead.findUniqueOrThrow({ where: { id: openLeadId } })).assignedSalesId).toBe(fixtures.userIds.salesId);
    expect((await raw.lead.findUniqueOrThrow({ where: { id: wonLeadId } })).assignedSalesId).toBe(leaverId);
    expect((await raw.reservation.findUniqueOrThrow({ where: { id: reservationId } })).salesId).toBe(fixtures.userIds.salesId);
  });

  it('Q3-3: deactivating revokes sessions, drops push tokens; nothing new can be assigned to them', async () => {
    await http()
      .patch(`/v1/users/${leaverId}/deactivate`)
      .set('Authorization', bearer(adminToken))
      .expect(200);
    const raw = testApp.rawPrisma;
    expect(await raw.refreshToken.count({ where: { userId: leaverId, revokedAt: null } })).toBe(0);
    expect(await raw.deviceToken.count({ where: { userId: leaverId } })).toBe(0);

    const assign = await http()
      .patch(`/v1/leads/${openLeadId}/assign`)
      .set('Authorization', bearer(adminToken))
      .send({ assignedSalesId: leaverId });
    expect(assign.status).toBe(400);
    expect((await raw.lead.findUniqueOrThrow({ where: { id: openLeadId } })).assignedSalesId).toBe(fixtures.userIds.salesId);
  });

  it('Q3-4: automatic notifications no longer reach the deactivated account', async () => {
    const before = await testApp.rawPrisma.notification.count({ where: { userId: leaverId } });
    // A stage change on a lead they still own notifies its sales person.
    await http()
      .patch(`/v1/leads/${wonLeadId}/stage`)
      .set('Authorization', bearer(adminToken))
      .send({ stage: 'LOST' });
    expect(await testApp.rawPrisma.notification.count({ where: { userId: leaverId } })).toBe(before);
  });
});
