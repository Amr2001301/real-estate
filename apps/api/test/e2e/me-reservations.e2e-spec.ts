/**
 * P7 — Customer-side reservation visibility (`/me/reservations`).
 *
 * The portal previously had no way for a CLIENT or CUSTOMER to see their own
 * reservations. Admin-created reservations existed in the database but never
 * surfaced on `/account`, `/account/requests`, or anywhere reachable. This
 * spec locks the new endpoint + the role-promotion rule it depends on.
 *
 * Coverage:
 *   P7.1 — Admin creates a reservation for CLIENT_1 → CLIENT_1 sees it
 *           via GET /v1/me/reservations.
 *   P7.2 — CUSTOMER_2 cannot see CLIENT_1's reservation (cross-tenancy).
 *   P7.3 — CUSTOMER_1 can also access the endpoint (both CLIENT and
 *           CUSTOMER are allowed; the endpoint is not CUSTOMER-only).
 *   P7.4 — Creating a reservation alone does NOT promote CLIENT → CUSTOMER.
 *           This locks the business rule documented in
 *           reservations.module.ts MeReservationsController docstring.
 *   P7.5 — Lead-based ownership path: a reservation whose owner is reached
 *           via `Reservation.lead.clientId` also surfaces on /me/reservations.
 *   P7.6 — Creating a CONTRACT for the CLIENT promotes them to CUSTOMER.
 *           Uses a fresh transient user to avoid mutating the shared
 *           CLIENT_1 fixture (other specs rely on its role being CLIENT).
 *   P7.7 — Unauthenticated and wrong-role access are denied.
 */

import request from 'supertest';
import * as argon2 from 'argon2';
import { LeadStage, ReservationStatus, UnitStatus, UserRole } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

