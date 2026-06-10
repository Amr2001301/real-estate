/**
 * seed-broker-demo.ts — Development-only broker demo data
 *
 * Creates realistic connected broker data so all 7 broker admin pages
 * load with populated tables, KPIs, filters, and reports.
 *
 * SAFETY:
 *   • Aborts immediately if NODE_ENV === "production".
 *   • All demo records use clearly-identifiable codes prefixed DEMO-BR-*,
 *     DEMO-BRN-*, DEMO-BCN-*, BCM-DEMO-*, BPO-DEMO-*.
 *   • Fully idempotent — safe to run multiple times (upserts on unique keys).
 *
 * PREREQUISITE:
 *   Run the dev seed first (with SEED_PUBLIC_DEMO=true) so projects/units
 *   exist. The e2e seed is NOT required.
 *
 * USAGE:
 *   cd apps/api
 *   SEED_PUBLIC_DEMO=true pnpm prisma:seed           # (if not already done)
 *   pnpm tsx prisma/seed-broker-demo.ts
 *
 * OR add to package.json scripts:
 *   "prisma:seed:brokers": "tsx prisma/seed-broker-demo.ts"
 *
 * REMOVE DEMO DATA:
 *   pnpm tsx prisma/seed-broker-demo.ts --cleanup
 */

import {
  BrokerCommissionStatus,
  BrokerLeadStatus,
  BrokerPayoutMethod,
  BrokerPayoutStatus,
  BrokerStatus,
  BrokerUserStatus,
  PrismaClient,
  ReservationStatus,
  UserRole,
} from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

// ── Safety guard ────────────────────────────────────────────────────────────

if (process.env.NODE_ENV === 'production') {
  console.error('❌ seed-broker-demo must NOT run in production. Aborting.');
  process.exit(1);
}

// ── Stable demo codes (idempotency keys) ────────────────────────────────────

const BROKER_CODES = {
  B1: 'DEMO-BR-01',
  B2: 'DEMO-BR-02',
  B3: 'DEMO-BR-03',
  B4: 'DEMO-BR-04',
  B5: 'DEMO-BR-05',
} as const;

// ── Helper: look up a unit by traversing project→phase→building→code ────────

async function findUnit(
  projectNameEn: string,
  buildingName: string,
  unitCode: string,
): Promise<{ id: string; price: { toString(): string } } | null> {
  const project = await prisma.project.findFirst({
    where: { name: { path: ['en'], equals: projectNameEn } },
    select: { id: true },
  });
  if (!project) return null;

  const building = await prisma.building.findFirst({
    where: { name: buildingName, phase: { projectId: project.id } },
    select: { id: true },
  });
  if (!building) return null;

  return prisma.unit.findUnique({
    where: { buildingId_code: { buildingId: building.id, code: unitCode } },
    select: { id: true, price: true },
  });
}

// ── Helper: ensure a demo CLIENT user by phone ───────────────────────────────

async function ensureDemoClient(
  phone: string,
  fullName: string,
): Promise<{ id: string }> {
  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing) return { id: existing.id };
  return prisma.user.create({
    data: { role: UserRole.CLIENT, fullName, phone, locale: 'ar' },
    select: { id: true },
  });
}

// ── Helper: ensure a demo BROKER role user ───────────────────────────────────

async function ensureDemoBrokerUser(
  email: string,
  fullName: string,
): Promise<{ id: string }> {
  const hash = await argon2.hash('DemoPass123!');
  return prisma.user.upsert({
    where: { email },
    create: { email, passwordHash: hash, fullName, role: UserRole.BROKER, locale: 'ar' },
    update: {},
    select: { id: true },
  });
}

// ── Cleanup mode ─────────────────────────────────────────────────────────────

async function cleanup(): Promise<void> {
  console.log('🗑️  Removing demo broker data…');

  // Delete in dependency order
  const brokers = await prisma.broker.findMany({
    where: { code: { in: Object.values(BROKER_CODES) } },
    select: { id: true },
  });
  const brokerIds = brokers.map((b) => b.id);

  if (brokerIds.length === 0) {
    console.log('   Nothing to remove — no demo brokers found.');
    return;
  }

  // Payouts (cascade removes commission→payout links via FK)
  await prisma.brokerPayout.deleteMany({ where: { brokerId: { in: brokerIds } } });
  await prisma.brokerCommission.deleteMany({ where: { brokerId: { in: brokerIds } } });
  await prisma.brokerActivityLog.deleteMany({ where: { brokerId: { in: brokerIds } } });

  // Contracts / reservations / leads with broker attribution
  const contracts = await prisma.contract.findMany({
    where: { brokerId: { in: brokerIds } },
    select: { id: true, contractNumber: true },
  });
  const contractIds = contracts.map((c) => c.id);
  const demoContractNumbers = contracts
    .map((c) => c.contractNumber)
    .filter((n): n is string => n?.startsWith('DEMO-BCN-') ?? false);

  await prisma.contract.deleteMany({
    where: { contractNumber: { in: demoContractNumbers } },
  });

  const demoReservationNumbers = (
    await prisma.reservation.findMany({
      where: { reservationNumber: { startsWith: 'DEMO-BRN-' } },
      select: { reservationNumber: true },
    })
  )
    .map((r) => r.reservationNumber)
    .filter((n): n is string => n !== null);
  await prisma.reservation.deleteMany({
    where: { reservationNumber: { in: demoReservationNumbers } },
  });

  // Leads
  await prisma.lead.deleteMany({ where: { brokerId: { in: brokerIds } } });

  // Broker access
  await prisma.brokerProjectAccess.deleteMany({ where: { brokerId: { in: brokerIds } } });
  await prisma.brokerUnitAccess.deleteMany({ where: { brokerId: { in: brokerIds } } });

  // BrokerUser rows (FK cascade removes when broker is deleted but delete explicitly first)
  const brokerUserIds = (
    await prisma.brokerUser.findMany({
      where: { brokerId: { in: brokerIds } },
      select: { userId: true },
    })
  ).map((bu) => bu.userId);
  await prisma.brokerUser.deleteMany({ where: { brokerId: { in: brokerIds } } });

  // Broker firms
  await prisma.broker.deleteMany({ where: { id: { in: brokerIds } } });

  // Demo BROKER role users (only those we created — identifiable by @devora-demo.com)
  await prisma.user.deleteMany({
    where: { email: { endsWith: '@devora-demo.com' }, role: UserRole.BROKER },
  });

  // Demo CLIENT users (phones +96650010XXXX)
  await prisma.user.deleteMany({
    where: { phone: { startsWith: '+9665001000' }, role: UserRole.CLIENT },
  });

  console.log('✅  Demo broker data removed.');
}

