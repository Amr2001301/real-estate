/**
 * seed-print-demo.ts — Development-only data for the printed documents
 *
 * Fills what the printed contract / receipt / reservation form show, so the
 * new letterhead layout can be checked with realistic content:
 *
 *   • Company letterhead: commercial registration, phone, email, address and
 *     tagline — only fields that are still EMPTY (real values are kept).
 *   • A demo customer, and on available units of the company:
 *       PRINT-DEMO-R-001  reservation, APPROVED, booking deposit paid in cash
 *       PRINT-DEMO-R-002  reservation, CONVERTED into the contract below
 *       PRINT-DEMO-C-001  signed contract: down payment by bank transfer and a
 *                         36-month plan (first 4 paid, 1 overdue, rest due)
 *       PRINT-DEMO-R-003  reservation, CANCELLED (prints with a watermark)
 *       + one REJECTED payment proof on the contract (receipt watermark)
 *
 * SAFETY:
 *   • Aborts if NODE_ENV === "production".
 *   • Every record carries a PRINT-DEMO-* number or the demo customer's
 *     e-mail, so --cleanup removes exactly what this script created.
 *   • Idempotent — re-running finds the existing records and stops.
 *
 * PREREQUISITE: the dev seed with catalog data (projects/units):
 *   SEED_PUBLIC_DEMO=true pnpm --filter @rep/api prisma:seed
 *
 * USAGE:
 *   pnpm --filter @rep/api prisma:seed:print
 *   pnpm --filter @rep/api prisma:seed:print:cleanup
 *
 * Company: SEED_COMPANY_SLUG (default "default").
 */

import {
  DepositReviewStatus,
  DepositType,
  InstallmentStatus,
  PaymentMethod,
  PrismaClient,
  ReservationBookingPaymentStatus,
  ReservationStatus,
  UnitStatus,
  UserRole,
} from '@prisma/client';

const prisma = new PrismaClient();

if (process.env.NODE_ENV === 'production') {
  console.error('❌ seed-print-demo must NOT run in production. Aborting.');
  process.exit(1);
}

const SLUG = process.env.SEED_COMPANY_SLUG ?? 'default';
const CUSTOMER_EMAIL = 'print.demo.customer@devora-demo.com';
const R1 = 'PRINT-DEMO-R-001';
const R2 = 'PRINT-DEMO-R-002';
const R3 = 'PRINT-DEMO-R-003';
const C1 = 'PRINT-DEMO-C-001';

/** Letterhead values — written only into empty fields, cleared only if unchanged. */
const LETTERHEAD = {
  registrationNumber: '284517',
  contactPhone: '+20 2 2614 5500',
  contactEmail: 'sales@example-developments.com',
  contactAddress: {
    ar: 'التجمع الخامس، شارع التسعين الشمالي، القاهرة الجديدة',
    en: 'North 90th St, Fifth Settlement, New Cairo',
  },
  tagline: { ar: 'نبني بيوتًا تليق بك', en: 'Homes built to last' },
};

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);
const monthsFrom = (start: Date, n: number) =>
  new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + n, 1));
const round2 = (n: number) => Math.round(n * 100) / 100;

async function resolveCompany() {
  const company = await prisma.company.findUnique({
    where: { slug: SLUG },
    select: {
      id: true,
      name: true,
      registrationNumber: true,
      contactPhone: true,
      contactEmail: true,
      contactAddress: true,
      tagline: true,
    },
  });
  if (!company) throw new Error(`Company "${SLUG}" not found — run the dev seed first (or set SEED_COMPANY_SLUG).`);
  return company;
}

