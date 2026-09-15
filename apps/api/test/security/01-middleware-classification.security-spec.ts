/**
 * STEP 2 — Middleware classification tests.
 *
 * Verifies:
 *   MC-1  Every model in MODEL_TENANCY has a valid tier string.
 *   MC-2  The count of TENANT_OWNED models matches the audit-documented 46.
 *   MC-3  Specific representative models land in their documented tiers.
 *   MC-4  TENANT_OWNED model counts: PLATFORM_GLOBAL=3, TENANT_CONTROLLED=3,
 *          TENANT_VIA_RELATION≥7.
 *   MC-5  Middleware fails CLOSED: calling PrismaService.lead.findMany() outside
 *          any ALS context throws MissingTenantContextError (not silently unscoped).
 *   MC-6  MODEL_TIER_BY_LOWERCASE maps lowercase keys to the correct tiers,
 *          bridging the Prisma middleware key space (lowercase) to MODEL_TENANCY.
 *   MC-7  getModelTier() throws on an unclassified model name.
 */

import { type TestApp, createTestApp } from '../setup-app';
import { MODEL_TENANCY, ModelTenancyTier } from '../../src/common/prisma/model-tenancy';
import {
  MODEL_TIER_BY_LOWERCASE,
  getModelTier,
} from '../../src/common/prisma/tenant-query-policy';
import { MissingTenantContextError } from '../../src/common/tenant/tenant-context.errors';

const VALID_TIERS: ModelTenancyTier[] = [
  'PLATFORM_GLOBAL',
  'TENANT_OWNED',
  'TENANT_CONTROLLED',
  'TENANT_VIA_RELATION',
  'CROSS_TENANT_CONTROLLED',
];

// Spot-check expected classification for key models per audit Section 2.
const EXPECTED_CLASSIFICATIONS: [string, ModelTenancyTier][] = [
  // PLATFORM_GLOBAL
  ['Company', 'PLATFORM_GLOBAL'],
  ['Permission', 'PLATFORM_GLOBAL'],
  ['PricingPackage', 'PLATFORM_GLOBAL'],
  // TENANT_CONTROLLED
  ['User', 'TENANT_CONTROLLED'],
  ['OtpCode', 'TENANT_CONTROLLED'],
  ['CompanyDomain', 'TENANT_CONTROLLED'],
  // TENANT_VIA_RELATION
  ['RefreshToken', 'TENANT_VIA_RELATION'],
  ['UserPermission', 'TENANT_VIA_RELATION'],
  ['Favorite', 'TENANT_VIA_RELATION'],
  // TENANT_OWNED
  ['Project', 'TENANT_OWNED'],
  ['Lead', 'TENANT_OWNED'],
  ['Reservation', 'TENANT_OWNED'],
  ['Contract', 'TENANT_OWNED'],
  ['InstallmentPlan', 'TENANT_OWNED'],
  ['Deposit', 'TENANT_OWNED'],
  ['Document', 'TENANT_OWNED'],
  ['ChatSession', 'TENANT_OWNED'],
  ['AuditLog', 'TENANT_OWNED'],
  // Step A
  ['PaymentInstrument', 'TENANT_OWNED'],
  // Step C
  ['PaymentCorrection', 'TENANT_OWNED'],
  // Step D1
  ['ContractCancellation', 'TENANT_OWNED'],
  ['Refund', 'TENANT_OWNED'],
];

describe('SEC — Middleware Classification (STEP 2)', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  }, 30_000);

  afterAll(async () => {
    await testApp.close();
  });

  // MC-1
  it('MC-1: every MODEL_TENANCY entry has a valid tier', () => {
    for (const [model, tier] of Object.entries(MODEL_TENANCY)) {
      expect(VALID_TIERS).toContain(tier);
      // Ensure no typos / empty strings
      expect(tier.length).toBeGreaterThan(0);
      expect(model.length).toBeGreaterThan(0);
    }
  });

  // MC-2
  it('MC-2: TENANT_OWNED count matches audit-documented 50 (48 + ContractCancellation + Refund from Step D1)', () => {
    const owned = Object.entries(MODEL_TENANCY).filter(([, t]) => t === 'TENANT_OWNED');
    expect(owned.length).toBe(50);
  });

  // MC-3
  it.each(EXPECTED_CLASSIFICATIONS)(
    'MC-3: MODEL_TENANCY["%s"] === "%s"',
    (model, expectedTier) => {
      expect(MODEL_TENANCY[model as keyof typeof MODEL_TENANCY]).toBe(expectedTier);
    },
  );

  // MC-4
  it('MC-4: PLATFORM_GLOBAL=3, TENANT_CONTROLLED=3, TENANT_VIA_RELATION≥7', () => {
    const byTier = (tier: ModelTenancyTier) =>
      Object.values(MODEL_TENANCY).filter((t) => t === tier).length;

    expect(byTier('PLATFORM_GLOBAL')).toBe(3);
    expect(byTier('TENANT_CONTROLLED')).toBe(3);
    expect(byTier('TENANT_VIA_RELATION')).toBeGreaterThanOrEqual(7);
  });

  // MC-5 — fail-closed: TENANT_OWNED query outside ALS throws
  it('MC-5: PrismaService.lead.findMany() outside ALS context throws MissingTenantContextError', async () => {
    // testApp.prisma is the middleware-wired PrismaService. Calling it here,
    // outside any runTenantContext() / enterTenantContext() scope, must throw.
    await expect(testApp.prisma.lead.findMany()).rejects.toThrow(MissingTenantContextError);
  });

  it('MC-5b: PrismaService.reservation.findFirst() outside ALS context throws', async () => {
    await expect(testApp.prisma.reservation.findFirst()).rejects.toThrow(MissingTenantContextError);
  });

  it('MC-5c: PrismaService.contract.count() outside ALS context throws', async () => {
    await expect(testApp.prisma.contract.count()).rejects.toThrow(MissingTenantContextError);
  });

  // PLATFORM_GLOBAL models must NOT throw even without an ALS context
  it('MC-5d: PrismaService.company.findMany() outside ALS does NOT throw (PLATFORM_GLOBAL)', async () => {
    await expect(testApp.prisma.company.findMany({ take: 0 })).resolves.toBeDefined();
  });

  // MC-6
  it('MC-6: MODEL_TIER_BY_LOWERCASE maps lowercase Prisma model keys to correct tiers', () => {
    expect(MODEL_TIER_BY_LOWERCASE.get('lead')).toBe('TENANT_OWNED');
    expect(MODEL_TIER_BY_LOWERCASE.get('user')).toBe('TENANT_CONTROLLED');
    expect(MODEL_TIER_BY_LOWERCASE.get('company')).toBe('PLATFORM_GLOBAL');
    expect(MODEL_TIER_BY_LOWERCASE.get('refreshtoken')).toBe('TENANT_VIA_RELATION');
    expect(MODEL_TIER_BY_LOWERCASE.get('reservation')).toBe('TENANT_OWNED');
    expect(MODEL_TIER_BY_LOWERCASE.get('document')).toBe('TENANT_OWNED');
  });

  it('MC-6b: MODEL_TIER_BY_LOWERCASE size matches MODEL_TENANCY size', () => {
    expect(MODEL_TIER_BY_LOWERCASE.size).toBe(Object.keys(MODEL_TENANCY).length);
  });

  // MC-7
  it('MC-7: getModelTier() throws on an unclassified model name', () => {
    expect(() => getModelTier('unknownmodel_xyz')).toThrow(
      /Unclassified Prisma model|MT-014/,
    );
  });
});
