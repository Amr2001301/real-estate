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
  BrokerStatus,
  BrokerUserStatus,
  MaintenancePriority,
  MaintenanceReviewStatus,
  MaintenanceStatus,
  PrismaClient,
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
