/**
 * MT-056 / MT-057 — Public Company discovery service.
 *
 * Queries only the platform Company registry for K1 customer-app tenant
 * discovery. No tenant context is required — these are @PlatformPublic routes.
 *
 * Eligibility rule (enforced here, not in the caller):
 *   lifecycleStatus == ACTIVE
 *   AND customerAppEnabled == true
 *   AND isActive == true  (legacy guard until MT-034 fully retires it)
 *
 * No companyId is returned. slug is the external tenant identifier.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface DiscoveredCompany {
  slug: string;
  name: string;
}

const ELIGIBLE_WHERE = {
  lifecycleStatus: 'ACTIVE' as const,
  customerAppEnabled: true,
  isActive: true,
} as const;

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
      select: { slug: true, name: true },
      orderBy: { slug: 'asc' },
      take: SEARCH_LIMIT,
    });

    return rows.map((r) => ({ slug: r.slug, name: r.name }));
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
      select: { slug: true, name: true },
    });

    if (!company) return null;
    return { slug: company.slug, name: company.name };
  }
}
