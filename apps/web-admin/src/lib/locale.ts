import { cookies } from 'next/headers';

export type Locale = 'ar' | 'en';
export const DEFAULT_LOCALE: Locale = 'ar';

export async function getLocale(): Promise<Locale> {
  const jar = await cookies();
  const val = jar.get('admin-locale')?.value;
  return val === 'en' ? 'en' : 'ar';
}
