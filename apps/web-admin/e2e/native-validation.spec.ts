import { test, expect } from '@playwright/test';
import { arabicNativeMessage } from '../src/lib/native-validation';

// F-006 / F-015 / F-025: the browser's own «Please fill out this field.» in an Arabic screen.
const field = (over: object, validity: object) => ({ validity, ...over }) as never;

test.describe('arabicNativeMessage', () => {
  test('a missing value reads in Arabic, by kind of field', () => {
    expect(arabicNativeMessage(field({ tagName: 'INPUT', type: 'text' }, { valueMissing: true }))).toBe('يرجى ملء هذا الحقل');
    expect(arabicNativeMessage(field({ tagName: 'SELECT', type: 'select-one' }, { valueMissing: true }))).toBe('يرجى اختيار عنصر من القائمة');
    expect(arabicNativeMessage(field({ tagName: 'INPUT', type: 'checkbox' }, { valueMissing: true }))).toBe('يرجى تحديد هذا المربع للمتابعة');
  });
  test('a bad email or too-short text is explained', () => {
    expect(arabicNativeMessage(field({ type: 'email' }, { typeMismatch: true }))).toBe('يرجى إدخال بريد إلكتروني صحيح');
    expect(arabicNativeMessage(field({ minLength: 2 }, { tooShort: true }))).toBe('يرجى إدخال 2 أحرف على الأقل');
  });
  test('anything else keeps the browser message', () => {
    expect(arabicNativeMessage(field({}, {}))).toBeNull();
  });
});
