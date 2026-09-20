/**
 * Merged e2e group 4: Flow-F + Flow-F-Supervisor + Flow-G + deposit-race + reservation-race
 *
 * All specs share the singleton NestJS app (createE2ETestApp). Race conditions
 * are placed last so they don't interfere with earlier test state.
 * Flow-G wraps all its tests in describeIfStorage — skipped when storage is unavailable.
 */

import request from 'supertest';
import {
  InstallmentStatus,
  MaintenanceStatus,
  ReservationStatus,
  UnitStatus,
} from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

// ── Shared helpers ─────────────────────────────────────────────────────────────

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

// ── Flow G helpers + skip condition ───────────────────────────────────────────

const STORAGE_AVAILABLE = !!(process.env.S3_ENDPOINT ?? process.env.R2_ACCOUNT_ID);
const TINY_JPEG = Buffer.from('FFD8FFE000104A46494600010100000100010000FFD9', 'hex');
const describeIfStorage = STORAGE_AVAILABLE ? describe : describe.skip;

async function headUrl(url: string): Promise<number> {
  const res = await fetch(url, { method: 'HEAD', redirect: 'manual' });
  return res.status;
}

async function putToPresignedUrl(url: string, body: Buffer, contentType: string): Promise<number> {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body,
  });
  return res.status;
}

