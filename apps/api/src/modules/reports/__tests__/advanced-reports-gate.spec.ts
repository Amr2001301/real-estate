import 'reflect-metadata';
import { REQUIRE_CAPABILITY_KEY } from '../../../common/decorators/require-capability.decorator';
import { ReportsController } from '../reports.controller';

const gate = (name: keyof ReportsController) =>
  Reflect.getMetadata(REQUIRE_CAPABILITY_KEY, ReportsController.prototype[name] as object);

describe('advanced reports are a plan feature', () => {
  const advanced: Array<keyof ReportsController> = [
    'salesTrend', 'salesFunnel', 'brokerLeaderboard', 'financialDashboard', 'financialComparison',
    'ledgerSummary', 'ledgerRows', 'financial', 'financialCsv', 'financialDashboardCsv',
  ];

  it('the advanced report endpoints require feature.advancedReports', () => {
    const missing = advanced.filter((n) => gate(n) !== 'feature.advancedReports');
    expect(missing).toEqual([]);
  });

  it('the dashboard summary and the sales report stay open on every plan', () => {
    for (const n of ['kpis', 'adminSummary', 'sales', 'reservations', 'operationalCsv'] as Array<keyof ReportsController>) {
      expect(typeof ReportsController.prototype[n]).toBe('function');
      expect(gate(n)).toBeUndefined();
    }
  });
});
