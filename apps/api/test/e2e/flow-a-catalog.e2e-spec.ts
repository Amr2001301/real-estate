/**
 * Flow A — Catalog Sync (system QA strategy §E).
 *
 * Asserts that the project + unit catalog is consistent across the
 * three exposed surfaces (public, staff/private, broker portal) and
 * that role boundaries hold. Read-only — no mutations, so concurrent
 * runs of this spec would be safe; we still keep `--runInBand` at the
 * config level so Phase 7B can safely add mutating specs without
 * re-tuning.
 *
 * The e2e seed (run by globalSetup) creates:
 *   - p1, p2, p3, p4: four demo projects (via seedPublicDemo).
 *   - broker1 firm granted to p1 + p2.
 *   - broker2 firm granted to p3.
 *   - p4 has no broker grant (negative control).
 *
 * Mapping back to the §E test matrix:
 *   A1 — Admin-created project exists           → "admin reads p1"
 *   A2 — Admin-created unit exists              → "admin reads a unit under p1"
 *   A3 — Public catalog returns public catalog  → "GET /public/projects, /units"
 *   A4 — Sales sees the private catalog         → "sales reads /projects"
 *   A5 — Broker1 sees only granted projects     → "broker1 /portal/projects = {p1,p2}"
 *   A6 — Broker2 cannot see broker1-only        → "broker2 /portal/projects ⊆ {p3}"
 *   A7 — Unauthorized hits get 401/403          → mixed token / wrong role
 *   A8 — Guest can hit public endpoints only    → no-token + public-only
 */

