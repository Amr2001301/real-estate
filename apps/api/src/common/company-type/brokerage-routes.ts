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
  // BRK-2 — its listings, and the unit types they are filed under
  '/listings',
  '/unit-types',
  // BRK-3 — deals, commission rules and developer claims
  '/deals',
  // Tools
  '/notifications',
  '/ai',
  '/data-import',
  '/data-export',
  '/health',
];

/** The brokerage's own route groups: a developer company does not reach them. */
export const BROKERAGE_ONLY_ROUTE_PREFIXES: readonly string[] = ['/listings', '/deals'];

function bare(path: string): string {
  return (path.split('?')[0] ?? '').replace(/^\/v\d+(?=\/)/, '');
}

function under(p: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => p === prefix || p.startsWith(prefix + '/'));
}

/** Whether a request path (with or without the /v1 prefix) is open to a brokerage. */
export function isBrokerageRouteAllowed(path: string): boolean {
  return under(bare(path), BROKERAGE_ROUTE_PREFIXES);
}

/** Whether a request path belongs to the brokerage only (closed to developers). */
export function isBrokerageOnlyRoute(path: string): boolean {
  return under(bare(path), BROKERAGE_ONLY_ROUTE_PREFIXES);
}
