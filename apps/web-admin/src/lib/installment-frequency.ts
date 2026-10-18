import type { Locale } from './locale';
import type { InstallmentFrequency } from './types';

const PERIODIC_LABEL: Record<Locale, Partial<Record<InstallmentFrequency, string>>> = {
  ar: { QUARTERLY: 'القسط الربع سنوي', SEMI_ANNUAL: 'القسط نصف السنوي', YEARLY: 'القسط السنوي' },
  en: {
    QUARTERLY: 'Quarterly installment',
    SEMI_ANNUAL: 'Semi-annual installment',
    YEARLY: 'Annual installment',
  },
};

/**
 * The per-row label of a reservation whose plan is priced by a quarterly /
 * semi-annual / yearly instalment count; null for a monthly one, where the
 * page keeps its own "monthly installment" label.
 */
export function periodicInstallmentLabel(
  frequency: InstallmentFrequency | null | undefined,
  locale: Locale,
): string | null {
  return (frequency && PERIODIC_LABEL[locale][frequency]) || null;
}
