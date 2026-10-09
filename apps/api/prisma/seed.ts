import {
  PrismaClient,
  UserRole,
  ProjectStatus,
  UnitStatus,
  MediaType,
} from '@prisma/client';
import { randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';
import { seedCancellationSettingsForCompany } from '../src/modules/contracts/cancellation-settings.constants';
import { normalizeHostname } from '../src/common/utils/hostname-normalize';
import { upsertUserByEmail } from './seed-user-upsert';
import { NOTIFICATION_CATALOG } from '../src/modules/notifications/notification-catalog';

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
  code: string;
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
      code: params.code,
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
  code: string,
  nameAr: string,
  nameEn: string,
  order: number,
) {
  const existing = await findPhaseByTranslatedName(projectId, nameAr, nameEn);
  if (existing) return existing;
  return prisma.phase.create({
    data: { projectId, code, name: { ar: nameAr, en: nameEn }, order },
  });
}

async function ensureBuilding(
  phaseId: string,
  code: string,
  name: string,
  totalFloors: number,
  order: number,
) {
  const existing = await findBuildingByName(phaseId, name);
  if (existing) return existing;
  return prisma.building.create({
    data: { phaseId, code, name, totalFloors, order },
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
    code: 'NILE-CREST',
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
  const ncPhase = await ensurePhase(nileCrest.id, 'NC-PH1', 'المرحلة الأولى', 'Phase 1', 0);
  const ncTowerA = await ensureBuilding(ncPhase.id, 'NC-TOWER-A', 'Nile Tower A', 20, 0);
  const ncTowerB = await ensureBuilding(ncPhase.id, 'NC-TOWER-B', 'Nile Tower B', 18, 1);
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
    code: 'PALM-DISTRICT',
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
  const palmPhase = await ensurePhase(palm.id, 'PD-PH1', 'المرحلة الأولى', 'Phase 1', 0);
  const palmCluster = await ensureBuilding(palmPhase.id, 'PD-CLUSTER-A', 'Palm Cluster A', 2, 0);
  await ensureUnits(palmCluster.id, [
    { code: 'PD-V-01', type: 'villa', area: 420, bedrooms: 5, bathrooms: 5, floor: 0, price: 6500000, media: [DEMO_IMG.villa1, DEMO_IMG.villa2], latitude: 24.7136, longitude: 46.6753, address: 'Palm Cluster A، حي النرجس، الرياض' },
    { code: 'PD-V-02', type: 'villa', area: 380, bedrooms: 4, bathrooms: 4, floor: 0, price: 5800000, media: [DEMO_IMG.villa2], latitude: 24.7138, longitude: 46.6755, address: 'Palm Cluster A، حي النرجس، الرياض' },
    { code: 'PD-T-01', type: 'townhouse', area: 260, bedrooms: 4, bathrooms: 3, floor: 0, price: 3900000, media: [DEMO_IMG.modernHouse], latitude: 24.7140, longitude: 46.6757, address: 'Palm Cluster A، حي النرجس، الرياض' },
    { code: 'PD-T-02', type: 'townhouse', area: 240, bedrooms: 3, bathrooms: 3, floor: 0, price: 3600000, status: UnitStatus.SOLD, media: [DEMO_IMG.modernHouse], latitude: 24.7142, longitude: 46.6759, address: 'Palm Cluster A، حي النرجس، الرياض' },
  ]);

  // ── 3) The Avenue Business Hub — commercial / offices (الدمام) ──
  const avenue = await ensureProject({
    code: 'AVENUE-BIZ',
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
  const avPhase = await ensurePhase(avenue.id, 'AV-PH1', 'المرحلة الأولى', 'Phase 1', 0);
  const avTower = await ensureBuilding(avPhase.id, 'AV-TOWER', 'Business Tower', 24, 0);
  await ensureUnits(avTower.id, [
    { code: 'AV-O-101', type: 'office', area: 120, bedrooms: 0, bathrooms: 1, floor: 1, price: 1900000, media: [DEMO_IMG.officeInt], latitude: 26.4207, longitude: 50.0888, address: 'Business Tower، شارع الأمير محمد بن فهد، الدمام' },
    { code: 'AV-O-205', type: 'office', area: 180, bedrooms: 0, bathrooms: 2, floor: 2, price: 2800000, media: [DEMO_IMG.officeInt, DEMO_IMG.officeExt], latitude: 26.4207, longitude: 50.0888, address: 'Business Tower، شارع الأمير محمد بن فهد، الدمام' },
    { code: 'AV-R-001', type: 'retail', area: 90, bedrooms: 0, bathrooms: 1, floor: 0, price: 1600000, media: [DEMO_IMG.officeExt], latitude: 26.4207, longitude: 50.0888, address: 'Business Tower، شارع الأمير محمد بن فهد، الدمام' },
    { code: 'AV-O-310', type: 'office', area: 250, bedrooms: 0, bathrooms: 2, floor: 3, price: 3500000, media: [DEMO_IMG.officeInt], latitude: 26.4207, longitude: 50.0888, address: 'Business Tower، شارع الأمير محمد بن فهد، الدمام' },
    { code: 'AV-O-401', type: 'office', area: 140, bedrooms: 0, bathrooms: 1, floor: 4, price: 2100000, media: [DEMO_IMG.officeInt], latitude: 26.4207, longitude: 50.0888, address: 'Business Tower، شارع الأمير محمد بن فهد، الدمام' },
    { code: 'AV-O-402', type: 'office', area: 160, bedrooms: 0, bathrooms: 1, floor: 4, price: 2400000, media: [DEMO_IMG.officeExt], latitude: 26.4207, longitude: 50.0888, address: 'Business Tower، شارع الأمير محمد بن فهد، الدمام' },
    { code: 'AV-O-501', type: 'office', area: 200, bedrooms: 0, bathrooms: 2, floor: 5, price: 3000000, media: [DEMO_IMG.officeInt], latitude: 26.4207, longitude: 50.0888, address: 'Business Tower، شارع الأمير محمد بن فهد، الدمام' },
    { code: 'AV-O-502', type: 'office', area: 220, bedrooms: 0, bathrooms: 2, floor: 5, price: 3200000, media: [DEMO_IMG.officeExt], latitude: 26.4207, longitude: 50.0888, address: 'Business Tower، شارع الأمير محمد بن فهد، الدمام' },
    { code: 'AV-R-002', type: 'retail', area: 75, bedrooms: 0, bathrooms: 1, floor: 0, price: 1400000, media: [DEMO_IMG.officeExt], latitude: 26.4207, longitude: 50.0888, address: 'Business Tower، شارع الأمير محمد بن فهد، الدمام' },
    { code: 'AV-R-003', type: 'retail', area: 85, bedrooms: 0, bathrooms: 1, floor: 0, price: 1550000, media: [DEMO_IMG.officeInt], latitude: 26.4207, longitude: 50.0888, address: 'Business Tower، شارع الأمير محمد بن فهد، الدمام' },
  ]);

  // ── 4) Solara Heights — modern high-rise apartments (مكة المكرمة) ──
  const solara = await ensureProject({
    code: 'SOLARA-HEIGHTS',
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
  const solPhase = await ensurePhase(solara.id, 'SH-PH1', 'المرحلة الأولى', 'Phase 1', 0);
  const solTower = await ensureBuilding(solPhase.id, 'SH-TOWER-1', 'Solara Tower One', 30, 0);
  await ensureUnits(solTower.id, [
    { code: 'SH-101', type: '1BR', area: 90, bedrooms: 1, bathrooms: 1, floor: 1, price: 1300000, media: [DEMO_IMG.interior1], latitude: 21.3891, longitude: 39.8579, address: 'Solara Tower One، شارع إبراهيم الخليل، مكة المكرمة' },
    { code: 'SH-205', type: '2BR', area: 120, bedrooms: 2, bathrooms: 2, floor: 2, price: 1950000, media: [DEMO_IMG.apartment1], latitude: 21.3891, longitude: 39.8579, address: 'Solara Tower One، شارع إبراهيم الخليل، مكة المكرمة' },
    { code: 'SH-310', type: '2BR', area: 135, bedrooms: 2, bathrooms: 2, floor: 3, price: 2150000, media: [DEMO_IMG.apartment2], latitude: 21.3891, longitude: 39.8579, address: 'Solara Tower One، شارع إبراهيم الخليل، مكة المكرمة' },
    { code: 'SH-1201', type: '3BR', area: 175, bedrooms: 3, bathrooms: 3, floor: 12, price: 3400000, media: [DEMO_IMG.apartment1, DEMO_IMG.highrise], latitude: 21.3891, longitude: 39.8579, address: 'Solara Tower One، شارع إبراهيم الخليل، مكة المكرمة' },
    { code: 'SH-1505', type: 'studio', area: 70, bedrooms: 1, bathrooms: 1, floor: 15, price: 1100000, media: [DEMO_IMG.interior1], latitude: 21.3891, longitude: 39.8579, address: 'Solara Tower One، شارع إبراهيم الخليل، مكة المكرمة' },
  ]);

  console.log('🏙️  Public demo data ready: 4 projects · 24 units.');
}

// ============================================================================
// Platform subdomain provisioning
//
// Mirrors SuperAdminService.createCompany() → provisionPlatformSubdomain().
// When PLATFORM_BASE_DOMAIN is set, creates {slug}.{PLATFORM_BASE_DOMAIN} as
// a PLATFORM_SUBDOMAIN domain row so the public website resolves the tenant
// from the real domain resolution path instead of needing DEV_TENANT_SLUG.
// When unset, logs a warning so local/CI operators know to set DEV_TENANT_SLUG.
// ============================================================================

async function seedPlatformSubdomain(companyId: string, slug: string): Promise<void> {
  const baseDomain = process.env.PLATFORM_BASE_DOMAIN;
  if (!baseDomain) {
    console.warn(
      '   ⚠  PLATFORM_BASE_DOMAIN is not set — platform subdomain provisioning skipped.' +
      ' Every page on this tenant\'s public site will 404 until the domain is resolved.' +
      ' Set PLATFORM_BASE_DOMAIN or DEV_TENANT_SLUG for local/CI use.',
    );
    return;
  }

  const rawHostname = `${slug}.${baseDomain}`;
  let hostname: string;
  try {
    hostname = normalizeHostname(rawHostname);
  } catch (err) {
    console.warn(`   ⚠  Could not normalize platform subdomain "${rawHostname}": ${(err as Error).message}. Skipping.`);
    return;
  }

  await prisma.companyDomain.upsert({
    where: { hostname },
    create: {
      companyId,
      hostname,
      type: 'PLATFORM_SUBDOMAIN',
      isPrimary: true,
      verifiedAt: new Date(),
      verificationToken: randomBytes(24).toString('hex'),
    },
    update: {},
  });
  console.log(`   ✓ Platform subdomain provisioned: ${hostname}`);
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
    // NotificationTemplate is not here: its NULL-company rows are the platform
    // defaults (FG-26), not orphans.
    'CmsPage', 'Banner', 'Article', 'Notification', 'AuditLog',
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
  // Backfill User table for all non-SUPER_ADMIN rows.
  // SUPER_ADMIN must remain companyId=null — it is a platform-level account and
  // the TenantContextInterceptor enforces bypass for SUPER_ADMIN at runtime.
  // MT-027 loginSuperAdmin requires role=SUPER_ADMIN AND companyId=null.
  await prisma.$executeRawUnsafe(
    `UPDATE "User" SET "companyId" = $1::uuid WHERE "companyId" IS NULL AND "role" != 'SUPER_ADMIN'`,
    companyId,
  );
}

async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SEED_IN_PRODUCTION !== 'true') {
    console.error('Seed blocked: NODE_ENV=production. Set ALLOW_SEED_IN_PRODUCTION=true to override.');
    process.exit(1);
  }

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
      country: process.env.SEED_COMPANY_COUNTRY ?? 'EG',
      currency: process.env.SEED_COMPANY_CURRENCY ?? 'EGP',
      defaultLocale: 'ar',
      timezone: process.env.SEED_COMPANY_TIMEZONE ?? 'Africa/Cairo',
      isActive: true,
      // MT-040/MT-036/MT-040A: explicit provisioning for seed company.
      type: 'DEVELOPER',
      lifecycleStatus: 'ACTIVE',
      websiteEnabled: true,
      customerAppEnabled: true,
      staffAppEnabled: true,
    },
    update: {
      name: process.env.SEED_COMPANY_NAME ?? 'Real Estate Platform',
      lifecycleStatus: 'ACTIVE',
      customerAppEnabled: true,
      staffAppEnabled: true,
      websiteEnabled: true,
    },
  });

  // ---- Platform subdomain (idempotent via hostname upsert) ----
  await seedPlatformSubdomain(company.id, company.slug);

  // ---- Users (idempotent via email upsert) ----
  const adminHash = await argon2.hash(adminPassword);
  await upsertUserByEmail(prisma, adminEmail, company.id, {
    create: {
      email: adminEmail,
      passwordHash: adminHash,
      fullName: 'Platform Admin',
      role: UserRole.ADMIN,
      locale: 'ar',
      companyId: company.id,
    },
    update: { passwordHash: adminHash },
  });

  const salesHash = await argon2.hash('SalesPass123!');
  const sales = await upsertUserByEmail(prisma, 'sales@example.com', company.id, {
    create: {
      email: 'sales@example.com',
      passwordHash: salesHash,
      fullName: 'Mohamed Sales',
      role: UserRole.SALES,
      locale: 'ar',
      companyId: company.id,
    },
    update: { passwordHash: salesHash },
  });

  // Demo SALES_MANAGER (idempotent by email; never overwrites a real user since
  // it is keyed on this dedicated demo address). Role foundation only — its
  // route access is intentionally limited until Batch 8.
  const managerHash = await argon2.hash('ManagerPass123!');
  const manager = await upsertUserByEmail(prisma, 'manager@example.com', company.id, {
    create: {
      email: 'manager@example.com',
      passwordHash: managerHash,
      fullName: 'Sara Manager',
      role: UserRole.SALES_MANAGER,
      locale: 'ar',
      companyId: company.id,
    },
    update: { passwordHash: managerHash },
  });

  // Demo MAINTENANCE_SUPERVISOR (mobile-only staff role; no web dashboard).
  // Idempotent by its dedicated demo email.
  const supervisorHash = await argon2.hash('MaintenancePass123!');
  await upsertUserByEmail(prisma, 'maintenance@example.com', company.id, {
    create: {
      email: 'maintenance@example.com',
      passwordHash: supervisorHash,
      fullName: 'Khaled Maintenance',
      role: UserRole.MAINTENANCE_SUPERVISOR,
      locale: 'ar',
      companyId: company.id,
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
    code: 'RIYADH-CP',
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
    'RY-PH1',
    'المرحلة الأولى',
    'Phase 1',
    0,
  );
  const buildingA = await ensureBuilding(phase1.id, 'RY-BLD-A', 'Building A', 6, 0);
  const buildingB = await ensureBuilding(phase1.id, 'RY-BLD-B', 'Building B', 4, 1);

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
    code: 'GOLF-VILLAS',
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

  // ---- Notification templates (platform defaults; the catalog is the source) ----
  await Promise.all(
    NOTIFICATION_CATALOG.map(async (t) => {
      // FG-26: platform defaults (companyId NULL), created once; a company's
      // edits live in its own override row and are never overwritten here.
      const existing = await prisma.notificationTemplate.findFirst({
        where: { code: t.code, companyId: null },
        select: { id: true },
      });
      if (existing) return;
      await prisma.notificationTemplate.create({
        data: {
          code: t.code,
          channel: t.channel,
          emailEnabled: t.emailEnabled ?? false,
          subject: { ar: t.ar_subject, en: t.en_subject },
          body: { ar: t.ar_body, en: t.en_body },
        },
      });
    }),
  );

  // ---- Lead + assignment (idempotent by clientId + projectInterestId) ----
  const fbSource = await findLeadSourceByEn('Facebook');
  if (fbSource) {
    const phone = '+201060000001';
    const email = 'ahmed@example.com';
    const fullName = 'Ahmed Khaled';
    const client =
      (await prisma.user.findFirst({ where: { phone, companyId: company.id } })) ??
      (await prisma.user.create({
        data: { role: 'CLIENT', fullName, phone, email, locale: 'ar', companyId: company.id },
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
    { code: 'deposits:reverse', description: 'Manually reverse an approved deposit (writes PaymentCorrection audit trail)' },
    { code: 'payment-instruments:manage', description: 'Create and transition payment instruments (cheques, bank transfers)' },
    { code: 'payment-instruments:bounce', description: 'Record cheque bounce (ADMIN-only, strict permission)' },
    { code: 'contracts:read', description: 'Read contract records' },
    { code: 'contracts:upload', description: 'Create contracts and attach PDFs' },
    { code: 'contracts:update', description: 'Update editable contract fields' },
    { code: 'contracts:sign', description: 'Sign contracts and materialize commission side effects' },
    { code: 'contracts:cancel', description: 'Cancel a contract and apply financial settlement (Step D3)' },
    { code: 'contracts:release-unit', description: 'Release the unit after a REQUIRES_APPROVAL cancellation (Step D3)' },
    { code: 'broker_commissions:read', description: 'Read broker commission records' },
    { code: 'broker_commissions:approve', description: 'Approve broker commissions' },
    { code: 'broker_commissions:reject', description: 'Reject broker commissions' },
    { code: 'broker_commissions:cancel', description: 'Cancel broker commissions' },
    { code: 'broker-commissions:clawback:resolve', description: 'Collect or waive an outstanding commission clawback receivable (Step D4)' },
    { code: 'bonus:clawback:resolve', description: 'Collect or waive an outstanding bonus entry clawback receivable (Step D4)' },
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
  const bootstrapAdmin = await prisma.user.findFirst({
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

  // ---- Step D2: seed cancellation/cheque settings for every company --------
  // Idempotent (createMany skipDuplicates). New companies get defaults; already-
  // configured values are never overwritten.
  const allCompanies = await prisma.company.findMany({ select: { id: true } });
  for (const c of allCompanies) {
    await seedCancellationSettingsForCompany(prisma, c.id);
  }

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
