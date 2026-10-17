import { portalDetail } from '../broker-reports.service';

/** What the broker portal may show of a broker's detail report (U1). */
describe('portalDetail', () => {
  const detail = {
    broker: { id: 'b', defaultCommissionPct: 2.5, commissionModel: 'PERCENT_OF_SALE' },
    summary: {
      totalBrokers: 40,
      activeBrokers: 31,
      totalBrokerAgents: 220,
      leadsSubmitted: 9,
      salesGross: '1000000',
      commissionsGross: '25000',
      commissionsNet: '25000',
      commissionsPendingNet: '5000',
      payoutsPaid: 3,
      payoutsTotalNet: '18000',
    },
    monthlyTrend: [{ label: '2026-10', reservations: 2, commissionsNet: '25000', payoutsNet: '18000' }],
    projectBreakdown: [{ projectId: 'p', salesGross: '1000000', commissionGross: '25000', commissionNet: '25000', payoutNet: '18000' }],
    agentBreakdown: [
      { brokerAgentId: 'me', commissionGross: '1', commissionNet: '1', payoutNet: '18000' },
      { brokerAgentId: 'colleague', commissionGross: '2', commissionNet: '2', payoutNet: '18000' },
    ],
    recent: { leads: [{ id: 'l' }], commissions: [{ id: 'c' }], payouts: [{ id: 'po' }] },
  } as never;

  it('never shows the company\'s own counts', () => {
    const out = portalDetail(detail, { portal: true });
    expect(out.summary).toMatchObject({ totalBrokers: null, activeBrokers: null, totalBrokerAgents: null });
    expect(out.summary).toMatchObject({ commissionsNet: '25000', payoutsTotalNet: '18000' });
    expect(out.agentBreakdown).toHaveLength(2);
  });

  it('an agent who is not a manager: own row only, no firm payouts', () => {
    const out = portalDetail(detail, { portal: true, onlyAgent: 'me' });
    expect(out.agentBreakdown.map((a: { brokerAgentId: string }) => a.brokerAgentId)).toEqual(['me']);
    expect(out.agentBreakdown[0]).toMatchObject({ commissionNet: '1', payoutNet: null });
    expect(out.summary).toMatchObject({ payoutsPaid: null, payoutsTotalNet: null, commissionsNet: '25000' });
    expect(out.monthlyTrend[0]).toMatchObject({ payoutsNet: null, commissionsNet: '25000' });
    expect(out.recent.payouts).toEqual([]);
  });

  it('without canViewCommissions: no amounts anywhere, nor the commission terms', () => {
    const out = portalDetail(detail, { portal: true, withoutMoney: true });
    expect(out.broker).toMatchObject({ defaultCommissionPct: null, commissionModel: null });
    expect(out.summary).toMatchObject({ commissionsNet: null, commissionsGross: null, payoutsTotalNet: null, salesGross: '1000000' });
    expect(out.projectBreakdown[0]).toMatchObject({ commissionNet: null, payoutNet: null, salesGross: '1000000' });
    expect(out.monthlyTrend[0]).toMatchObject({ commissionsNet: null, payoutsNet: null, reservations: 2 });
    expect(out.recent).toMatchObject({ leads: [{ id: 'l' }], commissions: [], payouts: [] });
  });
});
