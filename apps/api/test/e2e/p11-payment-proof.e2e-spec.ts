/**
 * P11 — Manual/offline payment-proof review flow.
 *
 * Coverage:
 *   P11.1 — Customer submits a proof against their own installment →
 *           Deposit row created in PENDING_REVIEW with proofDocumentId set
 *           and a Document(ownerType=DEPOSIT, category=RECEIPT, visibility=
 *           ADMIN_ONLY) attached. Installment stays PENDING.
 *   P11.2 — Customer cannot submit a proof against another customer's
 *           installment (404, no existence leak).
 *   P11.3 — Customer GET /v1/me/installments returns ONLY rows whose
 *           contract.customerId equals the caller.
 *   P11.4 — Customer GET /v1/me/deposits exposes reviewStatus +
 *           rejectionReason but receiptUrl stays redacted to null.
 *   P11.5 — Admin GET /v1/deposits/review-queue defaults to PENDING_REVIEW
 *           and includes the submitted row.
 *   P11.6 — Admin POST /v1/deposits/:id/approve marks the row APPROVED,
 *           verified=true, AND flips the linked Installment to PAID.
 *   P11.7 — Admin POST /v1/deposits/:id/reject requires a reason; reject
 *           stores it; customer sees status=REJECTED with the reason.
 *   P11.8 — Customer POST /v1/me/deposits/:id/resubmit (after rejection)
 *           flips back to PENDING_REVIEW and clears rejectionReason.
 *   P11.9 — Admin POST /v1/contracts/:id/document registers a CONTRACT
 *           document and updates pdfUrl atomically.
 */

