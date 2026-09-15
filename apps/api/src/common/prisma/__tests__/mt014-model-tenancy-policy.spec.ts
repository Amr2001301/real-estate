/**
 * MT-014 — MODEL_TENANCY active policy tests.
 *
 * Covers:
 *  1. Equivalence: TENANT_SCOPED_MODELS ↔ MODEL_TENANCY TENANT_OWNED
 *  2. getModelTier — runtime fail-closed guard
 *  3. TENANT_OWNED models get companyId injected (findMany, create, upsert)
 *  4. TENANT_CONTROLLED (User) → NO automatic injection
 *  5. TENANT_VIA_RELATION → NO automatic injection
 *  6. PLATFORM_GLOBAL → NO automatic injection
 *  7. Bypass semantics preserved for TENANT_OWNED
 *  8. TenantScopeViolationError on conflicting companyId (create)
 *  9. MissingTenantContextError when no context for TENANT_OWNED
 * 10. Unclassified model → getModelTier throws
 *
 * Raw SQL and nested writes remain manual responsibility (documented below).
 */

import {
  MODEL_TIER_BY_LOWERCASE,
  getModelTier,
  applyReadPolicy,
  applyCreatePolicy,
  applyCreateManyPolicy,
  PROVISIONAL_SCOPED_MODELS_FOR_POLICY_TEST,
} from '../tenant-query-policy';
// Carry-forward B: legacy set moved to test-only fixture; no production import
import { TENANT_SCOPED_MODELS_LEGACY as TENANT_SCOPED_MODELS } from './fixtures/legacy-tenant-scoped-models.fixture';
import { MODEL_TENANCY } from '../model-tenancy';
import { runTenantContext } from '../../tenant/tenant-context';
import { MissingTenantContextError, TenantScopeViolationError } from '../../tenant/tenant-context.errors';

// ---------------------------------------------------------------------------
// 1. Equivalence: TENANT_SCOPED_MODELS ↔ MODEL_TENANCY TENANT_OWNED
// ---------------------------------------------------------------------------

describe('MT-014 equivalence: TENANT_SCOPED_MODELS ↔ MODEL_TENANCY TENANT_OWNED', () => {
  // Build the "ground truth" TENANT_OWNED set in lowercase from MODEL_TENANCY
  const ownedFromModelTenancy = new Set(
    Object.entries(MODEL_TENANCY)
      .filter(([, tier]) => tier === 'TENANT_OWNED')
      .map(([name]) => name.toLowerCase()),
  );

  it('every TENANT_SCOPED_MODELS entry is classified TENANT_OWNED in MODEL_TENANCY', () => {
    const notOwned: string[] = [];
    for (const model of TENANT_SCOPED_MODELS) {
      if (!ownedFromModelTenancy.has(model)) {
        notOwned.push(model);
      }
    }
    // Any entry here is a mis-classification — STOP and investigate.
    expect(notOwned).toEqual([]);
  });

  it('every MODEL_TENANCY TENANT_OWNED model was covered by TENANT_SCOPED_MODELS', () => {
    const missing: string[] = [];
    for (const model of ownedFromModelTenancy) {
      if (!TENANT_SCOPED_MODELS.has(model)) {
        missing.push(model);
      }
    }
    // Any entry here is an unintentional new addition — must be documented.
    expect(missing).toEqual([]);
  });

  it('both sets have the same cardinality (50 models after Step A + Step C + Step D1 ContractCancellation/Refund)', () => {
    expect(TENANT_SCOPED_MODELS.size).toBe(50);
    expect(ownedFromModelTenancy.size).toBe(50);
  });

  it('MODEL_TIER_BY_LOWERCASE includes all TENANT_OWNED models with correct tier', () => {
    for (const model of TENANT_SCOPED_MODELS) {
      expect(MODEL_TIER_BY_LOWERCASE.get(model)).toBe('TENANT_OWNED');
    }
  });
});

// ---------------------------------------------------------------------------
// 2. getModelTier — runtime fail-closed guard
// ---------------------------------------------------------------------------

