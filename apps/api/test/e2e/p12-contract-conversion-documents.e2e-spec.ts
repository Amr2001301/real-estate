/**
 * P12 — Contract document linking + customer contract notifications (e2e).
 *
 * Reproduces the manual-QA bug end-to-end against the real DB + real DI graph:
 * an admin converts an APPROVED reservation to a contract while attaching an
 * uploaded file, and the file must become a proper CUSTOMER_VISIBLE Document
 * linked to the contract. We assert, post-conversion:
 *
 *   P12.1  the uploaded file is registered as a Document (ownerType=CONTRACT,
 *          ownerId=contract.id, category=CONTRACT, visibility=CUSTOMER_VISIBLE)
 *          and shows up in the Admin Documents Center (GET /v1/documents).
 *   P12.2  the owning customer's /contracts/me/contracts reports the contract
 *          with hasDocument=true and pdfUrl redacted to null (no permanent URL).
 *   P12.3  the customer can enumerate the document metadata via /me/documents
 *          (no fileUrl leaked) and the signed-download endpoint returns a
 *          short-lived URL (or 503 when storage is unconfigured) — never a
 *          permanent URL. The flow-e suite covers the signing mechanics in
 *          depth; here we prove the converted document plugs into it.
 *   P12.4  customer2 cannot reach customer1's contract document (cross-account
 *          404, no existence leak).
 *   P12.5  the customer receives DB notifications contract_created_customer +
 *          contract_document_available (created without Firebase).
 *
 * The prerequisites (a fresh AVAILABLE unit + an APPROVED reservation owned by
 * customer1) are created directly via Prisma in beforeAll so the suite never
 * mutates a seeded unit other specs rely on.
 */

