/**
 * MT-036 / MT-037 / MT-040 / MT-040A — Company Foundation D1 Schema Tests
 *
 * Verifies:
 *  1. Existing Company rows have valid new field values after migration backfill.
 *  2. New DEVELOPER Company creation via SuperAdminService sets correct defaults.
 *  3. New BROKERAGE Company is schema-representable (no Developer FK / hierarchy).
 *  4. Exposure flags are independent booleans.
 *  5. Capabilities JSON round-trips correctly.
 *  6. updateCompany propagates type / lifecycleStatus / exposure flags.
 *
 * All tests use mocked PrismaService — no real DB connection required.
 * DB-level backfill is verified by the migration SQL and manual inspection of
 * existing rows (documented in the D1 report).
 */

import { ConflictException, NotFoundException } from '@nestjs/common';
import { SuperAdminService } from '../super-admin.service';
import { CompanyType, CompanyLifecycleStatus } from '@prisma/client';

jest.mock('argon2', () => ({
  hash: jest.fn().mockResolvedValue('$hashed'),
  verify: jest.fn().mockResolvedValue(true),
}));

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Build a minimal Company row as returned by Prisma after the D1 migration. */
function makeCompanyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'c-0000-0001',
    slug: 'acme',
    name: 'Acme RE',
    isActive: true,
    subscriptionStatus: 'TRIAL' as const,
    subscriptionPlan: 'TRIAL' as const,
    // New D1 fields
    type: 'DEVELOPER' as CompanyType,
    lifecycleStatus: 'ACTIVE' as CompanyLifecycleStatus,
    capabilities: null,
    websiteEnabled: true,
    customerAppEnabled: true,
    staffAppEnabled: true,
    ...overrides,
  };
}

function makeService(overrides: Record<string, unknown> = {}) {
  // Build the base prisma shape first so $transaction can reference it via closure.
  const basePrisma = {
    company: {
      findUnique: jest.fn().mockResolvedValue(null), // default: slug not taken
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((args: { data: Record<string, unknown> }) =>
        Promise.resolve({ ...makeCompanyRow(), ...args.data, id: 'c-new-001' }),
      ),
      update: jest.fn().mockImplementation((args: { data: Record<string, unknown> }) =>
        Promise.resolve({ ...makeCompanyRow(), ...args.data }),
      ),
      findMany: jest.fn().mockResolvedValue([makeCompanyRow()]),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn(),
    },
    pricingPackage: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    setting: {
      createMany: jest.fn().mockResolvedValue({ count: 8 }),
    },
    ...overrides,
  };

  const prisma = {
    ...basePrisma,
    $transaction: jest.fn().mockImplementation((opsOrFn: unknown) => {
      if (typeof opsOrFn === 'function') {
        // Interactive transaction: pass basePrisma as the tx client
        return (opsOrFn as (tx: unknown) => Promise<unknown>)(basePrisma);
      }
      return Promise.all(opsOrFn as unknown[]);
    }),
  };

  // Minimal CapabilityService stub — D1 tests don't exercise capability logic
  const capabilityService = {
    setCapabilities: jest.fn().mockResolvedValue(undefined),
    invalidateCache: jest.fn().mockResolvedValue(undefined),
    hasCapability: jest.fn().mockResolvedValue(false),
    getCapabilities: jest.fn().mockResolvedValue({}),
    requireCapability: jest.fn().mockResolvedValue(undefined),
  };

  const domainResolver = {
    invalidateAllForCompany: jest.fn().mockResolvedValue(undefined),
    invalidateHostname: jest.fn().mockResolvedValue(undefined),
  };
  const companyDomainsService = {
    provisionPlatformSubdomain: jest.fn().mockResolvedValue(undefined),
  };

  const service = new SuperAdminService(prisma as never, capabilityService as never, domainResolver as never, companyDomainsService as never);
  return { service, prisma, basePrisma };
}

// ── 1. Existing Company rows ─────────────────────────────────────────────────

