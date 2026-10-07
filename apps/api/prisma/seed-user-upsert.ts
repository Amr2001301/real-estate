import type { Prisma, PrismaClient, User } from '@prisma/client';

/**
 * Option B (docs/audit/13-user-tenancy.md) — User.email is unique per company,
 * not platform-wide, so Prisma no longer accepts `user.upsert({ where: { email } })`.
 *
 * The seeds create their fixed users once and refresh them on every re-run.
 * This keeps that idempotency by looking the email up first. Seeds run alone
 * and sequentially, so the non-atomic find-then-write is not a race here; do
 * not use this from request handlers.
 *
 * `select` is accepted for call-site compatibility and ignored: the full row is
 * a superset of anything a seed selects.
 */
export async function upsertUserByEmail(
  prisma: PrismaClient,
  email: string,
  args: {
    create: Prisma.XOR<Prisma.UserCreateInput, Prisma.UserUncheckedCreateInput>;
    update: Prisma.XOR<Prisma.UserUpdateInput, Prisma.UserUncheckedUpdateInput>;
    select?: Prisma.UserSelect;
  },
): Promise<User> {
  const existing = await prisma.user.findFirst({ where: { email }, select: { id: true } });
  return existing
    ? prisma.user.update({ where: { id: existing.id }, data: args.update })
    : prisma.user.create({ data: args.create });
}
