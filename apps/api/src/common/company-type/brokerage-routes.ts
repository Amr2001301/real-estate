/**
 * BRK-1 — what a brokerage company (Company.type = BROKERAGE) may reach.
 *
 * A brokerage is its own tenant: it sells many developers' units and resale /
 * rent listings, and runs its own leads, team and campaigns. The developer's
 * workflows (phases and buildings, instalment plans, contracts and their
 * schedules, payments and cheques, maintenance, the customer portal, the
 * developer's own broker partners) are not its business.
 *
 * Default-deny: only the route groups below are open to a brokerage. A new
 * developer feature stays closed to brokerages unless it is added here on
 * purpose; each brokerage phase (listings, deals, commissions, reports…) adds
 * its own groups.
 */
export const BROKERAGE_ROUTE_PREFIXES: readonly string[] = [
  // Account, team and permissions
  '/auth',
  '/users',
  '/permissions',
  '/capabilities',
  '/settings',
  '/audit-logs',
  // Company profile
  '/company/branding',
  '/company/currency',
  '/company/letterhead',
  '/media',
  '/customer-fields',
  // Customers and the sales pipeline
  '/leads',
  '/lead-sources',
  '/lost-reasons',
  '/lead-intake',
  '/intake',
  '/meta',
  '/visits',
  '/campaigns',
  // Tools
  '/notifications',
  '/ai',
  '/data-import',
  '/data-export',
  '/health',
];

/** Whether a request path (with or without the /v1 prefix) is open to a brokerage. */
export function isBrokerageRouteAllowed(path: string): boolean {
  const p = (path.split('?')[0] ?? '').replace(/^\/v\d+(?=\/)/, '');
  return BROKERAGE_ROUTE_PREFIXES.some((prefix) => p === prefix || p.startsWith(prefix + '/'));
}
