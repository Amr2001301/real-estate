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

  // ---- Broker permission codes (Phase 1: codes only; no role bindings yet) ----
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
    { code: 'broker_leads:approve', description: 'Approve a lead submitted by a broker' },
    { code: 'broker_leads:reject', description: 'Reject a lead submitted by a broker' },
  ];
  await Promise.all(
    brokerPermissions.map((p) =>
      prisma.permission.upsert({
        where: { code: p.code },
        create: p,
        update: { description: p.description },
      }),
    ),
  );

  console.log('✅ Seed complete');
  console.log('   Admin:', adminEmail, '/', adminPassword);
  console.log('   Sales: sales@example.com / SalesPass123!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
