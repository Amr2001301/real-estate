/**
 * P0 concurrency verification — unit reservation race condition.
 *
 * Proves that the `tx.unit.updateMany({ where: { id, status: AVAILABLE } })`
 * fix prevents two simultaneous POST /v1/reservations from both succeeding
 * against the same unit.
 *
 * This is a REAL PostgreSQL test — no mocked Prisma, no manually returned
 * `{ count: 1 }` / `{ count: 0 }`. Both requests race through the full
 * HTTP → NestJS → Prisma → real Postgres path against the same committed row.
 *
 * Concurrency strategy:
 *   For each iteration a fresh unit is created directly in the DB so
 *   iterations never share state and no prior reservation can mask the race.
 *   Both requests are fired with `Promise.allSettled` — Node starts both I/O
 *   chains before awaiting either. Postgres serializes competing UPDATEs via
 *   row-level locking: whichever transaction acquires the lock first commits
 *   the AVAILABLE → RESERVED transition; the second sees count=0 and rolls
 *   back without writing any Reservation row.
 *
 * Assertions per iteration (all five required by spec):
 *   1. Exactly one response is HTTP 201, exactly one is HTTP 409.
 *   2. unit.status === RESERVED in the DB.
 *   3. Exactly ONE Reservation row exists for the unit.
 *   4. That reservation has status PENDING.
 *   5. Exactly ONE UnitStatusHistory row exists (the loser's transaction
 *      was fully rolled back — no orphaned history entry).
 *
 * Runs 8 iterations to surface any timing-dependent behavior.
 */

import request from 'supertest';
import { ReservationStatus, UnitStatus } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

const ITERATIONS = 8;

describe('Unit reservation race condition — real Postgres concurrency proof (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let salesToken: string;
  let buildingId: string;
  let testCompanyId: string;

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);

    salesToken = await loginAs(testApp.app, 'sales@example.com', 'SalesPass123!');

    const company = await testApp.rawPrisma.company.findFirstOrThrow({ where: { isActive: true }, select: { id: true } });
    testCompanyId = company.id;

    // Hang fresh units off the first building of p1. p1 is guaranteed to
    // exist (seed-fixtures validates ≥3 projects) and the building is
    // irrelevant to the reservation race — we just need a valid FK.
    const building = await testApp.rawPrisma.building.findFirstOrThrow({
      where: { phase: { projectId: fixtures.projects.p1Id } },
      select: { id: true },
    });
    buildingId = building.id;
  }, 60_000);


  const http = () => request(testApp.app.getHttpServer());

  /** Create a brand-new AVAILABLE unit so each iteration starts clean. */
  async function createFreshUnit(iteration: number): Promise<string> {
    const unit = await testApp.rawPrisma.unit.create({
      data: {
        buildingId,
        companyId: testCompanyId,
        // Timestamp + index keeps the code unique even when iterations fire
        // within the same millisecond.
        code: `E2E-RACE-${Date.now()}-${iteration}`,
        type: '2BR',
        area: 120,
        price: 1_000_000,
        status: UnitStatus.AVAILABLE,
      },
      select: { id: true },
    });
    return unit.id;
  }

  for (let i = 0; i < ITERATIONS; i++) {
    // Each test function captures its own `i` via the closure.
    const iteration = i + 1;

    it(`[${iteration}/${ITERATIONS}] concurrent claims: one 201 + one 409, one reservation row`, async () => {
      const unitId = await createFreshUnit(i);

      const body = {
        unitId,
        // clientId path (CUSTOMER role) — avoids lead validation logic so
        // the test focuses purely on the unit-claim concurrency behavior.
        clientId: fixtures.userIds.customer1UserId,
        expiresInHours: 72,
      };

      // ── Fire both requests concurrently ────────────────────────────────
      // Promise.allSettled starts both I/O chains immediately. Node will
      // interleave the async operations as the event loop schedules them.
      // HTTP errors surface as fulfilled (not rejected) so we always unpack.
      const [r1, r2] = await Promise.allSettled([
        http().post('/v1/reservations').set('Authorization', bearer(salesToken)).send(body),
        http().post('/v1/reservations').set('Authorization', bearer(salesToken)).send(body),
      ]);

      const s1 = r1.status === 'fulfilled' ? r1.value.status : 500;
      const s2 = r2.status === 'fulfilled' ? r2.value.status : 500;
      const sortedStatuses = [s1, s2].sort();

      // ── Assertion 1 ─────────────────────────────────────────────────────
      // Exactly one winner (201) and one loser (409). Any other outcome
      // (two 201s, two 409s, 500s) is a test failure.
      expect(sortedStatuses).toEqual([201, 409]);

      // ── DB assertions ────────────────────────────────────────────────────
      const [unit, reservations, statusHistory] = await Promise.all([
        testApp.rawPrisma.unit.findUniqueOrThrow({
          where: { id: unitId },
          select: { status: true },
        }),
        testApp.rawPrisma.reservation.findMany({
          where: { unitId },
          select: { id: true, status: true },
        }),
        testApp.rawPrisma.unitStatusHistory.findMany({
          where: { unitId },
          select: { id: true, oldStatus: true, newStatus: true },
        }),
      ]);

      // ── Assertion 2: unit is RESERVED ────────────────────────────────────
      expect(unit.status).toBe(UnitStatus.RESERVED);

      // ── Assertion 3: exactly one reservation row ─────────────────────────
      expect(reservations).toHaveLength(1);

      // ── Assertion 4: it is PENDING (the winning reservation) ─────────────
      expect(reservations[0]!.status).toBe(ReservationStatus.PENDING);

      // ── Assertion 5: exactly one status-history entry ───────────────────
      // The loser's entire $transaction was rolled back — no orphaned history.
      expect(statusHistory).toHaveLength(1);
      expect(statusHistory[0]!.oldStatus).toBe(UnitStatus.AVAILABLE);
      expect(statusHistory[0]!.newStatus).toBe(UnitStatus.RESERVED);
    }, 30_000);
  }
});
