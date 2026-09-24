/**
 * Merged e2e group 3: Flow-E + P11 + P13
 *
 * All three specs share the singleton NestJS app (createE2ETestApp).
 * Each describe block has its own beforeAll so setup is self-contained.
 */

import request from 'supertest';
import * as argon2 from 'argon2';
import {
  DepositReviewStatus,
  DocumentCategory,
  DocumentOwnerType,
  DocumentVisibility,
  InstallmentStatus,
  PaymentMethod,
  PlanPaymentType,
  Prisma,
  UserRole,
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

// ═════════════════════════════════════════════════════════════════════════════
// Flow E — Customer financial + signed documents (e2e)
// ═════════════════════════════════════════════════════════════════════════════

describe('Flow E — Customer financial + signed documents (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;

  let salesToken: string;
  let broker1Token: string;
  let clientToken: string;
  let customer1Token: string;
  let customer2Token: string;

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);

    [salesToken, broker1Token, clientToken, customer1Token, customer2Token] = await Promise.all([
      loginAs(testApp.app, 'sales@example.com', 'SalesPass123!'),
      loginAs(testApp.app, fixtures.users.BROKER_1.email, fixtures.users.BROKER_1.password),
      loginAs(testApp.app, fixtures.users.CLIENT_1.email, fixtures.users.CLIENT_1.password, 'customer'),
      loginAs(testApp.app, fixtures.users.CUSTOMER_1.email, fixtures.users.CUSTOMER_1.password, 'customer'),
      loginAs(testApp.app, fixtures.users.CUSTOMER_2.email, fixtures.users.CUSTOMER_2.password, 'customer'),
    ]);
  });

  const http = () => request(testApp.app.getHttpServer());

  it('E1: customer1 GET /v1/me/deposits returns their seeded deposit', async () => {
    const res = await http()
      .get('/v1/me/deposits')
      .set('Authorization', bearer(customer1Token));
    expect(res.status).toBe(200);
    expect(collectIds(res.body)).toContain(fixtures.flowE.customer1DepositId);
  });

  it('E2: customer1 GET /v1/contracts/me/contracts returns their seeded contract', async () => {
    const res = await http()
      .get('/v1/contracts/me/contracts')
      .set('Authorization', bearer(customer1Token));
    expect(res.status).toBe(200);
    expect(collectIds(res.body)).toContain(fixtures.flowE.customer1ContractId);
  });

  it('E3: customer1 GET /v1/me/documents?ownerType=CONTRACT&ownerId=… returns their CUSTOMER_VISIBLE PDF', async () => {
    const res = await http()
      .get('/v1/me/documents')
      .query({ ownerType: 'CONTRACT', ownerId: fixtures.flowE.customer1ContractId })
      .set('Authorization', bearer(customer1Token));
    expect(res.status).toBe(200);
    expect(collectIds(res.body)).toContain(fixtures.flowE.customer1ContractDocId);
  });

  it('E4: signed-download for customer1\'s contract PDF returns {url, expiresIn} OR 503 when R2 unset', async () => {
    const res = await http()
      .get(`/v1/me/documents/${fixtures.flowE.customer1ContractDocId}/download`)
      .set('Authorization', bearer(customer1Token));
    expect([200, 503]).toContain(res.status);
    if (res.status === 200) {
      expect(typeof res.body?.url).toBe('string');
      expect(typeof res.body?.expiresIn).toBe('number');
      expect(res.body.expiresIn).toBeGreaterThan(0);
      expect(res.body.expiresIn).toBeLessThanOrEqual(300);
    }
  });

  it('E5: signed-download returns a presigned URL, not the raw storage key (or 503 if storage unset)', async () => {
    const res = await http()
      .get(`/v1/me/documents/${fixtures.flowE.customer1ContractDocId}/download`)
      .set('Authorization', bearer(customer1Token));
    expect([200, 503]).toContain(res.status);
    if (res.status === 200) {
      const url: string = res.body.url;
      // Verify the API generates a presigned URL, not just echoing the raw stored key.
      // Presigned URLs embed the key in the path so not.toContain(key) can never hold;
      // the meaningful check is that the URL is a proper signed URL (not.toEqual the key).
      expect(url).toContain('X-Amz-Signature');
      expect(url).not.toEqual('contracts/e2e/customer1-contract.pdf');
    }
  });

  describe('E6/E7: customer1 cannot reach customer2\'s document via either path', () => {
    it('E6: GET /v1/me/documents for customer2\'s contract → 404 (or empty)', async () => {
      const res = await http()
        .get('/v1/me/documents')
        .query({ ownerType: 'CONTRACT', ownerId: fixtures.flowE.customer2ContractId })
        .set('Authorization', bearer(customer1Token));
      expect([200, 404]).toContain(res.status);
      if (res.status === 200) {
        expect(collectIds(res.body)).not.toContain(fixtures.flowE.customer2ContractDocId);
      }
    });

    it('E7: GET /v1/me/documents/:c2DocId/download → 404 (no existence leak)', async () => {
      const res = await http()
        .get(`/v1/me/documents/${fixtures.flowE.customer2ContractDocId}/download`)
        .set('Authorization', bearer(customer1Token));
      expect(res.status).toBe(404);
    });
  });

  it('E8: customer1 /me/deposits never includes customer2\'s deposits', async () => {
    const res = await http()
      .get('/v1/me/deposits')
      .set('Authorization', bearer(customer1Token));
    expect(res.status).toBe(200);
    const list = Array.isArray(res.body) ? res.body : res.body?.data ?? [];
    for (const row of list) {
      if (!row || typeof row !== 'object') continue;
      const contractId: unknown = row.contractId ?? row.contract?.id;
      if (typeof contractId !== 'string') continue;
      const owner = await testApp.rawPrisma.contract.findUnique({
        where: { id: contractId },
        select: { customerId: true },
      });
      expect(owner?.customerId).toBe(fixtures.userIds.customer1UserId);
    }
  });

  describe('E9: RBAC negatives on the customer financial surface', () => {
    it('GET /v1/me/deposits without token → 401', async () => {
      expect((await http().get('/v1/me/deposits')).status).toBe(401);
    });
    it('GET /v1/contracts/me/contracts without token → 401', async () => {
      expect((await http().get('/v1/contracts/me/contracts')).status).toBe(401);
    });
    it('GET /v1/me/deposits as SALES → 403 (customer-only)', async () => {
      expect(
        (await http().get('/v1/me/deposits').set('Authorization', bearer(salesToken))).status,
      ).toBe(403);
    });
    it('GET /v1/contracts/me/contracts as BROKER → 403', async () => {
      expect(
        (
          await http()
            .get('/v1/contracts/me/contracts')
            .set('Authorization', bearer(broker1Token))
        ).status,
      ).toBe(403);
    });
    it('GET /v1/contracts/me/contracts as CLIENT → 403 (these endpoints are CUSTOMER-only)', async () => {
      expect(
        (
          await http()
            .get('/v1/contracts/me/contracts')
            .set('Authorization', bearer(clientToken))
        ).status,
      ).toBe(403);
    });
    it('GET /v1/me/documents as SALES → 403', async () => {
      expect(
        (
          await http()
            .get('/v1/me/documents')
            .query({ ownerType: 'CONTRACT', ownerId: fixtures.flowE.customer1ContractId })
            .set('Authorization', bearer(salesToken))
        ).status,
      ).toBe(403);
    });
  });

  it('E_SECURITY1: /v1/contracts/me/contracts never returns a non-null pdfUrl', async () => {
    const res = await http()
      .get('/v1/contracts/me/contracts')
      .set('Authorization', bearer(customer1Token));
    expect(res.status).toBe(200);
    const list = Array.isArray(res.body) ? res.body : res.body?.data ?? [];
    expect(list.length).toBeGreaterThan(0);
    for (const row of list) {
      expect(row.pdfUrl ?? null).toBeNull();
    }
    expect(JSON.stringify(res.body)).not.toContain('contracts/e2e/customer1-contract.pdf');
  });

  it('E_SECURITY2: /v1/me/deposits never returns a non-null receiptUrl', async () => {
    const res = await http()
      .get('/v1/me/deposits')
      .set('Authorization', bearer(customer1Token));
    expect(res.status).toBe(200);
    const list = Array.isArray(res.body) ? res.body : res.body?.data ?? [];
    expect(list.length).toBeGreaterThan(0);
    for (const row of list) {
      expect(row.receiptUrl ?? null).toBeNull();
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// P11 — Payment-proof review (e2e)
// ═════════════════════════════════════════════════════════════════════════════

describe('P11 — Payment-proof review (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;

  let adminToken: string;
  let customer1Token: string;

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    [adminToken, customer1Token] = await Promise.all([
      loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!'),
      loginAs(testApp.app, fixtures.users.CUSTOMER_1.email, fixtures.users.CUSTOMER_1.password, 'customer'),
    ]);
  });

  const http = () => request(testApp.app.getHttpServer());

  let p11Customer1Id: string;
  let p11Customer2Id: string;
  let p11Customer1Token: string;
  let p11Customer2Token: string;
  let p11ContractId: string;
  let p11InstallmentId: string;
  let p11InstallmentAmount: number;
  let p11OtherInstallmentId: string;

  beforeAll(async () => {
    const company = await testApp.rawPrisma.company.findFirstOrThrow({
      where: { isActive: true },
      select: { id: true },
    });
    const testCompanyId = company.id;

    const passwordHash = await argon2.hash('StrongPass1!');
    const base = `+96650${process.hrtime.bigint().toString().slice(-8)}`;
    const [c1, c2] = await testApp.rawPrisma.$transaction([
      testApp.rawPrisma.user.create({
        data: {
          companyId: testCompanyId,
          role: UserRole.CUSTOMER,
          fullName: 'P11 Customer A',
          email: `p11-c1-${base.slice(-8)}@example.com`,
          phone: `${base}1`,
          passwordHash,
          locale: 'ar',
        },
        select: { id: true, email: true },
      }),
      testApp.rawPrisma.user.create({
        data: {
          companyId: testCompanyId,
          role: UserRole.CUSTOMER,
          fullName: 'P11 Customer B',
          email: `p11-c2-${base.slice(-8)}@example.com`,
          phone: `${base}2`,
          passwordHash,
          locale: 'ar',
        },
        select: { id: true, email: true },
      }),
    ]);
    p11Customer1Id = c1.id;
    p11Customer2Id = c2.id;

    [p11Customer1Token, p11Customer2Token] = await Promise.all([
      testApp.signAccessToken(c1.id, UserRole.CUSTOMER, '15m'),
      testApp.signAccessToken(c2.id, UserRole.CUSTOMER, '15m'),
    ]);

    const unit = await testApp.rawPrisma.unit.findFirstOrThrow({
      where: { NOT: { building: { phase: { projectId: fixtures.projects.p1Id } } } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true },
    });
    const contract = await testApp.rawPrisma.contract.create({
      data: {
        companyId: testCompanyId,
        contractNumber: `P11-CON-${Date.now()}`,
        customerId: c1.id,
        unitId: unit.id,
        totalAmount: new Prisma.Decimal(1_000_000),
        downPayment: new Prisma.Decimal(100_000),
      },
      select: { id: true },
    });
    p11ContractId = contract.id;
    const plan = await testApp.rawPrisma.installmentPlan.create({
      data: {
        companyId: testCompanyId,
        contractId: contract.id,
        totalMonths: 12,
        monthlyAmount: new Prisma.Decimal(75_000),
        startsAt: new Date('2026-06-01T00:00:00Z'),
      },
      select: { id: true },
    });
    p11InstallmentAmount = 75_000;
    const [i1, i2] = await testApp.rawPrisma.$transaction([
      testApp.rawPrisma.installment.create({
        data: {
          companyId: testCompanyId,
          planId: plan.id,
          type: PlanPaymentType.INSTALLMENT,
          amount: new Prisma.Decimal(p11InstallmentAmount),
          dueDate: new Date('2026-07-01T00:00:00Z'),
          status: InstallmentStatus.PENDING,
        },
        select: { id: true },
      }),
      testApp.rawPrisma.installment.create({
        data: {
          companyId: testCompanyId,
          planId: plan.id,
          type: PlanPaymentType.INSTALLMENT,
          amount: new Prisma.Decimal(p11InstallmentAmount),
          dueDate: new Date('2026-08-01T00:00:00Z'),
          status: InstallmentStatus.PENDING,
        },
        select: { id: true },
      }),
    ]);
    p11InstallmentId = i1.id;
    p11OtherInstallmentId = i2.id;
  });

  describe('Customer submits a payment proof', () => {
    let p11DepositId: string;

    it('P11.1: customer submits proof → PENDING_REVIEW + proofDocumentId set', async () => {
      const res = await http()
        .post('/v1/me/deposits')
        .set('Authorization', bearer(p11Customer1Token))
        .send({
          installmentId: p11InstallmentId,
          amount: p11InstallmentAmount,
          paidAt: '2026-07-01T00:00:00Z',
          paymentMethod: PaymentMethod.BANK_TRANSFER,
          receiptUrl: 'https://example.invalid/receipts/p11-1.pdf',
          fileName: 'receipt-1.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1024,
          note: 'Bank transfer ref ABC-123',
        });
      expect(res.status).toBe(201);
      p11DepositId = res.body.id as string;
      const row = await testApp.rawPrisma.deposit.findUniqueOrThrow({
        where: { id: p11DepositId },
        select: {
          reviewStatus: true,
          verified: true,
          paymentMethod: true,
          proofDocumentId: true,
          installmentId: true,
        },
      });
      expect(row.reviewStatus).toBe(DepositReviewStatus.PENDING_REVIEW);
      expect(row.verified).toBe(false);
      expect(row.paymentMethod).toBe(PaymentMethod.BANK_TRANSFER);
      expect(row.proofDocumentId).toBeTruthy();

      const doc = await testApp.rawPrisma.document.findUniqueOrThrow({
        where: { id: row.proofDocumentId! },
        select: { ownerType: true, ownerId: true, category: true, visibility: true },
      });
      expect(doc.ownerType).toBe(DocumentOwnerType.DEPOSIT);
      expect(doc.ownerId).toBe(p11DepositId);
      expect(doc.category).toBe(DocumentCategory.RECEIPT);
      expect(doc.visibility).toBe(DocumentVisibility.ADMIN_ONLY);

      const inst = await testApp.rawPrisma.installment.findUniqueOrThrow({
        where: { id: p11InstallmentId },
        select: { status: true },
      });
      expect(inst.status).toBe(InstallmentStatus.PENDING);
    });

    it('P11.2: customer2 cannot submit a proof against customer1\'s installment → 404', async () => {
      const res = await http()
        .post('/v1/me/deposits')
        .set('Authorization', bearer(p11Customer2Token))
        .send({
          installmentId: p11OtherInstallmentId,
          amount: p11InstallmentAmount,
          paidAt: '2026-08-01T00:00:00Z',
          paymentMethod: PaymentMethod.CASH,
          receiptUrl: 'https://example.invalid/receipts/p11-cross.pdf',
        });
      expect(res.status).toBe(404);
    });

    it('P11.3: GET /me/installments lists ONLY rows owned by the caller', async () => {
      const c1res = await http()
        .get('/v1/me/installments')
        .set('Authorization', bearer(p11Customer1Token));
      expect(c1res.status).toBe(200);
      const c1Ids = (c1res.body?.data as Array<{ id: string }>).map((r) => r.id);
      expect(c1Ids).toContain(p11InstallmentId);
      expect(c1Ids).toContain(p11OtherInstallmentId);

      const c2res = await http()
        .get('/v1/me/installments')
        .set('Authorization', bearer(p11Customer2Token));
      expect(c2res.status).toBe(200);
      const c2Ids = (c2res.body?.data as Array<{ id: string }>).map((r) => r.id);
      expect(c2Ids).not.toContain(p11InstallmentId);
      expect(c2Ids).not.toContain(p11OtherInstallmentId);
    });

    it('P11.4: GET /me/deposits exposes reviewStatus but redacts receiptUrl', async () => {
      const res = await http()
        .get('/v1/me/deposits')
        .set('Authorization', bearer(p11Customer1Token));
      expect(res.status).toBe(200);
      const row = (res.body?.data as Array<Record<string, unknown>>).find(
        (r) => r.id === p11DepositId,
      );
      expect(row).toBeDefined();
      expect(row?.reviewStatus).toBe(DepositReviewStatus.PENDING_REVIEW);
      expect(row?.receiptUrl).toBeNull();
      expect(row?.rejectionReason).toBeNull();
    });

    it('P11.5: admin review-queue defaults to PENDING_REVIEW and includes the row', async () => {
      const res = await http()
        .get('/v1/deposits/review-queue?pageSize=100')
        .set('Authorization', bearer(adminToken));
      expect(res.status).toBe(200);
      const ids = (res.body?.data as Array<{ id: string }>).map((r) => r.id);
      expect(ids).toContain(p11DepositId);
    });

    it('P11.6: admin approve flips deposit APPROVED + installment PAID', async () => {
      const res = await http()
        .post(`/v1/deposits/${p11DepositId}/approve`)
        .set('Authorization', bearer(adminToken))
        .send({});
      expect(res.status).toBe(201);

      const deposit = await testApp.rawPrisma.deposit.findUniqueOrThrow({
        where: { id: p11DepositId },
        select: { reviewStatus: true, verified: true, reviewedAt: true, reviewedById: true },
      });
      expect(deposit.reviewStatus).toBe(DepositReviewStatus.APPROVED);
      expect(deposit.verified).toBe(true);
      expect(deposit.reviewedAt).toBeTruthy();
      expect(deposit.reviewedById).toBeTruthy();

      const installment = await testApp.rawPrisma.installment.findUniqueOrThrow({
        where: { id: p11InstallmentId },
        select: { status: true, paidAt: true },
      });
      expect(installment.status).toBe(InstallmentStatus.PAID);
      expect(installment.paidAt).toBeTruthy();
    });
  });

  describe('Admin reject + customer resubmit', () => {
    let rejDepositId: string;

    it('P11.7: admin reject requires a reason; customer sees REJECTED + reason', async () => {
      const submit = await http()
        .post('/v1/me/deposits')
        .set('Authorization', bearer(p11Customer1Token))
        .send({
          installmentId: p11OtherInstallmentId,
          amount: p11InstallmentAmount,
          paidAt: '2026-08-01T00:00:00Z',
          paymentMethod: PaymentMethod.BANK_TRANSFER,
          receiptUrl: 'https://example.invalid/receipts/p11-reject.pdf',
          fileName: 'receipt-2.pdf',
          mimeType: 'application/pdf',
        });
      expect(submit.status).toBe(201);
      rejDepositId = submit.body.id as string;

      const noReason = await http()
        .post(`/v1/deposits/${rejDepositId}/reject`)
        .set('Authorization', bearer(adminToken))
        .send({});
      expect(noReason.status).toBe(400);

      const reason = 'Amount does not match installment value.';
      const ok = await http()
        .post(`/v1/deposits/${rejDepositId}/reject`)
        .set('Authorization', bearer(adminToken))
        .send({ reason });
      expect(ok.status).toBe(201);

      const me = await http()
        .get('/v1/me/deposits')
        .set('Authorization', bearer(p11Customer1Token));
      const row = (me.body?.data as Array<Record<string, unknown>>).find(
        (r) => r.id === rejDepositId,
      );
      expect(row?.reviewStatus).toBe(DepositReviewStatus.REJECTED);
      expect(row?.rejectionReason).toBe(reason);
      expect(row?.receiptUrl).toBeNull();
    });

    it('P11.8: customer can freely resubmit after rejection → PENDING_REVIEW + reason cleared', async () => {
      const res = await http()
        .post(`/v1/me/deposits/${rejDepositId}/resubmit`)
        .set('Authorization', bearer(p11Customer1Token))
        .send({
          paymentMethod: PaymentMethod.CASH,
          receiptUrl: 'https://example.invalid/receipts/p11-resubmit.pdf',
          fileName: 'receipt-3.pdf',
          mimeType: 'application/pdf',
        });
      expect(res.status).toBe(201);

      const row = await testApp.rawPrisma.deposit.findUniqueOrThrow({
        where: { id: rejDepositId },
        select: { reviewStatus: true, rejectionReason: true, paymentMethod: true, verified: true },
      });
      expect(row.reviewStatus).toBe(DepositReviewStatus.PENDING_REVIEW);
      expect(row.rejectionReason).toBeNull();
      expect(row.paymentMethod).toBe(PaymentMethod.CASH);
      expect(row.verified).toBe(false);
    });
  });

  describe('Admin attaches a contract document', () => {
    it('P11.9: POST /contracts/:id/document atomically sets pdfUrl + registers Document', async () => {
      const fileUrl = 'https://example.invalid/contracts/p11.pdf';
      const res = await http()
        .post(`/v1/contracts/${p11ContractId}/document`)
        .set('Authorization', bearer(adminToken))
        .send({
          fileUrl,
          fileName: 'contract.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 4096,
        });
      expect(res.status).toBe(201);
      const contract = await testApp.rawPrisma.contract.findUniqueOrThrow({
        where: { id: p11ContractId },
        select: { pdfUrl: true },
      });
      expect(contract.pdfUrl).toBe(fileUrl);
      const document = await testApp.rawPrisma.document.findFirstOrThrow({
        where: {
          ownerType: DocumentOwnerType.CONTRACT,
          ownerId: p11ContractId,
          category: DocumentCategory.CONTRACT,
          fileUrl,
        },
        select: { id: true, visibility: true },
      });
      expect(document.visibility).toBe(DocumentVisibility.CUSTOMER_VISIBLE);

      const me = await http()
        .get('/v1/contracts/me/contracts')
        .set('Authorization', bearer(customer1Token));
      if (me.status === 200) {
        const data = (me.body?.data as Array<Record<string, unknown>>) ?? [];
        for (const row of data) expect(row.pdfUrl).toBeNull();
      } else {
        expect([200, 403, 404]).toContain(me.status);
      }
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// P13 — Info requests admin visibility + notifications (e2e)
// ═════════════════════════════════════════════════════════════════════════════

describe('P13 — Info requests admin visibility + notifications (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;

  let adminToken: string;
  let clientToken: string;
  let customer1Token: string;
  let customer2Token: string;

  const GUEST_PHONE = '+966590001313';
  const GUEST_EMAIL = 'p13-guest@example.com';
  const GUEST_MSG = 'P13 guest inquiry — please call me back about availability';
  const CLIENT_MSG = 'P13 client inquiry from the portal';
  const CUSTOMER_MSG = 'P13 customer inquiry from the portal';

  let guestReqId: string;
  let clientReqId: string;
  let customer1ReqId: string;

  const http = () => request(testApp.app.getHttpServer());

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);

    [adminToken, clientToken, customer1Token, customer2Token] = await Promise.all([
      loginAs(testApp.app, 'admin@example.com', process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!'),
      loginAs(testApp.app, fixtures.users.CLIENT_1.email, fixtures.users.CLIENT_1.password, 'customer'),
      loginAs(testApp.app, fixtures.users.CUSTOMER_1.email, fixtures.users.CUSTOMER_1.password, 'customer'),
      loginAs(testApp.app, fixtures.users.CUSTOMER_2.email, fixtures.users.CUSTOMER_2.password, 'customer'),
    ]);

    const guest = await http()
      .post('/v1/public/info-request')
      .send({
        message: GUEST_MSG,
        name: 'P13 Guest',
        phone: GUEST_PHONE,
        email: GUEST_EMAIL,
        projectId: fixtures.projects.p1Id,
      })
      .expect(201);
    guestReqId = guest.body.id;

    const client = await http()
      .post('/v1/me/info-requests')
      .set('Authorization', bearer(clientToken))
      .send({ message: CLIENT_MSG })
      .expect(201);
    clientReqId = client.body.id;

    const customer = await http()
      .post('/v1/me/info-requests')
      .set('Authorization', bearer(customer1Token))
      .send({ message: CUSTOMER_MSG })
      .expect(201);
    customer1ReqId = customer.body.id;
  });

  it('P13.1: guest inquiry is saved WITHOUT a userId', async () => {
    const row = await testApp.rawPrisma.infoRequest.findUniqueOrThrow({
      where: { id: guestReqId },
      select: { userId: true, leadId: true },
    });
    expect(row.userId).toBeNull();
    expect(row.leadId).not.toBeNull();
  });

  it('P13.2: client inquiry is saved WITH the submitting client userId', async () => {
    const clientUser = await testApp.rawPrisma.user.findUniqueOrThrow({
      where: { email: fixtures.users.CLIENT_1.email },
      select: { id: true },
    });
    const row = await testApp.rawPrisma.infoRequest.findUniqueOrThrow({
      where: { id: clientReqId },
      select: { userId: true },
    });
    expect(row.userId).toBe(clientUser.id);
  });

  it('P13.3: customer inquiry is saved WITH the customer userId and is visible in /me/info-requests', async () => {
    const res = await http()
      .get('/v1/me/info-requests')
      .query({ pageSize: 100 })
      .set('Authorization', bearer(customer1Token))
      .expect(200);
    const ids = (res.body.data as Array<{ id: string }>).map((r) => r.id);
    expect(ids).toContain(customer1ReqId);
  });

  it('P13.4: customer2 never sees customer1 inquiries in /me/info-requests', async () => {
    const res = await http()
      .get('/v1/me/info-requests')
      .query({ pageSize: 100 })
      .set('Authorization', bearer(customer2Token))
      .expect(200);
    const ids = (res.body.data as Array<{ id: string }>).map((r) => r.id);
    expect(ids).not.toContain(customer1ReqId);
    expect(ids).not.toContain(clientReqId);
  });

  it('P13.5: admin /info-requests is paginated and lists guest + client + customer inquiries', async () => {
    const res = await http()
      .get('/v1/info-requests')
      .query({ pageSize: 100 })
      .set('Authorization', bearer(adminToken))
      .expect(200);

    expect(res.body).toHaveProperty('meta.total');
    expect(Array.isArray(res.body.data)).toBe(true);

    const byId = new Map(
      (res.body.data as Array<Record<string, unknown>>).map((r) => [r.id as string, r]),
    );
    expect(byId.has(guestReqId)).toBe(true);
    expect(byId.has(clientReqId)).toBe(true);
    expect(byId.has(customer1ReqId)).toBe(true);

    const guestRow = byId.get(guestReqId) as {
      userId: string | null;
      lead: { phone: string } | null;
    };
    expect(guestRow.userId).toBeNull();
    expect(guestRow.lead?.phone).toBe(GUEST_PHONE);

    const custRow = byId.get(customer1ReqId) as { user: { id: string } | null };
    expect(custRow.user?.id).toBe(fixtures.userIds.customer1UserId);
  });

  it('P13.5b: SALES_MANAGER can also read the admin info-requests list', async () => {
    const managerToken = await loginAs(testApp.app, 'manager@example.com', 'ManagerPass123!');
    await http()
      .get('/v1/info-requests')
      .set('Authorization', bearer(managerToken))
      .expect(200);
  });

  it('P13.6: ADMIN + SALES_MANAGER receive info_request_created notifications without phone/email', async () => {
    const [adminNotifs, managerNotifs] = await Promise.all([
      testApp.rawPrisma.notification.findMany({
        where: {
          userId: fixtures.userIds.adminId,
          templateCode: 'info_request_created',
          payload: { path: ['requestId'], equals: guestReqId },
        },
        select: { payload: true },
      }),
      testApp.rawPrisma.notification.findMany({
        where: {
          userId: fixtures.userIds.managerId,
          templateCode: 'info_request_created',
          payload: { path: ['requestId'], equals: guestReqId },
        },
        select: { id: true },
      }),
    ]);

    expect(adminNotifs.length).toBeGreaterThanOrEqual(1);
    expect(managerNotifs.length).toBeGreaterThanOrEqual(1);

    const serialised = JSON.stringify(adminNotifs);
    expect(serialised).not.toContain(GUEST_PHONE);
    expect(serialised).not.toContain(GUEST_EMAIL);
    expect(serialised).not.toContain(GUEST_MSG);
  });

  it('P13.6b: a plain SALES rep is NOT notified (no assignment/routing rule)', async () => {
    const salesNotifs = await testApp.rawPrisma.notification.count({
      where: { userId: fixtures.userIds.salesId, templateCode: 'info_request_created' },
    });
    expect(salesNotifs).toBe(0);
  });
});
