import { buildPricingQuotationHtml, type QuotePackage } from '../pricing-quotation-html';

const pkg = (tier: string, over: Partial<QuotePackage> = {}): QuotePackage => ({
  planTier: tier,
  nameAr: `باقة ${tier}`,
  nameEn: `Plan ${tier}`,
  descAr: null,
  descEn: null,
  currency: 'EGP',
  monthlyPrice: '3500.00',
  annualPrice: '35000.00',
  setupFee: null,
  maxUsers: null,
  highlights: [],
  specialOffer: null,
  ...over,
});

const base = {
  reference: 'Q-20261112-TEST',
  issuedAt: new Date('2026-11-12T10:00:00Z'),
  validDays: 30,
};

describe('pricing quotation HTML', () => {
  it('shows prices, the annual saving and the seat limit from the plan', () => {
    const html = buildPricingQuotationHtml({
      ...base,
      locale: 'en',
      packages: [pkg('STARTER'), pkg('PROFESSIONAL', { monthlyPrice: '8500', annualPrice: '85000', maxUsers: 50 })],
    });
    expect(html).toContain('35,000');
    expect(html).toContain('85,000');
    expect(html).toContain('per year');
    expect(html).not.toContain('per month'); // sold as an annual subscription, not monthly
    expect(html).toContain('Up to 10 staff users'); // STARTER default seats
    expect(html).toContain('Up to 50 staff users');
    expect(html).toContain('Q-20261112-TEST');
  });

  it('only lists the features a plan actually includes', () => {
    const html = buildPricingQuotationHtml({ ...base, locale: 'en', packages: [pkg('STARTER')] });
    const card = html.slice(html.indexOf('<article'), html.indexOf('</article>'));
    expect(card).toContain('Dashboard');
    expect(card).toContain('Custom website domain'); // the domain is open to every plan
    expect(card).not.toContain('Broker portal'); // STARTER has no brokers
    expect(card).not.toContain('Advanced reports'); // STARTER has no advanced reports
  });

  it('marks unlimited staff for a plan without a seat limit', () => {
    const html = buildPricingQuotationHtml({ ...base, locale: 'ar', packages: [pkg('ENTERPRISE')] });
    expect(html).toContain('عدد غير محدود من الموظفين');
    expect(html).toContain('dir="rtl"');
  });

  it('escapes the client name', () => {
    const html = buildPricingQuotationHtml({
      ...base,
      locale: 'en',
      client: '<script>alert(1)</script>',
      packages: [pkg('STARTER')],
    });
    expect(html).not.toContain('<script>alert');
  });

  it('asks the customer to get in touch when a plan has no price', () => {
    const html = buildPricingQuotationHtml({
      ...base,
      locale: 'en',
      packages: [pkg('PROFESSIONAL', { monthlyPrice: null, annualPrice: null })],
    });
    expect(html).toContain('Contact us for pricing');
  });

  it('shows the custom-plan message and never a card for the CUSTOM tier', () => {
    const html = buildPricingQuotationHtml({
      ...base,
      locale: 'en',
      packages: [pkg('STARTER'), pkg('CUSTOM', { nameEn: 'Tailored' })],
    });
    expect(html).toContain('Need more? We tailor your plan');
    expect(html).not.toContain('Tailored');
  });

  it('prints the free services and the assistant add-on with its monthly rules', () => {
    const html = buildPricingQuotationHtml({
      ...base,
      locale: 'en',
      packages: [pkg('STARTER')],
      aiPackages: [{ name: 'Assistant 500', questions: 500, price: '2000', currency: 'EGP' }],
    });
    expect(html).toContain('24/7 technical support');
    expect(html).toContain('Assistant 500');
    expect(html).toContain('renew early');
  });

  it('leaves the add-on section out when no assistant package is offered', () => {
    const html = buildPricingQuotationHtml({ ...base, locale: 'en', packages: [pkg('STARTER')], aiPackages: [] });
    expect(html).not.toContain('AI assistant (optional add-on)');
  });

  it('drops an expired special offer', () => {
    const html = buildPricingQuotationHtml({
      ...base,
      locale: 'en',
      packages: [
        pkg('STARTER', {
          specialOffer: { titleAr: 'x', titleEn: 'Launch', discountPct: 10, validUntil: '2020-01-01' },
        }),
      ],
    });
    expect(html).not.toContain('Launch');
  });
});
