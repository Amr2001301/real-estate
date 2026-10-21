import { BrokerReportsService } from '../broker-reports.service';

/**
 * The broker funnel's last step is signed contracts whose commission was paid
 * out — a subset of the signed contracts. It used to be the count of paid
 * payouts, which bundle several commissions, so the step read "1 of 5".
 */
describe('BrokerReportsService · funnel commission-paid step', () => {
  it('counts signed contracts whose broker commission sits in a PAID payout', async () => {
    const count = jest.fn()
      .mockResolvedValueOnce(7) // created
      .mockResolvedValueOnce(5) // signed
      .mockResolvedValueOnce(3); // commission paid
    const svc = new BrokerReportsService({ contract: { count } } as never);
    const counts = (svc as unknown as {
      aggregateCommonCounts: (f: { range: { inclusive: boolean } }) => {
        contractStats: () => Promise<Record<string, number>>;
      };
    }).aggregateCommonCounts({ range: { inclusive: true } });

    const stats = await counts.contractStats();

    expect(stats).toEqual({ contractsCreated: 7, contractsSigned: 5, contractsCommissionPaid: 3 });
    const paidWhere = count.mock.calls[2]![0].where;
    expect(paidWhere.brokerCommission).toEqual({ is: { payout: { is: { status: 'PAID' } } } });
    // the same signed-contract scope as the step before it
    expect(paidWhere.signedAt).toEqual(count.mock.calls[1]![0].where.signedAt);
  });
});
