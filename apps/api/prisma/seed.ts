import {
  PrismaClient,
  UserRole,
  ProjectStatus,
  UnitStatus,
  MediaType,
  NotificationChannel,
} from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

// ============================================================================
// Idempotency helpers — needed because translatable JSON name columns have no
// unique constraint, so we cannot use `upsert` directly on them.
// ============================================================================

async function findProjectByTranslatedName(nameAr: string, nameEn: string) {
  return prisma.project.findFirst({
    where: {
      OR: [
        { name: { path: ['en'], equals: nameEn } },
        { name: { path: ['ar'], equals: nameAr } },
      ],
    },
  });
}

async function findPhaseByTranslatedName(
  projectId: string,
  nameAr: string,
  nameEn: string,
) {
  return prisma.phase.findFirst({
    where: {
      projectId,
      OR: [
        { name: { path: ['en'], equals: nameEn } },
        { name: { path: ['ar'], equals: nameAr } },
      ],
    },
  });
}

async function findBuildingByName(phaseId: string, name: string) {
  return prisma.building.findFirst({ where: { phaseId, name } });
}

async function findLeadSourceByEn(nameEn: string) {
  return prisma.leadSource.findFirst({
    where: { name: { path: ['en'], equals: nameEn } },
  });
}

async function findMaintenanceCategoryByEn(nameEn: string) {
  return prisma.maintenanceCategory.findFirst({
    where: { name: { path: ['en'], equals: nameEn } },
  });
}

type Translatable = { ar: string; en: string };

async function ensureProject(params: {
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  city: string;
  lat: number;
  lng: number;
  status: ProjectStatus;
  featured: boolean;
  services: Translatable[];
  mediaUrls?: string[];
}) {
  const existing = await findProjectByTranslatedName(params.nameAr, params.nameEn);
  if (existing) return existing;
  return prisma.project.create({
    data: {
      name: { ar: params.nameAr, en: params.nameEn },
      description: { ar: params.descriptionAr, en: params.descriptionEn },
      city: params.city,
      lat: params.lat,
      lng: params.lng,
      status: params.status,
      featured: params.featured,
      services: params.services,
      ...(params.mediaUrls && params.mediaUrls.length
        ? {
            media: {
              create: params.mediaUrls.map((url, i) => ({
                url,
                type: MediaType.IMAGE,
                order: i,
              })),
            },
          }
        : {}),
    },
  });
}

async function ensurePhase(
  projectId: string,
  nameAr: string,
  nameEn: string,
  order: number,
) {
  const existing = await findPhaseByTranslatedName(projectId, nameAr, nameEn);
  if (existing) return existing;
  return prisma.phase.create({
    data: { projectId, name: { ar: nameAr, en: nameEn }, order },
  });
}

async function ensureBuilding(
  phaseId: string,
  name: string,
  totalFloors: number,
  order: number,
) {
  const existing = await findBuildingByName(phaseId, name);
  if (existing) return existing;
  return prisma.building.create({
    data: { phaseId, name, totalFloors, order },
  });
}

type UnitSeed = {
  code: string;
  type: string;
  area: number;
  bedrooms: number;
  bathrooms: number;
  floor: number;
  price: number;
  status?: UnitStatus;
};

async function ensureUnits(buildingId: string, units: UnitSeed[]) {
  for (const u of units) {
    await prisma.unit.upsert({
      where: { buildingId_code: { buildingId, code: u.code } },
      create: { buildingId, ...u },
      // Don't overwrite admin-edited unit state on re-seed.
      update: {},
    });
  }
}

