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
import { LATE_FEE_SETTING_DEFAULTS } from '../../src/modules/installments/late-fee';

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
        const commissions = await raw.brokerCommission.findMany({ where: { contractId: s.contractId }, select: { id: true, payoutId: true } });
        await raw.brokerCommissionAdjustment.deleteMany({ where: { commissionId: { in: commissions.map((c) => c.id) } } });
        await raw.brokerCommission.deleteMany({ where: { contractId: s.contractId } });
        await raw.brokerPayout.deleteMany({
          where: { id: { in: commissions.map((c) => c.payoutId).filter((x): x is string => !!x) } },
        });
        await raw.unitMaintenanceItem.deleteMany({ where: { unitId: s.unitId } });
        await raw.contractCancellation.deleteMany({ where: { contractId: s.contractId } });
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
  it('FA9: a booking cheque returned after the contract was signed moves the booking into the schedule — once', async () => {
    const sale = await book(60);
    const raw = testApp.rawPrisma;
    await asAdmin(http().post(`/v1/reservations/${sale.reservationId}/booking-payment/confirm`))
      .send({ paymentMethod: 'CHEQUE', cheque: { chequeNumber: `FA9-${stamp}`, chequeDueDate: today() } })
      .expect(201);
    const booking = await raw.deposit.findFirstOrThrow({ where: { reservationId: sale.reservationId, type: DepositType.BOOKING_AMOUNT } });
    const instrumentId = booking.paymentInstrumentId!;
    expect((await pi(instrumentId, 'deposit')).status).toBe(200);
    expect((await pi(instrumentId, 'clear')).status).toBe(200);
    await asAdmin(http().post(`/v1/reservations/${sale.reservationId}/convert`)).send({ startsAt: today() }).expect(201);
    sale.contractId = (await raw.contract.findFirstOrThrow({ where: { reservationId: sale.reservationId } })).id;
    await asAdmin(http().post(`/v1/contracts/${sale.contractId}/sign`)).send({ signedAt: new Date().toISOString() }).expect(201);

    expect((await bounce(instrumentId)).status).toBe(200);
    // The booking no longer counts as paid; a row carries it, due on the return date.
    const r = await raw.reservation.findUniqueOrThrow({ where: { id: sale.reservationId } });
    expect(r.bookingPaymentStatus).toBe(ReservationBookingPaymentStatus.UNPAID);
    const rows = await raw.installment.findMany({ where: { plan: { contractId: sale.contractId }, type: PlanPaymentType.RESERVATION } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.amount.toString()).toBe('50000');
    expect([InstallmentStatus.PENDING, InstallmentStatus.OVERDUE]).toContain(rows[0]!.status);
    expect(await collectedBookings(sale)).toBe(1); // the deposit stays, reversed:
    expect(await raw.paymentCorrection.count({ where: { depositId: booking.id, type: 'REVERSAL', supersededAt: null } })).toBe(1);

    // The contract still adds up: booking (unpaid) moved into rows = total.
    const c = await raw.contract.findUniqueOrThrow({ where: { id: sale.contractId } });
    const sum = await raw.installment.aggregate({
      where: { plan: { contractId: sale.contractId }, type: { notIn: ['LATE_FEE', 'BOUNCE_PENALTY', 'TRANSFER_FEE'] } },
      _sum: { amount: true },
    });
    expect(sum._sum.amount!.toString()).toBe(c.totalAmount.toString());
    // The statement owes it once, not twice (booking + row).
    const st = await asAdmin(http().get(`/v1/contracts/${sale.contractId}/statement`)).expect(200);
    const owed = Number(st.body.totals.overdue) + Number(st.body.totals.dueToday) + Number(st.body.totals.upcoming);
    expect(Number(st.body.totals.balance)).toBeCloseTo(owed, 2);
    expect(Number(st.body.totals.unscheduled)).toBe(0);

    // Paying the row settles it like any other.
    await asAdmin(http().post('/v1/deposits'))
      .send({ contractId: sale.contractId, installmentId: rows[0]!.id, amount: 50_000, paymentMethod: 'CASH' })
      .expect(201);
    expect((await raw.installment.findUniqueOrThrow({ where: { id: rows[0]!.id } })).status).toBe(InstallmentStatus.PAID);
  });

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

  // ── FA4: contract money ────────────────────────────────────────────────
  it('FA4a: a new booking amount on a cash plan is taken off the price — the contract still adds up', async () => {
    const raw = testApp.rawPrisma;
    const unitId = (
      await raw.unit.create({
        data: {
          companyId, buildingId, code: `FA-C-${stamp}`, type: 'APARTMENT', area: 100, bedrooms: 2,
          bathrooms: 1, floor: 1, price: 1_000_000, status: UnitStatus.AVAILABLE,
        },
      })
    ).id;
    const tpl = await asAdmin(http().post('/v1/installment-plan-templates')).send({
      name: 'FA cash', projectId, unitId, totalPrice: 1_000_000, reservationAmount: 50_000,
      isCash: true, startDateRule: 'AFTER_CONTRACT', status: 'ACTIVE',
    });
    expect(tpl.status).toBe(201);
    const created = await asAdmin(http().post('/v1/reservations'))
      .send({ unitId, clientId: fixtures.userIds.customer1UserId, installmentPlanTemplateId: tpl.body.id, expiresInHours: 72 })
      .expect(201);
    const reservationId = created.body.id ?? created.body.reservation?.id;
    const sale: Sale = { unitId, templateId: tpl.body.id, reservationId, contractId: '' };
    sales.push(sale);
    await asAdmin(http().post(`/v1/reservations/${reservationId}/approve`)).send({}).expect(201);
    await asAdmin(http().patch(`/v1/reservations/${reservationId}`)).send({ bookingAmount: 100_000 }).expect(200);
    await asAdmin(http().post(`/v1/reservations/${reservationId}/booking-payment/confirm`)).send({}).expect(201);
    await asAdmin(http().post(`/v1/reservations/${reservationId}/convert`)).send({ startsAt: today() }).expect(201);
    const contract = await raw.contract.findFirstOrThrow({ where: { reservationId } });
    sale.contractId = contract.id;
    const rows = await raw.installment.aggregate({
      where: { plan: { contractId: contract.id }, status: { not: InstallmentStatus.CANCELLED } },
      _sum: { amount: true },
    });
    // booking 100,000 + the down payment = the 1,000,000 price, not 1,050,000.
    expect(Number(contract.totalAmount)).toBe(1_000_000);
    expect(Number(rows._sum.amount) + 100_000).toBe(1_000_000);
  });

  it('FA4b: a contract signed late is not charged late fees for the months before it was signed', async () => {
    const raw = testApp.rawPrisma;
    const sale = await sell(20);
    const DAY = 86_400_000;
    const plan = await raw.installmentPlan.findFirstOrThrow({ where: { contractId: sale.contractId } });
    // Converted three months ago, signed today; a row due two months ago.
    await raw.contract.update({
      where: { id: sale.contractId },
      data: { createdAt: new Date(Date.now() - 90 * DAY), lateFeesApply: true },
    });
    const old = await raw.installment.create({
      data: {
        planId: plan.id, companyId, type: PlanPaymentType.INSTALLMENT, amount: 20_000,
        dueDate: new Date(Date.now() - 60 * DAY), status: InstallmentStatus.OVERDUE,
      },
    });
    await raw.setting.updateMany({ where: { companyId, key: 'lateFee.value' }, data: { value: 2 } });
    await raw.setting.updateMany({ where: { companyId, key: 'lateFee.repeat' }, data: { value: 'MONTHLY' } });
    try {
      await testApp.runCronJob('late-fee');
      expect(await raw.installment.count({ where: { feeForId: old.id } })).toBe(0);
    } finally {
      for (const { key, value } of LATE_FEE_SETTING_DEFAULTS) {
        await raw.setting.updateMany({ where: { companyId, key }, data: { value } });
      }
      await raw.installment.deleteMany({ where: { feeForId: old.id } });
    }
  });

  // ── FA5: cancellation ───────────────────────────────────────────────────
  it('FA5: a contract is not cancelled while a customer proof waits for review (it would drop out of the refund)', async () => {
    const sale = await sell(30);
    const down = await downPayment(sale);
    const waiting = await testApp.rawPrisma.deposit.create({
      data: {
        companyId, type: DepositType.DOWN_PAYMENT, contractId: sale.contractId, installmentId: down.id,
        amount: down.amount, paidAt: new Date(), reviewStatus: DepositReviewStatus.PENDING_REVIEW,
        receiptUrl: 'https://example.invalid/receipts/fa5.pdf', recordedById: fixtures.userIds.customer1UserId,
      },
    });
    const res = await asAdmin(http().post(`/v1/contracts/${sale.contractId}/cancel`))
      .send({ reason: 'FA5', retainedAmount: 0, refundAmount: 0 });
    expect(res.status).toBe(409);
    expect((await testApp.rawPrisma.contract.findUniqueOrThrow({ where: { id: sale.contractId } })).status).not.toBe('CANCELLED');

    // Reviewed (rejected here), the cancellation goes through.
    await asAdmin(http().post(`/v1/deposits/${waiting.id}/reject`)).send({ reason: 'not received' }).expect(201);
    await asAdmin(http().post(`/v1/contracts/${sale.contractId}/cancel`))
      .send({ reason: 'FA5', retainedAmount: 0, refundAmount: 0 })
      .expect(201);
  });

  // ── FA8: decision after a MANUAL cancellation ───────────────────────────
  /** An approved 20,000 broker commission on the sale — in a payout already paid when `paid`. */
  const commissionOn = async (s: Sale, paid: boolean) => {
    const raw = testApp.rawPrisma;
    const broker = await raw.broker.findFirstOrThrow({ where: { code: fixtures.brokerCodes.BROKER_1 } });
    const payout = paid
      ? await raw.brokerPayout.create({
          data: {
            companyId, payoutNumber: `FA-PO-${s.contractId.slice(0, 8)}`, brokerId: broker.id, period: '2026-10',
            totalGross: 20_000, totalNet: 20_000, status: 'PAID', paidAt: new Date(),
          },
        })
      : null;
    return raw.brokerCommission.create({
      data: {
        companyId, commissionNumber: `FA-BC-${s.contractId.slice(0, 8)}`, brokerId: broker.id,
        contractId: s.contractId, unitId: s.unitId, projectId, basisAmount: 1_000_000, commissionPct: 2,
        grossAmount: 20_000, netAmount: 20_000, status: 'APPROVED', earnedAt: new Date(), approvedAt: new Date(),
        payoutId: payout?.id,
      },
    });
  };
  const cancelManual = (s: Sale) =>
    asAdmin(http().post(`/v1/contracts/${s.contractId}/cancel`))
      .send({ reason: 'FA8', retainedAmount: 0, refundAmount: 0, commissionActionOverride: 'MANUAL' })
      .expect(201);
  const decisions = async (s: Sale) =>
    (await asAdmin(http().get(`/v1/contracts/${s.contractId}/cancellation`)).expect(200)).body.decisions;

  it('FA8a: a commission left open by a MANUAL cancellation is kept payable once the admin says so — once', async () => {
    const sale = await sell(50);
    const commission = await commissionOn(sale, false);
    await cancelManual(sale);
    // Waiting: neither paid nor cancelled, and the page says a decision is owed.
    expect((await testApp.rawPrisma.brokerCommission.findUniqueOrThrow({ where: { id: commission.id } })).status).toBe('APPROVED');
    expect((await decisions(sale)).commission).toMatchObject({ open: true, decision: null, amount: '20000' });

    await asAdmin(http().post(`/v1/contracts/${sale.contractId}/cancellation-decision`))
      .send({ commissionAction: 'RETAIN' })
      .expect(201);
    const kept = await testApp.rawPrisma.brokerCommission.findUniqueOrThrow({ where: { id: commission.id } });
    expect(kept.retainedOnCancellation).toBe(true);
    expect(kept.status).toBe('APPROVED');
    expect((await decisions(sale)).commission).toMatchObject({ open: false, decision: 'RETAIN' });

    // A second decision is refused — it cannot be flipped to a clawback afterwards.
    await asAdmin(http().post(`/v1/contracts/${sale.contractId}/cancellation-decision`))
      .send({ commissionAction: 'CLAWBACK' })
      .expect(409);
  });

  it('FA8b: a commission already paid is clawed back out of the next payout when the admin decides so', async () => {
    const sale = await sell(51);
    const commission = await commissionOn(sale, true);
    await cancelManual(sale);
    expect((await decisions(sale)).commission).toMatchObject({ open: true, paid: true });

    await asAdmin(http().post(`/v1/contracts/${sale.contractId}/cancellation-decision`))
      .send({ commissionAction: 'CLAWBACK', reason: 'deal fell through' })
      .expect(201);
    const after = await testApp.rawPrisma.brokerCommission.findUniqueOrThrow({ where: { id: commission.id } });
    expect(after.clawbackStatus).toBe('OUTSTANDING');
    expect(after.clawbackAmount?.toString()).toBe('20000');
    const adj = await testApp.rawPrisma.brokerCommissionAdjustment.findMany({ where: { commissionId: commission.id } });
    expect(adj).toHaveLength(1);
    expect(adj[0]).toMatchObject({ kind: 'CLAWBACK', settlesClawback: true });
    expect(adj[0]!.amount.toString()).toBe('20000');
  });

  it('FA8c: a commission settled when the contract was cancelled takes no later decision', async () => {
    const sale = await sell(52);
    const commission = await commissionOn(sale, false);
    await asAdmin(http().post(`/v1/contracts/${sale.contractId}/cancel`))
      .send({ reason: 'FA8c', retainedAmount: 0, refundAmount: 0, commissionActionOverride: 'CLAWBACK' })
      .expect(201);
    expect((await testApp.rawPrisma.brokerCommission.findUniqueOrThrow({ where: { id: commission.id } })).status).toBe('CANCELLED');
    expect((await decisions(sale)).commission).toMatchObject({ open: false, decision: null, action: 'CLAWBACK' });
    await asAdmin(http().post(`/v1/contracts/${sale.contractId}/cancellation-decision`))
      .send({ commissionAction: 'RETAIN' })
      .expect(409);
  });

  // ── FA10: Receivables & payables (المستحقات والالتزامات) agrees with the financial report ─────────────────
  it('FA10: the receivables/payables page adds up, and agrees with the financial report', async () => {
    const sale = await sell(70);
    await commissionOn(sale, false); // approved today, not paid: late on us from today
    const ledger = (qs = '') => asAdmin(http().get(`/v1/reports/ledger${qs}`)).expect(200).then((r) => r.body);
    const n = (v: string | number) => Number(v);
    const [l, fd] = await Promise.all([
      ledger(),
      asAdmin(http().get('/v1/reports/financial-dashboard')).expect(200).then((r) => r.body),
    ]);

    // Same figures as the report.
    const inst = l.receivables.groups.installments;
    expect(n(inst.amount)).toBeCloseTo(n(fd.summary.totalRemaining), 2);
    const st = inst.states;
    expect(n(st.late.amount) + n(st.dueToday.amount) + n(st.upcoming.amount) + n(st.onItsWay.amount)).toBeCloseTo(n(inst.amount), 2);
    const bc = l.payables.groups.commissions.states;
    expect(n(bc.late.amount)).toBeCloseTo(n(fd.liabilities.brokerCommissions.unpaidAmount), 2);
    expect(n(bc.pendingApproval.amount)).toBeCloseTo(n(fd.liabilities.brokerCommissions.pendingAmount), 2);
    expect(n(bc.late.amount)).toBeGreaterThanOrEqual(20_000);
    const bonus = l.payables.groups.bonuses.states;
    expect(n(bonus.late.amount)).toBeCloseTo(n(fd.liabilities.salesBonus.approvedAmount), 2);
    expect(n(bonus.pendingApproval.amount)).toBeCloseTo(n(fd.liabilities.salesBonus.pendingAmount), 2);
    expect(n(l.payables.groups.refunds.amount)).toBeCloseTo(n(fd.summary.refundsOwed), 2);
    // Totals are the sum of their groups; net = receivables − payables.
    const groupSum = (side: Record<string, { amount: string }>) => Object.values(side).reduce((s, g) => s + n(g.amount), 0);
    expect(groupSum(l.receivables.groups)).toBeCloseTo(n(l.receivables.total), 2);
    expect(groupSum(l.payables.groups)).toBeCloseTo(n(l.payables.total), 2);
    expect(n(l.receivables.total) - n(l.payables.total)).toBeCloseTo(n(l.net), 2);

    // Each group's rows add up to its figure.
    const rowsSum = async (group: string) => {
      let total = 0;
      for (let page = 1; ; page++) {
        const r = await asAdmin(http().get(`/v1/reports/ledger/rows?group=${group}&page=${page}&pageSize=200`)).expect(200);
        total += (r.body.data as Array<{ amount: string }>).reduce((s, x) => s + n(x.amount), 0);
        if (page >= r.body.meta.totalPages) return total;
      }
    };
    for (const [side, groups] of [['receivables', l.receivables.groups], ['payables', l.payables.groups]] as const) {
      for (const [group, fig] of Object.entries(groups as Record<string, { amount: string }>)) {
        expect([side, group, await rowsSum(group)]).toEqual([side, group, expect.closeTo(n(fig.amount), 2)]);
      }
    }

    // The commission is late from its approval: in a period from today, not in one from tomorrow.
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const fromToday = await ledger(`?dateFrom=${today()}&dateTo=${today()}`);
    expect(n(fromToday.payables.groups.commissions.states.late.amount)).toBeGreaterThanOrEqual(20_000);
    const rows = await asAdmin(http().get(`/v1/reports/ledger/rows?group=commissions&dateFrom=${tomorrow}`)).expect(200);
    expect((rows.body.data as Array<{ contract: { id: string } }>).some((r) => r.contract.id === sale.contractId)).toBe(false);
  });

  // ── FA6: what the customer sees ─────────────────────────────────────────
  it('FA6: the customer sees a proof under review on its row, and a reversed payment as reversed', async () => {
    const sale = await sell(40);
    const down = await downPayment(sale);
    const asCustomer = <T extends request.Test>(r: T) => r.set('Authorization', bearer(customerToken));
    const rowOf = async (id: string) => {
      const res = await asCustomer(http().get('/v1/me/installments?pageSize=500')).expect(200);
      return (res.body.data as Array<{ id: string; paymentOnItsWay: boolean }>).find((r) => r.id === id)!;
    };

    const waiting = await testApp.rawPrisma.deposit.create({
      data: {
        companyId, type: DepositType.DOWN_PAYMENT, contractId: sale.contractId, installmentId: down.id,
        amount: down.amount, paidAt: new Date(), reviewStatus: DepositReviewStatus.PENDING_REVIEW,
        receiptUrl: 'https://example.invalid/receipts/fa6.pdf', recordedById: fixtures.userIds.customer1UserId,
      },
    });
    expect((await rowOf(down.id)).paymentOnItsWay).toBe(true);

    // Approved, then reversed: it stays APPROVED, but its state says reversed.
    await asAdmin(http().post(`/v1/deposits/${waiting.id}/approve`)).send({}).expect(201);
    await asAdmin(http().post(`/v1/deposits/${waiting.id}/reverse`)).send({ reason: 'FA6' }).expect(201);
    const mine = await asCustomer(http().get('/v1/me/deposits')).expect(200);
    const dep = (mine.body.data as Array<{ id: string; reviewStatus: string; state: string }>).find((d) => d.id === waiting.id)!;
    expect(dep.reviewStatus).toBe('APPROVED');
    expect(dep.state).toBe('REVERSED');
    expect((await rowOf(down.id)).paymentOnItsWay).toBe(false);
  });
});
