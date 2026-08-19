/**
 * seed-new-broker.ts
 * Creates a fully-populated demo broker account for manual portal testing.
 * Idempotent — safe to run multiple times.
 *
 * USAGE:
 *   cd apps/api
 *   pnpm tsx prisma/seed-new-broker.ts
 */

import {
  BrokerCommissionStatus,
  BrokerLeadStatus,
  BrokerPayoutMethod,
  BrokerPayoutStatus,
  BrokerStatus,
  BrokerUserStatus,
  LeadActivityType,
  PrismaClient,
  ReservationStatus,
  UserRole,
} from '@prisma/client';
import * as argon2 from 'argon2';

if (process.env.NODE_ENV === 'production') {
  console.error('❌ seed-new-broker must NOT run in production.');
  process.exit(1);
}

const prisma = new PrismaClient();

const FIRM_CODE = 'DEMO-BR-NEW-01';
const EMAIL     = 'broker.new@devora-demo.com';
const PASSWORD  = 'Broker@2026!';

const ago    = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
const future = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };

async function main() {
  // ── Prerequisites ─────────────────────────────────────────────────────────
  const adminUser = await prisma.user.findFirst({ where: { role: UserRole.ADMIN }, select: { id: true } });
  if (!adminUser) throw new Error('No ADMIN user — run dev seed first.');

  const salesUser = await prisma.user.findFirst({ where: { email: 'sales@example.com' }, select: { id: true } });
  if (!salesUser) throw new Error('sales@example.com not found — run dev seed first.');

  // Grab two projects + available units from each
  const pSolara  = await prisma.project.findFirst({ where: { name: { path: ['en'], equals: 'Solara Heights' } },        select: { id: true } });
  const pRiyadh  = await prisma.project.findFirst({ where: { name: { path: ['en'], equals: 'New Riyadh Compound' } },   select: { id: true } });
  if (!pSolara || !pRiyadh) throw new Error('Required projects not found — run dev seed with SEED_PUBLIC_DEMO=true.');

  const getUnit = async (code: string) => {
    const u = await prisma.unit.findFirst({ where: { code }, select: { id: true, price: true } });
    if (!u) throw new Error(`Unit ${code} not found.`);
    return u;
  };
  const [uSH310, uSH101, uSH205, uA101, uA102, uB101] = await Promise.all([
    getUnit('SH-310'), getUnit('SH-101'), getUnit('SH-205'),
    getUnit('A-101'),  getUnit('A-102'),  getUnit('B-101'),
  ]);

  // ── 1. Broker user ────────────────────────────────────────────────────────
  console.log('1/8  Upserting broker user…');
  const hash = await argon2.hash(PASSWORD);
  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    create: { email: EMAIL, passwordHash: hash, fullName: 'New Broker User', role: UserRole.BROKER, locale: 'ar' },
    update: { passwordHash: hash },
    select: { id: true },
  });

  // ── 2. Broker firm ────────────────────────────────────────────────────────
  console.log('2/8  Upserting broker firm…');
  const broker = await prisma.broker.upsert({
    where: { code: FIRM_CODE },
    create: {
      code: FIRM_CODE,
      companyName: 'شركة الوسيط الجديد',
      commercialName: 'New Broker Firm',
      email: 'firm@devora-demo.com',
      phone: '+966199000001',
      address: 'طريق الملك فهد، العليا',
      city: 'الرياض',
      taxId: 'DEMO-TAX-NEW-01',
      commercialRegistration: 'DEMO-CR-NEW-01',
      bankName: 'بنك الرياض',
      bankAccountName: 'شركة الوسيط الجديد',
      bankIban: 'SA0380000000608010167520',
      defaultCommissionPct: 2.5,
      status: BrokerStatus.ACTIVE,
      contractStartAt: ago(90),
      contractEndAt: future(275),
      createdById: adminUser.id,
      notes: 'حساب تجريبي للاختبار',
    },
    update: {},
    select: { id: true },
  });

  // ── 3. BrokerUser link ────────────────────────────────────────────────────
  console.log('3/8  Linking user → firm…');
  await prisma.brokerUser.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      brokerId: broker.id,
      jobTitle: 'المدير العام',
      isPrimaryContact: true,
      canManageBrokerUsers: true,
      canViewCommissions: true,
      status: BrokerUserStatus.ACTIVE,
      joinedAt: ago(90),
    },
    update: { status: BrokerUserStatus.ACTIVE },
  });

  // ── 4. Project access ─────────────────────────────────────────────────────
  console.log('4/8  Granting project access…');
  for (const { projectId, pct } of [
    { projectId: pSolara.id, pct: 2.5 },
    { projectId: pRiyadh.id, pct: 2.5 },
  ]) {
    await prisma.brokerProjectAccess.upsert({
      where: { brokerId_projectId: { brokerId: broker.id, projectId } },
      create: { brokerId: broker.id, projectId, commissionPct: pct, active: true, startsAt: ago(90) },
      update: {},
    });
  }

  // ── 5. Demo clients ───────────────────────────────────────────────────────
  console.log('5/8  Creating demo clients…');
  const ensureClient = async (phone: string, fullName: string) => {
    const existing = await prisma.user.findUnique({ where: { phone } });
    if (existing) return existing;
    return prisma.user.create({ data: { role: UserRole.CLIENT, fullName, phone, locale: 'ar' } });
  };

  const [c1, c2, c3, c4, c5] = await Promise.all([
    ensureClient('+96651100001', 'عبدالله النويصر'),
    ensureClient('+96651100002', 'منال الشهري'),
    ensureClient('+96651100003', 'فيصل الدوسري'),
    ensureClient('+96651100004', 'ريم العتيبي'),
    ensureClient('+96651100005', 'خالد السبيعي'),
  ]);

  // ── 6. Leads ──────────────────────────────────────────────────────────────
  console.log('6/8  Creating leads, reservations, contracts…');

  const ensureLead = async (clientId: string, status: BrokerLeadStatus, daysAgo: number, approvedDaysAgo?: number) => {
    const existing = await prisma.lead.findFirst({ where: { brokerId: broker.id, clientId }, select: { id: true } });
    if (existing) return existing;
    return prisma.lead.create({
      data: {
        clientId,
        fullName: 'عميل تجريبي',
        phone: '+966511000XX',
        brokerId: broker.id,
        brokerAgentId: user.id,
        brokerSubmittedAt: ago(daysAgo),
        brokerApprovalStatus: status,
        brokerApprovedAt: approvedDaysAgo ? ago(approvedDaysAgo) : undefined,
        projectInterestId: pSolara.id,
        assignedSalesId: salesUser.id,
        createdAt: ago(daysAgo),
      },
      select: { id: true },
    });
  };

  const [lead1, lead2, lead3] = await Promise.all([
    ensureLead(c1.id, BrokerLeadStatus.APPROVED, 80, 78),
    ensureLead(c2.id, BrokerLeadStatus.APPROVED, 60, 58),
    ensureLead(c3.id, BrokerLeadStatus.PENDING,  5),
  ]);
  // REJECTED lead (no reservation)
  await ensureLead(c4.id, BrokerLeadStatus.REJECTED, 30);

  // ── Reservations ──────────────────────────────────────────────────────────
  const ensureReservation = async (num: string, unitId: string, clientId: string, leadId: string, status: ReservationStatus, daysAgo: number, bookingAmount: number, commPct: number) => {
    const existing = await prisma.reservation.findUnique({ where: { reservationNumber: num }, select: { id: true } });
    if (existing) return existing;
    return prisma.reservation.create({
      data: {
        reservationNumber: num,
        unitId,
        clientId,
        salesId: salesUser.id,
        leadId,
        brokerId: broker.id,
        brokerAgentId: user.id,
        status,
        bookingAmount,
        bookingPaymentStatus: status === ReservationStatus.CONVERTED ? 'PAID' : 'PENDING',
        bookingPaidAt: status === ReservationStatus.CONVERTED ? ago(daysAgo - 1) : undefined,
        commissionLockedPct: commPct,
        commissionLockedAmount: 2150000 * commPct / 100,
        expiresAt: future(30),
        approvedAt: status !== ReservationStatus.PENDING ? ago(daysAgo - 1) : undefined,
        convertedAt: status === ReservationStatus.CONVERTED ? ago(daysAgo - 3) : undefined,
        createdAt: ago(daysAgo),
      },
      select: { id: true },
    });
  };

  const [res1, res2] = await Promise.all([
    ensureReservation('DEMO-BRN-NEW-001', uSH310.id, c1.id, lead1.id, ReservationStatus.CONVERTED, 75, 107500, 2.5),
    ensureReservation('DEMO-BRN-NEW-002', uSH101.id, c2.id, lead2.id, ReservationStatus.APPROVED,  20, 65000,  2.5),
  ]);

  // ── Contracts ─────────────────────────────────────────────────────────────
  const ensureContract = async (num: string, unitId: string, clientId: string, reservationId: string | undefined, totalAmount: number, downPayment: number, signedDaysAgo?: number, createdDaysAgo: number = 0) => {
    const existing = await prisma.contract.findUnique({ where: { contractNumber: num }, select: { id: true } });
    if (existing) return existing;
    return prisma.contract.create({
      data: {
        contractNumber: num,
        customerId: clientId,
        unitId,
        reservationId,
        brokerId: broker.id,
        brokerAgentId: user.id,
        totalAmount,
        downPayment,
        signedAt: signedDaysAgo ? ago(signedDaysAgo) : undefined,
        createdAt: ago(createdDaysAgo),
      },
      select: { id: true },
    });
  };

  const [con1, con2, con3] = await Promise.all([
    ensureContract('DEMO-BCN-NEW-001', uSH310.id, c1.id, res1.id, 2150000, 430000, 70, 72),
    ensureContract('DEMO-BCN-NEW-002', uA101.id,  c5.id, undefined, 850000,  170000, 40, 42),
    ensureContract('DEMO-BCN-NEW-003', uB101.id,  c3.id, undefined, 1180000, 236000, undefined, 8),
  ]);

  // ── 7. Commissions & Payouts ──────────────────────────────────────────────
  console.log('7/8  Creating commissions and payouts…');

  const ensureCommission = async (num: string, contractId: string, unitId: string, projectId: string, reservationId: string | undefined, basisAmount: number, commPct: number, status: BrokerCommissionStatus, earnedDaysAgo: number, approvedDaysAgo?: number) => {
    const existing = await prisma.brokerCommission.findUnique({
      where: { commissionNumber: num },
      select: { id: true, grossAmount: true, taxAmount: true, withholdingAmount: true, netAmount: true },
    });
    if (existing) return existing;
    const gross = basisAmount * commPct / 100;
    const taxAmount = gross * 0.15;
    const netAmount = gross; // no withholding for demo
    return prisma.brokerCommission.create({
      data: {
        commissionNumber: num,
        brokerId: broker.id,
        brokerAgentId: user.id,
        contractId,
        reservationId,
        unitId,
        projectId,
        basisAmount,
        commissionPct: commPct,
        grossAmount: gross,
        taxPct: 15,
        taxAmount,
        withholdingPct: 0,
        withholdingAmount: 0,
        netAmount,
        status,
        earnedAt: ago(earnedDaysAgo),
        approvedById: approvedDaysAgo ? adminUser.id : undefined,
        approvedAt: approvedDaysAgo ? ago(approvedDaysAgo) : undefined,
        createdAt: ago(earnedDaysAgo),
      },
      select: { id: true, grossAmount: true, taxAmount: true, withholdingAmount: true, netAmount: true },
    });
  };

  const [cm1, cm2, cm3] = await Promise.all([
    ensureCommission('BCM-DEMO-NEW-001', con1.id, uSH310.id, pSolara.id, res1.id, 2150000, 2.5, BrokerCommissionStatus.APPROVED, 68, 62),
    ensureCommission('BCM-DEMO-NEW-002', con2.id, uA101.id,  pRiyadh.id, undefined,  850000, 2.5, BrokerCommissionStatus.APPROVED, 38, 32),
    ensureCommission('BCM-DEMO-NEW-003', con3.id, uB101.id,  pRiyadh.id, undefined, 1180000, 2.5, BrokerCommissionStatus.PENDING,   6),
  ]);

  // Payout — PAID (covers cm1 + cm2)
  const existingPayout = await prisma.brokerPayout.findUnique({ where: { payoutNumber: 'BPO-DEMO-NEW-001' }, select: { id: true } });
  if (!existingPayout) {
    const totalGross = Number(cm1.grossAmount) + Number(cm2.grossAmount);
    const totalTax   = Number(cm1.taxAmount)   + Number(cm2.taxAmount);
    const totalNet   = Number(cm1.netAmount)    + Number(cm2.netAmount);

    const payout = await prisma.brokerPayout.create({
      data: {
        payoutNumber: 'BPO-DEMO-NEW-001',
        brokerId: broker.id,
        period: '2026-04',
        totalGross,
        totalTax,
        totalWithholding: 0,
        totalNet,
        status: BrokerPayoutStatus.PAID,
        paymentMethod: BrokerPayoutMethod.BANK_TRANSFER,
        paymentReference: 'DEMO-TRF-NEW-001',
        approvedById: adminUser.id,
        approvedAt: ago(28),
        processedById: adminUser.id,
        processedAt: ago(20),
        paidAt: ago(20),
        createdAt: ago(32),
      },
      select: { id: true },
    });

    // Link commissions to payout
    await prisma.brokerCommission.updateMany({
      where: { id: { in: [cm1.id, cm2.id] } },
      data: { payoutId: payout.id },
    });
  }

  // ── 8. Activity log ───────────────────────────────────────────────────────
  // Lead/reservation/contract/commission events → LeadActivity rows
  // Payout events → BrokerActivityLog rows (PAYOUT_* enum only)
  console.log('8/8  Creating activity log…');

  const ensureLeadActivity = async (leadId: string, type: LeadActivityType, daysAgo: number, meta: object) => {
    const existing = await prisma.leadActivity.findFirst({
      where: { leadId, type, createdAt: { gte: ago(daysAgo + 1), lte: ago(daysAgo - 1) } },
      select: { id: true },
    });
    if (existing) return;
    await prisma.leadActivity.create({ data: { leadId, type, payload: meta, createdAt: ago(daysAgo) } });
  };

  const ensurePayoutActivity = async (type: BrokerPayoutStatus, daysAgo: number, meta: object) => {
    // Map payout status → BrokerActivityType
    const typeMap: Record<string, string> = {
      DRAFT: 'PAYOUT_CREATED',
      APPROVED: 'PAYOUT_APPROVED',
      PROCESSING: 'PAYOUT_PROCESSING',
      PAID: 'PAYOUT_PAID',
      CANCELLED: 'PAYOUT_CANCELLED',
    };
    const actType = typeMap[type] as never;
    const existing = await prisma.brokerActivityLog.findFirst({
      where: { brokerId: broker.id, type: actType, createdAt: { gte: ago(daysAgo + 1), lte: ago(daysAgo - 1) } },
      select: { id: true },
    });
    if (existing) return;
    await prisma.brokerActivityLog.create({
      data: {
        brokerId: broker.id,
        brokerAgentId: user.id,
        type: actType,
        entityType: 'Payout',
        payload: meta,
        createdAt: ago(daysAgo),
      },
    });
  };

  // Lead 1 (c1) activity chain
  await ensureLeadActivity(lead1.id, 'broker_submitted',          80, { clientName: 'عبدالله النويصر' });
  await ensureLeadActivity(lead1.id, 'broker_approved',           78, { clientName: 'عبدالله النويصر' });
  await ensureLeadActivity(lead1.id, 'broker_reservation_created',75, { reservationNumber: 'DEMO-BRN-NEW-001' });
  await ensureLeadActivity(lead1.id, 'broker_contract_created',   72, { contractNumber: 'DEMO-BCN-NEW-001' });
  await ensureLeadActivity(lead1.id, 'broker_contract_signed',    70, { contractNumber: 'DEMO-BCN-NEW-001' });
  await ensureLeadActivity(lead1.id, 'broker_commission_earned',  68, { commissionNumber: 'BCM-DEMO-NEW-001' });
  await ensureLeadActivity(lead1.id, 'broker_commission_approved',32, { commissionNumber: 'BCM-DEMO-NEW-001' });

  // Lead 2 (c2) activity chain
  await ensureLeadActivity(lead2.id, 'broker_submitted',          60, { clientName: 'منال الشهري' });
  await ensureLeadActivity(lead2.id, 'broker_approved',           58, { clientName: 'منال الشهري' });
  await ensureLeadActivity(lead2.id, 'broker_commission_earned',  38, { commissionNumber: 'BCM-DEMO-NEW-002' });
  await ensureLeadActivity(lead2.id, 'broker_commission_approved',32, { commissionNumber: 'BCM-DEMO-NEW-002' });

  // Lead 3 (c3) — pending
  await ensureLeadActivity(lead3.id, 'broker_submitted',           5, { clientName: 'فيصل الدوسري' });
  await ensureLeadActivity(lead3.id, 'broker_contract_created',    8, { contractNumber: 'DEMO-BCN-NEW-003' });
  await ensureLeadActivity(lead3.id, 'broker_commission_earned',   6, { commissionNumber: 'BCM-DEMO-NEW-003' });

  // Payout activity (BrokerActivityLog — PAYOUT_* enum)
  await ensurePayoutActivity(BrokerPayoutStatus.DRAFT,    32, { payoutNumber: 'BPO-DEMO-NEW-001' });
  await ensurePayoutActivity(BrokerPayoutStatus.APPROVED, 28, { payoutNumber: 'BPO-DEMO-NEW-001' });
  await ensurePayoutActivity(BrokerPayoutStatus.PAID,     20, { payoutNumber: 'BPO-DEMO-NEW-001' });

  console.log('');
  console.log('✅ Done! Portal account is fully populated.');
  console.log('');
  console.log(`   Email:    ${EMAIL}`);
  console.log(`   Password: ${PASSWORD}`);
  console.log('');
  console.log('   Data seeded:');
  console.log('   • 2 projects with access (Solara Heights, New Riyadh Compound)');
  console.log('   • 5 clients · 4 leads (approved, pending, rejected)');
  console.log('   • 2 reservations (converted + approved)');
  console.log('   • 3 contracts (2 signed, 1 unsigned)');
  console.log('   • 3 commissions (2 approved, 1 pending)');
  console.log('   • 1 payout PAID (covers 2 commissions)');
  console.log('   • 18 activity log entries');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
