import {
  applyReadPolicy,
  applyCreatePolicy,
  applyCreateManyPolicy,
  PROVISIONAL_SCOPED_MODELS_FOR_POLICY_TEST,
  type TenantQueryPolicyOptions,
} from '../tenant-query-policy';
import { runTenantContext } from '../../tenant/tenant-context';
import { MissingTenantContextError, TenantScopeViolationError } from '../../tenant/tenant-context.errors';

// ---------------------------------------------------------------------------
// Shared opts — use the provisional set exactly as it ships
// ---------------------------------------------------------------------------

const opts: TenantQueryPolicyOptions = {
  scopedModels: PROVISIONAL_SCOPED_MODELS_FOR_POLICY_TEST,
};

// ---------------------------------------------------------------------------
// Tests 11–13: read policy
// ---------------------------------------------------------------------------

describe('TenantQueryPolicy — read policy (applyReadPolicy)', () => {
  it('11. applyReadPolicy injects companyId when no where clause is present', async () => {
    await runTenantContext({ companyId: 'company-A', bypass: false, isPublic: false }, async () => {
      const result = applyReadPolicy('lead', {}, opts);
      expect(result.where).toEqual({ companyId: 'company-A' });
    });
  });

  it('12. existing where conditions are preserved alongside the injected companyId', async () => {
    await runTenantContext({ companyId: 'company-A', bypass: false, isPublic: false }, async () => {
      const args = { where: { status: 'active', name: 'test' } };
      const result = applyReadPolicy('lead', args, opts);
      // Spread-merge: companyId is added alongside existing conditions.
      // SQL equivalent: WHERE status='active' AND name='test' AND companyId='company-A'
      expect(result.where).toEqual({ status: 'active', name: 'test', companyId: 'company-A' });
    });
  });

  it(
    '13. caller-supplied companyId cannot override context — spread-merge ensures context companyId ' +
      'always overwrites the caller-supplied value (last write wins in JS spread)',
    async () => {
      await runTenantContext({ companyId: 'company-A', bypass: false, isPublic: false }, async () => {
        const args = { where: { companyId: 'company-EVIL', status: 'active' } };
        const result = applyReadPolicy('lead', args, opts);

        // Context companyId overwrites caller-supplied value.
        expect((result.where as Record<string, unknown>).companyId).toBe('company-A');

        // The full structure: companyId is correct, other conditions are preserved.
        expect(result.where).toEqual({ companyId: 'company-A', status: 'active' });
      });
    },
  );
});

// ---------------------------------------------------------------------------
// Tests 14–15: create policy
// ---------------------------------------------------------------------------

describe('TenantQueryPolicy — create policy (applyCreatePolicy)', () => {
  it('14. applyCreatePolicy injects companyId from context into data', async () => {
    await runTenantContext({ companyId: 'company-A', bypass: false, isPublic: false }, async () => {
      const args = { data: { name: 'test lead', email: 'lead@example.com' } };
      const result = applyCreatePolicy('lead', args, opts);
      expect(result.data.companyId).toBe('company-A');
      // Original fields are preserved
      expect(result.data.name).toBe('test lead');
      expect(result.data.email).toBe('lead@example.com');
    });
  });

  it('15. applyCreatePolicy throws TenantScopeViolationError when caller supplies a conflicting companyId', async () => {
    await runTenantContext({ companyId: 'company-A', bypass: false, isPublic: false }, async () => {
      const args = { data: { companyId: 'company-EVIL', name: 'injected lead' } };
      expect(() => applyCreatePolicy('lead', args, opts)).toThrow(TenantScopeViolationError);
    });
  });
});

// ---------------------------------------------------------------------------
// Tests 16–17: createMany policy
// ---------------------------------------------------------------------------

describe('TenantQueryPolicy — createMany policy (applyCreateManyPolicy)', () => {
  it('16. applyCreateManyPolicy scopes every record in the batch', async () => {
    await runTenantContext({ companyId: 'company-A', bypass: false, isPublic: false }, async () => {
      const args = {
        data: [{ name: 'lead 1' }, { name: 'lead 2' }, { name: 'lead 3' }],
      };
      const result = applyCreateManyPolicy('lead', args, opts);
      expect(result.data).toHaveLength(3);
      result.data.forEach((record) => {
        expect(record.companyId).toBe('company-A');
      });
      // Original fields preserved
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(result.data[0]!.name).toBe('lead 1');
    });
  });

  it('17. applyCreateManyPolicy rejects the entire batch when a single record has a conflicting companyId', async () => {
    await runTenantContext({ companyId: 'company-A', bypass: false, isPublic: false }, async () => {
      const args = {
        data: [
          { name: 'lead 1' },
          { name: 'lead 2', companyId: 'company-EVIL' }, // conflicting at index 1
          { name: 'lead 3' },
        ],
      };
      expect(() => applyCreateManyPolicy('lead', args, opts)).toThrow(TenantScopeViolationError);
    });
  });
});

// ---------------------------------------------------------------------------
// Tests 18–19: bypass and non-scoped model pass-through
// ---------------------------------------------------------------------------

describe('TenantQueryPolicy — bypass and non-scoped models', () => {
  it('18. bypass context passes args through unchanged for all operation types', async () => {
    await runTenantContext({ companyId: null, bypass: true, isPublic: false }, async () => {
      const readArgs = { where: { status: 'active' } };
      expect(applyReadPolicy('lead', readArgs, opts)).toEqual(readArgs);

      const createArgs = { data: { name: 'platform lead' } };
      expect(applyCreatePolicy('lead', createArgs, opts)).toEqual(createArgs);

      const createManyArgs = { data: [{ name: 'platform lead 1' }, { name: 'platform lead 2' }] };
      expect(applyCreateManyPolicy('lead', createManyArgs, opts)).toEqual(createManyArgs);
    });
  });

  it('19. non-tenant model args pass through unchanged regardless of active context', async () => {
    await runTenantContext({ companyId: 'company-A', bypass: false, isPublic: false }, async () => {
      // 'user' is intentionally absent from PROVISIONAL_SCOPED_MODELS_FOR_POLICY_TEST
      const readArgs = { where: { id: 'user-123' } };
      expect(applyReadPolicy('user', readArgs, opts)).toEqual(readArgs);

      const createArgs = { data: { email: 'staff@example.com', role: 'ADMIN' } };
      expect(applyCreatePolicy('user', createArgs, opts)).toEqual(createArgs);

      const createManyArgs = { data: [{ email: 'a@b.com' }, { email: 'c@d.com' }] };
      expect(applyCreateManyPolicy('user', createManyArgs, opts)).toEqual(createManyArgs);
    });
  });
});

// ---------------------------------------------------------------------------
// Test 20: fail-closed — no context → error, never silent pass-through
// ---------------------------------------------------------------------------

describe('TenantQueryPolicy — fail-closed (no context)', () => {
  it(
    '20. all three policy functions throw MissingTenantContextError for a scoped model ' +
      'when no tenant context is active',
    () => {
      // This test body is intentionally NOT wrapped in runTenantContext.
      // It simulates a request that reached business code without the
      // TenantContextInterceptor running — the policy must reject, not pass through.
      expect(() => applyReadPolicy('lead', { where: { id: '1' } }, opts)).toThrow(
        MissingTenantContextError,
      );
      expect(() => applyCreatePolicy('lead', { data: { name: 'x' } }, opts)).toThrow(
        MissingTenantContextError,
      );
      expect(() => applyCreateManyPolicy('lead', { data: [{ name: 'x' }] }, opts)).toThrow(
        MissingTenantContextError,
      );
    },
  );
});
