/**
 * Merged e2e group 2: Flow-D + Flow-D-Approval + me-reservations
 *
 * Flow-D and Flow-D-Approval previously shared the seeded AVAILABLE unit pool,
 * creating ordering dependencies. Fixed: each describe that needs a unit creates
 * one via rawPrisma in its own beforeAll, making every describe fully self-contained
 * and order-independent.
 *
 * me-reservations already uses pickFreshUnit() which excludes p1 units, so it
 * is compatible with the new unit-creation approach for flow-d/flow-d-approval.
 */

import request from 'supertest';
import { ReservationBookingPaymentStatus, ReservationStatus, UnitStatus } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';
import argon2 from 'argon2';
import { UserRole } from '@prisma/client';

// ── Shared module-level state ─────────────────────────────────────────────────

let testApp: TestApp;
let fixtures: E2EFixtures;
let adminToken: string;
let salesToken: string;
let broker1Token: string;
let broker2Token: string;
let customer1Token: string;

// Shared infrastructure for unit creation (flow-d + flow-d-approval)
let p1BuildingId: string;
let testCompanyId: string;
let unitSeq = 0;

beforeAll(async () => {
  testApp = await createE2ETestApp();
  fixtures = await loadE2EFixtures(testApp.rawPrisma);
  [adminToken, salesToken, broker1Token, broker2Token, customer1Token] = await Promise.all([
    loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!'),
    loginAs(testApp.app, 'sales@example.com', 'SalesPass123!'),
    loginAs(testApp.app, fixtures.users.BROKER_1.email, fixtures.users.BROKER_1.password),
    loginAs(testApp.app, fixtures.users.BROKER_2.email, fixtures.users.BROKER_2.password),
    loginAs(testApp.app, fixtures.users.CUSTOMER_1.email, fixtures.users.CUSTOMER_1.password, 'customer'),
  ]);

  const company = await testApp.rawPrisma.company.findFirstOrThrow({
    where: { isActive: true },
    select: { id: true },
  });
  testCompanyId = company.id;

  const p1Building = await testApp.rawPrisma.building.findFirstOrThrow({
    where: { phase: { projectId: fixtures.projects.p1Id } },
    select: { id: true },
  });
  p1BuildingId = p1Building.id;
});

const http = () => request(testApp.app.getHttpServer());

async function createFreshUnit(label: string): Promise<string> {
  const unit = await testApp.rawPrisma.unit.create({
    data: {
      buildingId: p1BuildingId,
      companyId: testCompanyId,
      code: `${label}-${Date.now()}-${unitSeq++}`,
      type: '2BR',
      area: 100,
      price: 1_000_000,
      status: UnitStatus.AVAILABLE,
    },
    select: { id: true },
  });
  return unit.id;
}

// ═════════════════════════════════════════════════════════════════════════════
// Flow D — Reservations (e2e)
// ═════════════════════════════════════════════════════════════════════════════

