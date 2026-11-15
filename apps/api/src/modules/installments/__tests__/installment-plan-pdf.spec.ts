import { NotFoundException } from '@nestjs/common';
import type { ReportPdfService } from '../../../common/report-pdf/report-pdf.service';
import { runInCompany } from '../../../common/tenant/tenant-context';
import { InstallmentsService } from '../installments.module';

/**
 * The installment schedule as a statement PDF: the plan is read inside the
 * caller's company only, and the statement carries the contract, customer,
 * unit and every installment.
 */
const COMPANY = '00000000-0000-0000-0000-0000000000aa';
const PLAN = '11111111-1111-1111-1111-111111111111';

function setup(plan: unknown) {
  const findFirst = jest.fn().mockResolvedValue(plan);
  const prisma = {
    installmentPlan: { findFirst },
    company: { findUnique: jest.fn().mockResolvedValue({ currency: 'EGP' }) },
    setting: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const render = jest.fn().mockResolvedValue(Buffer.from('%PDF-plan'));
  const pdf = { available: () => true, render } as unknown as ReportPdfService;
  const svc = new InstallmentsService(prisma as never, undefined, pdf);
  return { svc, findFirst, render };
}

describe('InstallmentsService.planPdf', () => {
  it("reads the plan within the caller's company and renders the statement", async () => {
    const { svc, findFirst, render } = setup({
      id: PLAN,
      installments: [
        {
          dueDate: new Date('2026-09-01'),
          id: 'r1',
          type: 'DOWN_PAYMENT',
          amount: 100000,
          status: 'PAID',
          paidAt: new Date('2026-09-01'),
          feeForId: null,
          deposits: [
            {
              id: 'dep-1111-feedc0de',
              paidAt: new Date('2026-09-01T09:00:00Z'),
              paymentMethod: 'CASH',
              deletedAt: null,
              reviewStatus: 'NO_PROOF',
              paymentInstrument: null,
              paymentCorrections: [],
            },
          ],
        },
        {
          dueDate: new Date('2026-10-01'),
          id: 'r2',
          type: 'INSTALLMENT',
          amount: 20000,
          status: 'PENDING',
          paidAt: null,
          feeForId: null,
          deposits: [],
        },
      ],
      contract: {
        contractNumber: 'C-77',
        signedAt: new Date('2026-08-20T10:00:00Z'),
        totalAmount: 120000,
        customer: { fullName: 'منى', phone: '+201000000077' },
        unit: { code: 'B-7', building: { phase: { project: { name: { ar: 'الريم', en: 'Reem' } } } } },
      },
    });

    const out = await runInCompany(COMPANY, () => svc.planPdf(PLAN));

    expect(out.toString()).toBe('%PDF-plan');
    expect(findFirst.mock.calls[0][0].where).toEqual({ id: PLAN, companyId: COMPANY });
    const [html] = render.mock.calls[0] as [string];
    expect(html).toContain('عقد C-77');
    expect(html).toContain('منى');
    expect(html).toContain('B-7');
    expect(html).toContain('120,000 ج.م');
    // The row carries what was paid, how, and the receipt number.
    expect(html).toContain('FEEDC0DE');
    expect(html).toContain('نقدًا');
    expect(html).toContain('+201000000077');
    expect(html).toContain('عقد C-77 · الريم');
  });

  it("is 404 for a plan outside the caller's company", async () => {
    const { svc } = setup(null);
    await expect(runInCompany(COMPANY, () => svc.planPdf(PLAN))).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
