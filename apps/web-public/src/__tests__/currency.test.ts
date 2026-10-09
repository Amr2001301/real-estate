/**
 * Prices on the public site follow the company currency (Company.currency,
 * from the public branding) — they were hard-coded to ج.م, and the product
 * JSON-LD to SAR.
 */
import { formatPrice, currencySymbol } from '@/lib/format';
import { unitProductLd } from '@/lib/jsonld';

describe('company currency on the public site', () => {
  it('formats a price with the company currency symbol', () => {
    expect(formatPrice('2500000', 'EGP')).toBe('٢٬٥٠٠٬٠٠٠ ج.م');
    expect(formatPrice(2500000, 'SAR')).toBe('٢٬٥٠٠٬٠٠٠ ر.س');
    expect(formatPrice(null, 'EGP')).toBe('—');
  });

  it('shows an unknown code as-is', () => {
    expect(currencySymbol('XYZ')).toBe('XYZ');
  });

  it('declares the company currency in the product JSON-LD', () => {
    const ld = unitProductLd({ name: 'U', price: '900000', currency: 'EGP', status: 'AVAILABLE', path: '/units/u' });
    expect((ld as { offers?: { priceCurrency: string } }).offers?.priceCurrency).toBe('EGP');
  });
});
