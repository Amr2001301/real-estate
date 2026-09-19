/**
 * Step D2 — Settings + Suggestion security tests.
 *
 * Verifies:
 *   DS-1  Company A cannot read Company B's settings (middleware scoping)
 *   DS-2  Company A cannot write to Company B's settings key
 *   DS-3  Company A cannot compute a cancellation suggestion for Company B's
 *         contract (404, not 403 — no existence leak)
 *   DS-4  Company A ADMIN CAN read its own settings
 *   DS-5  Company A ADMIN CAN PUT its own settings (happy path)
 *   DS-6  PUT on a 8 D2 keys with invalid values returns 400
 *   DS-7  Each company's settings are independent (A's write does not affect B's)
 *   DS-8  Seed: both fixture companies have all 8 D2 keys seeded with documented
 *         defaults (verifies the seedCancellationSettingsForCompany path via rawPrisma)
 *   DS-9  New company (created via rawPrisma) that receives seeded settings gets all 8
 *
 * Requires TEST_DATABASE_URL pointing at a dedicated e2e/test database.
 * Run with: pnpm --filter @rep/api test -c test/jest-security.json
 */

import request from 'supertest';
import { type TestApp, createSecurityTestApp } from '../setup-app';
import { bearer, loginAs } from '../helpers/login';
import {
  seedSecurityFixture,
  teardownSecurityFixture,
  SEC_SLUG_A,
  SEC_SLUG_B,
  type SecurityFixture,
} from './seed/security-fixture';
import {
  CANCELLATION_SETTING_DEFAULTS,
  CANCELLATION_SETTING_KEYS,
  seedCancellationSettingsForCompany,
} from '../../src/modules/contracts/cancellation-settings.constants';

let testApp: TestApp;
let fx: SecurityFixture;
let adminAToken: string;
let adminBToken: string;
let extraCompanyId: string | undefined;

beforeAll(async () => {
  testApp = await createSecurityTestApp();
  fx = await seedSecurityFixture(testApp.rawPrisma);

  // Seed D2 settings for both fixture companies (rawPrisma = no middleware)
  await Promise.all([
    seedCancellationSettingsForCompany(testApp.rawPrisma, fx.companies.aId),
    seedCancellationSettingsForCompany(testApp.rawPrisma, fx.companies.bId),
  ]);

  adminAToken = await loginAs(testApp.app, fx.users.adminA.email, fx.users.adminA.password);
  adminBToken = await loginAs(testApp.app, fx.users.adminB.email, fx.users.adminB.password);
}, 90_000);

afterAll(async () => {
  if (extraCompanyId) {
    // Extra company will cascade-delete its settings
    await testApp.rawPrisma.company.delete({ where: { id: extraCompanyId } }).catch(() => void 0);
  }
  await teardownSecurityFixture(testApp.rawPrisma);
});

// ── DS-1: Settings cross-tenant read isolation ────────────────────────────────

it('DS-1: Company A admin cannot read Company B settings via GET /settings', async () => {
  // Seed a unique marker key for Company B
  const markerKey = 'ds1.marker.key';
  await testApp.rawPrisma.setting.upsert({
    where: { companyId_key: { companyId: fx.companies.bId, key: markerKey } },
    create: { companyId: fx.companies.bId, key: markerKey, value: 'b-secret-value' },
    update: {},
  });

  const res = await request(testApp.app.getHttpServer())
    .get('/v1/settings')
    .set('Authorization', bearer(adminAToken))
    .set('X-Tenant-Slug', SEC_SLUG_A)
    .expect(200);

  const keys: string[] = (res.body as Array<{ key: string }>).map((r) => r.key);
  expect(keys).not.toContain(markerKey);

  // Cleanup
  await testApp.rawPrisma.setting.deleteMany({
    where: { companyId: fx.companies.bId, key: markerKey },
  });
});