import request from 'supertest';
import { type TestApp, createTestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

describe('Flow A — Catalog sync (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;

  // Tokens cached once per spec; the access TTL on the JWT is comfortably
  // longer than the whole suite.
  let adminToken: string;
  let salesToken: string;
  let broker1Token: string;
  let broker2Token: string;
  let customer1Token: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);

    [adminToken, salesToken, broker1Token, broker2Token, customer1Token] = await Promise.all([
      loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!'),
      loginAs(testApp.app, 'sales@example.com', 'SalesPass123!'),
      loginAs(testApp.app, fixtures.users.BROKER_1.email, fixtures.users.BROKER_1.password),
      loginAs(testApp.app, fixtures.users.BROKER_2.email, fixtures.users.BROKER_2.password),
      loginAs(testApp.app, fixtures.users.CUSTOMER_1.email, fixtures.users.CUSTOMER_1.password, 'customer'),
    ]);
  });

  afterAll(async () => {
    await testApp.close();
  });

  const http = () => request(testApp.app.getHttpServer());

  // ── A1, A2 ───────────────────────────────────────────────────────────────
  describe('A1/A2 — admin can read the seeded project + unit', () => {
    it('A1: GET /v1/projects/:p1Id returns p1 to admin', async () => {
      const res = await http()
        .get(`/v1/projects/${fixtures.projects.p1Id}`)
        .set('Authorization', bearer(adminToken));
      expect(res.status).toBe(200);
      expect(res.body?.id).toBe(fixtures.projects.p1Id);
    });

    it('A2: GET /v1/units/:unitId returns the seeded sample unit to admin', async () => {
      const res = await http()
        .get(`/v1/units/${fixtures.units.sampleUnitInP1Id}`)
        .set('Authorization', bearer(adminToken));
      expect(res.status).toBe(200);
      expect(res.body?.id).toBe(fixtures.units.sampleUnitInP1Id);
    });

    it('A2(sanity): the unit exists in the DB at the same ID', async () => {
      // A second check via prisma so a buggy controller serializer can't
      // create a false positive on A2 — confirms the e2e DB is the same
      // one we're reading via HTTP.
      const row = await testApp.rawPrisma.unit.findUnique({
        where: { id: fixtures.units.sampleUnitInP1Id },
        select: { id: true },
      });
      expect(row?.id).toBe(fixtures.units.sampleUnitInP1Id);
    });
  });

  // ── A3 ───────────────────────────────────────────────────────────────────
  describe('A3 — public catalog exposes the public project + unit', () => {
    it('GET /v1/public/projects (no auth) returns p1 in the result set', async () => {
      const res = await http().get('/v1/public/projects');
      expect(res.status).toBe(200);
      const ids = collectIds(res.body);
      expect(ids).toContain(fixtures.projects.p1Id);
    });

    it('GET /v1/public/projects/:p1Id (no auth) returns 200', async () => {
      const res = await http().get(`/v1/public/projects/${fixtures.projects.p1Id}`);
      expect(res.status).toBe(200);
      expect(res.body?.id).toBe(fixtures.projects.p1Id);
    });

    it('GET /v1/public/units (no auth) includes the sample unit', async () => {
      const res = await http().get('/v1/public/units');
      expect(res.status).toBe(200);
      const ids = collectIds(res.body);
      expect(ids).toContain(fixtures.units.sampleUnitInP1Id);
    });
  });

  // ── A4 ───────────────────────────────────────────────────────────────────
  describe('A4 — Sales sees the private catalog', () => {
    it('GET /v1/projects as sales lists all seeded projects', async () => {
      const res = await http()
        .get('/v1/projects')
        .set('Authorization', bearer(salesToken));
      expect(res.status).toBe(200);
      const ids = collectIds(res.body);
      // Sales must see all admin-managed projects (p1, p2, p3 at minimum).
      expect(ids).toEqual(expect.arrayContaining([
        fixtures.projects.p1Id,
        fixtures.projects.p2Id,
        fixtures.projects.p3Id,
      ]));
    });

    it('GET /v1/units as sales includes the sample unit', async () => {
      const res = await http()
        .get('/v1/units')
        .set('Authorization', bearer(salesToken));
      expect(res.status).toBe(200);
      const ids = collectIds(res.body);
      expect(ids).toContain(fixtures.units.sampleUnitInP1Id);
    });
  });

  // ── A5 ───────────────────────────────────────────────────────────────────
  describe('A5 — Broker1 portal returns only the broker1-granted projects', () => {
    it('GET /v1/portal/projects as broker1 returns exactly {p1, p2}', async () => {
      const res = await http()
        .get('/v1/portal/projects')
        .set('Authorization', bearer(broker1Token));
      expect(res.status).toBe(200);
      // The portal response wraps each project in { project, access } —
      // pull the IDs out of the project key.
      const ids = collectIds(res.body, /* preferProjectId */ true);
      expect(new Set(ids)).toEqual(new Set([fixtures.projects.p1Id, fixtures.projects.p2Id]));
    });
  });

  // ── A6 ───────────────────────────────────────────────────────────────────
  describe('A6 — Broker2 cannot see broker1-only projects', () => {
    it('GET /v1/portal/projects as broker2 returns exactly {p3}', async () => {
      const res = await http()
        .get('/v1/portal/projects')
        .set('Authorization', bearer(broker2Token));
      expect(res.status).toBe(200);
      const ids = collectIds(res.body, true);
      expect(new Set(ids)).toEqual(new Set([fixtures.projects.p3Id]));
      // And explicitly: NONE of broker1's grants leak across.
      expect(ids).not.toContain(fixtures.projects.p1Id);
      expect(ids).not.toContain(fixtures.projects.p2Id);
    });
  });

  // ── A7 ───────────────────────────────────────────────────────────────────
  describe('A7 — unauthorized access to protected endpoints fails closed', () => {
    it('GET /v1/projects with NO token → 401', async () => {
      const res = await http().get('/v1/projects');
      expect(res.status).toBe(401);
    });

    it('GET /v1/portal/projects with NO token → 401', async () => {
      const res = await http().get('/v1/portal/projects');
      expect(res.status).toBe(401);
    });

    it('GET /v1/projects as CUSTOMER (wrong role) → 403', async () => {
      const res = await http()
        .get('/v1/projects')
        .set('Authorization', bearer(customer1Token));
      expect(res.status).toBe(403);
    });

    it('GET /v1/portal/projects as SALES (wrong role) → 403', async () => {
      const res = await http()
        .get('/v1/portal/projects')
        .set('Authorization', bearer(salesToken));
      expect(res.status).toBe(403);
    });
  });

  // ── A8 ───────────────────────────────────────────────────────────────────
  describe('A8 — guest can reach public endpoints only', () => {
    it('GET /v1/public/projects without auth → 200', async () => {
      const res = await http().get('/v1/public/projects');
      expect(res.status).toBe(200);
    });

    it('GET /v1/public/units without auth → 200', async () => {
      const res = await http().get('/v1/public/units');
      expect(res.status).toBe(200);
    });

    it('GET /v1/projects without auth → 401', async () => {
      const res = await http().get('/v1/projects');
      expect(res.status).toBe(401);
    });

    it('GET /v1/public/projects/:NONEXISTENT → 404 (no info-leak about other tenants)', async () => {
      const res = await http().get('/v1/public/projects/00000000-0000-0000-0000-000000000000');
      expect(res.status).toBe(404);
    });
  });
});

/**
 * Read project / unit IDs out of whichever response shape the controller
 * returns: a bare array, `{ data: [...] }`, or the broker portal's
 * `{ project, access }` wrappers.
 */
function collectIds(body: unknown, preferProjectId = false): string[] {
  const list: unknown = Array.isArray(body)
    ? body
    : (body as { data?: unknown })?.data;
  if (!Array.isArray(list)) return [];
  return list
    .map((row) => {
      if (preferProjectId && row && typeof row === 'object' && 'project' in row) {
        const p = (row as { project?: { id?: unknown } }).project;
        if (p && typeof p === 'object' && typeof p.id === 'string') return p.id;
      }
      if (row && typeof row === 'object' && 'id' in row && typeof (row as { id?: unknown }).id === 'string') {
        return (row as { id: string }).id;
      }
      return undefined;
    })
    .filter((id): id is string => typeof id === 'string');
}
