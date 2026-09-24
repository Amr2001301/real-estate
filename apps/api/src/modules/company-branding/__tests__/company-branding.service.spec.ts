/**
 * MT-055 — CompanyBrandingService unit tests.
 *
 * Coverage:
 *   §B1  getBySlug — ACTIVE company returns branding
 *   §B2  getBySlug — unknown slug returns null
 *   §B3  getBySlug — SUSPENDED company returns null
 *   §B4  getBySlug — cache hit skips DB
 *   §B5  getBySlug — null branding fields are omitted from response
 *   §B6  getByHostname — verified ACTIVE company returns branding
 *   §B7  getByHostname — unknown hostname returns null
 *   §B8  getByHostname — unverified domain returns null
 *   §B9  getByHostname — SUSPENDED company returns null
 *   §B10 getByHostname — cache hit skips DB
 *   §B11 invalidate — deletes slug + hostname cache keys
 *   §B12 invalidate — no-ops safely when company has no domains
 */

import { CompanyBrandingService, BRANDING_CACHE_REDIS } from '../company-branding.service';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeCompanyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'company-id-1',
    slug: 'acme',
    name: 'Acme Real Estate',
    displayName: 'Acme',
    logoUrl: 'https://cdn.example.com/logo.png',
    faviconUrl: null,
    ogImageUrl: null,
    primaryColor: '#1E3A5F',
    accentColor: null,
    tagline: { ar: 'شعار الشركة', en: 'Company tagline' },
    contactEmail: 'info@acme.sa',
    contactPhone: null,
    contactWhatsApp: null,
    contactAddress: null,
    officeHours: null,
    socialLinks: null,
    registrationNumber: null,
    lifecycleStatus: 'ACTIVE',
    isActive: true,
    ...overrides,
  };
}

function makeDomainRow(overrides: Record<string, unknown> = {}) {
  return {
    verifiedAt: new Date('2026-01-01'),
    company: makeCompanyRow(),
    ...overrides,
  };
}

function makePrisma(opts: {
  companyRow?: unknown;
  domainRow?: unknown;
  slugForInvalidate?: string;
  domainsForInvalidate?: { hostname: string }[];
} = {}) {
  return {
    company: {
      findFirst: jest.fn().mockResolvedValue(opts.companyRow ?? null),
      findUnique: jest.fn().mockResolvedValue(
        opts.slugForInvalidate != null ? { slug: opts.slugForInvalidate } : null,
      ),
    },
    companyDomain: {
      findUnique: jest.fn().mockResolvedValue(opts.domainRow ?? null),
      findMany: jest.fn().mockResolvedValue(opts.domainsForInvalidate ?? []),
    },
  };
}

function makeRedis(cachedValue: string | null = null) {
  return {
    get: jest.fn().mockResolvedValue(cachedValue),
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
  };
}

function makeService(
  prisma: ReturnType<typeof makePrisma>,
  redis: ReturnType<typeof makeRedis>,
) {
  return new CompanyBrandingService(prisma as never, redis as never);
}

// ── getBySlug ─────────────────────────────────────────────────────────────────

describe('CompanyBrandingService.getBySlug', () => {
  test('§B1 — ACTIVE company returns branding with non-null fields only', async () => {
    const row = makeCompanyRow();
    const service = makeService(makePrisma({ companyRow: row }), makeRedis());

    const result = await service.getBySlug('acme');

    expect(result).not.toBeNull();
    expect(result!.slug).toBe('acme');
    expect(result!.name).toBe('Acme Real Estate');
    expect(result!.displayName).toBe('Acme');
    expect(result!.logoUrl).toBe('https://cdn.example.com/logo.png');
    expect(result!.primaryColor).toBe('#1E3A5F');
    expect(result!.tagline).toEqual({ ar: 'شعار الشركة', en: 'Company tagline' });
    expect(result!.contactEmail).toBe('info@acme.sa');
  });

  test('§B2 — unknown slug returns null', async () => {
    const service = makeService(makePrisma({ companyRow: null }), makeRedis());
    expect(await service.getBySlug('unknown')).toBeNull();
  });

  test('§B3 — SUSPENDED company returns null (lifecycleStatus filter in query)', async () => {
    const prisma = makePrisma({ companyRow: null });
    const service = makeService(prisma, makeRedis());

    await service.getBySlug('suspended-co');

    const call = (prisma.company.findFirst.mock.calls[0] as unknown[])[0] as {
      where: Record<string, unknown>;
    };
    expect(call.where.lifecycleStatus).toBe('ACTIVE');
    expect(call.where.isActive).toBe(true);
  });

  test('§B4 — cache hit skips DB lookup', async () => {
    const cached = JSON.stringify({ slug: 'acme', name: 'Acme Real Estate', primaryColor: '#000' });
    const prisma = makePrisma({ companyRow: makeCompanyRow() });
    const service = makeService(prisma, makeRedis(cached));

    const result = await service.getBySlug('acme');

    expect(result!.primaryColor).toBe('#000');
    expect(prisma.company.findFirst).not.toHaveBeenCalled();
  });

  test('§B5 — null fields are omitted from response', async () => {
    const row = makeCompanyRow({ faviconUrl: null, accentColor: null, contactPhone: null });
    const service = makeService(makePrisma({ companyRow: row }), makeRedis());

    const result = await service.getBySlug('acme');

    expect(result).not.toHaveProperty('faviconUrl');
    expect(result).not.toHaveProperty('accentColor');
    expect(result).not.toHaveProperty('contactPhone');
  });

  test('normalizes slug to lowercase before query and cache key', async () => {
    const prisma = makePrisma({ companyRow: null });
    const service = makeService(prisma, makeRedis());

    await service.getBySlug('ACME');

    const call = (prisma.company.findFirst.mock.calls[0] as unknown[])[0] as {
      where: { slug: string };
    };
    expect(call.where.slug).toBe('acme');
  });

  test('trims whitespace from slug', async () => {
    const prisma = makePrisma({ companyRow: null });
    const service = makeService(prisma, makeRedis());

    await service.getBySlug('  acme  ');

    const call = (prisma.company.findFirst.mock.calls[0] as unknown[])[0] as {
      where: { slug: string };
    };
    expect(call.where.slug).toBe('acme');
  });

  test('writes result to Redis after DB hit', async () => {
    const redis = makeRedis();
    const service = makeService(makePrisma({ companyRow: makeCompanyRow() }), redis);

    await service.getBySlug('acme');

    expect(redis.setex).toHaveBeenCalledWith(
      'company-branding:slug:acme',
      300,
      expect.any(String),
    );
  });
});

