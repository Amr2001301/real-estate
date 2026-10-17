/**
 * The one-off fix for contracts converted before #83, whose schedule billed
 * the final (balloon) payment twice (scripts/fix-double-final-payment.ts).
 *
 * - Such a contract is found, with its excess over the price.
 * - The fix takes the excess off the unpaid monthly rows only, so the
 *   schedule adds up to the price; paid rows and the price are untouched; it
 *   is on the audit log, and a second run finds nothing.
 * - A contract with a payment waiting, or whose unpaid months cannot absorb
 *   the excess, is left for an admin.
 */
import 'reflect-metadata';
import {
  ContractStatus,
  DepositReviewStatus,
  DepositType,
  InstallmentStatus,
  PlanPaymentType,
  UnitStatus,
  UserRole,
} from '@prisma/client';
import { type TestApp, createE2ETestApp } from '../setup-app';
import { type E2EFixtures, loadE2EFixtures } from '../helpers/seed-fixtures';
import {
  findDoubleBilledContracts,
  fixDoubleBilledContract,
} from '../../src/modules/contracts/double-final-payment';

const DAY = 86_400_000;

describe('Fix: final payment billed twice (e2e)', () => {
  let testApp: TestApp;
  let fixtures: E2EFixtures;
  let companyId: string;
  let customerId: string;
  let units: Array<{ id: string; status: UnitStatus }>;
  const contractIds: string[] = [];
  const stamp = Date.now().toString().slice(-8);

  /**
   * Price 1,000,000; down 150,000 (paid); 4 monthly rows of 250,000 (the first
   * paid); and the final 200,000 again as its own row — 1,350,000 scheduled.
   */
  const doubleBilled = async (unitId: string, monthly = 250_000) => {
    const raw = testApp.rawPrisma;
    const contract = await raw.contract.create({
      data: {
        companyId, customerId, unitId, totalAmount: 1_000_000, status: ContractStatus.ACTIVE, signedAt: new Date(),
        contractNumber: `DFP-${stamp}-${contractIds.length}`,
      },
      select: { id: true },
    });
    contractIds.push(contract.id);
    const plan = await raw.installmentPlan.create({
      data: { companyId, contractId: contract.id, totalMonths: 4, monthlyAmount: monthly, startsAt: new Date() },
      select: { id: true },
    });
    const row = (type: PlanPaymentType, amount: number, months: number, paid = false) =>
      raw.installment.create({
        data: {
          companyId, planId: plan.id, type, amount,
          status: paid ? InstallmentStatus.PAID : InstallmentStatus.PENDING,
          dueDate: new Date(Date.now() + months * 30 * DAY),
          ...(paid ? { paidAt: new Date() } : {}),
        },
        select: { id: true },
      });
    const down = await row(PlanPaymentType.DOWN_PAYMENT, 150_000, -2, true);
    const firstMonth = await row(PlanPaymentType.INSTALLMENT, monthly, -1, true);
    const open = [];
    for (let m = 1; m <= 3; m++) open.push(await row(PlanPaymentType.INSTALLMENT, monthly, m));
    await row(PlanPaymentType.FINAL_PAYMENT, 200_000, 4);
    return { id: contract.id, planId: plan.id, paid: [down.id, firstMonth.id], open: open.map((o) => o.id) };
  };
  const scheduled = async (planId: string) =>
    Number(
      (
        await testApp.rawPrisma.installment.aggregate({
          where: { planId, status: { not: InstallmentStatus.CANCELLED } },
          _sum: { amount: true },
        })
      )._sum.amount,
    );

  beforeAll(async () => {
    testApp = await createE2ETestApp();
    fixtures = await loadE2EFixtures(testApp.rawPrisma);
    const raw = testApp.rawPrisma;
    companyId = (await raw.user.findUniqueOrThrow({ where: { id: fixtures.userIds.adminId } })).companyId!;
    customerId = (
      await raw.user.create({
        data: { companyId, role: UserRole.CUSTOMER, fullName: 'DFP Customer', phone: `+2023${stamp}`, locale: 'ar' },
        select: { id: true },
      })
    ).id;
    units = await raw.unit.findMany({
      where: { companyId, status: UnitStatus.AVAILABLE, contracts: { none: {} }, reservations: { none: {} } },
      select: { id: true, status: true },
      take: 3,
    });
    expect(units).toHaveLength(3);
    await raw.unit.updateMany({ where: { id: { in: units.map((u) => u.id) } }, data: { status: UnitStatus.SOLD } });
  });

  afterAll(async () => {
    const raw = testApp.rawPrisma;
    await raw.auditLog.deleteMany({ where: { entityId: { in: contractIds } } });
    await raw.deposit.deleteMany({ where: { contractId: { in: contractIds } } });
    await raw.installment.deleteMany({ where: { plan: { contractId: { in: contractIds } } } });
    await raw.installmentPlan.deleteMany({ where: { contractId: { in: contractIds } } });
    await raw.contract.deleteMany({ where: { id: { in: contractIds } } });
    for (const u of units) await raw.unit.update({ where: { id: u.id }, data: { status: u.status } });
    await raw.user.deleteMany({ where: { id: customerId } });
  });

  it('D-1: found, then corrected on the unpaid months only — once', async () => {
    const raw = testApp.rawPrisma;
    const c = await doubleBilled(units[0]!.id);
    expect(await scheduled(c.planId)).toBe(1_350_000);

    const found = (await findDoubleBilledContracts(raw)).find((f) => f.id === c.id);
    expect(found).toMatchObject({ totalAmount: 1_000_000, scheduled: 1_350_000, excess: 350_000 });

    expect(await fixDoubleBilledContract(raw, c.id)).toEqual({ status: 'fixed', rows: 3, excess: 350_000 });
    expect(await scheduled(c.planId)).toBe(1_000_000);
    // Paid rows and the price are untouched; the excess came off the unpaid months.
    const paid = await raw.installment.findMany({ where: { id: { in: c.paid } }, select: { amount: true, status: true } });
    expect(paid.map((p) => Number(p.amount)).sort()).toEqual([150_000, 250_000]);
    const open = await raw.installment.findMany({ where: { id: { in: c.open } }, select: { amount: true } });
    expect(open.reduce((a, o) => a + Number(o.amount), 0)).toBeCloseTo(400_000, 2);
    expect(Number((await raw.contract.findUniqueOrThrow({ where: { id: c.id } })).totalAmount)).toBe(1_000_000);
    expect(await raw.auditLog.count({ where: { entityId: c.id, action: 'contract.schedule-corrected' } })).toBe(1);

    // A second run finds nothing for it and changes nothing.
    expect((await findDoubleBilledContracts(raw)).some((f) => f.id === c.id)).toBe(false);
    expect(await fixDoubleBilledContract(raw, c.id)).toEqual({ status: 'skipped', reason: 'no_longer_over' });
  });

  it('D-2: a payment waiting for review leaves the contract for an admin', async () => {
    const raw = testApp.rawPrisma;
    const c = await doubleBilled(units[1]!.id);
    await raw.deposit.create({
      data: {
        companyId, contractId: c.id, installmentId: c.open[0], type: DepositType.INSTALLMENT, amount: 250_000,
        paidAt: new Date(), recordedById: customerId, reviewStatus: DepositReviewStatus.PENDING_REVIEW,
      },
    });
    expect(await fixDoubleBilledContract(raw, c.id)).toEqual({ status: 'skipped', reason: 'payment_waiting' });
    expect(await scheduled(c.planId)).toBe(1_350_000);
  });

  it('D-3: when the unpaid months cannot absorb the excess, it is a refund — left alone', async () => {
    const raw = testApp.rawPrisma;
    // Unpaid months of 100,000 each (300,000) against a larger excess.
    const c = await doubleBilled(units[2]!.id, 100_000);
    // Scheduled 150k + 4×100k + 200k = 750k < price: raise the paid down payment so it is over.
    await raw.installment.updateMany({ where: { id: c.paid[0] }, data: { amount: 1_150_000 } });
    expect(await scheduled(c.planId)).toBe(1_750_000);
    expect(await fixDoubleBilledContract(raw, c.id)).toEqual({ status: 'skipped', reason: 'excess_exceeds_unpaid' });
    expect(await scheduled(c.planId)).toBe(1_750_000);
  });
});
