/**
 * MT-056 / MT-057 — PublicCompaniesService unit tests.
 *
 * Eligibility rules under test:
 *   ACTIVE + customerAppEnabled=true + isActive=true → appears
 *   ACTIVE + customerAppEnabled=false               → absent
 *   SUSPENDED + customerAppEnabled=true             → absent
 *   ARCHIVED + customerAppEnabled=true              → absent
 *   websiteEnabled=false + customerAppEnabled=true  → still appears
 *   Response contains no companyId.
 *   Search result count bounded to 10.
 *   Exact resolve returns null for unknown/ineligible slugs.
 */

import { PublicCompaniesService } from '../public-companies.service';

function makeCompany(overrides: Record<string, unknown> = {}) {
  return {
    id: 'company-id-should-never-appear',
    slug: 'acme',
    name: 'Acme Developer',
    lifecycleStatus: 'ACTIVE',
    customerAppEnabled: true,
    isActive: true,
    websiteEnabled: true,
    ...overrides,
  };
}

function makePrisma(rows: unknown[] = [], singleRow: unknown = null) {
  return {
    company: {
      findMany: jest.fn().mockResolvedValue(rows),
      findFirst: jest.fn().mockResolvedValue(singleRow),
    },
  };
}

function makeService(prisma: ReturnType<typeof makePrisma>) {
  return new PublicCompaniesService(prisma as never);
}

// ── search ────────────────────────────────────────────────────────────────────

describe('PublicCompaniesService.search', () => {
  test('§28a — ACTIVE + customerAppEnabled=true company appears in search results', async () => {
    const company = makeCompany();
    const prisma = makePrisma([{ slug: company.slug, name: company.name }]);
    const service = makeService(prisma);

    const results = await service.search('acm');

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ slug: 'acme', name: 'Acme Developer' });
  });

  test('§28 — response contains no companyId', async () => {
    const prisma = makePrisma([{ slug: 'acme', name: 'Acme Developer' }]);
    const service = makeService(prisma);

    const results = await service.search('acm');

    expect(results[0]).not.toHaveProperty('id');
    expect(results[0]).not.toHaveProperty('companyId');
    expect(Object.keys(results[0]!)).toEqual(['slug', 'name']);
  });

  test('§28b — ACTIVE + customerAppEnabled=false → query excludes that company', async () => {
    const prisma = makePrisma([]);
    const service = makeService(prisma);

    const results = await service.search('disabled');

    expect(results).toHaveLength(0);
    const where = (prisma.company.findMany.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect((where as { where: Record<string, unknown> }).where).toMatchObject({
      customerAppEnabled: true,
      lifecycleStatus: 'ACTIVE',
      isActive: true,
    });
  });

  test('§28c — SUSPENDED + customerAppEnabled=true → excluded (lifecycleStatus filter)', async () => {
    const prisma = makePrisma([]);
    const service = makeService(prisma);

    await service.search('sus');

    const call = (prisma.company.findMany.mock.calls[0] as unknown[])[0] as { where: Record<string, unknown> };
    expect(call.where.lifecycleStatus).toBe('ACTIVE');
  });

  test('§28d — ARCHIVED + customerAppEnabled=true → excluded', async () => {
    const prisma = makePrisma([]);
    const service = makeService(prisma);

    await service.search('arc');

    const call = (prisma.company.findMany.mock.calls[0] as unknown[])[0] as { where: Record<string, unknown> };
    expect(call.where.lifecycleStatus).toBe('ACTIVE');
  });

  test('§25 — websiteEnabled=false + customerAppEnabled=true → still appears', async () => {
    const prisma = makePrisma([{ slug: 'no-web', name: 'No Website Corp' }]);
    const service = makeService(prisma);

    const results = await service.search('no-web');

    expect(results).toHaveLength(1);
    // websiteEnabled is NOT in the where clause
    const call = (prisma.company.findMany.mock.calls[0] as unknown[])[0] as { where: Record<string, unknown> };
    expect(call.where).not.toHaveProperty('websiteEnabled');
  });

  test('§28 — both Company A and Company B independently discoverable', async () => {
    const prisma = makePrisma([
      { slug: 'alpha', name: 'Alpha Corp' },
      { slug: 'beta', name: 'Beta Corp' },
    ]);
    const service = makeService(prisma);

    const results = await service.search('corp');

    expect(results).toHaveLength(2);
    expect(results.map((r) => r.slug)).toEqual(['alpha', 'beta']);
  });

  test('§28 — search result count bounded (take=10 passed to prisma)', async () => {
    const prisma = makePrisma([]);
    const service = makeService(prisma);

    await service.search('any');

    const call = (prisma.company.findMany.mock.calls[0] as unknown[])[0] as { take: number };
    expect(call.take).toBe(10);
  });

  test('trims whitespace from query before search', async () => {
    const prisma = makePrisma([]);
    const service = makeService(prisma);

    await service.search('  acme  ');

    const call = (prisma.company.findMany.mock.calls[0] as unknown[])[0] as {
      where: { OR: Array<Record<string, unknown>> };
    };
    const orClause = call.where.OR[0]!;
    const containsVal = (orClause.name as { contains: string }).contains;
    expect(containsVal).toBe('acme');
  });
});

