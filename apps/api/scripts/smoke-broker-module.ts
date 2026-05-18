/**
 * Read-only smoke test for the Broker module.
 *
 * Validates production invariants without touching data:
 *   - schema accessibility (tables queryable, generated client matches DB)
 *   - role/account preconditions
 *   - financial invariants (payout total matches its linked commissions)
 *   - cross-broker leak invariants (commission → contract → reservation chain
 *     all reference the SAME brokerId; no payout contains commissions of
 *     multiple brokers)
 *   - lifecycle invariants (no commission for an unsigned contract; no
 *     commission with a NULL contract.brokerId)
 *
 * Run with:
 *   npx tsx scripts/smoke-broker-module.ts
 *
 * Exits 0 when only PASS/WARN. Exits 1 when any FAIL.
 */
import { PrismaClient, Prisma, UserRole, BrokerPayoutStatus } from '@prisma/client';

const prisma = new PrismaClient();

type Status = 'PASS' | 'WARN' | 'FAIL';
interface Result {
  name: string;
  status: Status;
  detail?: string;
}

const results: Result[] = [];
function record(name: string, status: Status, detail?: string) {
  results.push({ name, status, detail });
}

function decimalsEqual(a: Prisma.Decimal | null, b: Prisma.Decimal | null): boolean {
  const av = a ?? new Prisma.Decimal(0);
  const bv = b ?? new Prisma.Decimal(0);
  return av.equals(bv);
}

async function checkAdminExists() {
  const count = await prisma.user.count({ where: { role: UserRole.ADMIN } });
  if (count > 0) record('At least one ADMIN user exists', 'PASS', `${count} admin(s)`);
  else record('At least one ADMIN user exists', 'FAIL', 'no ADMIN user found');
}

async function checkBrokerRoleSeeded() {
  // BROKER is an enum value, not a row — its presence is guaranteed by Prisma
  // schema. We check by counting users carrying it (zero is allowed in fresh
  // installs, only WARN).
  const count = await prisma.user.count({ where: { role: UserRole.BROKER } });
  if (count > 0) record('BROKER role in active use', 'PASS', `${count} broker user(s)`);
  else record('BROKER role in active use', 'WARN', 'no broker users yet (fresh install?)');
}

async function checkBrokerTables() {
  // Each of these will throw if the table is missing / out of sync with
  // the generated client. Use $queryRaw count(*) so an out-of-date client is
  // caught even when no rows exist.
  for (const [label, fn] of [
    ['Broker table queryable', () => prisma.broker.count()],
    ['BrokerUser table queryable', () => prisma.brokerUser.count()],
    ['BrokerProjectAccess table queryable', () => prisma.brokerProjectAccess.count()],
    ['BrokerUnitAccess table queryable', () => prisma.brokerUnitAccess.count()],
    ['BrokerCommission table queryable', () => prisma.brokerCommission.count()],
    ['BrokerPayout table queryable', () => prisma.brokerPayout.count()],
    ['BrokerActivityLog table queryable', () => prisma.brokerActivityLog.count()],
  ] as const) {
    try {
      const n = await fn();
      record(label, 'PASS', `${n} row(s)`);
    } catch (e) {
      record(label, 'FAIL', (e as Error).message);
    }
  }
}

async function checkPayoutTotalsMatchCommissions() {
  // For every payout, sum its linked commissions and compare to stored totals.
  const payouts = await prisma.brokerPayout.findMany({
    select: {
      id: true,
      payoutNumber: true,
      status: true,
      totalGross: true,
      totalNet: true,
      brokerId: true,
    },
  });
  if (payouts.length === 0) {
    record('Payout totals match linked commissions', 'PASS', '0 payouts');
    return;
  }
  const mismatches: string[] = [];
  for (const p of payouts) {
    const agg = await prisma.brokerCommission.aggregate({
      _sum: { grossAmount: true, netAmount: true },
      where: { payoutId: p.id },
    });
    if (!decimalsEqual(agg._sum.grossAmount ?? null, p.totalGross)) {
      mismatches.push(
        `${p.payoutNumber} (${p.status}): totalGross=${p.totalGross}, linked=${agg._sum.grossAmount ?? 0}`,
      );
    }
    if (!decimalsEqual(agg._sum.netAmount ?? null, p.totalNet)) {
      mismatches.push(
        `${p.payoutNumber} (${p.status}): totalNet=${p.totalNet}, linked=${agg._sum.netAmount ?? 0}`,
      );
    }
  }
  if (mismatches.length === 0) {
    record('Payout totals match linked commissions', 'PASS', `${payouts.length} payouts`);
  } else {
    record(
      'Payout totals match linked commissions',
      'FAIL',
      mismatches.slice(0, 5).join(' | ') + (mismatches.length > 5 ? ` (+${mismatches.length - 5} more)` : ''),
    );
  }
}

