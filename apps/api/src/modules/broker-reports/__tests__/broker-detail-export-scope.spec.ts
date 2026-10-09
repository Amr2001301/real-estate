import { Workbook } from 'exceljs';
import { BrokerReportsService } from '../broker-reports.service';

/**
 * A broker-detail export narrowed to one agent (the portal's non-manager
 * case) must not carry the firm's other agents — names, contacts or sales.
 */
describe('BrokerReportsService broker-detail exports · agent scope', () => {
  const agent = (id: string, name: string, email: string) => ({
    brokerAgentId: id,
    brokerId: 'broker-A',
    fullName: name,
    email,
    phone: null,
    leadsSubmitted: 1,
    approvedLeads: 1,
    reservations: 1,
    contracts: 1,
    contractsSigned: 1,
    salesGross: '100',
    commissionGross: '10',
    commissionNet: '9',
    payoutNet: '0',
  });

  function service() {
    const prisma = { company: { findUnique: jest.fn().mockResolvedValue({ currency: 'EGP' }) } };
    const svc = new BrokerReportsService(prisma as never);
    jest.spyOn(svc, 'brokerDetail').mockResolvedValue({
      broker: { id: 'broker-A', companyName: 'Firm', code: 'B-1', status: 'ACTIVE' },
      summary: {},
      monthlyTrend: [],
      projectBreakdown: [],
      agentBreakdown: [
        agent('u-self', 'Self Agent', 'self@x.test'),
        agent('u-other', 'Other Agent', 'other@x.test'),
      ],
      recent: {},
    } as never);
    return svc;
  }

  it('CSV: only the named agent', async () => {
    const csv = await service().brokerDetailCsv('broker-A', {}, { onlyAgent: 'u-self' });
    expect(csv).toContain('self@x.test');
    expect(csv).not.toContain('other@x.test');
    expect(csv).not.toContain('Other Agent');
  });

  it('XLSX: only the named agent', async () => {
    const buf = await service().brokerDetailXlsx('broker-A', {}, { onlyAgent: 'u-self' });
    const wb = new Workbook();
    await wb.xlsx.load(buf as never);
    const text = JSON.stringify(wb.worksheets.map((ws) => ws.getSheetValues()));
    expect(text).toContain('self@x.test');
    expect(text).not.toContain('other@x.test');
  });

  it('without a scope (admin / manager) every agent stays', async () => {
    const csv = await service().brokerDetailCsv('broker-A', {});
    expect(csv).toContain('other@x.test');
  });
});
