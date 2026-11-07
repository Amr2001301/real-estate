import type { PortalProject } from './types';

/**
 * The commission a broker earns, as the portal home shows it: the rate granted on
 * each project (a range when they differ), else the firm's default; nothing when
 * no rate is known — never «0.00%» (QA F-040: the home showed the firm default,
 * which was not the rate locked on a granted project).
 */
export function brokerCommissionRange(
  projects: Pick<PortalProject, 'access'>[],
  defaultPct: string | number | null | undefined,
): string | null {
  const granted = projects
    .filter((p) => p.access.active !== false && p.access.commissionPct != null)
    .map((p) => Number(p.access.commissionPct))
    .filter((n) => Number.isFinite(n));
  const fmt = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(2).replace(/0$/, '')}%`;
  if (granted.length > 0) {
    const lo = Math.min(...granted);
    const hi = Math.max(...granted);
    return lo === hi ? fmt(lo) : `${fmt(lo)} – ${fmt(hi)}`;
  }
  const d = defaultPct == null ? NaN : Number(defaultPct);
  return Number.isFinite(d) && d > 0 ? fmt(d) : null;
}
