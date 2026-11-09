import { BrokerLeadsService } from '../broker-leads.service';
import type { PrismaService } from '../../../common/prisma/prisma.service';

jest.mock('../../../common/tenant/tenant-context', () => ({
  ...jest.requireActual('../../../common/tenant/tenant-context'),
  getRequiredCompanyId: () => 'c0000000-0000-4000-8000-000000000001',
}));

/** F-036: approving a broker lead and assigning it to a rep tells that rep. */
const LEAD = 'b1111111-1111-4111-8111-111111111111';
const REP = 'b2222222-2222-4222-8222-222222222222';
const ADMIN = 'b3333333-3333-4333-8333-333333333333';

function make() {
  const tx = {
    lead: { update: jest.fn().mockResolvedValue({ id: LEAD }) },
    leadActivity: { create: jest.fn().mockResolvedValue({}) },
    leadNote: { create: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    lead: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: LEAD, brokerId: 'br1', fullName: 'Ahmed', brokerApprovalStatus: 'PENDING', stage: 'NEW', brokerAgentId: null, projectInterest: null }),
    },
    user: { findFirst: jest.fn().mockResolvedValue({ id: REP, role: 'SALES', active: true }) },
    $transaction: jest.fn().mockImplementation(async (cb: (t: unknown) => unknown) => cb(tx)),
  };
  const notifications = {
    sendToUser: jest.fn().mockResolvedValue(undefined),
    brokerRecipients: jest.fn().mockResolvedValue([]),
    sendToUsers: jest.fn().mockResolvedValue(undefined),
  };
  const svc = new BrokerLeadsService(prisma as unknown as PrismaService, notifications as never);
  return { svc, notifications };
}

describe('BrokerLeadsService.approve · rep notice', () => {
  it('notifies the assigned rep, never the approving actor', async () => {
    const { svc, notifications } = make();
    await svc.approve(LEAD, { assignedSalesId: REP } as never, { sub: ADMIN } as never);
    expect(notifications.sendToUser).toHaveBeenCalledWith(
      REP,
      'lead_assigned_sales',
      expect.objectContaining({ entityType: 'lead', entityId: LEAD, customerName: 'Ahmed' }),
      { except: ADMIN },
    );
  });

  it('sends nothing to a rep when no rep is assigned', async () => {
    const { svc, notifications } = make();
    await svc.approve(LEAD, {} as never, { sub: ADMIN } as never);
    expect(notifications.sendToUser).not.toHaveBeenCalled();
  });
});
