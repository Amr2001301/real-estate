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
  media?: string[];
  latitude?: number;
  longitude?: number;
  address?: string;
};

/**
 * Attach demo images to a unit, but only when it has none — so re-seeding never
 * duplicates media and never clobbers admin-added images.
 */
async function ensureUnitMedia(unitId: string, urls: string[]) {
  if (urls.length === 0) return;
  const existing = await prisma.unitMedia.count({ where: { unitId } });
  if (existing > 0) return;
  await prisma.unitMedia.createMany({
    data: urls.map((url, i) => ({ unitId, url, type: MediaType.IMAGE, order: i })),
  });
}

async function ensureUnits(buildingId: string, units: UnitSeed[]) {
  for (const u of units) {
    const { media, latitude, longitude, address, ...data } = u;
    const unit = await prisma.unit.upsert({
      where: { buildingId_code: { buildingId, code: u.code } },
      create: { buildingId, ...data, latitude, longitude, address },
      // Don't overwrite admin-edited unit state on re-seed, but backfill
      // location if it was never set (migration added nullable columns).
      update: {
        ...(latitude != null ? { latitude } : {}),
        ...(longitude != null ? { longitude } : {}),
        ...(address != null ? { address } : {}),
      },
    });
    if (media && media.length) await ensureUnitMedia(unit.id, media);
  }
}

// ============================================================================
// Public website demo data (gated by SEED_PUBLIC_DEMO=true)
//
// Realistic PUBLISHED projects + AVAILABLE units so the public website can be
// reviewed end-to-end. Fully idempotent: projects/phases/buildings are matched
// by name, units by (buildingId, code), media only added when none exist. Never
// deletes or overwrites existing/admin-edited data. Cities use the Arabic names
// the website's city filter expects.
// ============================================================================

// Stable Unsplash real-estate/architecture images (render in plain <img>).
const DEMO_IMG = {
  apartment1: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200',
  apartment2: 'https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?w=1200',
  interior1: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200',
  highrise: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200',
  villa1: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200',
  villa2: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200',
  modernHouse: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1200',
  officeExt: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200',
  officeInt: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200',
} as const;

