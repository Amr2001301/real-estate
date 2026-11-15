import { DepositReviewStatus, PaymentInstrumentStatus, Prisma } from '@prisma/client';
import { buildFinancialDetail, type InstallmentInput, type LedgerInput } from '../financial-detail';
import { financialDashboardReportHtml } from '../report-templates';
import { fallbackBrand } from '../../../common/utils/report-brand';

const D = (v: number) => new Prisma.Decimal(v);
const today = new Date('2026-11-15T00:00:00Z');
const unit = (code: string, project: string) => ({
  code,
  building: { phase: { project: { id: project, name: { ar: project, en: project } } } },
});
const pay = (over: Partial<LedgerInput>): LedgerInput => ({
  type: 'INSTALLMENT',
  amount: D(100),
  paidAt: new Date('2026-11-01T10:00:00Z'),
  paymentMethod: 'CASH',
  deletedAt: null,
  reviewStatus: DepositReviewStatus.NO_PROOF,
  paymentInstrument: null,
  paymentCorrections: [],
  contract: { contractNumber: 'C-1', customer: { fullName: 'سارة' }, unit: unit('U-1', 'النخيل') },
  reservation: null,
  ...over,
});
const inst = (contractId: string, due: string, amount: number, name = 'سارة'): InstallmentInput => ({
  type: 'INSTALLMENT',
  dueDate: new Date(`${due}T00:00:00Z`),
  amount: D(amount),
  plan: {
    contract: { id: contractId, contractNumber: contractId, customer: { fullName: name, phone: '+20100' }, unit: { code: 'U' } },
  },
});
const arName = (n: unknown) => (n as { ar: string }).ar;

describe('buildFinancialDetail', () => {
  it('ledger totals: collected and on-its-way apart; groups by project and method', () => {
    const x = buildFinancialDetail({
      deposits: [
        pay({ amount: D(100) }),
        pay({ amount: D(50), paymentMethod: 'BANK_TRANSFER', contract: { contractNumber: 'C-2', customer: { fullName: 'علي' }, unit: unit('U-2', 'الريم') } }),
        // A cheque not cleared: on its way, the method from the instrument.
        pay({
          amount: D(30),
          paymentMethod: null,
          paymentInstrument: { status: PaymentInstrumentStatus.DEPOSITED, type: 'CHEQUE' },
        }),
        // A bounced cheque: in the ledger, in neither sum.
        pay({ amount: D(7), paymentInstrument: { status: PaymentInstrumentStatus.BOUNCED, type: 'CHEQUE' } }),
        // A booking with no unit project and no method.
        pay({
          amount: D(20),
          type: 'BOOKING_AMOUNT',
          paymentMethod: null,
          contract: null,
          reservation: { reservationNumber: 'R-1', client: null, lead: { fullName: 'منى' }, unit: { code: 'U-9' } },
        }),
      ],
      late: [],
      next30: [],
      cheques: [],
      today,
      projectName: arName,
    });
    expect(x.ledgerCollected).toBe(170);
    expect(x.ledgerAwaiting).toBe(30);
    expect(x.ledger.map((r) => r.stateLabel)).toEqual([
      'تم التحصيل',
      'تم التحصيل',
      'شيك لم يُصرف بعد',
      'شيك مرتد',
      'تم التحصيل',
    ]);
    expect(x.ledger[4]).toMatchObject({ customer: 'منى', reference: 'R-1', type: 'مبلغ الحجز', method: 'غير محددة' });
    expect(x.byProject).toEqual([
      { name: 'النخيل', count: 3, collected: 100, awaiting: 30 },
      { name: 'الريم', count: 1, collected: 50, awaiting: 0 },
      { name: 'بدون مشروع', count: 1, collected: 20, awaiting: 0 },
    ]);
    expect(x.byMethod.find((m) => m.name === 'شيك')).toEqual({ name: 'شيك', count: 1, collected: 0, awaiting: 30 });
    // The groups add up to the ledger's totals.
    expect(x.byMethod.reduce((a, m) => a + m.collected, 0)).toBe(170);
  });

  it('late payers: one line per contract, oldest due and days late, largest first', () => {
    const x = buildFinancialDetail({
      deposits: [],
      late: [inst('A', '2026-10-01', 100), inst('B', '2026-11-10', 500, 'علي'), inst('A', '2026-11-01', 100)],
      next30: [],
      cheques: [],
      today,
      projectName: arName,
    });
    expect(x.latePayers).toEqual([
      expect.objectContaining({ contract: 'B', count: 1, amount: 500, daysLate: 5 }),
      expect.objectContaining({ contract: 'A', count: 2, amount: 200, daysLate: 45, phone: '+20100' }),
    ]);
  });

  it('cheques: amount is its payments; counted by status; the limit flags truncation', () => {
    const x = buildFinancialDetail({
      deposits: [],
      late: [],
      next30: [{ ...inst('A', '2026-11-20', 10), deposits: [{ id: 'd' }] }, inst('A', '2026-11-21', 10)],
      cheques: [
        { chequeNumber: '1', drawerBankName: 'CIB', chequeDueDate: null, status: 'BOUNCED', deposits: [{ amount: D(40) }, { amount: D(60) }] },
        { chequeNumber: '2', drawerBankName: null, chequeDueDate: null, status: 'CLEARED', deposits: [{ amount: D(5) }] },
      ],
      today,
      projectName: arName,
      limit: 1,
    });
    expect(x.cheques).toEqual([expect.objectContaining({ number: '1', amount: 100, statusLabel: 'مرتد' })]);
    expect(x.chequesTruncated).toBe(true);
    expect(x.next30).toHaveLength(1);
    expect(x.next30[0]!.onItsWay).toBe(true);
    expect(x.next30Truncated).toBe(true);
  });
});

