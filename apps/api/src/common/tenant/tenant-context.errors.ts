/**
 * Thrown when a scoped business operation is attempted without an active
 * tenant context, or when the context is present but has a null companyId
 * without the explicit bypass flag.
 *
 * This is a programming error — the caller (interceptor, worker, cron) must
 * establish context via runTenantContext() before any tenant-scoped operation.
 */
export class MissingTenantContextError extends Error {
  readonly code = 'MISSING_TENANT_CONTEXT' as const;

  constructor(message = 'No active tenant context — scoped operation rejected') {
    super(message);
    this.name = 'MissingTenantContextError';
  }
}

/**
 * Thrown when a caller explicitly supplies a companyId that conflicts with
 * the one established by the active tenant context.
 *
 * For write operations (create, createMany): the caller must never control
 * ownership assignment. The tenant context is the sole source of truth.
 */
export class TenantScopeViolationError extends Error {
  readonly code = 'TENANT_SCOPE_VIOLATION' as const;

  constructor(message = 'Caller-supplied companyId conflicts with active tenant context') {
    super(message);
    this.name = 'TenantScopeViolationError';
  }
}
