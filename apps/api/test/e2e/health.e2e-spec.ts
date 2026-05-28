/**
 * Smoke: confirms the e2e harness actually boots the real Nest app
 * against the real DB. If this file fails, every other e2e is going to
 * fail for the same reason — so we keep it minimal and run it first.
 */

import request from 'supertest';
import { type TestApp, createTestApp } from '../setup-app';

describe('Health (e2e)', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });
  afterAll(async () => {
    await testApp.close();
  });

  it('GET /health returns ok with a live DB connection', async () => {
    const res = await request(testApp.app.getHttpServer()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', db: true });
    // The `time` field is an ISO timestamp; just sanity-check it's
    // parseable so we'd catch a regression where Nest stops serializing.
    expect(Number.isFinite(Date.parse(res.body.time))).toBe(true);
  });

  it('GET /v1/projects (protected) without a token returns 401', async () => {
    // Sanity that the global JwtAuthGuard is wired and the v1 prefix is set.
    const res = await request(testApp.app.getHttpServer()).get('/v1/projects');
    expect(res.status).toBe(401);
  });
});
