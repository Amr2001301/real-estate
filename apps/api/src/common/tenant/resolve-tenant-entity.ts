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
