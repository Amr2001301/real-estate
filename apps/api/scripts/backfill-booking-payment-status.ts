/**
 * One-time backfill: repair reservations whose BOOKING_AMOUNT deposit is
 * already settled but whose `bookingPaymentStatus` was never flipped to PAID.
 *
 * Why this exists: before this fix, DepositsService.approveProof() updated the
 * deposit (and any linked installment) but did NOT propagate a BOOKING_AMOUNT
 * approval back to the reservation. So an approved booking proof could leave
 * Reservation.bookingPaymentStatus = UNPAID/PENDING, and the customer saw the
 * booking payment as "0 / unpaid" on /account even though it was paid.
 *
 * What it does:
 *   - Finds BOOKING_AMOUNT deposits with a reservationId that are settled
 *     (reviewStatus = APPROVED OR legacy verified = true).
 *   - For each, if the linked Reservation.bookingPaymentStatus is neither PAID
 *     nor WAIVED, sets it to PAID and stamps bookingPaidAt from the deposit's
 *     paidAt (falling back to createdAt — paidAt is non-null in the schema, so
 *     the fallback is purely defensive).
 *
 * Safety:
 *   - Dry-run by default; pass --execute to write.
 *   - Idempotent: rows already PAID (or WAIVED) are skipped, so re-running is a
 *     no-op. Never deletes; never overwrites an existing bookingPaidAt that is
 *     already set on a PAID row (those rows are skipped entirely).
 *   - Never touches booking AMOUNT / mode / percent snapshots.
 *   - Sends NO notifications (legacy data; mass-notifying would spam customers).
 *   - Writes no secrets.
 *
 * Run with:
 *   npx tsx scripts/backfill-booking-payment-status.ts            (dry-run)
 *   npx tsx scripts/backfill-booking-payment-status.ts --execute  (writes)
 *
 * or via package scripts:
 *   pnpm --filter @rep/api deposits:backfill-booking-status:dry-run
 *   pnpm --filter @rep/api deposits:backfill-booking-status            (writes)
 */
import {
  DepositReviewStatus,
  DepositType,
  PrismaClient,
  ReservationBookingPaymentStatus,
} from '@prisma/client';

const EXECUTE = process.argv.includes('--execute');

async function main(): Promise<void> {
  console.log(
    EXECUTE
      ? '⚠️  EXECUTE mode — reservation booking-payment status will be written.'
      : 'ℹ️  DRY-RUN — no changes will be written. Pass --execute to apply.',
  );
  console.log('');

  const prisma = new PrismaClient();

  try {
    // Settled BOOKING_AMOUNT deposits that point at a reservation. We read the
    // reservation's current status alongside so we can skip already-correct
    // rows in JS (idempotency) without a second query per row.
    const deposits = await prisma.deposit.findMany({
      where: {
        type: DepositType.BOOKING_AMOUNT,
        reservationId: { not: null },
        OR: [{ reviewStatus: DepositReviewStatus.APPROVED }, { verified: true }],
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        reservationId: true,
        paidAt: true,
        createdAt: true,
        reservation: {
          select: { id: true, reservationNumber: true, bookingPaymentStatus: true },
        },
      },
    });

    let fixed = 0;
    let wouldFix = 0;
    let alreadyOk = 0;
    let skippedWaived = 0;
    const seenReservations = new Set<string>();

    for (const d of deposits) {
      const reservation = d.reservation;
      if (!reservation) continue; // dangling FK — nothing to repair.

      // A reservation can have at most one BOOKING_AMOUNT deposit, but guard
      // against duplicates so we never double-count in the summary.
      if (seenReservations.has(reservation.id)) continue;
      seenReservations.add(reservation.id);

      if (reservation.bookingPaymentStatus === ReservationBookingPaymentStatus.PAID) {
        alreadyOk++;
        continue;
      }
      if (reservation.bookingPaymentStatus === ReservationBookingPaymentStatus.WAIVED) {
        // A deliberate waiver — never override it.
        skippedWaived++;
        continue;
      }

      const label = reservation.reservationNumber ?? reservation.id;
      const bookingPaidAt = d.paidAt ?? d.createdAt;

      if (EXECUTE) {
        await prisma.reservation.update({
          where: { id: reservation.id },
          data: {
            bookingPaymentStatus: ReservationBookingPaymentStatus.PAID,
            bookingPaidAt,
          },
        });
        fixed++;
        console.log(`  ✓ set booking PAID for reservation ${label}`);
      } else {
        wouldFix++;
        console.log(`  • would set booking PAID for reservation ${label}`);
      }
    }

    console.log('');
    console.log(
      `Scanned ${deposits.length} settled BOOKING_AMOUNT deposit(s) across ${seenReservations.size} reservation(s).`,
    );
    if (EXECUTE) {
      console.log(
        `Fixed ${fixed} · already PAID ${alreadyOk} · skipped WAIVED ${skippedWaived}`,
      );
    } else {
      console.log(
        `Would fix ${wouldFix} · already PAID ${alreadyOk} · skipped WAIVED ${skippedWaived} ` +
          `(dry-run — pass --execute to apply)`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