async function cleanup(): Promise<void> {
  const company = await resolveCompany();
  const companyId = company.id;
  console.log(`🧹  Removing print demo data from "${SLUG}"…`);

  const contracts = await prisma.contract.findMany({
    where: { companyId, contractNumber: C1 },
    select: { id: true, unitId: true, installmentPlan: { select: { id: true } } },
  });
  const reservations = await prisma.reservation.findMany({
    where: { companyId, reservationNumber: { in: [R1, R2, R3] } },
    select: { id: true, unitId: true },
  });
  const contractIds = contracts.map((c) => c.id);
  const reservationIds = reservations.map((r) => r.id);
  const planIds = contracts.flatMap((c) => (c.installmentPlan ? [c.installmentPlan.id] : []));

  await prisma.deposit.deleteMany({
    where: { companyId, OR: [{ contractId: { in: contractIds } }, { reservationId: { in: reservationIds } }] },
  });
  await prisma.installment.deleteMany({ where: { companyId, planId: { in: planIds } } });
  await prisma.installmentPlan.deleteMany({ where: { companyId, id: { in: planIds } } });
  await prisma.contract.deleteMany({ where: { companyId, id: { in: contractIds } } });
  await prisma.reservation.deleteMany({ where: { companyId, id: { in: reservationIds } } });

  const unitIds = [...new Set([...contracts.map((c) => c.unitId), ...reservations.map((r) => r.unitId)])];
  await prisma.unit.updateMany({ where: { companyId, id: { in: unitIds } }, data: { status: UnitStatus.AVAILABLE } });
  await prisma.user.deleteMany({ where: { companyId, email: CUSTOMER_EMAIL } });

  // Letterhead: clear only the values this script wrote and nobody changed.
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const reset: Record<string, null> = {};
  if (company.registrationNumber === LETTERHEAD.registrationNumber) reset.registrationNumber = null;
  if (company.contactPhone === LETTERHEAD.contactPhone) reset.contactPhone = null;
  if (company.contactEmail === LETTERHEAD.contactEmail) reset.contactEmail = null;
  if (same(company.contactAddress, LETTERHEAD.contactAddress)) reset.contactAddress = null;
  if (same(company.tagline, LETTERHEAD.tagline)) reset.tagline = null;
  if (Object.keys(reset).length) {
    await prisma.company.update({ where: { id: companyId }, data: reset as never });
  }

  console.log(
    `   Removed ${contracts.length} contract(s), ${reservations.length} reservation(s); ` +
      `units back to AVAILABLE: ${unitIds.length}; letterhead fields cleared: ${Object.keys(reset).length}.`,
  );
}

