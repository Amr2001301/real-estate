/**
 * Dev/test-data repair: give every live contract that has NO instalment plan one, so the customer
 * app and the dashboard show a schedule.
 *
 * A contract should never exist without a way to pay (a plan, or a cash plan). Contracts made by
 * hand in the dashboard — and the e2e fixtures — used to be created without one. This script adds
 * a plain monthly plan to those: the contract's total, less its down payment, split over N months
 * from the first day of next month. Rows start PENDING (nothing is marked paid: record real
 * payments from the dashboard).
 *
 * - Dry-run by default; pass --execute to write.
 * - Idempotent: a contract that already has a plan is skipped.
 * - Only live contracts (not cancelled, not deleted).
 * - Never touches an existing plan or installment.
 * - `--months=N` (default 24).
 *
 * Run:
 *   npx tsx scripts/backfill-missing-installment-plans.ts                    (dry-run)
 *   npx tsx scripts/backfill-missing-installment-plans.ts --execute --months=36
 */
import { ContractStatus, PlanPaymentType, Prisma, PrismaClient } from '@prisma/client';

const EXECUTE = process.argv.includes('--execute');
const monthsArg = process.argv.find((a) => a.startsWith('--months='));
const MONTHS = monthsArg ? Number(monthsArg.split('=')[1]) : 24;

function addMonths(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCMonth(x.getUTCMonth() + n);
  return x;
}

async function main(): Promise<void> {
  if (!Number.isInteger(MONTHS) || MONTHS < 1 || MONTHS > 240) throw new Error('--months must be 1..240');
  console.log(EXECUTE ? '⚠️  EXECUTE mode — plans will be written.' : 'ℹ️  DRY-RUN — pass --execute to write.');

  const prisma = new PrismaClient();
  try {
    const contracts = await prisma.contract.findMany({
      where: { installmentPlan: null, status: { not: ContractStatus.CANCELLED }, deletedAt: null },
      select: { id: true, contractNumber: true, companyId: true, totalAmount: true, downPayment: true, signedAt: true },
      orderBy: { createdAt: 'asc' },
    });
    console.log(`${contracts.length} live contract(s) without a plan.`);

    const now = new Date();
    const startsAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const toCents = (v: Prisma.Decimal | number | null) => Math.round(Number(v ?? 0) * 100);
    const money = (cents: number) => new Prisma.Decimal(cents).div(100);

    for (const c of contracts) {
      const down = toCents(c.downPayment);
      const remaining = toCents(c.totalAmount) - down;
      if (remaining <= 0) {
        console.log(`- ${c.contractNumber ?? c.id}: nothing left to spread over instalments — skipped.`);
        continue;
      }
      const monthly = Math.floor(remaining / MONTHS);
      const last = remaining - monthly * (MONTHS - 1);
      console.log(
        `- ${c.contractNumber ?? c.id}: total ${Number(c.totalAmount)}, down ${down / 100}, ` +
          `${MONTHS} x ${monthly / 100} (last ${last / 100}), from ${startsAt.toISOString().slice(0, 10)}`,
      );
      if (!EXECUTE) continue;

      await prisma.$transaction(async (tx) => {
        const plan = await tx.installmentPlan.create({
          data: {
            contractId: c.id,
            totalMonths: MONTHS,
            monthlyAmount: money(monthly),
            startsAt,
            companyId: c.companyId,
          },
        });
        const rows: Prisma.InstallmentCreateManyInput[] = [];
        if (down > 0) {
          rows.push({ planId: plan.id, type: PlanPaymentType.DOWN_PAYMENT, dueDate: startsAt, amount: money(down) });
        }
        for (let i = 0; i < MONTHS; i++) {
          rows.push({ planId: plan.id, dueDate: addMonths(startsAt, i), amount: money(i === MONTHS - 1 ? last : monthly) });
        }
        await tx.installment.createMany({ data: rows });
      });
    }
    console.log(EXECUTE ? 'Done.' : 'Dry-run finished — nothing written.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
