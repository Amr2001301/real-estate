/**
 * METRICS-AUTH — /metrics endpoint access control
 *
 * The /metrics endpoint is @Public() (no JWT required so Prometheus scrapers
 * can reach it) but guarded inside the handler by METRICS_TOKEN: if the env
 * var is set, callers must present it as Bearer <token>.
 *
 * Without the env var the endpoint is open — acceptable for dev, not for prod.
 * In this test suite we set METRICS_TOKEN explicitly to exercise all paths.
 *
 * Tests:
 *   METRICS-1: no token header, METRICS_TOKEN set → 401
 *   METRICS-2: wrong token, METRICS_TOKEN set → 401
 *   METRICS-3: correct token → 200 + Prometheus text/plain content
 *   METRICS-4: no METRICS_TOKEN in env → open (200 with no auth header) — documents the behaviour
 *
 * Importantly: this endpoint must NOT require a JWT. Prometheus has no concept
 * of user sessions. An unauthenticated HTTP request (no Authorization header
 * at all) must be handled by the handler's own token check, not rejected by
 * JwtAuthGuard with 401 before the handler runs.
 *
 * Isolation note: this spec uses createTestApp() (isolated NestJS instance)
 * rather than the shared security singleton because the tests set process.env
 * at runtime. Jest gives each test file its own fake process.env copy; the
 * handler reads from the vm context that compiled the app, not from the caller's
 * vm context. Using an isolated app ensures the handler is compiled within THIS
 * file's vm context, so beforeEach/afterEach env changes are visible.
 */

import request from 'supertest';
import { type TestApp, createTestApp } from '../setup-app';

const GOOD_TOKEN = 'super-secret-metrics-token-for-test';
const WRONG_TOKEN = 'definitely-wrong-token';

let testApp: TestApp;

beforeAll(async () => {
  testApp = await createTestApp({ skipThrottle: true });
}, 60_000);

afterAll(async () => {
  await testApp.close();
}, 30_000);

const http = () => request(testApp.app.getHttpServer());

describe('METRICS-AUTH — /metrics endpoint access control', () => {
  describe('with METRICS_TOKEN configured in environment', () => {
    beforeEach(() => {
      process.env['METRICS_TOKEN'] = GOOD_TOKEN;
    });
    afterEach(() => {
      delete process.env['METRICS_TOKEN'];
    });

    it('METRICS-1: no Authorization header → 401 (not 401 from JwtAuthGuard — from handler)', async () => {
      const res = await http().get('/metrics');
      // If JwtAuthGuard fired instead of the handler, the error message would
      // be {"statusCode":401,"message":"Unauthorized"} (JSON). The handler
      // returns plain text "Unauthorized". Either way status must be 401.
      expect(res.status).toBe(401);
      // Prove the request reached the handler, not JwtAuthGuard:
      // JwtAuthGuard returns JSON {"statusCode":401,...}; the handler returns plain "Unauthorized".
      expect(res.text).toBe('Unauthorized');
    });

    it('METRICS-2: wrong token → 401', async () => {
      const res = await http()
        .get('/metrics')
        .set('Authorization', `Bearer ${WRONG_TOKEN}`);
      expect(res.status).toBe(401);
    });

    it('METRICS-3: correct METRICS_TOKEN → 200 + Prometheus text', async () => {
      const res = await http()
        .get('/metrics')
        .set('Authorization', `Bearer ${GOOD_TOKEN}`);
      if (res.status !== 200) {
        throw new Error(
          `METRICS endpoint unreachable: status=${res.status}. ` +
          'Check that @Public() was added to MetricsController.metrics — ' +
          'the global JwtAuthGuard must not intercept this route.',
        );
      }
      expect(res.status).toBe(200);
      // Prometheus text format always contains the process_cpu line.
      expect(res.text).toMatch(/^# (HELP|TYPE) /m);
    });
  });

  describe('without METRICS_TOKEN (env var absent)', () => {
    beforeEach(() => {
      delete process.env['METRICS_TOKEN'];
    });

    it('METRICS-4: no token configured → 200 without auth (open endpoint — set METRICS_TOKEN in prod)', async () => {
      const res = await http().get('/metrics');
      // Without METRICS_TOKEN the handler skips the token check entirely.
      // This is the dev default. Document it here so it is visible in CI.
      expect(res.status).toBe(200);
      expect(res.text).toMatch(/^# (HELP|TYPE) /m);
    });
  });
});
