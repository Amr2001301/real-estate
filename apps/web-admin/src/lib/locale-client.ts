import type { Locale } from './locale';

const DEFAULT: Locale = 'ar';

export function getClientLocale(): Locale {
  if (typeof document === 'undefined') return DEFAULT;
  const match = document.cookie.match(/(?:^|;\s*)admin-locale=([^;]+)/);
  return match?.[1] === 'en' ? 'en' : DEFAULT;
}