describe('financial report PDF with the lists', () => {
  it('prints the lists landscape, the totals once', () => {
    const detail = buildFinancialDetail({
      deposits: [pay({ amount: D(100) })],
      late: [inst('A', '2026-10-01', 100)],
      next30: [inst('A', '2026-11-20', 10)],
      cheques: [],
      today,
      projectName: arName,
    });
    const html = financialDashboardReportHtml(
      {
        summary: {
          totalContractValue: 1000,
          totalCollectedVerified: 100,
          collectedTowardsPrice: 100,
          feesCollected: 0,
          dueToDate: 200,
          collectedAgainstDue: 100,
          totalCollectedUnverified: 0,
          totalOutstanding: 900,
          collectedThisMonth: 100,
          dueThisMonth: 100,
          contractCount: 1,
          depositCount: 1,
          dueSoonAmount: 0,
          overdueAmountComputed: 100,
          overdueInstallmentCountComputed: 1,
        },
        unpaidLiabilities: 0,
        collectionByType: [],
        aging: [],
        filters: [],
        detail,
        trend: [{ month: '2026-11', label: 'نوفمبر', due: 200, collected: 100 }],
        outflows: {
          brokerCommissions: { pendingAmount: 0, unpaidAmount: 10, paidAmount: 5 },
          salesBonus: { pendingAmount: 0, approvedAmount: 0, paidAmount: 0 },
          refundsOwed: 0,
          refundsPaid: 0,
          clawbacksOwed: 0,
        },
      },
      fallbackBrand('EGP'),
    );
    expect(html).toContain('size: A4 landscape');
    for (const title of [
      'التحصيل الشهري: المستحق مقابل المحصّل',
      'التحصيل حسب المشروع',
      'التحصيل حسب طريقة الدفع',
      'المتأخرون عن السداد',
      'المستحق خلال 30 يومًا',
      'الشيكات',
      'المدفوعات والالتزامات',
      'دفتر التحصيلات',
    ]) {
      expect(html).toContain(title);
    }
    expect(html).toContain('نوفمبر 2026');
    expect(html).toContain('table.data tfoot { display:table-row-group; }');
  });
});
