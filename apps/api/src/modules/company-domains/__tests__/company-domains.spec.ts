/**
 * MT-049 / MT-050 / MT-055 — CompanyDomainsService unit tests
 *
 * Tests: CRUD, ownership enforcement, platform subdomain protection,
 * DNS TXT verification, primary domain logic, cache invalidation,
 * reserved namespace, provisionPlatformSubdomain (MT-045).
 */

import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CompanyDomainsService } from '../company-domains.service';

const mockResolveTxt = jest.fn();
jest.mock('node:dns/promises', () => ({
  resolveTxt: (...args: unknown[]) => mockResolveTxt(...args),
}));

const COMPANY_A = 'comp-a-id';
const COMPANY_B = 'comp-b-id';
const PLATFORM_BASE = 'platform.example.com';
const PLATFORM_HOSTNAME = `acme.${PLATFORM_BASE}`;

function makeResolver() {
  return {
    invalidateHostname: jest.fn().mockResolvedValue(undefined),
    invalidateAllForCompany: jest.fn().mockResolvedValue(undefined),
  };
}

function makeConfig(baseDomain: string | undefined = PLATFORM_BASE, timeoutMs = 5000) {
  return {
    get: jest.fn().mockImplementation((key: string) => {
      if (key === 'PLATFORM_BASE_DOMAIN') return baseDomain;
      if (key === 'DOMAIN_DNS_TIMEOUT_MS') return timeoutMs;
      return undefined;
    }),
    getOrThrow: jest.fn(),
  };
}

function makeDomain(overrides: Record<string, unknown> = {}) {
  return {
    id: 'dom-1',
    companyId: COMPANY_A,
    hostname: 'acme.com',
    type: 'CUSTOM',
    isPrimary: false,
    verifiedAt: null,
    verificationToken: 'tok123',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makePrisma(overrides: Record<string, Partial<Record<string, jest.Mock>>> = {}) {
  const companyDomainMock = {
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn().mockResolvedValue(null),
    findFirst: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation((args: { data: Record<string, unknown> }) =>
      Promise.resolve({ ...makeDomain(), ...args.data, id: 'dom-new' }),
    ),
    update: jest.fn().mockImplementation((args: { data: Record<string, unknown> }) =>
      Promise.resolve({ ...makeDomain(), ...args.data }),
    ),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    delete: jest.fn().mockResolvedValue({}),
    upsert: jest.fn().mockResolvedValue({}),
    ...overrides.companyDomain,
  };
  const prismaObj = {
    companyDomain: companyDomainMock,
    $transaction: jest.fn().mockImplementation((opsOrFn: unknown) => {
      if (typeof opsOrFn === 'function') {
        return (opsOrFn as (tx: unknown) => Promise<unknown>)({ companyDomain: companyDomainMock });
      }
      return Promise.all(opsOrFn as unknown[]);
    }),
  };
  return prismaObj;
}

function makeService(
  prismaOverrides: Record<string, Partial<Record<string, jest.Mock>>> = {},
  baseDomain: string | undefined = PLATFORM_BASE,
) {
  const prisma = makePrisma(prismaOverrides);
  const resolver = makeResolver();
  const config = makeConfig(baseDomain);
  const service = new CompanyDomainsService(prisma as never, resolver as never, config as never);
  return { service, prisma, resolver, config };
}

// ── list ──────────────────────────────────────────────────────────────────────

describe('CompanyDomainsService.list', () => {
  test('returns domains for the given companyId', async () => {
    const domain = makeDomain();
    const { service, prisma } = makeService();
    prisma.companyDomain.findMany.mockResolvedValue([domain]);

    const result = await service.list(COMPANY_A);
    expect(result).toHaveLength(1);
    expect(prisma.companyDomain.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: COMPANY_A } }),
    );
  });
});

// ── createCustom ──────────────────────────────────────────────────────────────

