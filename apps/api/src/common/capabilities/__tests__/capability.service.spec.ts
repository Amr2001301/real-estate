/**
 * MT-038 — CapabilityService unit tests
 *
 * Verifies:
 *  1. Cache hit: returns cached value without DB query
 *  2. Cache miss: queries DB, caches result
 *  3. Redis read error: falls back to DB (never fail open)
 *  4. Redis write error: non-fatal, DB result still returned
 *  5. Unknown capability: returns false (not granted)
 *  6. requireCapability with missing cap: throws ForbiddenException with stable code
 *  7. requireCapability with present cap: resolves without throw
 *  8. setCapabilities: updates DB + invalidates cache
 *  9. Cache keys include companyId — A's cache never serves B
 * 10. Company with null capabilities: returns empty object (not an error)
 */

import { ForbiddenException } from '@nestjs/common';
import { CapabilityService } from '../capability.service';

function makeRedis(overrides: Record<string, jest.Mock> = {}) {
  return {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    ...overrides,
  };
}

function makePrisma(caps: Record<string, unknown> | null = {}) {
  const row = caps === null
    ? { subscriptionPlan: 'TRIAL', capabilities: null, websiteEnabled: null, customerAppEnabled: null, staffAppEnabled: null }
    : { subscriptionPlan: 'TRIAL', capabilities: caps, websiteEnabled: null, customerAppEnabled: null, staffAppEnabled: null };
  return {
    company: {
      findUnique: jest.fn().mockResolvedValue(row),
      update: jest.fn().mockResolvedValue({}),
    },
  };
}

function makeService(prismaOverride?: ReturnType<typeof makePrisma>, redisOverride?: ReturnType<typeof makeRedis>) {
  const prisma = prismaOverride ?? makePrisma({ crm: true, sales: false });
  const redis = redisOverride ?? makeRedis();
  const service = new CapabilityService(prisma as never, redis as never);
  return { service, prisma, redis };
}

// ── 1. Cache hit ──────────────────────────────────────────────────────────────

describe('CapabilityService — cache hit', () => {
  test('returns cached value without querying Prisma', async () => {
    const cached = JSON.stringify({ crm: true });
    const { service, prisma } = makeService(undefined, makeRedis({ get: jest.fn().mockResolvedValue(cached) }));
    const caps = await service.getCapabilities('comp-1');
    expect(caps.crm).toBe(true);
    expect(prisma.company.findUnique).not.toHaveBeenCalled();
  });
});

// ── 2. Cache miss → DB ────────────────────────────────────────────────────────

describe('CapabilityService — cache miss', () => {
  test('queries DB on cache miss and returns result', async () => {
    const { service, prisma } = makeService(makePrisma({ sales: true }));
    const caps = await service.getCapabilities('comp-1');
    expect(caps.sales).toBe(true);
    expect(prisma.company.findUnique).toHaveBeenCalledWith({
      where: { id: 'comp-1' },
      select: { capabilities: true },
    });
  });

  test('writes fetched caps to Redis cache after DB read', async () => {
    const redis = makeRedis();
    const { service } = makeService(makePrisma({ crm: true }), redis);
    await service.getCapabilities('comp-1');
    expect(redis.set).toHaveBeenCalledWith(
      'company-capabilities:comp-1',
      JSON.stringify({ crm: true }),
      'EX',
      300,
    );
  });
});

// ── 3. Redis unavailable → DB fallback ───────────────────────────────────────

describe('CapabilityService — Redis unavailable', () => {
  test('falls back to DB when Redis.get throws; does NOT fail open', async () => {
    const redis = makeRedis({
      get: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      set: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    });
    const { service, prisma } = makeService(makePrisma({ crm: true }), redis);
    const caps = await service.getCapabilities('comp-1');
    expect(caps.crm).toBe(true);
    expect(prisma.company.findUnique).toHaveBeenCalled();
  });

  test('Redis write error is non-fatal — DB result still returned', async () => {
    const redis = makeRedis({ set: jest.fn().mockRejectedValue(new Error('write failed')) });
    const { service } = makeService(makePrisma({ maintenance: true }), redis);
    const caps = await service.getCapabilities('comp-1');
    expect(caps.maintenance).toBe(true);
  });
});

