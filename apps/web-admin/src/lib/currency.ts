import { cache } from 'react';
import { api, safe } from './api';
import type { SettingItem } from './types';

export const getReportsCurrency = cache(async (): Promise<string> => {
  const res = await safe(api.get<SettingItem[]>('/settings?group=reports'));
  const items = res.data ?? [];
  const setting = items.find((i) => i.key === 'reports.currency');
  return typeof setting?.value === 'string' ? setting.value : 'SAR';
});

const SYMBOL_MAP: Record<string, string> = {
  SAR: 'ر.س',
  EGP: 'ج.م',
  USD: '$',
  AED: 'د.إ',
  KWD: 'د.ك',
  QAR: 'ر.ق',
  BHD: 'د.ب',
  OMR: 'ر.ع',
  JOD: 'د.أ',
};

export function currencySymbol(code: string): string {
  return SYMBOL_MAP[code] ?? code;
}
