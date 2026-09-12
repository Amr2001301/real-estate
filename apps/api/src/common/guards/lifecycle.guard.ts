/**
 * MT-034 — CompanyLifecycleGuard (global enforcement)
 *
 * Registered as APP_GUARD immediately after JwtAuthGuard so req.user is fully
 * populated with DB-authoritative companyId before this guard runs.
 *
 * CRITICAL: Guards execute BEFORE interceptors. TenantContextInterceptor has
 * NOT yet run when this guard fires, so ALS tenant context is unavailable.
 * Use req.user.companyId exclusively — never ALS / X-Tenant-Slug.
 *
 * Decision tree:
 *   !user                                              → pass (@Public / @PlatformPublic / unauthenticated)
 *   SUPER_ADMIN                                        → pass (platform routes bypass tenant lifecycle)
 *   companyId present                                  → check that company's lifecycleStatus
 *   companyId null + CLIENT/CUSTOMER + fallback active → check DEFAULT_COMPANY_ID company
 *   companyId null + staff role                        → pass (TenantContextInterceptor denies separately)
 *
 * The DEFAULT_COMPANY_ID fallback mirrors TenantContextInterceptor MT-032 logic so
 * that legacy CLIENT/CUSTOMER rows without a companyId are lifecycle-checked against
 * the same company that TenantContextInterceptor would resolve for them.
 *
 * Error code: COMPANY_NOT_ACTIVE (stable, machine-readable)
 */

import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CompanyLifecycleStatus } from '@prisma/client';

const ALLOWED_STATUSES: CompanyLifecycleStatus[] = ['ACTIVE'];
const FALLBACK_ELIGIBLE_ROLES = new Set(['CLIENT', 'CUSTOMER']);

interface AuthUser {
  sub: string;
  role: string;
  companyId: string | null;
}

/**
 * Resolves the effective companyId for lifecycle enforcement.
 *
 * Mirrors TenantContextInterceptor's MT-032 fallback so that both the guard
 * and the interceptor operate on the same logical company for legacy users.
 *
 * Returns null when no lifecycle check is possible (staff without companyId —
 * TenantContextInterceptor will deny those separately with UnauthorizedException).
 */
export function resolveEffectiveCompanyId(
  companyId: string | null,
  role: string,
): string | null {
  if (companyId) return companyId;
  const disableFallback = process.env.DISABLE_DEFAULT_COMPANY_FALLBACK === 'true';
  if (!disableFallback && FALLBACK_ELIGIBLE_ROLES.has(role)) {
    return process.env.DEFAULT_COMPANY_ID ?? null;
  }
  return null;
}

@Injectable()
export class CompanyLifecycleGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = req.user;

    // No authenticated user: @Public / @PlatformPublic / @OptionalAuth without token.
    // Do NOT block — let the route's own auth policy apply.
    if (!user) return true;

    // SUPER_ADMIN has no tenant company — bypass all lifecycle restrictions.
    if (user.role === 'SUPER_ADMIN') return true;

    const effectiveCompanyId = resolveEffectiveCompanyId(user.companyId, user.role);

    // No effective company (staff with null companyId).
    // Lifecycle guard cannot check anything; TenantContextInterceptor handles denial.
    if (!effectiveCompanyId) return true;

    const company = await this.prisma.company.findUnique({
      where: { id: effectiveCompanyId },
      select: { lifecycleStatus: true },
    });

    if (!company || !ALLOWED_STATUSES.includes(company.lifecycleStatus)) {
      throw new ForbiddenException({
        message: 'Company access disabled',
        code: 'COMPANY_NOT_ACTIVE',
      });
    }

    return true;
  }
}