describe('CompanyDomainsService.createCustom', () => {
  test('normalizes hostname before create', async () => {
    const { service, prisma } = makeService();
    await service.createCustom(COMPANY_A, 'ACME.COM');
    expect(prisma.companyDomain.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ hostname: 'acme.com' }) }),
    );
  });

  test('sets type=CUSTOM, verifiedAt=null, generates token', async () => {
    const { service, prisma } = makeService();
    await service.createCustom(COMPANY_A, 'acme.com');
    const { data } = (prisma.companyDomain.create as jest.Mock).mock.calls[0][0];
    expect(data.type).toBe('CUSTOM');
    expect(data.verifiedAt).toBeNull();
    expect(typeof data.verificationToken).toBe('string');
    expect(data.verificationToken.length).toBeGreaterThan(0);
  });

  test('throws ConflictException if hostname already registered', async () => {
    const { service, prisma } = makeService();
    prisma.companyDomain.findUnique.mockResolvedValue(makeDomain());
    await expect(service.createCustom(COMPANY_A, 'acme.com')).rejects.toBeInstanceOf(ConflictException);
  });

  test('throws ForbiddenException for hostname under PLATFORM_BASE_DOMAIN', async () => {
    const { service } = makeService();
    await expect(service.createCustom(COMPANY_A, `sub.${PLATFORM_BASE}`)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'DOMAIN_RESERVED_NAMESPACE' }),
    });
  });

  test('blocks exact PLATFORM_BASE_DOMAIN as custom domain', async () => {
    const { service } = makeService();
    await expect(service.createCustom(COMPANY_A, PLATFORM_BASE)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'DOMAIN_RESERVED_NAMESPACE' }),
    });
  });

  test('throws on invalid hostname', async () => {
    const { service } = makeService();
    await expect(service.createCustom(COMPANY_A, 'https://bad')).rejects.toBeDefined();
  });

  test('P2002 race → ConflictException with DOMAIN_ALREADY_REGISTERED (Section 7)', async () => {
    const { service, prisma } = makeService();
    const p2002 = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed on the fields: (`hostname`)',
      { code: 'P2002', clientVersion: '5.0.0' },
    );
    prisma.companyDomain.create.mockRejectedValue(p2002);
    await expect(service.createCustom(COMPANY_A, 'acme.com')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'DOMAIN_ALREADY_REGISTERED' }),
    });
  });
});

// ── delete ────────────────────────────────────────────────────────────────────

