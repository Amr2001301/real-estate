/**
 * P0-A — Tenant Query Policy (NOT wired to production PrismaModule)
 *
 * This module contains the pure argument-transformation logic that will
 * eventually run inside a Prisma `$extends` query hook. It is kept
 * disconnected from the production PrismaClient deliberately:
 *
 *   - The current schema.prisma has no companyId columns yet.
 *   - Wiring the extension now would require unsafe type casts throughout
 *     the generated client or would simply be inert (no column to filter on).
 *   - Keeping it as pure functions makes it independently unit-testable.
 *
 * WHAT THIS FILE PROVES (P0-A scope):
 *   Argument transformation behaves exactly as specified for every covered
 *   operation type. The actual PostgreSQL filtering effect can only be
 *   verified after MT-Mig-02 adds the companyId columns.
 *
 * WHAT THIS FILE DOES NOT PROVE:
 *   - Real database filtering (no tenant columns exist yet)
 *   - Nested writes / nested connects (NOT protected by this layer)
 *   - $queryRaw / $executeRaw (completely outside extension scope)
 *   - Interactive transaction client scope (requires real Prisma integration test)
 *   - Relation includes (require real Prisma integration test)
 *
 * Type note: query args are typed as Record<string, unknown> because the
 * current Prisma-generated client does not yet expose companyId fields.
 * This is the one localized type boundary required for the proof — it will
 * be replaced by proper Prisma types after MT-Mig-02.
 */

import { getTenantContext } from '../tenant/tenant-context';
import { MissingTenantContextError, TenantScopeViolationError } from '../tenant/tenant-context.errors';

// ---------------------------------------------------------------------------
// Model set
// ---------------------------------------------------------------------------

/**
 * PROVISIONAL — NOT authoritative.
 *
 * Used only in the P0-A policy unit tests. Do not use in production code paths.
 * The authoritative set is TENANT_SCOPED_MODELS below.
 */
export const PROVISIONAL_SCOPED_MODELS_FOR_POLICY_TEST = new Set([
  'lead',
  'project',
  'unit',
  'reservation',
  'contract',
  'deposit',
]);

/**
 * Authoritative set of Prisma model names (lowercase camelCase) that carry a
 * companyId column and require tenant scoping. Derived from MT-Schema-03.
 * Update this set whenever a new model gains a companyId column.
 */
export const TENANT_SCOPED_MODELS = new Set([
  // Projects / inventory
  'project', 'phase', 'building', 'unit', 'unitstatushistory', 'unitmaintenanceitem',
  // CRM
  'leadsource', 'lead', 'leadnote', 'leadactivity',
  // Requests / visits
  'inforequest', 'visitrequest', 'visitappointment', 'visitactivity',
  // Reservations / contracts / payments
  'reservation', 'reservationnote', 'reservationactivity',
  'contract', 'installmentplan', 'installment', 'deposit',
  // Plan templates
  'installmentplantemplate',
  // Bonus / targets
  'bonusrule', 'bonusentry', 'salestarget',
  // Maintenance
  'maintenancecategory', 'maintenancerequest', 'maintenancerequestitem',
  // CMS / notifications
  'cmspage', 'banner', 'article', 'notificationtemplate', 'notification', 'auditlog',
  // Brokers
  'broker', 'brokeruser', 'brokerprojectaccess', 'brokerunitaccess',
  'brokercommission', 'brokerpayout', 'brokeractivitylog',
  // Platform
  'setting', 'document',
  // Chat
  'chatsession', 'chatmessage', 'chatfeedback',
]);

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
