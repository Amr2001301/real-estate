import type { Route } from 'next';
import { notFound } from 'next/navigation';
import { MapPin, ArrowLeft, Home, Sparkles } from 'lucide-react';
import { buildMetadata } from '@/lib/seo';
import { safeFetch } from '@/lib/api';
import { pickAr } from '@/lib/format';
import { routes } from '@/lib/routes';
import type { PublicProjectDetail, Paginated, PublicUnit } from '@/lib/api-types';
import { Container } from '@/components/ui/Container';
import { Section, SectionHeading } from '@/components/ui/Section';
import { ButtonLink } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { IconCircle } from '@/components/ui/IconCircle';
import { ErrorState } from '@/components/states/ErrorState';
import { EmptyState } from '@/components/states/EmptyState';
import { InlineNotice } from '@/components/states/InlineNotice';
import { Reveal } from '@/components/motion/Reveal';
import { Stagger } from '@/components/motion/Stagger';
import { ProjectGallery } from '@/components/projects/ProjectGallery';
import { InquiryCard } from '@/components/projects/InquiryCard';
import { ProjectFacts } from '@/components/projects/ProjectFacts';
import { ProjectAmenities } from '@/components/projects/ProjectAmenities';
import { ProjectLocation } from '@/components/projects/ProjectLocation';
import { UnitCard } from '@/components/home/UnitCard';
import { JsonLd } from '@/components/seo/JsonLd';
import { breadcrumbLd, projectResidenceLd } from '@/lib/jsonld';
import { Accordion, type AccordionItem } from '@/components/ui/Accordion';
import { CtaBand } from '@/components/marketing/CtaBand';

const REVALIDATE = 60;

type Params = Promise<{ id: string }>;

// Factual "why" highlights derived from public data — no invented claims.
function projectWhy(city: string, availableUnits: number, serviceCount: number) {
  return [
    { icon: MapPin, title: 'موقع متميّز', body: city ? `يقع المشروع في ${city} بموقع يسهل الوصول إليه.` : 'موقع مدروس يجمع بين الخصوصية وسهولة الوصول.' },
    { icon: Home, title: 'وحدات متاحة', body: `${availableUnits} وحدة متاحة بخيارات متنوعة تناسب احتياجك.` },
    { icon: Sparkles, title: 'مرافق وخدمات', body: serviceCount > 0 ? `${serviceCount} من المرافق والخدمات لراحة السكان.` : 'مرافق وخدمات مصممة لأسلوب حياة أرقى.' },
  ];
}

// Generic, process-oriented FAQ — deliberately avoids project-specific claims
// (prices, guarantees, dates) so nothing is fabricated.
function projectFaq(name: string): AccordionItem[] {
  return [
    {
      question: `كيف أحجز زيارة لمشروع ${name}؟`,
      answer: 'يمكنك طلب زيارة عبر زر «طلب زيارة» في الصفحة، وسيتواصل معك أحد مستشارينا لتأكيد الموعد المناسب لك.',
    },
    {
      question: 'كيف أحصل على تفاصيل الأسعار والوحدات المتاحة؟',
      answer: 'استعرض الوحدات المتاحة ضمن المشروع من القسم المخصص، أو تواصل مع مستشارنا للحصول على أحدث التفاصيل والعروض.',
    },
    {
      question: 'هل يمكنني مقارنة أكثر من وحدة؟',
      answer: 'نعم، يمكنك إضافة حتى ٣ وحدات إلى المقارنة لاستعراض المواصفات والأسعار جنبًا إلى جنب قبل اتخاذ قرارك.',
    },
    {
      question: 'كيف أتواصل مع فريق المبيعات؟',
      answer: 'من صفحة «تواصل معنا» أو عبر بطاقة التواصل في هذه الصفحة، وسنعاود التواصل معك في أقرب وقت.',
    },
  ];
}

function fetchProject(id: string) {
  return safeFetch<PublicProjectDetail>(`/public/projects/${id}`, { revalidate: REVALIDATE });
}

