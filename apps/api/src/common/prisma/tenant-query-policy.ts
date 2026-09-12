/**
 * Tenant Query Policy — argument-transformation functions used by the live
 * Prisma middleware in PrismaService.
 *
 * STATUS (as of MT-015/MT-014):
 *   - Middleware IS wired to the production PrismaClient via $use() in
 *     PrismaService.onModuleInit. All TENANT_OWNED model reads/writes are
 *     automatically scoped.
 *   - The schema DOES have companyId columns on all TENANT_OWNED models.
 *   - User is TENANT_CONTROLLED: the middleware passes User queries through
 *     unchanged. Every UsersService method must enforce companyId isolation
 *     explicitly.
 *   - Raw SQL ($queryRaw / $executeRaw) is completely outside this layer.
 *   - Nested Prisma relation writes (nested connect / create) are NOT
 *     automatically scoped. Each nested write must be audited separately.
 *   - Relation includes are not affected by this injection (read-only shape).
 *   - MODEL_TENANCY (model-tenancy.ts) is the authoritative five-tier
 *     classification; the middleware derives its active TENANT_OWNED set from
 *     it at startup (see prisma.service.ts TENANT_OWNED_MODELS).
 *
 * Type note: query args are typed as Record<string, unknown> because Prisma
 * middleware params use a generic args type. This is intentional at this layer.
 */

import { getTenantContext } from '../tenant/tenant-context';
import { MissingTenantContextError, TenantScopeViolationError } from '../tenant/tenant-context.errors';
import { MODEL_TENANCY, ModelTenancyTier } from './model-tenancy';

// ---------------------------------------------------------------------------
// Model set
// ---------------------------------------------------------------------------

/**
 * Small subset used only in policy unit tests.
 * The authoritative production set is derived from MODEL_TENANCY in
 * prisma.service.ts (TENANT_OWNED_MODELS).
 */
export const PROVISIONAL_SCOPED_MODELS_FOR_POLICY_TEST = new Set([
  'lead',
  'project',
  'unit',
  'reservation',
  'contract',
  'deposit',
]);

// ---------------------------------------------------------------------------
// MT-014 — MODEL_TENANCY-based classification lookup
// ---------------------------------------------------------------------------

/**
 * Lowercase → tier lookup derived at module load time from MODEL_TENANCY.
 * Prisma middleware receives model names in lowercase camelCase (params.model);
 * MODEL_TENANCY uses PascalCase (the canonical Prisma DMMF name). This map
 * bridges the two without duplicating the classification.
 *
 * Example: 'project' → 'TENANT_OWNED', 'user' → 'TENANT_CONTROLLED'
 *
 * Built once at startup; read-only at runtime.
 */
export const MODEL_TIER_BY_LOWERCASE: ReadonlyMap<string, ModelTenancyTier> = new Map(
  Object.entries(MODEL_TENANCY).map(([name, tier]) => [name.toLowerCase(), tier]),
);

/**
 * Resolve the MODEL_TENANCY tier for a Prisma middleware model key (lowercase).
 *
 * Throws a clear error if the model is not classified — defense-in-depth on
 * top of the boot assertion. The boot assertion is the primary prevention;
 * this guard catches any dynamic dispatch that somehow bypasses it.
 */
export function getModelTier(modelKey: string): ModelTenancyTier {
  const tier = MODEL_TIER_BY_LOWERCASE.get(modelKey);
  if (tier === undefined) {
    throw new Error(
      `[MT-014] Unclassified Prisma model '${modelKey}' reached the tenant middleware. ` +
        'Add it to MODEL_TENANCY in model-tenancy.ts. ' +
        'This is a security error — unclassified models must never reach production data access.',
    );
  }
  return tier;
}

// ---------------------------------------------------------------------------
// Policy options
// ---------------------------------------------------------------------------

export interface TenantQueryPolicyOptions {
  /**
   * The set of Prisma model names (lowercase camelCase as used in the Prisma
   * client accessor) that carry a companyId column and require tenant scoping.
   */
  scopedModels: Set<string>;
}

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

type GenericArgs = Record<string, unknown>;

/**
 * Resolves the companyId that should be injected for a given model and
 * the current ALS context. Returns null when no injection is needed
 * (non-scoped model or bypass mode).
 *
 * Throws MissingTenantContextError when context is required but absent
 * or invalid — the operation is rejected, not silently unscoped.
 */
