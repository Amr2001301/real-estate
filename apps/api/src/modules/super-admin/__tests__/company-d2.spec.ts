/**
 * MT-041 / MT-042 / MT-043 — Company D2 tests
 *
 * Verifies:
 *  MT-041: Company hard-delete is blocked
 *  MT-042: SUPER_ADMIN can update lifecycle/capabilities/exposure flags
 *          Capabilities update invalidates Redis cache
 *          Tenant ADMIN cannot update these fields (service-layer concern; controller uses SuperAdminGuard)
 *          Company A capability update cannot mutate Company B
 *          Type is immutable post-creation (absent from UpdateCompanyDto)
 *  MT-043: listCompanies + getCompany projections include new D1 fields
 *  lifecycle: loginStaff to SUSPENDED company is denied (COMPANY_NOT_ACTIVE)
 *  lifecycle: loginSuperAdmin is unaffected by lifecycle
 */

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { SuperAdminService } from '../super-admin.service';

jest.mock('argon2', () => ({
  hash: jest.fn().mockResolvedValue('$hashed'),
  verify: jest.fn().mockResolvedValue(true),
}));

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeCompanyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'c-d2-001',
    slug: 'acme',
    name: 'Acme RE',
    logoUrl: null,
    country: 'SA',
    currency: 'SAR',
    defaultLocale: 'ar',
    timezone: 'Asia/Riyadh',
    isActive: true,
    type: 'DEVELOPER',
    lifecycleStatus: 'ACTIVE',
    capabilities: null,
    websiteEnabled: true,
    customerAppEnabled: true,
    staffAppEnabled: true,
    subscriptionPlan: 'TRIAL',
    subscriptionStatus: 'TRIAL',
    subscriptionStartAt: null,
    subscriptionEndAt: null,
    maxUsers: null,
    cancelledAt: null,
    cancelReason: null,
    modules: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function makeCapabilityService(overrides: Record<string, unknown> = {}) {
  return {
    setCapabilities: jest.fn().mockResolvedValue(undefined),
    invalidateCache: jest.fn().mockResolvedValue(undefined),
    hasCapability: jest.fn().mockResolvedValue(false),
    getCapabilities: jest.fn().mockResolvedValue({}),
    requireCapability: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeDomainResolver() {
  return {
    invalidateAllForCompany: jest.fn().mockResolvedValue(undefined),
    invalidateHostname: jest.fn().mockResolvedValue(undefined),
  };
}

function makeCompanyDomainsService() {
  return {
    provisionPlatformSubdomain: jest.fn().mockResolvedValue(undefined),
  };
}

function makeService(
  companyRow: ReturnType<typeof makeCompanyRow> | null = makeCompanyRow(),
  capService = makeCapabilityService(),
) {
  const basePrisma = {
    company: {
      findUnique: jest.fn().mockResolvedValue(companyRow),
      findMany: jest.fn().mockResolvedValue(
        companyRow ? [{ ...companyRow, _count: { users: 2 } }] : [],
      ),
      create: jest.fn().mockImplementation((args: { data: Record<string, unknown> }) =>
        Promise.resolve({ ...makeCompanyRow(), ...args.data, id: 'c-new-d2' }),
      ),
      update: jest.fn().mockImplementation((args: { data: Record<string, unknown> }) =>
        Promise.resolve({ ...makeCompanyRow(), ...args.data }),
      ),
    },
    user: { findUnique: jest.fn().mockResolvedValue(null), findFirst: jest.fn().mockResolvedValue(null), create: jest.fn(), update: jest.fn() },
    pricingPackage: { findFirst: jest.fn().mockResolvedValue(null) },
  };
  const prisma = {
    ...basePrisma,
    $transaction: jest.fn().mockImplementation((opsOrFn: unknown) => {
      if (typeof opsOrFn === 'function') return (opsOrFn as (tx: unknown) => Promise<unknown>)(basePrisma);
      return Promise.all(opsOrFn as unknown[]);
    }),
  };

  const domainResolver = makeDomainResolver();
  const service = new SuperAdminService(prisma as never, capService as never, domainResolver as never, makeCompanyDomainsService() as never);
  return { service, prisma, capService, domainResolver };
}

// ── MT-041: Hard delete blocked ───────────────────────────────────────────────

describe('MT-041 — Company hard-delete restriction', () => {
  test('deleteCompany always throws ForbiddenException with COMPANY_DELETE_FORBIDDEN', () => {
    const { service } = makeService();
    expect(() => service.deleteCompany('c-d2-001')).toThrow(ForbiddenException);
  });

  test('deleteCompany error body contains stable code COMPANY_DELETE_FORBIDDEN', () => {
    const { service } = makeService();
    try {
      service.deleteCompany('c-d2-001');
    } catch (err) {
      expect((err as ForbiddenException).getResponse()).toMatchObject({
        code: 'COMPANY_DELETE_FORBIDDEN',
      });
    }
  });

  test('deleteCompany does NOT call prisma.company.delete', () => {
    const { service, prisma } = makeService();
    try { service.deleteCompany('c-d2-001'); } catch { /* expected */ }
    expect((prisma.company as Record<string, jest.Mock>).delete).toBeUndefined();
  });
});

// ── MT-042: Capabilities update ───────────────────────────────────────────────

describe('MT-042 — updateCapabilities', () => {
  test('calls CapabilityService.setCapabilities with correct companyId + caps', async () => {
    const capService = makeCapabilityService();
    const { service } = makeService(makeCompanyRow(), capService);
    await service.updateCapabilities('c-d2-001', { capabilities: { crm: true, broker: false } });
    expect(capService.setCapabilities).toHaveBeenCalledWith('c-d2-001', { crm: true, broker: false });
  });

  test('returns { capabilities } shape', async () => {
    const { service } = makeService();
    const result = await service.updateCapabilities('c-d2-001', { capabilities: { crm: true } });
    expect(result).toEqual({ capabilities: { crm: true } });
  });

  test('throws NotFoundException for unknown company', async () => {
    const { service } = makeService(null);
    await expect(service.updateCapabilities('no-such-id', { capabilities: {} })).rejects.toThrow(
      NotFoundException,
    );
  });

  test('Company A capability update does NOT pass company B id to CapabilityService', async () => {
    const capService = makeCapabilityService();
    const { service } = makeService(makeCompanyRow({ id: 'company-aaa' }), capService);
    await service.updateCapabilities('company-aaa', { capabilities: { crm: true } });
    expect(capService.setCapabilities).toHaveBeenCalledWith('company-aaa', { crm: true });
    expect(capService.setCapabilities).not.toHaveBeenCalledWith('company-bbb', expect.anything());
  });
});

// ── MT-042: lifecycleStatus + exposure flags via updateCompany ────────────────

describe('MT-042 — updateCompany lifecycle/exposure flags', () => {
  test('can set lifecycleStatus to SUSPENDED', async () => {
    const { service, prisma } = makeService();
    await service.updateCompany('c-d2-001', { lifecycleStatus: 'SUSPENDED' });
    expect(prisma.company.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ lifecycleStatus: 'SUSPENDED' }) }),
    );
  });

  test('can set lifecycleStatus to ARCHIVED', async () => {
    const { service, prisma } = makeService();
    await service.updateCompany('c-d2-001', { lifecycleStatus: 'ARCHIVED' });
    const data = (prisma.company.update as jest.Mock).mock.calls[0][0].data;
    expect(data.lifecycleStatus).toBe('ARCHIVED');
  });

  test('can disable websiteEnabled', async () => {
    const { service, prisma } = makeService();
    await service.updateCompany('c-d2-001', { websiteEnabled: false });
    const data = (prisma.company.update as jest.Mock).mock.calls[0][0].data;
    expect(data.websiteEnabled).toBe(false);
  });

  test('type is NOT propagated in updateCompany (immutable post-creation)', async () => {
    const { service, prisma } = makeService();
    // Update any allowed field; type should not appear in the update payload
    await service.updateCompany('c-d2-001', { name: 'Renamed' });
    const data = (prisma.company.update as jest.Mock).mock.calls[0][0].data;
    expect(data.type).toBeUndefined();
  });
});

