import { PrismaClient, UserRole, ProjectStatus, UnitStatus, MediaType, NotificationChannel } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';

  console.log('🌱 Seeding database…');

  // ---- Users ----
  const adminHash = await argon2.hash(adminPassword);
  const admin = await prisma.user.upsert({
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

  // ---- Lead sources ----
  const sources = await Promise.all(
    [
      { ar: 'فيسبوك', en: 'Facebook' },
      { ar: 'انستغرام', en: 'Instagram' },
      { ar: 'موقع الويب', en: 'Website' },
      { ar: 'إحالة', en: 'Referral' },
    ].map((name) =>
      prisma.leadSource.create({ data: { name } }).catch(() => null),
    ),
  );

  // ---- Project + phases + buildings + units ----
  const project = await prisma.project.create({
    data: {
      name: { ar: 'كمبوند الرياض الجديدة', en: 'New Riyadh Compound' },
      description: {
        ar: 'مجتمع سكني فاخر بإطلالات خلابة ومرافق متكاملة.',
        en: 'A luxurious residential community with stunning views and full amenities.',
      },
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
      media: {
        create: [
          { url: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200', type: MediaType.IMAGE, order: 0 },
          { url: 'https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?w=1200', type: MediaType.IMAGE, order: 1 },
        ],
      },
      phases: {
        create: [
          {
            name: { ar: 'المرحلة الأولى', en: 'Phase 1' },
            order: 0,
            buildings: {
              create: [
                {
                  name: 'Building A',
                  totalFloors: 6,
                  units: {
                    create: [
                      { code: 'A-101', type: '1BR', area: 75, bedrooms: 1, bathrooms: 1, floor: 1, price: 850000 },
                      { code: 'A-102', type: '2BR', area: 110, bedrooms: 2, bathrooms: 2, floor: 1, price: 1250000 },
                      { code: 'A-201', type: '2BR', area: 115, bedrooms: 2, bathrooms: 2, floor: 2, price: 1300000, status: UnitStatus.RESERVED },
                      { code: 'A-301', type: '3BR', area: 165, bedrooms: 3, bathrooms: 2, floor: 3, price: 1850000 },
                    ],
                  },
                },
                {
                  name: 'Building B',
                  totalFloors: 4,
                  units: {
                    create: [
                      { code: 'B-101', type: '2BR', area: 105, bedrooms: 2, bathrooms: 2, floor: 1, price: 1180000 },
                      { code: 'B-102', type: '3BR', area: 160, bedrooms: 3, bathrooms: 3, floor: 1, price: 1750000 },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    include: {
      phases: {
        include: { buildings: { include: { units: true } } },
      },
    },
  });

  // Second project (draft)
  await prisma.project.create({
    data: {
      name: { ar: 'فيلات الجولف', en: 'Golf Villas' },
      description: { ar: 'فيلات راقية بإطلالة على الجولف.', en: 'Premium villas overlooking the golf course.' },
      city: 'Jeddah',
      lat: 21.4858,
      lng: 39.1925,
      status: ProjectStatus.DRAFT,
      featured: false,
      services: [{ ar: 'ملعب جولف', en: 'Golf Course' }],
    },
  });

  // ---- Maintenance categories ----
  await Promise.all(
    [
      { ar: 'سباكة', en: 'Plumbing' },
      { ar: 'كهرباء', en: 'Electrical' },
      { ar: 'تكييف', en: 'HVAC' },
      { ar: 'أعمال عامة', en: 'General' },
    ].map((name) => prisma.maintenanceCategory.create({ data: { name } })),
  );

  // ---- Notification templates ----
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

  // ---- Lead + assignment ----
  // Every lead must be linked to a Client (User). Find-or-create by phone so
  // re-running the seed doesn't produce duplicates.
  const fbSource = await prisma.leadSource.findFirst();
  if (fbSource) {
    const phone = '+966500000001';
    const email = 'ahmed@example.com';
    const fullName = 'Ahmed Khaled';
    const client =
      (await prisma.user.findUnique({ where: { phone } })) ??
      (await prisma.user.create({
        data: { role: 'CLIENT', fullName, phone, email, locale: 'ar' },
      }));
    await prisma.lead.create({
      data: {
        clientId: client.id,
        fullName: client.fullName,
        phone: client.phone ?? phone,
        email: client.email ?? email,
        sourceId: fbSource.id,
        projectInterestId: project.id,
        assignedSalesId: sales.id,
      },
    });
  }

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
