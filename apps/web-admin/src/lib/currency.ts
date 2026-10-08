import { cache } from 'react';
import { api, safe } from './api';
import type { SettingItem } from './types';

export const getReportsCurrency = cache(async (): Promise<string> => {
  const res = await safe(api.get<SettingItem[]>('/settings?group=reports'));
  const items = res.data ?? [];
  const setting = items.find((i) => i.key === 'reports.currency');
  return typeof setting?.value === 'string' ? setting.value : 'SAR';
});

export { currencySymbol } from './currency-format';