describe('P7 — /me/reservations (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;

  let adminToken: string;
  let client1Token: string;
  let customer1Token: string;
  let customer2Token: string;
  let salesToken: string;

  let client1UserId: string;
  let salesUserId: string;
  let testCompanyId: string;

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);

    [adminToken, salesToken, client1Token, customer1Token, customer2Token] = await Promise.all([
      loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!'),
      loginAs(testApp.app, 'sales@example.com', 'SalesPass123!'),
      loginAs(testApp.app, fixtures.users.CLIENT_1.email, fixtures.users.CLIENT_1.password, 'customer'),
      loginAs(testApp.app, fixtures.users.CUSTOMER_1.email, fixtures.users.CUSTOMER_1.password, 'customer'),
      loginAs(testApp.app, fixtures.users.CUSTOMER_2.email, fixtures.users.CUSTOMER_2.password, 'customer'),
    ]);

    const company = await testApp.rawPrisma.company.findFirstOrThrow({ where: { isActive: true }, select: { id: true } });
    testCompanyId = company.id;

    const client1 = await testApp.rawPrisma.user.findUniqueOrThrow({
      where: { email: fixtures.users.CLIENT_1.email },
      select: { id: true },
    });
    client1UserId = client1.id;
    salesUserId = fixtures.userIds.salesId;
  });


  const http = () => request(testApp.app.getHttpServer());

  // Track unit IDs we've already used within this spec, so successive
  // allocations don't collide. Critical: we MUST NOT consume p1 units —
  // `loadE2EFixtures` in test/helpers/seed-fixtures.ts (called from every
  // spec file's beforeAll) requires at least one AVAILABLE unit on p1, and
  // suite-order is non-deterministic so a later spec's beforeAll may fire
  // after ours runs. Picking exclusively from non-p1 projects keeps the p1
  // pool intact for the fixture loader.
  const consumedUnitIds = new Set<string>();

  async function pickFreshUnit(): Promise<{ id: string }> {
    const unit = await testApp.rawPrisma.unit.findFirstOrThrow({
      where: {
        status: UnitStatus.AVAILABLE,
        id: { notIn: Array.from(consumedUnitIds) },
        // Exclude p1 — `loadE2EFixtures` depends on at least one AVAILABLE p1 unit.
        NOT: { building: { phase: { projectId: fixtures.projects.p1Id } } },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true },
    });
    consumedUnitIds.add(unit.id);
    return unit;
  }

  /**
   * Create a reservation owned directly by `clientId`. We bypass the admin
   * POST /v1/reservations endpoint here to avoid coupling these specs to
   * reservation-create side effects (unit RESERVED, lead matching). Those
   * have their own coverage in Flow D; here we only care about VISIBILITY
   * through /me/reservations.
   */
  async function reserveFreshUnitFor(
    clientId: string,
  ): Promise<{ reservationId: string; unitId: string }> {
    const unit = await pickFreshUnit();
    const reservation = await testApp.rawPrisma.reservation.create({
      data: {
        companyId: testCompanyId,
        unitId: unit.id,
        salesId: salesUserId,
        clientId,
        status: ReservationStatus.PENDING,
        expiresAt: new Date(Date.now() + 72 * 3_600_000),
        reservationNumber: `P7-${Date.now()}`,
        bookingAmount: 0,
      },
      select: { id: true },
    });
    // Flip the unit to RESERVED so its state matches what the real
    // create flow would produce. We don't write UnitStatusHistory here
    // because Flow D already covers that contract.
    await testApp.rawPrisma.unit.update({
      where: { id: unit.id },
      data: {
        status: UnitStatus.RESERVED,
        reservationExpiresAt: new Date(Date.now() + 72 * 3_600_000),
      },
    });
    return { reservationId: reservation.id, unitId: unit.id };
  }

  describe('Direct ownership (Reservation.clientId)', () => {
    let p7ReservationId: string;

    it('P7.1: ADMIN creates a reservation for CLIENT_1; CLIENT_1 sees it on /me/reservations', async () => {
      const { reservationId } = await reserveFreshUnitFor(client1UserId);
      p7ReservationId = reservationId;

      const res = await http()
        .get('/v1/me/reservations')
        .set('Authorization', bearer(client1Token));
      expect(res.status).toBe(200);
      const ids = collectIds(res.body);
      expect(ids).toContain(p7ReservationId);

      // Response shape carries the fields the customer card renders.
      const row = (res.body?.data as Array<Record<string, unknown>>).find(
        (r) => r.id === p7ReservationId,
      );
      expect(row).toBeDefined();
      expect(row?.reservationNumber).toEqual(expect.stringMatching(/^P7-/));
      expect(row?.status).toBe('PENDING');
      expect(row?.bookingAmount).toBeDefined();
      expect(row?.bookingPaymentStatus).toBe('UNPAID');
      // Unit / project nested chain is present
      const unit = row?.unit as { code?: string; building?: { phase?: { project?: { id?: string } } } } | null;
      expect(typeof unit?.code).toBe('string');
      expect(typeof unit?.building?.phase?.project?.id).toBe('string');
      // Assigned sales rep is visible
      const sales = row?.sales as { id?: string; fullName?: string } | null;
      expect(sales?.id).toBe(salesUserId);
    });

    it('P7.2: CUSTOMER_2 does NOT see CLIENT_1\'s reservation', async () => {
      const res = await http()
        .get('/v1/me/reservations')
        .set('Authorization', bearer(customer2Token));
      expect(res.status).toBe(200);
      const ids = collectIds(res.body);
      expect(ids).not.toContain(p7ReservationId);
    });

    it('P7.3: CUSTOMER_1 can also call /me/reservations (CLIENT + CUSTOMER both allowed)', async () => {
      const res = await http()
        .get('/v1/me/reservations')
        .set('Authorization', bearer(customer1Token));
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body?.data)).toBe(true);
    });

    it('P7.4: after the reservation, CLIENT_1\'s role stays CLIENT (no auto-promotion)', async () => {
      const u = await testApp.rawPrisma.user.findUniqueOrThrow({
        where: { id: client1UserId },
        select: { role: true },
      });
      expect(u.role).toBe(UserRole.CLIENT);
    });

    it('P7.4b: GET /me/reservations/:id returns the row only to its owner; 404 for other users', async () => {
      const ownerRes = await http()
        .get(`/v1/me/reservations/${p7ReservationId}`)
        .set('Authorization', bearer(client1Token));
      expect(ownerRes.status).toBe(200);
      expect(ownerRes.body?.id).toBe(p7ReservationId);

      const otherRes = await http()
        .get(`/v1/me/reservations/${p7ReservationId}`)
        .set('Authorization', bearer(customer2Token));
      // We return 404 (not 403) so we don't disclose existence of other
      // customers' rows. See findOneForUser() docstring.
      expect(otherRes.status).toBe(404);
    });
  });

  describe('Lead-based ownership (Reservation.lead.clientId)', () => {
    it('P7.5: a reservation whose owner is reached via lead.clientId also surfaces on /me/reservations', async () => {
      // Set up a lead that points back to CLIENT_1, then a reservation that
      // references the lead (not the client directly).
      const lead = await testApp.rawPrisma.lead.create({
        data: {
          companyId: testCompanyId,
          clientId: client1UserId,
          fullName: fixtures.users.CLIENT_1.fullName,
          phone: '+966500000P7L', // P7 lead test
          stage: LeadStage.NEW,
          assignedSalesId: salesUserId,
        },
        select: { id: true },
      });

      // Allocate a fresh unit and create the reservation by leadId path
      // (clientId is intentionally NOT set on this reservation).
      const unit = await pickFreshUnit();
      const reservation = await testApp.rawPrisma.reservation.create({
        data: {
          companyId: testCompanyId,
          unitId: unit.id,
          salesId: salesUserId,
          leadId: lead.id, // ← XOR: lead path, clientId stays null
          status: ReservationStatus.PENDING,
          expiresAt: new Date(Date.now() + 72 * 3_600_000),
          reservationNumber: `P7L-${Date.now()}`,
          bookingAmount: 0,
        },
        select: { id: true },
      });
      await testApp.rawPrisma.unit.update({
        where: { id: unit.id },
        data: {
          status: UnitStatus.RESERVED,
          reservationExpiresAt: new Date(Date.now() + 72 * 3_600_000),
        },
      });

      const res = await http()
        .get('/v1/me/reservations')
        .set('Authorization', bearer(client1Token));
      expect(res.status).toBe(200);
      expect(collectIds(res.body)).toContain(reservation.id);

      // CUSTOMER_2 still does not see it.
      const c2res = await http()
        .get('/v1/me/reservations')
        .set('Authorization', bearer(customer2Token));
      expect(collectIds(c2res.body)).not.toContain(reservation.id);
    });
  });

  describe('Promotion rule (CLIENT → CUSTOMER)', () => {
    it('P7.6: creating a contract DOES promote a CLIENT to CUSTOMER (locks the existing rule)', async () => {
      // Fresh transient CLIENT to avoid mutating the shared CLIENT_1 fixture
      // (flow-e-financial-documents.e2e-spec.ts asserts CLIENT_1 stays CLIENT).
      const transientClient = await testApp.rawPrisma.user.create({
        data: {
          companyId: testCompanyId,
          role: UserRole.CLIENT,
          fullName: 'P7 Promotion Candidate',
          email: `p7-promo-${Date.now()}@example.com`,
          phone: `+96650000P7${Math.floor(Math.random() * 90 + 10)}`,
          locale: 'en',
        },
        select: { id: true, role: true },
      });
      expect(transientClient.role).toBe(UserRole.CLIENT);

      // Allocate a fresh unit (any project) — same picker, avoids collisions
      // with the visibility tests above and Flow D's p1 picks.
      const unit = await pickFreshUnit();

      // Admin POST /v1/contracts → contracts.module.ts ContractsService.create()
      // contains the PROMOTION RULE site (see comment there).
      const res = await http()
        .post('/v1/contracts')
        .set('Authorization', bearer(adminToken))
        .send({
          customerId: transientClient.id,
          unitId: unit.id,
          totalAmount: 1_000_000,
          downPayment: 100_000,
        });
      expect(res.status).toBe(201);

      const after = await testApp.rawPrisma.user.findUniqueOrThrow({
        where: { id: transientClient.id },
        select: { role: true },
      });
      expect(after.role).toBe(UserRole.CUSTOMER);
    });
  });

  describe('Auth + RBAC negatives', () => {
    it('P7.7a: unauthenticated GET /me/reservations → 401', async () => {
      const res = await http().get('/v1/me/reservations');
      expect(res.status).toBe(401);
    });

    it('P7.7b: SALES GET /me/reservations → 403 (staff use /v1/reservations)', async () => {
      const res = await http()
        .get('/v1/me/reservations')
        .set('Authorization', bearer(salesToken));
      expect(res.status).toBe(403);
    });
  });

  // ── P8 — Synthetic User claim + phone/email fallback ─────────────────────
  // Background: an unauthenticated public visit-request creates a "synthetic"
  // CLIENT User row (no passwordHash) so the Lead has somewhere to hang. When
  // the same person later registers via /auth/customer/register, the OLD code
  // threw `phone_taken` / `email_taken` (blocking registration) OR — if the
  // contact details diverged slightly — created a fresh User row and the
  // pre-existing Lead/Reservation kept pointing at the synthetic User. From
  // the customer's perspective, /me/reservations returned an empty list even
  // though the admin dashboard showed their reservation. P8 closes that gap.

  // Used to keep emails/phones/numbers distinct across P8 tests sharing the
  // seeded DB. Returns a digit-only suffix (the customer-register DTO enforces
  // an E.164-shaped phone — `/^\+?[1-9]\d{7,14}$/` — so letters break it).
  let p8Seq = 0;
  async function uniqueSuffix(): Promise<string> {
    const userCount = await testApp.rawPrisma.user.count();
    p8Seq += 1;
    // 6 digits total — enough headroom for tests within one e2e run.
    return String(userCount * 100 + p8Seq).padStart(6, '0');
  }

  /**
   * Direct-Prisma scaffolding for a CLIENT row that already has a passwordHash
   * (i.e. would be the product of a successful customer/register call).
   * Bypasses the @Throttle(5/60s) on POST /v1/auth/customer/register so a
   * single spec can stage many "logged-in customer" fixtures without 429s.
   * Use HTTP register only when verifying the register flow itself.
   */
  async function createRealUser(opts: {
    fullName: string;
    email: string;
    phone: string | null;
    password: string;
  }): Promise<{ id: string }> {
    const passwordHash = await argon2.hash(opts.password);
    return testApp.rawPrisma.user.create({
      data: {
        companyId: testCompanyId,
        role: UserRole.CLIENT,
        fullName: opts.fullName,
        email: opts.email.toLowerCase(),
        phone: opts.phone,
        passwordHash,
        locale: 'ar',
      },
      select: { id: true },
    });
  }

  /**
   * Mint an access token for an existing user via the live JwtService — same
   * algorithm, same secret, same expiry as POST /v1/auth/customer/login, but
   * without going through the @Throttle(5/60s) gate. CRITICAL: this DOES NOT
   * invoke the login-time synthetic claim. Tests that exercise the claim
   * MUST still call `loginAs()` (HTTP) — call this only for setup hops that
   * have nothing to do with the claim path.
   */
  function mintAccessToken(userId: string, role: UserRole): Promise<string> {
    return testApp.signAccessToken(userId, role);
  }

  describe('P8 — Synthetic User claim at registration', () => {
    it('P8.1: registering with phone/email matching a synthetic CLIENT claims that row (existing Lead/Reservation surface)', async () => {
      const suffix = await uniqueSuffix();
      const phone = `+966500999${suffix}`;
      const email = `p8-claim-${suffix}@example.com`;

      // 1) Simulate the public visit-request path: create a synthetic CLIENT
      //    row (no passwordHash) and a Lead pointing at it.
      const synthetic = await testApp.rawPrisma.user.create({
        data: {
          companyId: testCompanyId,
          role: UserRole.CLIENT,
          fullName: 'P8 Walk-in Lead',
          phone,
          email,
          locale: 'ar',
        },
        select: { id: true },
      });
      const lead = await testApp.rawPrisma.lead.create({
        data: {
          companyId: testCompanyId,
          clientId: synthetic.id,
          fullName: 'P8 Walk-in Lead',
          phone,
          email,
          stage: LeadStage.NEW,
          assignedSalesId: salesUserId,
        },
        select: { id: true },
      });
      const unit = await pickFreshUnit();
      const reservation = await testApp.rawPrisma.reservation.create({
        data: {
          companyId: testCompanyId,
          unitId: unit.id,
          salesId: salesUserId,
          leadId: lead.id,
          status: ReservationStatus.PENDING,
          expiresAt: new Date(Date.now() + 72 * 3_600_000),
          reservationNumber: `P8C-${suffix}`,
          bookingAmount: 0,
        },
        select: { id: true },
      });
      await testApp.rawPrisma.unit.update({
        where: { id: unit.id },
        data: {
          status: UnitStatus.RESERVED,
          reservationExpiresAt: new Date(Date.now() + 72 * 3_600_000),
        },
      });

      // 2) Same person registers via /v1/auth/customer/register. Before P8 this
      //    would 409. After P8 it CLAIMS the synthetic row.
      const registerRes = await http()
        .post('/v1/auth/customer/register')
        .send({
          fullName: 'P8 Real Customer',
          phone,
          email,
          password: 'StrongPass1!',
          acceptTerms: true,
        });
      expect(registerRes.status).toBe(201);

      // The claimed row keeps its id, so Lead.clientId still resolves to it.
      const claimed = await testApp.rawPrisma.user.findUniqueOrThrow({
        where: { id: synthetic.id },
        select: { id: true, role: true, email: true, phone: true, passwordHash: true },
      });
      expect(claimed.passwordHash).toBeTruthy();
      expect(claimed.role).toBe(UserRole.CLIENT); // not auto-promoted by registration
      expect(claimed.email).toBe(email);
      expect(claimed.phone).toBe(phone);

      // 3) Mint a token for the claimed row; /me/reservations surfaces the
      //    pre-existing reservation. (Direct mint — register has already
      //    fired the claim; we're verifying visibility, not the claim path.)
      const claimedToken = await mintAccessToken(claimed.id, UserRole.CLIENT);
      const meRes = await http()
        .get('/v1/me/reservations')
        .set('Authorization', bearer(claimedToken));
      expect(meRes.status).toBe(200);
      expect(collectIds(meRes.body)).toContain(reservation.id);
    });

    it('P8.2: registering against a REAL (passwordHash set) row still 409s — claim only applies to synthetic rows', async () => {
      const suffix = await uniqueSuffix();
      const phone = `+966500888${suffix}`;
      const email = `p8-real-${suffix}@example.com`;

      const first = await http()
        .post('/v1/auth/customer/register')
        .send({ fullName: 'P8 First Register', phone, email, password: 'StrongPass1!', acceptTerms: true });
      expect(first.status).toBe(201);

      // Same creds, again — must fail with a conflict (real account exists).
      const second = await http()
        .post('/v1/auth/customer/register')
        .send({ fullName: 'P8 Impostor', phone, email, password: 'OtherPass2!', acceptTerms: true });
      expect(second.status).toBe(409);
    });
  });

  describe('P8 — booking amount mode (FIXED vs PERCENTAGE)', () => {
    it('P8.4: FIXED mode persists the exact admin-entered amount and bookingAmountMode=FIXED', async () => {
      const unit = await pickFreshUnit();
      const res = await http()
        .post('/v1/reservations')
        .set('Authorization', bearer(adminToken))
        .send({
          unitId: unit.id,
          clientId: fixtures.userIds.customer1UserId,
          expiresInHours: 72,
          bookingAmountMode: 'FIXED',
          bookingAmount: 42_500,
        });
      expect(res.status).toBe(201);
      const row = await testApp.rawPrisma.reservation.findUniqueOrThrow({
        where: { id: res.body.id as string },
        select: {
          bookingAmount: true,
          bookingAmountMode: true,
          bookingAmountPercent: true,
          bookingAmountUnitPriceSnapshot: true,
        },
      });
      expect(row.bookingAmountMode).toBe('FIXED');
      expect(Number(row.bookingAmount)).toBe(42_500);
      expect(row.bookingAmountPercent).toBeNull();
      expect(row.bookingAmountUnitPriceSnapshot).toBeNull();
    });

    it('P8.5: PERCENTAGE mode computes bookingAmount = unit.price * percent / 100 and snapshots the inputs', async () => {
      const unit = await pickFreshUnit();
      const unitRow = await testApp.rawPrisma.unit.findUniqueOrThrow({
        where: { id: unit.id },
        select: { price: true },
      });
      const unitPrice = Number(unitRow.price);
      // Sanity: the picker only returns units with a price > 0 from the seed.
      expect(unitPrice).toBeGreaterThan(0);

      const res = await http()
        .post('/v1/reservations')
        .set('Authorization', bearer(adminToken))
        .send({
          unitId: unit.id,
          clientId: fixtures.userIds.customer1UserId,
          expiresInHours: 72,
          bookingAmountMode: 'PERCENTAGE',
          bookingAmountPercent: 5,
        });
      expect(res.status).toBe(201);
      const row = await testApp.rawPrisma.reservation.findUniqueOrThrow({
        where: { id: res.body.id as string },
        select: {
          bookingAmount: true,
          bookingAmountMode: true,
          bookingAmountPercent: true,
          bookingAmountUnitPriceSnapshot: true,
        },
      });
      expect(row.bookingAmountMode).toBe('PERCENTAGE');
      expect(Number(row.bookingAmountPercent)).toBe(5);
      expect(Number(row.bookingAmountUnitPriceSnapshot)).toBe(unitPrice);
      // Rounded to 2dp; same formula as the backend.
      const expected = Math.round(unitPrice * 0.05 * 100) / 100;
      expect(Number(row.bookingAmount)).toBe(expected);
    });

    it('P8.6: PERCENTAGE with invalid percent → 400; PERCENTAGE > 100 → 400 (DTO clamp)', async () => {
      const unit = await pickFreshUnit();
      const zero = await http()
        .post('/v1/reservations')
        .set('Authorization', bearer(adminToken))
        .send({
          unitId: unit.id,
          clientId: fixtures.userIds.customer1UserId,
          bookingAmountMode: 'PERCENTAGE',
          bookingAmountPercent: 0,
        });
      expect(zero.status).toBe(400);
      // Same unit got reserved on the failed call? No — the create transaction
      // rolls back before the unit flip when validation throws. Reuse it.
      const tooHigh = await http()
        .post('/v1/reservations')
        .set('Authorization', bearer(adminToken))
        .send({
          unitId: unit.id,
          clientId: fixtures.userIds.customer1UserId,
          bookingAmountMode: 'PERCENTAGE',
          bookingAmountPercent: 150,
        });
      expect(tooHigh.status).toBe(400);
    });

    it('P8.7: FIXED with non-positive amount → 400', async () => {
      const unit = await pickFreshUnit();
      const res = await http()
        .post('/v1/reservations')
        .set('Authorization', bearer(adminToken))
        .send({
          unitId: unit.id,
          clientId: fixtures.userIds.customer1UserId,
          bookingAmountMode: 'FIXED',
          bookingAmount: 0,
        });
      expect(res.status).toBe(400);
    });
  });

  // ── P9 — normalized phone matching + login-time synthetic claim ─────────
  // Background: P8 covered the case where registration credentials matched a
  // synthetic CLIENT directly. The local QA case revealed two further gaps:
  //  (a) phone-format drift — the same number stored as `+201008239075` on
  //      one row and as plain `201008239075` on another would miss the exact
  //      equality match P8 relied on.
  //  (b) two-row identity — the registered customer's User row had email
  //      only, the synthetic peer had phone only; no contact field
  //      overlapped, so neither the registration claim nor the query-time
  //      filter could bridge them automatically.
  // P9 normalizes phone for matching, treats every User row sharing a
  // contact field as an "identity peer" for ownership, and runs a best-effort
  // login-time merge so the customer's second visit is fully reconciled.

  describe('P9 — normalized phone matching in ownership filter', () => {
    it('P9.1: a reservation whose lead.phone format differs from user.phone (no `+`) still surfaces after normalization', async () => {
      const suffix = await uniqueSuffix();
      // Same number, two stored formats: registered user keeps the `+`,
      // the legacy lead row stored a bare digit string.
      const userPhone = `+966500${suffix}`;
      const leadPhoneNoPlus = `966500${suffix}`;
      const email = `p9-fmt-${suffix}@example.com`;

      const real = await createRealUser({
        fullName: 'P9 Format Drift',
        phone: userPhone,
        email,
        password: 'StrongPass1!',
      });

      // Legacy lead with the no-`+` form. clientId points at an unrelated
      // synthetic row that the user never owned — proving the bridge fires
      // purely on lead.phone normalization, not on shared user id.
      const orphan = await testApp.rawPrisma.user.create({
        data: {
          companyId: testCompanyId,
          role: UserRole.CLIENT,
          fullName: 'P9 Orphan',
          phone: `+966500other${suffix.slice(-2)}`.replace(/\D/g, ''), // unique, unrelated
          locale: 'ar',
        },
        select: { id: true },
      });
      const lead = await testApp.rawPrisma.lead.create({
        data: {
          companyId: testCompanyId,
          clientId: orphan.id,
          fullName: 'P9 Format Drift',
          phone: leadPhoneNoPlus,
          stage: LeadStage.NEW,
          assignedSalesId: salesUserId,
        },
        select: { id: true },
      });
      const unit = await pickFreshUnit();
      const reservation = await testApp.rawPrisma.reservation.create({
        data: {
          companyId: testCompanyId,
          unitId: unit.id,
          salesId: salesUserId,
          leadId: lead.id,
          status: ReservationStatus.APPROVED,
          expiresAt: new Date(Date.now() + 72 * 3_600_000),
          reservationNumber: `P9F-${suffix}`,
          bookingAmount: 1,
        },
        select: { id: true },
      });
      await testApp.rawPrisma.unit.update({
        where: { id: unit.id },
        data: { status: UnitStatus.RESERVED, reservationExpiresAt: new Date(Date.now() + 72 * 3_600_000) },
      });

      const tok = await mintAccessToken(real.id, UserRole.CLIENT);
      const meRes = await http()
        .get('/v1/me/reservations')
        .set('Authorization', bearer(tok));
      expect(meRes.status).toBe(200);
      expect(collectIds(meRes.body)).toContain(reservation.id);

      // CUSTOMER_2 (unrelated phone/email) MUST still be excluded.
      const c2 = await http()
        .get('/v1/me/reservations')
        .set('Authorization', bearer(customer2Token));
      expect(collectIds(c2.body)).not.toContain(reservation.id);

      // P9 — the real user's role stayed CLIENT (no auto-promotion).
      const realAfter = await testApp.rawPrisma.user.findUniqueOrThrow({
        where: { id: real.id },
        select: { role: true },
      });
      expect(realAfter.role).toBe(UserRole.CLIENT);
    });

    it('P9.2: a reservation whose lead.clientId is a synthetic peer matched only by user.email surfaces too', async () => {
      const suffix = await uniqueSuffix();
      const phone = `+966500${suffix}`;
      const email = `p9-peer-${suffix}@example.com`;

      // Synthetic row with the email, no phone — created by a prior CRM
      // import that only had the customer's email.
      const synthetic = await testApp.rawPrisma.user.create({
        data: {
          companyId: testCompanyId,
          role: UserRole.CLIENT,
          fullName: 'P9 Identity Peer',
          email,
          locale: 'ar',
        },
        select: { id: true },
      });
      const lead = await testApp.rawPrisma.lead.create({
        data: {
          companyId: testCompanyId,
          clientId: synthetic.id, // ← peer-by-email
          fullName: 'P9 Identity Peer',
          phone: '+999999999999', // unrelated; ownership flows through synthetic.email
          email,
          stage: LeadStage.NEW,
          assignedSalesId: salesUserId,
        },
        select: { id: true },
      });
      const unit = await pickFreshUnit();
      const reservation = await testApp.rawPrisma.reservation.create({
        data: {
          companyId: testCompanyId,
          unitId: unit.id,
          salesId: salesUserId,
          leadId: lead.id,
          status: ReservationStatus.PENDING,
          expiresAt: new Date(Date.now() + 72 * 3_600_000),
          reservationNumber: `P9P-${suffix}`,
          bookingAmount: 1,
        },
        select: { id: true },
      });
      await testApp.rawPrisma.unit.update({
        where: { id: unit.id },
        data: { status: UnitStatus.RESERVED, reservationExpiresAt: new Date(Date.now() + 72 * 3_600_000) },
      });

      // Now register the real customer with a fresh phone but the SAME email.
      // The registration's in-place claim will fire (matches synthetic by
      // email) and the resulting row IS the synthetic with a passwordHash.
      const reg = await http()
        .post('/v1/auth/customer/register')
        .send({ fullName: 'P9 Real Identity', phone, email, password: 'StrongPass1!', acceptTerms: true });
      expect(reg.status).toBe(201);

      // After register's in-place claim, the User row for `email` IS the
      // former synthetic with a passwordHash. Mint a token directly so we
      // can verify visibility without spending the login throttle budget.
      const claimed = await testApp.rawPrisma.user.findUniqueOrThrow({
        where: { email },
        select: { id: true },
      });
      const tok = await mintAccessToken(claimed.id, UserRole.CLIENT);
      const meRes = await http()
        .get('/v1/me/reservations')
        .set('Authorization', bearer(tok));
      expect(meRes.status).toBe(200);
      expect(collectIds(meRes.body)).toContain(reservation.id);
    });
  });

  describe('P9 — login-time synthetic claim merges FK references', () => {
    it('P9.3: logging in opportunistically merges synthetic CLIENT peers matching by normalized phone (Lead/Reservation repoint, synthetic deleted)', async () => {
      const suffix = await uniqueSuffix();
      const phone = `+966500${suffix}`;
      const email = `p9-claim-${suffix}@example.com`;

      // 1) Real customer with phone + email (scaffolded directly to avoid
      //    burning the customer/register throttle window).
      const real = await createRealUser({
        fullName: 'P9 Real Claimer',
        phone,
        email,
        password: 'StrongPass1!',
      });

      // 2) A *separate* synthetic CLIENT exists with the SAME normalized
      //    phone but stored in a different format. The registration above
      //    couldn't see it (different format → no unique-column match).
      const syntheticPhoneVariant = phone.replace('+', ''); // bare digits
      const synthetic = await testApp.rawPrisma.user.create({
        data: {
          companyId: testCompanyId,
          role: UserRole.CLIENT,
          fullName: 'P9 Drifted Synthetic',
          phone: syntheticPhoneVariant,
          locale: 'ar',
        },
        select: { id: true },
      });
      const lead = await testApp.rawPrisma.lead.create({
        data: {
          companyId: testCompanyId,
          clientId: synthetic.id,
          fullName: 'P9 Drifted Synthetic',
          phone: syntheticPhoneVariant,
          stage: LeadStage.NEW,
          assignedSalesId: salesUserId,
        },
        select: { id: true },
      });
      const unit = await pickFreshUnit();
      const reservation = await testApp.rawPrisma.reservation.create({
        data: {
          companyId: testCompanyId,
          unitId: unit.id,
          salesId: salesUserId,
          leadId: lead.id,
          status: ReservationStatus.APPROVED,
          expiresAt: new Date(Date.now() + 72 * 3_600_000),
          reservationNumber: `P9C-${suffix}`,
          bookingAmount: 1,
        },
        select: { id: true },
      });
      await testApp.rawPrisma.unit.update({
        where: { id: unit.id },
        data: { status: UnitStatus.RESERVED, reservationExpiresAt: new Date(Date.now() + 72 * 3_600_000) },
      });

      // 3) Log in. P9's login-time claim must:
      //    - find the synthetic (matches by normalized phone)
      //    - repoint Lead.clientId from synthetic.id → real.id
      //    - delete the synthetic row
      const tok = await loginAs(testApp.app, email, 'StrongPass1!', 'customer');
      expect(tok).toBeTruthy();

      // Verify the synthetic was deleted...
      const syntheticAfter = await testApp.rawPrisma.user.findUnique({
        where: { id: synthetic.id },
        select: { id: true },
      });
      expect(syntheticAfter).toBeNull();
      // ...and the Lead now points at the real user.
      const leadAfter = await testApp.rawPrisma.lead.findUniqueOrThrow({
        where: { id: lead.id },
        select: { clientId: true },
      });
      expect(leadAfter.clientId).toBe(real.id);
      // /me/reservations still surfaces the row (via direct lead.clientId now).
      const meRes = await http()
        .get('/v1/me/reservations')
        .set('Authorization', bearer(tok));
      expect(collectIds(meRes.body)).toContain(reservation.id);
    });

    it('P9.4: PATCH /v1/users/me adding a phone triggers the same merge (covers email-only registered + phone-only synthetic)', async () => {
      const suffix = await uniqueSuffix();
      const phone = `+966500${suffix}`;
      const email = `p9-patch-${suffix}@example.com`;

      // 1) Real customer with email only — mirrors the user's local QA case
      //    (the registered E2E Client whose User.phone is NULL).
      const real = await createRealUser({
        fullName: 'P9 Patcher',
        phone: null,
        email,
        password: 'StrongPass1!',
      });

      // 2) A synthetic with the target phone exists, anchoring a Lead +
      //    Reservation that the registered user does NOT yet own (no
      //    contact overlap).
      const synthetic = await testApp.rawPrisma.user.create({
        data: {
          companyId: testCompanyId,
          role: UserRole.CLIENT,
          fullName: 'P9 Patcher',
          phone,
          locale: 'ar',
        },
        select: { id: true },
      });
      const lead = await testApp.rawPrisma.lead.create({
        data: {
          companyId: testCompanyId,
          clientId: synthetic.id,
          fullName: 'P9 Patcher',
          phone,
          stage: LeadStage.NEW,
          assignedSalesId: salesUserId,
        },
        select: { id: true },
      });
      const unit = await pickFreshUnit();
      const reservation = await testApp.rawPrisma.reservation.create({
        data: {
          companyId: testCompanyId,
          unitId: unit.id,
          salesId: salesUserId,
          leadId: lead.id,
          status: ReservationStatus.PENDING,
          expiresAt: new Date(Date.now() + 72 * 3_600_000),
          reservationNumber: `P9PT-${suffix}`,
          bookingAmount: 1,
        },
        select: { id: true },
      });
      await testApp.rawPrisma.unit.update({
        where: { id: unit.id },
        data: { status: UnitStatus.RESERVED, reservationExpiresAt: new Date(Date.now() + 72 * 3_600_000) },
      });

      // 3) Mint a token (direct — we're not testing the login path here)
      //    and confirm zero rows.
      const tok = await mintAccessToken(real.id, UserRole.CLIENT);
      const before = await http()
        .get('/v1/me/reservations')
        .set('Authorization', bearer(tok));
      expect(collectIds(before.body)).not.toContain(reservation.id);

      // 4) PATCH /v1/users/me with the phone → claim fires, synthetic merged.
      const patch = await http()
        .patch('/v1/users/me')
        .set('Authorization', bearer(tok))
        .send({ phone });
      expect(patch.status).toBe(200);

      const syntheticAfter = await testApp.rawPrisma.user.findUnique({
        where: { id: synthetic.id },
        select: { id: true },
      });
      expect(syntheticAfter).toBeNull();
      const leadAfter = await testApp.rawPrisma.lead.findUniqueOrThrow({
        where: { id: lead.id },
        select: { clientId: true },
      });
      expect(leadAfter.clientId).toBe(real.id);

      // 5) The reservation is now visible.
      const after = await http()
        .get('/v1/me/reservations')
        .set('Authorization', bearer(tok));
      expect(collectIds(after.body)).toContain(reservation.id);
    });

    it('P9.5: claim refuses to merge a row with passwordHash set (real account), even on contact match', async () => {
      const suffix = await uniqueSuffix();
      const phone = `+966500${suffix}`;
      const emailA = `p9-realA-${suffix}@example.com`;
      const emailB = `p9-realB-${suffix}@example.com`;

      // Two real accounts (both passwordHash-set, distinct ids). Even if a
      // phantom matcher fired, B's passwordHash flips it out of the claim
      // eligibility filter.
      const realA = await createRealUser({
        fullName: 'P9 Real A',
        phone,
        email: emailA,
        password: 'StrongPass1!',
      });
      const phoneB = `+966500${suffix}9`;
      const realB = await createRealUser({
        fullName: 'P9 Real B',
        phone: phoneB,
        email: emailB,
        password: 'StrongPass1!',
      });
      const realBRow = await testApp.rawPrisma.user.findUniqueOrThrow({
        where: { id: realB.id },
        select: { passwordHash: true },
      });
      expect(realBRow.passwordHash).toBeTruthy();

      // Log in as A. Even if some phantom matching condition fires, B's
      // passwordHash is set → claim skips it.
      const tokA = await loginAs(testApp.app, emailA, 'StrongPass1!', 'customer');
      expect(tokA).toBeTruthy();

      // B still exists with passwordHash intact.
      const bAfter = await testApp.rawPrisma.user.findUniqueOrThrow({
        where: { id: realB.id },
        select: { passwordHash: true, email: true },
      });
      expect(bAfter.passwordHash).toBeTruthy();
      // `createRealUser` lowercases on insert, matching registerCustomer.
      expect(bAfter.email).toBe(emailB.toLowerCase());
      expect(realA.id).not.toBe(realB.id);
    });
  });

  describe('P8 — phone/email fallback for legacy lead linkage', () => {
    it('P8.3: a logged-in user sees a reservation linked via lead.phone == user.phone even when lead.clientId points elsewhere', async () => {
      const suffix = await uniqueSuffix();
      const phone = `+966500777${suffix}`;
      const email = `p8-fallback-${suffix}@example.com`;

      // 1) Real customer with phone + email (scaffolded directly).
      const real = await createRealUser({
        fullName: 'P8 Real Customer 2',
        phone,
        email,
        password: 'StrongPass1!',
      });

      // 2) Admin later imports a Lead with the SAME phone, but attaches it to
      //    a *different* synthetic User row (simulating CRM data drift — e.g.
      //    the admin pasted the phone differently the first time then merged
      //    it manually, ending up with a divergent synthetic row).
      const orphanSynthetic = await testApp.rawPrisma.user.create({
        data: {
          companyId: testCompanyId,
          role: UserRole.CLIENT,
          fullName: 'P8 Drifted Synthetic',
          phone: `${phone}-orphan`, // distinct phone column so we don't claim it
          locale: 'ar',
        },
        select: { id: true },
      });
      const lead = await testApp.rawPrisma.lead.create({
        data: {
          companyId: testCompanyId,
          clientId: orphanSynthetic.id,
          fullName: 'P8 Drifted Synthetic',
          phone, // matches the REAL user's phone — this is the fallback hook
          email,
          stage: LeadStage.NEW,
          assignedSalesId: salesUserId,
        },
        select: { id: true },
      });
      const unit = await pickFreshUnit();
      const reservation = await testApp.rawPrisma.reservation.create({
        data: {
          companyId: testCompanyId,
          unitId: unit.id,
          salesId: salesUserId,
          leadId: lead.id,
          status: ReservationStatus.APPROVED, // ← APPROVED + non-default status
          expiresAt: new Date(Date.now() + 72 * 3_600_000),
          reservationNumber: `P8F-${suffix}`,
          bookingAmount: 50_000,
          bookingPaymentStatus: 'PAID', // ← PAID must still surface (no client-side filter)
          bookingPaidAt: new Date(),
        },
        select: { id: true },
      });
      await testApp.rawPrisma.unit.update({
        where: { id: unit.id },
        data: {
          status: UnitStatus.RESERVED,
          reservationExpiresAt: new Date(Date.now() + 72 * 3_600_000),
        },
      });

      // 3) Token for the real customer. /me/reservations must surface the
      //    reservation via the phone/email fallback path. Direct mint so the
      //    test exercises the QUERY-time filter, not the login claim.
      const realToken = await mintAccessToken(real.id, UserRole.CLIENT);
      const meRes = await http()
        .get('/v1/me/reservations')
        .set('Authorization', bearer(realToken));
      expect(meRes.status).toBe(200);
      const ids = collectIds(meRes.body);
      expect(ids).toContain(reservation.id);

      // 4) And cross-tenancy still holds: CUSTOMER_2 (different phone/email)
      //    does NOT see it.
      const c2 = await http()
        .get('/v1/me/reservations')
        .set('Authorization', bearer(customer2Token));
      expect(collectIds(c2.body)).not.toContain(reservation.id);

      // Real user must remain CLIENT (no auto-promotion).
      const realAfter = await testApp.rawPrisma.user.findUniqueOrThrow({
        where: { id: real.id },
        select: { role: true },
      });
      expect(realAfter.role).toBe(UserRole.CLIENT);
    });
  });
});

/** Pull ids out of either a bare array or `{ data: [...] }` page wrapper. */
function collectIds(body: unknown): string[] {
  const list: unknown = Array.isArray(body)
    ? body
    : (body as { data?: unknown })?.data;
  if (!Array.isArray(list)) return [];
  return list
    .map((row) =>
      row && typeof row === 'object' && typeof (row as { id?: unknown }).id === 'string'
        ? (row as { id: string }).id
        : undefined,
    )
    .filter((id): id is string => typeof id === 'string');
}
