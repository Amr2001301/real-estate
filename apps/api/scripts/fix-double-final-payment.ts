/**
 * One-off fix: contracts converted before #83 bill the final (balloon)
 * payment twice — it was left inside the monthly split and also added as its
 * own row, so their schedule adds up to more than the contract price.
 *
 * What it does (src/modules/contracts/double-final-payment.ts):
 *   - Lists live contracts whose schedule (booking + payments, fees left out)
 *     is more than their price.
 *   - For each, takes the excess off the unpaid monthly installments, in
 *     proportion to their amounts, so the schedule adds up to the price.
 *     Recorded on the audit log (contract.schedule-corrected) with the
 *     amounts before and after.
 *
 * Safety:
 *   - Dry-run by default: lists the contracts and what would change. Pass
 *     --execute to write.
 *   - Never touches a paid row, the contract price, commissions or bonuses.
 *   - Leaves a contract for an admin when a payment for it is waiting (proof
 *     under review, cheque not cleared) or when the unpaid months cannot
 *     absorb the excess (the customer already paid more than the price —
 *     that is a refund, not a reschedule). Those are listed at the end.
 *   - Idempotent: a fixed contract no longer shows up.
 *   - Sends no notifications (the customer's next view shows the corrected
 *     schedule; tell them first if they were told the old amounts).
 *
 * Run (with DATABASE_URL pointing at the database):
 *   pnpm --filter @rep/api contracts:fix-double-final-payment:dry-run
 *   pnpm --filter @rep/api contracts:fix-double-final-payment          (writes)
 * Take a backup first (scripts/db-backup.sh).
 */
import { PrismaClient } from '@prisma/client';
import {
  findDoubleBilledContracts,
  fixDoubleBilledContract,
} from '../src/modules/contracts/double-final-payment';

const EXECUTE = process.argv.includes('--execute');

async function main(): Promise<void> {
  console.log(
    EXECUTE
      ? '⚠️  EXECUTE mode — the schedules listed below will be corrected.'
      : 'ℹ️  DRY-RUN — no changes will be written. Pass --execute to apply.',
  );
  console.log('');

  const prisma = new PrismaClient();
  try {
    const contracts = await findDoubleBilledContracts(prisma);
    if (contracts.length === 0) {
      console.log('✅ No contract bills more than its price. Nothing to do.');
      return;
    }
    console.log(`Found ${contracts.length} contract(s) scheduled above their price:\n`);
    for (const c of contracts) {
      console.log(
        `  ${c.contractNumber ?? c.id}  company=${c.companyId}  price=${c.totalAmount.toFixed(2)}  ` +
          `scheduled=${c.scheduled.toFixed(2)}  excess=${c.excess.toFixed(2)}`,
      );
    }
    console.log('');
    if (!EXECUTE) {
      console.log('Dry-run: re-run with --execute to correct them.');
      return;
    }

    const left: Array<{ ref: string; reason: string }> = [];
    let fixed = 0;
    for (const c of contracts) {
      const ref = c.contractNumber ?? c.id;
      try {
        const out = await fixDoubleBilledContract(prisma, c.id);
        if (out.status === 'fixed') {
          fixed++;
          console.log(`  ✓ ${ref}: ${out.excess.toFixed(2)} taken off ${out.rows} unpaid installment(s)`);
        } else if (out.reason !== 'no_longer_over') {
          left.push({ ref, reason: out.reason });
        }
      } catch (e) {
        left.push({ ref, reason: `error: ${(e as Error).message}` });
      }
    }
    console.log(`\nFixed ${fixed} of ${contracts.length}.`);
    if (left.length) {
      console.log('\nLeft for an admin (fix from the contract page):');
      for (const l of left) {
        const why =
          l.reason === 'payment_waiting'
            ? 'a payment is waiting for review / a cheque has not cleared — settle it and re-run'
            : l.reason === 'excess_exceeds_unpaid'
              ? 'already paid more than the price — a refund, not a reschedule'
              : l.reason;
        console.log(`  - ${l.ref}: ${why}`);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
