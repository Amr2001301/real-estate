/**
 * MT-Test-03 — Multi-tenant write-path isolation (Phase 7C, e2e, real DB).
 *
 * Proves that every CREATE / UPSERT in tenant-scoped models stamps the
 * correct companyId on the row — i.e. the Prisma middleware enforces
 * isolation not just on reads (proved in Phase 7B) but also on writes.
 *
 * Scenarios
 * ─────────
 *   WI-1  Guest POST /public/visit-request
 *         → row.companyId == DEFAULT_COMPANY_ID (public context resolves env)
 *
 *   WI-2  CLIENT POST /me/visit-requests
 *         → row.companyId == client's companyId (authenticated context)
 *
 *   WI-3  Admin A POST /leads
 *         → row.companyId == companyAId
 *
 *   WI-4  Admin B POST /leads (different company)
 *         → row.companyId == companyBId (not companyAId)
 *
 *   WI-5  Admin A PUT /settings/:key
 *         → DB row has companyId == companyAId
 *
 *   WI-6  Admin B PUT /settings/:key (same key as WI-5)
 *         → a SEPARATE DB row with companyId == companyBId is created;
 *           Admin A's row is unchanged (compound PK write isolation)
 *
 *   WI-7  Admin B's visit list does not include Admin A's public visit request
 *         (write-then-cross-read negative control)
 *
 * Data setup
 * ──────────
 *   Company A = default company from seed (has DEFAULT_COMPANY_ID).
 *   Company B = created inline in beforeAll; fully torn down in afterAll.
 */

import { UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import request from 'supertest';
import { type TestApp, createTestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

const SLUG_B = 'mt-7c-company-b';
const EMAIL_B = 'admin-7c@mt-test.local';
const PASS_B = 'Admin7C-123!';

const WI_SETTING_KEY = 'mt7c.write.isolation.key';
const WI_PHONE_A = '+966501118800';
const WI_PHONE_B = '+966501118801';
const WI_PUBLIC_PHONE = '+966501118802';

describe('MT-Test-03 — multi-tenant write-path isolation Phase 7C (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;

  let companyAId: string;
  let companyBId: string;

  let adminAToken: string;
  let adminBToken: string;
  let clientToken: string;

  // Row IDs created during tests — needed for afterAll teardown.
  let publicVisitId: string;
  let clientVisitId: string;
  let leadAId: string;
  let leadBId: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    const raw = testApp.rawPrisma;

    // ── Company A ─────────────────────────────────────────────────────────────
    const companyA = await raw.company.findFirstOrThrow({ where: { isActive: true } });
    companyAId = companyA.id;

    // ── Company B — pre-clean + create ────────────────────────────────────────
    const leftover = await raw.company.findFirst({ where: { slug: SLUG_B } });
    if (leftover) {
      await raw.visitRequest.deleteMany({ where: { companyId: leftover.id } });
      await raw.lead.deleteMany({ where: { companyId: leftover.id } });
      await raw.setting.deleteMany({ where: { companyId: leftover.id } });
      await raw.user.deleteMany({ where: { companyId: leftover.id } });
      await raw.company.delete({ where: { id: leftover.id } });
    }

    const companyB = await raw.company.create({
      data: { name: 'MT-7C Company B', slug: SLUG_B, isActive: true },
    });
    companyBId = companyB.id;

    const passwordHash = await argon2.hash(PASS_B);
    await raw.user.create({
      data: {
        email: EMAIL_B,
        passwordHash,
        fullName: 'Admin 7C',
        role: UserRole.ADMIN,
        active: true,
        companyId: companyBId,
      },
    });

    // ── Auth ───────────────────────────────────────────────────────────────────
    [adminAToken, adminBToken, clientToken] = await Promise.all([
      loginAs(testApp.app, 'admin@example.com', process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!'),
      loginAs(testApp.app, EMAIL_B, PASS_B),
      loginAs(
        testApp.app,
        fixtures.users.CLIENT_1.email,
        fixtures.users.CLIENT_1.password,
        'customer',
      ),
    ]);

    // Pre-clean any stale lead users from a previous run.
    await raw.user.deleteMany({ where: { phone: { in: [WI_PHONE_A, WI_PHONE_B] } } });
  }, 60_000);

  afterAll(async () => {
    const raw = testApp.rawPrisma;

    // Tear down Company B entities first.
    await raw.visitRequest.deleteMany({ where: { companyId: companyBId } });
    await raw.lead.deleteMany({ where: { companyId: companyBId } });
    await raw.setting.deleteMany({ where: { companyId: companyBId } });
    await raw.user.deleteMany({ where: { companyId: companyBId } });
    await raw.company.delete({ where: { id: companyBId } });

    // Tear down Company A test rows created in this spec.
    if (publicVisitId) await raw.visitRequest.delete({ where: { id: publicVisitId } }).catch(() => void 0);
    if (clientVisitId) await raw.visitRequest.delete({ where: { id: clientVisitId } }).catch(() => void 0);
    if (leadAId) {
      const row = await raw.lead.findUnique({ where: { id: leadAId }, select: { clientId: true } });
      await raw.lead.delete({ where: { id: leadAId } }).catch(() => void 0);
      if (row?.clientId) await raw.user.delete({ where: { id: row.clientId } }).catch(() => void 0);
    }
    await raw.setting.deleteMany({ where: { companyId: companyAId, key: WI_SETTING_KEY } });

    await testApp.close();
  }, 30_000);

  const http = () => request(testApp.app.getHttpServer());

  // ── WI-1: Guest public visit-request ──────────────────────────────────────

  it('WI-1: guest POST /public/visit-request stamps companyId = DEFAULT_COMPANY_ID', async () => {
    const res = await http()
      .post('/v1/public/visit-request')
      .send({
        projectId: fixtures.projects.p1Id,
        preferredDate: new Date(Date.now() + 86_400_000).toISOString(),
        name: 'MT7C Guest',
        phone: WI_PUBLIC_PHONE,
      })
      .expect(201);

    publicVisitId = (res.body as { id: string }).id;

    const row = await testApp.rawPrisma.visitRequest.findUniqueOrThrow({
      where: { id: publicVisitId },
      select: { companyId: true },
    });
    expect(row.companyId).toBe(companyAId);
  });

  // ── WI-2: Authenticated CLIENT visit-request ───────────────────────────────

  it('WI-2: authenticated CLIENT POST /me/visit-requests stamps companyId = client.companyId', async () => {
    const res = await http()
      .post('/v1/me/visit-requests')
      .set('Authorization', bearer(clientToken))
      .send({
        projectId: fixtures.projects.p1Id,
        preferredDate: new Date(Date.now() + 2 * 86_400_000).toISOString(),
      })
      .expect(201);

    clientVisitId = (res.body as { id: string }).id;

    const row = await testApp.rawPrisma.visitRequest.findUniqueOrThrow({
      where: { id: clientVisitId },
      select: { companyId: true },
    });
    // CLIENT_1 belongs to Company A (the default company).
    expect(row.companyId).toBe(companyAId);
  });

  // ── WI-3: Admin A lead creation ────────────────────────────────────────────

  it('WI-3: Admin A POST /leads stamps companyId = companyAId', async () => {
    const res = await http()
      .post('/v1/leads')
      .set('Authorization', bearer(adminAToken))
      .send({ fullName: 'MT7C Lead A', phone: WI_PHONE_A });
    expect(res.status).toBe(201);
    leadAId = (res.body as { id: string }).id;

    const row = await testApp.rawPrisma.lead.findUniqueOrThrow({
      where: { id: leadAId },
      select: { companyId: true },
    });
    expect(row.companyId).toBe(companyAId);
  });

  // ── WI-4: Admin B lead creation ────────────────────────────────────────────

  it('WI-4: Admin B POST /leads stamps companyId = companyBId (not companyAId)', async () => {
    const res = await http()
      .post('/v1/leads')
      .set('Authorization', bearer(adminBToken))
      .send({ fullName: 'MT7C Lead B', phone: WI_PHONE_B });
    expect(res.status).toBe(201);
    leadBId = (res.body as { id: string }).id;

    const row = await testApp.rawPrisma.lead.findUniqueOrThrow({
      where: { id: leadBId },
      select: { companyId: true },
    });
    expect(row.companyId).toBe(companyBId);
    expect(row.companyId).not.toBe(companyAId);
  });

  // ── WI-5: Admin A setting write stamps correct companyId ───────────────────

  it('WI-5: Admin A PUT /settings/:key stamps companyId = companyAId in DB', async () => {
    await http()
      .put(`/v1/settings/${WI_SETTING_KEY}`)
      .set('Authorization', bearer(adminAToken))
      .send({ value: { source: 'company-a-write' } })
      .expect(200);

    const row = await testApp.rawPrisma.setting.findFirst({
      where: { companyId: companyAId, key: WI_SETTING_KEY },
    });
    expect(row).not.toBeNull();
    expect(row!.companyId).toBe(companyAId);
  });

  // ── WI-6: Admin B same-key upsert creates a SEPARATE row (compound PK) ────

  it('WI-6: Admin B PUT /settings with same key creates separate row — no cross-company overwrite', async () => {
    await http()
      .put(`/v1/settings/${WI_SETTING_KEY}`)
      .set('Authorization', bearer(adminBToken))
      .send({ value: { source: 'company-b-write' } })
      .expect(200);

    // Two rows in DB: one per company.
    const rows = await testApp.rawPrisma.setting.findMany({
      where: { key: WI_SETTING_KEY },
      select: { companyId: true, value: true },
    });
    const companyIds = rows.map((r) => r.companyId);
    expect(companyIds).toContain(companyAId);
    expect(companyIds).toContain(companyBId);

    // Admin A's value was not overwritten.
    const rowA = rows.find((r) => r.companyId === companyAId);
    expect(rowA?.value).toEqual({ source: 'company-a-write' });
  });

  // ── WI-7: Cross-read negative — Admin B cannot see Admin A's visit request ─

  it('WI-7: Admin B GET /visit-requests does not include Admin A public visit (write-then-cross-read)', async () => {
    // publicVisitId was created in WI-1 under companyAId.
    const res = await http()
      .get('/v1/visit-requests')
      .set('Authorization', bearer(adminBToken));
    expect(res.status).toBe(200);

    const ids = (
      (res.body?.data ?? res.body) as Array<{ id: string }>
    ).map((v) => v.id);
    expect(ids).not.toContain(publicVisitId);
  });
});
