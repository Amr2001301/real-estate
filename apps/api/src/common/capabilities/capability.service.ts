/**
 * MT-038 — CapabilityService
 *
 * Central authority for Company runtime capability checks.
 *
 * IMPORTANT INVARIANTS:
 * - companyId comes from req.user.companyId (JwtStrategy DB reload) — never from token payload.
 * - Missing capability → false. Unknown key is NOT granted.
 * - Redis unavailable → DB fallback (never fail open).
 * - Cache is per-companyId; entries never cross tenant boundaries.
 * - Cache TTL: 300 s. Invalidated immediately on capability update.
 */

import { ForbiddenException, Inject, Injectable, Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';

export const CAPABILITY_CACHE_REDIS = Symbol('CAPABILITY_CACHE_REDIS');

/** Capabilities blob shape stored in Company.capabilities JSONB. */
export type CompanyCapabilities = Record<string, boolean>;

const CACHE_TTL_SECONDS = 300;
const cacheKey = (companyId: string) => `company-capabilities:${companyId}`;

@Injectable()
export class CapabilityService {
  private readonly logger = new Logger(CapabilityService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CAPABILITY_CACHE_REDIS) private readonly redis: Redis,
  ) {}

  /**
   * Returns true iff the Company has the named capability explicitly set to true.
   * A missing or null capabilities blob, or a missing key, returns false.
   */
  async hasCapability(companyId: string, capability: string): Promise<boolean> {
    const caps = await this.getCapabilities(companyId);
    return caps[capability] === true;
  }

  /**
   * Throws ForbiddenException with stable code CAPABILITY_NOT_ENABLED when
   * the Company does not have the named capability. Resolves silently if it does.
   */
  async requireCapability(companyId: string, capability: string): Promise<void> {
    const has = await this.hasCapability(companyId, capability);
    if (!has) {
      throw new ForbiddenException({
        message: `Capability not enabled: ${capability}`,
        code: 'CAPABILITY_NOT_ENABLED',
        capability,
      });
    }
  }

  /**
   * Returns the full capabilities map for a Company.
   * Tries Redis cache first; falls back to DB on cache miss or Redis error.
   * Returns an empty object if the Company has no capabilities defined.
   */
  async getCapabilities(companyId: string): Promise<CompanyCapabilities> {
    const key = cacheKey(companyId);

    // ── Cache read ──────────────────────────────────────────────────────────
    try {
      const cached = await this.redis.get(key);
      if (cached !== null) {
        return JSON.parse(cached) as CompanyCapabilities;
      }
    } catch (err) {
      this.logger.warn(`[CapabilityService] Redis read error for ${companyId}: ${(err as Error).message}`);
    }

    // ── DB fallback ─────────────────────────────────────────────────────────
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { capabilities: true },
    });

    const caps = (company?.capabilities as CompanyCapabilities | null) ?? {};

    // Try to populate cache — non-fatal if Redis is down
    try {
      await this.redis.set(key, JSON.stringify(caps), 'EX', CACHE_TTL_SECONDS);
    } catch {
      // Non-fatal: next request will attempt DB again
    }

    return caps;
  }

  /**
   * Overwrites the Company.capabilities blob and immediately invalidates
   * the cache so the next hasCapability call reads fresh data.
   */
  async setCapabilities(companyId: string, capabilities: CompanyCapabilities): Promise<void> {
    await this.prisma.company.update({
      where: { id: companyId },
      data: { capabilities },
    });
    await this.invalidateCache(companyId);
  }

  /** Removes the cached capabilities entry for a Company. */
  async invalidateCache(companyId: string): Promise<void> {
    try {
      await this.redis.del(cacheKey(companyId));
    } catch (err) {
      this.logger.warn(`[CapabilityService] Redis del error for ${companyId}: ${(err as Error).message}`);
    }
  }
}