async function seedPublicDemo() {
  if (process.env.SEED_PUBLIC_DEMO !== 'true') return;
  console.log('🏙️  Seeding public website demo data (SEED_PUBLIC_DEMO=true)…');

  // ── 1) Nile Crest Residences — luxury waterfront apartments (جدة, featured) ──
  const nileCrest = await ensureProject({
    nameAr: 'نايل كريست ريزيدنس',
    nameEn: 'Nile Crest Residences',
    descriptionAr:
      'مجمع سكني فاخر على الواجهة البحرية يجمع بين الإطلالات الساحرة والتشطيبات الراقية، مع مرافق متكاملة تمنح سكانه تجربة حياة استثنائية تجمع بين الخصوصية والرفاهية.',
    descriptionEn:
      'A luxury waterfront residence blending captivating views with refined finishes and full-service amenities for an exceptional living experience.',
    city: 'جدة',
    lat: 21.5433,
    lng: 39.1728,
    status: ProjectStatus.PUBLISHED,
    featured: true,
    services: [
      { ar: 'إطلالة بحرية', en: 'Sea View' },
      { ar: 'حمام سباحة لا متناهي', en: 'Infinity Pool' },
      { ar: 'نادي صحي', en: 'Health Club' },
      { ar: 'أمن وحراسة على مدار الساعة', en: '24/7 Security' },
      { ar: 'مواقف خاصة', en: 'Private Parking' },
    ],
    mediaUrls: [DEMO_IMG.apartment1, DEMO_IMG.apartment2, DEMO_IMG.interior1],
  });
  const ncPhase = await ensurePhase(nileCrest.id, 'المرحلة الأولى', 'Phase 1', 0);
  const ncTowerA = await ensureBuilding(ncPhase.id, 'Nile Tower A', 20, 0);
  const ncTowerB = await ensureBuilding(ncPhase.id, 'Nile Tower B', 18, 1);
  await ensureUnits(ncTowerA.id, [
    { code: 'NC-A-101', type: 'studio', area: 80, bedrooms: 1, bathrooms: 1, floor: 1, price: 1200000, media: [DEMO_IMG.interior1], latitude: 21.5433, longitude: 39.1728, address: 'Nile Tower A، شارع الأمير محمد بن عبدالعزيز، جدة' },
    { code: 'NC-A-102', type: '1BR', area: 95, bedrooms: 1, bathrooms: 1, floor: 1, price: 1450000, media: [DEMO_IMG.apartment2], latitude: 21.5433, longitude: 39.1728, address: 'Nile Tower A، شارع الأمير محمد بن عبدالعزيز، جدة' },
    { code: 'NC-A-201', type: '2BR', area: 130, bedrooms: 2, bathrooms: 2, floor: 2, price: 2100000, media: [DEMO_IMG.apartment1, DEMO_IMG.interior1], latitude: 21.5433, longitude: 39.1728, address: 'Nile Tower A، شارع الأمير محمد بن عبدالعزيز، جدة' },
    { code: 'NC-A-305', type: '3BR', area: 180, bedrooms: 3, bathrooms: 3, floor: 3, price: 3200000, media: [DEMO_IMG.apartment1], latitude: 21.5433, longitude: 39.1728, address: 'Nile Tower A، شارع الأمير محمد بن عبدالعزيز، جدة' },
  ]);
  await ensureUnits(ncTowerB.id, [
    { code: 'NC-B-210', type: '2BR', area: 125, bedrooms: 2, bathrooms: 2, floor: 2, price: 2050000, status: UnitStatus.RESERVED, media: [DEMO_IMG.apartment2], latitude: 21.5434, longitude: 39.1730, address: 'Nile Tower B، شارع الأمير محمد بن عبدالعزيز، جدة' },
  ]);

  // ── 2) Palm District — villas & townhouses (الرياض, featured) ──
  const palm = await ensureProject({
    nameAr: 'حي النخيل',
    nameEn: 'Palm District',
    descriptionAr:
      'مجتمع سكني متكامل من الفلل والتاون هاوس وسط مساحات خضراء واسعة وممرات للمشي، مصمم ليمنح العائلات الخصوصية والراحة ضمن بيئة عصرية متكاملة الخدمات.',
    descriptionEn:
      'An integrated community of villas and townhouses set amid generous green spaces and walkways, designed to give families privacy and comfort.',
    city: 'الرياض',
    lat: 24.7136,
    lng: 46.6753,
    status: ProjectStatus.PUBLISHED,
    featured: true,
    services: [
      { ar: 'حدائق خاصة', en: 'Private Gardens' },
      { ar: 'مسارات للمشي', en: 'Walking Trails' },
      { ar: 'نادي للعائلات', en: 'Family Clubhouse' },
      { ar: 'ملاعب أطفال', en: "Children's Playgrounds" },
    ],
    mediaUrls: [DEMO_IMG.villa1, DEMO_IMG.villa2, DEMO_IMG.modernHouse],
  });
  const palmPhase = await ensurePhase(palm.id, 'المرحلة الأولى', 'Phase 1', 0);
  const palmCluster = await ensureBuilding(palmPhase.id, 'Palm Cluster A', 2, 0);
  await ensureUnits(palmCluster.id, [
    { code: 'PD-V-01', type: 'villa', area: 420, bedrooms: 5, bathrooms: 5, floor: 0, price: 6500000, media: [DEMO_IMG.villa1, DEMO_IMG.villa2], latitude: 24.7136, longitude: 46.6753, address: 'Palm Cluster A، حي النرجس، الرياض' },
    { code: 'PD-V-02', type: 'villa', area: 380, bedrooms: 4, bathrooms: 4, floor: 0, price: 5800000, media: [DEMO_IMG.villa2], latitude: 24.7138, longitude: 46.6755, address: 'Palm Cluster A، حي النرجس، الرياض' },
    { code: 'PD-T-01', type: 'townhouse', area: 260, bedrooms: 4, bathrooms: 3, floor: 0, price: 3900000, media: [DEMO_IMG.modernHouse], latitude: 24.7140, longitude: 46.6757, address: 'Palm Cluster A، حي النرجس، الرياض' },
    { code: 'PD-T-02', type: 'townhouse', area: 240, bedrooms: 3, bathrooms: 3, floor: 0, price: 3600000, status: UnitStatus.SOLD, media: [DEMO_IMG.modernHouse], latitude: 24.7142, longitude: 46.6759, address: 'Palm Cluster A، حي النرجس، الرياض' },
  ]);

  // ── 3) The Avenue Business Hub — commercial / offices (الدمام) ──
  const avenue = await ensureProject({
    nameAr: 'ذا أفنيو للأعمال',
    nameEn: 'The Avenue Business Hub',
    descriptionAr:
      'وجهة أعمال متكاملة تضم مكاتب ومساحات تجارية بمواصفات عالمية في موقع استراتيجي، مصممة لتلبية احتياجات الشركات الطموحة بمرونة وكفاءة.',
    descriptionEn:
      'A world-class business destination of offices and retail spaces in a strategic location, built for ambitious companies.',
    city: 'الدمام',
    lat: 26.4207,
    lng: 50.0888,
    status: ProjectStatus.PUBLISHED,
    featured: false,
    services: [
      { ar: 'قاعات اجتماعات', en: 'Meeting Rooms' },
      { ar: 'استقبال مشترك', en: 'Shared Reception' },
      { ar: 'مواقف زوار', en: 'Visitor Parking' },
      { ar: 'إنترنت فائق السرعة', en: 'High-Speed Internet' },
    ],
    mediaUrls: [DEMO_IMG.officeExt, DEMO_IMG.officeInt, DEMO_IMG.highrise],
  });
  const avPhase = await ensurePhase(avenue.id, 'المرحلة الأولى', 'Phase 1', 0);
  const avTower = await ensureBuilding(avPhase.id, 'Business Tower', 24, 0);
  await ensureUnits(avTower.id, [
    { code: 'AV-O-101', type: 'office', area: 120, bedrooms: 0, bathrooms: 1, floor: 1, price: 1900000, media: [DEMO_IMG.officeInt], latitude: 26.4207, longitude: 50.0888, address: 'Business Tower، شارع الأمير محمد بن فهد، الدمام' },
    { code: 'AV-O-205', type: 'office', area: 180, bedrooms: 0, bathrooms: 2, floor: 2, price: 2800000, media: [DEMO_IMG.officeInt, DEMO_IMG.officeExt], latitude: 26.4207, longitude: 50.0888, address: 'Business Tower، شارع الأمير محمد بن فهد، الدمام' },
    { code: 'AV-R-001', type: 'retail', area: 90, bedrooms: 0, bathrooms: 1, floor: 0, price: 1600000, media: [DEMO_IMG.officeExt], latitude: 26.4207, longitude: 50.0888, address: 'Business Tower، شارع الأمير محمد بن فهد، الدمام' },
    { code: 'AV-O-310', type: 'office', area: 250, bedrooms: 0, bathrooms: 2, floor: 3, price: 3500000, media: [DEMO_IMG.officeInt], latitude: 26.4207, longitude: 50.0888, address: 'Business Tower، شارع الأمير محمد بن فهد، الدمام' },
  ]);

  // ── 4) Solara Heights — modern high-rise apartments (مكة المكرمة) ──
  const solara = await ensureProject({
    nameAr: 'سولارا هايتس',
    nameEn: 'Solara Heights',
    descriptionAr:
      'برج سكني عصري شاهق يوفر شققًا أنيقة بإطلالات بانورامية ومرافق راقية، في موقع حيوي يجمع بين سهولة الوصول وهدوء الحياة المرتفعة.',
    descriptionEn:
      'A modern high-rise offering elegant apartments with panoramic views and premium amenities in a vibrant, well-connected location.',
    city: 'مكة المكرمة',
    lat: 21.3891,
    lng: 39.8579,
    status: ProjectStatus.PUBLISHED,
    featured: false,
    services: [
      { ar: 'إطلالات بانورامية', en: 'Panoramic Views' },
      { ar: 'صالة رياضية', en: 'Fitness Center' },
      { ar: 'منطقة شواء', en: 'BBQ Area' },
      { ar: 'كونسيرج', en: 'Concierge' },
    ],
    mediaUrls: [DEMO_IMG.highrise, DEMO_IMG.apartment1, DEMO_IMG.interior1],
  });
  const solPhase = await ensurePhase(solara.id, 'المرحلة الأولى', 'Phase 1', 0);
  const solTower = await ensureBuilding(solPhase.id, 'Solara Tower One', 30, 0);
  await ensureUnits(solTower.id, [
    { code: 'SH-101', type: '1BR', area: 90, bedrooms: 1, bathrooms: 1, floor: 1, price: 1300000, media: [DEMO_IMG.interior1], latitude: 21.3891, longitude: 39.8579, address: 'Solara Tower One، شارع إبراهيم الخليل، مكة المكرمة' },
    { code: 'SH-205', type: '2BR', area: 120, bedrooms: 2, bathrooms: 2, floor: 2, price: 1950000, media: [DEMO_IMG.apartment1], latitude: 21.3891, longitude: 39.8579, address: 'Solara Tower One، شارع إبراهيم الخليل، مكة المكرمة' },
    { code: 'SH-310', type: '2BR', area: 135, bedrooms: 2, bathrooms: 2, floor: 3, price: 2150000, media: [DEMO_IMG.apartment2], latitude: 21.3891, longitude: 39.8579, address: 'Solara Tower One، شارع إبراهيم الخليل، مكة المكرمة' },
    { code: 'SH-1201', type: '3BR', area: 175, bedrooms: 3, bathrooms: 3, floor: 12, price: 3400000, media: [DEMO_IMG.apartment1, DEMO_IMG.highrise], latitude: 21.3891, longitude: 39.8579, address: 'Solara Tower One، شارع إبراهيم الخليل، مكة المكرمة' },
    { code: 'SH-1505', type: 'studio', area: 70, bedrooms: 1, bathrooms: 1, floor: 15, price: 1100000, media: [DEMO_IMG.interior1], latitude: 21.3891, longitude: 39.8579, address: 'Solara Tower One، شارع إبراهيم الخليل، مكة المكرمة' },
  ]);

  console.log('🏙️  Public demo data ready: 4 projects · 18 units.');
}