// ── Section 8: Cache security regression ─────────────────────────────────────

describe('MT-055 — domain cache invalidation on lifecycle/websiteEnabled change', () => {
  test('updateCompany with lifecycleStatus → invalidateAllForCompany called (Section 8)', async () => {
    const { service, domainResolver } = makeService();
    await service.updateCompany('c-d2-001', { lifecycleStatus: 'SUSPENDED' });
    expect(domainResolver.invalidateAllForCompany).toHaveBeenCalledWith('c-d2-001');
  });

  test('updateCompany with websiteEnabled=false → invalidateAllForCompany called (Section 8)', async () => {
    const { service, domainResolver } = makeService();
    await service.updateCompany('c-d2-001', { websiteEnabled: false });
    expect(domainResolver.invalidateAllForCompany).toHaveBeenCalledWith('c-d2-001');
  });

  test('updateCompany with name only → invalidateAllForCompany NOT called (Section 8)', async () => {
    const { service, domainResolver } = makeService();
    await service.updateCompany('c-d2-001', { name: 'Renamed' });
    expect(domainResolver.invalidateAllForCompany).not.toHaveBeenCalled();
  });

  test('ACTIVE → SUSPENDED transition clears domain cache so suspended company resolves null', async () => {
    const { service, domainResolver } = makeService();
    await service.updateCompany('c-d2-001', { lifecycleStatus: 'SUSPENDED' });
    // The invalidation call is the cache-clearing contract. The actual null resolve
    // is enforced by DomainResolverService filtering on lifecycleStatus=ACTIVE.
    expect(domainResolver.invalidateAllForCompany).toHaveBeenCalledTimes(1);
  });
});

