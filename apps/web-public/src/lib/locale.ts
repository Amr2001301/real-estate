import { cookies } from 'next/headers';

export type Locale = 'ar' | 'en';

export async function getLocale(): Promise<Locale> {
  const jar = await cookies();
  return jar.get('site-locale')?.value === 'en' ? 'en' : 'ar';
}
