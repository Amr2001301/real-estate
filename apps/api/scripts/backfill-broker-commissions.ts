/**
 * One-time backfill: create BrokerCommission rows for already-signed
 * broker-attributed contracts that were signed BEFORE the Phase 8
 * commission materialization hooks were deployed.
 *
 * Behaviour:
 *   - Dry-run by default.
 *   - Finds contracts where brokerId IS NOT NULL, signedAt IS NOT NULL,
 *     and no BrokerCommission row exists.
 *   - Prints a row per candidate with the data the materializer would use.
 *   - With --execute, creates missing PENDING commissions via the existing
 *     `BrokerCommissionsService.materializeFromContract()` so calc + idempotency
 *     + activity + notification all go through the single materializer path.
 *   - NEVER updates existing BrokerCommission rows.
 *
 * Run with:
 *   npx tsx scripts/backfill-broker-commissions.ts             (dry-run)
 *   npx tsx scripts/backfill-broker-commissions.ts --execute   (writes)
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { BrokerCommissionsService } from '../src/modules/broker-commissions/broker-commissions.service';

const EXECUTE = process.argv.includes('--execute');

async function main() {
  console.log(
    EXECUTE
      ? '⚠️  EXECUTE mode — commissions will be written.'
      : 'ℹ️  DRY-RUN — no changes will be written. Pass --execute to apply.',
  );
  console.log('');

  // Boot a minimal Nest context so DI wires the materializer + all of its
  // dependencies exactly as production would.
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const prisma = app.get(PrismaService);
  const commissions = app.get(BrokerCommissionsService);

  try {
    const candidates = await prisma.contract.findMany({
      where: {
        NOT: { brokerId: null },
        signedAt: { not: null },
        brokerCommission: null,
      },
      orderBy: { signedAt: 'asc' },
      select: {
        id: true,
        contractNumber: true,
        signedAt: true,
        totalAmount: true,
        brokerId: true,
        broker: { select: { companyName: true, code: true } },
        reservation: {
          select: {
            reservationNumber: true,
            commissionLockedPct: true,
            commissionLockedAmount: true,
          },
        },
      },
    });

    console.log(`Found ${candidates.length} candidate contract(s).\n`);

    let created = 0;
    let skipped = 0;
    let blocked = 0;

    for (const c of candidates) {
      const lockedPct =
        c.reservation?.commissionLockedPct !== null &&
        c.reservation?.commissionLockedPct !== undefined
          ? `${c.reservation.commissionLockedPct.toString()}%`
          : 'null';
      const lockedAmount =
        c.reservation?.commissionLockedAmount !== null &&
        c.reservation?.commissionLockedAmount !== undefined
          ? c.reservation.commissionLockedAmount.toString()
          : 'null';
      const canCreate =
        c.reservation &&
        (c.reservation.commissionLockedAmount !== null ||
          c.reservation.commissionLockedPct !== null);
      const tag = canCreate ? 'OK    ' : 'BLOCK ';
      console.log(
        `  ${tag} ${c.contractNumber ?? c.id.slice(0, 8)}  broker=${c.broker?.code ?? '—'}  ` +
          `reservation=${c.reservation?.reservationNumber ?? '—'}  ` +
          `totalAmount=${c.totalAmount.toString()}  ` +
          `lockedPct=${lockedPct}  lockedAmount=${lockedAmount}  ` +
          `signedAt=${c.signedAt?.toISOString()}`,
      );

      if (!canCreate) {
        blocked++;
        console.log(
          '         → SKIP: source reservation has no locked commission snapshot. ' +
            'Configure broker commission rates and re-convert the reservation, then re-run backfill.',
        );
        continue;
      }

      if (!EXECUTE) {
        console.log('         → would materialize BrokerCommission (run with --execute).');
        continue;
      }

      try {
        const result = await commissions.materializeFromContract(c.id);
        if (result.status === 'created') {
          console.log(`         → created ${result.commissionNumber}`);
          created++;
        } else if (result.status === 'already_exists') {
          console.log(`         → already exists: ${result.commissionNumber}`);
          skipped++;
        } else {
          console.log(`         → skipped: ${result.reason}`);
          skipped++;
        }
      } catch (e) {
        console.log(`         → ERROR: ${(e as Error).message}`);
        blocked++;
      }
    }

    console.log('');
    console.log(
      `Done. created=${created}, skipped/already-exists=${skipped}, blocked=${blocked}.`,
    );
    if (!EXECUTE && candidates.length > 0) {
      console.log('Re-run with --execute to apply the materializations shown above.');
    }
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
