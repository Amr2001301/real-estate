/**
 * PRM phase 2c — cheques and bonus open by their codes (rule 2: money pages
 * show the whole company to whoever the admin granted them).
 *
 * - payment-instruments:manage opens the cheques page and its actions;
 *   recording a bounce stays with the admin.
 * - bonus entries: a rep sees their own, a manager their team's; the new
 *   bonus:entries:read:all opens the whole company's and the export.
 * - bonus:rules:manage opens the rules; approving and paying stay with the
 *   admin.
 */
import 'reflect-metadata';
import request from 'supertest';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

describe('PRM2c — cheques and bonus open by their codes (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  let repId: string;
  let repToken: string;
  let entryId: string;
  const stamp = Date.now().toString().slice(-7);

  const http = () => request(testApp.app.getHttpServer());
  const as = <T extends request.Test>(token: string, r: T) => r.set('Authorization', bearer(token));
  const grant = (codes: string[], remove = false) =>
    as(adminToken, http().patch(`/v1/users/${repId}/permissions`))
      .send(remove ? { removePermissionCodes: codes } : { addPermissionCodes: codes })
      .expect(200);

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    adminToken = await loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!');
    const created = await as(adminToken, http().post('/v1/users'))
      .send({
        role: 'SALES',
        fullName: 'PRM2c Rep',
        email: `prm2c-rep-${stamp}@example.com`,
        password: 'Prm2cRepPass123!',
      })
      .expect(201);
    repId = created.body.id;
    repToken = await testApp.signAccessToken(repId, 'SALES');

    // One bonus entry for another rep (sales@), so "the whole company" has
    // something this rep does not own.
    const companyId = (
      await testApp.rawPrisma.user.findUniqueOrThrow({ where: { id: fixtures.userIds.salesId } })
    ).companyId!;
    const rule = await testApp.rawPrisma.bonusRule.findFirstOrThrow({
      where: { companyId },
      select: { id: true },
    });
    entryId = (
      await testApp.rawPrisma.bonusEntry.create({
        data: {
          companyId,
          ruleId: rule.id,
          salesId: fixtures.userIds.salesId,
          amount: 1000,
          period: '2026-10',
          source: 'MANUAL',
        },
        select: { id: true },
      })
    ).id;
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    await raw.bonusEntry.deleteMany({ where: { id: entryId } });
    await raw.userPermission.deleteMany({ where: { userId: repId } });
    await raw.notification.deleteMany({ where: { userId: repId } });
    await raw.auditLog.deleteMany({ where: { OR: [{ entityId: repId }, { actorId: repId }] } });
    await raw.user.deleteMany({ where: { id: repId } });
  });

  it('PRM2c-1: without the codes the cheques, the rules and the export stay closed; the rep sees only their own bonus', async () => {
    await as(repToken, http().get('/v1/payment-instruments')).expect(403);
    await as(repToken, http().get('/v1/bonus-rules')).expect(403);
    await as(repToken, http().get('/v1/bonus-entries/export.csv')).expect(403);
    const mine = (await as(repToken, http().get('/v1/bonus-entries')).expect(200)).body as Array<{
      id: string;
    }>;
    expect(mine.map((e) => e.id)).not.toContain(entryId);
  });

  it('PRM2c-2: payment-instruments:manage opens the cheques; a bounce stays with the admin', async () => {
    await grant(['payment-instruments:manage']);
    const mine = (
      await as(repToken, http().get('/v1/payment-instruments?pageSize=100')).expect(200)
    ).body;
    const admins = (
      await as(adminToken, http().get('/v1/payment-instruments?pageSize=100')).expect(200)
    ).body;
    expect(mine.meta?.total ?? mine.length).toBe(admins.meta?.total ?? admins.length);
    const first = (admins.data ?? admins)[0] as { id: string } | undefined;
    if (first) {
      await as(repToken, http().get(`/v1/payment-instruments/${first.id}`)).expect(200);
      await as(repToken, http().post(`/v1/payment-instruments/${first.id}/bounce`))
        .send({ reason: 'x' })
        .expect(403);
    }
    await grant(['payment-instruments:manage'], true);
    await as(repToken, http().get('/v1/payment-instruments')).expect(403);
  });

  it('PRM2c-3: bonus:entries:read:all opens the whole company’s entries and the export', async () => {
    await grant(['bonus:entries:read:all']);
    const mine = (await as(repToken, http().get('/v1/bonus-entries')).expect(200)).body as Array<{
      id: string;
    }>;
    const admins = (await as(adminToken, http().get('/v1/bonus-entries')).expect(200))
      .body as Array<{ id: string }>;
    expect(mine.map((e) => e.id).sort()).toEqual(admins.map((e) => e.id).sort());
    expect(mine.map((e) => e.id)).toContain(entryId);
    await as(repToken, http().get('/v1/bonus-entries/export.csv')).expect(200);
    await grant(['bonus:entries:read:all'], true);
  });

  it('PRM2c-4: bonus:rules:manage opens the rules; approving and paying stay with the admin', async () => {
    await grant(['bonus:rules:manage', 'bonus:entries:approve', 'bonus:entries:pay']);
    await as(repToken, http().get('/v1/bonus-rules')).expect(200);
    await as(repToken, http().post(`/v1/bonus-entries/${entryId}/approve`))
      .send({})
      .expect(403);
    await as(repToken, http().post(`/v1/bonus-entries/${entryId}/pay`))
      .send({})
      .expect(403);
    await grant(['bonus:rules:manage', 'bonus:entries:approve', 'bonus:entries:pay'], true);
  });
});