describe('MT-014 getModelTier — runtime fail-closed', () => {
  it('returns TENANT_OWNED for a known owned model (project)', () => {
    expect(getModelTier('project')).toBe('TENANT_OWNED');
  });

  it('returns TENANT_CONTROLLED for user', () => {
    expect(getModelTier('user')).toBe('TENANT_CONTROLLED');
  });

  it('returns PLATFORM_GLOBAL for company', () => {
    expect(getModelTier('company')).toBe('PLATFORM_GLOBAL');
  });

  it('returns TENANT_VIA_RELATION for refreshtoken', () => {
    expect(getModelTier('refreshtoken')).toBe('TENANT_VIA_RELATION');
  });

  it('throws a clear error for an unclassified model', () => {
    expect(() => getModelTier('someunknownmodel')).toThrow(
      '[MT-014] Unclassified Prisma model',
    );
    expect(() => getModelTier('someunknownmodel')).toThrow('someunknownmodel');
  });

  it('throw message instructs to add to MODEL_TENANCY', () => {
    expect(() => getModelTier('ghostmodel')).toThrow('model-tenancy.ts');
  });
});

// ---------------------------------------------------------------------------
// 3. TENANT_OWNED: companyId injection via existing policy functions
// Tests use PROVISIONAL_SCOPED_MODELS_FOR_POLICY_TEST (the existing unit-test
// fixture) to avoid importing real DB models — behavior is identical.
// For the middleware path, the apply* functions receive TENANT_OWNED_SET.
// ---------------------------------------------------------------------------

const OWNED_OPTS = { scopedModels: PROVISIONAL_SCOPED_MODELS_FOR_POLICY_TEST };

describe('MT-014 TENANT_OWNED policy — findMany (applyReadPolicy)', () => {
  it('injects companyId when no where clause present', async () => {
    await runTenantContext({ companyId: 'company-A', bypass: false, isPublic: false }, async () => {
      const result = applyReadPolicy('lead', {}, OWNED_OPTS);
      expect(result.where).toEqual({ companyId: 'company-A' });
    });
  });

  it('merges companyId with existing where clause', async () => {
    await runTenantContext({ companyId: 'company-A', bypass: false, isPublic: false }, async () => {
      const result = applyReadPolicy('lead', { where: { active: true } }, OWNED_OPTS);
      expect(result.where).toEqual({ active: true, companyId: 'company-A' });
    });
  });

  it('context companyId wins over caller-supplied companyId', async () => {
    await runTenantContext({ companyId: 'company-A', bypass: false, isPublic: false }, async () => {
      const result = applyReadPolicy('lead', { where: { companyId: 'company-B' } }, OWNED_OPTS);
      expect(result.where!.companyId).toBe('company-A');
    });
  });

  it('does NOT inject for a non-scoped model (update/delete pass-through)', async () => {
    await runTenantContext({ companyId: 'company-A', bypass: false, isPublic: false }, async () => {
      // 'contract' is in PROVISIONAL_SCOPED_MODELS — testing a NON-scoped label
      const result = applyReadPolicy('nonexistentmodel', {}, OWNED_OPTS);
      expect(result.where).toBeUndefined();
    });
  });
});

describe('MT-014 TENANT_OWNED policy — create (applyCreatePolicy)', () => {
  it('injects companyId when not provided', async () => {
    await runTenantContext({ companyId: 'company-A', bypass: false, isPublic: false }, async () => {
      const result = applyCreatePolicy('lead', { data: { name: 'New Lead' } }, OWNED_OPTS);
      expect(result.data.companyId).toBe('company-A');
    });
  });

  it('accepts matching companyId (idempotent)', async () => {
    await runTenantContext({ companyId: 'company-A', bypass: false, isPublic: false }, async () => {
      const result = applyCreatePolicy('lead', { data: { companyId: 'company-A' } }, OWNED_OPTS);
      expect(result.data.companyId).toBe('company-A');
    });
  });

  it('throws TenantScopeViolationError for conflicting companyId', async () => {
    await runTenantContext({ companyId: 'company-A', bypass: false, isPublic: false }, async () => {
      expect(() =>
        applyCreatePolicy('lead', { data: { companyId: 'company-B' } }, OWNED_OPTS),
      ).toThrow(TenantScopeViolationError);
    });
  });
});

