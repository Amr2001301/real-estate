import { fallbackBrand, type ReportBrand } from '../../../common/utils/report-brand';
import { bonusReportHtml } from '../../bonus/bonus-report-template';
import {
  brokerDetailReportHtml,
  brokerSummaryReportHtml,
  topBrokersReportHtml,
} from '../../broker-reports/broker-report-templates';
import { installmentPlanReportHtml } from '../../installments/installment-plan-template';
import { maintenanceReportHtml } from '../../maintenance/maintenance-report-template';
import { financialDashboardReportHtml, operationalReportHtml } from '../report-templates';

/**
 * Every presentation template: it renders its report from real-shaped data,
 * names it, writes amounts in the company currency, and never lets tenant
 * text (names, labels) become markup.
 */
const brand: ReportBrand = { ...fallbackBrand('EGP'), name: 'شركة النيل' };
const evil = '<script>x</script>';
const noMarkup = (html: string) => {
  expect(html).not.toContain('<script>x');
  expect(html).toContain('&#60;script&#62;');
};

const summary = {
  totalBrokers: 3,
  activeBrokers: 2,
  totalBrokerAgents: 5,
  leadsSubmitted: 10,
  leadsApproved: 6,
  reservationsCreated: 4,
  contractsCreated: 3,
  contractsSigned: 2,
  salesGross: '1250000',
  commissionsNet: '25000',
  payoutsTotalNet: '10000',
  leadToReservationRate: 0.4,
  reservationToContractRate: 0.5,
  signedContractRate: 0.66,
  contractToPaidPayoutRate: 0.25,
};
const topRow = {
  companyName: evil,
  code: 'B-1',
  status: 'ACTIVE',
  leads: 4,
  approvedLeads: 3,
  reservations: 2,
  contracts: 2,
  contractsSigned: 1,
  salesGross: '900000',
  commissionGross: '20000',
  commissionNet: '18000',
  payoutNet: '5000',
  conversionRate: 0.5,
};

