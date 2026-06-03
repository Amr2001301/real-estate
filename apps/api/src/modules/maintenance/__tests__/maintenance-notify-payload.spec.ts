import { MaintenanceService } from '../maintenance.module';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.module';

/**
 * Maintenance notifications must carry deep-link metadata (entityType/entityId/
 * requestId/action) so the admin + customer notification UIs can route to the
 * maintenance request. Exercises the real MaintenanceService against mocks.
 */

function makeService(prisma: Record<string, unknown>) {
  const notifications = {
    sendToRoles: jest.fn().mockResolvedValue(undefined),
    sendToUser: jest.fn().mockResolvedValue(undefined),
  };
  const svc = new MaintenanceService(
    prisma as unknown as PrismaService,
    undefined as never, // documents — unused on these paths
    notifications as unknown as NotificationsService,
    undefined as never, // r2 — unused
  );
  return { svc, notifications };
}

describe('Maintenance notifications · deep-link payload', () => {
  it('maintenance_request_created carries entityType/entityId/requestId/action', async () => {
    const prisma = {
      unit: { findUnique: jest.fn().mockResolvedValue({ id: 'u1' }) },
      maintenanceCategory: {
        findUnique: jest.fn().mockResolvedValue({ id: 'cat-1', priority: 'MEDIUM', slaDurationMinutes: null }),
      },
      unitMaintenanceItem: { findMany: jest.fn().mockResolvedValue([]) },
      maintenanceRequest: {
        create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
          id: 'mr-1',
          ...data,
        })),
      },
      maintenanceRequestItem: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const { svc, notifications } = makeService(prisma);

    await svc.createRequest('cust-1', { unitId: 'u1', categoryId: 'cat-1', description: 'تسريب مياه' } as never);

    expect(notifications.sendToRoles).toHaveBeenCalledTimes(1);
    const call = notifications.sendToRoles.mock.calls[0]!;
    expect(call[1]).toBe('maintenance_request_created');
    expect(call[2]).toMatchObject({
      entityType: 'maintenance',
      entityId: 'mr-1',
      requestId: 'mr-1',
      action: 'view_maintenance_request',
    });
  });

  it('status-change notification carries the maintenance deep-link metadata', async () => {
    const row = {
      id: 'mr-1',
      status: 'OPEN',
      customerId: 'cust-1',
      assignedAdminId: null as string | null,
      firstInProgressAt: null,
      resolvedAt: null,
      closedAt: null,
      unit: { code: 'A-1' },
    };
    const prisma = {
      maintenanceRequest: {
        findUnique: jest.fn().mockResolvedValue(row),
        update: jest.fn().mockResolvedValue({ ...row, status: 'ASSIGNED' }),
      },
    };
    const { svc, notifications } = makeService(prisma);

    await svc.setStatus('mr-1', 'ASSIGNED' as never);

    expect(notifications.sendToUser).toHaveBeenCalled();
    const call = notifications.sendToUser.mock.calls[0]!;
    expect(call[1]).toBe('maintenance_request_status_changed');
    expect(call[2]).toMatchObject({
      entityType: 'maintenance',
      entityId: 'mr-1',
      requestId: 'mr-1',
    });
  });
});