it('DS-1b: Company A admin cannot read a specific Company B setting key via GET /settings/:key', async () => {
  const markerKey = 'ds1b.marker.key';
  await testApp.rawPrisma.setting.upsert({
    where: { companyId_key: { companyId: fx.companies.bId, key: markerKey } },
    create: { companyId: fx.companies.bId, key: markerKey, value: 'b-only-value' },
    update: {},
  });

  // Company A's context sees no row for this key → 404
  await request(testApp.app.getHttpServer())
    .get(`/v1/settings/${markerKey}`)
    .set('Authorization', bearer(adminAToken))
    .set('X-Tenant-Slug', SEC_SLUG_A)
    .expect(404);

  await testApp.rawPrisma.setting.deleteMany({
    where: { companyId: fx.companies.bId, key: markerKey },
  });
});

// ── DS-2: Settings cross-tenant write isolation ───────────────────────────────

it('DS-2: Company A admin PUT on a key does not overwrite Company B value', async () => {
  const sharedKey = 'cancellation.contract.penaltyPct';

  // Ensure B has a known value first
  await testApp.rawPrisma.setting.upsert({
    where: { companyId_key: { companyId: fx.companies.bId, key: sharedKey } },
    create: { companyId: fx.companies.bId, key: sharedKey, value: 20 },
    update: { value: 20 },
  });

  // Company A writes its own value
  await request(testApp.app.getHttpServer())
    .patch(`/v1/settings/${sharedKey}`)
    .set('Authorization', bearer(adminAToken))
    .set('X-Tenant-Slug', SEC_SLUG_A)
    .send({ value: 15 })
    .expect(200);

  // Company B's value must be unchanged at 20
  const bRow = await testApp.rawPrisma.setting.findFirst({
    where: { companyId: fx.companies.bId, key: sharedKey },
  });
  expect(Number(bRow?.value)).toBe(20);

  // Restore both to the documented default (10) so DS-8a/DS-8b still find 8 rows
  await testApp.rawPrisma.setting.upsert({
    where: { companyId_key: { companyId: fx.companies.aId, key: sharedKey } },
    create: { companyId: fx.companies.aId, key: sharedKey, value: 10 },
    update: { value: 10 },
  });
  await testApp.rawPrisma.setting.upsert({
    where: { companyId_key: { companyId: fx.companies.bId, key: sharedKey } },
    create: { companyId: fx.companies.bId, key: sharedKey, value: 10 },
    update: { value: 10 },
  });
});

// ── DS-3: Cancellation suggestion cross-tenant isolation ──────────────────────

it('DS-3: Company A admin cannot compute cancellation suggestion for Company B contract (404)', async () => {
  // Create a minimal contract under Company B using rawPrisma
  const contractB = await testApp.rawPrisma.contract.create({
    data: {
      companyId: fx.companies.bId,
      unitId: fx.resources.b.unit1Id,
      customerId: fx.users.adminB.id,
      totalAmount: 0,
    },
  });

  // Grant contracts:read to adminA so the request reaches the service (not gated at guard)
  const perm = await testApp.rawPrisma.permission.findFirst({
    where: { code: 'contracts:read' },
  });
  if (perm) {
    await testApp.rawPrisma.userPermission
      .create({ data: { userId: fx.users.adminA.id, permissionId: perm.id } })
      .catch(() => void 0);
  }

  // Company A's admin attempts to access Company B's contract suggestion
  await request(testApp.app.getHttpServer())
    .get(`/v1/contracts/${contractB.id}/cancellation-suggestion`)
    .set('Authorization', bearer(adminAToken))
    .set('X-Tenant-Slug', SEC_SLUG_A)
    .expect(404); // Must be 404, not 403 (no existence leak)

  // Cleanup
  await testApp.rawPrisma.contract.delete({ where: { id: contractB.id } });
});

// ── DS-4: Company A can read its own settings ─────────────────────────────────

