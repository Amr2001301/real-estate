/**
 * F-066: the formatting helpers speak English when asked, and are unchanged by default.
 */
import { formatNumber, formatPrice, formatArea, currencySymbol, cityLabel, unitTypeLabel, pickAr } from '../lib/format';

describe('English formatting', () => {
  it('numbers, prices and areas use Latin digits and ISO currency codes', () => {
    expect(formatNumber(1234567, 'en')).toBe('1,234,567');
    expect(formatPrice('2500000', 'EGP', 'en')).toBe('2,500,000 EGP');
    expect(formatPrice(900000, 'USD', 'en')).toBe('900,000 $');
    expect(formatArea(120, 'en')).toBe('120 m²');
    expect(currencySymbol('SAR', 'en')).toBe('SAR');
  });

  it('Arabic stays the default, with Western digits like the dashboard', () => {
    expect(formatPrice('2500000', 'EGP')).toBe('2,500,000 ج.م');
    expect(formatArea(120)).toBe('120 م²');
    expect(cityLabel('riyadh')).toBe('الرياض');
  });

  it('cities, unit types and translatable values follow the language', () => {
    expect(cityLabel('القاهرة الجديدة', 'en')).toBe('New Cairo');
    expect(cityLabel('Some Town', 'en')).toBe('Some Town');
    expect(cityLabel('', 'en')).toBe('Prime location');
    expect(unitTypeLabel('villa', null, 'en')).toBe('Villa');
    expect(unitTypeLabel('villa', { ar: 'فيلا', en: 'Detached villa' }, 'en')).toBe('Detached villa');
    expect(pickAr({ ar: 'حدائق', en: 'Gardens' }, '', 'en')).toBe('Gardens');
    expect(pickAr({ ar: 'حدائق' }, '', 'en')).toBe('حدائق');
    expect(pickAr({ ar: 'حدائق', en: 'Gardens' })).toBe('حدائق');
  });
});
