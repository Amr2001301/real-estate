import { z } from 'zod';

export const TranslatableSchema = z.object({
  ar: z.string().min(1),
  en: z.string().min(1),
});

export type Translatable = z.infer<typeof TranslatableSchema>;

export function pickLocale(value: Translatable, locale: 'ar' | 'en'): string {
  return value[locale] ?? value.en ?? value.ar;
}
