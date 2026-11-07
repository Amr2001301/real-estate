/**
 * The dashboard's recent-activity feed comes from the API with its action in
 * Arabic ('عقد جديد'). English screens label each kind of activity themselves,
 * by its type (QA run 2, English sweep).
 */
const EN: Record<string, string> = {
  lead: 'New lead',
  reservation: 'New reservation',
  contract: 'New contract',
  visit: 'Visit request',
  maintenance: 'Maintenance request',
  deposit: 'New payment',
  info_request: 'New inquiry',
};

export function activityActionLabel(type: string, apiAction: string, locale: string): string {
  if (locale !== 'en') return apiAction;
  return EN[type] ?? apiAction;
}

/**
 * A month label for the dashboard charts. The API labels months in Arabic; on an
 * English screen the label is built from the month's key ('2026-11') instead.
 */
export function monthChartLabel(monthKey: string, apiLabel: string, locale: string): string {
  if (locale !== 'en') return apiLabel;
  const m = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!m) return apiLabel;
  return new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1)),
  );
}
