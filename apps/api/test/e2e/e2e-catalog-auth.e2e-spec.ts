/**
 * Merged e2e group 1: Health + me-scope + Flow-A + Flow-B + Flow-C
 *
 * All five specs share a single NestJS singleton (createE2ETestApp), so the
 * vm-context boot cost is paid once. Tokens are set up in a file-level
 * beforeAll; individual describe blocks reference them directly.
 */

import request from 'supertest';
import { LeadStage, ReservationStatus } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

// ── Shared module-level state ─────────────────────────────────────────────────

let testApp: TestApp;
let fixtures: E2EFixtures;
let adminToken: string;
let salesToken: string;
let broker1Token: string;
let broker2Token: string;
let customer1Token: string;
let customer2Token: string;

beforeAll(async () => {
  testApp = await createE2ETestApp();
  fixtures = await loadE2EFixtures(testApp.rawPrisma);
  [adminToken, salesToken, broker1Token, broker2Token, customer1Token, customer2Token] =
    await Promise.all([
      loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!'),
      loginAs(testApp.app, 'sales@example.com', 'SalesPass123!'),
      loginAs(testApp.app, fixtures.users.BROKER_1.email, fixtures.users.BROKER_1.password),
      loginAs(testApp.app, fixtures.users.BROKER_2.email, fixtures.users.BROKER_2.password),
      loginAs(testApp.app, fixtures.users.CUSTOMER_1.email, fixtures.users.CUSTOMER_1.password, 'customer'),
      loginAs(testApp.app, fixtures.users.CUSTOMER_2.email, fixtures.users.CUSTOMER_2.password, 'customer'),
    ]);
});

const http = () => request(testApp.app.getHttpServer());
const phoneFor = (slug: string) =>
  `+96650099${slug.replace(/\D/g, '').padStart(4, '0').slice(-4)}`;
const futureDate = (daysFromNow: number) =>
  new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000).toISOString();

// ═════════════════════════════════════════════════════════════════════════════
// Health (e2e)
// ═════════════════════════════════════════════════════════════════════════════