async function main(): Promise<void> {
  if (process.argv.includes('--cleanup')) {
    await cleanup();
    return;
  }

  const company = await resolveCompany();
  const companyId = company.id;
  console.log(`🖨️  Seeding print demo data for "${SLUG}"…`);

  // ── 1. Letterhead (empty fields only) ──────────────────────────────────────
  const fill: Record<string, unknown> = {};
  if (!company.registrationNumber) fill.registrationNumber = LETTERHEAD.registrationNumber;
  if (!company.contactPhone) fill.contactPhone = LETTERHEAD.contactPhone;
  if (!company.contactEmail) fill.contactEmail = LETTERHEAD.contactEmail;
  if (!company.contactAddress) fill.contactAddress = LETTERHEAD.contactAddress;
  if (!company.tagline) fill.tagline = LETTERHEAD.tagline;
  if (Object.keys(fill).length) {
    await prisma.company.update({ where: { id: companyId }, data: fill as never });
  }
  console.log(`   Letterhead: filled ${Object.keys(fill).length} empty field(s) (${Object.keys(fill).join(', ') || 'none'}).`);

  if (await prisma.contract.findFirst({ where: { companyId, contractNumber: C1 }, select: { id: true } })) {
    console.log('   Documents already seeded — nothing to do. (Run with --cleanup to start over.)');
    return;
  }

  // ── 2. People ──────────────────────────────────────────────────────────────
  const admin = await prisma.user.findFirst({
    where: { companyId, role: UserRole.ADMIN },
    select: { id: true },
  });
  if (!admin) throw new Error(`No ADMIN user in "${SLUG}" — run the dev seed first.`);
  const sales =
    (await prisma.user.findFirst({ where: { companyId, role: UserRole.SALES }, select: { id: true, fullName: true } })) ??
    { id: admin.id, fullName: null };

  const customer =
    (await prisma.user.findFirst({ where: { companyId, email: CUSTOMER_EMAIL }, select: { id: true } })) ??
    (await prisma.user.create({
      data: {
        companyId,
        role: UserRole.CUSTOMER,
        fullName: 'أحمد محمود عبد الرحمن',
        email: CUSTOMER_EMAIL,
        phone: '+201000000901',
        locale: 'ar',
      },
      select: { id: true },
    }));

  // ── 3. Units ───────────────────────────────────────────────────────────────
  const units = await prisma.unit.findMany({
    where: { companyId, status: UnitStatus.AVAILABLE },
    orderBy: { price: 'desc' },
    take: 3,
    select: { id: true, code: true, price: true },
  });
  if (units.length < 3) {
    throw new Error(
      `Need 3 AVAILABLE units in "${SLUG}" (found ${units.length}). ` +
        'Run: SEED_PUBLIC_DEMO=true pnpm --filter @rep/api prisma:seed',
    );
  }
  const [uContract, uReserved, uCancelled] = units as [typeof units[0], typeof units[0], typeof units[0]];

  // ── 4. Contract with a converted reservation and a 36-month plan ───────────
  const total = Math.max(Number(uContract.price), 1_000_000);
  const down = round2(total * 0.2);
  const months = 36;
  const monthly = round2((total - down) / months);
  const signedAt = daysAgo(150);
  const planStart = monthsFrom(signedAt, 1);

  const r2 = await prisma.reservation.create({
    data: {
      companyId,
      reservationNumber: R2,
      unitId: uContract.id,
      salesId: sales.id,
      clientId: customer.id,
      status: ReservationStatus.CONVERTED,
      bookingAmount: 100_000,
      bookingPaymentStatus: ReservationBookingPaymentStatus.PAID,
      bookingPaidAt: daysAgo(170),
      expiresAt: daysAgo(150),
      approvedAt: daysAgo(172),
      convertedAt: signedAt,
      selectedDurationMonths: months,
      snapshotDownPaymentAmount: down,
      snapshotFinancedAmount: total - down,
      snapshotMonthlyInstallment: monthly,
      snapshotTotalPayable: total,
      createdAt: daysAgo(175),
    },
    select: { id: true },
  });

  const contract = await prisma.contract.create({
    data: {
      companyId,
      contractNumber: C1,
      customerId: customer.id,
      unitId: uContract.id,
      reservationId: r2.id,
      totalAmount: total,
      downPayment: down,
      signedAt,
      status: 'ACTIVE',
      createdAt: daysAgo(152),
    },
    select: { id: true },
  });
  await prisma.unit.update({ where: { id: uContract.id }, data: { status: UnitStatus.SOLD } });

  const plan = await prisma.installmentPlan.create({
    data: {
      companyId,
      contractId: contract.id,
      totalMonths: months,
      monthlyAmount: monthly,
      startsAt: planStart,
      createdAt: signedAt,
    },
    select: { id: true },
  });

  const now = Date.now();
  for (let i = 0; i < months; i++) {
    const dueDate = monthsFrom(planStart, i);
    const paid = i < 4;
    const overdue = !paid && dueDate.getTime() < now;
    const inst = await prisma.installment.create({
      data: {
        companyId,
        planId: plan.id,
        dueDate,
        amount: monthly,
        status: paid ? InstallmentStatus.PAID : overdue ? InstallmentStatus.OVERDUE : InstallmentStatus.PENDING,
        paidAt: paid ? new Date(dueDate.getTime() + 2 * DAY) : undefined,
      },
      select: { id: true },
    });
    if (paid) {
      await prisma.deposit.create({
        data: {
          companyId,
          type: DepositType.INSTALLMENT,
          contractId: contract.id,
          installmentId: inst.id,
          amount: monthly,
          paidAt: new Date(dueDate.getTime() + 2 * DAY),
          paymentMethod: i % 2 ? PaymentMethod.CASH : PaymentMethod.BANK_TRANSFER,
          recordedById: admin.id,
          verified: true,
          reviewStatus: DepositReviewStatus.APPROVED,
          reviewedAt: new Date(dueDate.getTime() + 3 * DAY),
          reviewedById: admin.id,
        },
      });
    }
  }

  // Down payment (bank transfer) + a rejected proof (prints with a watermark).
  await prisma.deposit.create({
    data: {
      companyId,
      type: DepositType.DOWN_PAYMENT,
      contractId: contract.id,
      amount: down,
      paidAt: signedAt,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      recordedById: admin.id,
      verified: true,
      reviewStatus: DepositReviewStatus.APPROVED,
      reviewedAt: signedAt,
      reviewedById: admin.id,
    },
  });
  await prisma.deposit.create({
    data: {
      companyId,
      type: DepositType.INSTALLMENT,
      contractId: contract.id,
      amount: monthly,
      paidAt: daysAgo(5),
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      recordedById: admin.id,
      reviewStatus: DepositReviewStatus.REJECTED,
      rejectionReason: 'صورة التحويل غير واضحة — يرجى إعادة الرفع.',
      reviewedAt: daysAgo(4),
      reviewedById: admin.id,
    },
  });

  // ── 5. An approved reservation with its booking deposit ────────────────────
  const rTotal = Math.max(Number(uReserved.price), 1_000_000);
  const rDown = round2(rTotal * 0.15);
  const rMonths = 48;
  const r1 = await prisma.reservation.create({
    data: {
      companyId,
      reservationNumber: R1,
      unitId: uReserved.id,
      salesId: sales.id,
      clientId: customer.id,
      status: ReservationStatus.APPROVED,
      notes: 'العميل يفضّل التواصل بعد الخامسة مساءً. التسليم المتوقع خلال ١٨ شهرًا.',
      bookingAmount: 75_000,
      bookingPaymentStatus: ReservationBookingPaymentStatus.PAID,
      bookingPaidAt: daysAgo(2),
      expiresAt: new Date(Date.now() + 14 * DAY),
      approvedAt: daysAgo(2),
      selectedDurationMonths: rMonths,
      snapshotDownPaymentAmount: rDown,
      snapshotFinancedAmount: rTotal - rDown,
      snapshotMonthlyInstallment: round2((rTotal - rDown) / rMonths),
      snapshotTotalPayable: rTotal,
      createdAt: daysAgo(3),
    },
    select: { id: true },
  });
  await prisma.unit.update({ where: { id: uReserved.id }, data: { status: UnitStatus.RESERVED } });
  await prisma.deposit.create({
    data: {
      companyId,
      type: DepositType.BOOKING_AMOUNT,
      reservationId: r1.id,
      amount: 75_000,
      paidAt: daysAgo(2),
      paymentMethod: PaymentMethod.CASH,
      recordedById: admin.id,
      verified: true,
    },
  });

  // ── 6. A cancelled reservation (prints with a watermark) ───────────────────
  await prisma.reservation.create({
    data: {
      companyId,
      reservationNumber: R3,
      unitId: uCancelled.id,
      salesId: sales.id,
      clientId: customer.id,
      status: ReservationStatus.CANCELLED,
      reason: 'ألغى العميل الحجز',
      bookingAmount: 50_000,
      expiresAt: daysAgo(20),
      cancelledAt: daysAgo(25),
      createdAt: daysAgo(30),
    },
  });

  console.log('   Created:');
  console.log(`     • contract ${C1} on unit ${uContract.code} — ${months} installments, 4 paid`);
  console.log(`     • reservation ${R1} (approved) on unit ${uReserved.code}, ${R2} (converted), ${R3} (cancelled)`);
  console.log('     • deposits: down payment, 4 installments, booking deposit, 1 rejected proof');
  console.log('   Open in the dashboard: Contracts / Reservations / Deposits → search "PRINT-DEMO" → Print.');
  console.log('   Remove with: pnpm --filter @rep/api prisma:seed:print:cleanup');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
