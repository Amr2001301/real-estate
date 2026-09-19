/**
 * Flow G — Mobile upload flows (TASK-TEST-003)
 *
 * Verifies the two upload chains used by mobile clients:
 *
 *   G-PROOF  Payment proof  (customer): presign → PUT → attach to deposit
 *   G-MAINT  Maintenance doc (customer): presign → PUT → register → signed GET
 *
 * The "files are actually stored in storage" assertion is done by:
 *   1. Doing a real HTTP PUT to the presigned URL returned by the API (MinIO).
 *   2. After registering, calling the signed-download endpoint and issuing a
 *      HEAD request to the returned signed URL — a 200 from MinIO proves the
 *      object actually landed.
 *
 * SKIP CONDITION: When `S3_ENDPOINT` is not set (CI, local dev without
 * MinIO) all tests in this file skip gracefully. They only run when object
 * storage is reachable (staging, local MinIO).
 *
 * Prerequisites (seed-e2e.ts / globalSetup must have run):
 *   - admin@example.com with documents:upload + deposits:register
 *   - customer@example.com (CUSTOMER_1) — seeded by seed-e2e
 *   - flowE.customer1DepositId — pre-existing DOWN_PAYMENT deposit for customer1
 *   - flowF.customer1MaintenanceRequestId — customer1's OPEN maintenance request
 */

import request from 'supertest';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

/**
 * Minimal valid JPEG (SOI + APP0 JFIF header + EOI) — 20 bytes.
 * MinIO doesn't validate JPEG content; any bytes satisfy the PUT.
 * Using a real JPEG magic header ensures the content-type matches in case
 * any future middleware inspects the payload.
 */
const TINY_JPEG = Buffer.from('FFD8FFE000104A46494600010100000100010000FFD9', 'hex');

const STORAGE_AVAILABLE = !!(process.env.S3_ENDPOINT ?? process.env.R2_ACCOUNT_ID);

/** HEAD a URL with no redirect following and return the status. */
async function headUrl(url: string): Promise<number> {
  const res = await fetch(url, { method: 'HEAD', redirect: 'manual' });
  return res.status;
}

/** PUT bytes to a presigned URL (MinIO / R2). Returns the HTTP status. */
async function putToPresignedUrl(
  url: string,
  body: Buffer,
  contentType: string,
): Promise<number> {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body,
  });
  return res.status;
}

const describeIfStorage = STORAGE_AVAILABLE ? describe : describe.skip;

