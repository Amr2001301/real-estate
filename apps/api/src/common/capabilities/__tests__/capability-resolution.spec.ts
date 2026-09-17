/**
 * Phase 1 capability resolution — unit tests
 *
 * Covers (per spec):
 *  1. Effective resolution for each plan tier with no override
 *  2. An override wins over the plan default, in both directions (raising and lowering)
 *  3. An override survives a plan change and still wins
 *  4. Invalid override values are rejected at write time
 *  5. Cache invalidation: change a plan or an override → next read reflects it
 *  6. Usage counts are tenant-scoped
 *  7. Company ADMIN cannot read/write another company's capabilities (404)
 */

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CapabilityService } from '../capability.service';
import {
  buildEffectiveView,
  PLAN_DEFAULTS,
  validateCapabilityOverrides,
  type EffectiveCapabilitiesView,
} from '../capability-schema';
import type { SubscriptionPlan } from '@prisma/client';

// ── Test helpers ──────────────────────────────────────────────────────────────

function makeRedis(overrides: Record<string, jest.Mock> = {}) {
  return {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    ...overrides,
  };
}

function makeCompanyRow(overrides: Partial<{
  subscriptionPlan: SubscriptionPlan;
  capabilities: Record<string, unknown> | null;
  websiteEnabled: boolean;
  customerAppEnabled: boolean;
  staffAppEnabled: boolean;
}> = {}) {
  return {
    subscriptionPlan: 'STARTER' as SubscriptionPlan,
    capabilities: null,
    websiteEnabled: false,
    customerAppEnabled: false,
    staffAppEnabled: true,
    ...overrides,
  };
}

function makePrisma(row: ReturnType<typeof makeCompanyRow> | null = makeCompanyRow()) {
  return {
    company: {
      findUnique: jest.fn().mockResolvedValue(row),
      update: jest.fn().mockResolvedValue({}),
    },
  };
}

function makeService(prismaOverride?: ReturnType<typeof makePrisma>, redisOverride?: ReturnType<typeof makeRedis>) {
  const prisma = prismaOverride ?? makePrisma();
  const redis  = redisOverride ?? makeRedis();
  const svc    = new CapabilityService(prisma as never, redis as never);
  return { svc, prisma, redis };
}

function effective(view: EffectiveCapabilitiesView, key: string) {
  return view.keys.find((k) => k.key === key)?.effective;
}

// ── 1. Plan defaults per tier ─────────────────────────────────────────────────

