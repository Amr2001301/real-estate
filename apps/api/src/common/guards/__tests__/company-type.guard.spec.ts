/**
 * BRK-1 — CompanyTypeGuard: a brokerage company reaches only its own route
 * groups; developer companies, public routes and SUPER_ADMIN are untouched.
 */
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { CompanyTypeGuard } from '../company-type.guard';
import { isBrokerageRouteAllowed } from '../../company-type/brokerage-routes';

function ctx(companyType: string | undefined, url: string): ExecutionContext {
  const req = { companyType, originalUrl: url };
  return { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;
}

describe('CompanyTypeGuard (BRK-1)', () => {
  const guard = new CompanyTypeGuard();

  it('lets a developer company reach its own workflows', () => {
    expect(guard.canActivate(ctx('DEVELOPER', '/v1/contracts'))).toBe(true);
    expect(guard.canActivate(ctx('DEVELOPER', '/v1/installment-plan-templates'))).toBe(true);
    expect(guard.canActivate(ctx('DEVELOPER', '/v1/unit-types'))).toBe(true);
  });

  it('refuses a developer company the brokerage listings with NOT_FOR_DEVELOPER (BRK-2)', () => {
    for (const url of ['/v1/listings', '/v1/listings/abc', '/v1/listings/photos/presign']) {
      try {
        guard.canActivate(ctx('DEVELOPER', url));
        throw new Error(`expected ${url} to be refused`);
      } catch (e) {
        expect(e).toBeInstanceOf(ForbiddenException);
        expect((e as ForbiddenException).getResponse()).toMatchObject({ code: 'NOT_FOR_DEVELOPER' });
      }
    }
  });

  it('passes a request with no company type (public route, SUPER_ADMIN)', () => {
    expect(guard.canActivate(ctx(undefined, '/v1/contracts'))).toBe(true);
  });

  it('lets a brokerage reach its own groups', () => {
    for (const url of ['/v1/leads', '/v1/leads/123/stage', '/v1/visits/appointments?page=1', '/v1/campaigns', '/v1/users/me', '/v1/auth/logout', '/v1/listings', '/v1/listings/abc/status', '/v1/unit-types']) {
      expect(guard.canActivate(ctx('BROKERAGE', url))).toBe(true);
    }
  });

  it('refuses a brokerage the developer workflows with NOT_FOR_BROKERAGE', () => {
    for (const url of ['/v1/contracts', '/v1/installment-plan-templates', '/v1/deposits/review-queue', '/v1/maintenance-requests', '/v1/phases', '/v1/brokers', '/v1/portal/leads', '/v1/reports/financial', '/v1/me/installments']) {
      try {
        guard.canActivate(ctx('BROKERAGE', url));
        throw new Error(`expected ${url} to be refused`);
      } catch (e) {
        expect(e).toBeInstanceOf(ForbiddenException);
        expect((e as ForbiddenException).getResponse()).toMatchObject({ code: 'NOT_FOR_BROKERAGE' });
      }
    }
  });
});

describe('isBrokerageRouteAllowed', () => {
  it('matches whole path segments only', () => {
    expect(isBrokerageRouteAllowed('/v1/leads')).toBe(true);
    expect(isBrokerageRouteAllowed('/leads/abc')).toBe(true);
    // A route that only starts with an allowed word is not let through.
    expect(isBrokerageRouteAllowed('/v1/leadsx')).toBe(false);
    expect(isBrokerageRouteAllowed('/v1/lead-sources')).toBe(true);
  });
});
