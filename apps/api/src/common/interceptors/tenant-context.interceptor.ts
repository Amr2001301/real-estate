import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { enterTenantContext, type TenantContext } from '../tenant/tenant-context';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { BYPASS_TENANT_KEY } from '../decorators/bypass-tenant.decorator';

/**
 * Establishes the AsyncLocalStorage tenant context for every request.
 *
 * Must be registered as APP_INTERCEPTOR (runs after guards, so req.user is
 * already populated by JwtAuthGuard).
 *
 * Three paths:
 *   @BypassTenant()   → platform context (bypass=true, no companyId required)
 *   @Public()         → public context (isPublic=true, companyId from env)
 *   authenticated     → normal tenant context (companyId from req.user)
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const isBypass = this.reflector.getAllAndOverride<boolean>(BYPASS_TENANT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    let ctx: TenantContext;

    if (isBypass) {
      ctx = { companyId: null, bypass: true, isPublic: false };
    } else if (isPublic) {
      // Public routes use the default company derived from env. A missing env
      // var is a deployment misconfiguration — fail fast with 503 so ops sees
      // a clear signal instead of a cryptic MissingTenantContextError from the
      // Prisma middleware deep in the call stack.
      const defaultCompanyId = process.env.DEFAULT_COMPANY_ID ?? null;
      if (!defaultCompanyId) {
        throw new ServiceUnavailableException(
          'Server misconfiguration: DEFAULT_COMPANY_ID is not set.',
        );
      }
      ctx = { companyId: defaultCompanyId, bypass: false, isPublic: true };
    } else {
      const req = context.switchToHttp().getRequest<{
        user?: { companyId?: string | null; role?: string | null };
      }>();

      // SUPER_ADMIN sits above all tenants — always bypass.
      if (req.user?.role === 'SUPER_ADMIN') {
        ctx = { companyId: null, bypass: true, isPublic: false };
        return new Observable((subscriber) => {
          enterTenantContext(ctx);
          next.handle().subscribe(subscriber);
        });
      }

      const companyId = req.user?.companyId ?? null;

      if (!companyId) {
        const role = req.user?.role;
        // CLIENT/CUSTOMER users created before the MT migration have companyId=null.
        // Fall back to DEFAULT_COMPANY_ID so they can still access their data while
        // the backfill propagates. Staff roles must have a company assigned.
        if (role === 'CLIENT' || role === 'CUSTOMER') {
          const defaultId = process.env.DEFAULT_COMPANY_ID ?? null;
          if (!defaultId) {
            throw new UnauthorizedException(
              'Server misconfiguration: DEFAULT_COMPANY_ID is not set.',
            );
          }
          ctx = { companyId: defaultId, bypass: false, isPublic: false };
        } else {
          throw new UnauthorizedException(
            'Your account is not associated with a company. Contact your administrator.',
          );
        }
      } else {
        ctx = { companyId, bypass: false, isPublic: false };
      }
    }

    return new Observable((subscriber) => {
      // enterTenantContext() uses ALS.enterWith() to set the context on the
      // CURRENT async resource. Each HTTP request runs in its own Node.js async
      // context, so this scopes naturally to a single request without leaking
      // to concurrent requests. runTenantContext() (ALS.run()) is not used here
      // because RxJS does not always propagate the async context through
      // subscriber callback chains.
      enterTenantContext(ctx);
      next.handle().subscribe(subscriber);
    });
  }
}