// ============================================================================
// Seed
// ============================================================================

// ---------------------------------------------------------------------------
// Backfill companyId on all scoped tables that still have NULL rows.
// Safe to call multiple times — only updates rows where companyId IS NULL.
// ---------------------------------------------------------------------------
async function backfillCompanyId(companyId: string) {
  const tables = [
    'Project', 'Phase', 'Building', 'Unit', 'UnitStatusHistory', 'UnitMaintenanceItem',
    'LeadSource', 'Lead', 'LeadNote', 'LeadActivity',
    'InfoRequest', 'VisitRequest', 'VisitAppointment', 'VisitActivity',
    'Reservation', 'ReservationNote', 'ReservationActivity',
    'Contract', 'InstallmentPlan', 'Installment', 'Deposit',
    'InstallmentPlanTemplate', 'BonusRule', 'BonusEntry', 'SalesTarget',
    'MaintenanceCategory', 'MaintenanceRequest', 'MaintenanceRequestItem',
    'CmsPage', 'Banner', 'Article', 'NotificationTemplate', 'Notification', 'AuditLog',
    'Broker', 'BrokerUser', 'BrokerProjectAccess', 'BrokerUnitAccess',
    'BrokerCommission', 'BrokerPayout', 'BrokerActivityLog',
    'Setting', 'Document', 'ChatSession', 'ChatMessage', 'ChatFeedback',
  ];
  for (const table of tables) {
    await prisma.$executeRawUnsafe(
      `UPDATE "${table}" SET "companyId" = $1::uuid WHERE "companyId" IS NULL`,
      companyId,
    );
  }
  // Backfill User table: all roles including CLIENT/CUSTOMER.
  // CLIENT/CUSTOMER users must have a companyId so the TenantContextInterceptor
  // can scope their requests correctly. The interceptor has a legacy fallback, but
  // the authoritative fix is to populate the column at creation time (and here).
  await prisma.$executeRawUnsafe(
    `UPDATE "User" SET "companyId" = $1::uuid WHERE "companyId" IS NULL`,
    companyId,
  );
}

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';

  console.log('🌱 Seeding database…');

  // ---- Default Company (idempotent by slug) ----
  // When DEFAULT_COMPANY_ID is set we pin the company to that UUID so all
  // environments (dev, e2e, staging) share the same ID and FK references in
  // seeded data always resolve correctly.
  const seedCompanyId = process.env.DEFAULT_COMPANY_ID;
  const company = await prisma.company.upsert({
    where: { slug: process.env.SEED_COMPANY_SLUG ?? 'default' },
    create: {
      ...(seedCompanyId ? { id: seedCompanyId } : {}),
      name: process.env.SEED_COMPANY_NAME ?? 'Real Estate Platform',
      slug: process.env.SEED_COMPANY_SLUG ?? 'default',
      country: process.env.SEED_COMPANY_COUNTRY ?? 'SA',
      currency: process.env.SEED_COMPANY_CURRENCY ?? 'SAR',
      defaultLocale: 'ar',
      timezone: process.env.SEED_COMPANY_TIMEZONE ?? 'Asia/Riyadh',
      isActive: true,
    },
    update: {
      name: process.env.SEED_COMPANY_NAME ?? 'Real Estate Platform',
    },
  });

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

  // Demo MAINTENANCE_SUPERVISOR (mobile-only staff role; no web dashboard).
  // Idempotent by its dedicated demo email.
  const supervisorHash = await argon2.hash('MaintenancePass123!');
  await prisma.user.upsert({
    where: { email: 'maintenance@example.com' },
    create: {
      email: 'maintenance@example.com',
      passwordHash: supervisorHash,
      fullName: 'Khaled Maintenance',
      role: UserRole.MAINTENANCE_SUPERVISOR,
      locale: 'ar',
    },
    update: { passwordHash: supervisorHash },
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
    { code: 'A-101', type: '1BR', area: 75, bedrooms: 1, bathrooms: 1, floor: 1, price: 850000, latitude: 24.7136, longitude: 46.6753, address: 'Building A، كمبوند الرياض الجديدة، الرياض' },
    { code: 'A-102', type: '2BR', area: 110, bedrooms: 2, bathrooms: 2, floor: 1, price: 1250000, latitude: 24.7136, longitude: 46.6753, address: 'Building A، كمبوند الرياض الجديدة، الرياض' },
    { code: 'A-201', type: '2BR', area: 115, bedrooms: 2, bathrooms: 2, floor: 2, price: 1300000, status: UnitStatus.RESERVED, latitude: 24.7136, longitude: 46.6753, address: 'Building A، كمبوند الرياض الجديدة، الرياض' },
    { code: 'A-301', type: '3BR', area: 165, bedrooms: 3, bathrooms: 2, floor: 3, price: 1850000, latitude: 24.7136, longitude: 46.6753, address: 'Building A، كمبوند الرياض الجديدة، الرياض' },
  ]);
  await ensureUnits(buildingB.id, [
    { code: 'B-101', type: '2BR', area: 105, bedrooms: 2, bathrooms: 2, floor: 1, price: 1180000, latitude: 24.7138, longitude: 46.6755, address: 'Building B، كمبوند الرياض الجديدة، الرياض' },
    { code: 'B-102', type: '3BR', area: 160, bedrooms: 3, bathrooms: 3, floor: 1, price: 1750000, latitude: 24.7138, longitude: 46.6755, address: 'Building B، كمبوند الرياض الجديدة، الرياض' },
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

  // ---- Default bonus rule (idempotent: skip if any rule already exists for company) ----
  // Created inactive so admins consciously enable auto-commission per company.
  // To activate: set active=true AND autoApplyOnSignedContract=true in admin panel.
  const existingBonusRule = await prisma.bonusRule.findFirst({
    where: { companyId: company.id },
    select: { id: true },
  });
  if (!existingBonusRule) {
    await prisma.bonusRule.create({
      data: {
        name: 'Sales Commission (Default)',
        percentage: 2,
        active: false,
        autoApplyOnSignedContract: false,
        conditions: {},
        companyId: company.id,
      },
    });
    console.log('   ✓ Default bonus rule seeded (inactive — enable in admin panel)');
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
      {
        code: 'maintenance_request_created',
        channel: NotificationChannel.IN_APP,
        ar_subject: 'طلب صيانة جديد',
        en_subject: 'New maintenance request',
        ar_body: 'تم إنشاء طلب صيانة جديد للوحدة {{unitCode}}.',
        en_body: 'A new maintenance request was created for unit {{unitCode}}.',
      },
      {
        code: 'maintenance_request_assigned',
        channel: NotificationChannel.IN_APP,
        ar_subject: 'تم إسناد طلب صيانة',
        en_subject: 'Maintenance request assigned',
        ar_body: 'تم إسناد طلب الصيانة للوحدة {{unitCode}} إليك.',
        en_body: 'The maintenance request for unit {{unitCode}} was assigned to you.',
      },
      {
        code: 'maintenance_request_status_changed',
        channel: NotificationChannel.IN_APP,
        ar_subject: 'تحديث حالة طلب الصيانة',
        en_subject: 'Maintenance status updated',
        ar_body: 'تم تحديث حالة طلب الصيانة للوحدة {{unitCode}} إلى {{statusLabel}}.',
        en_body: 'The maintenance request for unit {{unitCode}} is now {{statusLabel}}.',
      },
      {
        code: 'maintenance_request_resolved',
        channel: NotificationChannel.IN_APP,
        ar_subject: 'تم حل طلب الصيانة',
        en_subject: 'Maintenance request resolved',
        ar_body: 'تم وضع طلب الصيانة للوحدة {{unitCode}} كتم حله.',
        en_body: 'The maintenance request for unit {{unitCode}} was marked resolved.',
      },
      {
        code: 'maintenance_request_closed',
        channel: NotificationChannel.IN_APP,
        ar_subject: 'تم إغلاق طلب الصيانة',
        en_subject: 'Maintenance request closed',
        ar_body: 'تم إغلاق طلب الصيانة للوحدة {{unitCode}}.',
        en_body: 'The maintenance request for unit {{unitCode}} was closed.',
      },
      // Resolution loop (Phase A). complaint → staff; unresolved → staff +
      // customer; resolution_confirmed → staff. Payloads carry deep-link
      // metadata (entityType/entityId/requestId/action).
      {
        code: 'maintenance_request_complaint_submitted',
        channel: NotificationChannel.IN_APP,
        ar_subject: 'شكوى على طلب صيانة متأخر',
        en_subject: 'Complaint on overdue maintenance',
        ar_body: 'قدّم العميل شكوى بشأن تأخر طلب الصيانة للوحدة {{unitCode}}.',
        en_body: 'The customer filed a complaint about the overdue maintenance request for unit {{unitCode}}.',
      },
      {
        code: 'maintenance_request_unresolved',
        channel: NotificationChannel.IN_APP,
        ar_subject: 'طلب صيانة لم يُحل',
        en_subject: 'Maintenance request unresolved',
        ar_body: 'تم تصنيف طلب الصيانة للوحدة {{unitCode}} كغير مُنجز بعد تجاوز المهلة.',
        en_body: 'The maintenance request for unit {{unitCode}} was marked unresolved after the deadline passed.',
      },
      {
        code: 'maintenance_request_resolution_confirmed',
        channel: NotificationChannel.IN_APP,
        ar_subject: 'تم تأكيد حل طلب الصيانة',
        en_subject: 'Maintenance resolution confirmed',
        ar_body: 'تم تأكيد حل طلب الصيانة للوحدة {{unitCode}}.',
        en_body: 'Resolution of the maintenance request for unit {{unitCode}} was confirmed.',
      },
      // ─── Visit lifecycle (P3) ────────────────────────────────────────────
      // Placeholders are restricted to identity / scheduling context only —
      // no phone, email, address, reservation amounts, or internal ids leak
      // into notification bodies. `requestId` / `visitId` are surfaced for
      // routing purposes only and never read by the rendered body.
      {
        code: 'visit_request_created',
        channel: NotificationChannel.IN_APP,
        ar_subject: 'طلب زيارة جديد',
        en_subject: 'New visit request',
        ar_body: 'طلب زيارة جديد من {{customerName}} لمشروع {{projectName}}.',
        en_body: 'New visit request from {{customerName}} for {{projectName}}.',
      },
      // P13 — fired to ADMIN + SALES_MANAGER when an info/general inquiry is
      // submitted (Guest, Client, or Customer). Safe placeholders only:
      // identity + project/unit context. NO phone, email, or message body.
      {
        code: 'info_request_created',
        channel: NotificationChannel.IN_APP,
        ar_subject: 'استفسار جديد',
        en_subject: 'New info request',
        ar_body: 'تم استلام استفسار جديد من {{customerName}}.',
        en_body: 'A new info request was received from {{customerName}}.',
      },
      {
        code: 'visit_scheduled',
        channel: NotificationChannel.PUSH,
        ar_subject: 'تم جدولة زيارتك',
        en_subject: 'Your visit was scheduled',
        ar_body: 'تم جدولة زيارة {{projectName}} في {{scheduledAt}}. يرجى التأكيد.',
        en_body: 'Your visit to {{projectName}} is scheduled for {{scheduledAt}}. Please confirm.',
      },
      {
        code: 'visit_sales_assigned',
        channel: NotificationChannel.PUSH,
        ar_subject: 'تم إسناد زيارة إليك',
        en_subject: 'A visit was assigned to you',
        ar_body: 'تم إسناد زيارة {{projectName}} لـ {{customerName}} في {{scheduledAt}}.',
        en_body: 'You are now assigned to {{customerName}}\'s visit to {{projectName}} on {{scheduledAt}}.',
      },
      {
        code: 'visit_customer_confirmed',
        channel: NotificationChannel.IN_APP,
        ar_subject: 'العميل أكد الزيارة',
        en_subject: 'Customer confirmed the visit',
        ar_body: '{{customerName}} أكد زيارة {{projectName}} في {{scheduledAt}}.',
        en_body: '{{customerName}} confirmed the visit to {{projectName}} on {{scheduledAt}}.',
      },
      {
        code: 'visit_customer_reschedule_requested',
        channel: NotificationChannel.IN_APP,
        ar_subject: 'طلب العميل إعادة الجدولة',
        en_subject: 'Customer requested reschedule',
        ar_body: '{{customerName}} طلب إعادة جدولة زيارة {{projectName}}. السبب: {{reason}}',
        en_body: '{{customerName}} asked to reschedule the visit to {{projectName}}. Reason: {{reason}}',
      },
      {
        code: 'visit_rescheduled',
        channel: NotificationChannel.PUSH,
        ar_subject: 'تم تغيير موعد زيارتك',
        en_subject: 'Your visit was rescheduled',
        ar_body: 'تم نقل زيارة {{projectName}} إلى {{scheduledAt}}.',
        en_body: 'Your visit to {{projectName}} was moved to {{scheduledAt}}.',
      },
      {
        code: 'visit_completed',
        channel: NotificationChannel.IN_APP,
        ar_subject: 'اكتملت زيارتك',
        en_subject: 'Visit completed',
        ar_body: 'شكراً لزيارتك مشروع {{projectName}}.',
        en_body: 'Thank you for visiting {{projectName}}.',
      },
      {
        code: 'visit_cancelled',
        channel: NotificationChannel.PUSH,
        ar_subject: 'تم إلغاء الزيارة',
        en_subject: 'Visit cancelled',
        ar_body: 'تم إلغاء زيارة {{projectName}}.',
        en_body: 'The visit to {{projectName}} was cancelled.',
      },
      {
        code: 'visit_no_show',
        channel: NotificationChannel.IN_APP,
        ar_subject: 'لم تتم الزيارة',
        en_subject: 'Visit marked no-show',
        ar_body: 'تم تسجيل عدم حضور للزيارة في {{projectName}} بتاريخ {{scheduledAt}}.',
        en_body: 'A no-show was recorded for the {{projectName}} visit on {{scheduledAt}}.',
      },
      {
        code: 'visit_day_reminder',
        channel: NotificationChannel.PUSH,
        ar_subject: 'تذكير بزيارة اليوم',
        en_subject: 'Reminder: visit today',
        ar_body: 'لديك زيارة لمشروع {{projectName}} اليوم في {{scheduledAt}}.',
        en_body: 'You have a visit to {{projectName}} today at {{scheduledAt}}.',
      },
      // Gap 7 — post-visit feedback. Request → customer (PUSH, actionable);
      // received → assigned sales (IN_APP, informational).
      {
        code: 'visit_feedback_requested',
        channel: NotificationChannel.PUSH,
        ar_subject: 'قيّم زيارتك',
        en_subject: 'Rate your visit',
        ar_body: 'اكتملت زيارتك لمشروع {{projectName}} — يسعدنا تقييمك لها.',
        en_body: 'Your visit to {{projectName}} is complete — we’d love your rating.',
      },
      {
        code: 'visit_feedback_received',
        channel: NotificationChannel.IN_APP,
        ar_subject: 'تقييم جديد لزيارة',
        en_subject: 'New visit rating',
        ar_body: 'قام العميل بتقييم زيارة {{projectName}} بـ {{rating}}/5.',
        en_body: 'The customer rated the {{projectName}} visit {{rating}}/5.',
      },
      // ─── Reservations (P4) ────────────────────────────────────────────────
      {
        code: 'reservation_submitted_admin',
        channel: NotificationChannel.IN_APP,
        ar_subject: 'حجز جديد بانتظار الموافقة',
        en_subject: 'New reservation pending approval',
        ar_body: 'حجز جديد للوحدة {{unitCode}} في {{projectName}} بانتظار المراجعة.',
        en_body: 'A new reservation for unit {{unitCode}} in {{projectName}} is pending review.',
      },
      {
        code: 'reservation_status_changed',
        channel: NotificationChannel.PUSH,
        ar_subject: 'تحديث حالة حجزك',
        en_subject: 'Reservation status updated',
        ar_body: 'تم تحديث حالة حجز الوحدة {{unitCode}} إلى {{status}}.',
        en_body: 'Reservation for unit {{unitCode}} is now {{status}}.',
      },
      {
        code: 'reservation_booking_paid',
        channel: NotificationChannel.PUSH,
        ar_subject: 'تم تأكيد دفعة الحجز',
        en_subject: 'Booking payment confirmed',
        ar_body: 'تم تأكيد استلام دفعة الحجز للوحدة {{unitCode}}.',
        en_body: 'We confirmed the booking payment for unit {{unitCode}}.',
      },
      // Gap 3 — customer is asked to pay the booking amount right after the
      // reservation is created (fired only when a booking amount is due).
      {
        code: 'reservation_payment_requested',
        channel: NotificationChannel.PUSH,
        ar_subject: 'مطلوب سداد مبلغ الحجز',
        en_subject: 'Booking payment required',
        ar_body:
          'تم إنشاء حجز للوحدة {{unitCode}} بمبلغ حجز {{bookingAmount}}. يُرجى رفع إثبات الدفع من صفحة الحجوزات.',
        en_body:
          'A reservation for unit {{unitCode}} was created with a booking amount of {{bookingAmount}}. Please upload your payment proof from the reservations page.',
      },
      // ─── Contracts (P4) ──────────────────────────────────────────────────
      {
        code: 'contract_created_customer',
        channel: NotificationChannel.PUSH,
        ar_subject: 'تم إنشاء عقدك',
        en_subject: 'Your contract is ready',
        ar_body: 'تم إنشاء عقد للوحدة {{unitCode}} في {{projectName}}.',
        en_body: 'A contract for unit {{unitCode}} in {{projectName}} was created.',
      },
      {
        code: 'contract_signed_customer',
        channel: NotificationChannel.PUSH,
        ar_subject: 'تم توقيع عقدك',
        en_subject: 'Your contract was signed',
        ar_body: 'تم توقيع العقد رقم {{contractNumber}} للوحدة {{unitCode}}.',
        en_body: 'Contract {{contractNumber}} for unit {{unitCode}} was signed.',
      },
      // P12 — fired when a downloadable contract document is registered for
      // the customer (during reservation→contract conversion or a later admin
      // upload). Safe payload only: contractNumber / unitCode / projectName /
      // contractId — never a file URL, signed URL, storage key, or raw path.
      {
        code: 'contract_document_available',
        channel: NotificationChannel.PUSH,
        ar_subject: 'عقدك جاهز للتحميل',
        en_subject: 'Your contract is ready to download',
        ar_body: 'أصبح ملف العقد رقم {{contractNumber}} للوحدة {{unitCode}} متاحًا للتحميل.',
        en_body: 'The contract document {{contractNumber}} for unit {{unitCode}} is now available to download.',
      },
      // Broker variant — only fires when the contract has brokerId set.
      {
        code: 'broker_contract_signed',
        channel: NotificationChannel.IN_APP,
        ar_subject: 'تم توقيع عقد من إحالتك',
        en_subject: 'A contract from your referral was signed',
        ar_body: 'تم توقيع العقد رقم {{contractNumber}} للوحدة {{unitCode}}.',
        en_body: 'Contract {{contractNumber}} for unit {{unitCode}} was signed.',
      },
      {
        code: 'broker_contract_created',
        channel: NotificationChannel.IN_APP,
        ar_subject: 'تم إنشاء عقد من إحالتك',
        en_subject: 'A contract from your referral was created',
        ar_body: 'تم إنشاء العقد للوحدة {{unitCode}} في {{projectName}}.',
        en_body: 'A contract for unit {{unitCode}} in {{projectName}} was created.',
      },
      // ─── Deposits (P4) ───────────────────────────────────────────────────
      {
        code: 'deposit_verified',
        channel: NotificationChannel.IN_APP,
        ar_subject: 'تم اعتماد دفعتك',
        en_subject: 'Deposit verified',
        ar_body: 'تم اعتماد دفعة بقيمة {{amount}} لعقدك.',
        en_body: 'A deposit of {{amount}} on your contract was verified.',
      },
      // ─── Payment proof workflow (P11) ────────────────────────────────────
      // Recipients differ per template:
      //   *_submitted, *_resubmitted → ADMIN + SALES_MANAGER
      //   *_approved, *_rejected     → the contract's customer
      // Payloads carry only safe scalars: depositId, dueDate, amount, and a
      // truncated reasonShort. NO receiptUrl, NO card data, NO internal notes.
      {
        code: 'payment_proof_submitted',
        channel: NotificationChannel.IN_APP,
        ar_subject: 'إثبات دفع جديد قيد المراجعة',
        en_subject: 'New payment proof pending review',
        ar_body: 'تم استلام إثبات دفع بقيمة {{amount}} لقسط مستحق بتاريخ {{installmentDueDate}}.',
        en_body: 'A payment proof of {{amount}} was submitted for an installment due {{installmentDueDate}}.',
      },
      {
        code: 'payment_proof_resubmitted',
        channel: NotificationChannel.IN_APP,
        ar_subject: 'تم إعادة إرسال إثبات الدفع',
        en_subject: 'Payment proof resubmitted',
        ar_body: 'تم إعادة إرسال إثبات دفع بقيمة {{amount}} لقسط مستحق بتاريخ {{installmentDueDate}}.',
        en_body: 'A payment proof of {{amount}} was resubmitted for an installment due {{installmentDueDate}}.',
      },
      // Gap 3 — booking-amount proof submitted by a customer (staff recipients).
      // Distinct from the installment template so the copy reads correctly
      // ("booking amount" not "installment").
      {
        code: 'booking_payment_proof_submitted',
        channel: NotificationChannel.IN_APP,
        ar_subject: 'إثبات دفع مبلغ حجز قيد المراجعة',
        en_subject: 'Booking payment proof pending review',
        ar_body: 'تم استلام إثبات دفع بقيمة {{amount}} لمبلغ حجز رقم {{reference}}.',
        en_body: 'A payment proof of {{amount}} was submitted for booking {{reference}}.',
      },
      {
        code: 'payment_proof_approved',
        channel: NotificationChannel.PUSH,
        ar_subject: 'تم التحقق من دفعتك',
        en_subject: 'Your payment was verified',
        ar_body: 'تم التحقق من دفعة بقيمة {{amount}} للقسط المستحق بتاريخ {{installmentDueDate}}.',
        en_body: 'A payment of {{amount}} for the installment due {{installmentDueDate}} was verified.',
      },
      {
        code: 'payment_proof_rejected',
        channel: NotificationChannel.PUSH,
        ar_subject: 'تم رفض إثبات الدفع',
        en_subject: 'Payment proof rejected',
        ar_body: 'تم رفض إثبات دفعة بقيمة {{amount}} للقسط المستحق بتاريخ {{installmentDueDate}}. السبب: {{reasonShort}}',
        en_body: 'A payment proof of {{amount}} for the installment due {{installmentDueDate}} was rejected. Reason: {{reasonShort}}',
      },
      // ─── Installments (P4) ───────────────────────────────────────────────
      {
        code: 'installment_plan_created',
        channel: NotificationChannel.IN_APP,
        ar_subject: 'خطة تقسيط جديدة',
        en_subject: 'New installment plan',
        ar_body: 'تمت إضافة خطة تقسيط جديدة لمشروع {{projectName}}.',
        en_body: 'A new installment plan was added for {{projectName}}.',
      },
      // P11.7 — daily due-soon reminder. Safe placeholders only: amount, due
      // date, project/unit/contract context. NO phone, email, URLs, or bank
      // details.
      {
        code: 'installment_due_soon',
        channel: NotificationChannel.PUSH,
        ar_subject: 'تذكير بقسط مستحق قريباً',
        en_subject: 'Upcoming installment due',
        ar_body: 'تذكير: قسط بقيمة {{amount}} مستحق بتاريخ {{dueDate}} لمشروع {{projectName}}.',
        en_body: 'Reminder: an installment of {{amount}} is due on {{dueDate}} for {{projectName}}.',
      },
      // ─── Broker leads (P4) ───────────────────────────────────────────────
      {
        code: 'broker_lead_approved',
        channel: NotificationChannel.IN_APP,
        ar_subject: 'تم اعتماد فرصتك',
        en_subject: 'Your lead was approved',
        ar_body: 'تم اعتماد الفرصة {{leadReference}}.',
        en_body: 'Lead {{leadReference}} was approved.',
      },
      {
        code: 'broker_lead_rejected',
        channel: NotificationChannel.IN_APP,
        ar_subject: 'تم رفض فرصتك',
        en_subject: 'Your lead was rejected',
        ar_body: 'تم رفض الفرصة {{leadReference}}.',
        en_body: 'Lead {{leadReference}} was rejected.',
      },
      {
        code: 'broker_lead_marked_duplicate',
        channel: NotificationChannel.IN_APP,
        ar_subject: 'فرصتك مكررة',
        en_subject: 'Your lead is a duplicate',
        ar_body: 'تم تصنيف الفرصة {{leadReference}} كفرصة مكررة.',
        en_body: 'Lead {{leadReference}} was marked as a duplicate.',
      },
      // ─── Broker commissions (P4) — only delivered to brokerUsers with
      //     canViewCommissions = true. Service-side filter.
      {
        code: 'broker_commission_earned',
        channel: NotificationChannel.IN_APP,
        ar_subject: 'عمولة جديدة',
        en_subject: 'Commission earned',
        ar_body: 'تم تسجيل عمولة جديدة برقم مرجعي {{reference}}.',
        en_body: 'A new commission {{reference}} was earned.',
      },
      {
        code: 'broker_commission_approved',
        channel: NotificationChannel.IN_APP,
        ar_subject: 'تم اعتماد عمولتك',
        en_subject: 'Commission approved',
        ar_body: 'تم اعتماد العمولة {{reference}}.',
        en_body: 'Commission {{reference}} was approved.',
      },
      {
        code: 'broker_commission_rejected',
        channel: NotificationChannel.IN_APP,
        ar_subject: 'تم رفض عمولتك',
        en_subject: 'Commission rejected',
        ar_body: 'تم رفض العمولة {{reference}}.',
        en_body: 'Commission {{reference}} was rejected.',
      },
      {
        code: 'broker_commission_cancelled',
        channel: NotificationChannel.IN_APP,
        ar_subject: 'تم إلغاء عمولتك',
        en_subject: 'Commission cancelled',
        ar_body: 'تم إلغاء العمولة {{reference}}.',
        en_body: 'Commission {{reference}} was cancelled.',
      },
      {
        code: 'broker_commission_paid',
        channel: NotificationChannel.PUSH,
        ar_subject: 'تم صرف عمولتك',
        en_subject: 'Commission paid',
        ar_body: 'تم صرف العمولة {{reference}}.',
        en_body: 'Commission {{reference}} was paid.',
      },
      // ─── Broker payouts (P4) ─────────────────────────────────────────────
      {
        code: 'broker_payout_created',
        channel: NotificationChannel.IN_APP,
        ar_subject: 'تم إنشاء دفعة',
        en_subject: 'A payout was drafted',
        ar_body: 'تم إنشاء دفعة برقم مرجعي {{reference}}.',
        en_body: 'Payout {{reference}} was drafted.',
      },
      {
        code: 'broker_payout_approved',
        channel: NotificationChannel.IN_APP,
        ar_subject: 'تم اعتماد دفعة',
        en_subject: 'A payout was approved',
        ar_body: 'تم اعتماد الدفعة {{reference}}.',
        en_body: 'Payout {{reference}} was approved.',
      },
      {
        code: 'broker_payout_processing',
        channel: NotificationChannel.IN_APP,
        ar_subject: 'الدفعة قيد المعالجة',
        en_subject: 'Payout processing',
        ar_body: 'الدفعة {{reference}} قيد المعالجة.',
        en_body: 'Payout {{reference}} is being processed.',
      },
      {
        code: 'broker_payout_paid',
        channel: NotificationChannel.PUSH,
        ar_subject: 'تم صرف الدفعة',
        en_subject: 'Payout paid',
        ar_body: 'تم صرف الدفعة {{reference}}.',
        en_body: 'Payout {{reference}} was paid.',
      },
      {
        code: 'broker_payout_cancelled',
        channel: NotificationChannel.IN_APP,
        ar_subject: 'تم إلغاء الدفعة',
        en_subject: 'Payout cancelled',
        ar_body: 'تم إلغاء الدفعة {{reference}}.',
        en_body: 'Payout {{reference}} was cancelled.',
      },
      // ─── Leads / CRM ─────────────────────────────────────────────────────
      {
        code: 'lead_created',
        channel: NotificationChannel.IN_APP,
        ar_subject: 'فرصة جديدة في CRM',
        en_subject: 'New lead in CRM',
        ar_body: 'تم إنشاء فرصة جديدة لـ {{customerName}} — {{projectName}}.',
        en_body: 'A new lead was created for {{customerName}} — {{projectName}}.',
      },
      {
        code: 'lead_assigned_sales',
        channel: NotificationChannel.PUSH,
        ar_subject: 'تم إسناد فرصة إليك',
        en_subject: 'A lead was assigned to you',
        ar_body: 'تم إسناد فرصة {{customerName}} في {{projectName}} إليك.',
        en_body: 'Lead for {{customerName}} in {{projectName}} was assigned to you.',
      },
      {
        code: 'lead_stage_changed',
        channel: NotificationChannel.IN_APP,
        ar_subject: 'تحديث مرحلة الفرصة',
        en_subject: 'Lead stage updated',
        ar_body: 'تحولت فرصة {{customerName}} من {{fromStage}} إلى {{toStage}}.',
        en_body: 'Lead for {{customerName}} moved from {{fromStage}} to {{toStage}}.',
      },
      {
        code: 'lead_note_added',
        channel: NotificationChannel.IN_APP,
        ar_subject: 'ملاحظة جديدة على الفرصة',
        en_subject: 'New note on lead',
        ar_body: 'تمت إضافة ملاحظة جديدة على فرصة {{customerName}}.',
        en_body: 'A new note was added to lead for {{customerName}}.',
      },
      // ─── Broker status ────────────────────────────────────────────────────
      {
        code: 'broker_approved',
        channel: NotificationChannel.PUSH,
        ar_subject: 'تم تفعيل حساب الوسيط',
        en_subject: 'Broker account activated',
        ar_body: 'تم تفعيل حساب شركة {{companyName}} والسماح بالوصول إلى المنصة.',
        en_body: 'The broker account for {{companyName}} has been activated and platform access granted.',
      },
      {
        code: 'broker_suspended',
        channel: NotificationChannel.PUSH,
        ar_subject: 'تم تعليق حساب الوسيط',
        en_subject: 'Broker account suspended',
        ar_body: 'تم تعليق حساب شركة {{companyName}} مؤقتاً.',
        en_body: 'The broker account for {{companyName}} has been suspended.',
      },
      // ─── Broker unit access ───────────────────────────────────────────────
      {
        code: 'broker_unit_access_requested',
        channel: NotificationChannel.IN_APP,
        ar_subject: 'طلب وصول وسيط لوحدة',
        en_subject: 'Broker unit access request',
        ar_body: 'طلب الوسيط {{companyName}} الوصول إلى الوحدة {{unitCode}}.',
        en_body: 'Broker {{companyName}} requested access to unit {{unitCode}}.',
      },
      {
        code: 'broker_unit_access_approved',
        channel: NotificationChannel.PUSH,
        ar_subject: 'تم الموافقة على طلب الوصول للوحدة',
        en_subject: 'Unit access approved',
        ar_body: 'تمت الموافقة على وصولك إلى الوحدة {{unitCode}} في {{projectName}}.',
        en_body: 'Your access to unit {{unitCode}} in {{projectName}} has been approved.',
      },
      {
        code: 'broker_unit_access_rejected',
        channel: NotificationChannel.IN_APP,
        ar_subject: 'تم رفض طلب الوصول للوحدة',
        en_subject: 'Unit access rejected',
        ar_body: 'تم رفض طلب الوصول إلى الوحدة {{unitCode}} في {{projectName}}.',
        en_body: 'Your access request for unit {{unitCode}} in {{projectName}} was rejected.',
      },
      // ─── Maintenance SLA ─────────────────────────────────────────────────
      {
        code: 'maintenance_sla_warning',
        channel: NotificationChannel.PUSH,
        ar_subject: 'تحذير: اقتراب انتهاء مهلة الصيانة',
        en_subject: 'Maintenance SLA warning',
        ar_body: 'طلب الصيانة للوحدة {{unitCode}} سيتجاوز المهلة المقررة خلال {{hoursLeft}} ساعة.',
        en_body: 'Maintenance request for unit {{unitCode}} will breach SLA in {{hoursLeft}} hours.',
      },
      {
        code: 'maintenance_sla_breached',
        channel: NotificationChannel.PUSH,
        ar_subject: 'تنبيه: تجاوز مهلة الصيانة',
        en_subject: 'Maintenance SLA breached',
        ar_body: 'تجاوز طلب الصيانة للوحدة {{unitCode}} المهلة المقررة. يرجى التصرف الفوري.',
        en_body: 'Maintenance request for unit {{unitCode}} has breached SLA. Immediate action required.',
      },
      // ─── User account lifecycle ───────────────────────────────────────────
      {
        code: 'user_account_approved',
        channel: NotificationChannel.PUSH,
        ar_subject: 'تم تفعيل حسابك',
        en_subject: 'Your account is active',
        ar_body: 'مرحباً {{name}}! تم تفعيل حسابك ويمكنك الآن تسجيل الدخول.',
        en_body: 'Welcome {{name}}! Your account is now active. You can log in.',
      },
      {
        code: 'user_account_suspended',
        channel: NotificationChannel.IN_APP,
        ar_subject: 'تم تعليق حسابك',
        en_subject: 'Your account has been suspended',
        ar_body: 'تم تعليق حسابك مؤقتاً. يرجى التواصل مع الإدارة للاستفسار.',
        en_body: 'Your account has been suspended. Please contact administration.',
      },
      // Admin manual broadcast — content is supplied at send-time via payload vars.
      {
        code: 'admin_broadcast',
        channel: NotificationChannel.IN_APP,
        ar_subject: '{{title_ar}}',
        en_subject: '{{title_en}}',
        ar_body: '{{body_ar}}',
        en_body: '{{body_en}}',
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
    { code: 'maintenance:items:manage', description: 'Manage unit maintenance/warranty items' },
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
  // Extends the SALES read/work tier with targets:manage so managers can set and
  // update team targets (POST /sales-targets is scope-enforced server-side).
  // Reports (sales/operational) are intentionally NOT granted: those report
  // endpoints aggregate ALL sales data and are not team-scoped, so they remain
  // ADMIN-only until a team-scoped reporting surface exists. Idempotent via
  // skipDuplicates.
  const SALES_MANAGER_DEFAULT_PERMISSIONS = [...SALES_DEFAULT_PERMISSIONS, 'targets:manage'];

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

  // ---- Grant the MAINTENANCE_SUPERVISOR tier to every supervisor user ----
  // Mobile-only staff. Scoped /me maintenance routes are role-gated, so this
  // tier stays minimal: read maintenance + drive status transitions. NO admin/
  // finance/security codes, and explicitly NOT maintenance:assign/create/
  // categories:manage or any documents:* grant (supervisor uploads go through
  // scoped /me routes, not the admin documents controller). Idempotent.
  const MAINTENANCE_SUPERVISOR_DEFAULT_PERMISSIONS = [
    'maintenance:read',
    'maintenance:resolve',
  ];

  const supervisorUsers = await prisma.user.findMany({
    where: { role: UserRole.MAINTENANCE_SUPERVISOR },
    select: { id: true },
  });
  if (supervisorUsers.length > 0) {
    const supervisorPerms = await prisma.permission.findMany({
      where: { code: { in: MAINTENANCE_SUPERVISOR_DEFAULT_PERMISSIONS } },
      select: { id: true },
    });
    await prisma.userPermission.createMany({
      data: supervisorUsers.flatMap((u) =>
        supervisorPerms.map((p) => ({ userId: u.id, permissionId: p.id })),
      ),
      skipDuplicates: true,
    });
  }

  // Optional: realistic public-website demo data (dev/staging only).
  await seedPublicDemo();

  // ---- Backfill companyId on all rows that were created before this seed run ----
  await backfillCompanyId(company.id);

  console.log('✅ Seed complete');
  console.log('   Admin:', adminEmail, '/', adminPassword);
  console.log('   Sales: sales@example.com / SalesPass123!');
  console.log('   Manager: manager@example.com / ManagerPass123!');
  console.log('   Maintenance Supervisor: maintenance@example.com / MaintenancePass123!');
}

// Auto-run only when invoked directly (e.g. `tsx prisma/seed.ts` /
// `pnpm prisma:seed`). When this module is *imported* by `seed-e2e.ts`,
// importing it must NOT trigger a write — the e2e seed calls `main()`
// itself, with `SEED_PUBLIC_DEMO=true` forced so it can find projects to
// grant broker access to. Idempotent either way.
export { main, backfillCompanyId };
export { prisma as _prismaSeedClient };

if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