// ═════════════════════════════════════════════════════════════════════════════
// Flow F — Maintenance with photos (e2e)
// ═════════════════════════════════════════════════════════════════════════════

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

  describe('F1/F2: customer creates and lists their own request', () => {
    let createdRequestId: string;

    it('F1: customer1 POST /v1/me/maintenance-requests → 201', async () => {
      const cat = await testApp.rawPrisma.maintenanceCategory.findFirstOrThrow({
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
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

  it('F3: customer2 GET /v1/me/maintenance-requests/:c1Req → 404 (no existence leak)', async () => {
    const res = await http()
      .get(`/v1/me/maintenance-requests/${fixtures.flowF.customer1MaintenanceRequestId}`)
      .set('Authorization', bearer(customer2Token));
    expect(res.status).toBe(404);
  });

  it('F4: admin GET /v1/maintenance-requests includes customer1\'s seeded request', async () => {
    const res = await http()
      .get('/v1/maintenance-requests')
      .set('Authorization', bearer(adminToken));
    expect(res.status).toBe(200);
    expect(collectIds(res.body)).toContain(fixtures.flowF.customer1MaintenanceRequestId);
  });

  it('F5: presign returns {uploadUrl, key, publicUrl} with a signature OR 503 when R2 unset', async () => {
    const res = await http()
      .post(
        `/v1/me/maintenance-requests/${fixtures.flowF.customer1MaintenanceRequestId}/documents/presign`,
      )
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

  it('F7: customer1 detail of the seeded request lists the CUSTOMER_VISIBLE photo', async () => {
    const res = await http()
      .get('/v1/me/documents')
      .query({
        ownerType: 'MAINTENANCE_REQUEST',
        ownerId: fixtures.flowF.customer1MaintenanceRequestId,
      })
      .set('Authorization', bearer(customer1Token));
    expect(res.status).toBe(200);
    expect(collectIds(res.body)).toContain(fixtures.flowF.customer1MaintenancePhotoDocId);
  });

  it('F_SECURITY: GET /v1/me/maintenance-requests/:id returns documents with NO fileUrl', async () => {
    const res = await http()
      .get(`/v1/me/maintenance-requests/${fixtures.flowF.customer1MaintenanceRequestId}`)
      .set('Authorization', bearer(customer1Token));
    expect(res.status).toBe(200);
    const docs = Array.isArray(res.body?.documents) ? res.body.documents : [];
    expect(docs.length).toBeGreaterThan(0);
    for (const d of docs) {
      expect('fileUrl' in d).toBe(false);
    }
    expect(JSON.stringify(res.body)).not.toContain('maintenance/e2e/customer1-photo-1.jpg');
  });

  it('F8: customer2 GET /v1/me/documents/:c1Photo/download → 404', async () => {
    const res = await http()
      .get(`/v1/me/documents/${fixtures.flowF.customer1MaintenancePhotoDocId}/download`)
      .set('Authorization', bearer(customer2Token));
    expect(res.status).toBe(404);
  });

  describe('F9: RBAC negatives on the maintenance surface', () => {
    it('GET /v1/me/maintenance-requests without token → 401', async () => {
      expect((await http().get('/v1/me/maintenance-requests')).status).toBe(401);
    });
    it('POST /v1/me/maintenance-requests as SALES → 403', async () => {
      expect(
        (
          await http()
            .post('/v1/me/maintenance-requests')
            .set('Authorization', bearer(salesToken))
            .send({})
        ).status,
      ).toBe(403);
    });
    it('GET /v1/maintenance-requests as BROKER → 403', async () => {
      expect(
        (
          await http()
            .get('/v1/maintenance-requests')
            .set('Authorization', bearer(broker1Token))
        ).status,
      ).toBe(403);
    });
    it('GET /v1/maintenance-requests as CUSTOMER → 403 (admin-only)', async () => {
      expect(
        (
          await http()
            .get('/v1/maintenance-requests')
            .set('Authorization', bearer(customer1Token))
        ).status,
      ).toBe(403);
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Flow F — Maintenance supervisor status machine (e2e)
// ═════════════════════════════════════════════════════════════════════════════

describe('Flow F — Maintenance supervisor status machine (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;

  let supervisorToken: string;
  let customer1Token: string;
  let salesToken: string;

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);

    [supervisorToken, customer1Token, salesToken] = await Promise.all([
      loginAs(testApp.app, 'maintenance@example.com', 'MaintenancePass123!'),
      loginAs(testApp.app, fixtures.users.CUSTOMER_1.email, fixtures.users.CUSTOMER_1.password, 'customer'),
      loginAs(testApp.app, 'sales@example.com', 'SalesPass123!'),
    ]);
  });

  const http = () => request(testApp.app.getHttpServer());
  const reqId = () => fixtures.flowF.customer1MaintenanceRequestId;

  it('F_SUP1: supervisor GET /v1/me/maintenance-requests includes the assigned request', async () => {
    const res = await http()
      .get('/v1/me/maintenance-requests')
      .set('Authorization', bearer(supervisorToken));
    expect(res.status).toBe(200);
    const list = Array.isArray(res.body) ? res.body : res.body?.data ?? [];
    const ids = list
      .map((r: { id?: string }) => r.id)
      .filter((x: unknown): x is string => typeof x === 'string');
    expect(ids).toContain(reqId());
  });

  it('F_SUP2: supervisor POST .../status IN_PROGRESS → 201, status flipped in DB', async () => {
    const res = await http()
      .post(`/v1/me/maintenance-requests/${reqId()}/status`)
      .set('Authorization', bearer(supervisorToken))
      .send({ status: 'IN_PROGRESS' });
    expect(res.status).toBe(201);

    const row = await testApp.rawPrisma.maintenanceRequest.findUniqueOrThrow({
      where: { id: reqId() },
      select: { status: true },
    });
    expect(row.status).toBe(MaintenanceStatus.IN_PROGRESS);
  });

  it('F_SUP3: customer GET /v1/me/maintenance-requests/:id sees status=IN_PROGRESS', async () => {
    const res = await http()
      .get(`/v1/me/maintenance-requests/${reqId()}`)
      .set('Authorization', bearer(customer1Token));
    expect(res.status).toBe(200);
    expect(res.body?.status).toBe('IN_PROGRESS');
  });

  it('F_SUP4: supervisor POST .../status RESOLVED → 201, status flipped', async () => {
    const res = await http()
      .post(`/v1/me/maintenance-requests/${reqId()}/status`)
      .set('Authorization', bearer(supervisorToken))
      .send({ status: 'RESOLVED' });
    expect(res.status).toBe(201);

    const row = await testApp.rawPrisma.maintenanceRequest.findUniqueOrThrow({
      where: { id: reqId() },
      select: { status: true },
    });
    expect(row.status).toBe(MaintenanceStatus.RESOLVED);
  });

  it('F_SUP5: customer detail now shows status=RESOLVED', async () => {
    const res = await http()
      .get(`/v1/me/maintenance-requests/${reqId()}`)
      .set('Authorization', bearer(customer1Token));
    expect(res.status).toBe(200);
    expect(res.body?.status).toBe('RESOLVED');
  });

  it('F_SUP_NEG: supervisor RESOLVED → CLOSED is rejected (admin-only transition)', async () => {
    const res = await http()
      .post(`/v1/me/maintenance-requests/${reqId()}/status`)
      .set('Authorization', bearer(supervisorToken))
      .send({ status: 'CLOSED' });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);

    const row = await testApp.rawPrisma.maintenanceRequest.findUniqueOrThrow({
      where: { id: reqId() },
      select: { status: true },
    });
    expect(row.status).toBe(MaintenanceStatus.RESOLVED);
  });

  describe('F_SUP_RBAC: wrong roles cannot call the supervisor status endpoint', () => {
    it('SALES POST .../status → 403', async () => {
      const res = await http()
        .post(`/v1/me/maintenance-requests/${reqId()}/status`)
        .set('Authorization', bearer(salesToken))
        .send({ status: 'IN_PROGRESS' });
      expect(res.status).toBe(403);
    });
    it('CUSTOMER POST .../status → 403', async () => {
      const res = await http()
        .post(`/v1/me/maintenance-requests/${reqId()}/status`)
        .set('Authorization', bearer(customer1Token))
        .send({ status: 'IN_PROGRESS' });
      expect(res.status).toBe(403);
    });
    it('no token POST .../status → 401', async () => {
      const res = await http()
        .post(`/v1/me/maintenance-requests/${reqId()}/status`)
        .send({ status: 'IN_PROGRESS' });
      expect(res.status).toBe(401);
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Flow G — Mobile upload flows (e2e) — skipped when storage unavailable
// ═════════════════════════════════════════════════════════════════════════════

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

  describe('G-PROOF: payment proof upload', () => {
    let uploadUrl: string;
    let objectKey: string;

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

    it('G2: PUT to presigned URL stores the file (MinIO returns 200)', async () => {
      expect(uploadUrl).toBeDefined();
      const status = await putToPresignedUrl(uploadUrl, TINY_JPEG, 'image/jpeg');
      expect([200, 204]).toContain(status);
    });

    it('G3: Admin POST /v1/deposits/:id/receipt attaches the file', async () => {
      expect(objectKey).toBeDefined();
      const depositId = fixtures.flowE.customer1DepositId;

      const res = await http()
        .post(`/v1/deposits/${depositId}/receipt`)
        .set('Authorization', bearer(adminToken))
        .send({ receiptUrl: objectKey });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ id: depositId });
    });

    it('G4: Admin GET /v1/deposits/:id/proof/download → signed URL is live', async () => {
      const depositId = fixtures.flowE.customer1DepositId;

      const res = await http()
        .get(`/v1/deposits/${depositId}/proof/download`)
        .set('Authorization', bearer(adminToken));

      expect(res.status).toBe(200);
      expect(typeof res.body.url).toBe('string');
      expect(res.body.url).toMatch(/X-Amz-Signature/i);
      expect(typeof res.body.expiresIn).toBe('number');

      const headStatus = await headUrl(res.body.url as string);
      expect([200, 204]).toContain(headStatus);
    });
  });

  describe('G-MAINT: maintenance document upload', () => {
    const MAINT_CONTENT_TYPE = 'image/jpeg';
    let uploadUrl: string;
    let objectKey: string;
    let docId: string;

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

    it('G6: PUT to presigned URL stores the maintenance photo (MinIO returns 200)', async () => {
      expect(uploadUrl).toBeDefined();
      const status = await putToPresignedUrl(uploadUrl, TINY_JPEG, MAINT_CONTENT_TYPE);
      expect([200, 204]).toContain(status);
    });

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

      const serialised = JSON.stringify(res.body);
      expect(serialised).not.toContain(objectKey);
      expect(serialised).not.toContain('localhost:9000');
    });

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

// ═════════════════════════════════════════════════════════════════════════════
// Deposit installment race condition (e2e)
// ═════════════════════════════════════════════════════════════════════════════

const DEPOSIT_RACE_ITERATIONS = 8;
const INSTALLMENT_AMOUNT = 50_000;

describe('Deposit installment race condition — real Postgres concurrency proof (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  let contractId: string;
  let planId: string;
  let testCompanyId: string;

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    adminToken = await loginAs(
      testApp.app,
      'admin@example.com',
      process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!',
    );

    const company = await testApp.rawPrisma.company.findFirstOrThrow({
      where: { isActive: true },
      select: { id: true },
    });
    testCompanyId = company.id;

    const building = await testApp.rawPrisma.building.findFirstOrThrow({
      where: { phase: { projectId: fixtures.projects.p1Id } },
      select: { id: true },
    });

    const unit = await testApp.rawPrisma.unit.create({
      data: {
        buildingId: building.id,
        companyId: testCompanyId,
        code: `DEP-RACE-UNIT-${Date.now()}`,
        type: '2BR',
        area: 100,
        price: 1_000_000,
        status: UnitStatus.SOLD,
      },
      select: { id: true },
    });

    const contract = await testApp.rawPrisma.contract.create({
      data: {
        companyId: testCompanyId,
        customerId: fixtures.userIds.customer1UserId,
        unitId: unit.id,
        totalAmount: 1_000_000,
        downPayment: 200_000,
      },
      select: { id: true },
    });
    contractId = contract.id;

    const plan = await testApp.rawPrisma.installmentPlan.create({
      data: {
        companyId: testCompanyId,
        contractId,
        totalMonths: 12,
        monthlyAmount: INSTALLMENT_AMOUNT,
        startsAt: new Date('2026-01-01'),
      },
      select: { id: true },
    });
    planId = plan.id;
  }, 60_000);

  const http = () => request(testApp.app.getHttpServer());

  async function createFreshInstallment(index: number): Promise<string> {
    const month = String((index % 12) + 1).padStart(2, '0');
    const installment = await testApp.rawPrisma.installment.create({
      data: {
        companyId: testCompanyId,
        planId,
        type: 'INSTALLMENT',
        dueDate: new Date(`2026-${month}-01`),
        amount: INSTALLMENT_AMOUNT,
        status: InstallmentStatus.PENDING,
      },
      select: { id: true },
    });
    return installment.id;
  }

  for (let i = 0; i < DEPOSIT_RACE_ITERATIONS; i++) {
    const iteration = i + 1;
    it(
      `[${iteration}/${DEPOSIT_RACE_ITERATIONS}] concurrent deposits: one 201 + one 409, one deposit row`,
      async () => {
        const installmentId = await createFreshInstallment(i);

        const body = { contractId, installmentId, amount: INSTALLMENT_AMOUNT, paidAt: '2026-01-15T10:00:00Z' };

        const [r1, r2] = await Promise.allSettled([
          http().post('/v1/deposits').set('Authorization', bearer(adminToken)).send(body),
          http().post('/v1/deposits').set('Authorization', bearer(adminToken)).send(body),
        ]);

        const s1 = r1.status === 'fulfilled' ? r1.value.status : 500;
        const s2 = r2.status === 'fulfilled' ? r2.value.status : 500;
        expect([s1, s2].sort()).toEqual([201, 409]);

        const [installment, deposits] = await Promise.all([
          testApp.rawPrisma.installment.findUniqueOrThrow({
            where: { id: installmentId },
            select: { status: true },
          }),
          testApp.rawPrisma.deposit.findMany({ where: { installmentId }, select: { id: true } }),
        ]);

        expect(installment.status).toBe(InstallmentStatus.PAID);
        expect(deposits).toHaveLength(1);
      },
      30_000,
    );
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// Unit reservation race condition (e2e)
// ═════════════════════════════════════════════════════════════════════════════

const RESERVATION_RACE_ITERATIONS = 8;

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

    const company = await testApp.rawPrisma.company.findFirstOrThrow({
      where: { isActive: true },
      select: { id: true },
    });
    testCompanyId = company.id;

    const building = await testApp.rawPrisma.building.findFirstOrThrow({
      where: { phase: { projectId: fixtures.projects.p1Id } },
      select: { id: true },
    });
    buildingId = building.id;
  }, 60_000);

  const http = () => request(testApp.app.getHttpServer());

  async function createFreshUnit(iteration: number): Promise<string> {
    const unit = await testApp.rawPrisma.unit.create({
      data: {
        buildingId,
        companyId: testCompanyId,
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

  for (let i = 0; i < RESERVATION_RACE_ITERATIONS; i++) {
    const iteration = i + 1;
    it(
      `[${iteration}/${RESERVATION_RACE_ITERATIONS}] concurrent claims: one 201 + one 409, one reservation row`,
      async () => {
        const unitId = await createFreshUnit(i);

        const body = {
          unitId,
          clientId: fixtures.userIds.customer1UserId,
          expiresInHours: 72,
        };

        const [r1, r2] = await Promise.allSettled([
          http().post('/v1/reservations').set('Authorization', bearer(salesToken)).send(body),
          http().post('/v1/reservations').set('Authorization', bearer(salesToken)).send(body),
        ]);

        const s1 = r1.status === 'fulfilled' ? r1.value.status : 500;
        const s2 = r2.status === 'fulfilled' ? r2.value.status : 500;
        expect([s1, s2].sort()).toEqual([201, 409]);

        const [unit, reservations, statusHistory] = await Promise.all([
          testApp.rawPrisma.unit.findUniqueOrThrow({ where: { id: unitId }, select: { status: true } }),
          testApp.rawPrisma.reservation.findMany({ where: { unitId }, select: { id: true, status: true } }),
          testApp.rawPrisma.unitStatusHistory.findMany({
            where: { unitId },
            select: { id: true, oldStatus: true, newStatus: true },
          }),
        ]);

        expect(unit.status).toBe(UnitStatus.RESERVED);
        expect(reservations).toHaveLength(1);
        expect(reservations[0]!.status).toBe(ReservationStatus.PENDING);
        expect(statusHistory).toHaveLength(1);
        expect(statusHistory[0]!.oldStatus).toBe(UnitStatus.AVAILABLE);
        expect(statusHistory[0]!.newStatus).toBe(UnitStatus.RESERVED);
      },
      30_000,
    );
  }
});
