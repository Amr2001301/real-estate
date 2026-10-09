import { cache } from 'react';
import { api, safe } from './api';

/**
 * The company's currency (Company.currency), the same for every role, the
 * broker portal, the public site and the apps. GET /company/currency is open
 * to every signed-in role — the old `reports.currency` setting was ADMIN-only,
 * so every other role silently got SAR.
 */
export const getReportsCurrency = cache(async (): Promise<string> => {
  const res = await safe(api.get<{ currency: string }>('/company/currency'));
  return res.data?.currency ?? 'EGP';
});

export { currencySymbol } from './currency-format';
