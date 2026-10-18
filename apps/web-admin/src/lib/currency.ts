import { cache } from 'react';
import { api, safe } from './api';

/**
 * The company's currency (Company.currency), the same for every role, the
 * broker portal, the public site and the apps. GET /company/currency is open
 * to every signed-in role — the old `reports.currency` setting was ADMIN-only,
 * so every other role silently got SAR.
 */
const getCompanyBasics = cache(async () => {
  const res = await safe(api.get<{ currency: string; timeZone?: string }>('/company/currency'));
  return res.data;
});

export const getReportsCurrency = cache(async (): Promise<string> => {
  return (await getCompanyBasics())?.currency ?? 'EGP';
});

/**
 * The company's time zone (setting company.timezone): "today" and "this
 * month" on the dashboard and reports are the company's, not the server's
 * UTC — for the first hours of a month in Cairo they showed the last month.
 */
export const getCompanyTimeZone = cache(async (): Promise<string> => {
  return (await getCompanyBasics())?.timeZone ?? 'Africa/Cairo';
});

/** Today's date (YYYY-MM-DD) in `timeZone`. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

export { currencySymbol } from './currency-format';