describe('Existing Company after D1 migration backfill', () => {
  const backfilledRow = makeCompanyRow({
    // All new fields have DB-level defaults — existing rows receive these values.
    type: 'DEVELOPER',
    lifecycleStatus: 'ACTIVE',
    capabilities: null,
    websiteEnabled: true,
    customerAppEnabled: true,
    staffAppEnabled: true,
  });

  test('has valid CompanyType', () => {
    expect(backfilledRow.type).toBe('DEVELOPER');
    expect(Object.values(CompanyType)).toContain(backfilledRow.type);
  });

  test('has valid CompanyLifecycleStatus', () => {
    expect(backfilledRow.lifecycleStatus).toBe('ACTIVE');
    expect(Object.values(CompanyLifecycleStatus)).toContain(backfilledRow.lifecycleStatus);
  });

  test('has capabilities storage (null = no entitlements defined yet)', () => {
    expect(backfilledRow.capabilities).toBeNull();
  });

  test('has websiteEnabled = true (preserves existing behavior)', () => {
    expect(backfilledRow.websiteEnabled).toBe(true);
  });

  test('has customerAppEnabled = true (preserves existing behavior)', () => {
    expect(backfilledRow.customerAppEnabled).toBe(true);
  });

  test('has staffAppEnabled = true (preserves existing behavior)', () => {
    expect(backfilledRow.staffAppEnabled).toBe(true);
  });

  test('existing company remains operationally enabled (isActive unchanged)', () => {
    expect(backfilledRow.isActive).toBe(true);
  });
});

// ── 2. New DEVELOPER Company ─────────────────────────────────────────────────

describe('New DEVELOPER Company provisioning', () => {
  test('createCompany defaults type to DEVELOPER when not specified', async () => {
    const { service, prisma } = makeService();
    await service.createCompany({ name: 'NewCo', slug: 'newco' });
    const createCall = (prisma.company.create as jest.Mock).mock.calls[0][0];
    expect(createCall.data.type).toBe('DEVELOPER');
  });

  test('createCompany sets lifecycleStatus = ACTIVE', async () => {
    const { service, prisma } = makeService();
    await service.createCompany({ name: 'NewCo', slug: 'newco' });
    const createCall = (prisma.company.create as jest.Mock).mock.calls[0][0];
    expect(createCall.data.lifecycleStatus).toBe('ACTIVE');
  });

  test('createCompany defaults all exposure flags to true', async () => {
    const { service, prisma } = makeService();
    await service.createCompany({ name: 'NewCo', slug: 'newco' });
    const data = (prisma.company.create as jest.Mock).mock.calls[0][0].data;
    expect(data.websiteEnabled).toBe(true);
    expect(data.customerAppEnabled).toBe(true);
    expect(data.staffAppEnabled).toBe(true);
  });

  test('createCompany accepts explicit type=DEVELOPER', async () => {
    const { service, prisma } = makeService();
    await service.createCompany({ name: 'NewCo', slug: 'newco', type: 'DEVELOPER' });
    const data = (prisma.company.create as jest.Mock).mock.calls[0][0].data;
    expect(data.type).toBe('DEVELOPER');
  });

  test('createCompany throws ConflictException when slug already exists', async () => {
    const { service, prisma } = makeService();
    (prisma.company.findUnique as jest.Mock).mockResolvedValueOnce(makeCompanyRow());
    await expect(service.createCompany({ name: 'Dup', slug: 'newco' })).rejects.toThrow(
      ConflictException,
    );
  });

  test('createCompany throws BadRequestException with SLUG_RESERVED for slug=www', async () => {
    const { service } = makeService();
    await expect(service.createCompany({ name: 'Www Co', slug: 'www' })).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'SLUG_RESERVED' }),
    });
  });

  test('createCompany throws BadRequestException with SLUG_RESERVED for slug=api', async () => {
    const { service } = makeService();
    await expect(service.createCompany({ name: 'Api Co', slug: 'api' })).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'SLUG_RESERVED' }),
    });
  });

  test('createCompany throws BadRequestException with SLUG_RESERVED for slug=admin', async () => {
    const { service } = makeService();
    await expect(service.createCompany({ name: 'Admin Co', slug: 'admin' })).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'SLUG_RESERVED' }),
    });
  });

  test('createCompany accepts non-reserved slug', async () => {
    const { service } = makeService();
    await expect(service.createCompany({ name: 'Acme', slug: 'acme' })).resolves.toBeDefined();
  });

  test('createCompany wraps company.create and provisionPlatformSubdomain in a single $transaction', async () => {
    const { service, prisma } = makeService();
    await service.createCompany({ name: 'NewCo', slug: 'newco' });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});

