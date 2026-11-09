'use client';

import { useEffect } from 'react';
import { arabicNativeMessage, type NativeField } from '@/lib/native-validation';

/**
 * Puts the browser's own form errors in Arabic on the Arabic screens. Mounted
 * once in the root layout; renders nothing.
 */
export function NativeValidationMessages({ locale }: { locale: string }) {
  useEffect(() => {
    if (locale !== 'ar') return;
    const onInvalid = (e: Event) => {
      const el = e.target as (HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) | null;
      if (!el || typeof el.setCustomValidity !== 'function') return;
      el.setCustomValidity('');
      const msg = arabicNativeMessage(el as unknown as NativeField);
      if (msg) el.setCustomValidity(msg);
    };
    // A custom message sticks until cleared, so clear it as soon as the value changes.
    const onChange = (e: Event) => {
      const el = e.target as HTMLInputElement | null;
      if (el && typeof el.setCustomValidity === 'function') el.setCustomValidity('');
    };
    document.addEventListener('invalid', onInvalid, true);
    document.addEventListener('input', onChange, true);
    document.addEventListener('change', onChange, true);
    return () => {
      document.removeEventListener('invalid', onInvalid, true);
      document.removeEventListener('input', onChange, true);
      document.removeEventListener('change', onChange, true);
    };
  }, [locale]);
  return null;
}
