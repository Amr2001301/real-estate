/**
 * CC1 — F17. A sales manager saw no approve / reject on a team reservation
 * (approval was ADMIN-only), though managers approve deals in practice; and
 * a rep's form offered to book on behalf of another rep, a choice the API
 * silently dropped. A manager now approves and rejects the team's
 * reservations (not their own), and only an admin books for someone else.
 */
import 'reflect-metadata';
import request from 'supertest';
import { ReservationStatus } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

describe('CC1 — a sales manager decides on the team’s reservations (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let managerToken: string;
  let salesToken: string;
  const reservationIds: string[] = [];

  const http = () => request(testApp.app.getHttpServer());
  const status = async (id: string) =>
    (await testApp.rawPrisma.reservation.findUniqueOrThrow({ where: { id } })).status;

  /** A pending reservation sold by `salesId`. */
  const pending = async (salesId: string) => {
    const raw = testApp.rawPrisma;
    const companyId = (
      await raw.user.findUniqueOrThrow({ where: { id: fixtures.userIds.adminId } })
    ).companyId!;
    const unit = await raw.unit.findFirstOrThrow({ where: { companyId }, select: { id: true } });
    const r = await raw.reservation.create({
      data: {
        companyId,
        unitId: unit.id,
        salesId,
        clientId: fixtures.userIds.customer1UserId,
        status: ReservationStatus.PENDING,
        expiresAt: new Date(Date.now() + 3 * 86_400_000),
      },
      select: { id: true },
    });
    reservationIds.push(r.id);
    return r.id;
  };

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    managerToken = await loginAs(testApp.app, 'manager@example.com', 'ManagerPass123!');
    salesToken = await loginAs(testApp.app, 'sales@example.com', 'SalesPass123!');
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    await raw.reservationActivity.deleteMany({ where: { reservationId: { in: reservationIds } } });
    await raw.auditLog.deleteMany({ where: { entityId: { in: reservationIds } } });
    await raw.reservation.deleteMany({ where: { id: { in: reservationIds } } });
  });

  it('CC1-1: the manager approves a reservation of a rep on the team', async () => {
    const id = await pending(fixtures.userIds.salesId);
    await http()
      .post(`/v1/reservations/${id}/approve`)
      .set('Authorization', bearer(managerToken))
      .expect(201);
    expect(await status(id)).toBe(ReservationStatus.APPROVED);
  });

  it('CC1-2: the manager rejects a reservation of a rep on the team', async () => {
    const id = await pending(fixtures.userIds.salesId);
    await http()
      .post(`/v1/reservations/${id}/reject`)
      .set('Authorization', bearer(managerToken))
      .send({ reason: 'العميل تراجع' })
      .expect(201);
    expect(await status(id)).toBe(ReservationStatus.REJECTED);
  });

  it('CC1-3: the manager cannot decide on their own reservation', async () => {
    const id = await pending(fixtures.userIds.managerId);
    const res = await http()
      .post(`/v1/reservations/${id}/approve`)
      .set('Authorization', bearer(managerToken));
    expect(res.status).toBe(403);
    expect(res.body.message).toContain('حجزك');
    expect(await status(id)).toBe(ReservationStatus.PENDING);
  });

  it('CC1-4: a rep still cannot approve', async () => {
    const id = await pending(fixtures.userIds.salesId);
    await http()
      .post(`/v1/reservations/${id}/approve`)
      .set('Authorization', bearer(salesToken))
      .expect(403);
  });

  it('CC1-5: a rep books as themself only', async () => {
    const unit = await testApp.rawPrisma.unit.findFirstOrThrow({
      where: { status: 'AVAILABLE', building: { phase: { projectId: fixtures.projects.p1Id } } },
      select: { id: true },
    });
    const res = await http()
      .post('/v1/reservations')
      .set('Authorization', bearer(salesToken))
      .send({
        unitId: unit.id,
        clientId: fixtures.userIds.customer1UserId,
        salesId: fixtures.userIds.managerId,
      });
    expect(res.status).toBe(403);
    expect(res.body.message).toContain('باسمك فقط');
  });
});
