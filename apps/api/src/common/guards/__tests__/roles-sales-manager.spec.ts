import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { RolesGuard } from '../roles.guard';
import { ROLES_KEY } from '../../decorators/roles.decorator';
import { GRANTED_BY_KEY } from '../../decorators/granted-by.decorator';
import type { PrismaService } from '../../prisma/prisma.service';

/**
 * RolesGuard: the roles a route lists (Batch 8: SALES_MANAGER only where
 * listed), and PRM — a code named by @GrantedBy opens the route to a staff
 * member outside those roles who holds it; admin-only codes never do.
 */
describe('RolesGuard', () => {
  function run(required: UserRole[] | undefined, role: UserRole, opts: { granted?: string[]; held?: string[] } = {}) {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: unknown) =>
      key === ROLES_KEY ? required : key === GRANTED_BY_KEY ? opts.granted : undefined,
    );
    const prisma = {
      userPermission: {
        findMany: jest.fn().mockResolvedValue((opts.held ?? []).map((code) => ({ permission: { code } }))),
      },
    } as unknown as PrismaService;
    const req: Record<string, unknown> = { user: { sub: 'u1', role } };
    const ctx = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;
    return { result: new RolesGuard(reflector, prisma).canActivate(ctx), req, prisma };
  }

  it('admits SALES_MANAGER on a route that lists it (opened sales route)', async () => {
    await expect(run([UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER], UserRole.SALES_MANAGER).result).resolves.toBe(true);
  });

  it('blocks SALES_MANAGER on an ADMIN-only route', async () => {
    await expect(run([UserRole.ADMIN], UserRole.SALES_MANAGER).result).rejects.toThrow(ForbiddenException);
  });

  it('blocks SALES_MANAGER on an ADMIN+SALES route that was NOT opened (e.g. broker finance)', async () => {
    await expect(run([UserRole.ADMIN, UserRole.SALES], UserRole.SALES_MANAGER).result).rejects.toThrow(ForbiddenException);
  });

  it('still admits SALES on the opened route and ADMIN everywhere', async () => {
    await expect(run([UserRole.ADMIN, UserRole.SALES, UserRole.SALES_MANAGER], UserRole.SALES).result).resolves.toBe(true);
    await expect(run([UserRole.ADMIN], UserRole.ADMIN).result).resolves.toBe(true);
  });

  it('PRM: a staff member holding the @GrantedBy code passes an ADMIN-only route', async () => {
    const r = run([UserRole.ADMIN], UserRole.SALES, { granted: ['cms:pages:manage'], held: ['cms:pages:manage'] });
    await expect(r.result).resolves.toBe(true);
    expect(r.req._grantedBy).toBe('cms:pages:manage');
  });

  it('PRM: without the code, or with an admin-only code, the route stays closed', async () => {
    await expect(run([UserRole.ADMIN], UserRole.SALES, { granted: ['cms:pages:manage'], held: ['leads:read'] }).result).rejects.toThrow(ForbiddenException);
    await expect(run([UserRole.ADMIN], UserRole.SALES_MANAGER, { granted: ['settings:write'], held: ['settings:write'] }).result).rejects.toThrow(ForbiddenException);
    await expect(run([UserRole.ADMIN], UserRole.SALES, { granted: ['users:read'], held: ['users:read'] }).result).rejects.toThrow(ForbiddenException);
  });

  it('PRM: customers and brokers are never let in by a code', async () => {
    for (const role of [UserRole.CUSTOMER, UserRole.CLIENT, UserRole.BROKER]) {
      await expect(run([UserRole.ADMIN], role, { granted: ['cms:pages:manage'], held: ['cms:pages:manage'] }).result).rejects.toThrow(ForbiddenException);
    }
  });

  it('PRM: a route that lists the role never loads the codes', async () => {
    const r = run([UserRole.ADMIN, UserRole.SALES], UserRole.SALES, { granted: ['cms:pages:manage'] });
    await r.result;
    expect(r.prisma.userPermission.findMany).not.toHaveBeenCalled();
  });
});