it('DS-4: Company A admin can read its own D2 settings', async () => {
  const res = await request(testApp.app.getHttpServer())
    .get('/v1/settings')
    .set('Authorization', bearer(adminAToken))
    .set('X-Tenant-Slug', SEC_SLUG_A)
    .expect(200);

  const keys: string[] = (res.body as Array<{ key: string }>).map((r) => r.key);
  // At least some of the D2 keys should be visible
  const d2Found = CANCELLATION_SETTING_KEYS.filter((k) => keys.includes(k));
  expect(d2Found.length).toBeGreaterThan(0);
});

// ── DS-5: Company A can write its own settings ────────────────────────────────

it('DS-5: Company A admin can PATCH cancellation.contract.penaltyPct to 5', async () => {
  const res = await request(testApp.app.getHttpServer())
    .patch('/v1/settings/cancellation.contract.penaltyPct')
    .set('Authorization', bearer(adminAToken))
    .set('X-Tenant-Slug', SEC_SLUG_A)
    .send({ value: 5 })
    .expect(200);

  expect(res.body.key).toBe('cancellation.contract.penaltyPct');
  expect(res.body.value).toBe(5);

  // Restore to default
  await testApp.rawPrisma.setting.upsert({
    where: { companyId_key: { companyId: fx.companies.aId, key: 'cancellation.contract.penaltyPct' } },
    create: { companyId: fx.companies.aId, key: 'cancellation.contract.penaltyPct', value: 10 },
    update: { value: 10 },
  });
});

// ── DS-6: Invalid values rejected at write time ───────────────────────────────

it('DS-6a: PUT cancellation.bookingAmount.refundPct with 150 returns 400', async () => {
  await request(testApp.app.getHttpServer())
    .patch('/v1/settings/cancellation.bookingAmount.refundPct')
    .set('Authorization', bearer(adminAToken))
    .set('X-Tenant-Slug', SEC_SLUG_A)
    .send({ value: 150 })
    .expect(400);
});

it('DS-6b: PUT cancellation.unit.returnToAvailable with "IMMEDIATE" returns 400', async () => {
  await request(testApp.app.getHttpServer())
    .patch('/v1/settings/cancellation.unit.returnToAvailable')
    .set('Authorization', bearer(adminAToken))
    .set('X-Tenant-Slug', SEC_SLUG_A)
    .send({ value: 'IMMEDIATE' })
    .expect(400);
});

it('DS-6c: PUT cheque.bounced.penaltyAmount with -100 returns 400', async () => {
  await request(testApp.app.getHttpServer())
    .patch('/v1/settings/cheque.bounced.penaltyAmount')
    .set('Authorization', bearer(adminAToken))
    .set('X-Tenant-Slug', SEC_SLUG_A)
    .send({ value: -100 })
    .expect(400);
});

it('DS-6d: PUT cancellation.customer.demoteToClient with string "yes" returns 400', async () => {
  await request(testApp.app.getHttpServer())
    .patch('/v1/settings/cancellation.customer.demoteToClient')
    .set('Authorization', bearer(adminAToken))
    .set('X-Tenant-Slug', SEC_SLUG_A)
    .send({ value: 'yes' })
    .expect(400);
});

// ── DS-7: A and B settings are independent ────────────────────────────────────

