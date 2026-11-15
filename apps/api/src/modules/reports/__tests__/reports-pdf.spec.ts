import type { PrismaService } from '../../../common/prisma/prisma.service';
import type { ReportPdfService } from '../../../common/report-pdf/report-pdf.service';
import { runInCompany } from '../../../common/tenant/tenant-context';
import { ReportsService } from '../reports.service';

/**
 * Presentation PDFs: the HTML report goes to Chromium when it is available;
 * otherwise (or when Chromium fails) sales/financial/broker fall back to the
 * plain PDFKit layout, so a download never breaks.
 */
const COMPANY = '00000000-0000-0000-0000-0000000000aa';

function prismaMock() {
  return {
    $transaction: (ops: Array<Promise<unknown>>) => Promise.all(ops),
    contract: {
      count: jest.fn().mockResolvedValue(3),
      aggregate: jest.fn().mockResolvedValue({ _sum: { totalAmount: 6_100_000 } }),
      // The report's contract list (one shown; names escaped like the rest).
      findMany: jest.fn().mockResolvedValue([
        {
          contractNumber: 'C-9',
          signedAt: new Date('2026-10-05T10:00:00Z'),
          totalAmount: 2_000_000,
          markupWaived: 0,
          customer: { fullName: 'هالة' },
          unit: { code: 'N-1', type: '2BR', area: 120, building: { phase: { project: { name: { ar: 'أبراج <النيل>' } } } } },
          reservation: { snapshotFinancedAmount: null, snapshotRemainingAmount: null, sales: { fullName: 'مندوب <أ>' } },
          broker: null,
        },
      ]),
    },
    reservation: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { snapshotFinancedAmount: null, snapshotRemainingAmount: null } }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    unitType: { findMany: jest.fn().mockResolvedValue([{ code: '2BR', name: { ar: 'غرفتين' } }]) },
    setting: { findMany: jest.fn().mockResolvedValue([]) },
    $queryRaw: jest.fn().mockResolvedValue([{ projectId: 'p1', total: 6_100_000, count: 3 }]),
    project: {
      findMany: jest
        .fn()
        .mockResolvedValue([{ id: 'p1', name: { ar: 'أبراج <النيل>', en: 'Nile' } }]),
    },
    company: { findUnique: jest.fn().mockResolvedValue({ currency: 'EGP' }) },
  } as unknown as PrismaService;
}

const isPdf = (b: Buffer) => b.subarray(0, 5).toString() === '%PDF-';

describe('ReportsService — presentation PDFs', () => {
  it('sends the sales report HTML to Chromium (names escaped, company in the footer)', async () => {
    const render = jest.fn().mockResolvedValue(Buffer.from('%PDF-html'));
    const pdf = { available: () => true, render } as unknown as ReportPdfService;
    const svc = new ReportsService(prismaMock(), undefined, pdf);

    const out = await runInCompany(COMPANY, () => svc.salesPdf());
    expect(out.toString()).toBe('%PDF-html');
    const [html] = render.mock.calls[0] as [string];
    expect(html).toContain('تقرير المبيعات');
    expect(html).toContain('أبراج &#60;النيل&#62;');
    expect(html).toContain('6,100,000 ج.م');
    // The lists: by rep and unit type, the contracts, the open reservations.
    expect(html).toContain('size: A4 landscape');
    expect(html).toContain('المبيعات حسب المندوب');
    expect(html).toContain('مندوب &#60;أ&#62;');
    expect(html).toContain('غرفتين');
    expect(html).toContain('العقود الموقّعة');
    expect(html).toContain('C-9');
    expect(html).toContain('2,000,000 ج.م');
    expect(html).toContain('لا توجد حجوزات مفتوحة');
  });

  it('falls back to the PDFKit layout when Chromium is not installed', async () => {
    const pdf = { available: () => false, render: jest.fn() } as unknown as ReportPdfService;
    const svc = new ReportsService(prismaMock(), undefined, pdf);
    const out = await runInCompany(COMPANY, () => svc.salesPdf());
    expect(isPdf(out)).toBe(true);
    expect(pdf.render as jest.Mock).not.toHaveBeenCalled();
  });

  it('falls back to the PDFKit layout when Chromium fails mid-render', async () => {
    const pdf = {
      available: () => true,
      render: jest.fn().mockRejectedValue(new Error('crashed')),
    } as unknown as ReportPdfService;
    const svc = new ReportsService(prismaMock(), undefined, pdf);
    const out = await runInCompany(COMPANY, () => svc.salesPdf());
    expect(isPdf(out)).toBe(true);
  });
});
