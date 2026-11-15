import { Prisma } from '@prisma/client';
import { buildSalesDetail, type SalesContractInput } from '../sales-detail';

const D = (v: number) => new Prisma.Decimal(v);
const contract = (over: Partial<SalesContractInput>): SalesContractInput => ({
  contractNumber: 'C-1',
  signedAt: new Date('2026-10-01T10:00:00Z'),
  totalAmount: D(1_000_000),
  markupWaived: D(0),
  customer: { fullName: 'سارة' },
  unit: { code: 'U-1', type: '2BR', area: 100, building: { phase: { project: { name: { ar: 'النخيل' } } } } },
  reservation: { snapshotFinancedAmount: null, snapshotRemainingAmount: null, sales: { fullName: 'أحمد' } },
  broker: null,
  ...over,
});
const ar = (n: unknown) => (n as { ar: string }).ar;

describe('buildSalesDetail', () => {
  it('prices each contract net of the instalment markup; groups by rep and unit type', () => {
    const x = buildSalesDetail({
      contracts: [
        // 1.1M paid in instalments on a 1.0M price: the sale is 1.0M.
        contract({
          totalAmount: D(1_100_000),
          reservation: { snapshotFinancedAmount: D(600_000), snapshotRemainingAmount: D(500_000), sales: { fullName: 'أحمد' } },
        }),
        contract({ contractNumber: 'C-2', totalAmount: D(500_000), unit: { code: 'U-2', type: 'STUDIO', area: 50 } }),
        // A pre-system contract: no reservation, so no rep.
        contract({ contractNumber: 'C-3', totalAmount: D(300_000), reservation: null, broker: { companyName: { ar: 'وساطة' } } }),
      ],
      reservations: [],
      unitTypeName: (code) => ({ '2BR': 'غرفتين' })[code],
      projectName: ar,
      now: new Date('2026-11-15T00:00:00Z'),
    });
    expect(x.contracts.map((c) => c.price)).toEqual([1_000_000, 500_000, 300_000]);
    expect(x.contractsTotal).toBe(1_800_000);
    expect(x.byRep).toEqual([
      { name: 'أحمد', count: 2, total: 1_500_000 },
      { name: 'بدون مندوب', count: 1, total: 300_000 },
    ]);
    expect(x.byUnitType).toEqual([
      { name: 'غرفتين', count: 2, total: 1_300_000, area: 200 },
      { name: 'STUDIO', count: 1, total: 500_000, area: 50 },
    ]);
    expect(x.contracts[2]).toMatchObject({ rep: 'بدون مندوب', broker: 'وساطة', project: 'النخيل' });
  });

  it('open reservations: customer from client or lead, labels, expired flag', () => {
    const x = buildSalesDetail({
      contracts: [],
      reservations: [
        {
          reservationNumber: 'R-1',
          createdAt: new Date('2026-11-01T10:00:00Z'),
          expiresAt: new Date('2026-11-10T10:00:00Z'),
          status: 'APPROVED',
          bookingAmount: D(50_000),
          bookingPaymentStatus: 'UNPAID',
          client: null,
          lead: { fullName: 'منى' },
          sales: { fullName: 'أحمد' },
          unit: { code: 'U-3' },
        },
      ],
      unitTypeName: () => undefined,
      projectName: ar,
      now: new Date('2026-11-15T00:00:00Z'),
    });
    expect(x.reservations[0]).toMatchObject({
      customer: 'منى',
      status: 'معتمد',
      bookingState: 'لم يُدفع',
      booking: 50_000,
      expired: true,
    });
  });
});