it('DS-7: Company A writing a setting does not change Company B value for the same key', async () => {
  const key = 'cancellation.salesBonus.action';

  // Ensure B has RETAIN
  await testApp.rawPrisma.setting.upsert({
    where: { companyId_key: { companyId: fx.companies.bId, key } },
    create: { companyId: fx.companies.bId, key, value: 'RETAIN' },
    update: { value: 'RETAIN' },
  });

  // A writes MANUAL
  await request(testApp.app.getHttpServer())
    .patch(`/v1/settings/${key}`)
    .set('Authorization', bearer(adminAToken))
    .set('X-Tenant-Slug', SEC_SLUG_A)
    .send({ value: 'MANUAL' })
    .expect(200);

  // B must still have RETAIN
  const bRow = await testApp.rawPrisma.setting.findFirst({
    where: { companyId: fx.companies.bId, key },
  });
  expect(bRow?.value).toBe('RETAIN');

  // Restore both to the documented default ('CLAWBACK') so DS-8a/DS-8b still find 8 rows
  await testApp.rawPrisma.setting.upsert({
    where: { companyId_key: { companyId: fx.companies.aId, key } },
    create: { companyId: fx.companies.aId, key, value: 'CLAWBACK' },
    update: { value: 'CLAWBACK' },
  });
  await testApp.rawPrisma.setting.upsert({
    where: { companyId_key: { companyId: fx.companies.bId, key } },
    create: { companyId: fx.companies.bId, key, value: 'CLAWBACK' },
    update: { value: 'CLAWBACK' },
  });
});

// ── DS-8: Both fixture companies seeded with all 8 defaults ───────────────────

it('DS-8a: Company A has all 8 D2 keys in the database with documented defaults', async () => {
  const rows = await testApp.rawPrisma.setting.findMany({
    where: {
      companyId: fx.companies.aId,
      key: { in: CANCELLATION_SETTING_KEYS },
    },
    select: { key: true, value: true },
  });

  const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  expect(Object.keys(byKey)).toHaveLength(8);
  expect(byKey['cancellation.bookingAmount.refundPct']).toBe(0);
  expect(byKey['cancellation.contract.penaltyPct']).toBe(10);
  expect(byKey['cancellation.unit.returnToAvailable']).toBe('REQUIRES_APPROVAL');
  expect(byKey['cancellation.customer.demoteToClient']).toBe(false);
  expect(byKey['cancellation.brokerCommission.action']).toBe('CLAWBACK');
  expect(byKey['cancellation.salesBonus.action']).toBe('CLAWBACK');
  expect(byKey['cheque.bounced.installmentAction']).toBe('REOPEN_AS_OVERDUE');
  expect(byKey['cheque.bounced.penaltyAmount']).toBe(0);
});

it('DS-8b: Company B has all 8 D2 keys in the database with documented defaults', async () => {
  const rows = await testApp.rawPrisma.setting.findMany({
    where: {
      companyId: fx.companies.bId,
      key: { in: CANCELLATION_SETTING_KEYS },
    },
    select: { key: true, value: true },
  });

  expect(rows).toHaveLength(8);
  // All defaults present
  const foundKeys = rows.map((r) => r.key).sort();
  expect(foundKeys).toEqual([...CANCELLATION_SETTING_KEYS].sort());
});

// ── DS-9: New company receives all 8 settings ─────────────────────────────────

it('DS-9: newly created company (seeded via rawPrisma) receives all 8 D2 keys', async () => {
  const slug = 'sec-d2-new-co';
  const newCo = await testApp.rawPrisma.company.create({
    data: { name: 'D2 New Co', slug, isActive: true },
  });
  extraCompanyId = newCo.id;

  await seedCancellationSettingsForCompany(testApp.rawPrisma, newCo.id);

  const rows = await testApp.rawPrisma.setting.findMany({
    where: { companyId: newCo.id, key: { in: CANCELLATION_SETTING_KEYS } },
  });
  expect(rows).toHaveLength(8);

  // Defaults present
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  for (const { key, value } of CANCELLATION_SETTING_DEFAULTS) {
    expect(byKey[key]).toStrictEqual(value);
  }
});

it('DS-9b: seeding the same company twice does not duplicate rows', async () => {
  if (!extraCompanyId) return;

  // Seed again — should be idempotent
  await seedCancellationSettingsForCompany(testApp.rawPrisma, extraCompanyId);

  const count = await testApp.rawPrisma.setting.count({
    where: { companyId: extraCompanyId, key: { in: CANCELLATION_SETTING_KEYS } },
  });
  expect(count).toBe(8);
});