// ── Main seed ─────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  if (process.argv.includes('--cleanup')) {
    await cleanup();
    return;
  }

  console.log('🏢  Seeding broker demo data…');

  // ── Resolve prerequisite users ─────────────────────────────────────────────
  const adminUser = await prisma.user.findFirst({
    where: { role: UserRole.ADMIN },
    select: { id: true },
  });
  if (!adminUser) throw new Error('No ADMIN user found — run the dev seed first.');

  const salesUser = await prisma.user.findFirst({
    where: { email: 'sales@example.com' },
    select: { id: true },
  });
  if (!salesUser) throw new Error('Sales user not found — run the dev seed first.');

  // ── Resolve projects ────────────────────────────────────────────────────────
  async function getProject(nameEn: string) {
    const p = await prisma.project.findFirst({
      where: { name: { path: ['en'], equals: nameEn } },
      select: { id: true },
    });
    if (!p) throw new Error(`Project "${nameEn}" not found — run dev seed with SEED_PUBLIC_DEMO=true`);
    return p;
  }

  const [pRiyadh, pNileCrest, pPalm, pSolara] = await Promise.all([
    getProject('New Riyadh Compound'),
    getProject('Nile Crest Residences'),
    getProject('Palm District'),
    getProject('Solara Heights'),
  ]);

  // ── Resolve units ───────────────────────────────────────────────────────────
  async function requireUnit(
    projectNameEn: string,
    buildingName: string,
    code: string,
  ) {
    const u = await findUnit(projectNameEn, buildingName, code);
    if (!u) throw new Error(`Unit ${code} in "${buildingName}" / "${projectNameEn}" not found`);
    return u;
  }

  const [
    uA101, uA102, uA201, uA301,
    uNCA101, uNCA102, uNCA201, uNCA305,
    uPDT01, uPDV01, uPDV02,
    uSH310, uSH1201, uSH1505,
  ] = await Promise.all([
    requireUnit('New Riyadh Compound', 'Building A', 'A-101'),
    requireUnit('New Riyadh Compound', 'Building A', 'A-102'),
    requireUnit('New Riyadh Compound', 'Building A', 'A-201'),
    requireUnit('New Riyadh Compound', 'Building A', 'A-301'),
    requireUnit('Nile Crest Residences', 'Nile Tower A', 'NC-A-101'),
    requireUnit('Nile Crest Residences', 'Nile Tower A', 'NC-A-102'),
    requireUnit('Nile Crest Residences', 'Nile Tower A', 'NC-A-201'),
    requireUnit('Nile Crest Residences', 'Nile Tower A', 'NC-A-305'),
    requireUnit('Palm District', 'Palm Cluster A', 'PD-T-01'),
    requireUnit('Palm District', 'Palm Cluster A', 'PD-V-01'),
    requireUnit('Palm District', 'Palm Cluster A', 'PD-V-02'),
    requireUnit('Solara Heights', 'Solara Tower One', 'SH-310'),
    requireUnit('Solara Heights', 'Solara Tower One', 'SH-1201'),
    requireUnit('Solara Heights', 'Solara Tower One', 'SH-1505'),
  ]);

  // ── 1. Broker firms ─────────────────────────────────────────────────────────
  console.log('   Creating broker firms…');

  const d = (months: number) => {
    const dt = new Date();
    dt.setMonth(dt.getMonth() - months);
    return dt;
  };

  const [b1, b2, b3, b4, b5] = await Promise.all([
    prisma.broker.upsert({
      where: { code: BROKER_CODES.B1 },
      create: {
        code: BROKER_CODES.B1,
        companyName: 'شركة المهيدب للعقارات',
        commercialName: 'Al-Muhaidib Real Estate',
        email: 'info@demo-muhaidib.com',
        phone: '+966112000001',
        address: 'طريق الملك فهد، حي العليا',
        city: 'الرياض',
        taxId: 'DEMO-TAX-001',
        commercialRegistration: 'DEMO-CR-001',
        bankName: 'بنك الرياض',
        bankAccountName: 'شركة المهيدب للعقارات',
        bankIban: 'SA0380000000608010167519',
        defaultCommissionPct: 2.5,
        status: BrokerStatus.ACTIVE,
        contractStartAt: d(12),
        contractEndAt: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
        createdById: adminUser.id,
        notes: 'وكيل معتمد في منطقة الرياض',
      },
      update: {},
      select: { id: true },
    }),
    prisma.broker.upsert({
      where: { code: BROKER_CODES.B2 },
      create: {
        code: BROKER_CODES.B2,
        companyName: 'دار المشاريع العقارية',
        commercialName: 'Dar Al-Mashari Real Estate',
        email: 'contact@demo-mashari.com',
        phone: '+966122000002',
        address: 'شارع التحلية، جدة',
        city: 'جدة',
        taxId: 'DEMO-TAX-002',
        commercialRegistration: 'DEMO-CR-002',
        bankName: 'البنك الأهلي',
        bankAccountName: 'دار المشاريع العقارية',
        bankIban: 'SA4420000001234567891234',
        defaultCommissionPct: 3.0,
        status: BrokerStatus.ACTIVE,
        contractStartAt: d(8),
        contractEndAt: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
        createdById: adminUser.id,
      },
      update: {},
      select: { id: true },
    }),
    prisma.broker.upsert({
      where: { code: BROKER_CODES.B3 },
      create: {
        code: BROKER_CODES.B3,
        companyName: 'مجموعة العثيم العقارية',
        commercialName: 'Al-Othaim Real Estate Group',
        email: 'hello@demo-othaim.com',
        phone: '+966133000003',
        address: 'طريق الملك عبدالعزيز، الدمام',
        city: 'الدمام',
        taxId: 'DEMO-TAX-003',
        defaultCommissionPct: 2.0,
        status: BrokerStatus.ACTIVE,
        contractStartAt: d(6),
        contractEndAt: new Date(new Date().setFullYear(new Date().getFullYear() + 2)),
        createdById: adminUser.id,
      },
      update: {},
      select: { id: true },
    }),
    prisma.broker.upsert({
      where: { code: BROKER_CODES.B4 },
      create: {
        code: BROKER_CODES.B4,
        companyName: 'شركة الجديدة للتطوير',
        commercialName: 'Al-Jadeedah Development',
        email: 'info@demo-jadeedah.com',
        phone: '+966144000004',
        city: 'الرياض',
        defaultCommissionPct: 2.0,
        status: BrokerStatus.PENDING,
        createdById: adminUser.id,
        notes: 'قيد استكمال التوثيق',
      },
      update: {},
      select: { id: true },
    }),
    prisma.broker.upsert({
      where: { code: BROKER_CODES.B5 },
      create: {
        code: BROKER_CODES.B5,
        companyName: 'مكتب النجم العقاري',
        commercialName: 'Al-Najm Real Estate Office',
        email: 'office@demo-najm.com',
        phone: '+966155000005',
        city: 'جدة',
        defaultCommissionPct: 1.5,
        status: BrokerStatus.SUSPENDED,
        createdById: adminUser.id,
        notes: 'موقوف بسبب مخالفة الشروط',
      },
      update: {},
      select: { id: true },
    }),
  ]);

  // ── 2. Broker users ─────────────────────────────────────────────────────────
  console.log('   Creating broker users…');

  const [
    bu1Owner, bu1Sales, bu1Coord,
    bu2Owner, bu2Sales,
    bu3Owner, bu3Sales,
    bu4Owner,
    bu5Owner,
  ] = await Promise.all([
    ensureDemoBrokerUser('demo.br1.owner@devora-demo.com', 'نواف المهيدب'),
    ensureDemoBrokerUser('demo.br1.sales@devora-demo.com', 'عبدالرحمن محمد'),
    ensureDemoBrokerUser('demo.br1.coord@devora-demo.com', 'سارة العمري'),
    ensureDemoBrokerUser('demo.br2.owner@devora-demo.com', 'خالد الزهراني'),
    ensureDemoBrokerUser('demo.br2.sales@devora-demo.com', 'ريم القحطاني'),
    ensureDemoBrokerUser('demo.br3.owner@devora-demo.com', 'فيصل العثيم'),
    ensureDemoBrokerUser('demo.br3.sales@devora-demo.com', 'هند المطيري'),
    ensureDemoBrokerUser('demo.br4.owner@devora-demo.com', 'أحمد الجديدة'),
    ensureDemoBrokerUser('demo.br5.owner@devora-demo.com', 'محمد النجم'),
  ]);

  // Link users to firms via BrokerUser (unique on userId)
  await Promise.all([
    prisma.brokerUser.upsert({
      where: { userId: bu1Owner.id },
      create: { userId: bu1Owner.id, brokerId: b1.id, jobTitle: 'المدير العام', isPrimaryContact: true, canManageBrokerUsers: true, canViewCommissions: true, status: BrokerUserStatus.ACTIVE, joinedAt: d(12) },
      update: {},
    }),
    prisma.brokerUser.upsert({
      where: { userId: bu1Sales.id },
      create: { userId: bu1Sales.id, brokerId: b1.id, jobTitle: 'مندوب مبيعات', isPrimaryContact: false, canViewCommissions: true, status: BrokerUserStatus.ACTIVE, joinedAt: d(10) },
      update: {},
    }),
    prisma.brokerUser.upsert({
      where: { userId: bu1Coord.id },
      create: { userId: bu1Coord.id, brokerId: b1.id, jobTitle: 'منسق عمليات', isPrimaryContact: false, canViewCommissions: false, status: BrokerUserStatus.ACTIVE, joinedAt: d(9) },
      update: {},
    }),
    prisma.brokerUser.upsert({
      where: { userId: bu2Owner.id },
      create: { userId: bu2Owner.id, brokerId: b2.id, jobTitle: 'المدير العام', isPrimaryContact: true, canManageBrokerUsers: true, canViewCommissions: true, status: BrokerUserStatus.ACTIVE, joinedAt: d(8) },
      update: {},
    }),
    prisma.brokerUser.upsert({
      where: { userId: bu2Sales.id },
      create: { userId: bu2Sales.id, brokerId: b2.id, jobTitle: 'مستشار مبيعات', isPrimaryContact: false, canViewCommissions: true, status: BrokerUserStatus.ACTIVE, joinedAt: d(7) },
      update: {},
    }),
    prisma.brokerUser.upsert({
      where: { userId: bu3Owner.id },
      create: { userId: bu3Owner.id, brokerId: b3.id, jobTitle: 'المدير العام', isPrimaryContact: true, canManageBrokerUsers: true, canViewCommissions: true, status: BrokerUserStatus.ACTIVE, joinedAt: d(6) },
      update: {},
    }),
    prisma.brokerUser.upsert({
      where: { userId: bu3Sales.id },
      create: { userId: bu3Sales.id, brokerId: b3.id, jobTitle: 'مندوب مبيعات', isPrimaryContact: false, canViewCommissions: true, status: BrokerUserStatus.ACTIVE, joinedAt: d(5) },
      update: {},
    }),
    prisma.brokerUser.upsert({
      where: { userId: bu4Owner.id },
      create: { userId: bu4Owner.id, brokerId: b4.id, jobTitle: 'المالك', isPrimaryContact: true, canViewCommissions: true, status: BrokerUserStatus.INVITED, invitedAt: d(1) },
      update: {},
    }),
    prisma.brokerUser.upsert({
      where: { userId: bu5Owner.id },
      create: { userId: bu5Owner.id, brokerId: b5.id, jobTitle: 'المالك', isPrimaryContact: true, canViewCommissions: true, status: BrokerUserStatus.SUSPENDED },
      update: {},
    }),
  ]);

  // ── 3. Project access ──────────────────────────────────────────────────────
  console.log('   Granting project access…');

  const projectGrants = [
    { brokerId: b1.id, projectId: pRiyadh.id, commissionPct: 2.5 },
    { brokerId: b1.id, projectId: pNileCrest.id, commissionPct: 2.5 },
    { brokerId: b2.id, projectId: pPalm.id, commissionPct: 3.0 },
    { brokerId: b2.id, projectId: pSolara.id, commissionPct: 3.0 },
    { brokerId: b3.id, projectId: pRiyadh.id, commissionPct: 2.0 },
    { brokerId: b3.id, projectId: pSolara.id, commissionPct: 2.0 },
    { brokerId: b4.id, projectId: pRiyadh.id, commissionPct: 2.0 },
    { brokerId: b5.id, projectId: pPalm.id, commissionPct: 1.5 },
  ];
  await Promise.all(
    projectGrants.map((g) =>
      prisma.brokerProjectAccess.upsert({
        where: { brokerId_projectId: { brokerId: g.brokerId, projectId: g.projectId } },
        create: { brokerId: g.brokerId, projectId: g.projectId, commissionPct: g.commissionPct, active: true, startsAt: d(12) },
        update: {},
      }),
    ),
  );

  // ── 4. Demo clients ─────────────────────────────────────────────────────────
  console.log('   Creating demo clients…');

  const clients = await Promise.all([
    ensureDemoClient('+96650010001', 'عبدالله الغامدي'),
    ensureDemoClient('+96650010002', 'نورة السبيعي'),
    ensureDemoClient('+96650010003', 'طارق العنزي'),
    ensureDemoClient('+96650010004', 'منال الشمري'),
    ensureDemoClient('+96650010005', 'يوسف الحربي'),
    ensureDemoClient('+96650010006', 'لمياء الدوسري'),
    ensureDemoClient('+96650010007', 'سلطان المالكي'),
    ensureDemoClient('+96650010008', 'ديمة الزهراني'),
    ensureDemoClient('+96650010009', 'راشد القرني'),
    ensureDemoClient('+96650010010', 'هيا الرشيدي'),
    ensureDemoClient('+96650010011', 'بندر العتيبي'),
    ensureDemoClient('+96650010012', 'ريم الجهني'),
    ensureDemoClient('+96650010013', 'عمر البقمي'),
    ensureDemoClient('+96650010014', 'فاطمة الحازمي'),
  ]);

  // ── 5. Broker leads ─────────────────────────────────────────────────────────
  console.log('   Creating broker leads…');

  type LeadSpec = {
    phone: string;
    fullName: string;
    clientId: string;
    brokerId: string;
    brokerAgentId: string;
    projectId: string;
    assignedSalesId?: string;
    status: BrokerLeadStatus;
    daysAgo: number;
    approvedDaysAgo?: number;
    rejectedDaysAgo?: number;
    rejectionReason?: string;
  };

  const leadSpecs: LeadSpec[] = [
    // APPROVED leads (to support reservations below)
    { phone: '+96650010001', fullName: 'عبدالله الغامدي', clientId: clients[0].id, brokerId: b1.id, brokerAgentId: bu1Sales.id, projectId: pNileCrest.id, assignedSalesId: salesUser.id, status: BrokerLeadStatus.APPROVED, daysAgo: 90, approvedDaysAgo: 88 },
    { phone: '+96650010002', fullName: 'نورة السبيعي',   clientId: clients[1].id, brokerId: b1.id, brokerAgentId: bu1Owner.id, projectId: pNileCrest.id, assignedSalesId: salesUser.id, status: BrokerLeadStatus.APPROVED, daysAgo: 80, approvedDaysAgo: 78 },
    { phone: '+96650010003', fullName: 'طارق العنزي',    clientId: clients[2].id, brokerId: b2.id, brokerAgentId: bu2Sales.id, projectId: pPalm.id,      assignedSalesId: salesUser.id, status: BrokerLeadStatus.APPROVED, daysAgo: 75, approvedDaysAgo: 73 },
    { phone: '+96650010004', fullName: 'منال الشمري',    clientId: clients[3].id, brokerId: b2.id, brokerAgentId: bu2Owner.id, projectId: pSolara.id,    assignedSalesId: salesUser.id, status: BrokerLeadStatus.APPROVED, daysAgo: 70, approvedDaysAgo: 68 },
    { phone: '+96650010005', fullName: 'يوسف الحربي',    clientId: clients[4].id, brokerId: b3.id, brokerAgentId: bu3Sales.id, projectId: pRiyadh.id,   assignedSalesId: salesUser.id, status: BrokerLeadStatus.APPROVED, daysAgo: 65, approvedDaysAgo: 63 },
    { phone: '+96650010014', fullName: 'فاطمة الحازمي', clientId: clients[13].id, brokerId: b2.id, brokerAgentId: bu2Sales.id, projectId: pPalm.id,     assignedSalesId: salesUser.id, status: BrokerLeadStatus.APPROVED, daysAgo: 60, approvedDaysAgo: 58 },
    // PENDING leads
    { phone: '+96650010006', fullName: 'لمياء الدوسري',  clientId: clients[5].id, brokerId: b1.id, brokerAgentId: bu1Owner.id, projectId: pRiyadh.id,  status: BrokerLeadStatus.PENDING, daysAgo: 5 },
    { phone: '+96650010007', fullName: 'سلطان المالكي',   clientId: clients[6].id, brokerId: b2.id, brokerAgentId: bu2Sales.id, projectId: pSolara.id, status: BrokerLeadStatus.PENDING, daysAgo: 3 },
    { phone: '+96650010008', fullName: 'ديمة الزهراني',   clientId: clients[7].id, brokerId: b3.id, brokerAgentId: bu3Owner.id, projectId: pNileCrest.id, status: BrokerLeadStatus.PENDING, daysAgo: 2 },
    { phone: '+96650010013', fullName: 'عمر البقمي',      clientId: clients[12].id, brokerId: b4.id, brokerAgentId: bu4Owner.id, projectId: pRiyadh.id, status: BrokerLeadStatus.PENDING, daysAgo: 1 },
    // REJECTED leads
    { phone: '+96650010009', fullName: 'راشد القرني',     clientId: clients[8].id, brokerId: b1.id, brokerAgentId: bu1Sales.id, projectId: pPalm.id,   status: BrokerLeadStatus.REJECTED, daysAgo: 45, rejectedDaysAgo: 44, rejectionReason: 'العميل مسجل مسبقاً في قاعدة بياناتنا' },
    { phone: '+96650010010', fullName: 'هيا الرشيدي',     clientId: clients[9].id, brokerId: b2.id, brokerAgentId: bu2Owner.id, projectId: pRiyadh.id, status: BrokerLeadStatus.REJECTED, daysAgo: 30, rejectedDaysAgo: 29, rejectionReason: 'بيانات العميل غير مكتملة' },
    // DUPLICATE leads
    { phone: '+96650010011', fullName: 'بندر العتيبي',    clientId: clients[10].id, brokerId: b1.id, brokerAgentId: bu1Owner.id, projectId: pRiyadh.id, status: BrokerLeadStatus.DUPLICATE, daysAgo: 20 },
    { phone: '+96650010012', fullName: 'ريم الجهني',      clientId: clients[11].id, brokerId: b3.id, brokerAgentId: bu3Sales.id, projectId: pSolara.id, status: BrokerLeadStatus.DUPLICATE, daysAgo: 15 },
  ];

  const createdLeads: { id: string; clientId: string; brokerId: string }[] = [];
  for (const spec of leadSpecs) {
    const ago = (n: number) => { const dt = new Date(); dt.setDate(dt.getDate() - n); return dt; };
    const existing = await prisma.lead.findFirst({
      where: { brokerId: spec.brokerId, clientId: spec.clientId },
      select: { id: true },
    });
    if (existing) {
      createdLeads.push({ id: existing.id, clientId: spec.clientId, brokerId: spec.brokerId });
      continue;
    }
    const lead = await prisma.lead.create({
      data: {
        clientId: spec.clientId,
        fullName: spec.fullName,
        phone: spec.phone,
        brokerId: spec.brokerId,
        brokerAgentId: spec.brokerAgentId,
        brokerSubmittedAt: ago(spec.daysAgo),
        brokerApprovalStatus: spec.status,
        brokerApprovedAt: spec.approvedDaysAgo ? ago(spec.approvedDaysAgo) : undefined,
        brokerRejectedAt: spec.rejectedDaysAgo ? ago(spec.rejectedDaysAgo) : undefined,
        brokerRejectionReason: spec.rejectionReason,
        projectInterestId: spec.projectId,
        assignedSalesId: spec.assignedSalesId,
        createdAt: ago(spec.daysAgo),
      },
      select: { id: true },
    });
    createdLeads.push({ id: lead.id, clientId: spec.clientId, brokerId: spec.brokerId });
  }

  // Build a lookup from (brokerId, clientId) → leadId for reservations below
  const leadMap = new Map<string, string>();
  for (const l of createdLeads) {
    leadMap.set(`${l.brokerId}:${l.clientId}`, l.id);
  }

  // ── 6. Broker reservations ──────────────────────────────────────────────────
  console.log('   Creating broker reservations…');

  const ago = (n: number) => { const dt = new Date(); dt.setDate(dt.getDate() - n); return dt; };
  const future = (n: number) => { const dt = new Date(); dt.setDate(dt.getDate() + n); return dt; };

  type ResSpec = {
    number: string;
    unitId: string;
    clientId: string;
    brokerId: string;
    brokerAgentId: string;
    projectId: string;
    status: ReservationStatus;
    daysAgo: number;
    bookingAmount: number;
    commissionLockedPct: number;
  };

  const resSpecs: ResSpec[] = [
    { number: 'DEMO-BRN-001', unitId: uNCA101.id, clientId: clients[0].id, brokerId: b1.id, brokerAgentId: bu1Sales.id, projectId: pNileCrest.id, status: ReservationStatus.CONVERTED, daysAgo: 85, bookingAmount: 60000,  commissionLockedPct: 2.5 },
    { number: 'DEMO-BRN-002', unitId: uNCA201.id, clientId: clients[1].id, brokerId: b1.id, brokerAgentId: bu1Owner.id, projectId: pNileCrest.id, status: ReservationStatus.CONVERTED, daysAgo: 75, bookingAmount: 105000, commissionLockedPct: 2.5 },
    { number: 'DEMO-BRN-003', unitId: uPDT01.id,  clientId: clients[2].id, brokerId: b2.id, brokerAgentId: bu2Sales.id, projectId: pPalm.id,      status: ReservationStatus.CONVERTED, daysAgo: 70, bookingAmount: 195000, commissionLockedPct: 3.0 },
    { number: 'DEMO-BRN-004', unitId: uPDV01.id,  clientId: clients[13].id, brokerId: b2.id, brokerAgentId: bu2Owner.id, projectId: pPalm.id,    status: ReservationStatus.CONVERTED, daysAgo: 55, bookingAmount: 325000, commissionLockedPct: 3.0 },
    { number: 'DEMO-BRN-005', unitId: uSH310.id,  clientId: clients[4].id, brokerId: b3.id, brokerAgentId: bu3Sales.id, projectId: pSolara.id,   status: ReservationStatus.CONVERTED, daysAgo: 60, bookingAmount: 107500, commissionLockedPct: 2.0 },
    { number: 'DEMO-BRN-006', unitId: uA301.id,   clientId: clients[5].id, brokerId: b3.id, brokerAgentId: bu3Owner.id, projectId: pRiyadh.id,   status: ReservationStatus.CONVERTED, daysAgo: 50, bookingAmount: 92500,  commissionLockedPct: 2.0 },
    { number: 'DEMO-BRN-007', unitId: uA102.id,   clientId: clients[6].id, brokerId: b1.id, brokerAgentId: bu1Sales.id, projectId: pRiyadh.id,   status: ReservationStatus.APPROVED,  daysAgo: 10, bookingAmount: 62500,  commissionLockedPct: 2.5 },
    { number: 'DEMO-BRN-008', unitId: uSH1201.id, clientId: clients[7].id, brokerId: b2.id, brokerAgentId: bu2Sales.id, projectId: pSolara.id,   status: ReservationStatus.PENDING,   daysAgo: 2,  bookingAmount: 170000, commissionLockedPct: 3.0 },
  ];

  const reservationIds = new Map<string, string>();
  for (const spec of resSpecs) {
    const existing = await prisma.reservation.findUnique({
      where: { reservationNumber: spec.number },
      select: { id: true },
    });
    if (existing) { reservationIds.set(spec.number, existing.id); continue; }

    const leadId = leadMap.get(`${spec.brokerId}:${spec.clientId}`);
    const commissionLockedAmount = Number(uNCA101.price) * spec.commissionLockedPct / 100;

    const res = await prisma.reservation.create({
      data: {
        reservationNumber: spec.number,
        unitId: spec.unitId,
        salesId: salesUser.id,
        clientId: spec.clientId,
        leadId: leadId ?? undefined,
        brokerId: spec.brokerId,
        brokerAgentId: spec.brokerAgentId,
        status: spec.status,
        bookingAmount: spec.bookingAmount,
        bookingPaymentStatus: spec.status === ReservationStatus.CONVERTED ? 'PAID' : 'PENDING',
        bookingPaidAt: spec.status === ReservationStatus.CONVERTED ? ago(spec.daysAgo - 1) : undefined,
        commissionLockedPct: spec.commissionLockedPct,
        commissionLockedAmount,
        expiresAt: future(30),
        approvedAt: spec.status !== ReservationStatus.PENDING ? ago(spec.daysAgo - 1) : undefined,
        convertedAt: spec.status === ReservationStatus.CONVERTED ? ago(spec.daysAgo - 3) : undefined,
        createdAt: ago(spec.daysAgo),
      },
      select: { id: true },
    });
    reservationIds.set(spec.number, res.id);
  }

  // ── 7. Broker contracts ─────────────────────────────────────────────────────
  console.log('   Creating broker contracts…');

  type ContractSpec = {
    number: string;
    unitId: string;
    clientId: string;
    brokerId: string;
    brokerAgentId: string;
    totalAmount: number;
    downPayment: number;
    reservationNumber?: string;
    signedDaysAgo?: number;
    createdDaysAgo: number;
  };

  const contractSpecs: ContractSpec[] = [
    // From CONVERTED reservations (6)
    { number: 'DEMO-BCN-001', unitId: uNCA101.id, clientId: clients[0].id,  brokerId: b1.id, brokerAgentId: bu1Sales.id, totalAmount: 1200000, downPayment: 240000, reservationNumber: 'DEMO-BRN-001', signedDaysAgo: 80, createdDaysAgo: 82 },
    { number: 'DEMO-BCN-002', unitId: uNCA201.id, clientId: clients[1].id,  brokerId: b1.id, brokerAgentId: bu1Owner.id, totalAmount: 2100000, downPayment: 420000, reservationNumber: 'DEMO-BRN-002', signedDaysAgo: 70, createdDaysAgo: 72 },
    { number: 'DEMO-BCN-003', unitId: uPDT01.id,  clientId: clients[2].id,  brokerId: b2.id, brokerAgentId: bu2Sales.id, totalAmount: 3900000, downPayment: 780000, reservationNumber: 'DEMO-BRN-003', signedDaysAgo: 65, createdDaysAgo: 67 },
    { number: 'DEMO-BCN-004', unitId: uPDV01.id,  clientId: clients[13].id, brokerId: b2.id, brokerAgentId: bu2Owner.id, totalAmount: 6500000, downPayment: 1300000, reservationNumber: 'DEMO-BRN-004', signedDaysAgo: 50, createdDaysAgo: 52 },
    { number: 'DEMO-BCN-005', unitId: uSH310.id,  clientId: clients[4].id,  brokerId: b3.id, brokerAgentId: bu3Sales.id, totalAmount: 2150000, downPayment: 430000, reservationNumber: 'DEMO-BRN-005', signedDaysAgo: 55, createdDaysAgo: 57 },
    { number: 'DEMO-BCN-006', unitId: uA301.id,   clientId: clients[5].id,  brokerId: b3.id, brokerAgentId: bu3Owner.id, totalAmount: 1850000, downPayment: 370000, reservationNumber: 'DEMO-BRN-006', signedDaysAgo: 45, createdDaysAgo: 47 },
    // Direct contracts (no reservation)
    { number: 'DEMO-BCN-007', unitId: uNCA305.id, clientId: clients[8].id,  brokerId: b1.id, brokerAgentId: bu1Owner.id, totalAmount: 3200000, downPayment: 640000, signedDaysAgo: 35, createdDaysAgo: 37 },
    { number: 'DEMO-BCN-008', unitId: uPDV02.id,  clientId: clients[9].id,  brokerId: b2.id, brokerAgentId: bu2Sales.id, totalAmount: 5800000, downPayment: 1160000, signedDaysAgo: 25, createdDaysAgo: 27 },
    { number: 'DEMO-BCN-009', unitId: uA201.id,   clientId: clients[10].id, brokerId: b3.id, brokerAgentId: bu3Sales.id, totalAmount: 1300000, downPayment: 260000, /* unsigned */ createdDaysAgo: 15 },
    { number: 'DEMO-BCN-010', unitId: uNCA102.id, clientId: clients[11].id, brokerId: b1.id, brokerAgentId: bu1Sales.id, totalAmount: 1450000, downPayment: 290000, signedDaysAgo: 10, createdDaysAgo: 12 },
  ];

  const contractIds = new Map<string, string>();
  for (const spec of contractSpecs) {
    const existing = await prisma.contract.findUnique({
      where: { contractNumber: spec.number },
      select: { id: true },
    });
    if (existing) { contractIds.set(spec.number, existing.id); continue; }

    const reservationId = spec.reservationNumber ? reservationIds.get(spec.reservationNumber) : undefined;
    const contract = await prisma.contract.create({
      data: {
        contractNumber: spec.number,
        customerId: spec.clientId,
        unitId: spec.unitId,
        reservationId: reservationId ?? undefined,
        brokerId: spec.brokerId,
        brokerAgentId: spec.brokerAgentId,
        totalAmount: spec.totalAmount,
        downPayment: spec.downPayment,
        signedAt: spec.signedDaysAgo ? ago(spec.signedDaysAgo) : undefined,
        createdAt: ago(spec.createdDaysAgo),
      },
      select: { id: true },
    });
    contractIds.set(spec.number, contract.id);
  }

  // ── 8. Broker commissions ───────────────────────────────────────────────────
  console.log('   Creating broker commissions…');

  type CommissionSpec = {
    number: string;
    contractNumber: string;
    brokerId: string;
    brokerAgentId: string;
    unitId: string;
    projectId: string;
    reservationNumber?: string;
    basisAmount: number;
    commissionPct: number;
    taxPct: number;
    withholdingPct: number;
    status: BrokerCommissionStatus;
    earnedDaysAgo: number;
    approvedDaysAgo?: number;
    rejectedDaysAgo?: number;
    rejectionReason?: string;
  };

  const commissionSpecs: CommissionSpec[] = [
    // PAID (oldest, in payout 1)
    { number: 'BCM-DEMO-001', contractNumber: 'DEMO-BCN-001', brokerId: b1.id, brokerAgentId: bu1Sales.id, unitId: uNCA101.id, projectId: pNileCrest.id, reservationNumber: 'DEMO-BRN-001', basisAmount: 1200000, commissionPct: 2.5, taxPct: 15, withholdingPct: 5, status: BrokerCommissionStatus.APPROVED, earnedDaysAgo: 80, approvedDaysAgo: 75 },
    { number: 'BCM-DEMO-002', contractNumber: 'DEMO-BCN-002', brokerId: b1.id, brokerAgentId: bu1Owner.id, unitId: uNCA201.id, projectId: pNileCrest.id, reservationNumber: 'DEMO-BRN-002', basisAmount: 2100000, commissionPct: 2.5, taxPct: 15, withholdingPct: 0, status: BrokerCommissionStatus.APPROVED, earnedDaysAgo: 70, approvedDaysAgo: 65 },
    // PAID (in payout 2)
    { number: 'BCM-DEMO-003', contractNumber: 'DEMO-BCN-003', brokerId: b2.id, brokerAgentId: bu2Sales.id, unitId: uPDT01.id,  projectId: pPalm.id,      reservationNumber: 'DEMO-BRN-003', basisAmount: 3900000, commissionPct: 3.0, taxPct: 15, withholdingPct: 0, status: BrokerCommissionStatus.APPROVED, earnedDaysAgo: 65, approvedDaysAgo: 60 },
    // APPROVED (in payout 3 = approved)
    { number: 'BCM-DEMO-004', contractNumber: 'DEMO-BCN-004', brokerId: b2.id, brokerAgentId: bu2Owner.id, unitId: uPDV01.id,  projectId: pPalm.id,      reservationNumber: 'DEMO-BRN-004', basisAmount: 6500000, commissionPct: 3.0, taxPct: 15, withholdingPct: 5, status: BrokerCommissionStatus.APPROVED, earnedDaysAgo: 50, approvedDaysAgo: 45 },
    // APPROVED (in payout 4 = draft)
    { number: 'BCM-DEMO-005', contractNumber: 'DEMO-BCN-005', brokerId: b3.id, brokerAgentId: bu3Sales.id, unitId: uSH310.id,  projectId: pSolara.id,    reservationNumber: 'DEMO-BRN-005', basisAmount: 2150000, commissionPct: 2.0, taxPct: 15, withholdingPct: 0, status: BrokerCommissionStatus.APPROVED, earnedDaysAgo: 55, approvedDaysAgo: 50 },
    // PENDING — awaiting review
    { number: 'BCM-DEMO-006', contractNumber: 'DEMO-BCN-006', brokerId: b3.id, brokerAgentId: bu3Owner.id, unitId: uA301.id,   projectId: pRiyadh.id,    reservationNumber: 'DEMO-BRN-006', basisAmount: 1850000, commissionPct: 2.0, taxPct: 15, withholdingPct: 0, status: BrokerCommissionStatus.PENDING, earnedDaysAgo: 45 },
    { number: 'BCM-DEMO-007', contractNumber: 'DEMO-BCN-007', brokerId: b1.id, brokerAgentId: bu1Owner.id, unitId: uNCA305.id, projectId: pNileCrest.id, basisAmount: 3200000, commissionPct: 2.5, taxPct: 15, withholdingPct: 0, status: BrokerCommissionStatus.PENDING, earnedDaysAgo: 35 },
    // REJECTED
    { number: 'BCM-DEMO-008', contractNumber: 'DEMO-BCN-008', brokerId: b2.id, brokerAgentId: bu2Sales.id, unitId: uPDV02.id,  projectId: pPalm.id,      basisAmount: 5800000, commissionPct: 3.0, taxPct: 15, withholdingPct: 0, status: BrokerCommissionStatus.REJECTED, earnedDaysAgo: 25, rejectedDaysAgo: 20, rejectionReason: 'تعارض في نسبة العمولة المتفق عليها' },
    // PENDING — unsigned contract
    { number: 'BCM-DEMO-009', contractNumber: 'DEMO-BCN-009', brokerId: b3.id, brokerAgentId: bu3Sales.id, unitId: uA201.id,   projectId: pRiyadh.id,    basisAmount: 1300000, commissionPct: 2.0, taxPct: 15, withholdingPct: 0, status: BrokerCommissionStatus.PENDING, earnedDaysAgo: 15 },
    // CANCELLED
    { number: 'BCM-DEMO-010', contractNumber: 'DEMO-BCN-010', brokerId: b1.id, brokerAgentId: bu1Sales.id, unitId: uNCA102.id, projectId: pNileCrest.id, basisAmount: 1450000, commissionPct: 2.5, taxPct: 15, withholdingPct: 0, status: BrokerCommissionStatus.CANCELLED, earnedDaysAgo: 10 },
  ];

  const commissionIds = new Map<string, string>();
  for (const spec of commissionSpecs) {
    const gross = spec.basisAmount * spec.commissionPct / 100;
    const taxAmount = gross * spec.taxPct / 100;
    const withholdingAmount = gross * spec.withholdingPct / 100;
    const netAmount = gross - withholdingAmount;

    const contractId = contractIds.get(spec.contractNumber);
    if (!contractId) { console.warn(`   ⚠ Contract ${spec.contractNumber} not found, skipping commission`); continue; }

    const reservationId = spec.reservationNumber ? reservationIds.get(spec.reservationNumber) : undefined;

    const existing = await prisma.brokerCommission.findUnique({
      where: { commissionNumber: spec.number },
      select: { id: true },
    });
    if (existing) { commissionIds.set(spec.number, existing.id); continue; }

    const commission = await prisma.brokerCommission.create({
      data: {
        commissionNumber: spec.number,
        brokerId: spec.brokerId,
        brokerAgentId: spec.brokerAgentId,
        contractId,
        reservationId: reservationId ?? undefined,
        unitId: spec.unitId,
        projectId: spec.projectId,
        basisAmount: spec.basisAmount,
        commissionPct: spec.commissionPct,
        grossAmount: gross,
        taxPct: spec.taxPct,
        taxAmount,
        withholdingPct: spec.withholdingPct,
        withholdingAmount,
        netAmount,
        status: spec.status,
        earnedAt: ago(spec.earnedDaysAgo),
        approvedById: spec.approvedDaysAgo ? adminUser.id : undefined,
        approvedAt: spec.approvedDaysAgo ? ago(spec.approvedDaysAgo) : undefined,
        rejectedById: spec.rejectedDaysAgo ? adminUser.id : undefined,
        rejectedAt: spec.rejectedDaysAgo ? ago(spec.rejectedDaysAgo) : undefined,
        rejectionReason: spec.rejectionReason,
        createdAt: ago(spec.earnedDaysAgo),
      },
      select: { id: true },
    });
    commissionIds.set(spec.number, commission.id);
  }

  // ── 9. Broker payouts ───────────────────────────────────────────────────────
  console.log('   Creating broker payouts…');

  type PayoutSpec = {
    number: string;
    brokerId: string;
    period: string;
    commissionNumbers: string[];
    status: BrokerPayoutStatus;
    method?: BrokerPayoutMethod;
    paymentRef?: string;
    createdDaysAgo: number;
    approvedDaysAgo?: number;
    paidDaysAgo?: number;
  };

  const payoutSpecs: PayoutSpec[] = [
    {
      number: 'BPO-DEMO-001',
      brokerId: b1.id,
      period: '2026-03',
      commissionNumbers: ['BCM-DEMO-001', 'BCM-DEMO-002'],
      status: BrokerPayoutStatus.PAID,
      method: BrokerPayoutMethod.BANK_TRANSFER,
      paymentRef: 'DEMO-TRF-001',
      createdDaysAgo: 72,
      approvedDaysAgo: 68,
      paidDaysAgo: 60,
    },
    {
      number: 'BPO-DEMO-002',
      brokerId: b2.id,
      period: '2026-03',
      commissionNumbers: ['BCM-DEMO-003'],
      status: BrokerPayoutStatus.PAID,
      method: BrokerPayoutMethod.BANK_TRANSFER,
      paymentRef: 'DEMO-TRF-002',
      createdDaysAgo: 62,
      approvedDaysAgo: 58,
      paidDaysAgo: 50,
    },
    {
      number: 'BPO-DEMO-003',
      brokerId: b2.id,
      period: '2026-05',
      commissionNumbers: ['BCM-DEMO-004'],
      status: BrokerPayoutStatus.APPROVED,
      method: BrokerPayoutMethod.BANK_TRANSFER,
      createdDaysAgo: 48,
      approvedDaysAgo: 43,
    },
    {
      number: 'BPO-DEMO-004',
      brokerId: b3.id,
      period: '2026-05',
      commissionNumbers: ['BCM-DEMO-005'],
      status: BrokerPayoutStatus.DRAFT,
      createdDaysAgo: 30,
    },
    {
      number: 'BPO-DEMO-005',
      brokerId: b1.id,
      period: '2026-04',
      commissionNumbers: [],
      status: BrokerPayoutStatus.CANCELLED,
      createdDaysAgo: 40,
    },
  ];

  for (const spec of payoutSpecs) {
    const existing = await prisma.brokerPayout.findUnique({
      where: { payoutNumber: spec.number },
      select: { id: true },
    });
    if (existing) continue;

    // Compute totals from linked commissions
    let totalGross = 0, totalTax = 0, totalWithholding = 0, totalNet = 0;
    const linkedCommissionIds: string[] = [];
    for (const cmNumber of spec.commissionNumbers) {
      const cmId = commissionIds.get(cmNumber);
      if (!cmId) continue;
      linkedCommissionIds.push(cmId);
      const cm = await prisma.brokerCommission.findUnique({
        where: { id: cmId },
        select: { grossAmount: true, taxAmount: true, withholdingAmount: true, netAmount: true },
      });
      if (cm) {
        totalGross += Number(cm.grossAmount);
        totalTax += Number(cm.taxAmount);
        totalWithholding += Number(cm.withholdingAmount);
        totalNet += Number(cm.netAmount);
      }
    }

    const payout = await prisma.brokerPayout.create({
      data: {
        payoutNumber: spec.number,
        brokerId: spec.brokerId,
        period: spec.period,
        totalGross,
        totalTax,
        totalWithholding,
        totalNet,
        status: spec.status,
        paymentMethod: spec.method,
        paymentReference: spec.paymentRef,
        approvedById: spec.approvedDaysAgo ? adminUser.id : undefined,
        approvedAt: spec.approvedDaysAgo ? ago(spec.approvedDaysAgo) : undefined,
        processedById: spec.paidDaysAgo ? adminUser.id : undefined,
        processedAt: spec.paidDaysAgo ? ago(spec.paidDaysAgo) : undefined,
        paidAt: spec.paidDaysAgo ? ago(spec.paidDaysAgo) : undefined,
        cancelledById: spec.status === BrokerPayoutStatus.CANCELLED ? adminUser.id : undefined,
        cancelledAt: spec.status === BrokerPayoutStatus.CANCELLED ? ago(spec.createdDaysAgo - 5) : undefined,
        cancelReason: spec.status === BrokerPayoutStatus.CANCELLED ? 'تم إلغاؤها وإعادة إنشائها ضمن دفعة موحدة' : undefined,
        createdAt: ago(spec.createdDaysAgo),
      },
      select: { id: true },
    });

    // Link commissions to payout and mark as PAID if payout is PAID
    if (linkedCommissionIds.length > 0) {
      await prisma.brokerCommission.updateMany({
        where: { id: { in: linkedCommissionIds } },
        data: {
          payoutId: payout.id,
          status: spec.status === BrokerPayoutStatus.PAID
            ? BrokerCommissionStatus.APPROVED
            : undefined,
        },
      });
    }
  }

  console.log('✅  Broker demo data seeded successfully!');
  console.log('');
  console.log('   Brokers created:');
  console.log(`     ${BROKER_CODES.B1}  Al-Muhaidib Real Estate    (ACTIVE,  Riyadh)`);
  console.log(`     ${BROKER_CODES.B2}  Dar Al-Mashari Real Estate (ACTIVE,  Jeddah)`);
  console.log(`     ${BROKER_CODES.B3}  Al-Othaim Real Estate      (ACTIVE,  Dammam)`);
  console.log(`     ${BROKER_CODES.B4}  Al-Jadeedah Development    (PENDING, Riyadh)`);
  console.log(`     ${BROKER_CODES.B5}  Al-Najm Real Estate        (SUSPENDED, Jeddah)`);
  console.log('');
  console.log('   Data created:');
  console.log('     9 broker employees · 14 leads · 8 reservations');
  console.log('     10 contracts · 10 commissions · 5 payouts');
  console.log('');
  console.log('   Run again safely — fully idempotent.');
  console.log('   Remove with: pnpm tsx prisma/seed-broker-demo.ts --cleanup');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
