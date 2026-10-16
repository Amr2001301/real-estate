/**
 * Q4 — a broker who is suspended, held or whose agreement ended.
 *
 * Their pending reservations cannot be approved (detach first), their payouts
 * can be held by the admin, and a past agreement end date terminates them.
 */
import 'reflect-metadata';
import request from 'supertest';
import { BrokerStatus, ReservationStatus } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

describe('Q4 — suspended / held / ended broker (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  let brokerId: string;
  let reservationId: string;
  const original: { status: BrokerStatus; contractEndAt: Date | null } = { status: BrokerStatus.ACTIVE, contractEndAt: null };

  const http = () => request(testApp.app.getHttpServer());
  const asAdmin = <T extends request.Test>(r: T) => r.set('Authorization', bearer(adminToken));

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    adminToken = await loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!');
    const raw = testApp.rawPrisma;
    const broker = await raw.broker.findFirstOrThrow({
      where: { code: fixtures.brokerCodes.BROKER_1 },
      select: { id: true, status: true, contractEndAt: true, companyId: true },
    });
    brokerId = broker.id;
    original.status = broker.status;
    original.contractEndAt = broker.contractEndAt;
    const unit = await raw.unit.findFirstOrThrow({ where: { companyId: broker.companyId }, select: { id: true } });
    reservationId = (
      await raw.reservation.create({
        data: {
          companyId: broker.companyId,
          unitId: unit.id,
          salesId: fixtures.userIds.salesId,
          clientId: fixtures.userIds.customer1UserId,
          brokerId,
          status: ReservationStatus.PENDING,
          expiresAt: new Date(Date.now() + 86_400_000),
        },
        select: { id: true },
      })
    ).id;
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    await raw.reservationActivity.deleteMany({ where: { reservationId } }).catch(() => void 0);
    await raw.reservation.deleteMany({ where: { id: reservationId } }).catch(() => void 0);
    await raw.broker.update({
      where: { id: brokerId },
      data: { status: original.status, contractEndAt: original.contractEndAt, payoutHold: false },
    });
  });

  it('Q4-1: a suspended broker’s reservation cannot be approved until detached', async () => {
    await testApp.rawPrisma.broker.update({ where: { id: brokerId }, data: { status: BrokerStatus.SUSPENDED } });

    await asAdmin(http().post(`/v1/reservations/${reservationId}/approve`)).send({}).expect(409);

    await asAdmin(http().post(`/v1/reservations/${reservationId}/detach-broker`)).send({}).expect(201);
    const detached = await testApp.rawPrisma.reservation.findUniqueOrThrow({ where: { id: reservationId } });
    expect(detached.brokerId).toBeNull();

    const approve = await asAdmin(http().post(`/v1/reservations/${reservationId}/approve`)).send({});
    expect(approve.status).toBe(201);
  });

  it('Q4-2: a held broker gets no new payout until the hold is lifted', async () => {
    await testApp.rawPrisma.broker.update({ where: { id: brokerId }, data: { status: BrokerStatus.ACTIVE } });
    await asAdmin(http().post(`/v1/brokers/${brokerId}/payout-hold`)).send({ hold: true, reason: 'Q4 dispute' }).expect(201);
    expect((await testApp.rawPrisma.broker.findUniqueOrThrow({ where: { id: brokerId } })).payoutHold).toBe(true);

    await asAdmin(http().post('/v1/broker-payouts')).send({ brokerId }).expect(409);

    await asAdmin(http().post(`/v1/brokers/${brokerId}/payout-hold`)).send({ hold: false }).expect(201);
    expect((await testApp.rawPrisma.broker.findUniqueOrThrow({ where: { id: brokerId } })).payoutHold).toBe(false);
  });

  it('Q4-3: a broker whose agreement end date has passed is terminated by the daily sweep', async () => {
    await testApp.rawPrisma.broker.update({
      where: { id: brokerId },
      data: { status: BrokerStatus.ACTIVE, contractEndAt: new Date(Date.now() - 86_400_000) },
    });
    await testApp.runCronJob('broker-agreement-end');
    expect((await testApp.rawPrisma.broker.findUniqueOrThrow({ where: { id: brokerId } })).status).toBe(BrokerStatus.TERMINATED);
  });
});
