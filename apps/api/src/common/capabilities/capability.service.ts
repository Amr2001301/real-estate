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
 *
 * Phase 1 additions:
 * - getEffectiveCapabilities(): three-layer merge (plan defaults → overrides → column values)
 * - setCapabilityOverrides(): typed write with validation, cache invalidation
 */

import { BadRequestException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildEffectiveView,
  validateCapabilityOverrides,
  type CapabilityValue,
  type EffectiveCapabilitiesView,
} from './capability-schema';

export const CAPABILITY_CACHE_REDIS = Symbol('CAPABILITY_CACHE_REDIS');

/** Raw capabilities blob shape stored in Company.capabilities JSONB. */
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

  // ── Legacy blob API (backward compat) ────────────────────────────────────────

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
   * Returns the raw capabilities blob for a Company.
   * Tries Redis cache first; falls back to DB on cache miss or Redis error.
   */
  async getCapabilities(companyId: string): Promise<CompanyCapabilities> {
    const key = cacheKey(companyId);

    try {
      const cached = await this.redis.get(key);
      if (cached !== null) {
        return JSON.parse(cached) as CompanyCapabilities;
      }
    } catch (err) {
      this.logger.warn(`[CapabilityService] Redis read error for ${companyId}: ${(err as Error).message}`);
    }

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { capabilities: true },
    });

    const caps = (company?.capabilities as CompanyCapabilities | null) ?? {};

    try {
      await this.redis.set(key, JSON.stringify(caps), 'EX', CACHE_TTL_SECONDS);
    } catch {
      // Non-fatal
    }

    return caps;
  }

  /**
   * Overwrites the Company.capabilities blob and immediately invalidates the cache.
   * Accepts any Record<string, boolean>; for validated typed writes use setCapabilityOverrides.
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

  // ── Phase 1: effective capability resolution ──────────────────────────────────

  /**
   * Returns the three-layer side-by-side view for a company:
   *   plan default  ←  override in Company.capabilities  ←  Company column (for three flags)
   *
   * Loads the company row (plan + capabilities blob + the three *Enabled columns) and
   * builds a CapabilityKeyView for every known key.
   *
   * Throws NotFoundException if companyId does not exist.
   */
  async getEffectiveCapabilities(companyId: string): Promise<EffectiveCapabilitiesView> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        subscriptionPlan: true,
        capabilities: true,
        websiteEnabled: true,
        customerAppEnabled: true,
        staffAppEnabled: true,
      },
    });
    if (!company) throw new NotFoundException('Company not found');

    return buildEffectiveView(
      company.subscriptionPlan,
      (company.capabilities as Record<string, unknown> | null) ?? {},
      company.websiteEnabled,
      company.customerAppEnabled,
      company.staffAppEnabled,
    );
  }

  /**
   * Validates and writes typed capability overrides for a company.
   * Invalidates the cache after the write.
   * Throws BadRequestException with errors if any value is invalid.
   * Throws NotFoundException if companyId does not exist.
   */
  async setCapabilityOverrides(
    companyId: string,
    overrides: Record<string, unknown>,
  ): Promise<EffectiveCapabilitiesView> {
    const errors = validateCapabilityOverrides(overrides);
    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'Invalid capability overrides',
        code: 'CAPABILITY_OVERRIDE_INVALID',
        errors,
      });
    }

    const existing = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, capabilities: true },
    });
    if (!existing) throw new NotFoundException('Company not found');

    // Merge: existing overrides are preserved unless the new write explicitly updates them.
    const merged = {
      ...(existing.capabilities as Record<string, unknown> ?? {}),
      ...overrides,
    };

    await this.prisma.company.update({
      where: { id: companyId },
      data: { capabilities: merged as Prisma.InputJsonValue },
    });

    await this.invalidateCache(companyId);
    return this.getEffectiveCapabilities(companyId);
  }

  /**
   * Returns the flat effective values map (key → effective value).
   * Convenience method for usage count comparisons.
   */
  async getEffectiveLimits(companyId: string): Promise<Record<string, CapabilityValue>> {
    const view = await this.getEffectiveCapabilities(companyId);
    return Object.fromEntries(view.keys.map((k) => [k.key, k.effective]));
  }
}