function resolveInjectionCompanyId(
  modelKey: string,
  opts: TenantQueryPolicyOptions,
): string | null {
  if (!opts.scopedModels.has(modelKey)) return null;

  const ctx = getTenantContext();

  if (!ctx) {
    throw new MissingTenantContextError(
      `No tenant context active for scoped model '${modelKey}'`,
    );
  }

  // Bypass = explicit platform operation. Pass args through unchanged.
  if (ctx.bypass) return null;

  if (ctx.companyId === null) {
    throw new MissingTenantContextError(
      `Tenant context has null companyId without bypass — operation on '${modelKey}' rejected`,
    );
  }

  return ctx.companyId;
}

// ---------------------------------------------------------------------------
// Read policy
// ---------------------------------------------------------------------------

/**
 * Applies tenant scope to read-operation args.
 *
 * Covers: findMany, findFirst, findUnique, findUniqueOrThrow, findFirstOrThrow,
 *         count, aggregate, groupBy, update, updateMany, delete, deleteMany.
 *
 * Injection strategy: spread-merge. The context companyId is merged into the
 * WHERE object at the top level, overwriting any caller-supplied companyId.
 * This handles every Prisma read operation correctly, including findUnique
 * (which requires the unique field — e.g. `id` — to remain at the top level,
 * not nested inside AND). The merged shape is always:
 *
 *   { ...callerWhere, companyId: <context-companyId> }
 *
 * Security properties:
 *   - If caller supplies no companyId: the context companyId is injected.
 *   - If caller supplies the CORRECT companyId: it is overwritten with the
 *     same value (idempotent, no error thrown).
 *   - If caller supplies a DIFFERENT companyId: the context companyId
 *     overwrites it (context always wins — no wrong-company data returned).
 *
 * For complex top-level OR/AND clauses the injected companyId becomes an
 * additional top-level AND condition (SQL: (OR/AND clause) AND companyId='…').
 */
export function applyReadPolicy(
  modelKey: string,
  args: GenericArgs & { where?: GenericArgs },
  opts: TenantQueryPolicyOptions,
): GenericArgs & { where?: GenericArgs } {
  const companyId = resolveInjectionCompanyId(modelKey, opts);
  if (companyId === null) return args;

  const existing = args.where as GenericArgs | undefined;

  return {
    ...args,
    where: { ...existing, companyId },
  };
}

// ---------------------------------------------------------------------------
// Create policy
// ---------------------------------------------------------------------------

/**
 * Applies tenant scope to create args.
 *
 * Injects companyId from the active context. Throws TenantScopeViolationError
 * if the caller explicitly supplies a different companyId — ownership must
 * never be caller-controlled for write operations.
 *
 * Callers that supply the same companyId as the context are accepted
 * (idempotent injection).
 */
export function applyCreatePolicy(
  modelKey: string,
  args: GenericArgs & { data: GenericArgs },
  opts: TenantQueryPolicyOptions,
): GenericArgs & { data: GenericArgs } {
  const companyId = resolveInjectionCompanyId(modelKey, opts);
  if (companyId === null) return args;

  const data = args.data as GenericArgs;

  if ('companyId' in data && data.companyId !== companyId) {
    throw new TenantScopeViolationError(
      `create on '${modelKey}': caller-supplied companyId ('${String(data.companyId)}') ` +
        `conflicts with active tenant context ('${companyId}')`,
    );
  }

  return { ...args, data: { ...data, companyId } };
}

// ---------------------------------------------------------------------------
// CreateMany policy
// ---------------------------------------------------------------------------

/**
 * Applies tenant scope to createMany args.
 *
 * Every record in data[] receives the context companyId. If any single record
 * has a conflicting companyId the entire batch is rejected — partial ownership
 * corruption is not allowed.
 */
export function applyCreateManyPolicy(
  modelKey: string,
  args: GenericArgs & { data: GenericArgs[] },
  opts: TenantQueryPolicyOptions,
): GenericArgs & { data: GenericArgs[] } {
  const companyId = resolveInjectionCompanyId(modelKey, opts);
  if (companyId === null) return args;

  const scoped = (args.data as GenericArgs[]).map((item, index) => {
    if ('companyId' in item && item.companyId !== companyId) {
      throw new TenantScopeViolationError(
        `createMany on '${modelKey}': record at index ${index} has a conflicting ` +
          `companyId ('${String(item.companyId)}') — entire batch rejected`,
      );
    }
    return { ...item, companyId };
  });

  return { ...args, data: scoped };
}
