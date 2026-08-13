import {
  runTenantContext,
  getTenantContext,
  requireTenantContext,
  getRequiredCompanyId,
  type TenantContext,
} from '../tenant-context';
import { MissingTenantContextError } from '../tenant-context.errors';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ctxA(): TenantContext {
  return { companyId: 'company-A', bypass: false, isPublic: false };
}

function ctxB(): TenantContext {
  return { companyId: 'company-B', bypass: false, isPublic: false };
}

// Pause for `ms` milliseconds without leaving the current async context.
function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Tests 1–2: basic context retrieval
// ---------------------------------------------------------------------------

describe('TenantContext — basic retrieval', () => {
  it('1. runTenantContext with company A returns company A companyId', async () => {
    await runTenantContext(ctxA(), async () => {
      expect(getTenantContext()?.companyId).toBe('company-A');
      expect(getRequiredCompanyId()).toBe('company-A');
    });
  });

  it('2. runTenantContext with company B returns company B companyId', async () => {
    await runTenantContext(ctxB(), async () => {
      expect(getTenantContext()?.companyId).toBe('company-B');
      expect(getRequiredCompanyId()).toBe('company-B');
    });
  });
});

// ---------------------------------------------------------------------------
// Tests 3–4: fail-closed behaviour
// ---------------------------------------------------------------------------

describe('TenantContext — fail-closed', () => {
  it('3. getTenantContext outside any run returns undefined; requireTenantContext throws', () => {
    // There is no active runTenantContext wrapping this test body.
    expect(getTenantContext()).toBeUndefined();
    expect(() => requireTenantContext()).toThrow(MissingTenantContextError);
  });

  it('4. companyId=null with bypass=false causes requireTenantContext and getRequiredCompanyId to throw', async () => {
    const invalidCtx: TenantContext = { companyId: null, bypass: false, isPublic: false };
    await runTenantContext(invalidCtx, async () => {
      // getTenantContext returns the raw context (no validation)
      expect(getTenantContext()?.companyId).toBeNull();

      // requireTenantContext validates and throws
      expect(() => requireTenantContext()).toThrow(MissingTenantContextError);

      // getRequiredCompanyId also throws
      expect(() => getRequiredCompanyId()).toThrow(MissingTenantContextError);
    });
  });
});

// ---------------------------------------------------------------------------
// Tests 5–6: bypass and public context
// ---------------------------------------------------------------------------

describe('TenantContext — bypass and public contexts', () => {
  it('5. bypass=true with null companyId is a valid platform context', async () => {
    const bypassCtx: TenantContext = { companyId: null, bypass: true, isPublic: false };
    await runTenantContext(bypassCtx, async () => {
      // requireTenantContext does NOT throw in bypass mode
      const ctx = requireTenantContext();
      expect(ctx.bypass).toBe(true);
      expect(ctx.companyId).toBeNull();
    });
  });

  it('5b. getRequiredCompanyId throws in bypass mode (use requireTenantContext instead)', async () => {
    const bypassCtx: TenantContext = { companyId: null, bypass: true, isPublic: false };
    await runTenantContext(bypassCtx, async () => {
      expect(() => getRequiredCompanyId()).toThrow(MissingTenantContextError);
    });
  });

  it('6. isPublic context carries correct flags', async () => {
    // The actual companyId will later be loaded from DEVORA_DEFAULT_COMPANY_ID.
    // For this proof we use a placeholder string.
    const publicCtx: TenantContext = { companyId: 'default-company', bypass: false, isPublic: true };
    await runTenantContext(publicCtx, async () => {
      const ctx = requireTenantContext();
      expect(ctx.isPublic).toBe(true);
      expect(ctx.bypass).toBe(false);
      expect(ctx.companyId).toBe('default-company');
    });
  });
});

// ---------------------------------------------------------------------------
// Tests 7–9: async propagation and context lifecycle
// ---------------------------------------------------------------------------

describe('TenantContext — async propagation and lifecycle', () => {
  it('7. context is retained through deeply nested async calls', async () => {
    await runTenantContext(ctxA(), async () => {
      async function level1(): Promise<string> {
        await delay(0);
        return level2();
      }
      async function level2(): Promise<string> {
        await Promise.resolve();
        return level3();
      }
      async function level3(): Promise<string> {
        await delay(0);
        return getRequiredCompanyId();
      }

      expect(await level1()).toBe('company-A');
    });
  });

  it('8. inner runTenantContext shadows outer; outer is restored after inner completes', async () => {
    await runTenantContext(ctxA(), async () => {
      expect(getRequiredCompanyId()).toBe('company-A');

      await runTenantContext(ctxB(), async () => {
        // Inner context is company B
        expect(getRequiredCompanyId()).toBe('company-B');
        await delay(1);
        expect(getRequiredCompanyId()).toBe('company-B');
      });

      // After inner resolves, outer context is restored
      expect(getRequiredCompanyId()).toBe('company-A');
    });
  });

  it('9. context is not accessible after runTenantContext resolves', async () => {
    let wasSetInsideRun = false;

    await runTenantContext(ctxA(), async () => {
      wasSetInsideRun = true;
      expect(getTenantContext()?.companyId).toBe('company-A');
    });

    expect(wasSetInsideRun).toBe(true);
    // After the run: no context
    expect(getTenantContext()).toBeUndefined();
    expect(() => requireTenantContext()).toThrow(MissingTenantContextError);
    expect(() => getRequiredCompanyId()).toThrow(MissingTenantContextError);
  });
});

// ---------------------------------------------------------------------------
// Test 10: concurrent isolation (20 A + 20 B)
// ---------------------------------------------------------------------------

describe('TenantContext — concurrent isolation', () => {
  it(
    '10. 20 company-A and 20 company-B contexts run concurrently with no cross-context leaks',
    async () => {
      const results: Array<{ expected: string; actual: string }> = [];

      /**
       * Deterministic staggered delays (multiples of 2 ms) ensure that
       * promises interleave across the event loop but the test remains stable.
       */
      function runOne(companyId: string, delayMs: number): Promise<void> {
        return runTenantContext(
          { companyId, bypass: false, isPublic: false },
          async () => {
            // First checkpoint
            results.push({ expected: companyId, actual: getRequiredCompanyId() });
            await delay(delayMs);
            // Second checkpoint after an async yield
            results.push({ expected: companyId, actual: getRequiredCompanyId() });
          },
        );
      }

      const aTasks = Array.from({ length: 20 }, (_, i) => runOne('company-A', (i % 5) * 2));
      const bTasks = Array.from({ length: 20 }, (_, i) => runOne('company-B', (i % 5) * 2));

      await Promise.all([...aTasks, ...bTasks]);

      // 40 tasks × 2 checkpoints each = 80 observations
      expect(results).toHaveLength(80);

      const leaks = results.filter((r) => r.actual !== r.expected);
      expect(leaks).toHaveLength(0);
    },
  );
});
