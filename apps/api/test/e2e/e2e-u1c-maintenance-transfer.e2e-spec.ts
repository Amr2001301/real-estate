/**
 * U1c — maintenance attachments, category codes, and what a transfer moves.
 *
 * - A maintenance photo is attached only from the key this user presigned for
 *   this request, once: an external URL or a key presigned elsewhere (another
 *   user's, or one read off a contract document) let anyone register any file
 *   and download it through the request.
 * - Category codes are unique per company: the second company to name a
 *   category got a server error.
 * - After a transfer (decision 8) the previous owner's open maintenance
 *   requests are closed, not handed to the new owner with their photos;
 *   receipts split by when they were recorded, not the customer-typed paidAt;
 *   booking payments stay with whoever paid them.
 */
import 'reflect-metadata';
import request from 'supertest';
import { DepositType, DocumentOwnerType, MaintenanceStatus, ReservationStatus, UserRole } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

describe('U1c — maintenance attachments, category codes, after a transfer (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  let customerToken: string;
  let companyId: string;
  let categoryId: string;
  let unitId: string;
  let contractId: string;
  const stamp = Date.now().toString().slice(-8);
  const startedAt = new Date();
  const key = (ext = 'jpg') => `documents/2026-10-17/${crypto.randomUUID()}.${ext}`;
  const otherCompanyIds: string[] = [];

  const http = () => request(testApp.app.getHttpServer());
  const asAdmin = <T extends request.Test>(r: T) => r.set('Authorization', bearer(adminToken));
  const asCustomer = <T extends request.Test>(r: T) => r.set('Authorization', bearer(customerToken));
  const openRequest = (description: string) =>
    testApp.rawPrisma.maintenanceRequest.create({
      data: { companyId, customerId: fixtures.userIds.customer1UserId, unitId, categoryId, description },
      select: { id: true },
    });

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    const raw = testApp.rawPrisma;
    adminToken = await loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!');
    customerToken = await loginAs(testApp.app, fixtures.users.CUSTOMER_1.email, fixtures.users.CUSTOMER_1.password, 'customer');
    companyId = (await raw.user.findUniqueOrThrow({ where: { id: fixtures.userIds.adminId } })).companyId!;
    categoryId = (await raw.maintenanceCategory.findFirstOrThrow({ where: { companyId, active: true }, select: { id: true } })).id;
    const own = await raw.contract.findUniqueOrThrow({ where: { id: fixtures.flowE.customer1ContractId }, select: { id: true, unitId: true } });
    unitId = own.unitId;
    contractId = own.id;
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    const requests = await raw.maintenanceRequest.findMany({
      where: { createdAt: { gte: startedAt }, description: { startsWith: 'U1c ' } },
      select: { id: true },
    });
    const requestIds = requests.map((r) => r.id);
    await raw.document.deleteMany({ where: { ownerType: DocumentOwnerType.MAINTENANCE_REQUEST, ownerId: { in: requestIds } } });
    await raw.presignedUpload.deleteMany({ where: { ownerId: { in: requestIds } } });
    await raw.maintenanceRequest.deleteMany({ where: { id: { in: requestIds } } });
    await raw.maintenanceCategory.deleteMany({ where: { code: { startsWith: `u1c-${stamp}` } } });
    await raw.company.deleteMany({ where: { id: { in: otherCompanyIds } } });
  });

  it('C-1: a photo is attached only from the key this user presigned for this request, once', async () => {
    const raw = testApp.rawPrisma;
    const req = await openRequest('U1c photos');
    const attach = (fileUrl: string) =>
      asCustomer(http().post(`/v1/me/maintenance-requests/${req.id}/documents`)).send({ title: 'leak', fileUrl });

    // An external URL, or a private key nobody presigned for this request.
    expect((await attach('https://evil.example/leak.jpg')).status).toBe(400);
    const contractDoc = await raw.document.findUniqueOrThrow({ where: { id: fixtures.flowE.customer2ContractDocId } });
    expect((await attach(contractDoc.fileUrl)).status).toBe(400);
    // A key presigned for another user, or for another request.
    const theirs = key();
    await raw.presignedUpload.create({
      data: {
        key: theirs, userId: fixtures.userIds.adminId, ownerType: DocumentOwnerType.MAINTENANCE_REQUEST,
        ownerId: req.id, expiresAt: new Date(Date.now() + 600_000), companyId,
      },
    });
    expect((await attach(theirs)).status).toBe(400);
    const elsewhere = await openRequest('U1c photos elsewhere');
    const otherRequest = key();
    await raw.presignedUpload.create({
      data: {
        key: otherRequest, userId: fixtures.userIds.customer1UserId, ownerType: DocumentOwnerType.MAINTENANCE_REQUEST,
        ownerId: elsewhere.id, expiresAt: new Date(Date.now() + 600_000), companyId,
      },
    });
    expect((await attach(otherRequest)).status).toBe(400);
    expect(await raw.document.count({ where: { ownerType: DocumentOwnerType.MAINTENANCE_REQUEST, ownerId: req.id } })).toBe(0);

    // Its own presigned key: attached once.
    const mine = key();
    await raw.presignedUpload.create({
      data: {
        key: mine, userId: fixtures.userIds.customer1UserId, ownerType: DocumentOwnerType.MAINTENANCE_REQUEST,
        ownerId: req.id, expiresAt: new Date(Date.now() + 600_000), companyId,
      },
    });
    expect((await attach(mine)).status).toBe(201);
    expect((await attach(mine)).status).toBe(400);
    expect(await raw.document.count({ where: { ownerType: DocumentOwnerType.MAINTENANCE_REQUEST, ownerId: req.id } })).toBe(1);
  });

  it('C-2: category codes are unique per company, and a duplicate is a 400', async () => {
    const raw = testApp.rawPrisma;
    const name = `U1c-${stamp} Plumbing`;
    const code = `u1c-${stamp}-plumbing`;
    const other = await raw.company.create({ data: { name: `U1c Other ${stamp}`, slug: `u1c-other-${stamp}` }, select: { id: true } });
    otherCompanyIds.push(other.id);
    await raw.maintenanceCategory.create({ data: { companyId: other.id, code, name: { ar: name, en: name } } });

    const created = await asAdmin(http().post('/v1/maintenance-categories')).send({ ar: name, en: name });
    expect(created.status).toBe(201);
    expect(created.body.code).toBe(code);
    const again = await asAdmin(http().post('/v1/maintenance-categories')).send({ ar: name, en: name });
    expect(again.status).toBe(400);
  });

  it('C-3: a transfer closes the previous owner’s open requests; receipts split by when they were recorded', async () => {
    const raw = testApp.rawPrisma;
    const open = await openRequest('U1c open at transfer');
    const contract = await raw.contract.findUniqueOrThrow({ where: { id: contractId }, select: { reservationId: true } });
    const newOwner = await raw.user.create({
      data: { companyId, role: UserRole.CLIENT, fullName: 'U1c New Owner', phone: `+2014${stamp}`, locale: 'ar' },
      select: { id: true },
    });
    // A booking paid by the current owner, on the contract's reservation.
    const reservation = await raw.reservation.create({
      data: {
        companyId, unitId, salesId: fixtures.userIds.salesId, clientId: fixtures.userIds.customer1UserId,
        status: ReservationStatus.CONVERTED, expiresAt: new Date(), reservationNumber: `U1C-${stamp}`,
      },
      select: { id: true },
    });
    if (!contract.reservationId) await raw.contract.update({ where: { id: contractId }, data: { reservationId: reservation.id } });
    const reservationId = contract.reservationId ?? reservation.id;
    const depositIds: string[] = [];
    const booking = await raw.deposit.create({
      data: {
        companyId, reservationId, type: DepositType.BOOKING_AMOUNT, amount: 1000,
        paidAt: new Date(), recordedById: fixtures.userIds.adminId,
      },
      select: { id: true },
    });
    depositIds.push(booking.id);
    try {
      await asAdmin(http().post(`/v1/contracts/${contractId}/transfer`))
        .send({ toCustomerId: newOwner.id, reason: 'U1c transfer', feeAmount: 0 })
        .expect(201);
      const closed = await raw.maintenanceRequest.findUniqueOrThrow({ where: { id: open.id } });
      expect(closed.status).toBe(MaintenanceStatus.CLOSED);
      expect(closed.customerId).toBe(fixtures.userIds.customer1UserId);

      // Recorded after the transfer, with a paidAt typed as before it: the new owner's.
      const late = await raw.deposit.create({
        data: {
          companyId, contractId, type: DepositType.INSTALLMENT, amount: 500,
          paidAt: new Date(Date.now() - 30 * 86_400_000), recordedById: fixtures.userIds.adminId,
        },
        select: { id: true },
      });
      depositIds.push(late.id);
      const newToken = await testApp.signAccessToken(newOwner.id, UserRole.CUSTOMER);
      const mine = await http().get('/v1/me/deposits').set('Authorization', bearer(newToken)).expect(200);
      const ids = (mine.body.data as Array<{ id: string }>).map((d) => d.id);
      expect(ids).toContain(late.id);
      // The booking stays with whoever paid it.
      expect(ids).not.toContain(booking.id);
      const theirMaintenance = await http().get('/v1/me/maintenance-requests').set('Authorization', bearer(newToken));
      for (const r of (theirMaintenance.body.data ?? theirMaintenance.body ?? []) as Array<{ id: string }>) {
        expect(r.id).not.toBe(open.id);
      }
    } finally {
      await asAdmin(http().post(`/v1/contracts/${contractId}/transfer`))
        .send({ toCustomerId: fixtures.userIds.customer1UserId, reason: 'U1c transfer back', feeAmount: 0 })
        .expect(201);
      await raw.deposit.deleteMany({ where: { id: { in: depositIds } } });
      if (!contract.reservationId) await raw.contract.update({ where: { id: contractId }, data: { reservationId: null } });
      await raw.reservation.deleteMany({ where: { id: reservation.id } });
      await raw.contractAmendment.deleteMany({ where: { contractId, createdAt: { gte: startedAt } } });
      await raw.refreshToken.deleteMany({ where: { userId: newOwner.id } });
      await raw.user.delete({ where: { id: newOwner.id } });
    }
  });
});
