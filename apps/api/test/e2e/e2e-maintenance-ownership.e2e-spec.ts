/**
 * R2 — maintenance follows the owner of the unit.
 *
 * A customer files only on a unit they own; a transfer hands the open
 * requests to the new owner; a rejected request is finished; a unit put back
 * on sale loses the previous buyer's warranties; a deactivated supervisor's
 * open work goes back to the queue.
 */
import 'reflect-metadata';
import request from 'supertest';
import { ContractStatus, MaintenanceReviewStatus, MaintenanceStatus, UnitStatus, UserRole } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

describe('R2 — maintenance ownership (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  let customerToken: string;
  let companyId: string;
  let categoryId: string;
  let ownUnitId: string;
  let contractId: string;
  const stamp = Date.now().toString().slice(-8);
  const startedAt = new Date();

  const http = () => request(testApp.app.getHttpServer());
  const asAdmin = <T extends request.Test>(r: T) => r.set('Authorization', bearer(adminToken));

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    const raw = testApp.rawPrisma;
    adminToken = await loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!');
    customerToken = await loginAs(testApp.app, fixtures.users.CUSTOMER_1.email, fixtures.users.CUSTOMER_1.password, 'customer');
    companyId = (await raw.user.findUniqueOrThrow({ where: { id: fixtures.userIds.adminId } })).companyId!;
    categoryId = (await raw.maintenanceCategory.findFirstOrThrow({ where: { companyId, active: true }, select: { id: true } })).id;
    const own = await raw.contract.findUniqueOrThrow({ where: { id: fixtures.flowE.customer1ContractId }, select: { id: true, unitId: true } });
    ownUnitId = own.unitId;
    contractId = own.id;
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    await raw.maintenanceRequestItem.deleteMany({ where: { request: { createdAt: { gte: startedAt }, description: { startsWith: 'R2 ' } } } });
    await raw.maintenanceRequest.deleteMany({ where: { createdAt: { gte: startedAt }, description: { startsWith: 'R2 ' } } });
    await raw.contractAmendment.deleteMany({ where: { contractId, createdAt: { gte: startedAt } } });
  });

  it('R2-1: a customer files only on a unit they own', async () => {
    const notMine = await testApp.rawPrisma.unit.findFirstOrThrow({
      where: { companyId, id: { not: ownUnitId }, contracts: { none: { customerId: fixtures.userIds.customer1UserId } } },
      select: { id: true },
    });
    await http()
      .post('/v1/me/maintenance-requests')
      .set('Authorization', bearer(customerToken))
      .send({ unitId: notMine.id, categoryIds: [categoryId], description: 'R2 not my unit' })
      .expect(404);
    await http()
      .post('/v1/me/maintenance-requests')
      .set('Authorization', bearer(customerToken))
      .send({ unitId: ownUnitId, categoryIds: [categoryId], description: 'R2 my unit' })
      .expect(201);
  });

  it('R2-2: a transfer hands open requests to the new owner (and back)', async () => {
    const raw = testApp.rawPrisma;
    const open = await raw.maintenanceRequest.findFirstOrThrow({
      where: { description: 'R2 my unit', createdAt: { gte: startedAt } },
      select: { id: true },
    });
    const newOwner = await raw.user.create({
      data: { companyId, role: UserRole.CLIENT, fullName: 'R2 New Owner', phone: `+2013${stamp}`, locale: 'ar' },
      select: { id: true },
    });
    try {
      await asAdmin(http().post(`/v1/contracts/${contractId}/transfer`))
        .send({ toCustomerId: newOwner.id, reason: 'R2 transfer', feeAmount: 0 })
        .expect(201);
      expect((await raw.maintenanceRequest.findUniqueOrThrow({ where: { id: open.id } })).customerId).toBe(newOwner.id);
    } finally {
      await asAdmin(http().post(`/v1/contracts/${contractId}/transfer`))
        .send({ toCustomerId: fixtures.userIds.customer1UserId, reason: 'R2 transfer back', feeAmount: 0 })
        .expect(201);
      expect((await raw.maintenanceRequest.findUniqueOrThrow({ where: { id: open.id } })).customerId).toBe(
        fixtures.userIds.customer1UserId,
      );
      await raw.refreshToken.deleteMany({ where: { userId: newOwner.id } });
      await raw.user.delete({ where: { id: newOwner.id } });
    }
  });

  it('R2-3: a rejected request is finished — it cannot be worked on', async () => {
    const raw = testApp.rawPrisma;
    const req = await raw.maintenanceRequest.create({
      data: {
        companyId,
        customerId: fixtures.userIds.customer1UserId,
        unitId: ownUnitId,
        categoryId,
        description: 'R2 to reject',
        reviewStatus: MaintenanceReviewStatus.PENDING,
      },
      select: { id: true },
    });
    await asAdmin(http().post(`/v1/maintenance-requests/${req.id}/reject`)).send({}).expect(201);
    const row = await raw.maintenanceRequest.findUniqueOrThrow({ where: { id: req.id } });
    expect(row.reviewStatus).toBe(MaintenanceReviewStatus.REJECTED);
    await asAdmin(http().post(`/v1/maintenance-requests/${req.id}/status`))
      .send({ status: MaintenanceStatus.IN_PROGRESS })
      .expect(400);
  });

  it('R2-4: a sold unit put back on sale loses the previous buyer’s warranties', async () => {
    const raw = testApp.rawPrisma;
    const unit = await raw.unit.findFirstOrThrow({
      where: {
        companyId,
        status: UnitStatus.AVAILABLE,
        contracts: { none: { status: { not: ContractStatus.CANCELLED }, deletedAt: null } },
        reservations: { none: { status: { in: ['PENDING', 'APPROVED'] } } },
      },
      select: { id: true },
    });
    await raw.unit.update({ where: { id: unit.id }, data: { status: UnitStatus.SOLD } });
    const item = await raw.unitMaintenanceItem.create({
      data: {
        companyId,
        unitId: unit.id,
        categoryId,
        name: { ar: 'تكييف', en: 'AC' },
        warrantyStart: new Date('2025-01-01'),
        warrantyEnd: new Date('2026-01-01'),
        warrantyDurationMonthsSnapshot: 12,
      },
      select: { id: true },
    });
    try {
      await asAdmin(http().patch(`/v1/units/${unit.id}/status`)).send({ status: UnitStatus.AVAILABLE }).expect(200);
      const after = await raw.unitMaintenanceItem.findUniqueOrThrow({ where: { id: item.id } });
      expect([after.warrantyStart, after.warrantyEnd]).toEqual([null, null]);
    } finally {
      await raw.unitMaintenanceItem.delete({ where: { id: item.id } });
      await raw.unit.update({ where: { id: unit.id }, data: { status: UnitStatus.AVAILABLE } });
      await raw.unitStatusHistory.deleteMany({ where: { unitId: unit.id, changedAt: { gte: startedAt } } });
    }
  });

  it('R2-5: deactivating a supervisor puts their open work back in the queue', async () => {
    const raw = testApp.rawPrisma;
    const sup = await raw.user.create({
      data: { companyId, role: UserRole.MAINTENANCE_SUPERVISOR, fullName: 'R2 Supervisor', email: `r2-sup-${stamp}@example.com`, locale: 'ar' },
      select: { id: true },
    });
    const req = await raw.maintenanceRequest.create({
      data: {
        companyId,
        customerId: fixtures.userIds.customer1UserId,
        unitId: ownUnitId,
        categoryId,
        description: 'R2 assigned',
        reviewStatus: MaintenanceReviewStatus.APPROVED,
        status: MaintenanceStatus.ASSIGNED,
        assignedAdminId: sup.id,
      },
      select: { id: true },
    });
    await asAdmin(http().patch(`/v1/users/${sup.id}/deactivate`)).expect(200);
    const row = await raw.maintenanceRequest.findUniqueOrThrow({ where: { id: req.id } });
    expect([row.status, row.assignedAdminId]).toEqual([MaintenanceStatus.OPEN, null]);
    await raw.maintenanceRequest.delete({ where: { id: req.id } });
    await raw.user.delete({ where: { id: sup.id } });
  });
});
