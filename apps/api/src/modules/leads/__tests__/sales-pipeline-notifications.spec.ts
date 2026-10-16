import { UserRole } from '@prisma/client';
import { runInCompany } from '../../../common/tenant/tenant-context';
import type { PrismaService } from '../../../common/prisma/prisma.service';
import type { NotificationsService } from '../../notifications/notifications.module';
import { LeadsService } from '../leads.service';
import { ReservationsService } from '../../reservations/reservations.module';

/**
 * Sales-pipeline events reach everyone concerned — the sales person, the
 * managers, the broker who brought the customer (agent + firm managers) —
 * and never the user who acted.
 */
function notificationsMock(broker: string[] = ['agent-1', 'firm-manager-1']) {
  return {
    sendToUser: jest.fn().mockResolvedValue(undefined),
    sendToUsers: jest.fn().mockResolvedValue(undefined),
    sendToRoles: jest.fn().mockResolvedValue(undefined),
    brokerRecipients: jest.fn().mockResolvedValue(broker),
  };
}

const LEAD = {
  id: 'lead-1',
  fullName: 'منى',
  stage: 'NEW',
  assignedSalesId: 'sales-1',
  brokerId: 'broker-1',
  brokerAgentId: 'agent-1',
};

function leads() {
  const prisma = {
    lead: {
      findUnique: jest.fn().mockResolvedValue(LEAD),
      update: jest.fn(async ({ data }: { data: object }) => ({ ...LEAD, ...data })),
    },
    leadActivity: { create: jest.fn().mockResolvedValue({}) },
    // The new assignee is an active sales person of the company.
    user: { findFirst: jest.fn().mockResolvedValue({ id: 'sales-2', fullName: 'Sales 2', role: 'SALES' }) },
  };
  const notifications = notificationsMock();
  const svc = new LeadsService(
    prisma as unknown as PrismaService,
    notifications as unknown as NotificationsService,
  );
  return { svc, notifications };
}

describe('lead notifications', () => {
  it("an edit tells the lead's sales person — not the editor", async () => {
    const { svc, notifications } = leads();
    await svc.update('lead-1', { notes: 'x' } as never, 'manager-1');
    expect(notifications.sendToUser).toHaveBeenCalledWith(
      'sales-1',
      'lead_updated',
      expect.objectContaining({ entityId: 'lead-1' }),
      { except: 'manager-1' },
    );
  });

  it('a stage change reaches the sales person, the broker agent + firm managers and the sales managers', async () => {
    const { svc, notifications } = leads();
    await svc.updateStage('lead-1', { stage: 'VISIT' } as never, 'sales-1');
    expect(notifications.brokerRecipients).toHaveBeenCalledWith('broker-1', {
      agentUserId: 'agent-1',
    });
    expect(notifications.sendToUsers).toHaveBeenCalledWith(
      ['sales-1', 'agent-1', 'firm-manager-1'],
      'lead_stage_changed',
      expect.objectContaining({ toStage: 'VISIT' }),
      { except: 'sales-1' },
    );
    expect(notifications.sendToRoles).toHaveBeenCalledWith(
      [UserRole.SALES_MANAGER],
      'lead_stage_changed',
      expect.any(Object),
      { except: 'sales-1' },
    );
  });

  it('a reassignment tells the new sales person and the previous one', async () => {
    const { svc, notifications } = leads();
    await runInCompany('company-1', () => svc.assign('lead-1', { assignedSalesId: 'sales-2' }, 'admin-1'));
    expect(notifications.sendToUser).toHaveBeenCalledWith(
      'sales-2',
      'lead_assigned_sales',
      expect.any(Object),
      {
        except: 'admin-1',
      },
    );
    expect(notifications.sendToUser).toHaveBeenCalledWith(
      'sales-1',
      'lead_unassigned',
      expect.any(Object),
      {
        except: 'admin-1',
      },
    );
  });
});

