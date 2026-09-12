/**
 * MT-047 — DomainResolverService unit tests
 *
 * Tests: normalize → Redis cache hit → cache miss → DB query → ACTIVE filter →
 * verified filter → Redis error fallback → invalidateHostname → invalidateAllForCompany
 */

import { DomainResolverService, DOMAIN_CACHE_REDIS } from '../domain-resolver.service';
import { InvalidHostnameError } from '../../utils/hostname-normalize';

function makeRedis(overrides: Record<string, jest.Mock> = {}) {
  return {
    get: jest.fn().mockResolvedValue(null),
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    ...overrides,
  };
}

function makePrisma(domainRow: Record<string, unknown> | null = null) {
  return {
    companyDomain: {
      findUnique: jest.fn().mockResolvedValue(domainRow),
      findMany: jest.fn().mockResolvedValue(domainRow ? [{ hostname: (domainRow as { hostname: string }).hostname }] : []),
    },
  };
}

function makeService(
  domainRow: Record<string, unknown> | null = null,
  redisOverrides: Record<string, jest.Mock> = {},
) {
  const redis = makeRedis(redisOverrides);
  const prisma = makePrisma(domainRow);
  const service = new DomainResolverService(prisma as never, redis as never);
  return { service, redis, prisma };
}

const ACTIVE_ROW = {
  hostname: 'acme.platform.example.com',
  type: 'PLATFORM_SUBDOMAIN',
  verifiedAt: new Date('2026-01-01'),
  company: {
    id: 'co-1',
    slug: 'acme',
    lifecycleStatus: 'ACTIVE',
    websiteEnabled: true,
  },
};

// ── Basic resolve ──────────────────────────────────────────────────────────────

describe('DomainResolverService.resolve — cache miss, DB hit', () => {
  test('returns resolved domain for ACTIVE company with verified domain', async () => {
    const { service } = makeService(ACTIVE_ROW);
    const result = await service.resolve('acme.platform.example.com');
    expect(result).toMatchObject({
      companyId: 'co-1',
      slug: 'acme',
      hostname: 'acme.platform.example.com',
      websiteEnabled: true,
    });
  });

  test('applies hostname normalization before DB lookup', async () => {
    const { service, prisma } = makeService(ACTIVE_ROW);
    await service.resolve('ACME.platform.example.com');
    expect(prisma.companyDomain.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { hostname: 'acme.platform.example.com' } }),
    );
  });

  test('returns null for unknown hostname', async () => {
    const { service } = makeService(null);
    const result = await service.resolve('unknown.example.com');
    expect(result).toBeNull();
  });

  test('returns null for unverified custom domain (verifiedAt=null)', async () => {
    const { service } = makeService({
      ...ACTIVE_ROW,
      type: 'CUSTOM',
      verifiedAt: null,
    });
    const result = await service.resolve('acme.platform.example.com');
    expect(result).toBeNull();
  });

  test('returns null for SUSPENDED company', async () => {
    const { service } = makeService({
      ...ACTIVE_ROW,
      company: { ...ACTIVE_ROW.company, lifecycleStatus: 'SUSPENDED' },
    });
    const result = await service.resolve('acme.platform.example.com');
    expect(result).toBeNull();
  });

  test('returns null for ARCHIVED company', async () => {
    const { service } = makeService({
      ...ACTIVE_ROW,
      company: { ...ACTIVE_ROW.company, lifecycleStatus: 'ARCHIVED' },
    });
    const result = await service.resolve('acme.platform.example.com');
    expect(result).toBeNull();
  });
});

// ── Redis cache ────────────────────────────────────────────────────────────────

describe('DomainResolverService.resolve — Redis cache', () => {
  test('returns cached result without hitting DB', async () => {
    const cached = JSON.stringify({
      companyId: 'co-1', slug: 'acme',
      hostname: 'acme.platform.example.com',
      domainType: 'PLATFORM_SUBDOMAIN',
      lifecycleStatus: 'ACTIVE', websiteEnabled: true,
    });
    const { service, prisma } = makeService(null, {
      get: jest.fn().mockResolvedValue(cached),
    });

    const result = await service.resolve('acme.platform.example.com');
    expect(result?.slug).toBe('acme');
    expect(prisma.companyDomain.findUnique).not.toHaveBeenCalled();
  });

  test('writes DB result to Redis cache on cache miss', async () => {
    const { service, redis } = makeService(ACTIVE_ROW);
    await service.resolve('acme.platform.example.com');
    expect(redis.setex).toHaveBeenCalledWith(
      'company-domain:acme.platform.example.com',
      60,
      expect.any(String),
    );
  });

  test('falls back to DB on Redis get error', async () => {
    const { service, prisma } = makeService(ACTIVE_ROW, {
      get: jest.fn().mockRejectedValue(new Error('Redis down')),
    });
    const result = await service.resolve('acme.platform.example.com');
    expect(result).not.toBeNull();
    expect(prisma.companyDomain.findUnique).toHaveBeenCalled();
  });

  test('continues (null result) if Redis write fails', async () => {
    const { service } = makeService(ACTIVE_ROW, {
      setex: jest.fn().mockRejectedValue(new Error('Redis write fail')),
    });
    const result = await service.resolve('acme.platform.example.com');
    expect(result).not.toBeNull();
  });
});

// ── invalidateHostname ─────────────────────────────────────────────────────────

describe('DomainResolverService.invalidateHostname', () => {
  test('deletes the correct cache key', async () => {
    const { service, redis } = makeService();
    await service.invalidateHostname('ACME.PLATFORM.EXAMPLE.COM');
    expect(redis.del).toHaveBeenCalledWith('company-domain:acme.platform.example.com');
  });

  test('does not throw on Redis error', async () => {
    const { service } = makeService(null, {
      del: jest.fn().mockRejectedValue(new Error('Redis error')),
    });
    await expect(service.invalidateHostname('acme.example.com')).resolves.toBeUndefined();
  });
});

// ── invalidateAllForCompany ────────────────────────────────────────────────────

describe('DomainResolverService.invalidateAllForCompany', () => {
  test('deletes all domain cache keys for a company', async () => {
    const redis = makeRedis();
    const prisma = {
      companyDomain: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([
          { hostname: 'acme.platform.example.com' },
          { hostname: 'acme.com' },
        ]),
      },
    };
    const service = new DomainResolverService(prisma as never, redis as never);

    await service.invalidateAllForCompany('co-1');
    expect(redis.del).toHaveBeenCalledWith(
      'company-domain:acme.platform.example.com',
      'company-domain:acme.com',
    );
  });

  test('no-op when company has no domains', async () => {
    const { service, redis } = makeService(null);
    await service.invalidateAllForCompany('co-none');
    expect(redis.del).not.toHaveBeenCalled();
  });
});

// ── Hostname validation ────────────────────────────────────────────────────────

describe('DomainResolverService.resolve — hostname validation', () => {
  test('throws InvalidHostnameError for invalid hostname', async () => {
    const { service } = makeService();
    await expect(service.resolve('https://bad')).rejects.toBeInstanceOf(InvalidHostnameError);
  });
});
