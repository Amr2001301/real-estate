/**
 * U3e — a customer deletes their own account (round-4 decision 9; required
 * by the App Store and Google Play).
 *
 * - DELETE /users/me deactivates the account and removes its personal data
 *   (name, phone, e-mail, password, photo); its sessions end. The records it
 *   is part of stay.
 * - Refused while the customer has a live contract or an open reservation.
 * - Staff cannot use it.
 */
import 'reflect-metadata';
import request from 'supertest';
import { ContractStatus, ReservationStatus, UnitStatus, UserRole } from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import { bearer, loginAs } from '../helpers/login';

describe('U3e — customer account deletion (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let companyId: string;
  let unitId: string;
  let unitStatus: UnitStatus;
  const createdIds: string[] = [];
  const contractIds: string[] = [];
  const reservationIds: string[] = [];
  const stamp = Date.now().toString().slice(-7);
  const startedAt = new Date();

  const http = () => request(testApp.app.getHttpServer());
  const person = async (n: string, role: UserRole) => {
    const u = await testApp.rawPrisma.user.create({
      data: {
        companyId, role, fullName: `U3e ${n}`, phone: `+2019${n}${stamp}`, email: `u3e-${n}-${stamp}@example.com`,
        passwordHash: 'x', locale: 'ar',
      },
      select: { id: true },
    });
    createdIds.push(u.id);
    return { id: u.id, token: await testApp.signAccessToken(u.id, role) };
  };
  const deleteMe = (token: string) => http().delete('/v1/users/me').set('Authorization', bearer(token));

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    const raw = testApp.rawPrisma;
    companyId = (await raw.user.findUniqueOrThrow({ where: { id: fixtures.userIds.adminId } })).companyId!;
    const unit = await raw.unit.findFirstOrThrow({
      where: { companyId, status: UnitStatus.AVAILABLE, contracts: { none: {} }, reservations: { none: {} } },
      select: { id: true, status: true },
    });
    unitId = unit.id;
    unitStatus = unit.status;
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    await raw.reservation.deleteMany({ where: { id: { in: reservationIds } } });
    await raw.contract.deleteMany({ where: { id: { in: contractIds } } });
    await raw.unit.update({ where: { id: unitId }, data: { status: unitStatus } });
    await raw.auditLog.deleteMany({ where: { entityId: { in: createdIds }, createdAt: { gte: startedAt } } });
    await raw.refreshToken.deleteMany({ where: { userId: { in: createdIds } } });
    await raw.user.deleteMany({ where: { id: { in: createdIds } } });
  });

  it('D-1: refused while the customer has a live contract', async () => {
    const c = await person('1', UserRole.CUSTOMER);
    await testApp.rawPrisma.unit.update({ where: { id: unitId }, data: { status: UnitStatus.SOLD } });
    contractIds.push(
      (
        await testApp.rawPrisma.contract.create({
          data: { companyId, customerId: c.id, unitId, totalAmount: 1000, status: ContractStatus.ACTIVE, signedAt: new Date() },
          select: { id: true },
        })
      ).id,
    );
    const res = await deleteMe(c.token);
    expect(res.status).toBe(409);
    expect(res.body.code ?? res.body.message?.code).toBe('CUSTOMER_HAS_LIVE_CONTRACT');
    expect((await testApp.rawPrisma.user.findUniqueOrThrow({ where: { id: c.id } })).deletedAt).toBeNull();
  });

  it('D-2: refused while the client has an open reservation', async () => {
    const c = await person('2', UserRole.CLIENT);
    reservationIds.push(
      (
        await testApp.rawPrisma.reservation.create({
          data: {
            companyId, unitId, salesId: fixtures.userIds.salesId, clientId: c.id, status: ReservationStatus.PENDING,
            expiresAt: new Date(Date.now() + 86_400_000), reservationNumber: `U3E-${stamp}`,
          },
          select: { id: true },
        })
      ).id,
    );
    const res = await deleteMe(c.token);
    expect(res.status).toBe(409);
    expect(res.body.code ?? res.body.message?.code).toBe('CUSTOMER_HAS_OPEN_RESERVATION');
  });

  it('D-3: otherwise the account is deactivated and its personal data removed', async () => {
    const raw = testApp.rawPrisma;
    const c = await person('3', UserRole.CLIENT);
    await raw.refreshToken.create({
      data: { userId: c.id, tokenHash: `u3e-${stamp}`, expiresAt: new Date(Date.now() + 86_400_000) },
    });
    await deleteMe(c.token).expect(200);
    const user = await raw.user.findUniqueOrThrow({ where: { id: c.id } });
    expect(user).toMatchObject({ phone: null, email: null, passwordHash: null, avatarUrl: null, active: false });
    expect(user.fullName).not.toContain('U3e');
    expect(user.deletedAt).not.toBeNull();
    expect(await raw.refreshToken.count({ where: { userId: c.id, revokedAt: null } })).toBe(0);
    expect(await raw.auditLog.count({ where: { entityId: c.id, action: 'user.self-deleted' } })).toBe(1);
  });

  it('D-4: staff cannot delete themselves this way', async () => {
    const admin = await loginAs(testApp.app, 'admin@example.com', 'ChangeMe123!');
    expect((await deleteMe(admin)).status).toBe(403);
  });
});
