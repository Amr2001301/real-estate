/**
 * AA2 — a booking paid by cheque. Confirming the booking amount "by cheque"
 * marked it PAID at once and created no cheque: nothing on the Cheques
 * screen tracked it, and a bounce changed nothing. Now the cheque waits on
 * the Cheques screen, the booking is PENDING (money held) until it clears,
 * and a bounce leaves it unpaid.
 */
import 'reflect-metadata';
import request from 'supertest';
import { ReservationBookingPaymentStatus, ReservationStatus } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

describe('AA2 — a booking paid by cheque waits for the cheque (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  const reservationIds: string[] = [];
  const instrumentIds: string[] = [];
  const stamp = Date.now().toString().slice(-7);

  const http = () => request(testApp.app.getHttpServer());
  const asAdmin = <T extends request.Test>(r: T) => r.set('Authorization', bearer(adminToken));
  const booking = async (id: string) =>
    await testApp.rawPrisma.reservation.findUniqueOrThrow({
      where: { id },
      select: { bookingPaymentStatus: true, bookingPaidAt: true },
    });

  /** An approved reservation with a 50,000 booking, confirmed by cheque. */
  const bookByCheque = async (n: number) => {
    const raw = testApp.rawPrisma;
    const companyId = (
      await raw.user.findUniqueOrThrow({ where: { id: fixtures.userIds.adminId } })
    ).companyId!;
    const unit = await raw.unit.findFirstOrThrow({ where: { companyId }, select: { id: true } });
    const reservation = await raw.reservation.create({
      data: {
        companyId,
        unitId: unit.id,
        salesId: fixtures.userIds.salesId,
        clientId: fixtures.userIds.customer1UserId,
        status: ReservationStatus.APPROVED,
        bookingAmount: 50_000,
        expiresAt: new Date(Date.now() + 3 * 86_400_000),
      },
      select: { id: true },
    });
    reservationIds.push(reservation.id);
    await asAdmin(http().post(`/v1/reservations/${reservation.id}/booking-payment/confirm`))
      .send({
        paymentMethod: 'CHEQUE',
        cheque: { chequeNumber: `AA2-${stamp}-${n}`, chequeDueDate: '2026-11-01' },
      })
      .expect(201);
    const deposit = await raw.deposit.findFirstOrThrow({
      where: { reservationId: reservation.id },
      select: { reviewStatus: true, paymentInstrumentId: true },
    });
    instrumentIds.push(deposit.paymentInstrumentId!);
    return { reservationId: reservation.id, instrumentId: deposit.paymentInstrumentId!, deposit };
  };

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    adminToken = await loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!');
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    await raw.deposit.deleteMany({ where: { reservationId: { in: reservationIds } } });
    await raw.paymentInstrument.deleteMany({ where: { id: { in: instrumentIds } } });
    await raw.reservationActivity.deleteMany({ where: { reservationId: { in: reservationIds } } });
    await raw.auditLog.deleteMany({
      where: { entityId: { in: [...reservationIds, ...instrumentIds] } },
    });
    await raw.reservation.deleteMany({ where: { id: { in: reservationIds } } });
  });

  it('AA2-1: the cheque is on the Cheques screen and the booking waits, then is paid when it clears', async () => {
    const { reservationId, instrumentId, deposit } = await bookByCheque(1);
    expect(deposit.reviewStatus).toBe('PENDING_REVIEW');
    expect((await booking(reservationId)).bookingPaymentStatus).toBe(
      ReservationBookingPaymentStatus.PENDING,
    );

    const listed = await asAdmin(http().get(`/v1/payment-instruments?q=AA2-${stamp}-1`)).expect(
      200,
    );
    expect(listed.body.data).toHaveLength(1);
    expect(listed.body.data[0].deposits[0].reservation.id).toBe(reservationId);

    await asAdmin(http().post(`/v1/payment-instruments/${instrumentId}/deposit`))
      .send({})
      .expect(200);
    await asAdmin(http().post(`/v1/payment-instruments/${instrumentId}/clear`))
      .send({ clearingDate: '2026-11-02' })
      .expect(200);
    const after = await booking(reservationId);
    expect(after.bookingPaymentStatus).toBe(ReservationBookingPaymentStatus.PAID);
    expect(after.bookingPaidAt?.toISOString().slice(0, 10)).toBe('2026-11-02');
  });

  it('AA2-2: a bounced booking cheque leaves the booking unpaid', async () => {
    const { reservationId, instrumentId } = await bookByCheque(2);
    await asAdmin(http().post(`/v1/payment-instruments/${instrumentId}/deposit`))
      .send({})
      .expect(200);
    await asAdmin(http().post(`/v1/payment-instruments/${instrumentId}/bounce`))
      .send({ bounceReason: 'رصيد غير كافٍ', bounceDate: '2026-11-02', penaltyAmount: 0 })
      .expect(200);
    expect((await booking(reservationId)).bookingPaymentStatus).toBe(
      ReservationBookingPaymentStatus.UNPAID,
    );
  });
});