async function checkCommissionContractUnique() {
  // @@unique([contractId]) on BrokerCommission should make this impossible at
  // the DB level, but we double-check defensively.
  const dupes = await prisma.$queryRaw<{ contractId: string; n: bigint }[]>`
    SELECT "contractId", COUNT(*) AS n
    FROM "BrokerCommission"
    GROUP BY "contractId"
    HAVING COUNT(*) > 1
    LIMIT 5
  `;
  if (dupes.length === 0) {
    record('No duplicate BrokerCommission per contract', 'PASS');
  } else {
    record(
      'No duplicate BrokerCommission per contract',
      'FAIL',
      dupes.map((d) => `${d.contractId} (${d.n})`).join(' | '),
    );
  }
}

async function checkPayoutSingleBroker() {
  // No payout may contain commissions from more than one broker.
  const offenders = await prisma.$queryRaw<{ payoutId: string; n: bigint }[]>`
    SELECT "payoutId", COUNT(DISTINCT "brokerId") AS n
    FROM "BrokerCommission"
    WHERE "payoutId" IS NOT NULL
    GROUP BY "payoutId"
    HAVING COUNT(DISTINCT "brokerId") > 1
    LIMIT 5
  `;
  if (offenders.length === 0) {
    record('Each payout holds commissions of exactly one broker', 'PASS');
  } else {
    record(
      'Each payout holds commissions of exactly one broker',
      'FAIL',
      offenders.map((o) => `${o.payoutId} (${o.n} brokers)`).join(' | '),
    );
  }
}

async function checkCommissionPayoutBrokerMatch() {
  // The commission's brokerId must match the payout's brokerId.
  const offenders = await prisma.brokerCommission.findMany({
    where: {
      payoutId: { not: null },
      payout: { brokerId: { not: undefined } },
    },
    select: {
      id: true,
      brokerId: true,
      payoutId: true,
      payout: { select: { brokerId: true, payoutNumber: true } },
    },
  });
  const mismatches = offenders.filter((c) => c.payout && c.payout.brokerId !== c.brokerId);
  if (mismatches.length === 0) {
    record('Commission.brokerId matches Payout.brokerId', 'PASS', `${offenders.length} linked commission(s)`);
  } else {
    record(
      'Commission.brokerId matches Payout.brokerId',
      'FAIL',
      mismatches.slice(0, 5).map((c) => `commission ${c.id} → payout ${c.payout?.payoutNumber}`).join(' | '),
    );
  }
}

async function checkCommissionContractBrokerMatch() {
  // The commission's brokerId must match its contract's brokerId.
  const all = await prisma.brokerCommission.findMany({
    select: {
      id: true,
      brokerId: true,
      contractId: true,
      contract: { select: { brokerId: true, contractNumber: true } },
    },
  });
  if (all.length === 0) {
    record('Commission.brokerId matches Contract.brokerId', 'PASS', '0 commissions');
    return;
  }
  const nullContract = all.filter((c) => !c.contract?.brokerId);
  const mismatch = all.filter((c) => c.contract?.brokerId && c.contract.brokerId !== c.brokerId);
  if (nullContract.length > 0) {
    record(
      'No commission for contract with NULL brokerId',
      'FAIL',
      nullContract.slice(0, 5).map((c) => c.contract?.contractNumber ?? c.contractId).join(' | '),
    );
  } else {
    record('No commission for contract with NULL brokerId', 'PASS');
  }
  if (mismatch.length === 0) {
    record('Commission.brokerId matches Contract.brokerId', 'PASS');
  } else {
    record(
      'Commission.brokerId matches Contract.brokerId',
      'FAIL',
      mismatch.slice(0, 5).map((c) => `commission ${c.id} → contract ${c.contract?.contractNumber}`).join(' | '),
    );
  }
}