// ── 4. Unknown / missing capability returns false ─────────────────────────────

describe('CapabilityService — unknown capability', () => {
  test('returns false for a key not present in the plan schema', async () => {
    const { service } = makeService(makePrisma({ 'feature.crm': true }));
    const has = await service.hasCapability('comp-1', 'feature.unknownFeature');
    expect(has).toBe(false);
  });

  test('returns false for a schema key explicitly set to false via blob override', async () => {
    const { service } = makeService(makePrisma({ 'feature.brokers': false }));
    const has = await service.hasCapability('comp-1', 'feature.brokers');
    expect(has).toBe(false);
  });

  test('Company with null capabilities returns empty object (not error)', async () => {
    const { service } = makeService(makePrisma(null));
    const caps = await service.getCapabilities('comp-1');
    expect(caps).toEqual({});
  });
});

// ── 5. requireCapability ──────────────────────────────────────────────────────

describe('CapabilityService.requireCapability', () => {
  test('throws ForbiddenException with code CAPABILITY_NOT_ENABLED when cap disabled on plan', async () => {
    // STARTER plan has feature.brokers=false; TRIAL has it true but blob overrides to false
    const { service } = makeService(makePrisma({ 'feature.brokers': false }));
    await expect(service.requireCapability('comp-1', 'feature.brokers')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'CAPABILITY_NOT_ENABLED', capability: 'feature.brokers' }),
    });
  });

  test('throws ForbiddenException, not a generic Error', async () => {
    const { service } = makeService(makePrisma({ 'feature.brokers': false }));
    await expect(service.requireCapability('comp-1', 'feature.brokers')).rejects.toBeInstanceOf(ForbiddenException);
  });

  test('resolves without throw when capability is enabled by plan default (TRIAL)', async () => {
    // TRIAL plan: feature.crm = true by default; no blob override
    const { service } = makeService(makePrisma({}));
    await expect(service.requireCapability('comp-1', 'feature.crm')).resolves.toBeUndefined();
  });
});

// ── 6. setCapabilities invalidates cache ─────────────────────────────────────

describe('CapabilityService.setCapabilities', () => {
  test('updates DB with new capabilities', async () => {
    const { service, prisma } = makeService();
    await service.setCapabilities('comp-1', { crm: true, broker: false });
    expect(prisma.company.update).toHaveBeenCalledWith({
      where: { id: 'comp-1' },
      data: { capabilities: { crm: true, broker: false } },
    });
  });

  test('invalidates Redis cache after DB update', async () => {
    const redis = makeRedis();
    const { service } = makeService(undefined, redis);
    await service.setCapabilities('comp-1', { crm: true });
    expect(redis.del).toHaveBeenCalledWith(
      'company-capabilities:comp-1',
      'company-caps-effective:comp-1',
    );
  });
});

// ── 7. Cache key isolation — A never serves B ─────────────────────────────────

describe('CapabilityService — per-tenant cache isolation', () => {
  test('uses companyId in cache key so Company A cache does not serve B', async () => {
    const redis = makeRedis({ get: jest.fn().mockResolvedValue(null) });
    const { service } = makeService(undefined, redis);

    await service.getCapabilities('company-aaa');
    await service.getCapabilities('company-bbb');

    const getCalls = (redis.get as jest.Mock).mock.calls.map((c: string[]) => c[0]);
    expect(getCalls).toContain('company-capabilities:company-aaa');
    expect(getCalls).toContain('company-capabilities:company-bbb');
    // Entries are under distinct keys, never shared
    expect(getCalls[0]).not.toBe(getCalls[1]);
  });
});
