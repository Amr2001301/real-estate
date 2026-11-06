/**
 * MT-056 / MT-057 — Public Company discovery service.
 *
 * Queries only the platform Company registry for K1 customer-app tenant
 * discovery. No tenant context is required — these are @PlatformPublic routes.
 *
 * Eligibility rule (enforced here, not in the caller):
 *   lifecycleStatus == ACTIVE
 *   AND the customer app is on for the company: Company.customerAppEnabled when
 *       set, otherwise the subscription plan's default (a company made in the
 *       super-admin UI has it unset — «use the plan's default» — and was refused,
 *       QA run 1, F-016)
 *   AND isActive == true  (legacy guard until MT-034 fully retires it)
 *
 * No companyId is returned. slug is the external tenant identifier.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { buildEffectiveView } from '../../common/capabilities/capability-schema';

export interface DiscoveredCompany {
  slug: string;
  name: string;
}

const ELIGIBLE_WHERE = {
  lifecycleStatus: 'ACTIVE' as const,
  // Switched on, or left to the plan's default (null) — decided in [customerAppOn].
  AND: [{ OR: [{ customerAppEnabled: true }, { customerAppEnabled: null }] }],
  isActive: true,
};

const ELIGIBLE_SELECT = {
  slug: true,
  name: true,
  customerAppEnabled: true,
  subscriptionPlan: true,
  capabilities: true,
  websiteEnabled: true,
  staffAppEnabled: true,
} as const;

interface EligibleRow {
  slug: string;
  name: string;
  customerAppEnabled?: boolean | null;
  subscriptionPlan?: Parameters<typeof buildEffectiveView>[0];
  capabilities?: unknown;
  websiteEnabled?: boolean | null;
  staffAppEnabled?: boolean | null;
}

/** Whether the company's customer app is on: its own switch, else its plan's default. */
function customerAppOn(row: EligibleRow): boolean {
  if (row.customerAppEnabled === true) return true;
  if (row.customerAppEnabled === false || !row.subscriptionPlan) return false;
  const view = buildEffectiveView(
    row.subscriptionPlan,
    (row.capabilities as Record<string, unknown> | null) ?? {},
    row.websiteEnabled ?? null,
    null,
    row.staffAppEnabled ?? null,
  );
  return view.keys.find((k) => k.key === 'feature.customerApp')?.effective === true;
}

/** Maximum results returned by search — bounding response size and db work. */
const SEARCH_LIMIT = 10;

@Injectable()
export class PublicCompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * MT-056 — Full-text search over eligible Companies.
   * Matches against name (case-insensitive) or slug.
   * Bounded to SEARCH_LIMIT results, ordered by slug (deterministic).
   */
  async search(query: string): Promise<DiscoveredCompany[]> {
    const q = query.trim();

    const rows = await this.prisma.company.findMany({
      where: {
        ...ELIGIBLE_WHERE,
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { slug: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: ELIGIBLE_SELECT,
      orderBy: { slug: 'asc' },
      // More than the limit: some rows are dropped by their plan's default below.
      take: SEARCH_LIMIT * 5,
    });

    return rows
      .filter((r) => customerAppOn(r as EligibleRow))
      .slice(0, SEARCH_LIMIT)
      .map((r) => ({ slug: r.slug, name: r.name }));
  }

  /**
   * MT-057 — Exact slug resolve for the customer app.
   * Returns null for unknown slugs, inactive companies, or disabled customer app.
   * Callers must not distinguish the failure reasons to anonymous clients.
   */
  async resolveBySlug(slug: string): Promise<DiscoveredCompany | null> {
    const normalizedSlug = slug.trim().toLowerCase();

    const company = await this.prisma.company.findFirst({
      where: {
        slug: normalizedSlug,
        ...ELIGIBLE_WHERE,
      },
      select: ELIGIBLE_SELECT,
    });

    if (!company || !customerAppOn(company as EligibleRow)) return null;
    return { slug: company.slug, name: company.name };
  }
}
