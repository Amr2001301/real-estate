/**
 * MT-047 — DomainResolverService
 *
 * Maps a normalized hostname → tenant projection used by:
 *   - CompanyDomainsController public resolve endpoint (MT-048)
 *   - Future: Next.js middleware hostname routing (MT-051, deferred)
 *
 * Resolution order:
 *   1. Normalize hostname (normalizeHostname).
 *   2. Check Redis cache (key: company-domain:{hostname}, short TTL).
 *   3. On miss/error: query DB — CompanyDomain + Company join.
 *   4. Only resolves ACTIVE companies; non-ACTIVE → not found (no tenant leak).
 *   5. Only resolves verified custom domains (verifiedAt IS NOT NULL) or
 *      platform subdomains (always verified at creation).
 *
 * Cache invalidation is called by CompanyDomainsService and SuperAdminService
 * (lifecycle/websiteEnabled changes) via invalidateHostname().
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeHostname } from '../utils/hostname-normalize';
import type { Redis } from 'ioredis';

export const DOMAIN_CACHE_REDIS = Symbol('DOMAIN_CACHE_REDIS');

const CACHE_TTL_SECONDS = 60;

export interface ResolvedDomain {
  companyId: string;
  slug: string;
  hostname: string;
  domainType: string;
  lifecycleStatus: string;
  websiteEnabled: boolean;
}

@Injectable()
export class DomainResolverService {
  private readonly logger = new Logger(DomainResolverService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(DOMAIN_CACHE_REDIS) private readonly redis: Redis,
  ) {}

  async resolve(rawHostname: string): Promise<ResolvedDomain | null> {
    const hostname = normalizeHostname(rawHostname);
    const cacheKey = `company-domain:${hostname}`;

    let cached: string | null = null;
    try {
      cached = await this.redis.get(cacheKey);
    } catch (err) {
      this.logger.warn(`Redis error on domain cache read for ${hostname}: ${(err as Error).message}`);
    }

    if (cached) {
      try {
        return JSON.parse(cached) as ResolvedDomain;
      } catch {
        // Corrupt cache entry — fall through to DB
      }
    }

    const row = await this.prisma.companyDomain.findUnique({
      where: { hostname },
      select: {
        hostname: true,
        type: true,
        verifiedAt: true,
        company: {
          select: {
            id: true,
            slug: true,
            lifecycleStatus: true,
            websiteEnabled: true,
          },
        },
      },
    });

    if (!row) return null;
    // Only resolved verified domains (platform subdomains are auto-verified)
    if (!row.verifiedAt) return null;
    // Non-ACTIVE company is invisible — no tenant leak
    if (row.company.lifecycleStatus !== 'ACTIVE') return null;

    const resolved: ResolvedDomain = {
      companyId: row.company.id,
      slug: row.company.slug,
      hostname: row.hostname,
      domainType: row.type,
      lifecycleStatus: row.company.lifecycleStatus,
      websiteEnabled: row.company.websiteEnabled,
    };

    try {
      await this.redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(resolved));
    } catch (err) {
      this.logger.warn(`Redis error on domain cache write for ${hostname}: ${(err as Error).message}`);
    }

    return resolved;
  }

  async invalidateHostname(hostname: string): Promise<void> {
    const normalized = normalizeHostname(hostname);
    try {
      await this.redis.del(`company-domain:${normalized}`);
    } catch (err) {
      this.logger.warn(`Redis error on domain cache invalidation for ${normalized}: ${(err as Error).message}`);
    }
  }

  async invalidateAllForCompany(companyId: string): Promise<void> {
    const domains = await this.prisma.companyDomain.findMany({
      where: { companyId },
      select: { hostname: true },
    });

    const keys = domains.map((d) => `company-domain:${d.hostname}`);
    if (keys.length === 0) return;

    try {
      await this.redis.del(...keys);
    } catch (err) {
      this.logger.warn(`Redis error on domain cache invalidation for company ${companyId}: ${(err as Error).message}`);
    }
  }
}