describe('MT-014 TENANT_OWNED policy — createMany (applyCreateManyPolicy)', () => {
  it('injects companyId into every record', async () => {
    await runTenantContext({ companyId: 'company-A', bypass: false, isPublic: false }, async () => {
      const result = applyCreateManyPolicy('lead', { data: [{ name: 'L1' }, { name: 'L2' }] }, OWNED_OPTS);
      for (const item of result.data) {
        expect(item.companyId).toBe('company-A');
      }
    });
  });

  it('rejects a batch where any record has conflicting companyId', async () => {
    await runTenantContext({ companyId: 'company-A', bypass: false, isPublic: false }, async () => {
      expect(() =>
        applyCreateManyPolicy('lead', { data: [{ companyId: 'company-B' }] }, OWNED_OPTS),
      ).toThrow(TenantScopeViolationError);
    });
  });
});

describe('MT-014 TENANT_OWNED policy — no context → MissingTenantContextError', () => {
  it('applyReadPolicy throws when no context for a scoped model', () => {
    // Running outside runTenantContext → no ALS store
    expect(() => applyReadPolicy('lead', {}, OWNED_OPTS)).toThrow(MissingTenantContextError);
  });

  it('applyCreatePolicy throws when no context for a scoped model', () => {
    expect(() => applyCreatePolicy('lead', { data: {} }, OWNED_OPTS)).toThrow(MissingTenantContextError);
  });
});

// ---------------------------------------------------------------------------
// 4. TENANT_CONTROLLED — User: middleware must NOT auto-inject companyId
// ---------------------------------------------------------------------------

describe('MT-014 TENANT_CONTROLLED (User) — no automatic companyId injection', () => {
  const USER_OPTS = { scopedModels: new Set<string>() }; // user is NOT in the scoped set

  it('applyReadPolicy passes through unchanged for user (not in scopedModels)', async () => {
    await runTenantContext({ companyId: 'company-A', bypass: false, isPublic: false }, async () => {
      const input = { where: { email: 'test@example.com' } };
      const result = applyReadPolicy('user', input, USER_OPTS);
      // No companyId injected — where remains as provided
      expect(result.where).not.toHaveProperty('companyId');
      expect(result.where).toEqual({ email: 'test@example.com' });
    });
  });

  it('applyCreatePolicy passes through unchanged for user (not in scopedModels)', async () => {
    await runTenantContext({ companyId: 'company-A', bypass: false, isPublic: false }, async () => {
      const input = { data: { email: 'test@example.com', role: 'SALES' } };
      const result = applyCreatePolicy('user', input, USER_OPTS);
      // No companyId auto-injected — service layer is responsible
      expect(result.data).not.toHaveProperty('companyId');
    });
  });

  it('MODEL_TENANCY classifies User as TENANT_CONTROLLED (not TENANT_OWNED)', () => {
    expect(MODEL_TENANCY['User']).toBe('TENANT_CONTROLLED');
    expect(getModelTier('user')).toBe('TENANT_CONTROLLED');
    // Therefore User is NOT in TENANT_OWNED_MODELS and gets no auto-injection
    expect(MODEL_TIER_BY_LOWERCASE.get('user')).not.toBe('TENANT_OWNED');
  });
});

// ---------------------------------------------------------------------------
// 5. TENANT_VIA_RELATION — no companyId injection (no column)
// ---------------------------------------------------------------------------

describe('MT-014 TENANT_VIA_RELATION — no direct companyId injection', () => {
  const VIA_RELATION_OPTS = { scopedModels: new Set<string>() }; // not in scoped set

  it.each(['refreshtoken', 'passwordresettoken', 'emailverificationtoken', 'devicetoken'])(
    '%s is TENANT_VIA_RELATION — no companyId injected',
    async (model) => {
      await runTenantContext({ companyId: 'company-A', bypass: false, isPublic: false }, async () => {
        const result = applyReadPolicy(model, { where: { userId: 'u-1' } }, VIA_RELATION_OPTS);
        expect(result.where).not.toHaveProperty('companyId');
        expect(MODEL_TIER_BY_LOWERCASE.get(model)).toBe('TENANT_VIA_RELATION');
      });
    },
  );

  it('userPermission is TENANT_VIA_RELATION', () => {
    expect(getModelTier('userpermission')).toBe('TENANT_VIA_RELATION');
  });

  it('favorite is TENANT_VIA_RELATION', () => {
    expect(getModelTier('favorite')).toBe('TENANT_VIA_RELATION');
  });
});

// ---------------------------------------------------------------------------
// 6. PLATFORM_GLOBAL — no injection
// ---------------------------------------------------------------------------

