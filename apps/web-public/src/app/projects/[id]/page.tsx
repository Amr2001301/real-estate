import type { Route } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MapPin, ArrowLeft, Home, Star } from 'lucide-react';
import { cn } from '@/lib/cn';
import { buildMetadata } from '@/lib/seo';
import { safeFetch } from '@/lib/api';
import { pickAr, formatNumber } from '@/lib/format';
import { routes } from '@/lib/routes';
import type { PublicProjectDetail, Paginated, PublicUnit } from '@/lib/api-types';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { ButtonLink } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ErrorState } from '@/components/states/ErrorState';
import { InlineNotice } from '@/components/states/InlineNotice';
import { IconCircle } from '@/components/ui/IconCircle';
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

const PROJECT_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'متاح',
  PUBLISHED: 'متاح',
  SOLD_OUT: 'مكتمل البيع',
  UNDER_CONSTRUCTION: 'قيد الإنشاء',
  UPCOMING: 'قريبًا',
  COMPLETED: 'مكتمل',
};

function projectStatusLabel(status: string): string {
  return PROJECT_STATUS_LABELS[status] ?? status;
}

/**
 * Premium section heading system for the project detail page.
 * Uses a small gold accent bar + tiny label + strong title.
 * Keeps a clear visual hierarchy — the label reads as a category tag,
 * never as a second heading.
 */