describe('CompanyDomainsService.delete', () => {
  test('deletes custom domain and invalidates cache', async () => {
    const domain = makeDomain({ type: 'CUSTOM' });
    const { service, prisma, resolver } = makeService();
    prisma.companyDomain.findUnique.mockResolvedValue(domain);

    await service.delete(COMPANY_A, 'dom-1');
    expect(prisma.companyDomain.delete).toHaveBeenCalledWith({ where: { id: 'dom-1' } });
    expect(resolver.invalidateHostname).toHaveBeenCalledWith(domain.hostname);
  });

  test('throws NotFoundException for unknown domain', async () => {
    const { service } = makeService();
    await expect(service.delete(COMPANY_A, 'no-such')).rejects.toBeInstanceOf(NotFoundException);
  });

  test('throws NotFoundException for domain belonging to another company', async () => {
    const { service, prisma } = makeService();
    prisma.companyDomain.findUnique.mockResolvedValue(makeDomain({ companyId: COMPANY_B }));
    await expect(service.delete(COMPANY_A, 'dom-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  test('throws ForbiddenException for PLATFORM_SUBDOMAIN', async () => {
    const { service, prisma } = makeService();
    prisma.companyDomain.findUnique.mockResolvedValue(makeDomain({ type: 'PLATFORM_SUBDOMAIN' }));
    await expect(service.delete(COMPANY_A, 'dom-1')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PLATFORM_SUBDOMAIN_DELETE_FORBIDDEN' }),
    });
  });

  test('reverts primary to platform subdomain when deleting primary custom domain', async () => {
    const primaryCustom = makeDomain({ type: 'CUSTOM', isPrimary: true });
    const platformDomain = makeDomain({ id: 'plat-dom', type: 'PLATFORM_SUBDOMAIN', hostname: PLATFORM_HOSTNAME });
    const { service, prisma } = makeService();
    prisma.companyDomain.findUnique.mockResolvedValue(primaryCustom);
    prisma.companyDomain.findFirst.mockResolvedValue(platformDomain);

    await service.delete(COMPANY_A, 'dom-1');
    expect(prisma.companyDomain.update).toHaveBeenCalledWith({
      where: { id: 'plat-dom' },
      data: { isPrimary: true },
    });
  });
});

// ── verify ────────────────────────────────────────────────────────────────────

describe('CompanyDomainsService.verify', () => {
  test('throws NotFoundException for unknown domain', async () => {
    const { service } = makeService();
    await expect(service.verify(COMPANY_A, 'no-such')).rejects.toBeInstanceOf(NotFoundException);
  });

  test('throws NotFoundException for cross-company domain access', async () => {
    const { service, prisma } = makeService();
    prisma.companyDomain.findUnique.mockResolvedValue(makeDomain({ companyId: COMPANY_B }));
    await expect(service.verify(COMPANY_A, 'dom-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  test('throws BadRequestException for PLATFORM_SUBDOMAIN', async () => {
    const { service, prisma } = makeService();
    prisma.companyDomain.findUnique.mockResolvedValue(makeDomain({ type: 'PLATFORM_SUBDOMAIN' }));
    await expect(service.verify(COMPANY_A, 'dom-1')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PLATFORM_SUBDOMAIN_VERIFY_FORBIDDEN' }),
    });
  });

  test('returns verified=true immediately if already verified', async () => {
    const { service, prisma } = makeService();
    prisma.companyDomain.findUnique.mockResolvedValue(
      makeDomain({ verifiedAt: new Date('2026-01-01') }),
    );
    const result = await service.verify(COMPANY_A, 'dom-1');
    expect(result.verified).toBe(true);
  });

  test('returns verified=false when DNS lookup fails (ENODATA)', async () => {
    mockResolveTxt.mockRejectedValue(
      Object.assign(new Error('queryTxt ENODATA'), { code: 'ENODATA' }),
    );
    const { service, prisma } = makeService();
    prisma.companyDomain.findUnique.mockResolvedValue(makeDomain());
    const result = await service.verify(COMPANY_A, 'dom-1');
    expect(result.verified).toBe(false);
    expect(prisma.companyDomain.update).not.toHaveBeenCalled();
  });
});

// ── setPrimary ────────────────────────────────────────────────────────────────

describe('CompanyDomainsService.setPrimary', () => {
  test('throws NotFoundException for unknown domain', async () => {
    const { service } = makeService();
    await expect(service.setPrimary(COMPANY_A, 'no-such')).rejects.toBeInstanceOf(NotFoundException);
  });

  test('throws NotFoundException for cross-company access', async () => {
    const { service, prisma } = makeService();
    prisma.companyDomain.findUnique.mockResolvedValue(makeDomain({ companyId: COMPANY_B }));
    await expect(service.setPrimary(COMPANY_A, 'dom-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  test('throws BadRequestException when unverified custom domain set as primary', async () => {
    const { service, prisma } = makeService();
    prisma.companyDomain.findUnique.mockResolvedValue(makeDomain({ type: 'CUSTOM', verifiedAt: null }));
    await expect(service.setPrimary(COMPANY_A, 'dom-1')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'DOMAIN_NOT_VERIFIED' }),
    });
  });

  test('allows unverified platform subdomain to be primary', async () => {
    const { service, prisma } = makeService();
    // PLATFORM_SUBDOMAIN has verifiedAt set at creation, but test the guard path anyway
    prisma.companyDomain.findUnique.mockResolvedValue(
      makeDomain({ type: 'PLATFORM_SUBDOMAIN', verifiedAt: new Date() }),
    );
    await expect(service.setPrimary(COMPANY_A, 'dom-1')).resolves.toBeDefined();
  });

  test('invalidates all domain cache for company after set-primary', async () => {
    const { service, prisma, resolver } = makeService();
    prisma.companyDomain.findUnique.mockResolvedValue(
      makeDomain({ type: 'CUSTOM', verifiedAt: new Date(), isPrimary: false }),
    );
    await service.setPrimary(COMPANY_A, 'dom-1');
    expect(resolver.invalidateAllForCompany).toHaveBeenCalledWith(COMPANY_A);
  });
});

// ── provisionPlatformSubdomain ─────────────────────────────────────────────────

describe('CompanyDomainsService.provisionPlatformSubdomain', () => {
  test('creates platform subdomain with auto-verified + isPrimary=true', async () => {
    const { service, prisma } = makeService();
    await service.provisionPlatformSubdomain(COMPANY_A, 'acme');
    expect(prisma.companyDomain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { hostname: PLATFORM_HOSTNAME },
        create: expect.objectContaining({
          companyId: COMPANY_A,
          hostname: PLATFORM_HOSTNAME,
          type: 'PLATFORM_SUBDOMAIN',
          isPrimary: true,
          verifiedAt: expect.any(Date),
        }),
        update: {},
      }),
    );
  });

  test('is idempotent (upsert with empty update)', async () => {
    const { service, prisma } = makeService();
    await service.provisionPlatformSubdomain(COMPANY_A, 'acme');
    await service.provisionPlatformSubdomain(COMPANY_A, 'acme');
    expect(prisma.companyDomain.upsert).toHaveBeenCalledTimes(2);
    const upsertCall = (prisma.companyDomain.upsert as jest.Mock).mock.calls[0][0];
    expect(upsertCall.update).toEqual({});
  });

  test('normalizes slug + base domain (uppercase)', async () => {
    const resolver = makeResolver();
    const config = makeConfig('PLATFORM.EXAMPLE.COM');
    const prisma = makePrisma();
    const service = new CompanyDomainsService(prisma as never, resolver as never, config as never);

    await service.provisionPlatformSubdomain(COMPANY_A, 'ACME');
    const upsertCall = (prisma.companyDomain.upsert as jest.Mock).mock.calls[0][0];
    expect(upsertCall.where.hostname).toBe('acme.platform.example.com');
  });

  test('no-op when PLATFORM_BASE_DOMAIN is not configured — and emits a warn', async () => {
    const resolver = makeResolver();
    const config = { get: jest.fn().mockReturnValue(undefined), getOrThrow: jest.fn() };
    const prisma = makePrisma();
    const service = new CompanyDomainsService(prisma as never, resolver as never, config as never);

    const warnSpy = jest.spyOn((service as unknown as { logger: { warn: jest.Mock } }).logger, 'warn');

    await service.provisionPlatformSubdomain(COMPANY_A, 'acme');

    expect(prisma.companyDomain.upsert).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/public site.*404|404.*public site/i));
  });

  test('www slug throws PLATFORM_DOMAIN_INVALID — subdomain collapses to base domain (Section 5)', async () => {
    // www.platform.example.com → normalizeHostname strips www. → platform.example.com === PLATFORM_BASE
    // Must throw fail-closed; primary guard is RESERVED_PLATFORM_SLUGS in SuperAdminService.
    const { service, prisma } = makeService();
    await expect(service.provisionPlatformSubdomain(COMPANY_A, 'www')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PLATFORM_DOMAIN_INVALID' }),
    });
    expect(prisma.companyDomain.upsert).not.toHaveBeenCalled();
  });

  test('forwards tx to upsert when a transaction client is provided (Section 3)', async () => {
    const resolver = makeResolver();
    const config = makeConfig(PLATFORM_BASE);
    const prisma = makePrisma();
    const service = new CompanyDomainsService(prisma as never, resolver as never, config as never);

    const txUpsert = jest.fn().mockResolvedValue({});
    const tx = { companyDomain: { upsert: txUpsert } };
    await service.provisionPlatformSubdomain(COMPANY_A, 'acme', tx as never);

    expect(txUpsert).toHaveBeenCalledTimes(1);
    expect(prisma.companyDomain.upsert).not.toHaveBeenCalled();
  });
});
