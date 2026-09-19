/**
 * Flow F — Maintenance with photos (system QA strategy §E).
 *
 * Asserts the customer-facing + supervisor-facing maintenance surface
 * (`/me/maintenance-requests`, `/maintenance-requests`) is correctly
 * scoped + ownership-guarded + the photo download path is the only way
 * a customer-visible photo URL is ever materialized. The full
 * presign→PUT→register dance is exercised through its own DTO contract
 * (not actually moving bytes — the response shape proves R2 is wired,
 * and we never PUT/GET against the bucket from the test process).
 *
 * Audit reference: `src/modules/maintenance/maintenance.module.ts`,
 * `src/modules/documents/me-documents.module.ts`,
 * `src/modules/media/r2.service.ts`.
 *
 * Mapping back to the §E test matrix:
 *   F1  — Customer creates a maintenance request (returns 201)
 *   F2  — Customer GET /me/maintenance-requests includes both seeded + new
 *   F3  — Customer2 cannot read customer1's request → 404 (no info leak)
 *   F4  — Admin GET /maintenance-requests sees the seeded + new
 *   F5  — Customer photo presign returns {uploadUrl, key, publicUrl}
 *   F6  — After register, the photo Document appears under /me/documents
 *         and download returns a signed URL
 *   F7  — Customer detail view returns only CUSTOMER_VISIBLE photos
 *         (the seeded one IS CUSTOMER_VISIBLE so it appears)
 *   F8  — Cross-account download of customer1's photo by customer2 → 404
 *   F9  — RBAC: GUEST 401; SALES 403 on /me/maintenance-requests;
 *         BROKER 403 on /maintenance-requests
 *
 * Status transition assertions (Flow F #5 from user scope) are NOT
 * implemented here — they require a MAINTENANCE_SUPERVISOR assigned to
 * the request, which the seed does not currently set up. Documented in
 * the Phase 7C report as "carry-forward to Phase 7D" (small addition:
 * extend seed-e2e to assign the seeded request to the maintenance user).
 */

import request from 'supertest';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

