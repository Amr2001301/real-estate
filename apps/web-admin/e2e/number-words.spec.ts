import { test, expect } from '@playwright/test';
import { amountInWords, arabicNumberWords } from '../src/lib/document-template';

// F-072: the amount written in words on contracts and receipts.
test.describe('arabicNumberWords', () => {
  test('200 before a scale word takes the construct form', () => {
    expect(arabicNumberWords(200_000)).toBe('مائتا ألف');
    expect(arabicNumberWords(200_000_000)).toBe('مائتا مليون');
    expect(arabicNumberWords(2_200_000)).toBe('مليونان ومائتا ألف');
  });
  test('other hundreds and the plain 200 are unchanged', () => {
    expect(arabicNumberWords(200)).toBe('مائتان');
    expect(arabicNumberWords(220_000)).toBe('مائتان وعشرون ألف');
    expect(arabicNumberWords(300_000)).toBe('ثلاثمائة ألف');
    expect(arabicNumberWords(2_400_000)).toBe('مليونان وأربعمائة ألف');
    expect(arabicNumberWords(3_000_000)).toBe('ثلاثة ملايين');
  });
});

test.describe('amountInWords', () => {
  test('carries a rounded-up minor unit into the major one', () => {
    expect(amountInWords(99.995, 'EGP', 'ar')).toBe('فقط مائة جنيه مصري لا غير');
    expect(amountInWords(99.995, 'EGP', 'en')).toBe('Only one hundred Egyptian pounds');
  });
  test('keeps ordinary amounts', () => {
    expect(amountInWords(2500.5, 'EGP', 'ar')).toBe('فقط ألفان وخمسمائة جنيه مصري وخمسون قرش لا غير');
    expect(amountInWords(1234.99, 'EGP', 'en')).toBe(
      'Only one thousand, two hundred and thirty-four Egyptian pounds and ninety-nine piastres',
    );
    expect(amountInWords(0, 'EGP', 'ar')).toBe('فقط صفر جنيه مصري لا غير');
  });
});