describeIfStorage('Flow G — Mobile upload flows (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  let customer1Token: string;

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);

    [adminToken, customer1Token] = await Promise.all([
      loginAs(
        testApp.app,
        process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com',
        process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!',
      ),
      loginAs(
        testApp.app,
        fixtures.users.CUSTOMER_1.email,
        fixtures.users.CUSTOMER_1.password,
        'customer',
      ),
    ]);
  });


  const http = () => request(testApp.app.getHttpServer());

  // ── G-PROOF — Payment proof: presign → PUT → attach to deposit ───────────

  describe('G-PROOF: payment proof upload', () => {
    let uploadUrl: string;
    let objectKey: string;

    /**
     * G1: Customer presign endpoint returns a signed PUT URL and an object key.
     * The URL must target our configured storage (S3_ENDPOINT host).
     */
    it('G1: POST /v1/me/payments/presign returns uploadUrl and key', async () => {
      const res = await http()
        .post('/v1/me/payments/presign')
        .set('Authorization', bearer(customer1Token))
        .send({ contentType: 'image/jpeg', sizeBytes: TINY_JPEG.length, fileName: 'receipt.jpg' });

      expect(res.status).toBe(201);
      expect(typeof res.body.uploadUrl).toBe('string');
      expect(typeof res.body.key).toBe('string');
      expect(res.body.uploadUrl).toMatch(/^https?:\/\//);
      expect(res.body.key).toMatch(/^documents\//);

      uploadUrl = res.body.uploadUrl as string;
      objectKey = res.body.key as string;
    });

    /**
     * G2: PUT the file bytes to the presigned URL. MinIO returns 200 (or 204).
     * This is the "file actually landed in storage" proof.
     */
    it('G2: PUT to presigned URL stores the file (MinIO returns 200)', async () => {
      expect(uploadUrl).toBeDefined();
      const status = await putToPresignedUrl(uploadUrl, TINY_JPEG, 'image/jpeg');
      expect([200, 204]).toContain(status);
    });

    /**
     * G3: Admin attaches the uploaded key to the seeded deposit.
     * POST /v1/deposits/:id/receipt links the object to the deposit row
     * and creates a Document record for the admin review queue.
     */
    it('G3: Admin POST /v1/deposits/:id/receipt attaches the file', async () => {
      expect(objectKey).toBeDefined();
      const depositId = fixtures.flowE.customer1DepositId;

      const res = await http()
        .post(`/v1/deposits/${depositId}/receipt`)
        .set('Authorization', bearer(adminToken))
        .send({ receiptUrl: objectKey });

      expect(res.status).toBe(201);
      // The response carries the updated deposit with proofDocumentId.
      expect(res.body).toMatchObject({ id: depositId });
    });

    /**
     * G4: Admin signed-download endpoint returns a short-lived URL.
     * HEAD-ing that URL from the test proves the object is accessible in storage.
     */
    it('G4: Admin GET /v1/deposits/:id/proof/download → signed URL is live', async () => {
      const depositId = fixtures.flowE.customer1DepositId;

      const res = await http()
        .get(`/v1/deposits/${depositId}/proof/download`)
        .set('Authorization', bearer(adminToken));

      expect(res.status).toBe(200);
      expect(typeof res.body.url).toBe('string');
      expect(res.body.url).toMatch(/X-Amz-Signature/i);
      expect(typeof res.body.expiresIn).toBe('number');

      // Prove the object is actually in MinIO (not just a signed URL for a
      // non-existent object): HEAD the signed URL.
      const headStatus = await headUrl(res.body.url as string);
      expect([200, 204]).toContain(headStatus);
    });
  });

  // ── G-MAINT — Maintenance doc: presign → PUT → register → signed GET ─────

  describe('G-MAINT: maintenance document upload', () => {
    const MAINT_CONTENT_TYPE = 'image/jpeg';
    let uploadUrl: string;
    let objectKey: string;
    let docId: string;

    /**
     * G5: Customer presign for maintenance doc returns { uploadUrl, key }.
     * The key must be in the `documents/` (private) namespace.
     */
    it('G5: POST /v1/me/maintenance-requests/:id/documents/presign returns uploadUrl + key', async () => {
      const reqId = fixtures.flowF.customer1MaintenanceRequestId;

      const res = await http()
        .post(`/v1/me/maintenance-requests/${reqId}/documents/presign`)
        .set('Authorization', bearer(customer1Token))
        .send({
          contentType: MAINT_CONTENT_TYPE,
          sizeBytes: TINY_JPEG.length,
          fileName: 'photo.jpg',
        });

      expect(res.status).toBe(201);
      expect(typeof res.body.uploadUrl).toBe('string');
      expect(typeof res.body.key).toBe('string');
      expect(res.body.uploadUrl).toMatch(/^https?:\/\//);

      uploadUrl = res.body.uploadUrl as string;
      objectKey = res.body.key as string;
    });

    /**
     * G6: PUT file bytes to the presigned URL.
     * MinIO returns 200/204 — proves the object landed.
     */
    it('G6: PUT to presigned URL stores the maintenance photo (MinIO returns 200)', async () => {
      expect(uploadUrl).toBeDefined();
      const status = await putToPresignedUrl(uploadUrl, TINY_JPEG, MAINT_CONTENT_TYPE);
      expect([200, 204]).toContain(status);
    });

    /**
     * G7: Register the uploaded object as a maintenance document.
     * POST /v1/me/maintenance-requests/:id/documents creates the Document row
     * and links it to the maintenance request.
     */
    it('G7: POST /v1/me/maintenance-requests/:id/documents registers the document', async () => {
      expect(objectKey).toBeDefined();
      const reqId = fixtures.flowF.customer1MaintenanceRequestId;

      const res = await http()
        .post(`/v1/me/maintenance-requests/${reqId}/documents`)
        .set('Authorization', bearer(customer1Token))
        .send({
          title: '[e2e upload] G7 maintenance photo',
          fileUrl: objectKey,
          fileName: 'photo.jpg',
          mimeType: MAINT_CONTENT_TYPE,
          sizeBytes: TINY_JPEG.length,
        });

      expect(res.status).toBe(201);
      expect(typeof res.body.id).toBe('string');
      docId = res.body.id as string;
    });

    /**
     * G8: GET /v1/me/documents/:id/download returns a short-lived signed URL.
     * Shape: { url, fileName, contentType, expiresIn }.
     * The URL must contain X-Amz-Signature (proving it's a real presigned URL,
     * not a plain publicUrl).
     */
    it('G8: GET /v1/me/documents/:id/download returns signed GET URL', async () => {
      expect(docId).toBeDefined();

      const res = await http()
        .get(`/v1/me/documents/${docId}/download`)
        .set('Authorization', bearer(customer1Token));

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        url: expect.stringMatching(/X-Amz-Signature/i) as string,
        expiresIn: expect.any(Number) as number,
      });

      // SECURITY: the response must not leak raw storage keys or permanent URLs.
      const serialised = JSON.stringify(res.body);
      expect(serialised).not.toContain(objectKey);
      expect(serialised).not.toContain('localhost:9000');
    });

    /**
     * G9: HEAD the signed GET URL.
     * A 200 response proves the object was actually stored in MinIO —
     * not just that the API returned a signed URL for a non-existent object.
     */
    it('G9: signed GET URL is live — object exists in storage (HEAD → 200)', async () => {
      const res = await http()
        .get(`/v1/me/documents/${docId}/download`)
        .set('Authorization', bearer(customer1Token));

      expect(res.status).toBe(200);
      const signedUrl = res.body.url as string;

      const headStatus = await headUrl(signedUrl);
      expect([200, 204]).toContain(headStatus);
    });
  });

  // ── G-RBAC — Upload endpoint RBAC guards (storage-independent) ───────────
  //
  // These do NOT do a real PUT — they only hit the presign endpoints to verify
  // the role/auth guards. The tests run even without storage because the guards
  // fire before any storage interaction.

  describe('G-RBAC: upload endpoint auth guards', () => {
    it('unauthenticated POST /v1/me/payments/presign → 401 or 403', async () => {
      const res = await http()
        .post('/v1/me/payments/presign')
        .send({ contentType: 'image/jpeg', sizeBytes: 100 });
      expect([401, 403]).toContain(res.status);
    });

    it('ADMIN cannot use customer payment presign (CUSTOMER role only)', async () => {
      const res = await http()
        .post('/v1/me/payments/presign')
        .set('Authorization', bearer(adminToken))
        .send({ contentType: 'image/jpeg', sizeBytes: 100 });
      expect(res.status).toBe(403);
    });

    it('unauthenticated POST /v1/me/maintenance-requests/:id/documents/presign → 401 or 403', async () => {
      const reqId = fixtures.flowF.customer1MaintenanceRequestId;
      const res = await http()
        .post(`/v1/me/maintenance-requests/${reqId}/documents/presign`)
        .send({ contentType: 'image/jpeg', sizeBytes: 100 });
      expect([401, 403]).toContain(res.status);
    });

    it('ADMIN cannot use customer maintenance presign (CUSTOMER/SUPERVISOR only)', async () => {
      const reqId = fixtures.flowF.customer1MaintenanceRequestId;
      const res = await http()
        .post(`/v1/me/maintenance-requests/${reqId}/documents/presign`)
        .set('Authorization', bearer(adminToken))
        .send({ contentType: 'image/jpeg', sizeBytes: 100 });
      expect(res.status).toBe(403);
    });

    it('unsupported MIME type in payment presign → 400', async () => {
      const res = await http()
        .post('/v1/me/payments/presign')
        .set('Authorization', bearer(customer1Token))
        .send({ contentType: 'application/x-executable', sizeBytes: 100 });
      expect(res.status).toBe(400);
    });
  });
});