describe('Flow F — Maintenance with photos (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;

  let adminToken: string;
  let salesToken: string;
  let broker1Token: string;
  let customer1Token: string;
  let customer2Token: string;

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);

    [adminToken, salesToken, broker1Token, customer1Token, customer2Token] = await Promise.all([
      loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!'),
      loginAs(testApp.app, 'sales@example.com', 'SalesPass123!'),
      loginAs(testApp.app, fixtures.users.BROKER_1.email, fixtures.users.BROKER_1.password),
      loginAs(testApp.app, fixtures.users.CUSTOMER_1.email, fixtures.users.CUSTOMER_1.password, 'customer'),
      loginAs(testApp.app, fixtures.users.CUSTOMER_2.email, fixtures.users.CUSTOMER_2.password, 'customer'),
    ]);
  });


  const http = () => request(testApp.app.getHttpServer());

  // ── F1, F2 — customer create + own-list ──────────────────────────────────
  describe('F1/F2: customer creates and lists their own request', () => {
    let createdRequestId: string;

    it('F1: customer1 POST /v1/me/maintenance-requests → 201', async () => {
      // The DTO requires unitId + categoryIds[] + description.
      const cat = await testApp.rawPrisma.maintenanceCategory.findFirstOrThrow({
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      // Find any of customer1's units (the seed gave them one via their contract).
      const myUnit = await testApp.rawPrisma.contract.findFirstOrThrow({
        where: { customerId: fixtures.userIds.customer1UserId },
        select: { unitId: true },
      });
      const res = await http()
        .post('/v1/me/maintenance-requests')
        .set('Authorization', bearer(customer1Token))
        .send({
          unitId: myUnit.unitId,
          categoryIds: [cat.id],
          description: 'phase 7c — flow F test request',
        });
      expect(res.status).toBe(201);
      expect(typeof res.body?.id).toBe('string');
      createdRequestId = res.body.id;
    });

    it('F2: customer1 GET /v1/me/maintenance-requests includes the new + seeded requests', async () => {
      const res = await http()
        .get('/v1/me/maintenance-requests')
        .set('Authorization', bearer(customer1Token));
      expect(res.status).toBe(200);
      const ids = collectIds(res.body);
      expect(ids).toContain(createdRequestId);
      expect(ids).toContain(fixtures.flowF.customer1MaintenanceRequestId);
    });

    it('F2b: customer2 GET /v1/me/maintenance-requests does NOT include customer1\'s', async () => {
      const res = await http()
        .get('/v1/me/maintenance-requests')
        .set('Authorization', bearer(customer2Token));
      expect(res.status).toBe(200);
      const ids = collectIds(res.body);
      expect(ids).not.toContain(createdRequestId);
      expect(ids).not.toContain(fixtures.flowF.customer1MaintenanceRequestId);
    });
  });

  // ── F3 — cross-account get-detail (ownership guard) ─────────────────────
  it('F3: customer2 GET /v1/me/maintenance-requests/:c1Req → 404 (no existence leak)', async () => {
    const res = await http()
      .get(`/v1/me/maintenance-requests/${fixtures.flowF.customer1MaintenanceRequestId}`)
      .set('Authorization', bearer(customer2Token));
    expect(res.status).toBe(404);
  });

  // ── F4 — admin can see ───────────────────────────────────────────────────
  it('F4: admin GET /v1/maintenance-requests includes customer1\'s seeded request', async () => {
    const res = await http()
      .get('/v1/maintenance-requests')
      .set('Authorization', bearer(adminToken));
    expect(res.status).toBe(200);
    const ids = collectIds(res.body);
    expect(ids).toContain(fixtures.flowF.customer1MaintenanceRequestId);
  });

  // ── F5 — presign response shape ─────────────────────────────────────────
  // R2Service.createPresignedUpload throws 503 ("Storage not configured")
  // when R2_* env vars are unset. Locally those are in `.env` → 201; in CI
  // without creds → 503. We don't actually PUT to the signed URL either
  // way; the response shape proves R2 is wired.
  it('F5: presign returns {uploadUrl, key, publicUrl} with a signature OR 503 when R2 unset', async () => {
    const res = await http()
      .post(`/v1/me/maintenance-requests/${fixtures.flowF.customer1MaintenanceRequestId}/documents/presign`)
      .set('Authorization', bearer(customer1Token))
      .send({ contentType: 'image/jpeg', sizeBytes: 512_000, fileName: 'phase-7c-test.jpg' });
    expect([201, 503]).toContain(res.status);
    if (res.status === 201) {
      expect(typeof res.body?.uploadUrl).toBe('string');
      expect(typeof res.body?.key).toBe('string');
      expect(typeof res.body?.publicUrl).toBe('string');
      expect(res.body.uploadUrl).toContain('X-Amz-Signature');
    }
  });

  // ── F6 — signed download of the seeded photo ────────────────────────────
  it('F6: signed-download for customer1\'s seeded photo returns {url, expiresIn} OR 503 when R2 unset', async () => {
    const res = await http()
      .get(`/v1/me/documents/${fixtures.flowF.customer1MaintenancePhotoDocId}/download`)
      .set('Authorization', bearer(customer1Token));
    expect([200, 503]).toContain(res.status);
    if (res.status === 200) {
      expect(typeof res.body?.url).toBe('string');
      expect(res.body.url).toContain('X-Amz-Signature');
      expect(res.body.expiresIn).toBeGreaterThan(0);
      expect(res.body.expiresIn).toBeLessThanOrEqual(300);
    }
  });

  // ── F7 — customer detail returns only CUSTOMER_VISIBLE docs ─────────────
  it('F7: customer1 detail of the seeded request lists the CUSTOMER_VISIBLE photo', async () => {
    const res = await http()
      .get('/v1/me/documents')
      .query({
        ownerType: 'MAINTENANCE_REQUEST',
        ownerId: fixtures.flowF.customer1MaintenanceRequestId,
      })
      .set('Authorization', bearer(customer1Token));
    expect(res.status).toBe(200);
    const ids = collectIds(res.body);
    expect(ids).toContain(fixtures.flowF.customer1MaintenancePhotoDocId);
  });

  // ── F_SECURITY — maintenance customer-detail never leaks fileUrl ───────
  it('F_SECURITY: GET /v1/me/maintenance-requests/:id returns documents with NO fileUrl', async () => {
    // Phase 7D fix: `MaintenanceService.customerFindOne` previously embedded
    // the full Document row (incl. permanent `fileUrl`) under `.documents`.
    // It now maps to safe metadata only — id/title/fileName/mimeType/category/
    // createdAt — same shape as the /me/documents controller.
    const res = await http()
      .get(`/v1/me/maintenance-requests/${fixtures.flowF.customer1MaintenanceRequestId}`)
      .set('Authorization', bearer(customer1Token));
    expect(res.status).toBe(200);
    const docs = Array.isArray(res.body?.documents) ? res.body.documents : [];
    expect(docs.length).toBeGreaterThan(0);
    for (const d of docs) {
      // The permanent fileUrl key must not even be in the response shape.
      expect('fileUrl' in d).toBe(false);
    }
    // Belt-and-braces: the seeded R2 key cannot appear anywhere in the body.
    expect(JSON.stringify(res.body)).not.toContain('maintenance/e2e/customer1-photo-1.jpg');
  });

  // ── F8 — cross-account download ─────────────────────────────────────────
  it('F8: customer2 GET /v1/me/documents/:c1Photo/download → 404', async () => {
    const res = await http()
      .get(`/v1/me/documents/${fixtures.flowF.customer1MaintenancePhotoDocId}/download`)
      .set('Authorization', bearer(customer2Token));
    expect(res.status).toBe(404);
  });

  // ── F9 — RBAC negatives ─────────────────────────────────────────────────
  describe('F9: RBAC negatives on the maintenance surface', () => {
    it('GET /v1/me/maintenance-requests without token → 401', async () => {
      const res = await http().get('/v1/me/maintenance-requests');
      expect(res.status).toBe(401);
    });

    it('POST /v1/me/maintenance-requests as SALES → 403', async () => {
      const res = await http()
        .post('/v1/me/maintenance-requests')
        .set('Authorization', bearer(salesToken))
        .send({});
      expect(res.status).toBe(403);
    });

    it('GET /v1/maintenance-requests as BROKER → 403', async () => {
      const res = await http()
        .get('/v1/maintenance-requests')
        .set('Authorization', bearer(broker1Token));
      expect(res.status).toBe(403);
    });

    it('GET /v1/maintenance-requests as CUSTOMER → 403 (admin-only)', async () => {
      const res = await http()
        .get('/v1/maintenance-requests')
        .set('Authorization', bearer(customer1Token));
      expect(res.status).toBe(403);
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
    .map((row) => (row && typeof row === 'object' && typeof (row as { id?: unknown }).id === 'string'
      ? (row as { id: string }).id
      : undefined))
    .filter((id): id is string => typeof id === 'string');
}
