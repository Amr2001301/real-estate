import { BadRequestException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { VisitsService } from '../visits.service';
import type { PrismaService } from '../../../common/prisma/prisma.service';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';

/**
 * SALES_MANAGER visit-assignment scope (sales-actor batch).
 *
 * A SALES_MANAGER may assign a visit only within their own scope (self + team).
 * This exercises the assignment validator that createDirectAppointment uses,
 * without booting the full create transaction.
 *
 * Team fixture: MANAGER_ID owns [TEAM_SALES_ID]. OUT_SALES_ID is a SALES rep on
 * another team; OTHER_MANAGER_ID is a different SALES_MANAGER.
 */
const MANAGER_ID = 'm0000000-0000-4000-8000-000000000001';
const TEAM_SALES_ID = 's0000000-0000-4000-8000-000000000002';
const OUT_SALES_ID = 's0000000-0000-4000-8000-000000000003';
const OTHER_MANAGER_ID = 'm0000000-0000-4000-8000-000000000004';
const INACTIVE_SALES_ID = 's0000000-0000-4000-8000-000000000005';

const USERS: Record<string, { id: string; role: UserRole; active: boolean }> = {
  [MANAGER_ID]: { id: MANAGER_ID, role: UserRole.SALES_MANAGER, active: true },
  [TEAM_SALES_ID]: { id: TEAM_SALES_ID, role: UserRole.SALES, active: true },
  [OUT_SALES_ID]: { id: OUT_SALES_ID, role: UserRole.SALES, active: true },
  [OTHER_MANAGER_ID]: { id: OTHER_MANAGER_ID, role: UserRole.SALES_MANAGER, active: true },
  [INACTIVE_SALES_ID]: { id: INACTIVE_SALES_ID, role: UserRole.SALES, active: false },
};

function makeService() {
  const prisma = {
    user: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => USERS[where.id] ?? null),
      // managerScopeIds → teamSalesIds: SALES reps whose managerId = this manager.
      findMany: jest.fn(async ({ where }: { where: { role: UserRole; managerId?: string } }) =>
        where.managerId === MANAGER_ID ? [{ id: TEAM_SALES_ID }] : [],
      ),
    },
  } as unknown as PrismaService;
  // Notification surface isn't exercised by this scope test — pass a stub
  // that returns void for every helper.
  const notifications = {
    sendToUser: jest.fn().mockResolvedValue(undefined),
    sendToUsers: jest.fn().mockResolvedValue(undefined),
    sendToRoles: jest.fn().mockResolvedValue(undefined),
  } as unknown as import('../../notifications/notifications.module').NotificationsService;
  const svc = new VisitsService(prisma, notifications);
  const resolve = (
    svc as unknown as {
      resolveAssignableSalesId: (salesId: string, user: AuthUser) => Promise<string>;
    }
  ).resolveAssignableSalesId.bind(svc);
  return { resolve };
}

const manager: AuthUser = {
  sub: MANAGER_ID,
  role: UserRole.SALES_MANAGER,
  email: null,
  phone: null,
};

describe('Visits · SALES_MANAGER assignment scope', () => {
  it('manager can assign to themselves (self in scope)', async () => {
    const { resolve } = makeService();
    await expect(resolve(MANAGER_ID, manager)).resolves.toBe(MANAGER_ID);
  });

  it('manager can assign to a team member', async () => {
    const { resolve } = makeService();
    await expect(resolve(TEAM_SALES_ID, manager)).resolves.toBe(TEAM_SALES_ID);
  });

  it('manager cannot assign to an out-of-team SALES rep', async () => {
    const { resolve } = makeService();
    await expect(resolve(OUT_SALES_ID, manager)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('manager cannot assign to another SALES_MANAGER', async () => {
    const { resolve } = makeService();
    await expect(resolve(OTHER_MANAGER_ID, manager)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an inactive sales rep', async () => {
    const { resolve } = makeService();
    await expect(resolve(INACTIVE_SALES_ID, manager)).rejects.toBeInstanceOf(BadRequestException);
  });
});
