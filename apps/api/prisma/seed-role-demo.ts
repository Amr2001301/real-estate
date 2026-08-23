/**
 * seed-role-demo.ts — Test data for Maintenance Supervisor and Broker roles
 *
 * Creates:
 *  1. A demo CUSTOMER user (the one who submits maintenance requests).
 *  2. Five maintenance requests in different statuses so the MAINTENANCE_SUPERVISOR
 *     account has visible work the moment they log in.
 *  3. A minimal BROKER firm + BROKER-role user with project access so the broker
 *     section of the staff app loads with real catalogue data.
 *
 * SAFETY:
 *  - Aborts in production unless ALLOW_SEED_IN_PRODUCTION=true.
 *  - Fully idempotent — safe to run multiple times (upserts on unique keys;
 *    find-or-skip for entities without a unique constraint).
 *
 * PREREQUISITE:
 *  Run the dev seed first so projects, units, categories and the
 *  maintenance@example.com supervisor user exist:
 *    cd apps/api && pnpm prisma:seed
 *
 * USAGE:
 *  cd apps/api
 *  pnpm prisma:seed:role-demo
 *
 * CREDENTIALS (printed at the end):
 *  Maintenance Supervisor : maintenance@example.com / MaintenancePass123!
 *  Broker Agent           : broker.demo@devora-demo.com / BrokerDemo@2026!
 */

import {
  BrokerLeadStatus,
  BrokerStatus,
  BrokerUserStatus,
  LeadStage,
  MaintenancePriority,
  MaintenanceReviewStatus,
  MaintenanceStatus,
  PrismaClient,
  ReservationStatus,
  UserRole,
} from '@prisma/client';
import * as argon2 from 'argon2';

if (
  process.env.NODE_ENV === 'production' &&
  process.env.ALLOW_SEED_IN_PRODUCTION !== 'true'
) {
  console.error('❌  Seed blocked: NODE_ENV=production.');
  process.exit(1);
}

const prisma = new PrismaClient();

// ── Stable idempotency keys ──────────────────────────────────────────────────

const DEMO_CUSTOMER_EMAIL   = 'demo.customer@example.com';
const DEMO_CUSTOMER_PASS    = 'CustomerDemo123!';

const BROKER_FIRM_CODE      = 'DEMO-ROLE-BR-01';
const BROKER_AGENT_EMAIL    = 'broker.demo@devora-demo.com';
const BROKER_AGENT_PASS     = 'BrokerDemo@2026!';

// ── Helpers ──────────────────────────────────────────────────────────────────

const ago = (days: number): Date => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
};

async function findMaintenanceCategoryByEn(nameEn: string) {
  return prisma.maintenanceCategory.findFirst({
    where: { name: { path: ['en'], equals: nameEn } },
    select: { id: true, priority: true },
  });
}

// ── 1. Demo CUSTOMER user ─────────────────────────────────────────────────────

async function ensureDemoCustomer(companyId: string) {
  const hash = await argon2.hash(DEMO_CUSTOMER_PASS);
  return prisma.user.upsert({
    where: { email: DEMO_CUSTOMER_EMAIL },
    create: {
      email: DEMO_CUSTOMER_EMAIL,
      passwordHash: hash,
      fullName: 'Demo Customer',
      phone: '+966501234567',
      role: UserRole.CUSTOMER,
      locale: 'ar',
      companyId,
    },
    update: { phone: '+966501234567' },
    select: { id: true },
  });
}

// ── 2. Maintenance requests ───────────────────────────────────────────────────

