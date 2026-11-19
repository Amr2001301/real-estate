import { BrokerCommissionsService } from '../broker-commissions.service';
import { BrokerPayoutsService } from '../../broker-payouts/broker-payouts.service';
import { MaintenanceService } from '../../maintenance/maintenance.service';
import { RequestsService } from '../../requests/requests.module';

jest.mock('../../../common/tenant/tenant-context', () => ({
  ...jest.requireActual('../../../common/tenant/tenant-context'),
  getRequiredCompanyId: () => 'c0000000-0000-4000-8000-000000000001',
}));

/** The lists' search box: `q` reaches the query as a word match on the names the page shows. */
function withPrisma<T extends object>(cls: { prototype: T }, model: string) {
  const findMany = jest.fn().mockResolvedValue([]);
  const count = jest.fn().mockResolvedValue(0);
  const prisma = {
    [model]: { findMany, count, groupBy: jest.fn().mockResolvedValue([]) },
    $transaction: (ops: Promise<unknown>[]) => Promise.all(ops),
  };
  const svc = Object.create(cls.prototype) as T & { prisma: unknown };
  svc.prisma = prisma;
  return { svc, count };
}

const words = (where: unknown) => JSON.stringify(where);

describe('list search (q)', () => {
  it('broker commissions: broker, agent and contract number', async () => {
    const { svc, count } = withPrisma(BrokerCommissionsService, 'brokerCommission');
    await (svc as unknown as BrokerCommissionsService).list({ q: 'خبرة' } as never);
    const w = words(count.mock.calls[0][0].where);
    expect(w).toContain('خبرة');
    expect(w).toContain('companyName');
    expect(w).toContain('contractNumber');
  });

  it('broker commissions: no q, no OR', async () => {
    const { svc, count } = withPrisma(BrokerCommissionsService, 'brokerCommission');
    await (svc as unknown as BrokerCommissionsService).list({} as never);
    expect(count.mock.calls[0][0].where.OR).toBeUndefined();
  });

  it('broker payouts: broker name and period', async () => {
    const { svc, count } = withPrisma(BrokerPayoutsService, 'brokerPayout');
    await (svc as unknown as BrokerPayoutsService).list({ q: '2026-05' } as never);
    const w = words(count.mock.calls[0][0].where);
    expect(w).toContain('2026-05');
    expect(w).toContain('companyName');
  });

  it('maintenance: description, client and unit code, beside a category filter', async () => {
    const { svc, count } = withPrisma(MaintenanceService, 'maintenanceRequest');
    await (svc as unknown as MaintenanceService).list({ page: 1, pageSize: 10, q: 'تسريب', categoryId: 'cat-1' } as never);
    const where = count.mock.calls[0][0].where;
    expect(words(where.AND)).toContain('تسريب');
    expect(words(where.AND)).toContain('description');
    // The category's own OR is kept apart from the search's.
    expect(words(where.OR)).toContain('cat-1');
  });

  it('info requests: message and the person asking', async () => {
    const { svc, count } = withPrisma(RequestsService, 'infoRequest');
    await (svc as unknown as RequestsService).listInfoRequests({ page: 1, pageSize: 10, q: 'سعر' });
    const w = words(count.mock.calls[0][0].where);
    expect(w).toContain('سعر');
    expect(w).toContain('message');
    expect(w).toContain('fullName');
  });
});
