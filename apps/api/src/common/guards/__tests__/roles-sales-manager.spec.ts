import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { RolesGuard } from '../roles.guard';

/**
 * RolesGuard behavior for SALES_MANAGER (Batch 8).
 *
 * Batch 8 adds SALES_MANAGER to the @Roles list of read/workflow sales routes
 * (mirroring SALES) but leaves admin-only routes as @Roles(ADMIN). These tests
 * prove the guard admits SALES_MANAGER only where it is explicitly listed.
 */
describe('RolesGuard · SALES_MANAGER access', () => {
  function contextFor(required: UserRole[] | undefined, role: UserRole) {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(required);
    const ctx = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
    } as unknown as ExecutionContext;
    return new RolesGuard(reflector).canActivate(ctx);
  }

  it('admits SALES_MANAGER on a route that lists it (opened sales route)', () => {
    expect(
      contextFor([UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER], UserRole.SALES_MANAGER),
    ).toBe(true);
  });

  it('blocks SALES_MANAGER on an ADMIN-only route', () => {
    expect(() => contextFor([UserRole.ADMIN], UserRole.SALES_MANAGER)).toThrow(ForbiddenException);
  });

  it('blocks SALES_MANAGER on an ADMIN+SALES route that was NOT opened (e.g. broker finance)', () => {
    expect(() => contextFor([UserRole.ADMIN, UserRole.SALES], UserRole.SALES_MANAGER)).toThrow(
      ForbiddenException,
    );
  });

  it('still admits SALES on the opened route and ADMIN everywhere', () => {
    expect(contextFor([UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER], UserRole.SALES)).toBe(true);
    expect(contextFor([UserRole.ADMIN], UserRole.ADMIN)).toBe(true);
  });
});
