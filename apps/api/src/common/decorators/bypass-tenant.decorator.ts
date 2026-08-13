import { SetMetadata } from '@nestjs/common';

export const BYPASS_TENANT_KEY = 'bypassTenant';

/**
 * Mark a controller or route handler as a platform-level operation that runs
 * without a tenant companyId. The TenantContextInterceptor will set
 * bypass=true in the AsyncLocalStorage context, allowing platform services
 * (health checks, super-admin operations, cron callbacks) to proceed.
 *
 * Never use this on regular business data routes — it disables tenant isolation.
 */
export const BypassTenant = () => SetMetadata(BYPASS_TENANT_KEY, true);