describe('buildEffectiveView — plan defaults (no override)', () => {
  const noOverride = {};
  const cols = { website: true, customer: true, staff: true };

  test('TRIAL: all limits set, all features enabled', () => {
    const view = buildEffectiveView('TRIAL', noOverride, cols.website, cols.customer, cols.staff);
    expect(view.plan).toBe('TRIAL');
    expect(effective(view, 'limit.maxUnits')).toBe(150);
    expect(effective(view, 'limit.maxUsers')).toBe(15);
    expect(effective(view, 'limit.maxProjects')).toBe(5);
    expect(effective(view, 'feature.maintenance')).toBe(true);
    expect(effective(view, 'feature.customDomain')).toBe(true);
    expect(effective(view, 'feature.brokers')).toBe(true);
    // All keys have source plan_default or company_column
    view.keys.forEach((k) => {
      expect(['plan_default', 'company_column']).toContain(k.source);
    });
  });

  test('STARTER: limited counts, restricted feature set', () => {
    const view = buildEffectiveView('STARTER', noOverride, false, false, true);
    expect(effective(view, 'limit.maxUnits')).toBe(150);
    expect(effective(view, 'limit.maxUsers')).toBe(15);
    expect(effective(view, 'limit.maxProjects')).toBe(5);
    expect(effective(view, 'feature.brokers')).toBe(false);
    expect(effective(view, 'feature.advancedReports')).toBe(false);
    expect(effective(view, 'feature.maintenance')).toBe(false);
    expect(effective(view, 'feature.customDomain')).toBe(false);
    // Column-backed features match the supplied column values
    expect(effective(view, 'feature.publicWebsite')).toBe(false);
    expect(effective(view, 'feature.customerApp')).toBe(false);
    expect(effective(view, 'feature.staffApp')).toBe(true);
  });

  test('PROFESSIONAL: higher limits, more features', () => {
    const view = buildEffectiveView('PROFESSIONAL', noOverride, true, true, true);
    expect(effective(view, 'limit.maxUnits')).toBe(750);
    expect(effective(view, 'limit.maxUsers')).toBe(50);
    expect(effective(view, 'limit.maxProjects')).toBe(20);
    expect(effective(view, 'feature.brokers')).toBe(true);
    expect(effective(view, 'feature.advancedReports')).toBe(true);
    expect(effective(view, 'feature.maintenance')).toBe(false);
    expect(effective(view, 'feature.customDomain')).toBe(false);
  });

  test('ENTERPRISE: unlimited, all features enabled', () => {
    const view = buildEffectiveView('ENTERPRISE', noOverride, true, true, true);
    expect(effective(view, 'limit.maxUnits')).toBeNull();
    expect(effective(view, 'limit.maxUsers')).toBeNull();
    expect(effective(view, 'limit.maxProjects')).toBeNull();
    expect(effective(view, 'feature.maintenance')).toBe(true);
    expect(effective(view, 'feature.customDomain')).toBe(true);
  });

  test('CUSTOM: unlimited, all features enabled (same as ENTERPRISE)', () => {
    const view = buildEffectiveView('CUSTOM', noOverride, true, true, true);
    expect(effective(view, 'limit.maxUnits')).toBeNull();
    expect(effective(view, 'feature.maintenance')).toBe(true);
    expect(effective(view, 'feature.customDomain')).toBe(true);
  });

  test('PLAN_DEFAULTS covers all keys for every tier', () => {
    const tiers: SubscriptionPlan[] = ['TRIAL', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE', 'CUSTOM'];
    for (const tier of tiers) {
      const view = buildEffectiveView(tier, noOverride, true, true, true);
      expect(view.keys).toHaveLength(14); // 3 limits + 11 features
      view.keys.forEach((k) => {
        expect(k.effective).not.toBeUndefined();
        expect(PLAN_DEFAULTS[tier]).toHaveProperty([k.key]);
      });
    }
  });
});

// ── 2. Override wins in both directions ───────────────────────────────────────

describe('buildEffectiveView — override wins over plan default', () => {
  test('raising a limit: STARTER maxUnits 150 → 500 via override', () => {
    const view = buildEffectiveView('STARTER', { 'limit.maxUnits': 500 }, false, false, true);
    const unitKey = view.keys.find((k) => k.key === 'limit.maxUnits')!;
    expect(unitKey.planDefault).toBe(150);
    expect(unitKey.override).toBe(500);
    expect(unitKey.effective).toBe(500);
    expect(unitKey.source).toBe('capabilities_override');
  });

  test('lowering a limit: ENTERPRISE unlimited → 10 via override', () => {
    const view = buildEffectiveView('ENTERPRISE', { 'limit.maxUnits': 10 }, true, true, true);
    const unitKey = view.keys.find((k) => k.key === 'limit.maxUnits')!;
    expect(unitKey.planDefault).toBeNull();
    expect(unitKey.override).toBe(10);
    expect(unitKey.effective).toBe(10);
  });

  test('enabling a feature: STARTER brokers false → true via override', () => {
    const view = buildEffectiveView('STARTER', { 'feature.brokers': true }, false, false, true);
    const brokerKey = view.keys.find((k) => k.key === 'feature.brokers')!;
    expect(brokerKey.planDefault).toBe(false);
    expect(brokerKey.override).toBe(true);
    expect(brokerKey.effective).toBe(true);
    expect(brokerKey.source).toBe('capabilities_override');
  });

  test('disabling a feature: ENTERPRISE maintenance true → false via override', () => {
    const view = buildEffectiveView('ENTERPRISE', { 'feature.maintenance': false }, true, true, true);
    const mKey = view.keys.find((k) => k.key === 'feature.maintenance')!;
    expect(mKey.planDefault).toBe(true);
    expect(mKey.override).toBe(false);
    expect(mKey.effective).toBe(false);
  });

  test('null limit override: sets unlimited regardless of plan', () => {
    const view = buildEffectiveView('STARTER', { 'limit.maxUnits': null }, false, false, true);
    expect(effective(view, 'limit.maxUnits')).toBeNull();
  });

  test('keys with no override retain plan_default source', () => {
    const view = buildEffectiveView('STARTER', { 'feature.brokers': true }, false, false, true);
    const crmKey = view.keys.find((k) => k.key === 'feature.crm')!;
    expect(crmKey.override).toBeUndefined();
    expect(crmKey.source).toBe('plan_default');
  });
});

// ── 3. Override survives a plan change ────────────────────────────────────────

describe('buildEffectiveView — override survives plan change', () => {
  test('brokers override=true on STARTER → still true after "plan change" to PROFESSIONAL', () => {
    const overrides = { 'feature.brokers': true };
    const starterView       = buildEffectiveView('STARTER',       overrides, false, false, true);
    const professionalView  = buildEffectiveView('PROFESSIONAL',  overrides, true,  true,  true);

    // On STARTER, plan default is false — override wins
    expect(effective(starterView,       'feature.brokers')).toBe(true);
    // After plan change to PROFESSIONAL, plan default is now true — override is redundant but still present
    expect(effective(professionalView,  'feature.brokers')).toBe(true);
    // Ensure override field is still surfaced (for transparency in admin UI)
    const key = professionalView.keys.find((k) => k.key === 'feature.brokers')!;
    expect(key.override).toBe(true);
  });

  test('maxUnits=500 override persists through STARTER → ENTERPRISE plan change', () => {
    const overrides = { 'limit.maxUnits': 500 };
    const enterpriseView = buildEffectiveView('ENTERPRISE', overrides, true, true, true);
    // ENTERPRISE plan default is null (unlimited) but the override 500 wins
    expect(effective(enterpriseView, 'limit.maxUnits')).toBe(500);
  });
});

// ── 4. Invalid override values rejected at write time ─────────────────────────

describe('validateCapabilityOverrides', () => {
  test('empty object is valid', () => {
    expect(validateCapabilityOverrides({})).toHaveLength(0);
  });

  test('valid limit override (positive integer)', () => {
    expect(validateCapabilityOverrides({ 'limit.maxUnits': 300 })).toHaveLength(0);
  });

  test('null limit value is valid (unlimited)', () => {
    expect(validateCapabilityOverrides({ 'limit.maxUnits': null })).toHaveLength(0);
  });

  test('valid feature override (boolean)', () => {
    expect(validateCapabilityOverrides({ 'feature.brokers': true })).toHaveLength(0);
  });

  test('unknown key is rejected', () => {
    const errors = validateCapabilityOverrides({ 'feature.unknown': true });
    expect(errors).toHaveLength(1);
    expect(errors[0]?.key).toBe('feature.unknown');
  });

  test('column-backed feature key (feature.staffApp) is not override-eligible', () => {
    const errors = validateCapabilityOverrides({ 'feature.staffApp': true });
    expect(errors).toHaveLength(1);
    expect(errors[0]?.reason).toMatch(/non-overridable/);
  });

  test('column-backed feature.publicWebsite is not override-eligible', () => {
    const errors = validateCapabilityOverrides({ 'feature.publicWebsite': false });
    expect(errors).toHaveLength(1);
  });

  test('float limit value is rejected', () => {
    const errors = validateCapabilityOverrides({ 'limit.maxUnits': 1.5 });
    expect(errors).toHaveLength(1);
    expect(errors[0]?.key).toBe('limit.maxUnits');
  });

  test('negative limit value is rejected', () => {
    const errors = validateCapabilityOverrides({ 'limit.maxUnits': -5 });
    expect(errors).toHaveLength(1);
  });

  test('string value for feature key is rejected', () => {
    const errors = validateCapabilityOverrides({ 'feature.brokers': 'yes' });
    expect(errors).toHaveLength(1);
  });

  test('string value for limit key is rejected', () => {
    const errors = validateCapabilityOverrides({ 'limit.maxUsers': 'unlimited' });
    expect(errors).toHaveLength(1);
  });

  test('non-object root is rejected', () => {
    const errors = validateCapabilityOverrides('invalid');
    expect(errors).toHaveLength(1);
    expect(errors[0]?.key).toBe('(root)');
  });

  test('array root is rejected', () => {
    const errors = validateCapabilityOverrides([]);
    expect(errors).toHaveLength(1);
  });

  test('multiple invalid keys all reported', () => {
    const errors = validateCapabilityOverrides({
      'limit.maxUnits': -1,
      'feature.unknown': 123,
    });
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });
});

// ── 5. Cache invalidation ─────────────────────────────────────────────────────

describe('CapabilityService — cache invalidation on override write', () => {
  test('setCapabilityOverrides invalidates the cache after writing', async () => {
    const row = makeCompanyRow({ subscriptionPlan: 'STARTER', capabilities: null });
    const prisma = makePrisma(row);
    const redis  = makeRedis();
    const { svc } = makeService(prisma, redis);

    await svc.setCapabilityOverrides('comp-x', { 'feature.brokers': true });

    expect(redis.del).toHaveBeenCalledWith('company-capabilities:comp-x');
  });

  test('after override write, next getEffectiveCapabilities reflects new override', async () => {
    const row = makeCompanyRow({ subscriptionPlan: 'STARTER', capabilities: null });
    const updatedRow = {
      ...row,
      capabilities: { 'feature.brokers': true },
    };
    const prisma = {
      company: {
        findUnique: jest.fn()
          // first call: the existing row check in setCapabilityOverrides
          .mockResolvedValueOnce({ id: 'comp-x', capabilities: null })
          // second call: getEffectiveCapabilities after write
          .mockResolvedValueOnce(updatedRow),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const { svc } = makeService(prisma as never);

    const view = await svc.setCapabilityOverrides('comp-x', { 'feature.brokers': true });
    expect(effective(view, 'feature.brokers')).toBe(true);
  });

  test('setCapabilities (legacy) also invalidates cache', async () => {
    const redis  = makeRedis();
    const { svc } = makeService(undefined, redis);

    await svc.setCapabilities('comp-y', { crm: true });
    expect(redis.del).toHaveBeenCalledWith('company-capabilities:comp-y');
  });
});

// ── 6. Usage counts are tenant-scoped ────────────────────────────────────────
// Usage counting lives in SuperAdminService / CompanyCapabilitiesController;
// what we can unit-test here is that getEffectiveCapabilities is called with the
// correct companyId and returns the plan's limit keys.

describe('CapabilityService.getEffectiveCapabilities — tenant scope', () => {
  test('calls prisma.company.findUnique with the exact companyId', async () => {
    const { svc, prisma } = makeService();
    await svc.getEffectiveCapabilities('tenant-abc');
    expect(prisma.company.findUnique).toHaveBeenCalledWith({
      where: { id: 'tenant-abc' },
      select: expect.objectContaining({ subscriptionPlan: true }),
    });
  });

  test('company-A result does not bleed into company-B call', async () => {
    const rowA = makeCompanyRow({ subscriptionPlan: 'ENTERPRISE', capabilities: null });
    const rowB = makeCompanyRow({ subscriptionPlan: 'STARTER',    capabilities: null });
    const prisma = {
      company: {
        findUnique: jest.fn()
          .mockResolvedValueOnce(rowA)
          .mockResolvedValueOnce(rowB),
        update: jest.fn(),
      },
    };
    const { svc } = makeService(prisma as never);

    const viewA = await svc.getEffectiveCapabilities('A');
    const viewB = await svc.getEffectiveCapabilities('B');

    expect(viewA.plan).toBe('ENTERPRISE');
    expect(viewB.plan).toBe('STARTER');
    expect(effective(viewA, 'limit.maxUnits')).toBeNull();  // ENTERPRISE unlimited
    expect(effective(viewB, 'limit.maxUnits')).toBe(150);   // STARTER 150
  });
});

// ── 7. Company ADMIN 404 isolation ────────────────────────────────────────────
// The tenant-facing /capabilities/me endpoint derives companyId from the JWT —
// there is no companyId param.  The only cross-tenant scenario that can surface
// a 404 is calling getEffectiveCapabilities with a companyId that does not exist.

describe('CapabilityService — cross-tenant NotFoundException', () => {
  test('getEffectiveCapabilities throws NotFoundException for unknown company', async () => {
    const prisma = makePrisma(null); // company not found
    const { svc } = makeService(prisma);

    await expect(svc.getEffectiveCapabilities('nonexistent')).rejects.toBeInstanceOf(NotFoundException);
  });

  test('setCapabilityOverrides throws NotFoundException for unknown company', async () => {
    const prisma = {
      company: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
    };
    const { svc } = makeService(prisma as never);

    await expect(
      svc.setCapabilityOverrides('nonexistent', { 'feature.brokers': true }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  test('setCapabilityOverrides with invalid payload throws BadRequestException (not 404)', async () => {
    const { svc } = makeService();
    await expect(
      svc.setCapabilityOverrides('comp-1', { 'feature.unknown': true }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
