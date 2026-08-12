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

  // --- Liveness ---

  it('GET /health/live returns 200 { status: ok } without checking deps', async () => {
    const res = await request(testApp.app.getHttpServer()).get('/health/live');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  // --- Readiness ---

  it('GET /health/ready returns 200 { status: ok } when DB is reachable', async () => {
    const res = await request(testApp.app.getHttpServer()).get('/health/ready');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', database: 'ok' });
  });

  it('GET /health/ready response body contains no secrets or URLs', async () => {
    const res = await request(testApp.app.getHttpServer()).get('/health/ready');
    const serialised = JSON.stringify(res.body);
    expect(serialised).not.toMatch(/postgres:\/\/|mysql:\/\/|redis:\/\/|password|secret|localhost:\d/i);
  });

  it('GET /health/ready returns x-request-id response header', async () => {
    const res = await request(testApp.app.getHttpServer()).get('/health/ready');
    expect(res.headers['x-request-id']).toBeDefined();
    expect(typeof res.headers['x-request-id']).toBe('string');
    expect((res.headers['x-request-id'] as string).length).toBeGreaterThan(0);
  });

  // --- Request ID correlation ---

  it('echoes a valid incoming x-request-id back in the response', async () => {
    const myId = 'my-trace-id-abc';
    const res = await request(testApp.app.getHttpServer())
      .get('/health/live')
      .set('x-request-id', myId);
    expect(res.headers['x-request-id']).toBe(myId);
  });

  it('replaces an unsafe incoming x-request-id with a generated UUID', async () => {
    const unsafe = '<script>bad</script>';
    const res = await request(testApp.app.getHttpServer())
      .get('/health/live')
      .set('x-request-id', unsafe);
    expect(res.headers['x-request-id']).not.toBe(unsafe);
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  // --- Legacy health endpoint ---

  it('GET /health returns ok with a live DB connection', async () => {
    const res = await request(testApp.app.getHttpServer()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', db: true });
    expect(Number.isFinite(Date.parse(res.body.time))).toBe(true);
  });

  it('GET /v1/projects (protected) without a token returns 401', async () => {
    // Sanity that the global JwtAuthGuard is wired and the v1 prefix is set.
    const res = await request(testApp.app.getHttpServer()).get('/v1/projects');
    expect(res.status).toBe(401);
  });
});
