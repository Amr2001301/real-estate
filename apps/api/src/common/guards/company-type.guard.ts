import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { CompanyType } from '@prisma/client';
import { isBrokerageOnlyRoute, isBrokerageRouteAllowed } from '../company-type/brokerage-routes';

/**
 * BRK-1 — a brokerage company reaches only its own route groups (see
 * brokerage-routes.ts); the developer's workflows answer 403 NOT_FOR_BROKERAGE.
 * Runs after CompanyLifecycleGuard, which reads the company's type.
 * The other way round, a developer company does not reach the brokerage's
 * own groups (its listings): 403 NOT_FOR_DEVELOPER. Public routes and
 * SUPER_ADMIN (no company type on the request) pass through.
 */
@Injectable()
export class CompanyTypeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ companyType?: CompanyType; originalUrl?: string; url?: string }>();
    const path = req.originalUrl ?? req.url ?? '';
    if (req.companyType === 'DEVELOPER') {
      if (!isBrokerageOnlyRoute(path)) return true;
      throw new ForbiddenException({ message: 'هذه الخاصية خاصة بشركات الوساطة', code: 'NOT_FOR_DEVELOPER' });
    }
    if (req.companyType !== 'BROKERAGE') return true;
    if (isBrokerageRouteAllowed(path)) return true;
    throw new ForbiddenException({
      message: 'هذه الخاصية غير متاحة لشركات الوساطة',
      code: 'NOT_FOR_BROKERAGE',
    });
  }
}