function fetchProjectUnits(id: string) {
  return safeFetch<Paginated<PublicUnit>>(`/public/units?projectId=${id}&pageSize=3`, {
    revalidate: REVALIDATE,
  });
}

export async function generateMetadata({ params }: { params: Params }) {
  const { id } = await params;
  const result = await fetchProject(id);
  if (!result.ok) {
    return buildMetadata({ title: 'تفاصيل المشروع' });
  }
  const name = pickAr(result.data.name, 'مشروع');
  const description = pickAr(result.data.description) || undefined;
  const image = result.data.media?.[0]?.url;
  return buildMetadata({
    title: name,
    description,
    path: `/projects/${id}`,
    ...(image ? { image } : {}),
  });
}

export default async function ProjectDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const result = await fetchProject(id);

  // 404 → dedicated not-found page; other failures → friendly inline error.
  if (!result.ok) {
    if (result.error.status === 404) notFound();
    return (
      <Section tone="canvas" className="pt-36">
        <ErrorState
          title="تعذر تحميل تفاصيل المشروع"
          message="حاول مرة أخرى بعد لحظات، أو تصفح بقية المشاريع."
          className="mx-auto max-w-2xl"
        />
        <div className="mt-8 text-center">
          <ButtonLink href={routes.projects} variant="outline" size="md">
            العودة إلى المشاريع
          </ButtonLink>
        </div>
      </Section>
    );
  }

  const project = result.data;
  const name = pickAr(project.name, 'مشروع');
  const description = pickAr(project.description);
  const hasCoords = project.lat !== 0 || project.lng !== 0;

  const serviceCount = Array.isArray(project.services) ? project.services.length : 0;

  // Best-effort: a few units from this project. Never blocks the page.
  const unitsResult = await fetchProjectUnits(project.id);
  const previewUnits = unitsResult.ok ? unitsResult.data.data : [];

  return (
    <>
      <JsonLd
        data={breadcrumbLd([
          { name: 'الرئيسية', path: '/' },
          { name: 'المشاريع', path: '/projects' },
          { name, path: `/projects/${project.id}` },
        ])}
      />
      <JsonLd
        data={projectResidenceLd({
          name,
          description: description || undefined,
          city: project.city,
          lat: project.lat,
          lng: project.lng,
          image: project.media?.[0]?.url ?? null,
          path: `/projects/${project.id}`,
        })}
      />
      {/* Cinematic gallery hero */}
      <section className="bg-canvas pt-24 sm:pt-28">
        <Container>
          <ProjectGallery
            media={project.media}
            alt={name}
            overlay={
              <Reveal>
                <div className="flex flex-wrap items-center gap-3">
                  {project.featured && <Badge tone="gold">مشروع مميز</Badge>}
                  <span className="inline-flex items-center gap-1.5 text-sm text-white/85">
                    <MapPin className="h-4 w-4 text-gold-200" aria-hidden />
                    {project.city}
                  </span>
                </div>
                <h1 className="mt-3 text-display-1 text-white">{name}</h1>
                <div className="mt-5 flex flex-wrap gap-3">
                  <ButtonLink href={`${routes.contact}?projectId=${project.id}` as Route} variant="gold" size="md">
                    طلب معلومات
                  </ButtonLink>
                  <ButtonLink
                    href={`${routes.contact}?type=visit&projectId=${project.id}` as Route}
                    variant="outline"
                    size="md"
                    className="border-white/30 text-white hover:border-white/60 hover:bg-white/5"
                  >
                    طلب زيارة
                  </ButtonLink>
                </div>
              </Reveal>
            }
          />
        </Container>
      </section>

      {/* Highlights strip — quick facts directly under the gallery */}
      <Section tone="canvas" className="pb-0 pt-10 sm:pt-12">
        <ProjectFacts
          city={project.city}
          availableUnitsCount={project.availableUnitsCount}
          featured={project.featured}
          hasCoords={hasCoords}
        />
      </Section>

      {/* Body: content + sticky inquiry aside */}
      <Section tone="canvas" className="pt-10 sm:pt-12">
        <div className="grid gap-10 lg:grid-cols-3">
          <div className="space-y-12 lg:col-span-2">
            {/* Overview */}
            <div>
              <SectionHeading eyebrow="نظرة عامة" title="عن المشروع" />
              {description ? (
                <p className="mt-5 text-lg leading-loose text-ink-muted">{description}</p>
              ) : (
                <p className="mt-5 text-ink-muted">سيتم إضافة وصف تفصيلي لهذا المشروع قريبًا.</p>
              )}
            </div>

            {/* Why this project — factual value props derived from public data */}
            <div>
              <SectionHeading eyebrow="لماذا هذا المشروع؟" title="ما الذي يميّزه" />
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                {projectWhy(project.city, project.availableUnitsCount, serviceCount).map((w) => (
                  <div key={w.title} className="rounded-3xl border border-hairline bg-surface p-6 shadow-soft">
                    <IconCircle tone="gold" className="h-11 w-11">
                      <w.icon className="h-5 w-5" aria-hidden />
                    </IconCircle>
                    <h3 className="mt-4 text-base text-navy">{w.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-ink-muted">{w.body}</p>
                  </div>
                ))}
              </div>
            </div>

            <ProjectAmenities services={project.services} />

            <ProjectLocation city={project.city} lat={hasCoords ? project.lat : null} lng={hasCoords ? project.lng : null} />

            {/* Available units preview from this project (best-effort) */}
            <div>
              <SectionHeading
                eyebrow="الوحدات"
                title="وحدات متاحة داخل المشروع"
                description="استعرض نماذج مختارة من الوحدات المتاحة وقارن بينها."
              />

              {!unitsResult.ok ? (
                <div className="mt-8">
                  <InlineNotice tone="warning">
                    تعذر تحميل وحدات المشروع حاليًا، يمكنك استعراضها من صفحة الوحدات.
                  </InlineNotice>
                </div>
              ) : previewUnits.length === 0 ? (
                <div className="mt-8">
                  <EmptyState
                    title="لا توجد وحدات متاحة لهذا المشروع حاليًا"
                    message="تواصل مع مستشار لمعرفة أحدث الإتاحات."
                    icon={<Home className="h-6 w-6" aria-hidden />}
                    className="mx-auto max-w-2xl"
                  />
                </div>
              ) : (
                <Stagger className="mt-8 grid gap-7 sm:grid-cols-2 xl:grid-cols-3" childClassName="h-full" step={80}>
                  {previewUnits.map((unit) => (
                    <UnitCard key={unit.id} unit={unit} />
                  ))}
                </Stagger>
              )}

              <div className="mt-8">
                <ButtonLink href={`${routes.units}?projectId=${project.id}` as Route} variant="outline" size="md">
                  عرض كل الوحدات في المشروع
                  <ArrowLeft className="h-4 w-4" aria-hidden />
                </ButtonLink>
              </div>
            </div>
          </div>

          {/* Inquiry aside */}
          <aside className="lg:col-span-1">
            <div className="lg:sticky lg:top-28">
              <InquiryCard projectId={project.id} projectName={name} />
            </div>
          </aside>
        </div>
      </Section>

      {/* FAQ — generic, process-oriented (no project-specific claims) */}
      <Section tone="soft" className="pt-0">
        <div className="mx-auto max-w-3xl">
          <SectionHeading
            align="center"
            eyebrow="الأسئلة الشائعة"
            title="إجابات سريعة قد تهمّك"
            className="mx-auto"
          />
          <div className="mt-8">
            <Accordion items={projectFaq(name)} defaultOpenFirst />
          </div>
        </div>
      </Section>

      <CtaBand eyebrow="خطوتك التالية" title="هل ترغب في معرفة المزيد عن هذا المشروع؟">
        <ButtonLink href={`${routes.contact}?projectId=${project.id}` as Route} variant="gold" size="lg">
          تواصل مع مستشار
        </ButtonLink>
        <ButtonLink
          href={`${routes.units}?projectId=${project.id}` as Route}
          variant="outline"
          size="lg"
          className="border-white/25 text-white hover:border-white/50 hover:bg-white/5"
        >
          استكشف الوحدات
        </ButtonLink>
      </CtaBand>
    </>
  );
}