async function checkCommissionContractSigned() {
  // No commission may exist for an unsigned contract.
  const unsigned = await prisma.brokerCommission.findMany({
    where: { contract: { signedAt: null } },
    select: { id: true, contractId: true, contract: { select: { contractNumber: true } } },
    take: 5,
  });
  if (unsigned.length === 0) {
    record('No commission for unsigned contract', 'PASS');
  } else {
    record(
      'No commission for unsigned contract',
      'FAIL',
      unsigned.map((c) => c.contract?.contractNumber ?? c.contractId).join(' | '),
    );
  }
}

async function checkContractReservationBrokerMatch() {
  // Where a reservation exists, contract.brokerId must match reservation.brokerId.
  const offenders = await prisma.contract.findMany({
    where: {
      brokerId: { not: null },
      reservation: { brokerId: { not: undefined } },
    },
    select: {
      id: true,
      contractNumber: true,
      brokerId: true,
      reservation: { select: { id: true, brokerId: true, reservationNumber: true } },
    },
  });
  const mismatches = offenders.filter((c) => c.reservation && c.reservation.brokerId !== c.brokerId);
  if (mismatches.length === 0) {
    record(
      'Contract.brokerId matches Reservation.brokerId',
      'PASS',
      `${offenders.length} broker-attributed contract(s)`,
    );
  } else {
    record(
      'Contract.brokerId matches Reservation.brokerId',
      'FAIL',
      mismatches
        .slice(0, 5)
        .map((c) => `contract ${c.contractNumber} → reservation ${c.reservation?.reservationNumber}`)
        .join(' | '),
    );
  }
}

async function checkTerminalPayoutNotMutable() {
  // Paid payouts should never have a non-null cancelledAt; cancelled payouts
  // should never have a non-null paidAt. (These are flags we set in the
  // service.)
  const offenders = await prisma.brokerPayout.findMany({
    where: {
      OR: [
        { status: BrokerPayoutStatus.PAID, cancelledAt: { not: null } },
        { status: BrokerPayoutStatus.CANCELLED, paidAt: { not: null } },
      ],
    },
    select: { id: true, payoutNumber: true, status: true, paidAt: true, cancelledAt: true },
    take: 5,
  });
  if (offenders.length === 0) {
    record('Terminal payout flags consistent', 'PASS');
  } else {
    record(
      'Terminal payout flags consistent',
      'FAIL',
      offenders
        .map((p) => `${p.payoutNumber} (${p.status}): paidAt=${p.paidAt}, cancelledAt=${p.cancelledAt}`)
        .join(' | '),
    );
  }
}

async function safely(name: string, fn: () => Promise<void>) {
  // Wrap each check so a single failing assumption (e.g. a missing table from
  // an un-applied migration) doesn't crash the whole run.
  try {
    await fn();
  } catch (e) {
    record(name, 'FAIL', (e as Error).message.split('\n')[0]);
  }
}

async function main() {
  console.log('🔍 Broker module smoke test (read-only)');
  console.log('');

  await safely('checkAdminExists', checkAdminExists);
  await safely('checkBrokerRoleSeeded', checkBrokerRoleSeeded);
  await safely('checkBrokerTables', checkBrokerTables);
  await safely('checkCommissionContractUnique', checkCommissionContractUnique);
  await safely('checkPayoutTotalsMatchCommissions', checkPayoutTotalsMatchCommissions);
  await safely('checkPayoutSingleBroker', checkPayoutSingleBroker);
  await safely('checkCommissionPayoutBrokerMatch', checkCommissionPayoutBrokerMatch);
  await safely('checkCommissionContractBrokerMatch', checkCommissionContractBrokerMatch);
  await safely('checkCommissionContractSigned', checkCommissionContractSigned);
  await safely('checkContractReservationBrokerMatch', checkContractReservationBrokerMatch);
  await safely('checkTerminalPayoutNotMutable', checkTerminalPayoutNotMutable);

  console.log('');
  for (const r of results) {
    const icon = r.status === 'PASS' ? '✅' : r.status === 'WARN' ? '⚠️ ' : '❌';
    console.log(`${icon} ${r.status.padEnd(4)} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
  }
  console.log('');
  const fails = results.filter((r) => r.status === 'FAIL');
  const warns = results.filter((r) => r.status === 'WARN');
  console.log(`Total: ${results.length} — ${results.length - fails.length - warns.length} pass, ${warns.length} warn, ${fails.length} fail`);

  await prisma.$disconnect();
  if (fails.length > 0) process.exit(1);
  process.exit(0);
}

main().catch(async (e) => {
  console.error('Smoke test crashed:', e);
  await prisma.$disconnect();
  process.exit(1);
});
