import { z } from 'zod';
export declare const TranslatableSchema: z.ZodObject<{
    ar: z.ZodString;
    en: z.ZodString;
}, "strip", z.ZodTypeAny, {
    ar: string;
    en: string;
}, {
    ar: string;
    en: string;
}>;
export type Translatable = z.infer<typeof TranslatableSchema>;
export declare function pickLocale(value: Translatable, locale: 'ar' | 'en'): string;
