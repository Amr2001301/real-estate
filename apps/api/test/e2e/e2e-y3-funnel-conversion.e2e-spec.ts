/**
 * Y3 — funnel conversion. The reports funnel divided the period's stage
 * counts by each other (contracts signed in the month over reservations made
 * in the month), so a month with deals signed from earlier bookings showed a
 * conversion of 200%–333%. Conversion now follows the period's own leads:
 * how many of them went on to a visit, a reservation and a signed contract.
 */
import 'reflect-metadata';
import request from 'supertest';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

describe('Y3 — funnel conversion follows the period’s leads (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  const leadIds: string[] = [];
  const reservationIds: string[] = [];
  const contractIds: string[] = [];
  const visitIds: string[] = [];
  // A month of its own, far from any other test's data.
  const inMonth = new Date('2003-03-10T10:00:00Z');
  const signedInMonth = new Date('2003-03-20T10:00:00Z');

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    adminToken = await loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!');
    const raw = testApp.rawPrisma;
    const companyId = (
      await raw.user.findUniqueOrThrow({ where: { id: fixtures.userIds.adminId } })
    ).companyId!;
    const unit = await raw.unit.findFirstOrThrow({
      where: { companyId },
      select: { id: true, building: { select: { phase: { select: { projectId: true } } } } },
    });
    const customerId = fixtures.userIds.customer1UserId;

    // Four leads made in the month.
    for (let i = 0; i < 4; i++) {
      leadIds.push(
        (
          await raw.lead.create({
            data: {
              companyId,
              clientId: customerId,
              fullName: `Y3 lead ${i}`,
              phone: `+2010000300${i}`,
              createdAt: inMonth,
            },
            select: { id: true },
          })
        ).id,
      );
    }
    const [visited, reservedAndSigned, reserved] = leadIds;
    // Lead 0 asked for a visit.
    visitIds.push(
      (
        await raw.visitRequest.create({
          data: {
            companyId,
            leadId: visited,
            projectId: unit.building.phase.projectId,
            preferredDate: inMonth,
            createdAt: inMonth,
          },
          select: { id: true },
        })
      ).id,
    );
    // Lead 1 reserved (no visit recorded) and signed; lead 2 reserved only.
    for (const leadId of [reservedAndSigned!, reserved!]) {
      reservationIds.push(
        (
          await raw.reservation.create({
            data: {
              companyId,
              leadId,
              unitId: unit.id,
              salesId: fixtures.userIds.salesId,
              clientId: customerId,
              expiresAt: signedInMonth,
              createdAt: inMonth,
            },
            select: { id: true },
          })
        ).id,
      );
    }
    const contract = (reservationId?: string) =>
      raw.contract.create({
        data: {
          companyId,
          customerId,
          unitId: unit.id,
          totalAmount: 1_000_000,
          signedAt: signedInMonth,
          ...(reservationId ? { reservationId } : {}),
        },
        select: { id: true },
      });
    contractIds.push((await contract(reservationIds[0])).id);
    // Three more deals signed in the month, booked before it with no lead.
    for (let i = 0; i < 3; i++) contractIds.push((await contract()).id);
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    await raw.contract.deleteMany({ where: { id: { in: contractIds } } });
    await raw.reservation.deleteMany({ where: { id: { in: reservationIds } } });
    await raw.visitRequest.deleteMany({ where: { id: { in: visitIds } } });
    await raw.lead.deleteMany({ where: { id: { in: leadIds } } });
  });

  it('Y3-1: conversion is of the month’s leads, and no stage passes the one before it', async () => {
    const res = await request(testApp.app.getHttpServer())
      .get('/v1/reports/sales-funnel?dateFrom=2003-03-01&dateTo=2003-03-31')
      .set('Authorization', bearer(adminToken))
      .expect(200);

    // The month's activity, as before: four contracts signed against two
    // reservations made (the old ratio read 200%).
    expect(res.body).toMatchObject({ leads: 4, visits: 1, reservations: 2, contracts: 4 });
    // Of the four leads: three got at least as far as a visit (the two
    // reserved ones included), two reserved, one signed.
    expect(res.body.cohort).toEqual({ leads: 4, visited: 3, reserved: 2, signed: 1 });
  });
});
