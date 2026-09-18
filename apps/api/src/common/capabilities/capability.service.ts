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
 *
 * Phase 2 additions:
 * - requireCapability() now checks the effective three-layer view, not the raw blob alone.
 * - getEffectiveValuesMap(): cached flat Record<key, effective-value> for fast per-request checks.
 * - invalidateCache() now removes both the raw-blob cache AND the effective-values cache.
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
/** Cache key for the flat effective-values map (plan default + overrides + columns). */
const effectiveCacheKey = (companyId: string) => `company-caps-effective:${companyId}`;

@Injectable()
export class CapabilityService {
  private readonly logger = new Logger(CapabilityService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CAPABILITY_CACHE_REDIS) private readonly redis: Redis,
  ) {}

  // ── Effective-view API (Phase 2: the canonical check path) ──────────────────

  /**
   * Returns a flat map of all capability keys to their effective values.
   * Uses a dedicated Redis cache (TTL 300 s) that collapses all three layers
   * (plan default → capabilities blob → Company columns) into a single lookup.
   * Invalidated by invalidateCache() — which must be called whenever the plan,
   * capabilities blob, or any of the three *Enabled columns change.
   */
  async getEffectiveValuesMap(companyId: string): Promise<Record<string, CapabilityValue>> {
    const key = effectiveCacheKey(companyId);
    try {
      const cached = await this.redis.get(key);
      if (cached !== null) return JSON.parse(cached) as Record<string, CapabilityValue>;
    } catch (err) {
      this.logger.warn(`[CapabilityService] effective cache read error for ${companyId}: ${(err as Error).message}`);
    }

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

    if (!company) return {};

    const view = buildEffectiveView(
      company.subscriptionPlan,
      (company.capabilities as Record<string, unknown> | null) ?? {},
      company.websiteEnabled,
      company.customerAppEnabled,
      company.staffAppEnabled,
    );

    const flat = Object.fromEntries(view.keys.map((k) => [k.key, k.effective]));

    try {
      await this.redis.set(key, JSON.stringify(flat), 'EX', CACHE_TTL_SECONDS);
    } catch {
      // Non-fatal
    }

    return flat;
  }

  /**
   * Returns true iff the Company's effective capability for the given key is boolean true.
   * Uses the three-layer effective view (plan default → overrides → column).
   */
  async hasCapability(companyId: string, capability: string): Promise<boolean> {
    const map = await this.getEffectiveValuesMap(companyId);
    return map[capability] === true;
  }

  /**
   * Throws ForbiddenException with stable code CAPABILITY_NOT_ENABLED when
   * the Company's effective capability is not true. Feature flags that are false
   * by plan default (e.g. feature.brokers on STARTER) are correctly blocked even
   * with an empty capabilities blob.
   */
  async requireCapability(companyId: string, capability: string): Promise<void> {
    const has = await this.hasCapability(companyId, capability);
    if (!has) {
      throw new ForbiddenException({
        message: `This feature is not available on your current plan: ${capability}. Upgrade your plan or contact support to enable it.`,
        code: 'CAPABILITY_NOT_ENABLED',
        capability,
      });
    }
  }

  // ── Legacy blob API (kept for super-admin direct blob reads) ─────────────────

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

  /**
   * Removes the cached capabilities entries for a Company.
   * Must be called whenever any input to the three-layer merge changes:
   *   - Company.capabilities blob (setCapabilityOverrides, setCapabilities)
   *   - Company.subscriptionPlan
   *   - Company.websiteEnabled / customerAppEnabled / staffAppEnabled
   */
  async invalidateCache(companyId: string): Promise<void> {
    try {
      await this.redis.del(cacheKey(companyId), effectiveCacheKey(companyId));
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
   * Delegates to getEffectiveValuesMap which is Redis-cached.
   */
  async getEffectiveLimits(companyId: string): Promise<Record<string, CapabilityValue>> {
    return this.getEffectiveValuesMap(companyId);
  }
}
