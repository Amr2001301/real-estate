import { arabicCurrencySymbol, formatMoney, getCompanyCurrency, normalizeCurrency } from '../currency';

describe('company currency helpers', () => {
  it('normalizes to a supported code, else the EGP default', () => {
    expect(normalizeCurrency(' sar ')).toBe('SAR');
    expect(normalizeCurrency('XYZ')).toBe('EGP');
    expect(normalizeCurrency(null)).toBe('EGP');
  });

  it('formats amounts in the reader\'s language, dropping decimals on whole amounts', () => {
    expect(formatMoney('2500000.00', 'EGP', 'en')).toMatch(/^EGP\s2,500,000$/);
    expect(formatMoney(1250.5, 'SAR', 'en')).toMatch(/^SAR\s1,250\.50$/);
    expect(formatMoney('2500000', 'EGP', 'ar')).toContain('٢٬٥٠٠٬٠٠٠');
    expect(formatMoney('2500000', 'EGP', 'ar')).toContain('ج.م');
  });

  it('leaves non-numeric values as they are', () => {
    expect(formatMoney('n/a', 'EGP', 'en')).toBe('n/a');
    expect(formatMoney(null, 'EGP', 'en')).toBe('');
  });

  it('gives the Arabic symbol per currency', () => {
    expect(arabicCurrencySymbol('EGP')).toBe('ج.م');
    expect(arabicCurrencySymbol('SAR')).toBe('ر.س');
  });

  it('reads Company.currency, and falls back to EGP when it cannot', async () => {
    const db = { company: { findUnique: jest.fn().mockResolvedValue({ currency: 'AED' }) } };
    expect(await getCompanyCurrency(db as never, 'c1')).toBe('AED');
    expect(await getCompanyCurrency(db as never, null)).toBe('EGP');
    db.company.findUnique.mockRejectedValueOnce(new Error('db down'));
    expect(await getCompanyCurrency(db as never, 'c1')).toBe('EGP');
  });
});
