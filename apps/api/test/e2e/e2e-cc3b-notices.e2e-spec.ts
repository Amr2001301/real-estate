/**
 * CC3 — small findings from the manual walk-through.
 * - F22: a notification printed its dates raw: «للقسط المستحق بتاريخ
 *   2026-09-01T00:00:00.000Z», a visit «في 2026-10-20T10:00:00.000Z». A day
 *   now reads as the day, a time as the company's wall time.
 * - F38: a warranty that started before its category had a duration had no
 *   end and read «غير معروف» for good. Giving the category a duration now
 *   ends it, from its own start.
 */
import 'reflect-metadata';
import request from 'supertest';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';
import { companyTimeZone } from '../../src/common/time/company-timezone';

describe('CC3 — notification dates, open warranties (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  let companyId: string;
  const notificationIds: string[] = [];
  let categoryId = '';
  let itemId = '';
  const stamp = Date.now().toString().slice(-7);

  const http = () => request(testApp.app.getHttpServer());

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    adminToken = await loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!');
    companyId = (
      await testApp.rawPrisma.user.findUniqueOrThrow({ where: { id: fixtures.userIds.customer1UserId } })
    ).companyId!;
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    await raw.notification.deleteMany({ where: { id: { in: notificationIds } } });
    if (itemId) await raw.unitMaintenanceItem.deleteMany({ where: { id: itemId } });
    if (categoryId) await raw.maintenanceCategory.deleteMany({ where: { id: categoryId } });
  });

  it('CC3B-1: a notification shows a due day and a visit time as people read them', async () => {
    const raw = testApp.rawPrisma;
    const visitAt = '2026-10-20T10:00:00.000Z';
    for (const [templateCode, payload] of [
      ['payment_proof_rejected', { amount: '1000', installmentDueDate: '2026-09-01T00:00:00.000Z', reasonShort: `CC3B ${stamp}` }],
      ['visit_scheduled', { projectName: `CC3B ${stamp}`, scheduledAt: visitAt }],
    ] as const) {
      const n = await raw.notification.create({
        data: {
          userId: fixtures.userIds.customer1UserId,
          companyId,
          templateCode,
          payload,
          channel: 'IN_APP',
        },
        select: { id: true },
      });
      notificationIds.push(n.id);
    }

    const token = await testApp.signAccessToken(fixtures.userIds.customer1UserId, 'CUSTOMER');
    const res = await http()
      .get('/v1/me/notifications?pageSize=50')
      .set('Authorization', bearer(token))
      .set('Accept-Language', 'ar')
      .expect(200);
    const body = (code: string) =>
      (res.body.data as Array<{ id: string; templateCode: string; body: string }>).find(
        (n) => notificationIds.includes(n.id) && n.templateCode === code,
      )!.body;

    const proof = body('payment_proof_rejected');
    expect(proof).toContain('بتاريخ 2026-09-01.');
    expect(proof).not.toContain('T00:00');

    const zone = await companyTimeZone(raw, companyId);
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: zone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      })
        .formatToParts(new Date(visitAt))
        .map((p) => [p.type, p.value]),
    );
    const visit = body('visit_scheduled');
    expect(visit).toContain(`في ${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}.`);
    expect(visit).not.toContain(visitAt);
  });

  it('CC3B-2: a warranty started with no duration takes the category’s once it has one', async () => {
    const raw = testApp.rawPrisma;
    categoryId = (
      await raw.maintenanceCategory.create({
        data: { companyId, code: `cc3b-${stamp}`, name: { ar: `تكييف ${stamp}`, en: `AC ${stamp}` } },
        select: { id: true },
      })
    ).id;
    const unit = await raw.unit.findFirstOrThrow({ where: { companyId }, select: { id: true } });
    const start = new Date('2026-03-15T00:00:00.000Z');
    itemId = (
      await raw.unitMaintenanceItem.create({
        data: {
          companyId,
          unitId: unit.id,
          categoryId,
          name: { ar: 'تكييف', en: 'AC' },
          warrantyStart: start,
        },
        select: { id: true },
      })
    ).id;

    await http()
      .patch(`/v1/maintenance-categories/${categoryId}`)
      .set('Authorization', bearer(adminToken))
      .send({ warrantyValue: 1, warrantyUnit: 'YEARS' })
      .expect(200);

    const item = await raw.unitMaintenanceItem.findUniqueOrThrow({ where: { id: itemId } });
    expect(item.warrantyStart?.toISOString()).toBe(start.toISOString());
    expect(item.warrantyEnd?.toISOString().slice(0, 10)).toBe('2027-03-15');
    expect(item.warrantyDurationMonthsSnapshot).toBe(12);
  });
});
