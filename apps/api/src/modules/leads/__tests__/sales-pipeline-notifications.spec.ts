import { UserRole } from '@prisma/client';
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
    await svc.assign('lead-1', { assignedSalesId: 'sales-2' }, 'admin-1');
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
      unit: { code: 'A-102' },
    };
    const tx = {
      reservation: { update: jest.fn(), count: jest.fn().mockResolvedValue(1) },
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
});