async function seedMaintenanceRequests(companyId: string) {
  console.log('🔧  Seeding maintenance requests…');

  // Find the maintenance supervisor
  const supervisor = await prisma.user.findUnique({
    where: { email: 'maintenance@example.com' },
    select: { id: true },
  });
  if (!supervisor) {
    console.warn('   ⚠️  maintenance@example.com not found — run pnpm prisma:seed first.');
    return;
  }

  // Grab any available unit to attach requests to
  const unit = await prisma.unit.findFirst({ select: { id: true } });
  if (!unit) {
    console.warn('   ⚠️  No units found — run pnpm prisma:seed first.');
    return;
  }

  // Grab categories
  const [plumbing, electrical, hvac, general] = await Promise.all([
    findMaintenanceCategoryByEn('Plumbing'),
    findMaintenanceCategoryByEn('Electrical'),
    findMaintenanceCategoryByEn('HVAC'),
    findMaintenanceCategoryByEn('General'),
  ]);

  if (!plumbing || !electrical || !hvac || !general) {
    console.warn('   ⚠️  Maintenance categories missing — run pnpm prisma:seed first.');
    return;
  }

  const customer = await ensureDemoCustomer(companyId);

  type RequestSeed = {
    description: string;
    status: MaintenanceStatus;
    priority: MaintenancePriority;
    reviewStatus: MaintenanceReviewStatus;
    categoryId: string;
    assignedAdminId?: string;
    assignedAt?: Date;
    firstInProgressAt?: Date;
    resolvedAt?: Date;
    dueAt?: Date;
  };

  const requests: RequestSeed[] = [
    // 1. OPEN — just submitted, waiting for assignment
    {
      description: 'تسرب مياه في الحمام الرئيسي — يؤثر على الأرضية',
      status: MaintenanceStatus.OPEN,
      priority: MaintenancePriority.HIGH,
      reviewStatus: MaintenanceReviewStatus.APPROVED,
      categoryId: plumbing.id,
      dueAt: ago(-1), // already overdue
    },
    // 2. ASSIGNED — assigned to supervisor, not yet started
    {
      description: 'قاطع الكهرباء في المطبخ يتوقف باستمرار',
      status: MaintenanceStatus.ASSIGNED,
      priority: MaintenancePriority.MEDIUM,
      reviewStatus: MaintenanceReviewStatus.APPROVED,
      categoryId: electrical.id,
      assignedAdminId: supervisor.id,
      assignedAt: ago(1),
      dueAt: ago(0), // due today
    },
    // 3. IN_PROGRESS — supervisor is actively working on it
    {
      description: 'جهاز التكييف في غرفة النوم الرئيسية لا يبرد بشكل كافٍ',
      status: MaintenanceStatus.IN_PROGRESS,
      priority: MaintenancePriority.URGENT,
      reviewStatus: MaintenanceReviewStatus.APPROVED,
      categoryId: hvac.id,
      assignedAdminId: supervisor.id,
      assignedAt: ago(3),
      firstInProgressAt: ago(2),
      dueAt: ago(1),
    },
    // 4. RESOLVED — supervisor marked it done
    {
      description: 'تشقق في جدار الصالة الرئيسية يحتاج دهان وإصلاح',
      status: MaintenanceStatus.RESOLVED,
      priority: MaintenancePriority.LOW,
      reviewStatus: MaintenanceReviewStatus.APPROVED,
      categoryId: general.id,
      assignedAdminId: supervisor.id,
      assignedAt: ago(7),
      firstInProgressAt: ago(6),
      resolvedAt: ago(4),
      dueAt: ago(5),
    },
    // 5. PENDING REVIEW — customer submitted, awaiting admin approval
    {
      description: 'الباب الخارجي لا يُغلق بشكل صحيح — صعوبة في القفل',
      status: MaintenanceStatus.OPEN,
      priority: MaintenancePriority.MEDIUM,
      reviewStatus: MaintenanceReviewStatus.PENDING,
      categoryId: general.id,
    },
  ];

  let created = 0;
  for (const req of requests) {
    // Idempotency: skip if an identical description already exists for this customer+unit
    const existing = await prisma.maintenanceRequest.findFirst({
      where: { customerId: customer.id, unitId: unit.id, description: req.description },
      select: { id: true },
    });
    if (existing) continue;

    await prisma.maintenanceRequest.create({
      data: {
        customerId: customer.id,
        unitId: unit.id,
        categoryId: req.categoryId,
        description: req.description,
        status: req.status,
        priority: req.priority,
        reviewStatus: req.reviewStatus,
        assignedAdminId: req.assignedAdminId,
        assignedAt: req.assignedAt,
        firstInProgressAt: req.firstInProgressAt,
        resolvedAt: req.resolvedAt,
        dueAt: req.dueAt,
        companyId,
      },
    });
    created++;
  }

  console.log(`   ✓ ${created} maintenance request(s) created (${requests.length - created} already existed)`);
}

