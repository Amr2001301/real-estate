/**
 * Y2 — "upcoming visits" on the sales and manager home pages are visits still
 * to happen. The pages listed every visit scheduled from now on, so a visit
 * completed or cancelled ahead of its time was counted as upcoming.
 */
import 'reflect-metadata';
import request from 'supertest';
import { AppointmentStatus } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

describe('Y2 — upcoming visits are open ones (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  const ids: string[] = [];
  const stamp = Date.now().toString().slice(-7);

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    adminToken = await loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!');
    const raw = testApp.rawPrisma;
    const companyId = (
      await raw.user.findUniqueOrThrow({ where: { id: fixtures.userIds.adminId } })
    ).companyId!;
    const tomorrow = new Date(Date.now() + 26 * 3_600_000);
    for (const [i, status] of [
      AppointmentStatus.SCHEDULED,
      AppointmentStatus.COMPLETED,
      AppointmentStatus.CANCELLED,
    ].entries()) {
      ids.push(
        (
          await raw.visitAppointment.create({
            data: {
              companyId,
              visitNumber: `Y2-${stamp}-${i}`,
              assignedSalesId: fixtures.userIds.salesId,
              clientId: fixtures.userIds.customer1UserId,
              scheduledAt: tomorrow,
              status,
            },
            select: { id: true },
          })
        ).id,
      );
    }
  });

  afterAll(async () => {
    await testApp.rawPrisma.visitAppointment.deleteMany({ where: { id: { in: ids } } });
  });

  it('Y2-1: open=true lists only the visit still to happen; without it all three come back', async () => {
    const from = new Date().toISOString();
    const list = async (extra: string) =>
      (
        await request(testApp.app.getHttpServer())
          .get(
            `/v1/visits/appointments?assignedSalesId=${fixtures.userIds.salesId}&scheduledFrom=${from}&pageSize=100${extra}`,
          )
          .set('Authorization', bearer(adminToken))
          .expect(200)
      ).body.data
        .map((a: { id: string }) => a.id)
        .filter((id: string) => ids.includes(id));

    expect((await list('&open=true')).sort()).toEqual([ids[0]]);
    expect((await list('')).sort()).toEqual([...ids].sort());
  });
});