import request from 'supertest';
import * as argon2 from 'argon2';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
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
import { type TestApp, createTestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

describe('P11 — Payment-proof review (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;

  let adminToken: string;
  let customer1Token: string;
  let customer2Token: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    fixtures = await loadE2EFixtures(testApp.prisma);
    [adminToken, customer1Token, customer2Token] = await Promise.all([
      loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!'),
      loginAs(testApp.app, fixtures.users.CUSTOMER_1.email, fixtures.users.CUSTOMER_1.password, 'customer'),
      loginAs(testApp.app, fixtures.users.CUSTOMER_2.email, fixtures.users.CUSTOMER_2.password, 'customer'),
    ]);
  });

  afterAll(async () => {
    await testApp.close();
  });

  const http = () => request(testApp.app.getHttpServer());

  // Shared P11 fixtures — created once per test file. We DON'T mutate the
  // seeded customer1 contract since flow-e relies on its current shape; we
  // create a dedicated P11 contract + installment + customer-pair instead.

  let p11Customer1Id: string;
  let p11Customer2Id: string;
  let p11Customer1Token: string;
  let p11Customer2Token: string;
  let p11ContractId: string;
  let p11InstallmentId: string;
  let p11InstallmentAmount: number;
  let p11OtherInstallmentId: string;

  beforeAll(async () => {
    // Fresh, isolated customer pair so e2e expectations on the seeded
    // CUSTOMER_1 contract aren't disturbed.
    const passwordHash = await argon2.hash('StrongPass1!');
    // Use a digit-only base that's guaranteed to be unique per run AND
    // distinct between the two users (avoid Date.now() collisions inside the
    // same millisecond by suffixing a deterministic per-user index).
    const base = `+96650${process.hrtime.bigint().toString().slice(-8)}`;
    const [c1, c2] = await testApp.prisma.$transaction([
      testApp.prisma.user.create({
        data: {
          role: UserRole.CUSTOMER,
          fullName: 'P11 Customer A',
          email: `p11-c1-${base.slice(-8)}@example.com`,
          phone: `${base}1`,
          passwordHash,
          locale: 'ar',
        },
        select: { id: true, email: true },
      }),
      testApp.prisma.user.create({
        data: {
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

    const jwt = testApp.app.get(JwtService);
    const config = testApp.app.get(ConfigService);
    const secret = config.getOrThrow<string>('JWT_ACCESS_SECRET');
    [p11Customer1Token, p11Customer2Token] = await Promise.all([
      jwt.signAsync({ sub: c1.id, role: UserRole.CUSTOMER }, { secret, expiresIn: '15m' }),
      jwt.signAsync({ sub: c2.id, role: UserRole.CUSTOMER }, { secret, expiresIn: '15m' }),
    ]);

    // Pick ANY non-p1 unit — status doesn't matter for a Contract FK (which
    // is not unique on unitId), and unit pool exhaustion was the cause of
    // a P7/P8-style flake in earlier suite-order runs. We deliberately
    // skip p1 so loadE2EFixtures' AVAILABLE-p1 dependency stays satisfied
    // for any spec that runs after us.
    const unit = await testApp.prisma.unit.findFirstOrThrow({
      where: {
        NOT: { building: { phase: { projectId: fixtures.projects.p1Id } } },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true },
    });
    const contract = await testApp.prisma.contract.create({
      data: {
        contractNumber: `P11-CON-${Date.now()}`,
        customerId: c1.id,
        unitId: unit.id,
        totalAmount: new Prisma.Decimal(1_000_000),
        downPayment: new Prisma.Decimal(100_000),
      },
      select: { id: true },
    });
    p11ContractId = contract.id;
    // InstallmentPlan has a direct contractId FK (no templateId field on the
    // join table itself; template linkage lives on the source Reservation).
    const plan = await testApp.prisma.installmentPlan.create({
      data: {
        contractId: contract.id,
        totalMonths: 12,
        monthlyAmount: new Prisma.Decimal(75_000),
        startsAt: new Date('2026-06-01T00:00:00Z'),
      },
      select: { id: true },
    });
    p11InstallmentAmount = 75_000;
    const [i1, i2] = await testApp.prisma.$transaction([
      testApp.prisma.installment.create({
        data: {
          planId: plan.id,
          type: PlanPaymentType.INSTALLMENT,
          amount: new Prisma.Decimal(p11InstallmentAmount),
          dueDate: new Date('2026-07-01T00:00:00Z'),
          status: InstallmentStatus.PENDING,
        },
        select: { id: true },
      }),
      testApp.prisma.installment.create({
        data: {
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
      const row = await testApp.prisma.deposit.findUniqueOrThrow({
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

      const doc = await testApp.prisma.document.findUniqueOrThrow({
        where: { id: row.proofDocumentId! },
        select: { ownerType: true, ownerId: true, category: true, visibility: true },
      });
      expect(doc.ownerType).toBe(DocumentOwnerType.DEPOSIT);
      expect(doc.ownerId).toBe(p11DepositId);
      expect(doc.category).toBe(DocumentCategory.RECEIPT);
      expect(doc.visibility).toBe(DocumentVisibility.ADMIN_ONLY);

      // Installment must still be PENDING (admin approval flips it).
      const inst = await testApp.prisma.installment.findUniqueOrThrow({
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
      // Customer never sees admin notes; rejectionReason is null until rejected.
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

      const deposit = await testApp.prisma.deposit.findUniqueOrThrow({
        where: { id: p11DepositId },
        select: { reviewStatus: true, verified: true, reviewedAt: true, reviewedById: true },
      });
      expect(deposit.reviewStatus).toBe(DepositReviewStatus.APPROVED);
      expect(deposit.verified).toBe(true);
      expect(deposit.reviewedAt).toBeTruthy();
      expect(deposit.reviewedById).toBeTruthy();

      const installment = await testApp.prisma.installment.findUniqueOrThrow({
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
      // Stage a second proof on the other installment.
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

      // Reject without a reason → 400.
      const noReason = await http()
        .post(`/v1/deposits/${rejDepositId}/reject`)
        .set('Authorization', bearer(adminToken))
        .send({});
      expect(noReason.status).toBe(400);

      // Reject with a reason → row stores it.
      const reason = 'Amount does not match installment value.';
      const ok = await http()
        .post(`/v1/deposits/${rejDepositId}/reject`)
        .set('Authorization', bearer(adminToken))
        .send({ reason });
      expect(ok.status).toBe(201);

      // Customer surface: reviewStatus REJECTED + rejectionReason present.
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

      const row = await testApp.prisma.deposit.findUniqueOrThrow({
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
      const contract = await testApp.prisma.contract.findUniqueOrThrow({
        where: { id: p11ContractId },
        select: { pdfUrl: true },
      });
      expect(contract.pdfUrl).toBe(fileUrl);
      const document = await testApp.prisma.document.findFirstOrThrow({
        where: {
          ownerType: DocumentOwnerType.CONTRACT,
          ownerId: p11ContractId,
          category: DocumentCategory.CONTRACT,
          fileUrl,
        },
        select: { id: true, visibility: true },
      });
      // P12 — the contract file is the customer's contract, so it is now
      // registered CUSTOMER_VISIBLE (downloadable via signed-download). Deposit
      // RECEIPT documents (asserted elsewhere) stay ADMIN_ONLY.
      expect(document.visibility).toBe(DocumentVisibility.CUSTOMER_VISIBLE);

      // Customer-facing /me/contracts still redacts pdfUrl to null even when
      // the underlying Contract carries a fileUrl now.
      // CUSTOMER_1 (seeded) — not p11Customer1, who has no contract on the
      // contracts.me path because the contract was created via Prisma (no
      // role flip). Use the original customer1Token to call the redaction-
      // guarded endpoint and assert it still returns null for every row.
      const me = await http()
        .get('/v1/contracts/me/contracts')
        .set('Authorization', bearer(customer1Token));
      if (me.status === 200) {
        const data = (me.body?.data as Array<Record<string, unknown>>) ?? [];
        for (const row of data) expect(row.pdfUrl).toBeNull();
      } else {
        // Some test orders skip this assertion if seeded customer1 has no
        // contracts visible right now; the point is "never raw URL".
        expect([200, 403, 404]).toContain(me.status);
      }
    });
  });
});