// ============================================================================
// Seed
// ============================================================================

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';

  console.log('🌱 Seeding database…');

  // ---- Users (idempotent via email upsert) ----
  const adminHash = await argon2.hash(adminPassword);
  await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      passwordHash: adminHash,
      fullName: 'Platform Admin',
      role: UserRole.ADMIN,
      locale: 'ar',
    },
    update: { passwordHash: adminHash },
  });

  const salesHash = await argon2.hash('SalesPass123!');
  const sales = await prisma.user.upsert({
    where: { email: 'sales@example.com' },
    create: {
      email: 'sales@example.com',
      passwordHash: salesHash,
      fullName: 'Mohamed Sales',
      role: UserRole.SALES,
      locale: 'ar',
    },
    update: { passwordHash: salesHash },
  });

  // Demo SALES_MANAGER (idempotent by email; never overwrites a real user since
  // it is keyed on this dedicated demo address). Role foundation only — its
  // route access is intentionally limited until Batch 8.
  const managerHash = await argon2.hash('ManagerPass123!');
  const manager = await prisma.user.upsert({
    where: { email: 'manager@example.com' },
    create: {
      email: 'manager@example.com',
      passwordHash: managerHash,
      fullName: 'Sara Manager',
      role: UserRole.SALES_MANAGER,
      locale: 'ar',
    },
    update: { passwordHash: managerHash },
  });

  // Link the demo SALES rep to the demo SALES_MANAGER so the team view has data.
  // Idempotent: only sets managerId when not already pointing at this manager,
  // and only touches the demo sales user (matched above by its email upsert).
  if (sales.managerId !== manager.id) {
    await prisma.user.update({
      where: { id: sales.id },
      data: { managerId: manager.id },
    });
  }

  // ---- Lead sources (find-or-create by en name; JSON column has no unique idx) ----
  for (const name of [
    { ar: 'فيسبوك', en: 'Facebook' },
    { ar: 'انستغرام', en: 'Instagram' },
    { ar: 'موقع الويب', en: 'Website' },
    { ar: 'إحالة', en: 'Referral' },
  ]) {
    const existing = await findLeadSourceByEn(name.en);
    if (!existing) {
      await prisma.leadSource.create({ data: { name } });
    }
  }

  // ---- Demo project 1: idempotent project + phase + buildings + units ----
  const proj1 = await ensureProject({
    nameAr: 'كمبوند الرياض الجديدة',
    nameEn: 'New Riyadh Compound',
    descriptionAr: 'مجتمع سكني فاخر بإطلالات خلابة ومرافق متكاملة.',
    descriptionEn:
      'A luxurious residential community with stunning views and full amenities.',
    city: 'Riyadh',
    lat: 24.7136,
    lng: 46.6753,
    status: ProjectStatus.PUBLISHED,
    featured: true,
    services: [
      { ar: 'حمام سباحة', en: 'Swimming Pool' },
      { ar: 'نادي صحي', en: 'Gym' },
      { ar: 'حدائق', en: 'Gardens' },
    ],
    mediaUrls: [
      'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200',
      'https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?w=1200',
    ],
  });

  const phase1 = await ensurePhase(
    proj1.id,
    'المرحلة الأولى',
    'Phase 1',
    0,
  );
  const buildingA = await ensureBuilding(phase1.id, 'Building A', 6, 0);
  const buildingB = await ensureBuilding(phase1.id, 'Building B', 4, 1);

  await ensureUnits(buildingA.id, [
    { code: 'A-101', type: '1BR', area: 75, bedrooms: 1, bathrooms: 1, floor: 1, price: 850000 },
    { code: 'A-102', type: '2BR', area: 110, bedrooms: 2, bathrooms: 2, floor: 1, price: 1250000 },
    { code: 'A-201', type: '2BR', area: 115, bedrooms: 2, bathrooms: 2, floor: 2, price: 1300000, status: UnitStatus.RESERVED },
    { code: 'A-301', type: '3BR', area: 165, bedrooms: 3, bathrooms: 2, floor: 3, price: 1850000 },
  ]);
  await ensureUnits(buildingB.id, [
    { code: 'B-101', type: '2BR', area: 105, bedrooms: 2, bathrooms: 2, floor: 1, price: 1180000 },
    { code: 'B-102', type: '3BR', area: 160, bedrooms: 3, bathrooms: 3, floor: 1, price: 1750000 },
  ]);

  // ---- Demo project 2 (draft) ----
  await ensureProject({
    nameAr: 'فيلات الجولف',
    nameEn: 'Golf Villas',
    descriptionAr: 'فيلات راقية بإطلالة على الجولف.',
    descriptionEn: 'Premium villas overlooking the golf course.',
    city: 'Jeddah',
    lat: 21.4858,
    lng: 39.1925,
    status: ProjectStatus.DRAFT,
    featured: false,
    services: [{ ar: 'ملعب جولف', en: 'Golf Course' }],
  });

  // ---- Maintenance categories (find-or-create by en) ----
  for (const name of [
    { ar: 'سباكة', en: 'Plumbing' },
    { ar: 'كهرباء', en: 'Electrical' },
    { ar: 'تكييف', en: 'HVAC' },
    { ar: 'أعمال عامة', en: 'General' },
  ]) {
    const existing = await findMaintenanceCategoryByEn(name.en);
    if (!existing) {
      await prisma.maintenanceCategory.create({ data: { name } });
    }
  }

  // ---- Notification templates (already idempotent via @unique code) ----
  await Promise.all(
    [
      {
        code: 'visit_approved',
        channel: NotificationChannel.PUSH,
        ar_subject: 'تمت الموافقة على زيارتك',
        en_subject: 'Your visit was approved',
        ar_body: 'تم تأكيد زيارتك للمشروع {{projectName}} في {{date}}',
        en_body: 'Your visit to {{projectName}} on {{date}} is confirmed',
      },
      {
        code: 'deposit_recorded',
        channel: NotificationChannel.PUSH,
        ar_subject: 'تم تسجيل دفعة',
        en_subject: 'Deposit recorded',
        ar_body: 'تم تسجيل دفعة بقيمة {{amount}} لعقدك',
        en_body: 'A deposit of {{amount}} has been recorded for your contract',
      },
      {
        code: 'reservation_expired',
        channel: NotificationChannel.IN_APP,
        ar_subject: 'انتهت صلاحية الحجز',
        en_subject: 'Reservation expired',
        ar_body: 'انتهت صلاحية حجز الوحدة {{unitCode}}',
        en_body: 'Reservation for unit {{unitCode}} has expired',
      },
    ].map((t) =>
      prisma.notificationTemplate.upsert({
        where: { code: t.code },
        create: {
          code: t.code,
          channel: t.channel,
          subject: { ar: t.ar_subject, en: t.en_subject },
          body: { ar: t.ar_body, en: t.en_body },
        },
        update: {},
      }),
    ),
  );

  // ---- Lead + assignment (idempotent by clientId + projectInterestId) ----
  const fbSource = await findLeadSourceByEn('Facebook');
  if (fbSource) {
    const phone = '+966500000001';
    const email = 'ahmed@example.com';
    const fullName = 'Ahmed Khaled';
    const client =
      (await prisma.user.findUnique({ where: { phone } })) ??
      (await prisma.user.create({
        data: { role: 'CLIENT', fullName, phone, email, locale: 'ar' },
      }));
    const existingLead = await prisma.lead.findFirst({
      where: { clientId: client.id, projectInterestId: proj1.id },
    });
    if (!existingLead) {
      await prisma.lead.create({
        data: {
          clientId: client.id,
          fullName: client.fullName,
          phone: client.phone ?? phone,
          email: client.email ?? email,
          sourceId: fbSource.id,
          projectInterestId: proj1.id,
          assignedSalesId: sales.id,
        },
      });
    }
  }

  // ---- Permission codes ----
  // Broker codes were seeded since Phase 1. The 8 codes below are the first
  // P0 codes that are actually enforced at runtime — see settings.module.ts
  // for the pilot wiring. The bootstrap admin receives every code so the
  // existing admin UI doesn't show empty rows on first boot.
  const brokerPermissions: Array<{ code: string; description: string }> = [
    { code: 'brokers:read', description: 'List/view brokerage firms' },
    { code: 'brokers:create', description: 'Onboard a new brokerage firm' },
    { code: 'brokers:update', description: 'Edit brokerage firm profile and access' },
    { code: 'brokers:suspend', description: 'Suspend a brokerage firm' },
    { code: 'brokers:terminate', description: 'Terminate a brokerage firm' },
    { code: 'broker_users:read', description: 'List/view broker agent users' },
    { code: 'broker_users:invite', description: 'Invite a new broker agent' },
    { code: 'broker_users:update', description: 'Edit broker agent profile and permissions' },
    { code: 'broker_users:remove', description: 'Remove a broker agent from a firm' },
    { code: 'broker_access:read', description: 'Read broker project and unit access' },
    { code: 'broker_access:manage', description: 'Manage broker project and unit access' },
    { code: 'broker_leads:read', description: 'Read broker-submitted leads' },
    { code: 'broker_leads:approve', description: 'Approve a lead submitted by a broker' },
    { code: 'broker_leads:reject', description: 'Reject a lead submitted by a broker' },
    { code: 'broker_contracts:read', description: 'Read broker-attributed contracts' },
    { code: 'broker_reservations:read', description: 'Read broker reservations' },
    { code: 'broker_reservations:create', description: 'Create broker reservations' },
    { code: 'broker_reports:read', description: 'Read broker performance reports' },
  ];

  const corePermissions: Array<{ code: string; description: string }> = [
    { code: 'settings:read', description: 'Read system settings' },
    { code: 'settings:write', description: 'Modify system settings' },
    { code: 'permissions:manage', description: 'List permissions and assign/revoke them on users' },
    { code: 'users:read', description: 'List/view platform users' },
    { code: 'users:create', description: 'Create a new platform user' },
    { code: 'users:update', description: 'Edit a platform user profile' },
    { code: 'users:activate', description: 'Activate a deactivated user' },
    { code: 'users:deactivate', description: 'Deactivate a user account' },
    { code: 'audit:read', description: 'Read audit logs and operations summary' },
    { code: 'reports:operational:read', description: 'Read operational dashboard and KPI reports' },
    { code: 'reports:sales:read', description: 'Read sales reports' },
    { code: 'reports:financial:read', description: 'Read financial reports' },
    { code: 'deposits:read', description: 'Read deposit records' },
    { code: 'deposits:register', description: 'Register deposit payments' },
    { code: 'deposits:verify', description: 'Verify deposit payments' },
    { code: 'contracts:read', description: 'Read contract records' },
    { code: 'contracts:upload', description: 'Create contracts and attach PDFs' },
    { code: 'contracts:update', description: 'Update editable contract fields' },
    { code: 'contracts:sign', description: 'Sign contracts and materialize commission side effects' },
    { code: 'broker_commissions:read', description: 'Read broker commission records' },
    { code: 'broker_commissions:approve', description: 'Approve broker commissions' },
    { code: 'broker_commissions:reject', description: 'Reject broker commissions' },
    { code: 'broker_commissions:cancel', description: 'Cancel broker commissions' },
    { code: 'broker_payouts:read', description: 'Read broker payout records' },
    { code: 'broker_payouts:create', description: 'Create broker payout drafts' },
    { code: 'broker_payouts:update', description: 'Update broker payout drafts' },
    { code: 'broker_payouts:approve', description: 'Approve broker payouts' },
    { code: 'broker_payouts:process', description: 'Mark broker payouts as processing' },
    { code: 'broker_payouts:pay', description: 'Mark broker payouts as paid' },
    { code: 'broker_payouts:cancel', description: 'Cancel broker payouts' },
    { code: 'bonus:rules:manage', description: 'Manage bonus rules' },
    { code: 'bonus:entries:read', description: 'Read bonus entries' },
    { code: 'bonus:entries:create', description: 'Create bonus entries' },
    { code: 'bonus:entries:approve', description: 'Approve bonus entries' },
    { code: 'bonus:entries:pay', description: 'Mark bonus entries as paid' },
    { code: 'targets:read', description: 'Read sales targets' },
    { code: 'targets:manage', description: 'Manage sales targets' },
    { code: 'reservations:read', description: 'Read reservation records' },
    { code: 'reservations:create', description: 'Create reservations' },
    { code: 'reservations:update', description: 'Update reservation editable fields' },
    { code: 'reservations:approve', description: 'Approve reservations' },
    { code: 'reservations:reject', description: 'Reject reservations' },
    { code: 'reservations:cancel', description: 'Cancel reservations' },
    { code: 'reservations:convert', description: 'Convert reservations to contracts' },
    { code: 'reservations:booking-payment', description: 'Confirm or unconfirm reservation booking payments' },
    { code: 'leads:read', description: 'Read leads and lead pipeline data' },
    { code: 'leads:create', description: 'Create leads' },
    { code: 'leads:update', description: 'Update lead details' },
    { code: 'leads:assign', description: 'Assign leads to sales users' },
    { code: 'leads:advance-stage', description: 'Advance lead pipeline stage' },
    { code: 'leads:note', description: 'Add lead notes' },
    { code: 'lead_sources:manage', description: 'Manage lead sources' },
    { code: 'visits:read', description: 'Read visit requests and appointments' },
    { code: 'visits:create', description: 'Create visit appointments' },
    { code: 'visits:approve', description: 'Review or update visit requests' },
    { code: 'visits:schedule', description: 'Schedule visit appointments from requests' },
    { code: 'visits:confirm', description: 'Confirm visit appointments' },
    { code: 'visits:complete', description: 'Complete visit appointments' },
    { code: 'visits:cancel', description: 'Cancel visit appointments' },
    { code: 'visits:no-show', description: 'Mark visit appointments as no-show' },
    { code: 'visits:reschedule', description: 'Reschedule visit appointments' },
    { code: 'visits:assign', description: 'Assign visit appointments to sales users' },
    { code: 'maintenance:read', description: 'Read maintenance requests' },
    // Seeded but unwired — reserved for a future admin-create-on-behalf route.
    { code: 'maintenance:create', description: 'Create maintenance requests on behalf of customers' },
    { code: 'maintenance:assign', description: 'Assign maintenance requests to admin staff' },
    { code: 'maintenance:resolve', description: 'Drive maintenance request status transitions' },
    { code: 'maintenance:categories:manage', description: 'Manage maintenance categories' },
    { code: 'projects:read', description: 'Read projects, phases, and buildings' },
    { code: 'projects:create', description: 'Create projects' },
    { code: 'projects:update', description: 'Update project details' },
    { code: 'projects:delete', description: 'Delete projects' },
    { code: 'projects:publish', description: 'Publish or archive projects' },
    { code: 'phases:manage', description: 'Manage project phases' },
    { code: 'buildings:manage', description: 'Manage project buildings' },
    { code: 'project_media:manage', description: 'Manage project and unit media' },
    { code: 'units:read', description: 'Read units and use installment calculator' },
    { code: 'units:create', description: 'Create units' },
    { code: 'units:update', description: 'Update unit details and pricing' },
    { code: 'units:change-status', description: 'Change unit status' },
    { code: 'units:delete', description: 'Delete units' },
    { code: 'cms:pages:manage', description: 'Manage CMS pages' },
    { code: 'cms:banners:manage', description: 'Manage CMS banners' },
    { code: 'cms:articles:manage', description: 'Manage CMS articles' },
    { code: 'documents:read', description: 'Read document records' },
    { code: 'documents:upload', description: 'Upload and register documents' },
    { code: 'documents:update', description: 'Update document metadata' },
    { code: 'documents:delete', description: 'Delete document records' },
    { code: 'notifications:templates:manage', description: 'Manage notification templates' },
    { code: 'notifications:send', description: 'Send notifications to users' },
    { code: 'installments:read', description: 'Read installment plans and templates' },
    { code: 'installments:manage', description: 'Create, update, and delete installment plans and templates' },
    { code: 'installments:activate', description: 'Activate or deactivate installment plan templates' },
  ];

  const allPermissions = [...brokerPermissions, ...corePermissions];
  await Promise.all(
    allPermissions.map((p) =>
      prisma.permission.upsert({
        where: { code: p.code },
        create: p,
        update: { description: p.description },
      }),
    ),
  );

  // ---- Grant every permission to the bootstrap admin ----
  // Keeps the admin UI consistent (no "missing codes" rows) and means the
  // bootstrap admin can exercise PermissionsStrict() actions out of the box.
  // Skipped silently if the admin row doesn't exist for any reason.
  const bootstrapAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
    select: { id: true },
  });
  if (bootstrapAdmin) {
    const allRows = await prisma.permission.findMany({ select: { id: true } });
    await prisma.userPermission.createMany({
      data: allRows.map((p) => ({ userId: bootstrapAdmin.id, permissionId: p.id })),
      skipDuplicates: true,
    });
  }

  // ---- Grant the SALES default work/read tier to every SALES user ----
  // SALES users have role access to the dashboard but need explicit permission
  // codes (ADMIN bypasses; SALES does not). This is the read + CRM-workflow
  // tier only — no strict financial/admin actions (approve/reject/sign/verify/
  // pay, plan/project/unit mutations, users/permissions/settings) are granted.
  // Idempotent via skipDuplicates; safe to re-run.
  const SALES_DEFAULT_PERMISSIONS = [
    // CRM
    'leads:read', 'leads:create', 'leads:update', 'leads:note',
    'leads:assign', 'leads:advance-stage',
    // Visits
    'visits:read', 'visits:create', 'visits:schedule', 'visits:confirm',
    'visits:complete', 'visits:reschedule', 'visits:cancel', 'visits:no-show',
    // Reservations (create/read/update only — strict transitions stay admin)
    'reservations:read', 'reservations:create', 'reservations:update',
    // Contracts (read only)
    'contracts:read',
    // Inventory / read-only references
    'projects:read', 'units:read', 'installments:read', 'deposits:read',
    // Compensation self-read (API self-scopes SALES to their own rows)
    'bonus:entries:read', 'targets:read',
    // Broker-attributed read surfaces SALES routes already allow
    'broker_leads:read', 'broker_contracts:read', 'broker_reservations:read',
  ];

  const salesUsers = await prisma.user.findMany({
    where: { role: UserRole.SALES },
    select: { id: true },
  });
  if (salesUsers.length > 0) {
    const salesPerms = await prisma.permission.findMany({
      where: { code: { in: SALES_DEFAULT_PERMISSIONS } },
      select: { id: true },
    });
    await prisma.userPermission.createMany({
      data: salesUsers.flatMap((u) =>
        salesPerms.map((p) => ({ userId: u.id, permissionId: p.id })),
      ),
      skipDuplicates: true,
    });
  }

  // ---- Grant the SALES_MANAGER default tier to every SALES_MANAGER user ----
  // The SALES work/read tier; team scoping (Batch 9) restricts the data each
  // manager sees to their own reps. NO strict/admin/finance codes are granted.
  // Reports (sales/operational) are intentionally NOT granted: those report
  // endpoints aggregate ALL sales data and are not team-scoped, so they remain
  // ADMIN-only until a team-scoped reporting surface exists. Idempotent via
  // skipDuplicates.
  const SALES_MANAGER_DEFAULT_PERMISSIONS = [...SALES_DEFAULT_PERMISSIONS];

  const managerUsers = await prisma.user.findMany({
    where: { role: UserRole.SALES_MANAGER },
    select: { id: true },
  });
  if (managerUsers.length > 0) {
    const managerPerms = await prisma.permission.findMany({
      where: { code: { in: SALES_MANAGER_DEFAULT_PERMISSIONS } },
      select: { id: true },
    });
    await prisma.userPermission.createMany({
      data: managerUsers.flatMap((u) =>
        managerPerms.map((p) => ({ userId: u.id, permissionId: p.id })),
      ),
      skipDuplicates: true,
    });
  }

  console.log('✅ Seed complete');
  console.log('   Admin:', adminEmail, '/', adminPassword);
  console.log('   Sales: sales@example.com / SalesPass123!');
  console.log('   Manager: manager@example.com / ManagerPass123!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
