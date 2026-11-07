import { test, expect } from '@playwright/test';
import { formatCurrency, formatExactCurrency } from '../src/lib/format';

// F-034: a payment of 37,380.95 was shown as «37,381» on the payments list and detail.
test.describe('formatExactCurrency', () => {
  test('keeps the piastres of a payment', () => {
    expect(formatExactCurrency('37380.95', 'EGP', 'en')).toContain('37,380.95');
    expect(formatCurrency('37380.95', 'EGP', 'en')).not.toContain('.95');
  });
  test('whole amounts show no decimals', () => {
    expect(formatExactCurrency(100000, 'EGP', 'en')).toContain('100,000');
    expect(formatExactCurrency(100000, 'EGP', 'en')).not.toContain('.00');
  });
  test('missing or invalid values read as a dash', () => {
    expect(formatExactCurrency(null)).toBe('—');
    expect(formatExactCurrency('abc')).toBe('—');
  });
});
