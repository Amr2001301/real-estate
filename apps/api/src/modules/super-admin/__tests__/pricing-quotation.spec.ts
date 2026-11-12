import { BadRequestException } from '@nestjs/common';
import { SuperAdminService } from '../super-admin.service';

const row = (over: Record<string, unknown> = {}) => ({
  id: 'p1', companyId: null, planTier: 'STARTER', nameAr: 'الأساسية', nameEn: 'Starter', descAr: null, descEn: null,
  currency: 'EGP', monthlyPrice: '3500', annualPrice: null, setupFee: null, maxUsers: null, highlights: [],
  specialOffer: null, sortOrder: 1, isActive: true, ...over,
});

function make(rows: unknown[], pdf?: { available: () => boolean; render: jest.Mock }) {
  const prisma = { pricingPackage: { findMany: jest.fn().mockResolvedValue(rows) }, aiPackage: { findMany: jest.fn().mockResolvedValue([]) } };
  return { prisma, service: new SuperAdminService(prisma as never, {} as never, {} as never, {} as never, undefined, pdf as never) };
}

describe('pricing quotation PDF', () => {
  it('refuses to issue a quotation with no active paid package', async () => {
    const { service } = make([row({ planTier: 'TRIAL' }), row({ isActive: false })]);
    await expect(service.pricingQuotationPdf({})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('renders the active paid packages through Chromium in the asked language', async () => {
    const render = jest.fn().mockResolvedValue(Buffer.from('%PDF'));
    const { service } = make([row(), row({ id: 'p2', planTier: 'TRIAL' })], { available: () => true, render });
    const out = await service.pricingQuotationPdf({ locale: 'en', client: 'Acme' });
    expect(out.toString()).toBe('%PDF');
    const [html, footer] = render.mock.calls[0];
    expect(html).toContain('Acme');
    expect(html).toContain('Starter');
    expect(html).not.toContain('Trial');
    expect(footer.lang).toBe('en');
  });
});
