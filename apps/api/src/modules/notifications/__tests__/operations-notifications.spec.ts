import { Logger } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { MaintenanceService } from '../../maintenance/maintenance.module';
import { UsersService } from '../../users/users.service';
import { SuperAdminService } from '../../super-admin/super-admin.service';
import { runTenantContext } from '../../../common/tenant/tenant-context';

/**
 * Maintenance, accounts, the company subscription and broker teams: every
 * change reaches the people it concerns — never the user who made it.
 */
const TENANT = { companyId: 'co-1', bypass: false as const, isPublic: false as const };
const asTenant = <T>(fn: () => Promise<T>) => runTenantContext(TENANT, fn);

function makeNotifications() {
  return {
    sendToUser: jest.fn().mockResolvedValue(undefined),
    sendToUsers: jest.fn().mockResolvedValue(undefined),
    sendToRoles: jest.fn().mockResolvedValue(undefined),
    sendToUsersAndRoles: jest.fn().mockResolvedValue(undefined),
  };
}

beforeEach(() => {
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('maintenance', () => {
  const REQUEST = {
    id: 'mr-1',
    customerId: 'customer-1',
    assignedAdminId: 'supervisor-old',
    status: 'ASSIGNED',
    reviewStatus: 'PENDING',
    assignedAt: new Date(),
    unit: { code: 'B-12' },
  };

  function setup(overrides: Record<string, unknown> = {}) {
    const notifications = makeNotifications();
    const row = { ...REQUEST, ...overrides };
    const prisma = {
      maintenanceRequest: {
        findUnique: jest.fn().mockResolvedValue(row),
        update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          Object.assign(row, data);
          return row;
        }),
      },
      maintenanceRequestItem: { findMany: jest.fn().mockResolvedValue([]) },
      user: {
        findFirst: jest
          .fn()
          .mockResolvedValue({
            id: 'supervisor-new',
            role: 'MAINTENANCE_SUPERVISOR',
            active: true,
          }),
      },
    };
    const svc = new MaintenanceService(
      prisma as never,
      undefined as never,
      notifications as never,
      undefined as never,
    );
    return { svc, notifications };
  }

  it('an approval tells the customer and puts the field team to work — not the approving admin', async () => {
    const { svc, notifications } = setup();
    await asTenant(() => svc.approve('mr-1', 'admin-1'));
    expect(notifications.sendToUser).toHaveBeenCalledWith(
      'customer-1',
      'maintenance_request_status_changed',
      expect.objectContaining({ unitCode: 'B-12', entityId: 'mr-1' }),
      { except: 'admin-1' },
    );
    expect(notifications.sendToUsersAndRoles).toHaveBeenCalledWith(
      ['supervisor-old'],
      [UserRole.MAINTENANCE_SUPERVISOR],
      'maintenance_request_approved_staff',
      expect.anything(),
      { except: 'admin-1' },
    );
  });

  it('a reassignment tells the new and the previous supervisor', async () => {
    const { svc, notifications } = setup();
    jest.spyOn(svc as never, 'assertAssignableAdmin').mockResolvedValue(undefined as never);
    await asTenant(() => svc.assign('mr-1', 'supervisor-new', 'admin-1'));
    const sent = notifications.sendToUser.mock.calls.map((c) => [c[0], c[1]]);
    expect(sent).toEqual(
      expect.arrayContaining([
        ['supervisor-new', 'maintenance_request_assigned'],
        ['supervisor-old', 'maintenance_request_unassigned'],
      ]),
    );
  });

  it('a status change reaches the customer, the assignee and the admins, never the one who moved it', async () => {
    const { svc, notifications } = setup({ status: 'IN_PROGRESS', reviewStatus: 'APPROVED' });
    await asTenant(() => svc.setStatus('mr-1', 'RESOLVED' as never, 'supervisor-old'));
    expect(notifications.sendToUser).toHaveBeenCalledWith(
      'customer-1',
      'maintenance_request_resolved',
      expect.anything(),
      { except: 'supervisor-old' },
    );
    expect(notifications.sendToUsersAndRoles).toHaveBeenCalledWith(
      ['supervisor-old'],
      [UserRole.ADMIN],
      'maintenance_request_status_changed',
      expect.anything(),
      { except: 'supervisor-old' },
    );
  });
});

describe('accounts', () => {
  it('moving a sales person to a new manager tells them and both managers', async () => {
    const notifications = makeNotifications();
    const prisma = {
      user: {
        findFirst: jest.fn(async ({ select }: { select: Record<string, unknown> }) => {
          if (select?.managerId) return { managerId: 'mgr-old' };
          if (select?.fullName) return { fullName: 'هالة' };
          return { id: 'x', role: UserRole.SALES_MANAGER };
        }),
        update: jest
          .fn()
          .mockResolvedValue({ id: 'sales-1', fullName: 'كريم', managerId: 'mgr-new' }),
      },
    };
    const svc = new UsersService(prisma as never, {} as never, notifications as never, {} as never);
    await asTenant(() => svc.assignManager('sales-1', 'mgr-new'));
    expect(notifications.sendToUser).toHaveBeenCalledWith(
      'sales-1',
      'manager_assigned',
      expect.objectContaining({ managerName: 'هالة' }),
    );
    expect(notifications.sendToUser).toHaveBeenCalledWith(
      'mgr-new',
      'team_member_added',
      expect.anything(),
    );
    expect(notifications.sendToUser).toHaveBeenCalledWith(
      'mgr-old',
      'team_member_removed',
      expect.anything(),
    );
  });
});

describe('subscription', () => {
  it('the daily check tells each company its subscription expired, inside that company', async () => {
    const notifications = makeNotifications();
    const companyOf: string[] = [];
    notifications.sendToRoles.mockImplementation(async () => {
      const { getRequiredCompanyId } = await import('../../../common/tenant/tenant-context');
      companyOf.push(getRequiredCompanyId());
    });
    const prisma = {
      company: {
        findMany: jest.fn(async ({ where }: { where: { subscriptionStatus: unknown } }) =>
          where.subscriptionStatus === 'ACTIVE' ? [{ id: 'co-expired' }] : [],
        ),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const svc = new SuperAdminService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      notifications as never,
    );
    await svc.runExpiryCheck();
    expect(notifications.sendToRoles).toHaveBeenCalledWith(
      [UserRole.ADMIN],
      'subscription_expired',
      {},
    );
    expect(companyOf).toEqual(['co-expired']);
  });
});
