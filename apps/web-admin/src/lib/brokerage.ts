/**
 * BRK-1 — the dashboard pages a brokerage company (Company.type = BROKERAGE)
 * opens: its customers, pipeline, team, campaigns and set-up. The developer's
 * pages (inventory, contracts, instalments, payments, maintenance, its own
 * broker partners, the public site) are hidden, and proxy.ts sends a direct
 * link to one of them back to the home page. The API refuses them anyway.
 */
export const BROKERAGE_DASHBOARD_PATHS: readonly string[] = [
  '/dashboard',
  '/dashboard/assistant',
  '/dashboard/listings',
  '/dashboard/deals',
  '/dashboard/leads',
  '/dashboard/follow-ups',
  '/dashboard/calendar',
  '/dashboard/visits',
  '/dashboard/campaigns',
  '/dashboard/lost-reasons',
  '/dashboard/users',
  '/dashboard/permissions',
  '/dashboard/audit-logs',
  '/dashboard/company/branding',
  '/dashboard/company/customer-fields',
  '/dashboard/data-export',
  '/dashboard/data-import',
  '/dashboard/settings',
  '/dashboard/setup',
  '/dashboard/security',
];

/** BRK-2 — the brokerage's own pages: a developer company is sent home from them. */
export const BROKERAGE_ONLY_DASHBOARD_PATHS: readonly string[] = ['/dashboard/listings', '/dashboard/deals'];

export function isBrokerageOnlyDashboardPath(path: string): boolean {
  return BROKERAGE_ONLY_DASHBOARD_PATHS.some((p) => path === p || path.startsWith(p + '/'));
}

/** Whether a brokerage may open this dashboard path (the home page exactly; the rest with their sub-pages). */
export function isBrokerageDashboardPath(path: string): boolean {
  if (path === '/dashboard' || path === '/dashboard/') return true;
  return BROKERAGE_DASHBOARD_PATHS.some((p) => p !== '/dashboard' && (path === p || path.startsWith(p + '/')));
}
