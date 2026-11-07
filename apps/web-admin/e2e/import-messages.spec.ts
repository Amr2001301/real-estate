import { test, expect } from '@playwright/test';
import { translateImportMessage } from '../src/lib/import-messages';

// F-018: the import preview showed English row errors inside the Arabic screen.
const ar = (m: string) => translateImportMessage(m, 'ar');

test.describe('translateImportMessage', () => {
  test('the messages seen in QA read in Arabic with their values', () => {
    expect(ar('Unknown building "ZZ9" in phase "PH1" / project "NC"')).toBe('المبنى «ZZ9» غير موجود في المرحلة «PH1» / المشروع «NC»');
    expect(ar('price must be greater than 0')).toBe('price يجب أن يكون أكبر من صفر');
    expect(ar('Phone "0123" is not a recognised Egyptian mobile number')).toBe('الرقم «0123» ليس رقم موبايل مصريًا معروفًا');
    expect(ar('Duplicate email "a@b.co" within this sheet')).toBe('البريد «a@b.co» مكرر في الورقة');
  });
  test('an unknown message is shown as the API wrote it', () => {
    expect(ar('Something new happened')).toBe('Something new happened');
  });
  test('English screens keep the English message', () => {
    expect(translateImportMessage('Unit code is required', 'en')).toBe('Unit code is required');
  });
});