// ── 3. Broker firm + agent ────────────────────────────────────────────────────

async function seedBrokerDemo(companyId: string) {
  console.log('🏢  Seeding broker demo user & firm…');

  const adminUser = await prisma.user.findFirst({
    where: { role: UserRole.ADMIN },
    select: { id: true },
  });
  if (!adminUser) {
    console.warn('   ⚠️  No ADMIN user — run pnpm prisma:seed first.');
    return;
  }

  // Broker agent user
  const hash = await argon2.hash(BROKER_AGENT_PASS);
  const agentUser = await prisma.user.upsert({
    where: { email: BROKER_AGENT_EMAIL },
    create: {
      email: BROKER_AGENT_EMAIL,
      passwordHash: hash,
      fullName: 'Demo Broker Agent',
      role: UserRole.BROKER,
      locale: 'ar',
      companyId,
    },
    update: {},
    select: { id: true },
  });

  // Broker firm
  const broker = await prisma.broker.upsert({
    where: { code: BROKER_FIRM_CODE },
    create: {
      code: BROKER_FIRM_CODE,
      companyName: 'شركة الوسيط التجريبي',
      commercialName: 'Demo Broker Firm',
      email: 'info@demo-broker.com',
      phone: '+966500000099',
      city: 'الرياض',
      status: BrokerStatus.ACTIVE,
      defaultCommissionPct: 2.5,
      createdById: adminUser.id,
      companyId,
    },
    update: {},
    select: { id: true },
  });

  // BrokerUser link
  const existingLink = await prisma.brokerUser.findUnique({
    where: { userId: agentUser.id },
  });
  if (!existingLink) {
    await prisma.brokerUser.create({
      data: {
        userId: agentUser.id,
        brokerId: broker.id,
        jobTitle: 'وكيل مبيعات',
        isPrimaryContact: true,
        canManageBrokerUsers: false,
        canViewCommissions: true,
        status: BrokerUserStatus.ACTIVE,
        joinedAt: new Date(),
        companyId,
      },
    });
  }

  // Grant project access to the first PUBLISHED project found
  const project = await prisma.project.findFirst({
    where: { status: 'PUBLISHED' },
    select: { id: true },
  });
  if (project) {
    await prisma.brokerProjectAccess.upsert({
      where: { brokerId_projectId: { brokerId: broker.id, projectId: project.id } },
      create: {
        brokerId: broker.id,
        projectId: project.id,
        commissionPct: 2.5,
        active: true,
        companyId,
      },
      update: {},
    });
    console.log('   ✓ Project access granted to demo broker');
  }

  console.log('   ✓ Broker firm and agent ready');
}

// ── 4. Broker leads + reservations ───────────────────────────────────────────