describe('presentation report templates', () => {
  it('operational: inventory, reservations by status in Arabic', () => {
    const html = operationalReportHtml(
      {
        projects: 5,
        units: { total: 30, available: 23, reserved: 3, sold: 4 },
        leads: { total: 9, new: 4 },
        pendingVisits: 2,
        contracts: 3,
        depositsTotal: 1_668_333.35,
        reservationsByStatus: { APPROVED: 1, CONVERTED: 2 },
      },
      brand,
    );
    expect(html).toContain('التقرير التشغيلي');
    expect(html).toContain('تحوّلت إلى عقد');
    expect(html).toContain('1,668,333.35 ج.م');
  });

  it('financial dashboard: KPIs, risks only when present, type labels', () => {
    const html = financialDashboardReportHtml(
      {
        summary: {
          totalContractValue: '6100000',
          totalCollectedVerified: '1461666.68',
          totalCollectedUnverified: '206666.67',
          totalOutstanding: '3673333.44',
          collectedThisMonth: '541666.67',
          dueThisMonth: '86666.67',
          contractCount: 3,
          depositCount: 17,
          dueSoonAmount: '0',
          overdueAmountComputed: '86666.67',
          overdueInstallmentCountComputed: 1,
        },
        unpaidLiabilities: '0',
        collectionByType: [
          {
            type: 'DOWN_PAYMENT',
            count: 2,
            totalAll: '980000',
            totalVerified: '980000',
            totalUnverified: '0',
          },
        ],
        aging: [{ label: '1-30', count: 1, amount: '86666.67' }],
        filters: [`بحث: ${evil}`],
      },
      brand,
    );
    expect(html).toContain('لوحة المؤشرات المالية');
    expect(html).toContain('دفعة أولى');
    expect(html).toContain('1-30 يوم');
    expect(html).not.toContain('مستحق خلال 7 أيام'); // zero → not a risk card
    noMarkup(html);
  });

  it('broker summary / top brokers / one broker', () => {
    noMarkup(brokerSummaryReportHtml({ summary, top: [topRow], periodLabel: 'كل الفترات' }, brand));
    const top = topBrokersReportHtml(
      { metric: 'contracts', rows: [topRow], periodLabel: 'كل الفترات' },
      brand,
    );
    expect(top).toContain('مرتّب حسب العقود');
    noMarkup(top);
    const one = brokerDetailReportHtml(
      {
        broker: { name: evil, code: 'B-1', status: 'SUSPENDED' },
        summary,
        monthlyTrend: [
          {
            label: '2026-10',
            reservations: 1,
            contractsSigned: 1,
            commissionsNet: '18000',
            payoutsNet: '0',
          },
        ],
        agents: [
          {
            fullName: evil,
            leadsSubmitted: 1,
            reservations: 1,
            contractsSigned: 1,
            salesGross: '1',
            commissionNet: '1',
          },
        ],
        projects: [],
        periodLabel: 'كل الفترات',
        title: 'أدائي',
      },
      brand,
    );
    expect(one).toContain('<h1 class="title">أدائي</h1>');
    expect(one).toContain('موقوف');
    noMarkup(one);
  });

  it('maintenance: SLA and empty sections say so', () => {
    const html = maintenanceReportHtml(
      {
        totalRequests: 25,
        pendingReviewCount: 0,
        approvedCount: 25,
        rejectedCount: 0,
        openCount: 24,
        assignedCount: 1,
        inProgressCount: 0,
        resolvedCount: 0,
        closedCount: 0,
        overdueCount: 0,
        inWarrantyCount: 0,
        outOfWarrantyCount: 0,
        unknownWarrantyCount: 25,
        avgResolutionHours: null,
        resolvedWithinSlaCount: 0,
        resolvedOverdueCount: 0,
        slaAttainmentPercent: 92.4,
        avgDelayHours: 3.25,
        byCategory: [{ name: evil, count: 25, overdueCount: 0, outOfWarrantyCount: 0 }],
        byAssignee: [],
        expiringWarranties: [],
        filters: [],
      },
      brand,
    );
    expect(html).toContain('92%');
    expect(html).toContain('3.3 ساعة');
    expect(html).toContain('لا توجد ضمانات تنتهي قريباً');
    noMarkup(html);
  });

  it('bonus: totals exclude cancelled entries', () => {
    const html = bonusReportHtml(
      {
        entries: [
          {
            rep: evil,
            period: '2026-09',
            rule: 'r',
            amount: 1000,
            status: 'PAID',
            statusLabel: 'مدفوع',
            paidAt: '2026-10-01',
          },
          {
            rep: 'ب',
            period: '2026-09',
            rule: 'r',
            amount: 5000,
            status: 'CANCELLED',
            statusLabel: 'ملغي',
            paidAt: '',
          },
        ],
        filters: [],
      },
      brand,
    );
    expect(html).toContain('1,000 ج.م');
    expect(html).not.toContain('6,000 ج.م');
    noMarkup(html);
  });

  it('installment schedule: paid / outstanding / next payment', () => {
    const html = installmentPlanReportHtml(
      {
        contractNumber: 'C-1',
        customer: evil,
        unit: 'A-102',
        rows: [
          {
            dueDate: '2026-09-01',
            type: 'DOWN_PAYMENT',
            amount: 100_000,
            status: 'PAID',
            paidAt: '2026-09-01',
          },
          {
            dueDate: '2026-10-01',
            type: 'INSTALLMENT',
            amount: 20_000,
            status: 'OVERDUE',
            paidAt: '',
          },
          {
            dueDate: '2026-11-01',
            type: 'INSTALLMENT',
            amount: 20_000,
            status: 'CANCELLED',
            paidAt: '',
          },
        ],
      },
      brand,
    );
    expect(html).toContain('كشف الأقساط');
    expect(html).toContain('120,000 ج.م'); // plan total excludes the cancelled row
    expect(html).toContain('مستحقة في 2026-10-01');
    expect(html).toContain('دفعة أولى');
    noMarkup(html);
  });
});