function SectionHead({
  label,
  title,
  description,
}: {
  label: string;
  title: string;
  description?: string;
}) {
  return (
    <div>
      <div className="mb-3 h-0.5 w-10 rounded-full bg-gold-400" />
      <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-gold-500">
        {label}
      </span>
      <h2 className="mt-1.5 text-[1.65rem] font-bold leading-tight text-ink-strong sm:text-3xl">
        {title}
      </h2>
      {description && (
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">{description}</p>
      )}
    </div>
  );
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

      {/* ── Cinematic gallery hero ── */}
      <section className="bg-canvas pt-24 sm:pt-28">
        <Container>
          {/* Breadcrumb */}
          <nav aria-label="مسار التنقل" className="mb-5">
            <ol className="flex items-center gap-1.5 text-sm">
              <li>
                <Link
                  href={routes.projects}
                  className="text-ink-muted transition-colors hover:text-ink-strong focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/50 focus-visible:ring-offset-2"
                >
                  المشاريع
                </Link>
              </li>
              <li className="select-none text-ink-muted/40" aria-hidden>/</li>
              <li
                className="max-w-[10rem] truncate font-medium text-ink-strong sm:max-w-xs"
                aria-current="page"
              >
                {name}
              </li>
            </ol>
          </nav>

          {/* Gallery — metadata lives solely inside the overlay, not repeated below. */}
          <ProjectGallery
            media={project.media}
            alt={name}
            overlay={
              <Reveal>
                {/* Featured badge — shown alone so it doesn't compete with the title */}
                {project.featured && (
                  <div className="mb-3">
                    <Badge
                      tone="gold"
                      className="shadow-[0_2px_10px_rgba(200,162,75,0.40)]"
                    >
                      <Star className="h-3 w-3" aria-hidden />
                      مشروع مميز
                    </Badge>
                  </div>
                )}

                {/* Project name — the dominant visual element */}
                <h1
                  className="text-display-1 text-white"
                  style={{ textShadow: '0 2px 24px rgba(11,23,38,0.55)' }}
                >
                  {name}
                </h1>

                {/* Metadata chips — placed BELOW the title so they give context
                    after the main identity, never competing with it. */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {project.city && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-black/30 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur-md ring-1 ring-white/10">
                      <MapPin className="h-3 w-3 text-gold-300" aria-hidden />
                      {project.city}
                    </span>
                  )}
                  {project.status && PROJECT_STATUS_LABELS[project.status] && (
                    <span className="inline-flex items-center rounded-full bg-black/30 px-3 py-1 text-xs font-medium text-white/80 backdrop-blur-md ring-1 ring-white/10">
                      {PROJECT_STATUS_LABELS[project.status]}
                    </span>
                  )}
                </div>

                {/* CTAs */}
                <div className="mt-5 flex flex-wrap gap-3">
                  <ButtonLink
                    href={`${routes.contact}?projectId=${project.id}` as Route}
                    variant="gold"
                    size="md"
                  >
                    طلب معلومات
                  </ButtonLink>
                  <ButtonLink
                    href={`${routes.contact}?type=visit&projectId=${project.id}` as Route}
                    variant="outline"
                    size="md"
                    className="border-white/25 text-white backdrop-blur-sm hover:border-white/50 hover:bg-white/10"
                  >
                    طلب زيارة
                  </ButtonLink>
                </div>
              </Reveal>
            }
          />
          {/* No chips strip — all meta is in the hero overlay above. */}
        </Container>
      </section>

      {/* ── Body: main content + sticky sidebar ── */}
      <Section tone="canvas" className="pt-10 sm:pt-12 lg:pt-14">
        <div className="grid gap-8 lg:grid-cols-3 lg:gap-10">

          {/* ── Main content column ── */}
          <div className="space-y-14 lg:col-span-2">

            {/* About */}
            <div>
              <SectionHead label="نظرة عامة" title="عن المشروع" />
              {description ? (
                <p className="mt-6 text-lg leading-loose text-ink-muted">{description}</p>
              ) : (
                <p className="mt-6 text-ink-muted">سيتم إضافة وصف تفصيلي لهذا المشروع قريبًا.</p>
              )}
            </div>

            {/* Features / Amenities */}
            <ProjectAmenities services={project.services} />

            {/* Available units — inside the main column so the sidebar stays
                sticky and visible while the buyer browses units. */}
            <div>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <SectionHead label="وحدات المشروع" title="الوحدات المتاحة" />

                {/* Premium text-link style — not a plain outline button */}
                <Link
                  href={`${routes.units}?projectId=${project.id}` as Route}
                  className="group mb-0.5 flex shrink-0 items-center gap-2 text-sm font-medium text-gold-600 transition-colors hover:text-gold-700"
                >
                  عرض كل الوحدات
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border border-gold-200 bg-gold-50 transition-colors group-hover:border-gold-300 group-hover:bg-gold-100">
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </span>
                </Link>
              </div>

              {!unitsResult.ok ? (
                <div className="mt-8">
                  <InlineNotice tone="warning">
                    تعذر تحميل وحدات المشروع حاليًا، يمكنك استعراضها من صفحة الوحدات.
                  </InlineNotice>
                </div>
              ) : previewUnits.length === 0 ? (
                <div className="mt-8 flex flex-col items-center gap-5 rounded-3xl border border-hairline bg-surface p-6 text-center shadow-soft sm:flex-row sm:justify-between sm:text-start">
                  <div className="flex items-center gap-4">
                    <IconCircle tone="gold" className="h-12 w-12 shrink-0">
                      <Home className="h-6 w-6" aria-hidden />
                    </IconCircle>
                    <div>
                      <h3 className="text-base font-semibold text-ink-strong">لا توجد وحدات متاحة لهذا المشروع حاليًا</h3>
                      <p className="mt-1 text-sm text-ink-muted">تواصل مع مستشار لمعرفة أحدث الإتاحات.</p>
                    </div>
                  </div>
                  <ButtonLink
                    href={`${routes.contact}?projectId=${project.id}` as Route}
                    variant="primary"
                    size="md"
                    className="w-full shrink-0 sm:w-auto"
                  >
                    تواصل مع مستشار
                  </ButtonLink>
                </div>
              ) : (
                <Stagger
                  className={cn(
                    'mt-8 grid gap-7',
                    previewUnits.length === 1
                      ? 'grid-cols-1'
                      : 'grid-cols-1 sm:grid-cols-2',
                  )}
                  childClassName="h-full"
                  step={80}
                >
                  {previewUnits.map((unit) => (
                    <UnitCard key={unit.id} unit={unit} />
                  ))}
                </Stagger>
              )}
            </div>

            {/* Location */}
            <ProjectLocation
              city={project.city}
              lat={hasCoords ? project.lat : null}
              lng={hasCoords ? project.lng : null}
            />

            {/* FAQ */}
            <div>
              <SectionHead label="الأسئلة الشائعة" title="إجابات سريعة قد تهمّك" />
              <div className="mt-8">
                <Accordion items={projectFaq(name)} defaultOpenFirst />
              </div>
            </div>
          </div>

          {/* ── Sticky aside: inquiry + facts ── */}
          <aside className="lg:col-span-1">
            <div className="space-y-4 lg:sticky lg:top-28">
              <InquiryCard projectId={project.id} projectName={name} />
              <ProjectFacts
                city={project.city}
                availableUnitsCount={project.availableUnitsCount}
                featured={project.featured}
                hasCoords={hasCoords}
              />
            </div>
          </aside>
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

      {/* Spacer so the mobile sticky inquiry bar doesn't cover the CTA band */}
      <div className="h-[72px] lg:hidden" aria-hidden />
    </>
  );
}
