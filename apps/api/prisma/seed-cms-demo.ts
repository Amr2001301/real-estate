/**
 * seed-cms-demo.ts — Development-only CMS demo data
 *
 * Creates realistic CMS content so /dashboard/cms loads with populated
 * pages, banners, and articles for visual testing.
 *
 * SAFETY:
 *   • Aborts immediately if NODE_ENV === "production".
 *   • CmsPage and Article records use stable slugs prefixed "demo-".
 *   • Banner records identified by stable Arabic title string.
 *   • Fully idempotent — safe to run multiple times.
 *
 * USAGE:
 *   cd apps/api
 *   pnpm prisma:seed:cms
 *
 * REMOVE DEMO DATA:
 *   pnpm prisma:seed:cms:cleanup
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ── Safety guard ────────────────────────────────────────────────────────────

if (process.env.NODE_ENV === 'production') {
  console.error('❌ seed-cms-demo must NOT run in production. Aborting.');
  process.exit(1);
}

// ── Stable demo slugs (idempotency keys) ────────────────────────────────────

const PAGE_SLUGS = {
  ABOUT:   'demo-about',
  PRIVACY: 'demo-privacy',
  TERMS:   'demo-terms',
} as const;

const ARTICLE_SLUGS = {
  A1: 'demo-article-buying-guide',
  A2: 'demo-article-market-trends',
  A3: 'demo-article-investment-tips',
} as const;

// Banners have no unique slug — identify by stable Arabic title for cleanup
const BANNER_TITLES = [
  'عرض الإطلاق — ريزيدنس الواجهة',
  'خدمات التمويل العقاري',
  'مشاريع قادمة — كن أول من يعلم',
] as const;

// ── Cleanup mode ─────────────────────────────────────────────────────────────

async function cleanup(): Promise<void> {
  console.log('🗑️  Removing demo CMS data…');

  const deletedPages = await prisma.cmsPage.deleteMany({
    where: { slug: { in: Object.values(PAGE_SLUGS) } },
  });

  const deletedArticles = await prisma.article.deleteMany({
    where: { slug: { in: Object.values(ARTICLE_SLUGS) } },
  });

  // Banners: delete by matching Arabic title path
  let deletedBannersCount = 0;
  for (const title of BANNER_TITLES) {
    const banner = await prisma.banner.findFirst({
      where: { title: { path: ['ar'], equals: title } },
      select: { id: true },
    });
    if (banner) {
      await prisma.banner.delete({ where: { id: banner.id } });
      deletedBannersCount++;
    }
  }

  console.log(`   Removed ${deletedPages.count} pages · ${deletedBannersCount} banners · ${deletedArticles.count} articles`);
  console.log('✅  Done.');
}

// ── Main seed ─────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const isCleanup = process.argv.includes('--cleanup');
  if (isCleanup) {
    await cleanup();
    return;
  }

  console.log('🌱  Seeding CMS demo data…');

  // ── CMS Pages ──────────────────────────────────────────────────────────────

  await prisma.cmsPage.upsert({
    where: { slug: PAGE_SLUGS.ABOUT },
    create: {
      slug: PAGE_SLUGS.ABOUT,
      title: { ar: 'من نحن', en: 'About Us' },
      body: {
        ar: 'شركة ديفورا للتطوير العقاري — نحن نبني مستقبلاً أفضل للمجتمعات السعودية من خلال تطوير مشاريع سكنية وتجارية متكاملة تلتزم بأعلى معايير الجودة والاستدامة.\n\nتأسست الشركة عام 2015 وأسهمت في تسليم أكثر من 2000 وحدة سكنية في مناطق الرياض وجدة والدمام.',
        en: 'Devora Real Estate Development — we build a better future for Saudi communities through integrated residential and commercial projects that uphold the highest standards of quality and sustainability.\n\nFounded in 2015, we have delivered over 2,000 residential units across Riyadh, Jeddah, and Dammam.',
      },
      published: true,
    },
    update: {},
  });

  await prisma.cmsPage.upsert({
    where: { slug: PAGE_SLUGS.PRIVACY },
    create: {
      slug: PAGE_SLUGS.PRIVACY,
      title: { ar: 'سياسة الخصوصية', en: 'Privacy Policy' },
      body: {
        ar: 'نحن في ديفورا نلتزم بحماية بياناتك الشخصية وفق نظام حماية البيانات الشخصية السعودي (PDPL). تُجمع البيانات لأغراض تقديم الخدمات العقارية فقط ولا تُشارك مع أطراف ثالثة دون موافقتك الصريحة.\n\nيحق لك في أي وقت طلب الاطلاع على بياناتك أو تصحيحها أو حذفها عبر التواصل مع فريق دعم العملاء.',
        en: 'At Devora, we are committed to protecting your personal data in accordance with the Saudi Personal Data Protection Law (PDPL). Data is collected solely for providing real estate services and is not shared with third parties without your explicit consent.\n\nYou may at any time request to view, correct, or delete your data by contacting our customer support team.',
      },
      published: true,
    },
    update: {},
  });

  await prisma.cmsPage.upsert({
    where: { slug: PAGE_SLUGS.TERMS },
    create: {
      slug: PAGE_SLUGS.TERMS,
      title: { ar: 'الشروط والأحكام', en: 'Terms & Conditions' },
      body: {
        ar: 'مسودة قيد المراجعة القانونية. سيتم نشر هذه الصفحة بعد اعتماد النص النهائي من الإدارة القانونية.',
        en: 'Draft under legal review. This page will be published once the final text is approved by the legal department.',
      },
      published: false,
    },
    update: {},
  });

  console.log('   ✓  3 CMS pages (2 published, 1 draft)');

  // ── Banners ────────────────────────────────────────────────────────────────

  const bannerSpecs = [
    {
      title: BANNER_TITLES[0],
      data: {
        title: { ar: 'عرض الإطلاق — ريزيدنس الواجهة', en: 'Launch Offer — Al-Wajha Residence' },
        imageUrl: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200&q=80',
        link: '/projects/al-wajha-residence',
        active: true,
        order: 1,
      },
    },
    {
      title: BANNER_TITLES[1],
      data: {
        title: { ar: 'خدمات التمويل العقاري', en: 'Real Estate Financing Services' },
        imageUrl: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1200&q=80',
        link: '/financing',
        active: true,
        order: 2,
      },
    },
    {
      title: BANNER_TITLES[2],
      data: {
        title: { ar: 'مشاريع قادمة — كن أول من يعلم', en: 'Upcoming Projects — Be the First to Know' },
        imageUrl: 'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=1200&q=80',
        link: '/register-interest',
        active: false,
        order: 3,
      },
    },
  ];

  for (const spec of bannerSpecs) {
    const existing = await prisma.banner.findFirst({
      where: { title: { path: ['ar'], equals: spec.title } },
      select: { id: true },
    });
    if (!existing) {
      await prisma.banner.create({ data: spec.data });
    }
  }

  console.log('   ✓  3 banners (2 active, 1 inactive)');

  // ── Articles ───────────────────────────────────────────────────────────────

  await prisma.article.upsert({
    where: { slug: ARTICLE_SLUGS.A1 },
    create: {
      slug: ARTICLE_SLUGS.A1,
      title:   { ar: 'دليل المشتري: كيف تختار وحدتك السكنية المثالية', en: 'Buyer\'s Guide: How to Choose Your Ideal Residential Unit' },
      excerpt: { ar: 'نرشدك خطوة بخطوة عبر عملية اختيار الوحدة السكنية المناسبة لاحتياجاتك وميزانيتك.', en: 'We guide you step by step through the process of choosing the right residential unit for your needs and budget.' },
      body: {
        ar: 'يُعدّ شراء وحدة سكنية من أهم القرارات المالية في حياة الفرد. لذلك أعددنا هذا الدليل الشامل ليساعدك على فهم العوامل الأساسية التي ينبغي مراعاتها عند الاختيار…\n\n**الموقع أولاً**: تأكد من قرب المشروع من الخدمات الأساسية كالمدارس والمستشفيات والمراكز التجارية.\n\n**جودة التشطيب**: اطلب الاطلاع على عينات المواد وتفاصيل المواصفات الفنية قبل التوقيع.\n\n**خطة الدفع**: قارن بين خطط التمويل المتاحة وتأكد من توافقها مع دخلك الشهري.',
        en: 'Purchasing a residential unit is one of the most important financial decisions in a person\'s life. That\'s why we\'ve prepared this comprehensive guide to help you understand the key factors to consider when choosing…\n\n**Location First**: Ensure the project is close to essential services such as schools, hospitals, and commercial centers.\n\n**Finish Quality**: Request to review material samples and technical specification details before signing.\n\n**Payment Plan**: Compare available financing plans and ensure they align with your monthly income.',
      },
      coverUrl: 'https://images.unsplash.com/photo-1582407947304-fd86f028f716?w=800&q=80',
      published: true,
    },
    update: {},
  });

  await prisma.article.upsert({
    where: { slug: ARTICLE_SLUGS.A2 },
    create: {
      slug: ARTICLE_SLUGS.A2,
      title:   { ar: 'اتجاهات السوق العقاري السعودي في 2025', en: 'Saudi Real Estate Market Trends in 2025' },
      excerpt: { ar: 'نستعرض أبرز التحولات في سوق العقارات السعودي وفرص الاستثمار الواعدة خلال العام الجاري.', en: 'We review the most significant shifts in the Saudi real estate market and promising investment opportunities this year.' },
      body: {
        ar: 'يشهد السوق العقاري السعودي نمواً ملحوظاً مدفوعاً بمستهدفات رؤية 2030 وتنامي الطلب على الإسكان في المدن الكبرى.\n\nأبرز التوجهات لعام 2025:\n- ارتفاع الطلب على الوحدات السكنية الصغيرة (الاستوديو و1 غرفة) في المدن الكبرى\n- توسع مشاريع التطوير المتكامل خارج نطاق الرياض وجدة\n- تنامي الاستثمار الأجنبي في القطاع العقاري',
        en: 'The Saudi real estate market is seeing remarkable growth driven by Vision 2030 targets and rising housing demand in major cities.\n\nKey trends for 2025:\n- Rising demand for small residential units (studio and 1-bedroom) in major cities\n- Expansion of integrated development projects beyond Riyadh and Jeddah\n- Growing foreign investment in the real estate sector',
      },
      coverUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&q=80',
      published: true,
    },
    update: {},
  });

  await prisma.article.upsert({
    where: { slug: ARTICLE_SLUGS.A3 },
    create: {
      slug: ARTICLE_SLUGS.A3,
      title:   { ar: 'نصائح الاستثمار العقاري للمبتدئين', en: 'Real Estate Investment Tips for Beginners' },
      excerpt: { ar: 'مسودة — قيد الإعداد', en: 'Draft — work in progress' },
      body: {
        ar: 'مسودة أولية — سيتم استكمال المحتوى وإرساله للمراجعة قريباً.',
        en: 'Initial draft — content will be completed and submitted for review soon.',
      },
      coverUrl: null,
      published: false,
    },
    update: {},
  });

  console.log('   ✓  3 articles (2 published, 1 draft)');

  console.log('');
  console.log('✅  CMS demo data seeded successfully!');
  console.log('');
  console.log('   Pages:    demo-about (published) · demo-privacy (published) · demo-terms (draft)');
  console.log('   Banners:  launch offer (active) · financing (active) · upcoming (inactive)');
  console.log('   Articles: buying guide (published) · market trends (published) · invest tips (draft)');
  console.log('');
  console.log('   Run again safely — fully idempotent.');
  console.log('   Remove with: pnpm prisma:seed:cms:cleanup');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