describe('Flow D — Reservations (e2e)', () => {
  describe('D1–D4: sales creates, extends, and cancels a reservation', () => {
    let reservationId: string;
    let unitId: string;

    beforeAll(async () => {
      unitId = await createFreshUnit('D-UNIT');
    });

    it('D1: SALES POST /v1/reservations creates a PENDING reservation', async () => {
      const res = await http()
        .post('/v1/reservations')
        .set('Authorization', bearer(salesToken))
        .send({
          unitId,
          clientId: fixtures.userIds.customer1UserId,
          notes: 'phase 7b — basic sales reservation',
          expiresInHours: 72,
        });
      expect(res.status).toBe(201);
      const id: unknown = res.body?.id ?? res.body?.reservation?.id;
      expect(typeof id).toBe('string');
      reservationId = id as string;

      const row = await testApp.rawPrisma.reservation.findUniqueOrThrow({
        where: { id: reservationId },
        select: { status: true, unitId: true, clientId: true },
      });
      expect(row.status).toBe(ReservationStatus.PENDING);
      expect(row.unitId).toBe(unitId);
      expect(row.clientId).toBe(fixtures.userIds.customer1UserId);

      const unit = await testApp.rawPrisma.unit.findUniqueOrThrow({
        where: { id: unitId },
        select: { status: true },
      });
      expect(unit.status).toBe(UnitStatus.RESERVED);
    });

    it('D2: SALES can PATCH /v1/reservations/:id/extend to push expiry', async () => {
      const before = await testApp.rawPrisma.reservation.findUniqueOrThrow({
        where: { id: reservationId },
        select: { expiresAt: true },
      });
      const res = await http()
        .patch(`/v1/reservations/${reservationId}/extend`)
        .set('Authorization', bearer(salesToken))
        .send({ additionalHours: 48 });
      expect(res.status).toBe(200);
      const after = await testApp.rawPrisma.reservation.findUniqueOrThrow({
        where: { id: reservationId },
        select: { expiresAt: true },
      });
      expect(new Date(after.expiresAt).getTime()).toBeGreaterThan(
        new Date(before.expiresAt).getTime(),
      );
    });

    it('D3: duplicate reservation on the same unit is rejected (409)', async () => {
      const res = await http()
        .post('/v1/reservations')
        .set('Authorization', bearer(salesToken))
        .send({
          unitId,
          clientId: fixtures.userIds.customer1UserId,
          notes: 'phase 7b — should fail — already reserved',
          expiresInHours: 24,
        });
      expect(res.status).toBe(409);
    });

    it('D4: SALES cancels → CANCELLED, unit reverts to AVAILABLE', async () => {
      const res = await http()
        .post(`/v1/reservations/${reservationId}/cancel`)
        .set('Authorization', bearer(salesToken))
        .send({ reason: 'phase 7b — cancel test' });
      expect(res.status).toBe(201);

      const row = await testApp.rawPrisma.reservation.findUniqueOrThrow({
        where: { id: reservationId },
        select: { status: true },
      });
      expect(row.status).toBe(ReservationStatus.CANCELLED);

      const unit = await testApp.rawPrisma.unit.findUniqueOrThrow({
        where: { id: unitId },
        select: { status: true },
      });
      expect(unit.status).toBe(UnitStatus.AVAILABLE);
    });
  });

  describe('D5–D7: broker portal reservation', () => {
    let reservationId: string;
    let unitId: string;

    beforeAll(async () => {
      unitId = await createFreshUnit('D-BROKER-UNIT');
    });

    it('D5: broker1 POST /v1/portal/reservations creates a reservation', async () => {
      const res = await http()
        .post('/v1/portal/reservations')
        .set('Authorization', bearer(broker1Token))
        .send({
          unitId,
          clientId: fixtures.userIds.customer1UserId,
          notes: 'phase 7b — broker portal reservation',
          expiresInHours: 48,
        });
      expect(res.status).toBe(201);
      const id: unknown = res.body?.id ?? res.body?.reservation?.id;
      expect(typeof id).toBe('string');
      reservationId = id as string;

      const row = await testApp.rawPrisma.reservation.findUniqueOrThrow({
        where: { id: reservationId },
        select: { status: true, brokerId: true },
      });
      expect(row.status).toBe(ReservationStatus.PENDING);
    });

    it('D6: broker1 GET /v1/portal/reservations sees own reservation', async () => {
      const res = await http()
        .get('/v1/portal/reservations')
        .set('Authorization', bearer(broker1Token));
      expect(res.status).toBe(200);
      const ids = collectIds(res.body);
      expect(ids).toContain(reservationId);
    });

    it("D7: broker2 does NOT see broker1's reservation", async () => {
      const res = await http()
        .get('/v1/portal/reservations')
        .set('Authorization', bearer(broker2Token));
      expect(res.status).toBe(200);
      expect(collectIds(res.body)).not.toContain(reservationId);
    });
  });

  describe('D8–D10: RBAC negatives', () => {
    it('D8: POST /v1/reservations without token → 401', async () => {
      expect((await http().post('/v1/reservations').send({})).status).toBe(401);
    });

    it('D9: POST /v1/reservations as CUSTOMER → 403', async () => {
      const res = await http()
        .post('/v1/reservations')
        .set('Authorization', bearer(customer1Token))
        .send({ unitId: fixtures.units.sampleUnitInP1Id, expiresInHours: 24 });
      expect(res.status).toBe(403);
    });

    it('D10: POST /v1/portal/reservations as SALES → 403 (broker surface)', async () => {
      const res = await http()
        .post('/v1/portal/reservations')
        .set('Authorization', bearer(salesToken))
        .send({ unitId: fixtures.units.sampleUnitInP1Id, expiresInHours: 24 });
      expect(res.status).toBe(403);
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Flow D Approval — Reservation approval workflow (e2e)
// ═════════════════════════════════════════════════════════════════════════════

describe('Flow D Approval — Reservation approval workflow (e2e)', () => {
  async function createSalesReservation(): Promise<{ reservationId: string; unitId: string }> {
    const unitId = await createFreshUnit('DA-UNIT');
    const res = await http()
      .post('/v1/reservations')
      .set('Authorization', bearer(salesToken))
      .send({
        unitId,
        clientId: fixtures.userIds.customer1UserId,
        notes: 'phase 7c — admin-approval prep',
        expiresInHours: 72,
      });
    expect(res.status).toBe(201);
    const id: unknown = res.body?.id ?? res.body?.reservation?.id;
    if (typeof id !== 'string')
      throw new Error(`createSalesReservation: no id returned: ${JSON.stringify(res.body)}`);
    return { reservationId: id, unitId };
  }

  describe('DA1–DA4: approval path — admin approves a sales reservation', () => {
    let reservationId: string;
    let unitId: string;

    beforeAll(async () => {
      ({ reservationId, unitId } = await createSalesReservation());
    });

    it('DA1: reservation exists and is PENDING', async () => {
      const row = await testApp.rawPrisma.reservation.findUniqueOrThrow({
        where: { id: reservationId },
        select: { status: true },
      });
      expect(row.status).toBe(ReservationStatus.PENDING);
    });

    it('DA2: ADMIN can GET /v1/reservations/pending-approval and see it in the queue', async () => {
      const res = await http()
        .get('/v1/reservations/pending-approval')
        .set('Authorization', bearer(adminToken));
      expect(res.status).toBe(200);
      expect(collectIds(res.body)).toContain(reservationId);
    });

    it('DA3: ADMIN approves → APPROVED', async () => {
      const res = await http()
        .post(`/v1/reservations/${reservationId}/approve`)
        .set('Authorization', bearer(adminToken))
        .send({ adminNotes: 'phase 7c — approved for test' });
      expect(res.status).toBe(201);

      const row = await testApp.rawPrisma.reservation.findUniqueOrThrow({
        where: { id: reservationId },
        select: { status: true, approvedAt: true },
      });
      expect(row.status).toBe(ReservationStatus.APPROVED);
      expect(row.approvedAt).not.toBeNull();
    });

    it('DA4: unit transitions to RESERVED after approval', async () => {
      const unit = await testApp.rawPrisma.unit.findUniqueOrThrow({
        where: { id: unitId },
        select: { status: true },
      });
      expect(unit.status).toBe(UnitStatus.RESERVED);
    });
  });

  describe('DA5: rejection path — admin rejects a sales reservation', () => {
    let reservationId: string;

    beforeAll(async () => {
      ({ reservationId } = await createSalesReservation());
    });

    it('DA5: ADMIN rejects → REJECTED, unit back to AVAILABLE', async () => {
      const row0 = await testApp.rawPrisma.reservation.findUniqueOrThrow({
        where: { id: reservationId },
        select: { unitId: true },
      });
      const res = await http()
        .post(`/v1/reservations/${reservationId}/reject`)
        .set('Authorization', bearer(adminToken))
        .send({ rejectionReason: 'phase 7c — rejected for test' });
      expect(res.status).toBe(201);

      const row = await testApp.rawPrisma.reservation.findUniqueOrThrow({
        where: { id: reservationId },
        select: { status: true, rejectedAt: true },
      });
      expect(row.status).toBe(ReservationStatus.REJECTED);
      expect(row.rejectedAt).not.toBeNull();

      const unit = await testApp.rawPrisma.unit.findUniqueOrThrow({
        where: { id: row0.unitId },
        select: { status: true },
      });
      expect(unit.status).toBe(UnitStatus.AVAILABLE);
    });
  });

  describe('DA6: deposit after approval', () => {
    let reservationId: string;

    beforeAll(async () => {
      ({ reservationId } = await createSalesReservation());
      await http()
        .post(`/v1/reservations/${reservationId}/approve`)
        .set('Authorization', bearer(adminToken))
        .send({ adminNotes: 'phase 7c — deposit test' });
    });

    it('DA6: SALES records a booking deposit on an APPROVED reservation', async () => {
      const res = await http()
        .post(`/v1/reservations/${reservationId}/booking-payment`)
        .set('Authorization', bearer(salesToken))
        .send({
          amount: 50000,
          paymentMethod: 'BANK_TRANSFER',
          referenceNumber: 'DA6-REF-001',
        });
      expect(res.status).toBe(201);

      const row = await testApp.rawPrisma.reservation.findUniqueOrThrow({
        where: { id: reservationId },
        select: { bookingPaymentStatus: true, bookingAmount: true },
      });
      expect(row.bookingPaymentStatus).toBe(ReservationBookingPaymentStatus.PAID);
      expect(Number(row.bookingAmount)).toBe(50000);
    });
  });

  describe('DA7: booking-payment blocked on non-approved reservation', () => {
    let reservationId: string;

    beforeAll(async () => {
      ({ reservationId } = await createSalesReservation());
    });

    it('DA7: recording deposit on a PENDING reservation fails (400/409/422)', async () => {
      const res = await http()
        .post(`/v1/reservations/${reservationId}/booking-payment`)
        .set('Authorization', bearer(salesToken))
        .send({ amount: 25000, paymentMethod: 'CASH' });
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });
  });

  describe('DA8 / DA8b: RBAC negatives for approval endpoints', () => {
    let reservationId: string;

    beforeAll(async () => {
      ({ reservationId } = await createSalesReservation());
    });

    it('DA8: SALES cannot approve a reservation (403)', async () => {
      const res = await http()
        .post(`/v1/reservations/${reservationId}/approve`)
        .set('Authorization', bearer(salesToken))
        .send({});
      expect(res.status).toBe(403);
    });

    it('DA8b: SALES cannot reject a reservation (403)', async () => {
      const res = await http()
        .post(`/v1/reservations/${reservationId}/reject`)
        .set('Authorization', bearer(salesToken))
        .send({ rejectionReason: 'should fail' });
      expect(res.status).toBe(403);
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// P7–P9: me/reservations + me/contracts + contract installments (e2e)
// ═════════════════════════════════════════════════════════════════════════════

describe('P7–P9: me/reservations + me/contracts + contract installments (e2e)', () => {
  let client1UserId: string;
  let salesUserId: string;
  let p8Seq = 0;

  const consumedUnitIds = new Set<string>();

  async function pickFreshUnit(): Promise<{ id: string }> {
    const unit = await testApp.rawPrisma.unit.findFirstOrThrow({
      where: {
        status: UnitStatus.AVAILABLE,
        id: { notIn: Array.from(consumedUnitIds) },
        NOT: { building: { phase: { projectId: fixtures.projects.p1Id } } },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true },
    });
    consumedUnitIds.add(unit.id);
    return unit;
  }

  async function reserveFreshUnitFor(
    clientUserId: string,
    agentToken: string,
    label = '',
  ): Promise<string> {
    const unit = await pickFreshUnit();
    const res = await http()
      .post('/v1/reservations')
      .set('Authorization', bearer(agentToken))
      .send({
        unitId: unit.id,
        clientId: clientUserId,
        notes: `P7-reservation${label}`,
        expiresInHours: 48,
      });
    expect(res.status).toBe(201);
    const id: unknown = res.body?.id ?? res.body?.reservation?.id;
    if (typeof id !== 'string')
      throw new Error(`reserveFreshUnitFor: no id: ${JSON.stringify(res.body)}`);
    return id;
  }

  function uniqueSuffix(): string {
    return `${Date.now()}-${(p8Seq++).toString().padStart(3, '0')}`;
  }

  async function createRealUser(opts: {
    email: string;
    phone: string;
    fullName: string;
    password: string;
  }): Promise<string> {
    const hash = await argon2.hash(opts.password);
    const user = await testApp.rawPrisma.user.create({
      data: {
        email: opts.email,
        phone: opts.phone,
        fullName: opts.fullName,
        passwordHash: hash,
        role: UserRole.CUSTOMER,
        companyId: testCompanyId,
        emailVerifiedAt: new Date(),
      },
      select: { id: true },
    });
    return user.id;
  }

  async function mintAccessToken(userId: string): Promise<string> {
    return testApp.signAccessToken(userId, UserRole.CUSTOMER);
  }

  describe('P7: GET /v1/me/reservations — customer sees only own rows', () => {
    let client1Token: string;
    let client2Token: string;
    let r1Id: string;

    beforeAll(async () => {
      const suf = uniqueSuffix();
      client1UserId = await createRealUser({
        email: `p7c1-${suf}@example.com`,
        phone: `+96655${suf.slice(-7).padStart(7, '0')}`,
        fullName: 'P7 Client1',
        password: 'TestPass123!',
      });
      const c2Id = await createRealUser({
        email: `p7c2-${suf}@example.com`,
        phone: `+96655${(Number(suf.slice(-7)) + 1).toString().padStart(7, '0')}`,
        fullName: 'P7 Client2',
        password: 'TestPass123!',
      });
      salesUserId = fixtures.userIds.salesId;

      client1Token = await mintAccessToken(client1UserId);
      client2Token = await mintAccessToken(c2Id);

      r1Id = await reserveFreshUnitFor(client1UserId, salesToken, '-P7c1');
      await reserveFreshUnitFor(c2Id, salesToken, '-P7c2');
    });

    it('P7-01: GET /v1/me/reservations returns only the caller\'s reservations', async () => {
      const res = await http()
        .get('/v1/me/reservations')
        .set('Authorization', bearer(client1Token));
      expect(res.status).toBe(200);
      const ids = collectIds(res.body);
      expect(ids).toContain(r1Id);
    });

    it('P7-02: cross-user isolation — client2 cannot see client1 reservations', async () => {
      const res = await http()
        .get('/v1/me/reservations')
        .set('Authorization', bearer(client2Token));
      expect(res.status).toBe(200);
      expect(collectIds(res.body)).not.toContain(r1Id);
    });

    it('P7-03: unauthenticated request → 401', async () => {
      expect((await http().get('/v1/me/reservations')).status).toBe(401);
    });
  });

  describe('P8: GET /v1/me/contracts — customer sees only own rows', () => {
    let client3Token: string;
    let client4Token: string;
    let contractId: string;

    beforeAll(async () => {
      const suf = uniqueSuffix();
      const c3Id = await createRealUser({
        email: `p8c3-${suf}@example.com`,
        phone: `+96656${suf.slice(-7).padStart(7, '0')}`,
        fullName: 'P8 Client3',
        password: 'TestPass123!',
      });
      const c4Id = await createRealUser({
        email: `p8c4-${suf}@example.com`,
        phone: `+96656${(Number(suf.slice(-7)) + 1).toString().padStart(7, '0')}`,
        fullName: 'P8 Client4',
        password: 'TestPass123!',
      });

      client3Token = await mintAccessToken(c3Id);
      client4Token = await mintAccessToken(c4Id);

      const reservationId = await reserveFreshUnitFor(c3Id, salesToken, '-P8c3');
      const reservationRow = await testApp.rawPrisma.reservation.findUniqueOrThrow({
        where: { id: reservationId },
        select: { unitId: true },
      });

      const contractRes = await http()
        .post('/v1/contracts')
        .set('Authorization', bearer(adminToken))
        .send({
          reservationId,
          unitId: reservationRow.unitId,
          clientId: c3Id,
          salesId: salesUserId,
          signingDate: new Date().toISOString(),
          totalPrice: 500000,
          downPayment: 50000,
        });
      expect(contractRes.status).toBe(201);
      contractId = contractRes.body?.id ?? contractRes.body?.contract?.id;
      expect(typeof contractId).toBe('string');

      await reserveFreshUnitFor(c4Id, salesToken, '-P8c4');
    });

    it('P8-01: GET /v1/me/contracts returns client3\'s contract', async () => {
      const res = await http()
        .get('/v1/me/contracts')
        .set('Authorization', bearer(client3Token));
      expect(res.status).toBe(200);
      expect(collectIds(res.body)).toContain(contractId);
    });

    it('P8-02: client4 cannot see client3\'s contract', async () => {
      const res = await http()
        .get('/v1/me/contracts')
        .set('Authorization', bearer(client4Token));
      expect(res.status).toBe(200);
      expect(collectIds(res.body)).not.toContain(contractId);
    });

    it('P8-03: unauthenticated → 401', async () => {
      expect((await http().get('/v1/me/contracts')).status).toBe(401);
    });
  });

  describe('P9: GET /v1/me/contracts/:id/installments — customer sees only own installments', () => {
    let c5Token: string;
    let c6Token: string;
    let c5ContractId: string;

    beforeAll(async () => {
      const suf = uniqueSuffix();
      const c5Id = await createRealUser({
        email: `p9c5-${suf}@example.com`,
        phone: `+96657${suf.slice(-7).padStart(7, '0')}`,
        fullName: 'P9 Client5',
        password: 'TestPass123!',
      });
      const c6Id = await createRealUser({
        email: `p9c6-${suf}@example.com`,
        phone: `+96657${(Number(suf.slice(-7)) + 1).toString().padStart(7, '0')}`,
        fullName: 'P9 Client6',
        password: 'TestPass123!',
      });
      c5Token = await mintAccessToken(c5Id);
      c6Token = await mintAccessToken(c6Id);

      const r5Id = await reserveFreshUnitFor(c5Id, salesToken, '-P9c5');
      const r5Row = await testApp.rawPrisma.reservation.findUniqueOrThrow({
        where: { id: r5Id },
        select: { unitId: true },
      });
      const contractRes = await http()
        .post('/v1/contracts')
        .set('Authorization', bearer(adminToken))
        .send({
          reservationId: r5Id,
          unitId: r5Row.unitId,
          clientId: c5Id,
          salesId: salesUserId,
          signingDate: new Date().toISOString(),
          totalPrice: 600000,
          downPayment: 60000,
        });
      expect(contractRes.status).toBe(201);
      c5ContractId = contractRes.body?.id ?? contractRes.body?.contract?.id;

      const planRes = await http()
        .post(`/v1/contracts/${c5ContractId}/installment-plans`)
        .set('Authorization', bearer(adminToken))
        .send({
          downPaymentAmount: 60000,
          installmentCount: 12,
          installmentAmount: 45000,
          paymentDay: 1,
          startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        });
      expect(planRes.status).toBe(201);

      await reserveFreshUnitFor(c6Id, salesToken, '-P9c6');
    });

    it('P9-01: GET /v1/me/contracts/:id/installments shows client5\'s installments', async () => {
      const res = await http()
        .get(`/v1/me/contracts/${c5ContractId}/installments`)
        .set('Authorization', bearer(c5Token));
      expect(res.status).toBe(200);
      const list = Array.isArray(res.body) ? res.body : res.body?.data ?? [];
      expect(list.length).toBeGreaterThan(0);
    });

    it('P9-02: client6 cannot access client5\'s installments → 403 or 404', async () => {
      const res = await http()
        .get(`/v1/me/contracts/${c5ContractId}/installments`)
        .set('Authorization', bearer(c6Token));
      expect([403, 404]).toContain(res.status);
    });

    it('P9-03: unauthenticated → 401', async () => {
      expect(
        (await http().get(`/v1/me/contracts/${c5ContractId}/installments`)).status,
      ).toBe(401);
    });
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function collectIds(body: unknown): string[] {
  const list: unknown = Array.isArray(body) ? body : (body as { data?: unknown })?.data;
  if (!Array.isArray(list)) return [];
  return list
    .map((row) => {
      if (row && typeof row === 'object' && 'id' in row && typeof (row as { id?: unknown }).id === 'string') {
        return (row as { id: string }).id;
      }
      return undefined;
    })
    .filter((id): id is string => typeof id === 'string');
}