describe('Health (e2e)', () => {
  it('GET /health/live returns 200 { status: ok } without checking deps', async () => {
    const res = await http().get('/health/live');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('GET /health/ready returns 200 { status: ok } when DB is reachable', async () => {
    const res = await http().get('/health/ready');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', database: 'ok' });
  });

  it('GET /health/ready response body contains no secrets or URLs', async () => {
    const res = await http().get('/health/ready');
    const serialised = JSON.stringify(res.body);
    expect(serialised).not.toMatch(/postgres:\/\/|mysql:\/\/|redis:\/\/|password|secret|localhost:\d/i);
  });

  it('GET /health/ready returns x-request-id response header', async () => {
    const res = await http().get('/health/ready');
    expect(res.headers['x-request-id']).toBeDefined();
    expect(typeof res.headers['x-request-id']).toBe('string');
    expect((res.headers['x-request-id'] as string).length).toBeGreaterThan(0);
  });

  it('echoes a valid incoming x-request-id back in the response', async () => {
    const myId = 'my-trace-id-abc';
    const res = await http().get('/health/live').set('x-request-id', myId);
    expect(res.headers['x-request-id']).toBe(myId);
  });

  it('replaces an unsafe incoming x-request-id with a generated UUID', async () => {
    const unsafe = '<script>bad</script>';
    const res = await http().get('/health/live').set('x-request-id', unsafe);
    expect(res.headers['x-request-id']).not.toBe(unsafe);
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('GET /health returns ok with a live DB connection', async () => {
    const res = await http().get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', db: true });
    expect(Number.isFinite(Date.parse(res.body.time))).toBe(true);
  });

  it('GET /v1/projects (protected) without a token returns 401', async () => {
    const res = await http().get('/v1/projects');
    expect(res.status).toBe(401);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// me/* scope audit (e2e)
// ═════════════════════════════════════════════════════════════════════════════

describe('me/* scope audit (e2e)', () => {
  it('GET /v1/me returns ONLY the authenticated user', async () => {
    const res = await http().get('/v1/users/me').set('Authorization', bearer(customer1Token));
    expect(res.status).toBe(200);
    expect(res.body?.id).toBe(fixtures.userIds.customer1UserId);
  });

  it("GET /v1/me/notifications shows only the caller's rows", async () => {
    const [c1res, c2res] = await Promise.all([
      http().get('/v1/me/notifications').set('Authorization', bearer(customer1Token)),
      http().get('/v1/me/notifications').set('Authorization', bearer(customer2Token)),
    ]);
    expect(c1res.status).toBe(200);
    expect(c2res.status).toBe(200);
    const c1Ids = collectIds(c1res.body);
    const c2Ids = collectIds(c2res.body);
    expect(c1Ids.length).toBeGreaterThan(0);
    expect(c2Ids.length).toBeGreaterThan(0);
    for (const id of c1Ids) expect(c2Ids).not.toContain(id);
  });

  it('GET /v1/me/notifications/unread-count is per-user', async () => {
    const [c1res, c2res] = await Promise.all([
      http().get('/v1/me/notifications/unread-count').set('Authorization', bearer(customer1Token)),
      http().get('/v1/me/notifications/unread-count').set('Authorization', bearer(customer2Token)),
    ]);
    expect(c1res.status).toBe(200);
    expect(c2res.status).toBe(200);
    expect(typeof c1res.body?.count).toBe('number');
    expect(typeof c2res.body?.count).toBe('number');
    expect(c1res.body.count).toBeGreaterThanOrEqual(1);
    expect(c2res.body.count).toBeGreaterThanOrEqual(1);
  });

  it("PATCH /v1/me/notifications/:id/read — cross-user denial: c1 cannot mark c2's notification", async () => {
    const customer2User = await testApp.rawPrisma.user.findFirstOrThrow({
      where: { email: fixtures.users.CUSTOMER_2.email },
      select: { id: true },
    });
    const c2Target = await testApp.rawPrisma.notification.findFirstOrThrow({
      where: { userId: customer2User.id, templateCode: 'phase7e_test', readAt: null },
      select: { id: true },
    });

    const res = await http()
      .patch(`/v1/me/notifications/${c2Target.id}/read`)
      .set('Authorization', bearer(customer1Token));
    expect(res.status).toBe(200);

    const after = await testApp.rawPrisma.notification.findUniqueOrThrow({
      where: { id: c2Target.id },
      select: { readAt: true },
    });
    expect(after.readAt).toBeNull();
  });

  it("PATCH /v1/me/notifications/read-all — only marks the caller's own rows", async () => {
    const customer2User = await testApp.rawPrisma.user.findFirstOrThrow({
      where: { email: fixtures.users.CUSTOMER_2.email },
      select: { id: true },
    });
    const c2Before = await testApp.rawPrisma.notification.findFirstOrThrow({
      where: { userId: customer2User.id, templateCode: 'phase7e_test' },
      select: { id: true, readAt: true },
    });

    const res = await http()
      .patch('/v1/me/notifications/read-all')
      .set('Authorization', bearer(customer1Token));
    expect(res.status).toBe(200);

    const c2After = await testApp.rawPrisma.notification.findUniqueOrThrow({
      where: { id: c2Before.id },
      select: { readAt: true },
    });
    expect(c2After.readAt).toBe(c2Before.readAt);
  });

  describe('me/* RBAC negatives', () => {
    it('GET /v1/users/me without token → 401', async () => {
      const res = await http().get('/v1/users/me');
      expect(res.status).toBe(401);
    });
    it('GET /v1/me/notifications/unread-count without token → 401', async () => {
      const res = await http().get('/v1/me/notifications/unread-count');
      expect(res.status).toBe(401);
    });
    it('PATCH /v1/me/notifications/read-all without token → 401', async () => {
      const res = await http().patch('/v1/me/notifications/read-all');
      expect(res.status).toBe(401);
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Flow A — Catalog sync (e2e)
// ═════════════════════════════════════════════════════════════════════════════

describe('Flow A — Catalog sync (e2e)', () => {
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
      const row = await testApp.rawPrisma.unit.findUnique({
        where: { id: fixtures.units.sampleUnitInP1Id },
        select: { id: true },
      });
      expect(row?.id).toBe(fixtures.units.sampleUnitInP1Id);
    });
  });

  describe('A3 — public catalog exposes the public project + unit', () => {
    it('GET /v1/public/projects (no auth) returns p1 in the result set', async () => {
      const res = await http().get('/v1/public/projects');
      expect(res.status).toBe(200);
      expect(collectIds(res.body)).toContain(fixtures.projects.p1Id);
    });

    it('GET /v1/public/projects/:p1Id (no auth) returns 200', async () => {
      const res = await http().get(`/v1/public/projects/${fixtures.projects.p1Id}`);
      expect(res.status).toBe(200);
      expect(res.body?.id).toBe(fixtures.projects.p1Id);
    });

    it('GET /v1/public/units (no auth) includes the sample unit', async () => {
      const res = await http().get('/v1/public/units');
      expect(res.status).toBe(200);
      expect(collectIds(res.body)).toContain(fixtures.units.sampleUnitInP1Id);
    });
  });

  describe('A4 — Sales sees the private catalog', () => {
    it('GET /v1/projects as sales lists all seeded projects', async () => {
      const res = await http().get('/v1/projects').set('Authorization', bearer(salesToken));
      expect(res.status).toBe(200);
      const ids = collectIds(res.body);
      expect(ids).toEqual(
        expect.arrayContaining([
          fixtures.projects.p1Id,
          fixtures.projects.p2Id,
          fixtures.projects.p3Id,
        ]),
      );
    });

    it('GET /v1/units as sales includes the sample unit', async () => {
      const res = await http().get('/v1/units').set('Authorization', bearer(salesToken));
      expect(res.status).toBe(200);
      expect(collectIds(res.body)).toContain(fixtures.units.sampleUnitInP1Id);
    });
  });

  // ── FG-23 — facets are computed over the filtered set, not the page ────────
  //
  // Admin KPI strips used to be computed client-side from an oversized page
  // (`?pageSize=500`), which made every count silently wrong for any company
  // holding more rows than the cap. meta.facets moves the aggregation into SQL.
  //
  // The gate is `pageSize=1`: the returned page holds one row, so any facet
  // derived from the page would sum to 1. Asserting that the facet counts sum
  // to meta.total is therefore a direct test of the property that matters, and
  // it fails both if facets are missing entirely and if a later change
  // computes them from `data` instead of from `where`.
  describe('A4b — unit list facets (FG-23)', () => {
    it('facet counts sum to meta.total, not to the returned page size', async () => {
      const res = await http()
        .get('/v1/units?pageSize=1')
        .set('Authorization', bearer(adminToken));
      expect(res.status).toBe(200);

      // The assertion is only meaningful when the page is a strict subset.
      expect(res.body.meta.total).toBeGreaterThan(1);
      expect(res.body.data).toHaveLength(1);

      const byStatus = res.body.meta?.facets?.counts?.status;
      expect(byStatus).toBeDefined();

      const summed = Object.values(byStatus as Record<string, number>).reduce(
        (a, b) => a + b,
        0,
      );
      expect(summed).toBe(res.body.meta.total);
    });

    it('facet counts honour the same filters as the list query', async () => {
      const all = await http()
        .get('/v1/units?pageSize=1')
        .set('Authorization', bearer(adminToken));
      const available = await http()
        .get('/v1/units?pageSize=1&status=AVAILABLE')
        .set('Authorization', bearer(adminToken));
      expect(available.status).toBe(200);

      // Filtering to one status must leave exactly that status in the facet,
      // with a count equal to the filtered total — proving `where` is shared
      // between the page query and the aggregate rather than applied to one.
      const filtered = available.body.meta.facets.counts.status;
      expect(Object.keys(filtered)).toEqual(['AVAILABLE']);
      expect(filtered.AVAILABLE).toBe(available.body.meta.total);
      expect(available.body.meta.total).toBeLessThanOrEqual(all.body.meta.total);
    });

    it('the price sum is a decimal string, not a float', async () => {
      const res = await http()
        .get('/v1/units?pageSize=1')
        .set('Authorization', bearer(adminToken));
      // Money is Decimal(14,2) in Postgres. Serialising it as a JSON number
      // would lose precision on large portfolios, so the contract is a string
      // — same as DepositsService totals.
      expect(typeof res.body.meta.facets.sums.price).toBe('string');
      expect(res.body.meta.facets.sums.price).toMatch(/^-?\d+(\.\d+)?$/);
    });
  });

  // ── FG-23 — the users directory is paged and filtered by the server ───────
  //
  // /dashboard/users used to fetch ?pageSize=100 and then search, filter AND
  // render from that array, so a company with more than a hundred users simply
  // did not see them. These assert the server-side capability the page now
  // depends on; without it the page silently truncates again.
  describe('A4c — users list server-side filtering (FG-23)', () => {
    it('?active=true returns only active users and a matching total', async () => {
      const all = await http()
        .get('/v1/users?pageSize=1')
        .set('Authorization', bearer(adminToken));
      expect(all.status).toBe(200);

      const activeOnly = await http()
        .get('/v1/users?pageSize=50&active=true')
        .set('Authorization', bearer(adminToken));
      expect(activeOnly.status).toBe(200);

      // Every returned row honours the filter...
      for (const u of activeOnly.body.data as Array<{ active: boolean }>) {
        expect(u.active).toBe(true);
      }
      // ...and the total is the filtered count, not the directory size. Without
      // a server-side filter the param is ignored and these two are equal.
      expect(activeOnly.body.meta.total).toBeLessThanOrEqual(all.body.meta.total);
      expect(activeOnly.body.meta.total).toBe(
        all.body.meta.facets.counts.active.true ?? 0,
      );
    });

    it('facets cover the whole directory while the page holds one row', async () => {
      const res = await http()
        .get('/v1/users?pageSize=1')
        .set('Authorization', bearer(adminToken));
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta.total).toBeGreaterThan(1);

      const byActive = res.body.meta.facets.counts.active as Record<string, number>;
      const summed = Object.values(byActive).reduce((a, b) => a + b, 0);
      expect(summed).toBe(res.body.meta.total);

      // The role facet backs the "admins + managers" tile.
      expect(res.body.meta.facets.counts.role).toBeDefined();
    });
  });

  // ── FG-23 — pageSize is bounded, on validated and unvalidated routes alike ─
  //
  // Sixteen controllers read pageSize straight off @Query with no DTO, so no
  // decorator can reach them. takeSkip() and paginate() clamp instead, which
  // makes the bound hold for every list including any added later. The DTO
  // @Max is the good error message, not the guarantee — these assert both.
  describe('A4d — pageSize upper bound (FG-23)', () => {
    const ABSURD = 100_000;

    it('an unvalidated route clamps rather than honouring an absurd pageSize', async () => {
      // /v1/users takes pageSize through a raw @Query with no DTO.
      const res = await http()
        .get(`/v1/users?pageSize=${ABSURD}`)
        .set('Authorization', bearer(adminToken));
      expect(res.status).toBe(200);

      // meta must report what was served, not what was asked for — clamping the
      // query while echoing the request would make totalPages a fiction.
      expect(res.body.meta.pageSize).toBe(500);
      expect(res.body.data.length).toBeLessThanOrEqual(500);
    });

    it('a validated route rejects an absurd pageSize outright', async () => {
      // /v1/units goes through UnitQueryDto, which now carries @Max.
      const res = await http()
        .get(`/v1/units?pageSize=${ABSURD}`)
        .set('Authorization', bearer(adminToken));
      expect(res.status).toBe(400);
    });

    it('the public catalogue is bounded too', async () => {
      // No auth at all. This was the worst of it: anyone could ask for every
      // unit row a tenant owns.
      const res = await http().get(`/v1/public/units?pageSize=${ABSURD}`);
      expect([200, 400]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.meta.pageSize).toBeLessThanOrEqual(500);
        expect(res.body.data.length).toBeLessThanOrEqual(500);
      }
    });
  });

  // ── FG-23 — the sales dashboards count on the server ──────────────────────
  //
  // The sales, sales-manager and my-compensation homes used to fetch
  // ?pageSize=100 of leads and reservations and count them client-side. Two of
  // those numbers — stale leads and reservations lapsing within 7 days — are
  // not facets, so the dashboards now ask for them as filtered totals. These
  // assert the filters they depend on. Every query is narrowed with `q` to the
  // rows created here, so the counts are exact rather than "at least".
  describe('A4e — lead and reservation filters behind the sales dashboards (FG-23)', () => {
    const MARK = `A4E${Date.now().toString(36).toUpperCase()}`;
    const DAY = 86_400_000;
    const at = (days: number) => new Date(Date.now() + days * DAY);
    const leadIds: string[] = [];
    const resvIds: Record<string, string> = {};

    beforeAll(async () => {
      const admin = await testApp.rawPrisma.user.findUniqueOrThrow({
        where: { id: fixtures.userIds.adminId },
        select: { companyId: true },
      });
      const companyId = admin.companyId!;

      const leads: Array<[LeadStage, number]> = [
        [LeadStage.NEW, -5],        // stale
        [LeadStage.INTERESTED, -4], // stale
        [LeadStage.NEW, -1],        // in the stage set, but too young
        [LeadStage.VISIT, -10],     // old, but not in the stage set
        [LeadStage.WON, -10],
      ];
      for (const [i, [stage, ageDays]] of leads.entries()) {
        const lead = await testApp.rawPrisma.lead.create({
          data: {
            companyId,
            clientId: fixtures.userIds.customer1UserId,
            fullName: `${MARK} lead ${i}`,
            phone: phoneFor(`${MARK}${i}`),
            stage,
            assignedSalesId: fixtures.userIds.salesId,
            createdAt: at(ageDays),
          },
          select: { id: true },
        });
        leadIds.push(lead.id);
      }

      const reservations: Array<[string, ReservationStatus, number]> = [
        ['soon', ReservationStatus.PENDING, 1],
        ['week', ReservationStatus.APPROVED, 5],
        ['later', ReservationStatus.APPROVED, 10],
        // The old client-side filter only excluded CONVERTED/CANCELLED/EXPIRED,
        // so a REJECTED reservation with a future expiry counted as "expiring".
        ['rejected', ReservationStatus.REJECTED, 2],
        ['cancelled', ReservationStatus.CANCELLED, 3],
      ];
      for (const [key, status, days] of reservations) {
        const r = await testApp.rawPrisma.reservation.create({
          data: {
            companyId,
            unitId: fixtures.units.sampleUnitInP1Id,
            salesId: fixtures.userIds.salesId,
            status,
            expiresAt: at(days),
            reservationNumber: `${MARK}-${key}`,
          },
          select: { id: true },
        });
        resvIds[key] = r.id;
      }
    });

    afterAll(async () => {
      await testApp.rawPrisma.reservation.deleteMany({ where: { id: { in: Object.values(resvIds) } } });
      await testApp.rawPrisma.lead.deleteMany({ where: { id: { in: leadIds } } });
    });

    it('stage accepts a list and filters to exactly those stages', async () => {
      const res = await http()
        .get(`/v1/leads?q=${MARK}&stage=NEW,INTERESTED&pageSize=50`)
        .set('Authorization', bearer(adminToken));
      expect(res.status).toBe(200);
      expect(res.body.meta.total).toBe(3);
      for (const l of res.body.data) expect(['NEW', 'INTERESTED']).toContain(l.stage);
    });

    it('createdBefore is exact, so "stale" is a server-side total', async () => {
      // What the sales home asks for: NEW or INTERESTED, created 3+ days ago.
      const res = await http()
        .get(`/v1/leads?q=${MARK}&stage=NEW,INTERESTED&createdBefore=${at(-3).toISOString()}&pageSize=1`)
        .set('Authorization', bearer(adminToken));
      expect(res.status).toBe(200);
      expect(res.body.meta.total).toBe(2);
    });

    it('active reservations lapsing within 7 days exclude rejected, cancelled and later ones', async () => {
      const res = await http()
        .get(
          `/v1/reservations?q=${MARK}&status=PENDING,APPROVED` +
            `&expiresFrom=${at(0).toISOString()}&expiresTo=${at(7).toISOString()}&pageSize=1`,
        )
        .set('Authorization', bearer(adminToken));
      expect(res.status).toBe(200);
      expect(res.body.meta.total).toBe(2);
    });

    it('sort=expiresAt returns the soonest-lapsing reservations first', async () => {
      const res = await http()
        .get(`/v1/reservations?q=${MARK}&status=PENDING,APPROVED&sort=expiresAt&pageSize=5`)
        .set('Authorization', bearer(adminToken));
      expect(res.status).toBe(200);
      expect(res.body.data.map((r: { id: string }) => r.id)).toEqual([
        resvIds.soon,
        resvIds.week,
        resvIds.later,
      ]);
    });

    it('unknown enum members and malformed instants are a 400, not a silent widening', async () => {
      const cases = [
        '/v1/leads?stage=NEW,BOGUS',
        '/v1/leads?createdBefore=not-a-date',
        '/v1/reservations?status=PENDING,NOPE',
        '/v1/reservations?expiresTo=yesterday-ish',
        '/v1/reservations?sort=price',
      ];
      for (const path of cases) {
        const res = await http().get(path).set('Authorization', bearer(adminToken));
        expect({ path, status: res.status }).toEqual({ path, status: 400 });
      }
    });
  });

  describe('A5 — Broker1 portal returns only the broker1-granted projects', () => {
    it('GET /v1/portal/projects as broker1 returns exactly {p1, p2}', async () => {
      const res = await http()
        .get('/v1/portal/projects')
        .set('Authorization', bearer(broker1Token));
      expect(res.status).toBe(200);
      const ids = collectIds(res.body, true);
      expect(new Set(ids)).toEqual(new Set([fixtures.projects.p1Id, fixtures.projects.p2Id]));
    });
  });

  describe('A6 — Broker2 cannot see broker1-only projects', () => {
    it('GET /v1/portal/projects as broker2 returns exactly {p3}', async () => {
      const res = await http()
        .get('/v1/portal/projects')
        .set('Authorization', bearer(broker2Token));
      expect(res.status).toBe(200);
      const ids = collectIds(res.body, true);
      expect(new Set(ids)).toEqual(new Set([fixtures.projects.p3Id]));
      expect(ids).not.toContain(fixtures.projects.p1Id);
      expect(ids).not.toContain(fixtures.projects.p2Id);
    });
  });

  describe('A7 — unauthorized access to protected endpoints fails closed', () => {
    it('GET /v1/projects with NO token → 401', async () => {
      expect((await http().get('/v1/projects')).status).toBe(401);
    });
    it('GET /v1/portal/projects with NO token → 401', async () => {
      expect((await http().get('/v1/portal/projects')).status).toBe(401);
    });
    it('GET /v1/projects as CUSTOMER (wrong role) → 403', async () => {
      expect(
        (await http().get('/v1/projects').set('Authorization', bearer(customer1Token))).status,
      ).toBe(403);
    });
    it('GET /v1/portal/projects as SALES (wrong role) → 403', async () => {
      expect(
        (await http().get('/v1/portal/projects').set('Authorization', bearer(salesToken))).status,
      ).toBe(403);
    });
  });

  describe('A8 — guest can reach public endpoints only', () => {
    it('GET /v1/public/projects without auth → 200', async () => {
      expect((await http().get('/v1/public/projects')).status).toBe(200);
    });
    it('GET /v1/public/units without auth → 200', async () => {
      expect((await http().get('/v1/public/units')).status).toBe(200);
    });
    it('GET /v1/projects without auth → 401', async () => {
      expect((await http().get('/v1/projects')).status).toBe(401);
    });
    it('GET /v1/public/projects/:NONEXISTENT → 404', async () => {
      expect(
        (await http().get('/v1/public/projects/00000000-0000-0000-0000-000000000000')).status,
      ).toBe(404);
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Flow B — Lead journey (e2e)
// ═════════════════════════════════════════════════════════════════════════════

describe('Flow B — Lead journey (e2e)', () => {
  it('B1: POST /v1/public/info-request (no auth) creates a Lead linked to the new client', async () => {
    const phone = phoneFor('B1');
    const res = await http().post('/v1/public/info-request').send({
      message: 'I would like more info about your projects.',
      name: 'E2E B1 Visitor',
      phone,
      projectId: fixtures.projects.p1Id,
    });
    expect(res.status).toBe(201);

    const client = await testApp.rawPrisma.user.findFirst({
      where: { phone },
      select: { id: true, role: true, fullName: true },
    });
    expect(client).not.toBeNull();
    expect(client!.role).toBe('CLIENT');

    const lead = await testApp.rawPrisma.lead.findFirst({
      where: { clientId: client!.id },
      select: { id: true, stage: true, sourceId: true, projectInterestId: true },
    });
    expect(lead).not.toBeNull();
    expect(lead!.stage).toBe(LeadStage.NEW);
    expect(lead!.projectInterestId).toBe(fixtures.projects.p1Id);
  });

  it('B2: POST /v1/public/visit-request (no auth) creates a Lead AND a VisitRequest', async () => {
    const phone = phoneFor('B2');
    const res = await http().post('/v1/public/visit-request').send({
      name: 'E2E B2 Visitor',
      phone,
      projectId: fixtures.projects.p1Id,
      preferredDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      notes: 'phase 7b — visit request from public form',
    });
    expect(res.status).toBe(201);

    const client = await testApp.rawPrisma.user.findFirstOrThrow({
      where: { phone },
      select: { id: true },
    });
    const lead = await testApp.rawPrisma.lead.findFirstOrThrow({
      where: { clientId: client.id },
      select: { id: true },
    });
    const vr = await testApp.rawPrisma.visitRequest.findFirst({
      where: { leadId: lead.id },
      select: { id: true, requestStatus: true, projectId: true },
    });
    expect(vr).not.toBeNull();
    expect(vr!.requestStatus).toBe('NEW');
    expect(vr!.projectId).toBe(fixtures.projects.p1Id);
  });

  it('B3: POST /v1/me/info-requests as CUSTOMER attributes the request to the auth user', async () => {
    const res = await http()
      .post('/v1/me/info-requests')
      .set('Authorization', bearer(customer1Token))
      .send({
        message: 'phase 7b — authenticated customer info request',
        projectId: fixtures.projects.p1Id,
      });
    expect(res.status).toBe(201);

    const ir = await testApp.rawPrisma.infoRequest.findFirst({
      where: { userId: fixtures.userIds.customer1UserId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, userId: true, projectId: true, message: true },
    });
    expect(ir).not.toBeNull();
    expect(ir!.userId).toBe(fixtures.userIds.customer1UserId);
    expect(ir!.projectId).toBe(fixtures.projects.p1Id);
  });

  describe('B4–B7: sales lifecycle (create → advance stage → activity → note)', () => {
    let leadId: string;

    it('B4: SALES can POST /v1/leads with assignedSalesId=self', async () => {
      const phone = phoneFor('B4');
      const res = await http()
        .post('/v1/leads')
        .set('Authorization', bearer(salesToken))
        .send({
          fullName: 'E2E B4 Client',
          phone,
          projectInterestId: fixtures.projects.p1Id,
          assignedSalesId: fixtures.userIds.salesId,
        });
      expect(res.status).toBe(201);
      expect(typeof res.body?.id).toBe('string');
      leadId = res.body.id;

      const row = await testApp.rawPrisma.lead.findUniqueOrThrow({
        where: { id: leadId },
        select: { stage: true, assignedSalesId: true },
      });
      expect(row.assignedSalesId).toBe(fixtures.userIds.salesId);
      expect(row.stage).toBe(LeadStage.NEW);
    });

    it('B5: SALES can PATCH /v1/leads/:id/stage to INTERESTED', async () => {
      const res = await http()
        .patch(`/v1/leads/${leadId}/stage`)
        .set('Authorization', bearer(salesToken))
        .send({ stage: 'INTERESTED', reason: 'phase 7b — first follow-up call ok' });
      expect(res.status).toBe(200);

      const row = await testApp.rawPrisma.lead.findUniqueOrThrow({
        where: { id: leadId },
        select: { stage: true },
      });
      expect(row.stage).toBe(LeadStage.INTERESTED);
    });

    it('B6: stage change writes a LeadActivity row (type=status_change, from→to in payload)', async () => {
      const acts = await testApp.rawPrisma.leadActivity.findMany({
        where: { leadId, type: 'status_change' },
        orderBy: { createdAt: 'desc' },
        select: { id: true, type: true, payload: true },
      });
      expect(acts.length).toBeGreaterThanOrEqual(1);
      expect(acts[0]!.payload).toMatchObject({
        from: LeadStage.NEW,
        to: LeadStage.INTERESTED,
      });
    });

    it('B7: SALES can POST /v1/leads/:id/notes and the note appears on /v1/leads/:id', async () => {
      const noteRes = await http()
        .post(`/v1/leads/${leadId}/notes`)
        .set('Authorization', bearer(salesToken))
        .send({ body: 'phase 7b — qualified, scheduling visit' });
      expect(noteRes.status).toBe(201);

      const getRes = await http()
        .get(`/v1/leads/${leadId}`)
        .set('Authorization', bearer(salesToken));
      expect(getRes.status).toBe(200);
      const notes = getRes.body?.notes ?? [];
      expect(Array.isArray(notes)).toBe(true);
      expect(notes.some((n: { body?: string }) => n.body?.includes('qualified'))).toBe(true);
    });
  });

  it('B8: ADMIN reads /v1/leads and sees the SALES-created leads', async () => {
    const res = await http().get('/v1/leads').set('Authorization', bearer(adminToken));
    expect(res.status).toBe(200);
    const list = Array.isArray(res.body) ? res.body : res.body?.data ?? [];
    expect(list.length).toBeGreaterThanOrEqual(1);
  });

  it('B9: broker1 creates a portal lead and sees it on /v1/portal/leads', async () => {
    const phone = phoneFor('B9');
    const createRes = await http()
      .post('/v1/portal/leads')
      .set('Authorization', bearer(broker1Token))
      .send({
        fullName: 'E2E B9 Broker1 Lead',
        phone,
        projectInterestId: fixtures.projects.p1Id,
      });
    expect(createRes.status).toBe(201);
    const newLeadId: unknown = createRes.body?.id ?? createRes.body?.lead?.id;
    expect(typeof newLeadId).toBe('string');

    const listRes = await http()
      .get('/v1/portal/leads')
      .set('Authorization', bearer(broker1Token));
    expect(listRes.status).toBe(200);
    expect(collectIds(listRes.body)).toContain(newLeadId as string);
  });

  it("B10: broker2 does NOT see broker1's portal leads", async () => {
    const listRes = await http()
      .get('/v1/portal/leads')
      .set('Authorization', bearer(broker2Token));
    expect(listRes.status).toBe(200);
    const ids = collectIds(listRes.body);
    const broker1Firm = await testApp.rawPrisma.broker.findFirstOrThrow({
      where: { code: fixtures.brokerCodes.BROKER_1 },
      select: { id: true },
    });
    const broker1OwnedIds = (
      await testApp.rawPrisma.lead.findMany({
        where: { brokerId: broker1Firm.id },
        select: { id: true },
      })
    ).map((l) => l.id);
    expect(broker1OwnedIds.length).toBeGreaterThan(0);
    for (const id of broker1OwnedIds) expect(ids).not.toContain(id);
  });

  describe('B11: RBAC negatives on the lead surface', () => {
    it('GET /v1/leads without token → 401', async () => {
      expect((await http().get('/v1/leads')).status).toBe(401);
    });
    it('GET /v1/leads as CUSTOMER → 403', async () => {
      expect(
        (await http().get('/v1/leads').set('Authorization', bearer(customer1Token))).status,
      ).toBe(403);
    });
    it('GET /v1/leads as BROKER → 403 (broker uses /portal/leads, not /leads)', async () => {
      expect(
        (await http().get('/v1/leads').set('Authorization', bearer(broker1Token))).status,
      ).toBe(403);
    });
    it('GET /v1/portal/leads as SALES → 403', async () => {
      expect(
        (await http().get('/v1/portal/leads').set('Authorization', bearer(salesToken))).status,
      ).toBe(403);
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Flow C — Visit journey (e2e)
// ═════════════════════════════════════════════════════════════════════════════

// ═════════════════════════════════════════════════════════════════════════════
// FG-21 — a client created from a lead can log in by OTP
// ═════════════════════════════════════════════════════════════════════════════
//
// OTP login looks the user up by the E.164 form of the phone. Lead creation
// used to store the phone exactly as the sales rep typed it, so a client
// created as `01…` was invisible to OTP: logging in made a second, empty
// account and the first one kept the lead. This walks that exact path.
describe('B-FG21 — phone normalisation on the lead → client → OTP path (e2e)', () => {
  // Unique per run so a re-run against a dirty DB cannot collide.
  const suffix = String(Date.now()).slice(-7);
  const LOCAL = `0109${suffix}`;
  const E164 = `+20109${suffix}`;
  const OTP_CODE = '123456';
  let companyId: string;
  let slug: string;
  let clientId: string;

  beforeAll(async () => {
    const admin = await testApp.rawPrisma.user.findUniqueOrThrow({
      where: { id: fixtures.userIds.adminId },
      select: { company: { select: { id: true, slug: true } } },
    });
    companyId = admin.company!.id;
    slug = admin.company!.slug;
  });

  afterAll(async () => {
    const users = await testApp.rawPrisma.user.findMany({
      where: { phone: { in: [LOCAL, E164] } },
      select: { id: true },
    });
    const ids = users.map((u) => u.id);
    const leads = await testApp.rawPrisma.lead.findMany({ where: { clientId: { in: ids } }, select: { id: true } });
    const leadIds = leads.map((l) => l.id);
    await testApp.rawPrisma.leadActivity.deleteMany({ where: { leadId: { in: leadIds } } });
    await testApp.rawPrisma.leadNote.deleteMany({ where: { leadId: { in: leadIds } } });
    await testApp.rawPrisma.lead.deleteMany({ where: { id: { in: leadIds } } });
    await testApp.rawPrisma.refreshToken.deleteMany({ where: { userId: { in: ids } } });
    await testApp.rawPrisma.otpCode.deleteMany({ where: { phone: E164 } });
    await testApp.rawPrisma.user.deleteMany({ where: { id: { in: ids } } });
  });

  it('a lead created with a local phone stores its client in E.164', async () => {
    const res = await http()
      .post('/v1/leads')
      .set('Authorization', bearer(adminToken))
      .send({ fullName: 'FG21 Client', phone: LOCAL });
    expect(res.status).toBe(201);

    const stored = await testApp.rawPrisma.user.findMany({
      where: { phone: { in: [LOCAL, E164] } },
      select: { id: true, phone: true },
    });
    expect(stored).toEqual([{ id: res.body.clientId, phone: E164 }]);
    clientId = res.body.clientId;
  });

  it('the same number in the other format reuses that client', async () => {
    const res = await http()
      .post('/v1/leads')
      .set('Authorization', bearer(adminToken))
      .send({ fullName: 'FG21 Client', phone: E164 });
    expect(res.status).toBe(201);
    expect(res.body.clientId).toBe(clientId);
  });

  it('OTP login with the local form signs in as that client — no second account', async () => {
    const { createHash } = await import('crypto');
    await testApp.rawPrisma.otpCode.create({
      data: {
        phone: E164,
        codeHash: createHash('sha256').update(OTP_CODE).digest('hex'),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        companyId,
      },
    });
    await testApp.flushCapabilities(companyId);

    const res = await http()
      .post('/v1/auth/tenant/otp/verify')
      .send({ slug, phone: LOCAL, code: OTP_CODE });
    expect(res.status).toBe(201);
    expect(res.body.user.id).toBe(clientId);

    const accounts = await testApp.rawPrisma.user.count({ where: { phone: { in: [LOCAL, E164] } } });
    expect(accounts).toBe(1);
  });

  it('an unparseable phone is a 400, not a row that can never log in', async () => {
    const res = await http()
      .post('/v1/leads')
      .set('Authorization', bearer(adminToken))
      .send({ fullName: 'FG21 Garbage', phone: 'call me maybe' });
    expect(res.status).toBe(400);
  });

  it('editing a user who already holds an unparseable phone still works if it is resent unchanged', async () => {
    // Phones stored before this fix may not parse (the seeds hold some). Edit
    // forms resend every field, so an unchanged phone must not turn every edit
    // of that user into a 400. A changed one is still validated.
    const legacy = `+9665${suffix}`; // too short to be a valid SA mobile
    const user = await testApp.rawPrisma.user.create({
      data: { role: 'CLIENT', fullName: 'FG21 Legacy', phone: legacy, companyId },
      select: { id: true },
    });
    try {
      const same = await http()
        .patch(`/v1/users/${user.id}`)
        .set('Authorization', bearer(adminToken))
        .send({ fullName: 'FG21 Legacy Renamed', phone: legacy });
      expect(same.status).toBe(200);

      const changed = await http()
        .patch(`/v1/users/${user.id}`)
        .set('Authorization', bearer(adminToken))
        .send({ phone: 'not a phone' });
      expect(changed.status).toBe(400);

      const local = await http()
        .patch(`/v1/users/${user.id}`)
        .set('Authorization', bearer(adminToken))
        .send({ phone: `0108${suffix}` });
      expect(local.status).toBe(200);
      expect(local.body.phone).toBe(`+20108${suffix}`);
    } finally {
      await testApp.rawPrisma.user.delete({ where: { id: user.id } });
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// FG-24 — users the broker paths create belong to the broker's company
// ═════════════════════════════════════════════════════════════════════════════
//
// User is TENANT_CONTROLLED: nothing injects companyId. Three create paths
// never set it, so their users were invisible to tenant-scoped queries, could
// not use the tenant staff login, and escaped the company lifecycle check on
// token refresh.
describe('B-FG24 — broker-created users carry the broker company (e2e)', () => {
  const RUN = Date.now().toString(36);
  const PASSWORD = 'Fg24Pass!!123';
  let brokerId: string;
  let brokerCompanyId: string;
  let slug: string;
  const createdEmails: string[] = [];
  let otherCompanyId: string | undefined;

  beforeAll(async () => {
    const firm = await testApp.rawPrisma.broker.findFirstOrThrow({
      where: { code: fixtures.brokerCodes.BROKER_1 },
      select: { id: true, companyId: true, company: { select: { slug: true } } },
    });
    brokerId = firm.id;
    brokerCompanyId = firm.companyId!;
    slug = firm.company!.slug;
  });

  afterAll(async () => {
    const users = await testApp.rawPrisma.user.findMany({
      where: { email: { in: createdEmails } },
      select: { id: true },
    });
    const ids = users.map((u) => u.id);
    await testApp.rawPrisma.refreshToken.deleteMany({ where: { userId: { in: ids } } });
    await testApp.rawPrisma.brokerUser.deleteMany({ where: { userId: { in: ids } } });
    await testApp.rawPrisma.user.deleteMany({ where: { id: { in: ids } } });
    if (otherCompanyId) await testApp.rawPrisma.company.delete({ where: { id: otherCompanyId } });
  });

  it('a client created from a broker-portal lead belongs to the broker company', async () => {
    const res = await http()
      .post('/v1/portal/leads')
      .set('Authorization', bearer(broker1Token))
      .send({ fullName: 'FG24 Portal Client', phone: phoneFor(`F24${RUN}`), projectInterestId: fixtures.projects.p1Id });
    expect(res.status).toBe(201);
    const client = await testApp.rawPrisma.user.findUniqueOrThrow({
      where: { id: res.body.clientId },
      select: { companyId: true },
    });
    expect(client.companyId).toBe(brokerCompanyId);
  });

  it('a team member a broker adds belongs to the broker company — and can use the tenant staff login', async () => {
    const email = `fg24-team-${RUN}@example.com`;
    createdEmails.push(email);
    const res = await http()
      .post('/v1/portal/team')
      .set('Authorization', bearer(broker1Token))
      .send({ fullName: 'FG24 Team Member', email, password: PASSWORD });
    expect(res.status).toBe(201);

    const user = await testApp.rawPrisma.user.findFirstOrThrow({ where: { email }, select: { companyId: true } });
    expect(user.companyId).toBe(brokerCompanyId);

    // The visible consequence: the tenant staff login finds users by
    // (email, companyId), so a null-company broker user got "Invalid
    // credentials" with the right password.
    const login = await http().post('/v1/auth/login-staff').send({ slug, email, password: PASSWORD });
    expect([200, 201]).toContain(login.status);
  });

  it('a broker user an admin adds belongs to the broker company', async () => {
    const email = `fg24-admin-${RUN}@example.com`;
    createdEmails.push(email);
    const res = await http()
      .post(`/v1/brokers/${brokerId}/users`)
      .set('Authorization', bearer(adminToken))
      .send({ fullName: 'FG24 Admin-Added', email });
    expect(res.status).toBe(201);
    const user = await testApp.rawPrisma.user.findFirstOrThrow({ where: { email }, select: { companyId: true } });
    expect(user.companyId).toBe(brokerCompanyId);
  });

  it("the same email at another company becomes a separate account here — the foreign one is untouched", async () => {
    // Option B — email is unique per company. Before it, the existing-user
    // lookup was platform-wide and could hand this company another company's
    // account (FG-24 closed that with a 409). Now the lookup is company-scoped,
    // so the person simply gets a second account that belongs to this company.
    const other = await testApp.rawPrisma.company.create({
      data: { name: `FG24 Other ${RUN}`, slug: `fg24-other-${RUN}`, isActive: true },
      select: { id: true },
    });
    otherCompanyId = other.id;
    const email = `fg24-foreign-${RUN}@example.com`;
    createdEmails.push(email);
    const foreign = await testApp.rawPrisma.user.create({
      data: { role: 'BROKER', fullName: 'FG24 Foreign', email, companyId: other.id },
      select: { id: true },
    });

    const res = await http()
      .post(`/v1/brokers/${brokerId}/users`)
      .set('Authorization', bearer(adminToken))
      .send({ fullName: 'FG24 Foreign', email });
    expect(res.status).toBe(201);

    const accounts = await testApp.rawPrisma.user.findMany({
      where: { email },
      select: { id: true, companyId: true, brokerProfile: { select: { brokerId: true } } },
      orderBy: { createdAt: 'asc' },
    });
    expect(accounts).toHaveLength(2);
    const [theirs, ours] = accounts;
    expect(theirs).toEqual({ id: foreign.id, companyId: other.id, brokerProfile: null });
    expect(ours!.companyId).toBe(brokerCompanyId);
    expect(ours!.brokerProfile?.brokerId).toBe(brokerId);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Option B — one person, two developers
// ═════════════════════════════════════════════════════════════════════════════
//
// Email and phone are unique per company, not platform-wide. The same person
// buying from two developers holds two accounts — same email and phone, each
// with its own password — signs in to each through that developer's login, and
// sees only that developer's records. Before Option B the second registration
// failed on the global unique constraint, and lead paths that looked the phone
// up platform-wide attached the second developer's lead to the first
// developer's account. docs/audit/13-user-tenancy.md.
describe('B-OPTB — the same customer at two developers (e2e)', () => {
  const RUN = Date.now().toString(36);
  const suffix = String(Date.now()).slice(-7);
  const PHONE = `+20106${suffix}`;
  const EMAIL = `ahmed-${RUN}@example.com`;
  const PASS_A = 'AhmedAtA!!123';
  const PASS_B = 'AhmedAtB!!456';
  let slugA: string;
  let companyA: string;
  let companyB: string;
  const slugB = `optb-${RUN}`;
  let ahmedA: string;
  let ahmedB: string;

  beforeAll(async () => {
    const admin = await testApp.rawPrisma.user.findUniqueOrThrow({
      where: { id: fixtures.userIds.adminId },
      select: { company: { select: { id: true, slug: true } } },
    });
    companyA = admin.company!.id;
    slugA = admin.company!.slug;
    const b = await testApp.rawPrisma.company.create({
      data: { name: `Option B Developer ${RUN}`, slug: slugB, isActive: true, country: 'EG' },
      select: { id: true },
    });
    companyB = b.id;
  });

  afterAll(async () => {
    const users = await testApp.rawPrisma.user.findMany({
      where: { OR: [{ email: EMAIL }, { phone: PHONE }] },
      select: { id: true },
    });
    const ids = users.map((u) => u.id);
    const leads = await testApp.rawPrisma.lead.findMany({ where: { clientId: { in: ids } }, select: { id: true } });
    const leadIds = leads.map((l) => l.id);
    await testApp.rawPrisma.leadActivity.deleteMany({ where: { leadId: { in: leadIds } } });
    await testApp.rawPrisma.lead.deleteMany({ where: { id: { in: leadIds } } });
    await testApp.rawPrisma.refreshToken.deleteMany({ where: { userId: { in: ids } } });
    await testApp.rawPrisma.emailVerificationToken.deleteMany({ where: { userId: { in: ids } } });
    await testApp.rawPrisma.user.deleteMany({ where: { id: { in: ids } } });
    await testApp.rawPrisma.company.delete({ where: { id: companyB } });
  });

  const register = (slug: string, password: string) =>
    http()
      .post('/v1/auth/tenant/customer/register')
      .send({ slug, fullName: 'Ahmed Khaled', phone: PHONE, email: EMAIL, password, acceptTerms: true });
  const login = (slug: string, password: string) =>
    http().post('/v1/auth/tenant/customer/login').send({ slug, email: EMAIL, password });

  it('registers at developer A, then at developer B with the same email and phone', async () => {
    const a = await register(slugA, PASS_A);
    expect(a.status).toBe(201);
    const b = await register(slugB, PASS_B);
    expect(b.status).toBe(201);

    const accounts = await testApp.rawPrisma.user.findMany({
      where: { email: EMAIL },
      select: { id: true, companyId: true, phone: true },
    });
    expect(accounts).toHaveLength(2);
    expect(new Set(accounts.map((u) => u.companyId))).toEqual(new Set([companyA, companyB]));
    for (const u of accounts) expect(u.phone).toBe(PHONE);
    ahmedA = accounts.find((u) => u.companyId === companyA)!.id;
    ahmedB = accounts.find((u) => u.companyId === companyB)!.id;
  });

  it("each developer's login opens that developer's account, with that account's password", async () => {
    const inA = await login(slugA, PASS_A);
    expect([200, 201]).toContain(inA.status);
    expect(inA.body.user.id).toBe(ahmedA);

    const inB = await login(slugB, PASS_B);
    expect([200, 201]).toContain(inB.status);
    expect(inB.body.user.id).toBe(ahmedB);

    // The passwords are per account: A's password does not open B.
    const crossed = await login(slugB, PASS_A);
    expect(crossed.status).toBe(401);
  });

  it("a lead developer A's sales team adds for that phone lands on Ahmed's A account, never B's", async () => {
    const res = await http()
      .post('/v1/leads')
      .set('Authorization', bearer(adminToken))
      .send({ fullName: 'Ahmed Khaled', phone: PHONE });
    expect(res.status).toBe(201);
    expect(res.body.clientId).toBe(ahmedA);
  });

  it('registering twice at the same developer is still refused', async () => {
    const again = await register(slugA, 'Another!!789');
    expect(again.status).toBe(409);
  });
});

describe('Flow C — Visit journey (e2e)', () => {
  describe('C1–C3: customer creates VisitRequest, sees only own', () => {
    let customer1RequestId: string;

    it('C1: CUSTOMER_1 creates a visit request → 201, requestStatus=NEW', async () => {
      const res = await http()
        .post('/v1/me/visit-requests')
        .set('Authorization', bearer(customer1Token))
        .send({
          projectId: fixtures.projects.p1Id,
          preferredDate: futureDate(5),
          notes: 'phase 7b — customer1 visit request',
        });
      expect(res.status).toBe(201);
      const id: unknown = res.body?.id ?? res.body?.visitRequest?.id;
      expect(typeof id).toBe('string');
      customer1RequestId = id as string;

      const row = await testApp.rawPrisma.visitRequest.findUniqueOrThrow({
        where: { id: customer1RequestId },
        select: { requestStatus: true, userId: true, projectId: true },
      });
      expect(row.requestStatus).toBe('NEW');
      expect(row.userId).toBe(fixtures.userIds.customer1UserId);
      expect(row.projectId).toBe(fixtures.projects.p1Id);
    });

    it('C2: CUSTOMER_1 GET /v1/me/visit-requests includes their own request', async () => {
      const res = await http()
        .get('/v1/me/visit-requests')
        .set('Authorization', bearer(customer1Token));
      expect(res.status).toBe(200);
      expect(collectIds(res.body)).toContain(customer1RequestId);
    });

    it("C3: CUSTOMER_2 does NOT see CUSTOMER_1's visit request", async () => {
      const res = await http()
        .get('/v1/me/visit-requests')
        .set('Authorization', bearer(customer2Token));
      expect(res.status).toBe(200);
      expect(collectIds(res.body)).not.toContain(customer1RequestId);
    });

    it('C4: ADMIN sees the request on /v1/visits/requests', async () => {
      const res = await http()
        .get('/v1/visits/requests')
        .set('Authorization', bearer(adminToken));
      expect(res.status).toBe(200);
      expect(collectIds(res.body)).toContain(customer1RequestId);
    });
  });

  describe('C5–C7: sales walks an appointment through SCHEDULED → CONFIRMED → COMPLETED', () => {
    let apptId: string;

    it('C5: SALES POST /v1/visits/appointments creates a direct appointment (SCHEDULED)', async () => {
      const res = await http()
        .post('/v1/visits/appointments')
        .set('Authorization', bearer(salesToken))
        .send({
          projectId: fixtures.projects.p1Id,
          unitId: fixtures.units.sampleUnitInP1Id,
          assignedSalesId: fixtures.userIds.salesId,
          scheduledAt: futureDate(3),
          durationMinutes: 60,
          customerName: 'E2E C5 Walk-in',
          customerPhone: '+966500099500',
        });
      expect(res.status).toBe(201);
      const id: unknown = res.body?.id ?? res.body?.appointment?.id;
      expect(typeof id).toBe('string');
      apptId = id as string;

      const row = await testApp.rawPrisma.visitAppointment.findUniqueOrThrow({
        where: { id: apptId },
        select: { status: true, assignedSalesId: true },
      });
      expect(row.status).toBe('SCHEDULED');
      expect(row.assignedSalesId).toBe(fixtures.userIds.salesId);
    });

    it('C6: SALES confirms → CONFIRMED, VisitActivity(VISIT_CONFIRMED) logged', async () => {
      const res = await http()
        .post(`/v1/visits/appointments/${apptId}/confirm`)
        .set('Authorization', bearer(salesToken))
        .send({ salesNotes: 'phase 7b — confirmed by phone' });
      expect(res.status).toBe(201);

      const row = await testApp.rawPrisma.visitAppointment.findUniqueOrThrow({
        where: { id: apptId },
        select: { status: true, confirmedAt: true },
      });
      expect(row.status).toBe('CONFIRMED');
      expect(row.confirmedAt).not.toBeNull();

      const acts = await testApp.rawPrisma.visitActivity.findMany({
        where: { visitId: apptId, type: 'VISIT_CONFIRMED' },
        select: { id: true },
      });
      expect(acts.length).toBeGreaterThanOrEqual(1);
    });

    it('C7: SALES completes → COMPLETED, VisitActivity(VISIT_COMPLETED) logged', async () => {
      const res = await http()
        .post(`/v1/visits/appointments/${apptId}/complete`)
        .set('Authorization', bearer(salesToken))
        .send({
          salesNotes: 'phase 7b — walk-through done',
          resultNotes: 'interested in 2-bed; will reserve',
        });
      expect(res.status).toBe(201);

      const row = await testApp.rawPrisma.visitAppointment.findUniqueOrThrow({
        where: { id: apptId },
        select: { status: true, completedAt: true },
      });
      expect(row.status).toBe('COMPLETED');
      expect(row.completedAt).not.toBeNull();

      const acts = await testApp.rawPrisma.visitActivity.findMany({
        where: { visitId: apptId, type: 'VISIT_COMPLETED' },
        select: { id: true },
      });
      expect(acts.length).toBeGreaterThanOrEqual(1);
    });

    it('C9: terminal-status barrier — confirming a COMPLETED appointment fails (400/409/422)', async () => {
      const res = await http()
        .post(`/v1/visits/appointments/${apptId}/confirm`)
        .set('Authorization', bearer(salesToken))
        .send({});
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });
  });

  it('C8: SALES creates a second appointment and cancels it → CANCELLED', async () => {
    const createRes = await http()
      .post('/v1/visits/appointments')
      .set('Authorization', bearer(salesToken))
      .send({
        projectId: fixtures.projects.p1Id,
        assignedSalesId: fixtures.userIds.salesId,
        scheduledAt: futureDate(7),
        customerName: 'E2E C8 To-be-cancelled',
        customerPhone: '+966500099501',
      });
    expect(createRes.status).toBe(201);
    const apptId = createRes.body?.id ?? createRes.body?.appointment?.id;

    const cancelRes = await http()
      .post(`/v1/visits/appointments/${apptId}/cancel`)
      .set('Authorization', bearer(salesToken))
      .send({ cancellationReason: 'phase 7b — cancel-path test' });
    expect(cancelRes.status).toBe(201);

    const row = await testApp.rawPrisma.visitAppointment.findUniqueOrThrow({
      where: { id: apptId },
      select: { status: true, cancelledAt: true },
    });
    expect(row.status).toBe('CANCELLED');
    expect(row.cancelledAt).not.toBeNull();
  });

  describe('C10: RBAC negatives on the visit surface', () => {
    it('GET /v1/visits/appointments without token → 401', async () => {
      expect((await http().get('/v1/visits/appointments')).status).toBe(401);
    });
    it('POST /v1/visits/appointments as CUSTOMER → 403', async () => {
      const res = await http()
        .post('/v1/visits/appointments')
        .set('Authorization', bearer(customer1Token))
        .send({
          projectId: fixtures.projects.p1Id,
          assignedSalesId: fixtures.userIds.salesId,
          scheduledAt: futureDate(2),
          customerName: 'x',
          customerPhone: '+966500099502',
        });
      expect(res.status).toBe(403);
    });
    it('POST /v1/visits/appointments as BROKER → 403', async () => {
      const res = await http()
        .post('/v1/visits/appointments')
        .set('Authorization', bearer(broker1Token))
        .send({
          projectId: fixtures.projects.p1Id,
          scheduledAt: futureDate(2),
          customerName: 'x',
          customerPhone: '+966500099503',
        });
      expect(res.status).toBe(403);
    });
    it('GET /v1/me/visit-requests as SALES → 403 (customer surface)', async () => {
      expect(
        (await http().get('/v1/me/visit-requests').set('Authorization', bearer(salesToken))).status,
      ).toBe(403);
    });
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

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
      if (
        row &&
        typeof row === 'object' &&
        'id' in row &&
        typeof (row as { id?: unknown }).id === 'string'
      ) {
        return (row as { id: string }).id;
      }
      return undefined;
    })
    .filter((id): id is string => typeof id === 'string');
}