import request from 'supertest';
import { type TestApp, createTestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';
import { ContractsService } from '../../src/modules/contracts/contracts.module';

describe('P12 — Contract conversion document linking + notifications (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;

  let adminToken: string;
  let customer1Token: string;
  let customer2Token: string;

  let customer1UserId: string;
  let reservationId: string;
  let contractId: string;
  let contractNumber: string;

  // Non-localhost so the documents URL guard accepts it regardless of the e2e
  // storage config. Carries an obvious marker we assert never leaks customer-side.
  const PDF_URL = 'https://r2.example.com/contracts/p12-e2e-converted.pdf';
  const FILE_NAME = 'p12-e2e-converted.pdf';

  beforeAll(async () => {
    testApp = await createTestApp();
    fixtures = await loadE2EFixtures(testApp.prisma);
    const prisma = testApp.prisma;

    [adminToken, customer1Token, customer2Token] = await Promise.all([
      loginAs(testApp.app, 'admin@example.com', process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!'),
      loginAs(testApp.app, fixtures.users.CUSTOMER_1.email, fixtures.users.CUSTOMER_1.password, 'customer'),
      loginAs(testApp.app, fixtures.users.CUSTOMER_2.email, fixtures.users.CUSTOMER_2.password, 'customer'),
    ]);

    customer1UserId = fixtures.userIds.customer1UserId;

    // Fresh AVAILABLE unit under an existing building — conversion flips it to
    // SOLD, so we never touch a seeded unit another spec might read.
    const building = await prisma.building.findFirstOrThrow({ select: { id: true } });
    const unit = await prisma.unit.create({
      data: {
        buildingId: building.id,
        code: `P12-E2E-${Date.now()}`,
        type: '2BR',
        area: 120,
        price: '500000',
        status: 'AVAILABLE',
      },
      select: { id: true },
    });

    // APPROVED reservation owned by customer1 — no plan template (no snapshot /
    // startsAt required) and zero booking amount (no payment gating).
    const reservation = await prisma.reservation.create({
      data: {
        unitId: unit.id,
        salesId: fixtures.userIds.salesId,
        clientId: customer1UserId,
        status: 'APPROVED',
        approvedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        bookingAmount: '0',
      },
      select: { id: true },
    });
    reservationId = reservation.id;

    // Convert through the REAL endpoint with an attached file.
    const res = await request(testApp.app.getHttpServer())
      .post(`/v1/reservations/${reservationId}/convert`)
      .set('Authorization', bearer(adminToken))
      .send({
        pdfUrl: PDF_URL,
        fileName: FILE_NAME,
        mimeType: 'application/pdf',
        sizeBytes: 4096,
      })
      .expect(201);

    contractId = res.body.contractId;
    contractNumber = res.body.contractNumber;
    expect(typeof contractId).toBe('string');
  });

  afterAll(async () => {
    await testApp.close();
  });

  const http = () => request(testApp.app.getHttpServer());

  // ── P12.1 — Document row + Admin Documents Center ────────────────────────

  it('P12.1: the uploaded file becomes a CUSTOMER_VISIBLE CONTRACT Document in the Documents Center', async () => {
    const res = await http()
      .get('/v1/documents')
      .query({ ownerType: 'CONTRACT', ownerId: contractId })
      .set('Authorization', bearer(adminToken))
      .expect(200);

    const docs = res.body.data as Array<Record<string, unknown>>;
    expect(Array.isArray(docs)).toBe(true);
    const doc = docs.find((d) => d.fileUrl === PDF_URL);
    expect(doc).toBeDefined();
    expect(doc).toMatchObject({
      ownerType: 'CONTRACT',
      ownerId: contractId,
      category: 'CONTRACT',
      visibility: 'CUSTOMER_VISIBLE',
      fileName: FILE_NAME,
    });
  });

  // ── P12.2 — Customer contract list: hasDocument flag, pdfUrl redacted ─────

  it('P12.2: customer /contracts/me/contracts shows the contract with hasDocument=true and pdfUrl=null', async () => {
    const res = await http()
      .get('/v1/contracts/me/contracts')
      .query({ pageSize: 100 })
      .set('Authorization', bearer(customer1Token))
      .expect(200);

    const row = (res.body.data as Array<Record<string, unknown>>).find((c) => c.id === contractId);
    expect(row).toBeDefined();
    expect(row!.hasDocument).toBe(true);
    expect(row!.pdfUrl).toBeNull();
    // The permanent storage URL must never appear in the customer payload.
    expect(JSON.stringify(res.body)).not.toContain(PDF_URL);
  });

  // ── P12.3 — Signed-download is the only customer path to the file ─────────

  it('P12.3a: customer /me/documents lists the contract document as metadata only (no fileUrl)', async () => {
    const res = await http()
      .get('/v1/me/documents')
      .query({ ownerType: 'CONTRACT', ownerId: contractId })
      .set('Authorization', bearer(customer1Token))
      .expect(200);

    const docs = res.body as Array<Record<string, unknown>>;
    expect(docs.length).toBeGreaterThan(0);
    const doc = docs[0]!;
    expect(doc).toHaveProperty('id');
    expect(doc).toHaveProperty('fileName', FILE_NAME);
    expect(doc).not.toHaveProperty('fileUrl');
    expect(JSON.stringify(res.body)).not.toContain(PDF_URL);
  });

  it('P12.3b: customer signed-download returns a short-lived URL (or 503 when storage unset) — never the permanent URL', async () => {
    const list = await http()
      .get('/v1/me/documents')
      .query({ ownerType: 'CONTRACT', ownerId: contractId })
      .set('Authorization', bearer(customer1Token))
      .expect(200);
    const docId = (list.body as Array<{ id: string }>)[0]!.id;

    const res = await http()
      .get(`/v1/me/documents/${docId}/download`)
      .set('Authorization', bearer(customer1Token));

    expect([200, 503]).toContain(res.status);
    // The raw permanent URL is never echoed back, in either branch.
    expect(JSON.stringify(res.body)).not.toContain(PDF_URL);
    if (res.status === 200) {
      expect(typeof res.body.url).toBe('string');
      expect(res.body).toHaveProperty('expiresIn');
    }
  });

  // ── P12.4 — Cross-account isolation ──────────────────────────────────────

  it('P12.4: customer2 cannot enumerate customer1\'s contract document (404, no existence leak)', async () => {
    await http()
      .get('/v1/me/documents')
      .query({ ownerType: 'CONTRACT', ownerId: contractId })
      .set('Authorization', bearer(customer2Token))
      .expect(404);
  });

  // ── P12.5 — DB notifications (no Firebase) ────────────────────────────────

  it('P12.5: customer received contract_created_customer + contract_document_available notifications', async () => {
    const rows = await testApp.prisma.notification.findMany({
      where: {
        userId: customer1UserId,
        templateCode: { in: ['contract_created_customer', 'contract_document_available'] },
        payload: { path: ['contractId'], equals: contractId },
      },
      select: { templateCode: true, payload: true },
    });
    const codes = rows.map((r) => r.templateCode);
    expect(codes).toContain('contract_created_customer');
    expect(codes).toContain('contract_document_available');
    // Safe payload only — no file URL / key leaks into the notification.
    expect(JSON.stringify(rows)).not.toContain(PDF_URL);
  });

  // ── P12 legacy backfill — repair pre-P12 contracts (pdfUrl, no Document) ──

  describe('Legacy backfill (pre-P12 contracts)', () => {
    // A contract whose row predates P12: pdfUrl is set but NO Document exists.
    const LEGACY_PDF_URL = 'https://r2.example.com/contracts/legacy/p12-backfill-old.pdf';
    let legacyContractId: string;
    let contractsService: ContractsService;

    beforeAll(async () => {
      const prisma = testApp.prisma;
      contractsService = testApp.app.get(ContractsService);

      const building = await prisma.building.findFirstOrThrow({ select: { id: true } });
      const unit = await prisma.unit.create({
        data: {
          buildingId: building.id,
          code: `P12-LEGACY-${Date.now()}`,
          type: '2BR',
          area: 110,
          price: '400000',
          status: 'SOLD',
        },
        select: { id: true },
      });
      // Simulate the pre-P12 state directly: contract WITH pdfUrl, WITHOUT any
      // Document row (the bug the backfill repairs).
      const contract = await prisma.contract.create({
        data: {
          customerId: customer1UserId,
          unitId: unit.id,
          totalAmount: '400000',
          downPayment: '0',
          pdfUrl: LEGACY_PDF_URL,
        },
        select: { id: true },
      });
      legacyContractId = contract.id;
    });

    const countContractDocs = () =>
      testApp.prisma.document.count({
        where: {
          ownerType: 'CONTRACT',
          ownerId: legacyContractId,
          category: 'CONTRACT',
          deletedAt: null,
        },
      });

    it('precondition: legacy contract has pdfUrl but no Document and reads hasDocument=false', async () => {
      expect(await countContractDocs()).toBe(0);
      const res = await http()
        .get('/v1/contracts/me/contracts')
        .query({ pageSize: 100 })
        .set('Authorization', bearer(customer1Token))
        .expect(200);
      const row = (res.body.data as Array<Record<string, unknown>>).find((c) => c.id === legacyContractId);
      expect(row).toBeDefined();
      expect(row!.hasDocument).toBe(false);
      expect(row!.pdfUrl).toBeNull();
    });

    it('dry-run reports would-create and writes nothing', async () => {
      const result = await contractsService.backfillContractDocument(
        { id: legacyContractId, contractNumber: null, pdfUrl: LEGACY_PDF_URL },
        { dryRun: true },
      );
      expect(result).toBe('would-create');
      expect(await countContractDocs()).toBe(0);
    });

    it('execute registers a CUSTOMER_VISIBLE CONTRACT document visible in the Documents Center', async () => {
      const result = await contractsService.backfillContractDocument(
        { id: legacyContractId, contractNumber: null, pdfUrl: LEGACY_PDF_URL },
        { dryRun: false },
      );
      expect(result).toBe('created');

      const res = await http()
        .get('/v1/documents')
        .query({ ownerType: 'CONTRACT', ownerId: legacyContractId })
        .set('Authorization', bearer(adminToken))
        .expect(200);
      const doc = (res.body.data as Array<Record<string, unknown>>).find((d) => d.fileUrl === LEGACY_PDF_URL);
      expect(doc).toBeDefined();
      expect(doc).toMatchObject({
        ownerType: 'CONTRACT',
        ownerId: legacyContractId,
        category: 'CONTRACT',
        visibility: 'CUSTOMER_VISIBLE',
      });
    });

    it('repaired: /me/contracts now reports hasDocument=true, pdfUrl=null, no permanent URL', async () => {
      const res = await http()
        .get('/v1/contracts/me/contracts')
        .query({ pageSize: 100 })
        .set('Authorization', bearer(customer1Token))
        .expect(200);
      const row = (res.body.data as Array<Record<string, unknown>>).find((c) => c.id === legacyContractId);
      expect(row!.hasDocument).toBe(true);
      expect(row!.pdfUrl).toBeNull();
      expect(JSON.stringify(res.body)).not.toContain(LEGACY_PDF_URL);
    });

    it('customer signed-download works for the repaired doc (200 url or 503) — never the permanent URL', async () => {
      const list = await http()
        .get('/v1/me/documents')
        .query({ ownerType: 'CONTRACT', ownerId: legacyContractId })
        .set('Authorization', bearer(customer1Token))
        .expect(200);
      const docId = (list.body as Array<{ id: string }>)[0]!.id;

      const res = await http()
        .get(`/v1/me/documents/${docId}/download`)
        .set('Authorization', bearer(customer1Token));
      expect([200, 503]).toContain(res.status);
      expect(JSON.stringify(res.body)).not.toContain(LEGACY_PDF_URL);
    });

    it('customer2 cannot reach the repaired document (404, no existence leak)', async () => {
      await http()
        .get('/v1/me/documents')
        .query({ ownerType: 'CONTRACT', ownerId: legacyContractId })
        .set('Authorization', bearer(customer2Token))
        .expect(404);
    });

    it('is idempotent: a second execute is a no-op (still exactly one document)', async () => {
      const result = await contractsService.backfillContractDocument(
        { id: legacyContractId, contractNumber: null, pdfUrl: LEGACY_PDF_URL },
        { dryRun: false },
      );
      expect(result).toBe('exists');
      expect(await countContractDocs()).toBe(1);
    });
  });
});
