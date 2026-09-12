/**
 * Identity-claim: merge a *synthetic* CLIENT row (created by
 * findOrCreateClient when an unauthenticated visitor left a phone) into a
 * registered User row whose contact information overlaps with it.
 *
 * Called from auth flows (registerCustomer is the original P8 site; P9 adds
 * loginCustomer + verifyOtp + updateMe) so that a customer who registers OR
 * logs in OR adds a phone to their profile automatically picks up any Lead /
 * Reservation / VisitRequest / InfoRequest / MaintenanceRequest / Contract /
 * Deposit attached to the synthetic peer.
 *
 * Safety contract:
 *  - A row qualifies as a "synthetic peer" ONLY when it has role=CLIENT and
 *    passwordHash IS NULL (i.e. never registered). Real accounts are
 *    untouchable.
 *  - The peer must match the target by exact (case-insensitive) email OR
 *    digit-only normalized phone (≥8 digits). Anything looser is refused.
 *  - The merge is a single Prisma transaction; if any repoint fails the
 *    synthetic row stays put (no partial reattachment, no data loss).
 *  - We never merge a synthetic row that has refresh tokens, device tokens,
 *    or any sign of having actually been used as a login identity — those
 *    are non-synthetic by definition and require manual admin attention.
 *
 * The list of FK columns repointed below intentionally covers every "owned
 * by a User" relation. If a new such relation is added later (e.g. a
 * Subscription model with userId) this list MUST be extended; the safer
 * default is to refuse the merge when a hidden FK remains (Postgres will
 * raise a foreign-key violation on the synthetic delete, which surfaces
 * here as an exception rather than silent data loss).
 */

import type { Prisma, PrismaClient, UserRole } from '@prisma/client';
import { normalizeEmail, normalizePhone } from './identity-match';

interface PeerCandidate {
  id: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  passwordHash: string | null;
}

export interface ClaimResult {
  /** Number of synthetic peers merged (excluding the target itself). */
  claimedCount: number;
  /** Ids of synthetics that were deleted (for logging/auditing). */
  claimedIds: string[];
}

export interface ClaimSearchOverride {
  /** Phone to match against synthetics; defaults to target user's stored phone. */
  phone?: string | null;
  /** Email to match against synthetics; defaults to target user's stored email. */
  email?: string | null;
}

/**
 * Find synthetic CLIENT rows that share normalized phone or canonical email
 * with the target user, repoint every "owned" FK to the target, and delete
 * the synthetic. Idempotent: re-running after a successful claim is a no-op.
 *
 * `prismaArg` accepts either the singleton PrismaService or a Prisma tx
 * client — useful when callers want to run the claim inside their own
 * transaction.
 *
 * `override` lets callers search by INCOMING contact values (e.g. PATCH
 * /v1/users/me passing the new phone before it's persisted) so the merge
 * happens BEFORE the unique-constraint-bearing update lands. When omitted
 * the lookup falls back to the target user's currently-stored contact info.
 */
export async function claimSyntheticPeers(
  prismaArg: PrismaClient | Prisma.TransactionClient,
  targetUserId: string,
  override?: ClaimSearchOverride,
): Promise<ClaimResult> {
  // Cast: PrismaService is a PrismaClient at runtime; both expose the same
  // model accessors. Using one type for the rest of the function.
  const prisma = prismaArg as PrismaClient;
  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { phone: true, email: true, companyId: true },
  });
  if (!target) return { claimedCount: 0, claimedIds: [] };
  // MT-011: synthetic peer merging is only meaningful within a single tenant.
  // A null companyId means the target is a SUPER_ADMIN or a pre-migration row;
  // cross-tenant merging for these accounts is undefined and would be a bug.
  if (target.companyId === null) return { claimedCount: 0, claimedIds: [] };
  const targetPhone = normalizePhone(
    override?.phone !== undefined ? override.phone : target.phone,
  );
  const targetEmail = normalizeEmail(
    override?.email !== undefined ? override.email : target.email,
  );
  if (!targetPhone && !targetEmail) return { claimedCount: 0, claimedIds: [] };

  // Pull candidate synthetics. Use the small unique-column-backed lookups
  // rather than a wide scan — there is at most one row per email and a
  // narrow phone-suffix scan.
  const candidates: PeerCandidate[] = [];
  const seen = new Set<string>([targetUserId]);

  if (targetEmail) {
    // MT-011: scope to the same company. findFirst instead of findUnique
    // because the compound (email, companyId) has no unique constraint yet.
    const byEmail = await prisma.user.findFirst({
      where: { email: targetEmail, companyId: target.companyId },
      select: { id: true, email: true, phone: true, role: true, passwordHash: true },
    });
    if (byEmail && !seen.has(byEmail.id)) {
      candidates.push(byEmail);
      seen.add(byEmail.id);
    }
  }
  if (targetPhone) {
    // Suffix-narrow scan to leverage the `phone` index, then verify in JS.
    // MT-011: companyId scope ensures we only merge within the same tenant.
    const suffix = targetPhone.slice(-8);
    const rows = await prisma.user.findMany({
      where: { phone: { contains: suffix }, companyId: target.companyId },
      select: { id: true, email: true, phone: true, role: true, passwordHash: true },
    });
    for (const r of rows) {
      if (seen.has(r.id)) continue;
      if (normalizePhone(r.phone) !== targetPhone) continue;
      candidates.push(r);
      seen.add(r.id);
    }
  }

  const safePeers = candidates.filter(
    (c) => c.role === 'CLIENT' && c.passwordHash === null,
  );
  if (safePeers.length === 0) return { claimedCount: 0, claimedIds: [] };

  const claimedIds: string[] = [];
  for (const peer of safePeers) {
    try {
      await prisma.$transaction(async (tx) => {
        const peerId = peer.id;
        // Repoint every "owned-by-User" FK we know about. Each updateMany
        // is a single statement on a single column — Postgres-fast, even
        // for users with thousands of rows.
        await tx.lead.updateMany({
          where: { clientId: peerId },
          data: { clientId: targetUserId },
        });
        await tx.reservation.updateMany({
          where: { clientId: peerId },
          data: { clientId: targetUserId },
        });
        await tx.visitRequest.updateMany({
          where: { userId: peerId },
          data: { userId: targetUserId },
        });
        await tx.infoRequest.updateMany({
          where: { userId: peerId },
          data: { userId: targetUserId },
        });
        await tx.contract.updateMany({
          where: { customerId: peerId },
          data: { customerId: targetUserId },
        });
        await tx.maintenanceRequest.updateMany({
          where: { customerId: peerId },
          data: { customerId: targetUserId },
        });
        await tx.favorite.updateMany({
          where: { userId: peerId },
          data: { userId: targetUserId },
        });
        await tx.notification.updateMany({
          where: { userId: peerId },
          data: { userId: targetUserId },
        });
        // Refresh tokens / device tokens / OTPs left in place: a synthetic
        // by definition has none. If somehow it does, the delete below
        // throws and the whole transaction rolls back — surfacing the
        // anomaly instead of silently dropping a real session.
        await tx.user.delete({ where: { id: peerId } });
      });
      claimedIds.push(peer.id);
    } catch (err) {
      // Don't fail the caller (login / register / profile-update) just
      // because a single merge couldn't complete. Log to console — the
      // calling site will Logger.warn the result.
      // eslint-disable-next-line no-console
      console.warn(
        `[identity-claim] failed to merge synthetic ${peer.id} into ${targetUserId}:`,
        (err as Error).message,
      );
    }
  }
  return { claimedCount: claimedIds.length, claimedIds };
}
