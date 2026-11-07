import { test, expect } from '@playwright/test';
import { upfrontTotal } from '../src/lib/upfront-total';

// F-026: the booking amount is paid on top of the down payment, so the screens
// state the total paid up front instead of leaving «مقدم 10%» to be misread.
test.describe('upfrontTotal', () => {
  test('adds the booking amount to the down payment', () => {
    expect(upfrontTotal(100_000, 360_000)).toBe(460_000);
    expect(upfrontTotal('100000', '360000.50')).toBe(460_000.5);
  });
  test('says nothing when there is no booking amount or no down payment', () => {
    expect(upfrontTotal(0, 360_000)).toBeNull();
    expect(upfrontTotal(100_000, 0)).toBeNull();
    expect(upfrontTotal(null, 360_000)).toBeNull();
    expect(upfrontTotal(100_000, undefined)).toBeNull();
    expect(upfrontTotal('abc', 1)).toBeNull();
  });
});
