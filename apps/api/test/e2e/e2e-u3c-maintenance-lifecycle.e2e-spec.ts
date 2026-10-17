/**
 * U3c — maintenance after the customer leaves, the supervisor leaves, and
 * warranty dates once started.
 *
 * - A request closed because the customer no longer holds the unit is
 *   finished: a resolved one is closed too, one waiting for review is
 *   rejected, and it can no longer be approved, assigned or confirmed.
 * - A supervisor who leaves: work in progress goes back to the queue (OPEN,
 *   unassigned), a resolved request is unassigned for a colleague.
 * - A started warranty keeps its start date; its end may only be extended,
 *   with a reason, on the audit log.
 */
import 'reflect-metadata';
import request from 'supertest';
import {
  ContractStatus,
  MaintenanceReviewStatus,
  MaintenanceStatus,
  UnitStatus,
  UserRole,
} from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

const DAY = 86_400_000;

describe('U3c — maintenance lifecycle (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let adminToken: string;
  let companyId: string;
  let categoryId: string;
  let customerId: string;
  let otherId: string;
  let supervisorId: string;
  let unitId: string;
  let unitStatus: UnitStatus;
  let contractId: string;
  let itemId: string;
  const stamp = Date.now().toString().slice(-8);
  const startedAt = new Date();

  const http = () => request(testApp.app.getHttpServer());
  const asAdmin = <T extends request.Test>(r: T) => r.set('Authorization', bearer(adminToken));
  const maintenance = (data: {
    status: MaintenanceStatus;
    reviewStatus: MaintenanceReviewStatus;
    assignedAdminId?: string;
    resolvedAt?: Date;
  }) =>
    testApp.rawPrisma.maintenanceRequest.create({
      data: { companyId, customerId, unitId, categoryId, description: `U3c ${data.status}`, ...data },
      select: { id: true },
    });
  const reqRow = (id: string) => testApp.rawPrisma.maintenanceRequest.findUniqueOrThrow({ where: { id } });

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    adminToken = await loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!');
    const raw = testApp.rawPrisma;
    companyId = (await raw.user.findUniqueOrThrow({ where: { id: fixtures.userIds.adminId } })).companyId!;
    categoryId = (await raw.maintenanceCategory.findFirstOrThrow({ where: { companyId, active: true }, select: { id: true } })).id;
    const person = (n: string, role: UserRole) =>
      raw.user.create({
        data: { companyId, role, fullName: `U3c ${n}`, phone: `+2017${n}${stamp}`, locale: 'ar' },
        select: { id: true },
      });
    customerId = (await person('1', UserRole.CUSTOMER)).id;
    otherId = (await person('2', UserRole.CLIENT)).id;
    supervisorId = (await person('3', UserRole.MAINTENANCE_SUPERVISOR)).id;
    const unit = await raw.unit.findFirstOrThrow({
      where: { companyId, status: UnitStatus.AVAILABLE, contracts: { none: {} }, reservations: { none: {} } },
      select: { id: true, status: true },
    });
    unitId = unit.id;
    unitStatus = unit.status;
    await raw.unit.update({ where: { id: unitId }, data: { status: UnitStatus.SOLD } });
    contractId = (
      await raw.contract.create({
        data: {
          companyId, customerId, unitId, totalAmount: 100_000, status: ContractStatus.ACTIVE,
          signedAt: new Date(), contractNumber: `U3C-${stamp}`,
        },
        select: { id: true },
      })
    ).id;
    itemId = (
      await raw.unitMaintenanceItem.create({
        data: {
          companyId, unitId, categoryId, name: { ar: 'سباكة', en: 'Plumbing' },
          warrantyStart: new Date(Date.now() - 30 * DAY), warrantyEnd: new Date(Date.now() + 300 * DAY),
          warrantyDurationMonthsSnapshot: 12,
        },
        select: { id: true },
      })
    ).id;
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    await raw.maintenanceRequest.deleteMany({ where: { unitId, createdAt: { gte: startedAt } } });
    await raw.unitMaintenanceItem.deleteMany({ where: { id: itemId } });
    await raw.auditLog.deleteMany({ where: { entityId: { in: [contractId, itemId] }, createdAt: { gte: startedAt } } });
    await raw.contractAmendment.deleteMany({ where: { contractId } });
    await raw.contract.deleteMany({ where: { id: contractId } });
    await raw.unit.update({ where: { id: unitId }, data: { status: unitStatus } });
    const ids = [customerId, otherId, supervisorId];
    await raw.notification.deleteMany({ where: { userId: { in: ids } } });
    await raw.refreshToken.deleteMany({ where: { userId: { in: ids } } });
    await raw.user.deleteMany({ where: { id: { in: ids } } });
  });

  it('M-1: a request closed when the customer leaves the unit is finished', async () => {
    const pending = await maintenance({ status: MaintenanceStatus.OPEN, reviewStatus: MaintenanceReviewStatus.PENDING });
    const resolved = await maintenance({
      status: MaintenanceStatus.RESOLVED, reviewStatus: MaintenanceReviewStatus.APPROVED, resolvedAt: new Date(),
    });
    await asAdmin(http().post(`/v1/contracts/${contractId}/transfer`))
      .send({ toCustomerId: otherId, reason: 'U3c transfer', feeAmount: 0 })
      .expect(201);

    const p = await reqRow(pending.id);
    expect(p.status).toBe(MaintenanceStatus.CLOSED);
    expect(p.reviewStatus).toBe(MaintenanceReviewStatus.REJECTED);
    expect((await reqRow(resolved.id)).status).toBe(MaintenanceStatus.CLOSED);

    expect((await asAdmin(http().post(`/v1/maintenance-requests/${pending.id}/approve`)).send({})).status).toBe(400);
    expect(
      (await asAdmin(http().post(`/v1/maintenance-requests/${resolved.id}/assign`)).send({ assignedAdminId: fixtures.userIds.adminId }))
        .status,
    ).toBe(400);
    // Closed without the work done is not a resolution to confirm (the
    // transfer made the new owner a customer; their request closed unresolved).
    const closedUnresolved = await testApp.rawPrisma.maintenanceRequest.create({
      data: {
        companyId, customerId: otherId, unitId, categoryId, description: 'U3c closed unresolved',
        status: MaintenanceStatus.CLOSED, reviewStatus: MaintenanceReviewStatus.APPROVED, closedAt: new Date(),
      },
      select: { id: true },
    });
    const token = await testApp.signAccessToken(otherId, UserRole.CUSTOMER);
    const confirm = await http()
      .post(`/v1/me/maintenance-requests/${closedUnresolved.id}/confirm-resolution`)
      .set('Authorization', bearer(token))
      .send({ rating: 5 });
    expect(confirm.status).toBe(400);
  });

  it('M-2: a supervisor who leaves — their open work goes back to the queue', async () => {
    const working = await maintenance({
      status: MaintenanceStatus.IN_PROGRESS, reviewStatus: MaintenanceReviewStatus.APPROVED, assignedAdminId: supervisorId,
    });
    const waiting = await maintenance({
      status: MaintenanceStatus.RESOLVED, reviewStatus: MaintenanceReviewStatus.APPROVED, assignedAdminId: supervisorId,
      resolvedAt: new Date(),
    });
    await asAdmin(http().patch(`/v1/users/${supervisorId}/deactivate`)).expect(200);
    const w = await reqRow(working.id);
    expect(w.status).toBe(MaintenanceStatus.OPEN);
    expect(w.assignedAdminId).toBeNull();
    const r = await reqRow(waiting.id);
    expect(r.status).toBe(MaintenanceStatus.RESOLVED);
    expect(r.assignedAdminId).toBeNull();
  });

  it('M-3: a started warranty is only extended, with a reason, on the audit log', async () => {
    const patch = (body: Record<string, unknown>) =>
      asAdmin(http().patch(`/v1/units/${unitId}/maintenance-items/${itemId}`)).send(body);
    const item = await testApp.rawPrisma.unitMaintenanceItem.findUniqueOrThrow({ where: { id: itemId } });
    const shorter = new Date(item.warrantyEnd!.getTime() - 100 * DAY).toISOString();
    const longer = new Date(item.warrantyEnd!.getTime() + 180 * DAY).toISOString();

    expect((await patch({ warrantyEnd: shorter })).status).toBe(400);
    expect((await patch({ warrantyStart: new Date().toISOString() })).status).toBe(400);
    expect((await patch({ warrantyEnd: longer })).status).toBe(400); // no reason
    expect((await patch({ warrantyEnd: longer, warrantyChangeReason: 'Supplier extended the cover' })).status).toBe(200);

    const after = await testApp.rawPrisma.unitMaintenanceItem.findUniqueOrThrow({ where: { id: itemId } });
    expect(after.warrantyEnd!.toISOString()).toBe(longer);
    expect(after.warrantyStart!.getTime()).toBe(item.warrantyStart!.getTime());
    const audit = await testApp.rawPrisma.auditLog.findFirst({
      where: { entityId: itemId, action: 'unit-maintenance-item.warranty-extended' },
    });
    expect(audit).not.toBeNull();
  });
});