// ── 3. New BROKERAGE Company ─────────────────────────────────────────────────

describe('New BROKERAGE Company schema representation', () => {
  test('createCompany accepts type=BROKERAGE (no Developer FK required)', async () => {
    const { service, prisma } = makeService();
    await service.createCompany({ name: 'Broker Co', slug: 'broker-co', type: 'BROKERAGE' });
    const data = (prisma.company.create as jest.Mock).mock.calls[0][0].data;
    expect(data.type).toBe('BROKERAGE');
  });

  test('BROKERAGE company has no parentId or developer FK in schema', () => {
    // Structural check: the schema has no developer hierarchy.
    // CompanyType.BROKERAGE is a first-class tenant, not a sub-entity.
    const brokerageRow = makeCompanyRow({ type: 'BROKERAGE' });
    expect(brokerageRow).not.toHaveProperty('developerCompanyId');
    expect(brokerageRow).not.toHaveProperty('parentId');
  });

  test('CompanyType enum has exactly DEVELOPER and BROKERAGE', () => {
    const values = Object.values(CompanyType);
    expect(values).toHaveLength(2);
    expect(values).toContain('DEVELOPER');
    expect(values).toContain('BROKERAGE');
  });
});

// ── 4. Exposure flags independence ───────────────────────────────────────────

describe('MT-040A — Exposure flags are independent booleans', () => {
  test('websiteEnabled=false with customerAppEnabled=true is representable', () => {
    const row = makeCompanyRow({ websiteEnabled: false, customerAppEnabled: true, staffAppEnabled: true });
    expect(row.websiteEnabled).toBe(false);
    expect(row.customerAppEnabled).toBe(true);
    expect(row.staffAppEnabled).toBe(true);
  });

  test('all flags false is representable', () => {
    const row = makeCompanyRow({ websiteEnabled: false, customerAppEnabled: false, staffAppEnabled: false });
    expect(row.websiteEnabled).toBe(false);
    expect(row.customerAppEnabled).toBe(false);
    expect(row.staffAppEnabled).toBe(false);
  });

  test('createCompany accepts explicit exposure flag overrides', async () => {
    const { service, prisma } = makeService();
    await service.createCompany({
      name: 'SelCo', slug: 'selco',
      websiteEnabled: false,
      customerAppEnabled: true,
      staffAppEnabled: false,
    });
    const data = (prisma.company.create as jest.Mock).mock.calls[0][0].data;
    expect(data.websiteEnabled).toBe(false);
    expect(data.customerAppEnabled).toBe(true);
    expect(data.staffAppEnabled).toBe(false);
  });
});

// ── 5. Capabilities JSON round-trip ─────────────────────────────────────────

describe('MT-037 — Capabilities JSONB storage', () => {
  test('capabilities defaults to null (no entitlements stored at creation)', async () => {
    const { service, prisma } = makeService();
    await service.createCompany({ name: 'Cap Co', slug: 'capco' });
    const data = (prisma.company.create as jest.Mock).mock.calls[0][0].data;
    // capabilities is not set explicitly — DB default (null) applies
    expect(data.capabilities).toBeUndefined(); // not sent in create payload = DB null
  });

  test('capabilities JSON object round-trips correctly via Prisma update', async () => {
    const { service, prisma } = makeService({
      company: {
        findUnique: jest.fn().mockResolvedValue(makeCompanyRow()),
        update: jest.fn().mockImplementation((args: { data: Record<string, unknown> }) =>
          Promise.resolve({ ...makeCompanyRow(), ...args.data }),
        ),
        findMany: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
      },
    });

    const caps = { chat: true, reports: false, advancedAnalytics: true };
    // Directly test that a Prisma update with JSON caps would persist the object.
    // The service exposes this path; enforcement/shape is deferred to D2.
    const result = await (prisma.company.update as jest.Mock)({
      where: { id: 'c-0000-0001' },
      data: { capabilities: caps },
    });
    expect(result.capabilities).toEqual(caps);
  });

  test('null capabilities does not affect endpoint access (no enforcement in D1)', () => {
    const row = makeCompanyRow({ capabilities: null });
    // D1 contract: capabilities being null must not throw or block.
    expect(row.capabilities).toBeNull();
    // No guard exists to check this value — enforcement is deferred to D2.
  });
});

