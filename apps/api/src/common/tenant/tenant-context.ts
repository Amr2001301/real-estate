import { AsyncLocalStorage } from 'node:async_hooks';
import { MissingTenantContextError } from './tenant-context.errors';

/**
 * The shape of the tenant context stored in AsyncLocalStorage for each
 * in-flight request (or background job / cron invocation).
 *
 * Valid states:
 *
 *   companyId=<uuid>, bypass=false, isPublic=false  — normal authenticated request
 *   companyId=<uuid>, bypass=false, isPublic=true   — legacy @Public() (DEFAULT_COMPANY_ID)
 *   companyId=null,   bypass=false, isPlatformPublic=true — @PlatformPublic (MT-024);
 *                                                     no tenant context; service layer owns companyId
 *   companyId=null,   bypass=true,  isPublic=false  — explicit platform operation (SUPER_ADMIN / cron)
 *
 * Invalid state (security error — fail closed):
 *   companyId=null,   bypass=false, isPlatformPublic=false — missing or broken context setup
 */
export interface TenantContext {
  companyId: string | null;
  bypass: boolean;
  isPublic: boolean;
  /** MT-024: set for @PlatformPublic routes. No tenant auto-injection; service layer is authoritative. */
  isPlatformPublic?: boolean;
}

// One AsyncLocalStorage instance per Node.js process.
const als = new AsyncLocalStorage<TenantContext>();

/**
 * Runs `fn` within an explicit tenant context. All async work spawned inside
 * `fn` (including nested awaits) will see this context via getTenantContext().
 * The parent context is restored automatically when `fn` resolves or rejects.
 *
 * Use this for cron jobs, background tasks, and any non-Observable async scope.
 * For NestJS interceptors (Observable-based), use enterTenantContext() instead.
 */
export function runTenantContext<T>(ctx: TenantContext, fn: () => Promise<T>): Promise<T> {
  return als.run(ctx, fn);
}

/**
 * Sets the tenant context on the CURRENT async resource (the calling async
 * context and all child resources it spawns). Unlike runTenantContext(), it
 * does NOT restore the previous context when the current work unit finishes.
 *
 * Use this inside NestJS interceptor Observable factories:
 *
 *   return new Observable((subscriber) => {
 *     enterTenantContext(ctx);
 *     next.handle().subscribe(subscriber);
 *   });
 *
 * Each HTTP request in Node.js runs in its own AsyncResource context (created
 * by the underlying HTTP parser), so enterWith() scopes naturally to a single
 * request without leaking to concurrent requests.
 */
export function enterTenantContext(ctx: TenantContext): void {
  als.enterWith(ctx);
}

/**
 * Returns the current tenant context, or undefined if no context is active.
 * Does NOT validate the context — use requireTenantContext() for that.
 */
export function getTenantContext(): TenantContext | undefined {
  return als.getStore();
}

/**
 * Returns the current tenant context after validation.
 *
 * Throws MissingTenantContextError if:
 *   - no context is active at all, OR
 *   - companyId is null AND bypass is false (invalid / broken setup).
 *
 * Returns the context as-is for bypass mode (companyId may be null there).
 */
export function requireTenantContext(): TenantContext {
  const ctx = als.getStore();

  if (!ctx) {
    throw new MissingTenantContextError(
      'No tenant context is active — ensure the request was processed through TenantContextInterceptor',
    );
  }

  if (ctx.companyId === null && !ctx.bypass) {
    throw new MissingTenantContextError(
      'Tenant context has null companyId without bypass flag — this is a security error',
    );
  }

  return ctx;
}

/**
 * Returns the non-null companyId from the current context.
 *
 * Throws MissingTenantContextError if:
 *   - no context is active
 *   - context is in bypass mode (companyId may be null; use requireTenantContext() instead)
 *   - companyId is null without bypass (broken setup)
 */
export function getRequiredCompanyId(): string {
  const ctx = als.getStore();

  if (!ctx) {
    throw new MissingTenantContextError('No tenant context is active');
  }

  if (ctx.bypass) {
    throw new MissingTenantContextError(
      'getRequiredCompanyId() called in bypass context — use requireTenantContext() for platform operations',
    );
  }

  if (ctx.companyId === null) {
    throw new MissingTenantContextError(
      'Tenant context has null companyId without bypass — this is a security error',
    );
  }

  return ctx.companyId;
}
