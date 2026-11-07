/**
 * The browser words its own form checks («Please fill out this field.») in the
 * language of the browser, not of the page. In the Arabic screens these read as
 * English errors (QA run 1, F-006, F-015, F-025). This gives the Arabic text for
 * the checks the forms use; null means "leave the browser's own message".
 */
export interface NativeField {
  type?: string;
  tagName?: string;
  minLength?: number;
  min?: string;
  max?: string;
  validity: {
    valueMissing?: boolean;
    typeMismatch?: boolean;
    patternMismatch?: boolean;
    tooShort?: boolean;
    rangeUnderflow?: boolean;
    rangeOverflow?: boolean;
  };
}

export function arabicNativeMessage(el: NativeField): string | null {
  const v = el.validity;
  const type = (el.type ?? '').toLowerCase();
  const tag = (el.tagName ?? '').toUpperCase();
  if (v.valueMissing) {
    if (tag === 'SELECT' || type === 'select-one') return 'يرجى اختيار عنصر من القائمة';
    if (type === 'checkbox') return 'يرجى تحديد هذا المربع للمتابعة';
    if (type === 'radio') return 'يرجى اختيار أحد الخيارات';
    if (type === 'file') return 'يرجى اختيار ملف';
    return 'يرجى ملء هذا الحقل';
  }
  if (v.typeMismatch) {
    if (type === 'email') return 'يرجى إدخال بريد إلكتروني صحيح';
    if (type === 'url') return 'يرجى إدخال رابط صحيح';
    return 'يرجى إدخال قيمة بالصيغة المطلوبة';
  }
  if (v.patternMismatch) return 'يرجى إدخال القيمة بالصيغة المطلوبة';
  if (v.tooShort) return `يرجى إدخال ${el.minLength ?? ''} أحرف على الأقل`.replace('  ', ' ');
  if (v.rangeUnderflow) return `يجب أن تكون القيمة ${el.min ?? ''} أو أكثر`.replace('  ', ' ');
  if (v.rangeOverflow) return `يجب أن تكون القيمة ${el.max ?? ''} أو أقل`.replace('  ', ' ');
  return null;
}