async function seedBrokerLeadsAndReservations(companyId: string) {
  console.log('🤝  Seeding broker leads & reservations…');

  // Resolve the demo broker firm
  const broker = await prisma.broker.findUnique({
    where: { code: BROKER_FIRM_CODE },
    select: { id: true },
  });
  if (!broker) {
    console.warn('   ⚠️  Broker firm not found — run seedBrokerDemo first.');
    return;
  }

  // Resolve the broker agent user
  const agentUser = await prisma.user.findUnique({
    where: { email: BROKER_AGENT_EMAIL },
    select: { id: true },
  });

  // Use the demo customer as the lead client
  const customer = await prisma.user.findUnique({
    where: { email: DEMO_CUSTOMER_EMAIL },
    select: { id: true },
  });
  if (!customer) {
    console.warn('   ⚠️  Demo customer not found — run ensureDemoCustomer first.');
    return;
  }

  // Find the first project the broker has access to
  const access = await prisma.brokerProjectAccess.findFirst({
    where: { brokerId: broker.id },
    select: { projectId: true },
  });
  const project = access
    ? await prisma.project.findUnique({
        where: { id: access.projectId },
        select: { id: true },
      })
    : await prisma.project.findFirst({
        where: { status: 'PUBLISHED' },
        select: { id: true },
      });

  // Find any sales/admin user to act as assignedSales on reservations
  const salesUser = await prisma.user.findFirst({
    where: { role: { in: ['SALES', 'SALES_MANAGER', 'ADMIN'] } },
    select: { id: true },
  });

  // Find a unit for the reservation
  const unit = await prisma.unit.findFirst({ select: { id: true } });

  // ── Leads ──────────────────────────────────────────────────────────────────

  type LeadSeed = {
    fullName: string;
    phone: string;
    stage: LeadStage;
    approvalStatus: BrokerLeadStatus;
    daysAgo: number;
  };

  const leads: LeadSeed[] = [
    { fullName: 'عبدالرحمن السيد', phone: '+966501111001', stage: LeadStage.NEW, approvalStatus: BrokerLeadStatus.PENDING, daysAgo: 1 },
    { fullName: 'نورة العتيبي', phone: '+966501111002', stage: LeadStage.INTERESTED, approvalStatus: BrokerLeadStatus.APPROVED, daysAgo: 5 },
    { fullName: 'فهد الدوسري', phone: '+966501111003', stage: LeadStage.NEGOTIATION, approvalStatus: BrokerLeadStatus.APPROVED, daysAgo: 10 },
    { fullName: 'ريم القحطاني', phone: '+966501111004', stage: LeadStage.NEW, approvalStatus: BrokerLeadStatus.REJECTED, daysAgo: 15 },
  ];

  let leadsCreated = 0;
  const createdLeadIds: string[] = [];

  for (const l of leads) {
    const existing = await prisma.lead.findFirst({
      where: { phone: l.phone, brokerId: broker.id },
      select: { id: true },
    });
    if (existing) {
      createdLeadIds.push(existing.id);
      continue;
    }

    // Ensure a client user for this phone
    let clientUser = await prisma.user.findUnique({ where: { phone: l.phone }, select: { id: true } });
    if (!clientUser) {
      clientUser = await prisma.user.create({
        data: {
          fullName: l.fullName,
          phone: l.phone,
          role: UserRole.CUSTOMER,
          locale: 'ar',
          companyId,
        },
        select: { id: true },
      });
    }

    const submittedAt = ago(l.daysAgo);
    const lead = await prisma.lead.create({
      data: {
        clientId: clientUser.id,
        fullName: l.fullName,
        phone: l.phone,
        stage: l.stage,
        brokerId: broker.id,
        brokerAgentId: agentUser?.id,
        brokerSubmittedAt: submittedAt,
        brokerApprovalStatus: l.approvalStatus,
        brokerApprovedAt: l.approvalStatus === BrokerLeadStatus.APPROVED ? submittedAt : undefined,
        brokerRejectedAt: l.approvalStatus === BrokerLeadStatus.REJECTED ? submittedAt : undefined,
        projectInterestId: project?.id,
        companyId,
      },
      select: { id: true },
    });
    createdLeadIds.push(lead.id);
    leadsCreated++;
  }
  console.log(`   ✓ ${leadsCreated} lead(s) created (${leads.length - leadsCreated} already existed)`);

  // ── Reservations ───────────────────────────────────────────────────────────

  if (!unit || !salesUser) {
    console.warn('   ⚠️  No unit or sales user found — skipping reservations.');
    return;
  }

  const reservationSeeds = [
    {
      status: ReservationStatus.PENDING,
      expiresAt: ago(-7),
      leadId: createdLeadIds[1] ?? null,
      clientId: customer.id,
    },
    {
      status: ReservationStatus.APPROVED,
      expiresAt: ago(-30),
      leadId: createdLeadIds[2] ?? null,
      clientId: customer.id,
    },
  ];

  let resCreated = 0;
  for (const r of reservationSeeds) {
    const existing = await prisma.reservation.findFirst({
      where: { unitId: unit.id, brokerId: broker.id, status: r.status },
      select: { id: true },
    });
    if (existing) continue;

    await prisma.reservation.create({
      data: {
        unitId: unit.id,
        salesId: salesUser.id,
        leadId: r.leadId ?? undefined,
        clientId: r.clientId,
        brokerId: broker.id,
        status: r.status,
        expiresAt: r.expiresAt,
        companyId,
      },
    });
    resCreated++;
  }
  console.log(`   ✓ ${resCreated} reservation(s) created (${reservationSeeds.length - resCreated} already existed)`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱  seed-role-demo: creating maintenance + broker test data…\n');

  // Use the same company-lookup strategy as the main seed: prefer the slug
  // controlled by SEED_COMPANY_SLUG (default: 'default').  Falling back to
  // findFirst() is unsafe when multiple companies exist — it may return a
  // test/demo tenant instead of the real one.
  const slug = process.env.SEED_COMPANY_SLUG ?? 'default';
  const company =
    (await prisma.company.findUnique({ where: { slug }, select: { id: true } })) ??
    (await prisma.company.findFirst({
      orderBy: { createdAt: 'asc' }, // oldest = the bootstrapped real company
      select: { id: true },
    }));
  if (!company) {
    console.error('❌  No company found — run pnpm prisma:seed first.');
    process.exit(1);
  }
  console.log(`   Company: ${slug} → ${company.id}`);

  await seedMaintenanceRequests(company.id);
  await seedBrokerDemo(company.id);
  await seedBrokerLeadsAndReservations(company.id);

  // Backfill companyId on any rows that were created without it
  await prisma.$executeRawUnsafe(
    `UPDATE "MaintenanceRequest" SET "companyId" = $1::uuid WHERE "companyId" IS NULL`,
    company.id,
  );
  await prisma.$executeRawUnsafe(
    `UPDATE "Broker" SET "companyId" = $1::uuid WHERE "companyId" IS NULL`,
    company.id,
  );
  await prisma.$executeRawUnsafe(
    `UPDATE "BrokerUser" SET "companyId" = $1::uuid WHERE "companyId" IS NULL`,
    company.id,
  );
  await prisma.$executeRawUnsafe(
    `UPDATE "User" SET "companyId" = $1::uuid WHERE "companyId" IS NULL`,
    company.id,
  );
  await prisma.$executeRawUnsafe(
    `UPDATE "BrokerProjectAccess" SET "companyId" = $1::uuid WHERE "companyId" IS NULL`,
    company.id,
  );
  await prisma.$executeRawUnsafe(
    `UPDATE "Lead" SET "companyId" = $1::uuid WHERE "companyId" IS NULL AND "brokerId" IS NOT NULL`,
    company.id,
  );
  await prisma.$executeRawUnsafe(
    `UPDATE "Reservation" SET "companyId" = $1::uuid WHERE "companyId" IS NULL AND "brokerId" IS NOT NULL`,
    company.id,
  );

  console.log('\n✅  Role demo seed complete\n');
  console.log('── Test Credentials ──────────────────────────────────────────');
  console.log('  Maintenance Supervisor : maintenance@example.com / MaintenancePass123!');
  console.log(`  Broker Agent           : ${BROKER_AGENT_EMAIL} / ${BROKER_AGENT_PASS}`);
  console.log(`  Demo Customer          : ${DEMO_CUSTOMER_EMAIL} / ${DEMO_CUSTOMER_PASS}`);
  console.log('─────────────────────────────────────────────────────────────');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