describe('reservation expiry', () => {
  it('tells the customer, the sales person, the broker side and the sales managers', async () => {
    const due = {
      id: 'res-1',
      companyId: null,
      unitId: 'unit-1',
      salesId: 'sales-1',
      leadId: null,
      clientId: 'client-1',
      brokerId: 'broker-1',
      brokerAgentId: 'agent-1',
      reservationNumber: 'RSV-1',
      status: 'APPROVED',
      bookingPaymentStatus: 'UNPAID',
      expiresAt: new Date('2026-01-01T00:00:00Z'),
      unit: { code: 'A-102' },
    };
    const tx = {
      reservation: { updateMany: jest.fn().mockResolvedValue({ count: 1 }), count: jest.fn().mockResolvedValue(1) },
      reservationActivity: { create: jest.fn() },
      leadActivity: { create: jest.fn() },
      unit: { findUnique: jest.fn(), update: jest.fn() },
      unitStatusHistory: { create: jest.fn() },
    };
    const prisma = {
      reservation: { findMany: jest.fn().mockResolvedValue([due]) },
      $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    };
    const notifications = notificationsMock();
    const svc = new ReservationsService(
      prisma as unknown as PrismaService,
      notifications as unknown as NotificationsService,
      {} as never,
    );

    await svc.expireDue();

    expect(notifications.sendToUsers).toHaveBeenCalledWith(
      ['client-1', 'sales-1', 'agent-1', 'firm-manager-1'],
      'reservation_expired',
      expect.objectContaining({ unitCode: 'A-102', entityId: 'res-1' }),
    );
    expect(notifications.sendToRoles).toHaveBeenCalledWith(
      [UserRole.SALES_MANAGER],
      'reservation_expired',
      expect.any(Object),
    );
  });
  function sweepFixture(rows: Array<Record<string, unknown>>, existingAlert: unknown = null) {
    const tx = {
      reservation: { updateMany: jest.fn().mockResolvedValue({ count: 1 }), count: jest.fn().mockResolvedValue(1) },
      reservationActivity: { create: jest.fn() },
      leadActivity: { create: jest.fn() },
      unit: { findUnique: jest.fn(), update: jest.fn() },
      unitStatusHistory: { create: jest.fn() },
    };
    const prisma = {
      reservation: { findMany: jest.fn().mockResolvedValue(rows) },
      notification: { findFirst: jest.fn().mockResolvedValue(existingAlert) },
      $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    };
    const notifications = notificationsMock();
    const svc = new ReservationsService(
      prisma as unknown as PrismaService,
      notifications as unknown as NotificationsService,
      {} as never,
    );
    return { svc, tx, prisma, notifications };
  }
  const row = (over: Record<string, unknown>) => ({
    id: 'res-1',
    companyId: null,
    unitId: 'unit-1',
    salesId: 'sales-1',
    leadId: null,
    clientId: 'client-1',
    brokerId: null,
    brokerAgentId: null,
    reservationNumber: 'RSV-1',
    status: 'APPROVED',
    bookingPaymentStatus: 'UNPAID',
    expiresAt: new Date('2026-01-01T00:00:00Z'),
    unit: { code: 'A-102' },
    ...over,
  });

  it('a paid booking is not expired: sales, managers and admins get one overdue alert', async () => {
    const { svc, tx, notifications } = sweepFixture([row({ bookingPaymentStatus: 'PAID' })]);

    const result = await svc.expireDue();

    expect(result).toEqual({ expired: 0, overdue: 1, failed: 0 });
    expect(tx.reservation.updateMany).not.toHaveBeenCalled();
    expect(notifications.sendToUsers).toHaveBeenCalledWith(
      ['sales-1'],
      'reservation_overdue',
      expect.objectContaining({ reservationId: 'res-1', expiresAt: '2026-01-01T00:00:00.000Z' }),
    );
    expect(notifications.sendToRoles).toHaveBeenCalledWith(
      [UserRole.SALES_MANAGER, UserRole.ADMIN],
      'reservation_overdue',
      expect.any(Object),
    );
  });

  it('the overdue alert is not repeated for the same expiry', async () => {
    const { svc, notifications } = sweepFixture([row({ bookingPaymentStatus: 'PENDING' })], { id: 'n-1' });

    const result = await svc.expireDue();

    expect(result).toEqual({ expired: 0, overdue: 0, failed: 0 });
    expect(notifications.sendToUsers).not.toHaveBeenCalled();
    expect(notifications.sendToRoles).not.toHaveBeenCalled();
  });

  it('one failing row does not stop the sweep', async () => {
    const { svc, tx } = sweepFixture([row({ id: 'res-bad' }), row({ id: 'res-ok' })]);
    tx.reservation.updateMany.mockRejectedValueOnce(new Error('row locked')).mockResolvedValueOnce({ count: 1 });

    const result = await svc.expireDue();

    expect(result).toEqual({ expired: 1, overdue: 0, failed: 1 });
  });

  it('a row paid since the scan is left alone', async () => {
    const { svc, tx, notifications } = sweepFixture([row({})]);
    tx.reservation.updateMany.mockResolvedValueOnce({ count: 0 });

    const result = await svc.expireDue();

    expect(result).toEqual({ expired: 0, overdue: 0, failed: 0 });
    expect(tx.reservationActivity.create).not.toHaveBeenCalled();
    expect(notifications.sendToUsers).not.toHaveBeenCalled();
  });
});
