import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { getRequiredCompanyId } from './tenant-context';

/**
 * A minimal interface satisfied by both PrismaService and a Prisma transaction
 * client (tx), so this helper is safe to call inside a $transaction.
 */
type UserClient = {
  user: {
    findFirst: <T extends Prisma.UserFindFirstArgs>(
      args: Prisma.SelectSubset<T, Prisma.UserFindFirstArgs>,
    ) => Promise<Prisma.UserGetPayload<T> | null>;
    findMany: <T extends Prisma.UserFindManyArgs>(
      args: Prisma.SelectSubset<T, Prisma.UserFindManyArgs>,
    ) => Promise<Array<Prisma.UserGetPayload<T>>>;
    // PrismaPromise is a subset of Promise that participates in $transaction([]).
    count: (args: Prisma.UserCountArgs) => Prisma.PrismaPromise<number>;
  };
};

/**
 * Resolve a User by id scoped to the current tenant's companyId (from ALS).
 *
 * - Always throws when the user is not found OR belongs to another tenant
 *   (never leaks cross-tenant existence — same error for both cases).
 * - Optionally validates that the user's role is one of `expectRoles`.
 *   A role mismatch throws the same error (no role-existence leak).
 * - `throwBadRequest: true` throws BadRequestException instead of
 *   NotFoundException — use when the caller's existing contract returns 400
 *   and the test suite relies on that status code.
 * - Safe to call inside a $transaction — pass the tx client as `prisma`.
 */
export async function resolveTenantUser<T extends Prisma.UserSelect>(
  prisma: UserClient,
  id: string,
  select: T,
  opts?: {
    expectRoles?: UserRole[];
    label?: string;
    throwBadRequest?: boolean;
  },
): Promise<Prisma.UserGetPayload<{ select: T }>> {
  const companyId = getRequiredCompanyId();

  const user = await prisma.user.findFirst({
    where: { id, companyId } as Prisma.UserWhereInput,
    select,
  } as Prisma.UserFindFirstArgs);

  const notFound = () => {
    const msg = opts?.label ?? 'User not found';
    return opts?.throwBadRequest
      ? new BadRequestException(msg)
      : new NotFoundException(msg);
  };

  if (!user) throw notFound();

  if (opts?.expectRoles?.length) {
    const role = (user as { role?: string }).role;
    if (!role || !opts.expectRoles.includes(role as UserRole)) {
      throw notFound();
    }
  }

  return user as Prisma.UserGetPayload<{ select: T }>;
}

/**
 * Resolve a User by id scoped to the current tenant, returning null when not
 * found (or from a different tenant). Use when a missing user is not an error.
 * For throws-on-miss semantics use resolveTenantUser instead.
 */
export async function findTenantUser<T extends Prisma.UserSelect>(
  prisma: UserClient,
  id: string,
  select: T,
): Promise<Prisma.UserGetPayload<{ select: T }> | null> {
  const companyId = getRequiredCompanyId();
  return prisma.user.findFirst({
    where: { id, companyId } as Prisma.UserWhereInput,
    select,
  } as Prisma.UserFindFirstArgs) as Promise<Prisma.UserGetPayload<{ select: T }> | null>;
}

/**
 * Fan-out query: find multiple Users scoped to the current tenant.
 *
 * Always merges companyId from AsyncLocalStorage into the where clause —
 * the caller's where is NOT trusted to carry it. This is the required routing
 * for any bulk prisma.user read outside the auth allowlist.
 *
 * Static limitation: the rule cannot verify the value of companyId at
 * compile time. If getRequiredCompanyId() is bypassed (e.g. in a bypass
 * context), this helper will reflect that bypass. The residual risk is the
 * same as any other bypassed TENANT_CONTROLLED call — documented in
 * docs/audit/13-user-tenancy.md.
 */
export function scopedUserFindMany<T extends Prisma.UserSelect>(
  prisma: UserClient,
  where: Prisma.UserWhereInput,
  select: T,
  opts?: {
    orderBy?: Prisma.UserOrderByWithRelationInput | Prisma.UserOrderByWithRelationInput[];
  },
): Promise<Array<Prisma.UserGetPayload<{ select: T }>>> {
  const companyId = getRequiredCompanyId();
  return prisma.user.findMany({
    where: { ...where, companyId } as Prisma.UserWhereInput,
    select,
    ...(opts?.orderBy ? { orderBy: opts.orderBy } : {}),
  } as Prisma.UserFindManyArgs) as Promise<Array<Prisma.UserGetPayload<{ select: T }>>>;
}

/**
 * Aggregate count of Users scoped to the current tenant.
 * Same companyId-injection guarantee as scopedUserFindMany.
 * Returns a PrismaPromise so it is safe to use inside prisma.$transaction([]).
 */
export function scopedUserCount(
  prisma: UserClient,
  where: Prisma.UserWhereInput,
): Prisma.PrismaPromise<number> {
  const companyId = getRequiredCompanyId();
  return prisma.user.count({ where: { ...where, companyId } });
}