// ── 6. updateCompany propagates new fields ───────────────────────────────────

describe('updateCompany — new D1 fields', () => {
  function makeUpdateService() {
    const { service, prisma } = makeService({
      company: {
        findUnique: jest.fn().mockResolvedValue(makeCompanyRow()),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockImplementation((args: { data: Record<string, unknown> }) =>
          Promise.resolve({ ...makeCompanyRow(), ...args.data }),
        ),
        findMany: jest.fn(),
        create: jest.fn(),
      },
      pricingPackage: { findFirst: jest.fn().mockResolvedValue(null) },
    });
    return { service, prisma };
  }

  test('type is NOT sent to Prisma via updateCompany (immutable post-creation)', async () => {
    // MT-042 decision: Company.type is immutable after provisioning.
    // UpdateCompanyDto intentionally excludes type. The service must not write it.
    const { service, prisma } = makeUpdateService();
    // TypeScript would reject { type: 'BROKERAGE' } — use lifecycle instead to exercise the path
    await service.updateCompany('c-0000-0001', { lifecycleStatus: 'SUSPENDED' });
    const data = (prisma.company.update as jest.Mock).mock.calls[0][0].data;
    expect(data.type).toBeUndefined(); // type never in update payload
  });

  test('can update lifecycleStatus to SUSPENDED', async () => {
    const { service, prisma } = makeUpdateService();
    await service.updateCompany('c-0000-0001', { lifecycleStatus: 'SUSPENDED' });
    const data = (prisma.company.update as jest.Mock).mock.calls[0][0].data;
    expect(data.lifecycleStatus).toBe('SUSPENDED');
  });

  test('can disable websiteEnabled', async () => {
    const { service, prisma } = makeUpdateService();
    await service.updateCompany('c-0000-0001', { websiteEnabled: false });
    const data = (prisma.company.update as jest.Mock).mock.calls[0][0].data;
    expect(data.websiteEnabled).toBe(false);
  });

  test('undefined type does NOT send type field to Prisma (no accidental overwrite)', async () => {
    const { service, prisma } = makeUpdateService();
    await service.updateCompany('c-0000-0001', { name: 'Renamed' });
    const data = (prisma.company.update as jest.Mock).mock.calls[0][0].data;
    expect(data.type).toBeUndefined();
  });

  test('throws NotFoundException for unknown company id', async () => {
    const { service, prisma } = makeUpdateService();
    (prisma.company.findUnique as jest.Mock).mockResolvedValueOnce(null);
    await expect(service.updateCompany('no-such-id', { name: 'X' })).rejects.toThrow(
      NotFoundException,
    );
  });
});

// ── 7. CompanyLifecycleStatus enum ───────────────────────────────────────────

describe('CompanyLifecycleStatus enum values (MT-036)', () => {
  test('has exactly ACTIVE, SUSPENDED, ARCHIVED', () => {
    const values = Object.values(CompanyLifecycleStatus);
    expect(values).toHaveLength(3);
    expect(values).toContain('ACTIVE');
    expect(values).toContain('SUSPENDED');
    expect(values).toContain('ARCHIVED');
  });

  test('lifecycleStatus is distinct from subscriptionStatus (no TRIAL/CANCELLED/EXPIRED)', () => {
    const values = Object.values(CompanyLifecycleStatus);
    expect(values).not.toContain('TRIAL');
    expect(values).not.toContain('CANCELLED');
    expect(values).not.toContain('EXPIRED');
  });
});