describe('MT-014 PLATFORM_GLOBAL — no automatic companyId injection', () => {
  const GLOBAL_OPTS = { scopedModels: new Set<string>() };

  // OtpCode was PLATFORM_GLOBAL; reclassified to TENANT_CONTROLLED in MT-030.
  it.each(['company', 'permission', 'pricingpackage'])(
    '%s is PLATFORM_GLOBAL — passes through unchanged',
    async (model) => {
      await runTenantContext({ companyId: 'company-A', bypass: false, isPublic: false }, async () => {
        const result = applyReadPolicy(model, { where: { id: 'some-id' } }, GLOBAL_OPTS);
        expect(result.where).not.toHaveProperty('companyId');
        expect(MODEL_TIER_BY_LOWERCASE.get(model)).toBe('PLATFORM_GLOBAL');
      });
    },
  );

  it('otpcode is TENANT_CONTROLLED (reclassified MT-030)', () => {
    expect(MODEL_TIER_BY_LOWERCASE.get('otpcode')).toBe('TENANT_CONTROLLED');
  });
});

// ---------------------------------------------------------------------------
// 7. Bypass semantics — TENANT_OWNED with bypass=true passes through
// ---------------------------------------------------------------------------

describe('MT-014 bypass semantics — TENANT_OWNED pass-through in bypass mode', () => {
  it('applyReadPolicy does NOT inject companyId in bypass mode', async () => {
    await runTenantContext({ companyId: null, bypass: true, isPublic: false }, async () => {
      const result = applyReadPolicy('lead', { where: { id: 'any' } }, OWNED_OPTS);
      // bypass → no injection
      expect(result.where).not.toHaveProperty('companyId');
    });
  });

  it('applyCreatePolicy does NOT inject companyId in bypass mode', async () => {
    await runTenantContext({ companyId: null, bypass: true, isPublic: false }, async () => {
      const result = applyCreatePolicy('lead', { data: { name: 'X' } }, OWNED_OPTS);
      expect(result.data).not.toHaveProperty('companyId');
    });
  });

  it('applyCreateManyPolicy does NOT inject in bypass mode', async () => {
    await runTenantContext({ companyId: null, bypass: true, isPublic: false }, async () => {
      const result = applyCreateManyPolicy('lead', { data: [{ name: 'X' }] }, OWNED_OPTS);
      expect(result.data[0]).not.toHaveProperty('companyId');
    });
  });
});

// ---------------------------------------------------------------------------
// 8. MODEL_TIER_BY_LOWERCASE completeness
// ---------------------------------------------------------------------------

describe('MT-014 MODEL_TIER_BY_LOWERCASE derived set', () => {
  it('contains all 61 models from MODEL_TENANCY', () => {
    expect(MODEL_TIER_BY_LOWERCASE.size).toBe(Object.keys(MODEL_TENANCY).length);
  });

  it('keys are all lowercase', () => {
    for (const key of MODEL_TIER_BY_LOWERCASE.keys()) {
      expect(key).toBe(key.toLowerCase());
    }
  });

  it('TENANT_OWNED count matches TENANT_SCOPED_MODELS count (50 after Step A + Step C + Step D1)', () => {
    const ownedCount = [...MODEL_TIER_BY_LOWERCASE.values()].filter((t) => t === 'TENANT_OWNED').length;
    expect(ownedCount).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// Raw SQL & nested writes — documented gap (not tested, not implemented in MT-014)
// ---------------------------------------------------------------------------

/**
 * KNOWN REMAINING SECURITY GAPS after MT-014:
 *
 * 1. Raw SQL ($queryRaw / $executeRaw):
 *    These operations bypass the Prisma model middleware entirely. No companyId
 *    is automatically injected. Every $queryRaw caller must include explicit
 *    WHERE companyId = $1. ESLint rule (MT-016) blocks $queryRawUnsafe.
 *    Future audit ticket: [assigned in MT-plan, raw SQL audit phase].
 *
 * 2. Nested relation writes (nested connect / create):
 *    Prisma middleware sees the top-level model operation only. A nested
 *    `create` inside a relation (e.g. `lead.create { data: { notes: { create: {} } } }`)
 *    does NOT pass through the middleware for the nested model. Each nested
 *    write must be audited manually. MODEL_TENANCY classification does NOT
 *    imply that nested writes are automatically secure.
 *
 * 3. Relation includes (select: { notes: true }):
 *    Read-only; no data injection. No security impact here.
 */
