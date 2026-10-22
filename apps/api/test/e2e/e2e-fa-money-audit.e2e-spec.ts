/**
 * FA — fixes from the financial audit (2026-10-22). Each case is a path that
 * left money state wrong: a payment counted with nothing behind it, a row
 * paid with no payment, a booking paid twice.
 */
import 'reflect-metadata';
import request from 'supertest';
import {
  DepositReviewStatus,
  DepositType,
  DocumentCategory,
  DocumentOwnerType,
  InstallmentStatus,
  PlanPaymentType,
  ProjectStatus,
  ReservationBookingPaymentStatus,
  UnitStatus,
} from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

interface Sale {
  unitId: string;
  templateId: string;
  reservationId: string;
  contractId: string;
}

describe('FA — financial audit fixes (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  let customerToken: string;
  let companyId: string;
  let projectId: string;
  let buildingId: string;
  const sales: Sale[] = [];
  const stamp = Date.now().toString().slice(-7);
  const startedAt = new Date();

  const http = () => request(testApp.app.getHttpServer());
  const asAdmin = <T extends request.Test>(r: T) => r.set('Authorization', bearer(adminToken));
  const today = () => new Date().toISOString().slice(0, 10);

  /** A 1,000,000 unit on a 12-month plan (50,000 booking, 200,000 down), booked and approved. */
  const book = async (n: number): Promise<Sale> => {
    const raw = testApp.rawPrisma;
    const unitId = (
      await raw.unit.create({
        data: {
          companyId,
          buildingId,
          code: `FA-U${n}-${stamp}`,
          type: 'APARTMENT',
          area: 100,
          bedrooms: 2,
          bathrooms: 1,
          floor: 1,
          price: 1_000_000,
          status: UnitStatus.AVAILABLE,
        },
      })
    ).id;
    const tpl = await asAdmin(http().post('/v1/installment-plan-templates')).send({
      name: `FA plan ${n}`,
      projectId,
      unitId,
      totalPrice: 1_000_000,
      reservationAmount: 50_000,
      downPaymentType: 'FIXED',
      downPaymentValue: 200_000,
      startDateRule: 'AFTER_CONTRACT',
      status: 'ACTIVE',
      durationOptions: [{ durationMonths: 12, increasePercentage: 0 }],
    });
    if (tpl.status !== 201) throw new Error(`template create: ${JSON.stringify(tpl.body)}`);
    const option = await raw.installmentPlanDurationOption.findFirstOrThrow({ where: { planId: tpl.body.id } });
    const created = await asAdmin(http().post('/v1/reservations'))
      .send({
        unitId,
        clientId: fixtures.userIds.customer1UserId,
        installmentPlanTemplateId: tpl.body.id,
        installmentPlanDurationOptionId: option.id,
        expiresInHours: 72,
      })
      .expect(201);
    const reservationId = created.body.id ?? created.body.reservation?.id;
    const sale: Sale = { unitId, templateId: tpl.body.id, reservationId, contractId: '' };
    sales.push(sale);
    await asAdmin(http().post(`/v1/reservations/${reservationId}/approve`)).send({}).expect(201);
    return sale;
  };

  /** Booked, booking confirmed in cash, converted and signed. */
  const sell = async (n: number): Promise<Sale> => {
    const sale = await book(n);
    await asAdmin(http().post(`/v1/reservations/${sale.reservationId}/booking-payment/confirm`)).send({}).expect(201);
    await asAdmin(http().post(`/v1/reservations/${sale.reservationId}/convert`)).send({ startsAt: today() }).expect(201);
    sale.contractId = (
      await testApp.rawPrisma.contract.findFirstOrThrow({ where: { reservationId: sale.reservationId }, select: { id: true } })
    ).id;
    await asAdmin(http().post(`/v1/contracts/${sale.contractId}/sign`))
      .send({ signedAt: new Date().toISOString() })
      .expect(201);
    return sale;
  };

  const downPayment = (s: Sale) =>
    testApp.rawPrisma.installment.findFirstOrThrow({
      where: { plan: { contractId: s.contractId }, type: PlanPaymentType.DOWN_PAYMENT },
    });

  /** Booking payments that count as collected. */
  const collectedBookings = (s: Sale) =>
    testApp.rawPrisma.deposit.count({
      where: {
        reservationId: s.reservationId,
        type: DepositType.BOOKING_AMOUNT,
        deletedAt: null,
        reviewStatus: { in: [DepositReviewStatus.APPROVED, DepositReviewStatus.NO_PROOF] },
      },
    });

  /** A customer booking proof (with its receipt document, as the app records it). */
  const proof = async (s: Sale, reviewStatus: DepositReviewStatus) => {
    const d = await testApp.rawPrisma.deposit.create({
      data: {
        companyId,
        type: DepositType.BOOKING_AMOUNT,
        reservationId: s.reservationId,
        amount: 50_000,
        paidAt: new Date(),
        receiptUrl: 'https://example.invalid/receipts/fa.pdf',
        reviewStatus,
        recordedById: fixtures.userIds.customer1UserId,
      },
    });
    const doc = await testApp.rawPrisma.document.create({
      data: {
        companyId,
        ownerType: DocumentOwnerType.DEPOSIT,
        ownerId: d.id,
        category: DocumentCategory.RECEIPT,
        title: 'FA proof',
        fileUrl: 'https://example.invalid/receipts/fa.pdf',
      },
    });
    return testApp.rawPrisma.deposit.update({ where: { id: d.id }, data: { proofDocumentId: doc.id } });
  };

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    adminToken = await loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!');
    customerToken = await loginAs(
      testApp.app,
      fixtures.users.CUSTOMER_1.email,
      fixtures.users.CUSTOMER_1.password,
      'customer',
    );
    const raw = testApp.rawPrisma;
    companyId = (await raw.user.findUniqueOrThrow({ where: { id: fixtures.userIds.adminId } })).companyId!;
    projectId = (
      await raw.project.create({
        data: {
          companyId,
          code: `FA-${stamp}`,
          name: { ar: 'مشروع', en: 'FA Project' },
          description: { ar: 'و', en: 'd' },
          city: 'Cairo',
          lat: 30,
          lng: 31,
          status: ProjectStatus.PUBLISHED,
        },
      })
    ).id;
    const phase = await raw.phase.create({
      data: { companyId, projectId, code: `FA-PH-${stamp}`, name: { ar: 'م', en: 'P' } },
    });
    buildingId = (
      await raw.building.create({ data: { companyId, phaseId: phase.id, code: `FA-B-${stamp}`, name: 'B' } })
    ).id;
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    for (const s of sales) {
      const deposits = await raw.deposit.findMany({
        where: { OR: [{ reservationId: s.reservationId }, ...(s.contractId ? [{ contractId: s.contractId }] : [])] },
        select: { id: true, paymentInstrumentId: true },
      });
      const depositIds = deposits.map((d) => d.id);
      const instrumentIds = deposits.map((d) => d.paymentInstrumentId).filter((x): x is string => !!x);
      await raw.installment.updateMany({ where: { plan: { contractId: s.contractId || undefined } }, data: { lastCorrectionId: null } });
      await raw.paymentCorrection.deleteMany({ where: { depositId: { in: depositIds } } });
      await raw.deposit.updateMany({ where: { id: { in: depositIds } }, data: { proofDocumentId: null } });
      await raw.document.deleteMany({ where: { ownerId: { in: depositIds } } });
      await raw.deposit.deleteMany({ where: { id: { in: depositIds } } });
      await raw.paymentInstrument.updateMany({ where: { id: { in: instrumentIds } }, data: { replacedById: null } });
      await raw.paymentInstrument.deleteMany({ where: { id: { in: instrumentIds } } });
      if (s.contractId) {
        const plan = await raw.installmentPlan.findFirst({ where: { contractId: s.contractId }, select: { id: true } });
        if (plan) {
          await raw.installment.deleteMany({ where: { planId: plan.id, feeForId: { not: null } } });
          await raw.installment.deleteMany({ where: { planId: plan.id } });
          await raw.installmentPlan.deleteMany({ where: { id: plan.id } });
        }
        await raw.bonusEntry.deleteMany({ where: { contractId: s.contractId } });
        await raw.unitMaintenanceItem.deleteMany({ where: { unitId: s.unitId } });
        await raw.contract.deleteMany({ where: { id: s.contractId } });
      }
      await raw.reservationActivity.deleteMany({ where: { reservationId: s.reservationId } });
      await raw.reservation.deleteMany({ where: { id: s.reservationId } });
      await raw.installmentPlanDurationOption.deleteMany({ where: { planId: s.templateId } });
      await raw.planTemplateScheduleItem.deleteMany({ where: { planId: s.templateId } });
      await raw.installmentPlanTemplate.deleteMany({ where: { id: s.templateId } });
    }
    const unitIds = sales.map((s) => s.unitId);
    await raw.auditLog.deleteMany({
      where: { entityId: { in: [...unitIds, ...sales.map((s) => s.contractId)] }, createdAt: { gte: startedAt } },
    });
    await raw.unitStatusHistory.deleteMany({ where: { unitId: { in: unitIds } } });
    await raw.unit.deleteMany({ where: { buildingId } });
    await raw.building.deleteMany({ where: { id: buildingId } });
    await raw.phase.deleteMany({ where: { projectId } });
    await raw.project.deleteMany({ where: { id: projectId } });
  });

  it('FA2: un-verifying a staff-recorded payment that has a receipt reopens its row', async () => {
    const sale = await sell(1);
    const down = await downPayment(sale);
    const rec = await asAdmin(http().post('/v1/deposits'))
      .send({ contractId: sale.contractId, installmentId: down.id, amount: Number(down.amount), paymentMethod: 'CASH' })
      .expect(201);
    await testApp.rawPrisma.deposit.update({
      where: { id: rec.body.id },
      data: { receiptUrl: 'https://example.invalid/receipts/fa2.pdf' },
    });
    expect((await downPayment(sale)).status).toBe(InstallmentStatus.PAID);

    await asAdmin(http().patch(`/v1/deposits/${rec.body.id}/verify`)).send({ verified: false }).expect(200);
    // The payment went back to review: the row is open again, with a reversal on record.
    expect((await downPayment(sale)).status).toBe(InstallmentStatus.PENDING);
    expect(
      await testApp.rawPrisma.paymentCorrection.count({ where: { depositId: rec.body.id, supersededAt: null } }),
    ).toBe(1);
  });

  it('FA1a: a rejected booking proof cannot be approved once the booking was paid in cash', async () => {
    const sale = await book(2);
    const rejected = await proof(sale, DepositReviewStatus.REJECTED);
    await asAdmin(http().post(`/v1/reservations/${sale.reservationId}/booking-payment/confirm`)).send({}).expect(201);
    expect(await collectedBookings(sale)).toBe(1);

    const res = await asAdmin(http().post(`/v1/deposits/${rejected.id}/approve`)).send({});
    expect(`${res.status} ${JSON.stringify(res.body)}`).toMatch(/^409/);
    expect(await collectedBookings(sale)).toBe(1);
  });

  it('FA1b: the booking cannot be set paid or unpaid by editing the reservation', async () => {
    const sale = await book(3);
    const paid = await asAdmin(http().patch(`/v1/reservations/${sale.reservationId}`)).send({
      bookingPaymentStatus: ReservationBookingPaymentStatus.PAID,
    });
    expect(paid.status).toBe(400);
    // A waiver (and undoing it) still goes through.
    await asAdmin(http().patch(`/v1/reservations/${sale.reservationId}`))
      .send({ bookingPaymentStatus: ReservationBookingPaymentStatus.WAIVED })
      .expect(200);
    await asAdmin(http().patch(`/v1/reservations/${sale.reservationId}`))
      .send({ bookingPaymentStatus: ReservationBookingPaymentStatus.UNPAID })
      .expect(200);

    await asAdmin(http().post(`/v1/reservations/${sale.reservationId}/booking-payment/confirm`)).send({}).expect(201);
    const unpaid = await asAdmin(http().patch(`/v1/reservations/${sale.reservationId}`)).send({
      bookingPaymentStatus: ReservationBookingPaymentStatus.UNPAID,
    });
    expect(unpaid.status).toBe(400);
  });

  it('FA1c: the confirmed booking payment cannot be deleted from under a paid booking', async () => {
    const sale = await book(4);
    await asAdmin(http().post(`/v1/reservations/${sale.reservationId}/booking-payment/confirm`)).send({}).expect(201);
    const dep = await testApp.rawPrisma.deposit.findFirstOrThrow({
      where: { reservationId: sale.reservationId, type: DepositType.BOOKING_AMOUNT },
    });
    expect((await asAdmin(http().delete(`/v1/deposits/${dep.id}`))).status).toBe(409);
    expect((await asAdmin(http().patch(`/v1/deposits/${dep.id}/verify`)).send({ verified: false })).status).toBe(409);
    expect(await collectedBookings(sale)).toBe(1);
  });

  it('FA1d: the customer can resubmit a rejected booking proof, and it waits for review again', async () => {
    const sale = await book(5);
    const rejected = await proof(sale, DepositReviewStatus.REJECTED);
    const res = await http()
      .post(`/v1/me/deposits/${rejected.id}/resubmit`)
      .set('Authorization', bearer(customerToken))
      .send({ paymentMethod: 'BANK_TRANSFER', receiptUrl: 'https://example.invalid/receipts/fa1d.pdf' });
    expect(res.status).toBe(201);
    const r = await testApp.rawPrisma.reservation.findUniqueOrThrow({ where: { id: sale.reservationId } });
    expect(r.bookingPaymentStatus).toBe(ReservationBookingPaymentStatus.PENDING);

    // A second proof while this one waits is refused.
    const again = await http()
      .post('/v1/me/deposits')
      .set('Authorization', bearer(customerToken))
      .send({
        reservationId: sale.reservationId,
        paymentMethod: 'BANK_TRANSFER',
        paidAt: new Date().toISOString(),
        receiptUrl: 'https://example.invalid/receipts/fa1d-2.pdf',
      });
    expect(again.status).toBeGreaterThanOrEqual(400);
    expect(
      await testApp.rawPrisma.deposit.count({
        where: { reservationId: sale.reservationId, reviewStatus: DepositReviewStatus.PENDING_REVIEW },
      }),
    ).toBe(1);
  });

  // ── FA3: cheques and transfers ─────────────────────────────────────────
  const pi = (id: string, action: string, body: Record<string, unknown> = {}) =>
    asAdmin(http().post(`/v1/payment-instruments/${id}/${action}`)).send(body);
  const bounce = (id: string, penaltyAmount = 0) =>
    pi(id, 'bounce', {
      bounceReason: 'returned',
      bounceDate: today(),
      penaltyAmount,
      ...(penaltyAmount ? { penaltyDueDate: today() } : {}),
    });
  /** The down payment paid by a cheque that has cleared. */
  const clearedCheque = async (n: number) => {
    const sale = await sell(n);
    const down = await downPayment(sale);
    const rec = await asAdmin(http().post('/v1/deposits'))
      .send({
        contractId: sale.contractId,
        installmentId: down.id,
        amount: Number(down.amount),
        paymentMethod: 'CHEQUE',
        cheque: { chequeNumber: `FA-${n}-${stamp}`, drawerBankName: 'FA Bank', chequeDueDate: today() },
      })
      .expect(201);
    const instrumentId = rec.body.paymentInstrumentId as string;
    expect((await pi(instrumentId, 'deposit')).status).toBe(200);
    expect((await pi(instrumentId, 'clear')).status).toBe(200);
    expect((await downPayment(sale)).status).toBe(InstallmentStatus.PAID);
    return { sale, down, depositId: rec.body.id as string, instrumentId };
  };
  const penalties = (s: Sale) =>
    testApp.rawPrisma.installment.count({
      where: { plan: { contractId: s.contractId }, type: PlanPaymentType.BOUNCE_PENALTY },
    });

  it('FA3a: a cheque returned twice at once is bounced once — one reversal, one penalty', async () => {
    const { sale, depositId, instrumentId } = await clearedCheque(10);
    const results = await Promise.all([bounce(instrumentId, 500), bounce(instrumentId, 500)]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await penalties(sale)).toBe(1);
    expect(await testApp.rawPrisma.paymentCorrection.count({ where: { depositId } })).toBe(1);
    expect((await downPayment(sale)).status).not.toBe(InstallmentStatus.PAID);
  });

  it('FA3b: the replacement of a cheque returned after clearing pays the row when it clears', async () => {
    const { sale, instrumentId } = await clearedCheque(11);
    expect((await bounce(instrumentId)).status).toBe(200);
    const rep = await pi(instrumentId, 'replace', {
      type: 'CHEQUE',
      chequeNumber: `FA-11R-${stamp}`,
      drawerBankName: 'FA Bank',
      chequeDueDate: today(),
    });
    expect(rep.status).toBeLessThan(300);
    const replacementId = rep.body.id as string;
    expect((await pi(replacementId, 'deposit')).status).toBe(200);
    expect((await pi(replacementId, 'clear')).status).toBe(200);
    expect((await downPayment(sale)).status).toBe(InstallmentStatus.PAID);
  });

  it('FA3c: a returned bank transfer recorded by staff reopens its row', async () => {
    const sale = await sell(12);
    const down = await downPayment(sale);
    const rec = await asAdmin(http().post('/v1/deposits'))
      .send({
        contractId: sale.contractId,
        installmentId: down.id,
        amount: Number(down.amount),
        paymentMethod: 'BANK_TRANSFER',
        transfer: { bankName: 'FA Bank', referenceNumber: `FA-T-${stamp}` },
      })
      .expect(201);
    expect((await downPayment(sale)).status).toBe(InstallmentStatus.PAID);
    expect((await bounce(rec.body.paymentInstrumentId)).status).toBe(200);
    expect((await downPayment(sale)).status).not.toBe(InstallmentStatus.PAID);
    expect(await testApp.rawPrisma.paymentCorrection.count({ where: { depositId: rec.body.id } })).toBe(1);
  });

  it('FA3d: a cheque returned after its payment was reversed and the row paid in cash leaves the row paid', async () => {
    const { sale, down, depositId, instrumentId } = await clearedCheque(13);
    await asAdmin(http().post(`/v1/deposits/${depositId}/reverse`)).send({ reason: 'wrong cheque' }).expect(201);
    await asAdmin(http().post('/v1/deposits'))
      .send({ contractId: sale.contractId, installmentId: down.id, amount: Number(down.amount), paymentMethod: 'CASH' })
      .expect(201);
    expect((await downPayment(sale)).status).toBe(InstallmentStatus.PAID);

    expect((await bounce(instrumentId)).status).toBe(200);
    expect((await downPayment(sale)).status).toBe(InstallmentStatus.PAID);
    expect(await testApp.rawPrisma.paymentCorrection.count({ where: { depositId } })).toBe(1);
  });
});