// ── resolveBySlug ─────────────────────────────────────────────────────────────

describe('PublicCompaniesService.resolveBySlug', () => {
  test('§29a — valid eligible slug returns { slug, name }', async () => {
    const prisma = makePrisma([], { slug: 'acme', name: 'Acme Developer' });
    const service = makeService(prisma);

    const result = await service.resolveBySlug('acme');

    expect(result).toEqual({ slug: 'acme', name: 'Acme Developer' });
  });

  test('§29 — response contains no companyId', async () => {
    const prisma = makePrisma([], { slug: 'acme', name: 'Acme Developer' });
    const service = makeService(prisma);

    const result = await service.resolveBySlug('acme');

    expect(result).not.toBeNull();
    expect(result).not.toHaveProperty('id');
    expect(result).not.toHaveProperty('companyId');
    expect(Object.keys(result!)).toEqual(['slug', 'name']);
  });

  test('§29b — unknown slug returns null', async () => {
    const prisma = makePrisma([], null);
    const service = makeService(prisma);

    const result = await service.resolveBySlug('unknown-co');

    expect(result).toBeNull();
  });

  test('§29c — disabled customer app slug returns null (eligibility filter applied)', async () => {
    const prisma = makePrisma([], null);
    const service = makeService(prisma);

    await service.resolveBySlug('no-customer');

    const call = (prisma.company.findFirst.mock.calls[0] as unknown[])[0] as { where: Record<string, unknown> };
    expect(call.where.customerAppEnabled).toBe(true);
    const result = await service.resolveBySlug('no-customer');
    expect(result).toBeNull();
  });

  test('§29d — inactive company slug returns null', async () => {
    const prisma = makePrisma([], null);
    const service = makeService(prisma);

    const result = await service.resolveBySlug('inactive-co');

    expect(result).toBeNull();
    const call = (prisma.company.findFirst.mock.calls[0] as unknown[])[0] as { where: Record<string, unknown> };
    expect(call.where.lifecycleStatus).toBe('ACTIVE');
  });

  test('normalizes slug to lowercase before query', async () => {
    const prisma = makePrisma([], null);
    const service = makeService(prisma);

    await service.resolveBySlug('ACME');

    const call = (prisma.company.findFirst.mock.calls[0] as unknown[])[0] as { where: { slug: string } };
    expect(call.where.slug).toBe('acme');
  });

  test('trims whitespace from slug before query', async () => {
    const prisma = makePrisma([], null);
    const service = makeService(prisma);

    await service.resolveBySlug('  acme  ');

    const call = (prisma.company.findFirst.mock.calls[0] as unknown[])[0] as { where: { slug: string } };
    expect(call.where.slug).toBe('acme');
  });
});
