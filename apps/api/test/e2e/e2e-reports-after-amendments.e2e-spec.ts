/**
 * R3 — figures after fees and transfers.
 *
 * A fee payment is collected money but not progress against the price; a
 * fee is due after the company's payment period, not the day it is charged;
 * after a transfer each owner sees only the receipts of their own payments.
 */
import 'reflect-metadata';
import request from 'supertest';
import { DepositReviewStatus, DocumentOwnerType, DocumentVisibility, InstallmentStatus, PlanPaymentType, UserRole } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

const DAY = 24 * 60 * 60 * 1000;

describe('R3 — reports after fees and transfers (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  let companyId: string;
  let contractId: string;
  let planId: string;
  let createdPlan = false;
  const depositIds: string[] = [];
  const stamp = Date.now().toString().slice(-8);
  const startedAt = new Date();

  const http = () => request(testApp.app.getHttpServer());
  const asAdmin = <T extends request.Test>(r: T) => r.set('Authorization', bearer(adminToken));

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    const raw = testApp.rawPrisma;
    adminToken = await loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!');
    companyId = (await raw.user.findUniqueOrThrow({ where: { id: fixtures.userIds.adminId } })).companyId!;
    contractId = fixtures.flowE.customer1ContractId;
    const existing = await raw.installmentPlan.findUnique({ where: { contractId }, select: { id: true } });
    if (existing) planId = existing.id;
    else {
      planId = (
        await raw.installmentPlan.create({
          data: { companyId, contractId, totalMonths: 1, monthlyAmount: 1, startsAt: new Date() },
          select: { id: true },
        })
      ).id;
      createdPlan = true;
    }
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    await raw.setting.updateMany({ where: { companyId, key: 'fees.paymentDays' }, data: { value: 14 } });
    await raw.document.deleteMany({ where: { title: { startsWith: 'R3 ' } } });
    await raw.deposit.deleteMany({ where: { id: { in: depositIds } } });
    await raw.installment.deleteMany({ where: { planId, createdAt: { gte: startedAt }, type: { in: [PlanPaymentType.LATE_FEE, PlanPaymentType.TRANSFER_FEE] } } });
    if (createdPlan) await raw.installmentPlan.delete({ where: { id: planId } });
    await raw.contractAmendment.deleteMany({ where: { contractId, createdAt: { gte: startedAt } } });
  });

  it('R3-1: a fee payment counts as collected, not as progress against the price', async () => {
    const raw = testApp.rawPrisma;
    const before = (await asAdmin(http().get('/v1/reports/admin-summary')).expect(200)).body.financial;
    const fee = await raw.installment.create({
      data: { companyId, planId, type: PlanPaymentType.LATE_FEE, amount: 777, dueDate: new Date(), status: InstallmentStatus.PAID, paidAt: new Date() },
      select: { id: true },
    });
    const feePayment = await raw.deposit.create({
      data: {
        companyId,
        installmentId: fee.id,
        amount: 777,
        paidAt: new Date(),
        recordedById: fixtures.userIds.adminId,
        reviewStatus: DepositReviewStatus.NO_PROOF,
      },
      select: { id: true },
    });
    depositIds.push(feePayment.id);
    const after = (await asAdmin(http().get('/v1/reports/admin-summary')).expect(200)).body.financial;
    expect(after.totalCollectedVerified - before.totalCollectedVerified).toBeCloseTo(777, 2);
    expect(after.collectedTowardsPrice).toBeCloseTo(before.collectedTowardsPrice, 2);
    expect(after.collectedTowardsPrice).toBeLessThanOrEqual(after.totalContractValue);
  });

  it('R3-2: a transfer fee is due after the company’s payment period; each owner sees only their own receipts', async () => {
    const raw = testApp.rawPrisma;
    await asAdmin(http().patch('/v1/settings/fees.paymentDays')).send({ value: 30 }).expect(200);

    // A receipt from the current owner, paid before the transfer.
    const oldPayment = await raw.deposit.create({
      data: {
        companyId,
        contractId,
        amount: 1000,
        paidAt: new Date(Date.now() - DAY),
        recordedById: fixtures.userIds.adminId,
        reviewStatus: DepositReviewStatus.NO_PROOF,
      },
      select: { id: true },
    });
    depositIds.push(oldPayment.id);
    const doc = await raw.document.create({
      data: {
        companyId,
        ownerType: DocumentOwnerType.DEPOSIT,
        ownerId: oldPayment.id,
        title: 'R3 old receipt',
        fileUrl: `receipts/r3-${stamp}.pdf`,
        visibility: DocumentVisibility.CUSTOMER_VISIBLE,
        uploadedById: fixtures.userIds.adminId,
      },
      select: { id: true },
    });

    const newOwner = await raw.user.create({
      data: { companyId, role: UserRole.CLIENT, fullName: 'R3 New Owner', phone: `+2014${stamp}`, locale: 'ar' },
      select: { id: true },
    });
    try {
      const t0 = Date.now();
      const res = await asAdmin(http().post(`/v1/contracts/${contractId}/transfer`))
        .send({ toCustomerId: newOwner.id, reason: 'R3 transfer', feeAmount: 500 })
        .expect(201);
      expect(Number(res.body.feeAmount)).toBe(500);
      const fee = await raw.installment.findFirstOrThrow({
        where: { planId, type: PlanPaymentType.TRANSFER_FEE, createdAt: { gte: startedAt } },
      });
      expect(Math.round((fee.dueDate.getTime() - t0) / DAY)).toBe(30);

      const newToken = await testApp.signAccessToken(newOwner.id, 'CUSTOMER');
      const theirs = await http().get('/v1/me/documents/all').set('Authorization', bearer(newToken)).expect(200);
      expect(theirs.body.map((d: { id: string }) => d.id)).not.toContain(doc.id);

      const oldToken = await testApp.signAccessToken(fixtures.userIds.customer1UserId, 'CLIENT');
      const mine = await http().get('/v1/me/documents/all').set('Authorization', bearer(oldToken)).expect(200);
      expect(mine.body.map((d: { id: string }) => d.id)).toContain(doc.id);
    } finally {
      await asAdmin(http().post(`/v1/contracts/${contractId}/transfer`))
        .send({ toCustomerId: fixtures.userIds.customer1UserId, reason: 'R3 transfer back', feeAmount: 0 })
        .expect(201);
      await raw.refreshToken.deleteMany({ where: { userId: newOwner.id } });
      await raw.user.delete({ where: { id: newOwner.id } });
    }
  });
});
