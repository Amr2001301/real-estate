import { SetMetadata } from '@nestjs/common';

/**
 * MT-024 — @PlatformPublic
 *
 * Marks a route as platform-public: no JWT authentication required, but the
 * tenant context is NOT automatically set and bypass is NOT granted.
 *
 * Semantics:
 *   - JwtAuthGuard skips authentication (no Bearer token needed).
 *   - TenantContextInterceptor sets: { companyId: null, bypass: false, isPlatformPublic: true }.
 *   - TENANT_OWNED Prisma operations fail-closed (MissingTenantContextError).
 *   - PLATFORM_GLOBAL models are accessible as normal.
 *   - TENANT_CONTROLLED models (User, OtpCode) are accessible when the service
 *     layer explicitly passes the resolved companyId in every query.
 *
 * Use on new tenant-aware auth endpoints where the slug/header resolves the
 * tenant identity within the service, not through the interceptor.
 *
 * Do NOT use this as a substitute for @BypassTenant(). Bypass grants platform
 * authority; @PlatformPublic grants no tenant authority at all.
 */
export const IS_PLATFORM_PUBLIC_KEY = 'isPlatformPublic';
export const PlatformPublic = () => SetMetadata(IS_PLATFORM_PUBLIC_KEY, true);