// ── getByHostname ─────────────────────────────────────────────────────────────

describe('CompanyBrandingService.getByHostname', () => {
  test('§B6 — verified ACTIVE company returns branding', async () => {
    const service = makeService(
      makePrisma({ domainRow: makeDomainRow() }),
      makeRedis(),
    );

    const result = await service.getByHostname('acme.devora.com');

    expect(result).not.toBeNull();
    expect(result!.slug).toBe('acme');
  });

  test('§B7 — unknown hostname returns null', async () => {
    const service = makeService(makePrisma({ domainRow: null }), makeRedis());
    expect(await service.getByHostname('unknown.example.com')).toBeNull();
  });

  test('§B8 — unverified domain returns null', async () => {
    const service = makeService(
      makePrisma({ domainRow: makeDomainRow({ verifiedAt: null }) }),
      makeRedis(),
    );
    expect(await service.getByHostname('unverified.example.com')).toBeNull();
  });

  test('§B9 — SUSPENDED company returns null', async () => {
    const suspendedCompany = makeCompanyRow({ lifecycleStatus: 'SUSPENDED' });
    const service = makeService(
      makePrisma({ domainRow: makeDomainRow({ company: suspendedCompany }) }),
      makeRedis(),
    );
    expect(await service.getByHostname('suspended.example.com')).toBeNull();
  });

  test('§B10 — cache hit skips DB lookup', async () => {
    const cached = JSON.stringify({ slug: 'acme', name: 'Acme Real Estate' });
    const prisma = makePrisma({ domainRow: makeDomainRow() });
    const service = makeService(prisma, makeRedis(cached));

    await service.getByHostname('acme.devora.com');

    expect(prisma.companyDomain.findUnique).not.toHaveBeenCalled();
  });

  test('writes result to Redis after DB hit', async () => {
    const redis = makeRedis();
    const service = makeService(
      makePrisma({ domainRow: makeDomainRow() }),
      redis,
    );

    await service.getByHostname('acme.devora.com');

    expect(redis.setex).toHaveBeenCalledWith(
      expect.stringContaining('company-branding:hostname:'),
      300,
      expect.any(String),
    );
  });
});

// ── invalidate ────────────────────────────────────────────────────────────────

describe('CompanyBrandingService.invalidate', () => {
  test('§B11 — deletes slug cache key and all hostname cache keys', async () => {
    const redis = makeRedis();
    const service = makeService(
      makePrisma({
        slugForInvalidate: 'acme',
        domainsForInvalidate: [
          { hostname: 'acme.devora.com' },
          { hostname: 'acme.example.sa' },
        ],
      }),
      redis,
    );

    await service.invalidate('company-id-1');

    expect(redis.del).toHaveBeenCalledWith(
      'company-branding:slug:acme',
      'company-branding:hostname:acme.devora.com',
      'company-branding:hostname:acme.example.sa',
    );
  });

  test('§B12 — company with no domains: deletes only the slug key', async () => {
    const redis = makeRedis();
    const service = makeService(
      makePrisma({ slugForInvalidate: 'acme', domainsForInvalidate: [] }),
      redis,
    );

    await service.invalidate('company-id-1');

    expect(redis.del).toHaveBeenCalledWith('company-branding:slug:acme');
  });

  test('no-ops when company is not found', async () => {
    const redis = makeRedis();
    const service = makeService(
      makePrisma({ slugForInvalidate: undefined, domainsForInvalidate: [] }),
      redis,
    );

    await service.invalidate('nonexistent-id');

    expect(redis.del).not.toHaveBeenCalled();
  });
});
