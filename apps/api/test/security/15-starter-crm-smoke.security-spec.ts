/**
 * STARTER plan CRM smoke test.
 *
 * Proves that a STARTER company (feature.brokers=false, feature.maintenance=false,
 * feature.customerApp=false) can still run its core business via the staff API:
 * leads, reservations, contracts, deposits, installments, visits.
 *
 * Methodology: send each request with a well-formed but non-existent payload.
 * The capability guard passes before business-logic validation, so:
 *   - 400 / 404 / 409 = guard passed, business logic rejected → GOOD
 *   - 403                = capability gate fired             → BAD (test fails)
 *
 * We also send one real successful call (create lead with fullName only, which
 * needs no extra fixtures) to confirm the happy path works end-to-end.
 */

import request from 'supertest';
import { UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import type { INestApplication } from '@nestjs/common';
import { type TestApp, createSecurityTestApp } from '../setup-app';
import { bearer } from '../helpers/login';

const PASS = 'StarterSmoke-1!';
const NIL = '00000000-0000-4000-8000-000000000001';

let testApp: TestApp;
let adminToken: string;
const SLUG = 'starter-smoke-co';

beforeAll(async () => {
  testApp = await createSecurityTestApp();

  await testApp.rawPrisma.user.deleteMany({ where: { company: { slug: SLUG } } });
  await testApp.rawPrisma.company.deleteMany({ where: { slug: SLUG } });

  const co = await testApp.rawPrisma.company.create({
    data: {
      slug: SLUG,
      name: 'Starter Smoke Company',
      isActive: true,
      subscriptionPlan: 'STARTER' as never,
      staffAppEnabled: true,
      customerAppEnabled: false,
    },
  });

  const hash = await argon2.hash(PASS);
  const admin = await testApp.rawPrisma.user.create({
    data: {
      email: 'starter-smoke-admin@smoke.test',
      passwordHash: hash,
      fullName: 'Starter Admin',
      role: UserRole.ADMIN,
      active: true,
      companyId: co.id,
    },
  });

  const loginRes = await request(testApp.app.getHttpServer())
    .post('/v1/auth/login-staff')
    .send({ slug: SLUG, email: admin.email, password: PASS });

  if (loginRes.status !== 200 && loginRes.status !== 201) {
    throw new Error(`Starter admin login failed: ${JSON.stringify(loginRes.body)}`);
  }
  const t = (loginRes.body?.tokens as Record<string, unknown>)?.accessToken ?? loginRes.body?.accessToken;
  if (typeof t !== 'string') throw new Error('No accessToken');
  adminToken = t;
}, 60_000);

afterAll(async () => {
  await testApp.rawPrisma.lead.deleteMany({ where: { company: { slug: SLUG } } });
  await testApp.rawPrisma.user.deleteMany({ where: { company: { slug: SLUG } } });
  await testApp.rawPrisma.company.deleteMany({ where: { slug: SLUG } });
});

function headers() {
  return { Authorization: bearer(adminToken), 'X-Tenant-Slug': SLUG };
}

it('STARTER-1: login succeeds (staffApp=true, plan=STARTER)', () => {
  expect(adminToken).toBeTruthy();
});

it('STARTER-2: GET /leads → 200 (list reads never blocked)', async () => {
  const res = await request(testApp.app.getHttpServer())
    .get('/v1/leads')
    .set(headers());
  expect(res.status).toBe(200);
});

it('STARTER-3: POST /leads → 201 (lead creation works on STARTER)', async () => {
  const res = await request(testApp.app.getHttpServer())
    .post('/v1/leads')
    .set(headers())
    .send({ fullName: 'Starter Test Client', phone: '01099999901' });
  expect(res.status).toBe(201);
});

it('STARTER-4: POST /reservations (bogus unitId) → non-403 (capability gate passed)', async () => {
  const res = await request(testApp.app.getHttpServer())
    .post('/v1/reservations')
    .set(headers())
    .send({ unitId: NIL });
  // 400 (unit not found / validation) or 404 — anything but 403
  expect(res.status).not.toBe(403);
});

it('STARTER-5: GET /reservations → 200 (reads never blocked)', async () => {
  const res = await request(testApp.app.getHttpServer())
    .get('/v1/reservations')
    .set(headers());
  expect(res.status).toBe(200);
});

it('STARTER-6: POST /contracts (bogus reservationId) → non-403 (capability gate passed)', async () => {
  const res = await request(testApp.app.getHttpServer())
    .post('/v1/contracts')
    .set(headers())
    .send({ reservationId: NIL, clientId: NIL, salesId: NIL });
  expect(res.status).not.toBe(403);
});

it('STARTER-7: GET /contracts → 200 (reads never blocked)', async () => {
  const res = await request(testApp.app.getHttpServer())
    .get('/v1/contracts')
    .set(headers());
  expect(res.status).toBe(200);
});

it('STARTER-8: POST /deposits (bogus ids) → non-403 (capability gate passed)', async () => {
  const res = await request(testApp.app.getHttpServer())
    .post('/v1/deposits')
    .set(headers())
    .send({ contractId: NIL, installmentId: NIL, amount: 5000 });
  expect(res.status).not.toBe(403);
});

it('STARTER-9: GET /installments (query by contract) → non-403 (reads pass)', async () => {
  const res = await request(testApp.app.getHttpServer())
    .get(`/v1/contracts/${NIL}/installments`)
    .set(headers());
  // 404 (contract not found) is fine; 403 is not
  expect(res.status).not.toBe(403);
});

it('STARTER-10: POST /visits/appointments (staff schedules visit) → non-403', async () => {
  const res = await request(testApp.app.getHttpServer())
    .post('/v1/visits/appointments')
    .set(headers())
    .send({ scheduledAt: '2027-01-15T10:00:00.000Z' });
  expect(res.status).not.toBe(403);
});

it('STARTER-11: GET /visits/appointments → 200 (reads never blocked)', async () => {
  const res = await request(testApp.app.getHttpServer())
    .get('/v1/visits/appointments')
    .set(headers());
  expect(res.status).toBe(200);
});

it('STARTER-12: GET /projects → 200 (projects readable on STARTER)', async () => {
  const res = await request(testApp.app.getHttpServer())
    .get('/v1/projects')
    .set(headers());
  expect(res.status).toBe(200);
});

it('STARTER-13: GET /units → 200 (units readable on STARTER)', async () => {
  const res = await request(testApp.app.getHttpServer())
    .get('/v1/units')
    .set(headers());
  expect(res.status).toBe(200);
});

it('STARTER-14: broker route → 403 CAPABILITY_GATED (feature.brokers=false is correctly enforced)', async () => {
  const res = await request(testApp.app.getHttpServer())
    .get('/v1/brokers')
    .set(headers());
  expect(res.status).toBe(403);
  expect(JSON.stringify(res.body)).toMatch(/feature\.brokers/i);
});

it('STARTER-15: maintenance route → 403 CAPABILITY_GATED (feature.maintenance=false correctly enforced)', async () => {
  const res = await request(testApp.app.getHttpServer())
    .get('/v1/maintenance-requests')
    .set(headers());
  expect(res.status).toBe(403);
  expect(JSON.stringify(res.body)).toMatch(/feature\.maintenance/i);
});