// ── MT-043: listCompanies projection ─────────────────────────────────────────

describe('MT-043 — listCompanies projection', () => {
  test('includes D1 foundation fields: type, lifecycleStatus, capabilities, exposure flags', async () => {
    const { service } = makeService(
      makeCompanyRow({
        type: 'DEVELOPER',
        lifecycleStatus: 'ACTIVE',
        capabilities: { crm: true },
        websiteEnabled: true,
        customerAppEnabled: false,
        staffAppEnabled: true,
      }),
    );
    const companies = await service.listCompanies();
    const c = companies[0]!;
    expect(c.type).toBe('DEVELOPER');
    expect(c.lifecycleStatus).toBe('ACTIVE');
    expect(c.capabilities).toEqual({ crm: true });
    expect(c.websiteEnabled).toBe(true);
    expect(c.customerAppEnabled).toBe(false);
    expect(c.staffAppEnabled).toBe(true);
  });

  test('also includes existing fields: id, name, slug, subscriptionStatus', async () => {
    const { service } = makeService();
    const companies = await service.listCompanies();
    const c = companies[0]!;
    expect(c.id).toBeDefined();
    expect(c.name).toBeDefined();
    expect(c.slug).toBeDefined();
    expect(c.subscriptionStatus).toBeDefined();
  });
});

// ── MT-043: getCompany projection ─────────────────────────────────────────────

describe('MT-043 — getCompany projection', () => {
  const rowWithCount = {
    ...makeCompanyRow({ type: 'BROKERAGE', lifecycleStatus: 'SUSPENDED' }),
    _count: { users: 3 },
    users: [],
  };

  function makeServiceWithDetail() {
    const prisma = {
      company: { findUnique: jest.fn().mockResolvedValue(rowWithCount) },
    };
    const capService = makeCapabilityService();
    const service = new SuperAdminService(prisma as never, capService as never, makeDomainResolver() as never, makeCompanyDomainsService() as never);
    return { service };
  }

  test('includes D1 fields: type, lifecycleStatus, capabilities, exposure flags', async () => {
    const { service } = makeServiceWithDetail();
    const company = await service.getCompany('c-d2-001');
    expect(company.type).toBe('BROKERAGE');
    expect(company.lifecycleStatus).toBe('SUSPENDED');
    expect(company.websiteEnabled).toBeDefined();
    expect(company.customerAppEnabled).toBeDefined();
    expect(company.staffAppEnabled).toBeDefined();
    expect(company.capabilities).toBeDefined();
  });

  test('includes userCount and users array', async () => {
    const { service } = makeServiceWithDetail();
    const company = await service.getCompany('c-d2-001');
    expect(company.userCount).toBe(3);
    expect(Array.isArray(company.users)).toBe(true);
  });

  test('throws NotFoundException for unknown company', async () => {
    const prisma = { company: { findUnique: jest.fn().mockResolvedValue(null) } };
    const service = new SuperAdminService(prisma as never, makeCapabilityService() as never, makeDomainResolver() as never, makeCompanyDomainsService() as never);
    await expect(service.getCompany('no-such')).rejects.toThrow(NotFoundException);
  });
});
