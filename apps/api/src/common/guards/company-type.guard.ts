import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { CompanyType } from '@prisma/client';
import { isBrokerageRouteAllowed } from '../company-type/brokerage-routes';

/**
 * BRK-1 — a brokerage company reaches only its own route groups (see
 * brokerage-routes.ts); the developer's workflows answer 403 NOT_FOR_BROKERAGE.
 * Runs after CompanyLifecycleGuard, which reads the company's type.
 * Public routes, SUPER_ADMIN and developer companies pass through.
 */
@Injectable()
export class CompanyTypeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ companyType?: CompanyType; originalUrl?: string; url?: string }>();
    if (req.companyType !== 'BROKERAGE') return true;
    if (isBrokerageRouteAllowed(req.originalUrl ?? req.url ?? '')) return true;
    throw new ForbiddenException({
      message: 'هذه الخاصية غير متاحة لشركات الوساطة',
      code: 'NOT_FOR_BROKERAGE',
    });
  }
}
