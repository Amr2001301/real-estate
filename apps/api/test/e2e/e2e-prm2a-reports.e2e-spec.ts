/**
 * PRM phase 2a — the reports open by their codes, and a granted non-admin
 * sees what the admin sees (rule 2: reports are the whole company's).
 *
 * - reports:sales:read, reports:operational:read and reports:financial:read
 *   each open their own reports; one never opens another's.
 * - The financial code also opens «المستحقات والالتزامات» (the ledger) and the
 *   refunds still owed, as on the admin's financial report.
 * - A granted rep's figures are the admin's figures, not their own.
 * - No customer phone number appears in them.
 */
import 'reflect-metadata';
import request from 'supertest';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

describe('PRM2a — reports open by their codes (e2e)', () => {
  let testApp: TestApp;
  let adminToken: string;
  let repId: string;
  let repToken: string;
  const stamp = Date.now().toString().slice(-7);
  const range = 'dateFrom=2020-01-01&dateTo=2030-12-31';

  const http = () => request(testApp.app.getHttpServer());
  const as = <T extends request.Test>(token: string, r: T) => r.set('Authorization', bearer(token));
  const grant = (codes: string[], remove = false) =>
    as(adminToken, http().patch(`/v1/users/${repId}/permissions`))
      .send(remove ? { removePermissionCodes: codes } : { addPermissionCodes: codes })
      .expect(200);

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    await loadE2EFixtures(testApp.rawPrisma);
    adminToken = await loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!');
    const created = await as(adminToken, http().post('/v1/users'))
      .send({
        role: 'SALES',
        fullName: 'PRM2a Rep',
        email: `prm2a-rep-${stamp}@example.com`,
        password: 'Prm2aRepPass123!',
      })
      .expect(201);
    repId = created.body.id;
    repToken = await testApp.signAccessToken(repId, 'SALES');
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    await raw.userPermission.deleteMany({ where: { userId: repId } });
    await raw.notification.deleteMany({ where: { userId: repId } });
    await raw.auditLog.deleteMany({ where: { OR: [{ entityId: repId }, { actorId: repId }] } });
    await raw.user.deleteMany({ where: { id: repId } });
  });

  it('PRM2a-1: without a report code every report stays closed', async () => {
    for (const path of [
      `/v1/reports/sales?${range}`,
      `/v1/reports/financial?${range}`,
      `/v1/reports/kpis`,
      '/v1/reports/ledger',
      '/v1/contracts/refunds/outstanding',
    ]) {
      await as(repToken, http().get(path)).expect(403);
    }
  });

  it('PRM2a-2: the sales code opens the sales reports only — with the admin’s figures', async () => {
    await grant(['reports:sales:read']);
    const mine = (await as(repToken, http().get(`/v1/reports/sales?${range}`)).expect(200)).body;
    const admins = (await as(adminToken, http().get(`/v1/reports/sales?${range}`)).expect(200))
      .body;
    expect(mine).toEqual(admins);
    await as(repToken, http().get(`/v1/reports/sales-funnel?${range}`)).expect(200);
    await as(repToken, http().get(`/v1/reports/financial?${range}`)).expect(403);
    await as(repToken, http().get('/v1/reports/kpis')).expect(403);
    await grant(['reports:sales:read'], true);
  });

  it('PRM2a-3: the financial code opens the financial reports, the ledger and the refunds owed', async () => {
    await grant(['reports:financial:read']);
    const mine = (await as(repToken, http().get('/v1/reports/ledger')).expect(200)).body;
    const admins = (await as(adminToken, http().get('/v1/reports/ledger')).expect(200)).body;
    expect(mine).toEqual(admins);
    const rows = (
      await as(
        repToken,
        http().get('/v1/reports/ledger/rows?group=installments&pageSize=50'),
      ).expect(200)
    ).body;
    expect(JSON.stringify(rows)).not.toMatch(/"phone"/);
    await as(repToken, http().get(`/v1/reports/financial-dashboard?${range}`)).expect(200);
    await as(repToken, http().get('/v1/contracts/refunds/outstanding')).expect(200);
    await as(repToken, http().get(`/v1/reports/sales?${range}`)).expect(403);
    await grant(['reports:financial:read'], true);
  });

  it('PRM2a-4: the operational code opens the operational reports', async () => {
    await grant(['reports:operational:read']);
    await as(repToken, http().get('/v1/reports/kpis')).expect(200);
    await as(repToken, http().get(`/v1/reports/reservations?${range}`)).expect(200);
    await as(repToken, http().get('/v1/reports/ledger')).expect(403);
    await grant(['reports:operational:read'], true);
  });
});
