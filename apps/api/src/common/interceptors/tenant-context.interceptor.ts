import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NestInterceptor,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { enterTenantContext, type TenantContext } from '../tenant/tenant-context';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { BYPASS_TENANT_KEY } from '../decorators/bypass-tenant.decorator';
import { IS_PLATFORM_PUBLIC_KEY } from '../decorators/platform-public.decorator';
import { TenantResolverService } from '../../modules/auth/tenant-resolver.service';

const X_TENANT_SLUG = 'x-tenant-slug';

/**
 * Establishes the AsyncLocalStorage tenant context for every request.
 *
 * Must be registered as APP_INTERCEPTOR (runs after guards, so req.user is
 * already populated by JwtAuthGuard).
 *
 * Four paths (evaluated in order):
 *   @BypassTenant()     → platform context (bypass=true, no companyId required)
 *   @PlatformPublic()   → MT-024: no auth, no default company, service layer owns companyId
 *   @Public()           → MT-053: if X-Tenant-Slug present, resolve slug → companyId;
 *                         else fall back to DEFAULT_COMPANY_ID (legacy path)
 *   authenticated       → normal tenant context (companyId from req.user, MT-031 mismatch check)
 *
 * MT-031 mismatch: if an authenticated request also sends X-Tenant-Slug and the
 * resolved companyId does not match req.user.companyId, the request is rejected.
 *
 * MT-032: DISABLE_DEFAULT_COMPANY_FALLBACK=true removes the CLIENT/CUSTOMER
 * fallback to DEFAULT_COMPANY_ID. Default: false (legacy-compatible).
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly tenantResolver: TenantResolverService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // Async work needed (MT-031 slug resolution) so use an async factory.
    return new Observable((subscriber) => {
      this.buildContext(context)
        .then((ctx) => {
          enterTenantContext(ctx);
          next.handle().subscribe(subscriber);
        })
        .catch((err) => subscriber.error(err));
    });
  }

  private async buildContext(context: ExecutionContext): Promise<TenantContext> {
    const isBypass = this.reflector.getAllAndOverride<boolean>(BYPASS_TENANT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isBypass) {
      return { companyId: null, bypass: true, isPublic: false };
    }

    const isPlatformPublic = this.reflector.getAllAndOverride<boolean>(IS_PLATFORM_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPlatformPublic) {
      // MT-024: no tenant auto-injection; service layer is authoritative.
      // bypass=false so TENANT_OWNED ops fail-closed as expected.
      return { companyId: null, bypass: false, isPublic: false, isPlatformPublic: true };
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      // MT-053: if the caller sends X-Tenant-Slug (Next.js web-public middleware),
      // resolve that slug and use its companyId instead of DEFAULT_COMPANY_ID.
      const publicReq = context.switchToHttp().getRequest<{
        headers: Record<string, string | string[] | undefined>;
      }>();
      const rawSlug = publicReq.headers[X_TENANT_SLUG];
      const slug = rawSlug ? (Array.isArray(rawSlug) ? rawSlug[0] : rawSlug) : null;

      if (slug) {
        const resolved = await this.tenantResolver.tryResolveBySlug(slug);
        // Fail-closed: suspended/archived/inactive tenants return not-found on public routes.
        if (!resolved || resolved.lifecycleStatus !== 'ACTIVE') {
          throw new NotFoundException('Tenant not found');
        }
        return { companyId: resolved.companyId, bypass: false, isPublic: true };
      }

      // Legacy fallback: no X-Tenant-Slug header — use DEFAULT_COMPANY_ID.
      const defaultCompanyId = process.env.DEFAULT_COMPANY_ID ?? null;
      if (!defaultCompanyId) {
        throw new ServiceUnavailableException(
          'Server misconfiguration: DEFAULT_COMPANY_ID is not set.',
        );
      }
      return { companyId: defaultCompanyId, bypass: false, isPublic: true };
    }

    // ── Authenticated request ──────────────────────────────────────────────

    const req = context.switchToHttp().getRequest<{
      user?: { companyId?: string | null; role?: string | null };
      headers: Record<string, string | string[] | undefined>;
    }>();

    // SUPER_ADMIN sits above all tenants — always bypass.
    if (req.user?.role === 'SUPER_ADMIN') {
      // MT-031: SUPER_ADMIN with X-Tenant-Slug is allowed (super admin may
      // target specific companies via platform operations, handled at the
      // service layer). Do not enforce mismatch here for SUPER_ADMIN.
      return { companyId: null, bypass: true, isPublic: false };
    }

    const companyId = req.user?.companyId ?? null;

    // MT-031: X-Tenant-Slug mismatch check for authenticated non-SUPER_ADMIN requests.
    const rawSlug = req.headers[X_TENANT_SLUG];
    if (rawSlug) {
      const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;
      if (slug) {
        const resolved = await this.tenantResolver.tryResolveBySlug(slug);
        if (!resolved) {
          // Unknown slug on an authenticated request: reject without leaking data.
          throw new ForbiddenException('Unknown tenant');
        }
        if (companyId && resolved.companyId !== companyId) {
          // Slug resolves to a different company than the authenticated user's company.
          throw new ForbiddenException({ message: 'Tenant mismatch', code: 'TENANT_CONTEXT_MISMATCH' });
        }
        // Slug matches (or companyId is null — handled below). Continue.
      }
    }

    if (!companyId) {
      const role = req.user?.role;
      // MT-032: DISABLE_DEFAULT_COMPANY_FALLBACK gate.
      // When false (default): CLIENT/CUSTOMER users created before the MT migration
      // fall back to DEFAULT_COMPANY_ID so they can still access their data.
      // When true: this fallback is removed — clients must have a companyId set.
      const disableFallback = process.env.DISABLE_DEFAULT_COMPANY_FALLBACK === 'true';

      if (!disableFallback && (role === 'CLIENT' || role === 'CUSTOMER')) {
        const defaultId = process.env.DEFAULT_COMPANY_ID ?? null;
        if (!defaultId) {
          throw new UnauthorizedException(
            'Server misconfiguration: DEFAULT_COMPANY_ID is not set.',
          );
        }
        return { companyId: defaultId, bypass: false, isPublic: false };
      } else {
        throw new UnauthorizedException(
          'Your account is not associated with a company. Contact your administrator.',
        );
      }
    }

    return { companyId, bypass: false, isPublic: false };
  }
}
