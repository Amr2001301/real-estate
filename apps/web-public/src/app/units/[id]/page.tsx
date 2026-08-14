import type { Route } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MapPin, ArrowLeft, Building2, LayoutPanelTop } from 'lucide-react';
import { buildMetadata } from '@/lib/seo';
import { safeFetch } from '@/lib/api';
import { pickAr, formatPrice, formatArea, unitTypeLabel } from '@/lib/format';
import { routes } from '@/lib/routes';
import type { PublicUnit, Paginated } from '@/lib/api-types';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { ButtonLink } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PremiumCard } from '@/components/ui/PremiumCard';
import { ErrorState } from '@/components/states/ErrorState';
import { Reveal } from '@/components/motion/Reveal';
import { Stagger } from '@/components/motion/Stagger';
import { ProjectGallery } from '@/components/projects/ProjectGallery';
import { CtaBand } from '@/components/marketing/CtaBand';
import { UnitCard } from '@/components/home/UnitCard';
import { UnitSpecs } from '@/components/units/UnitSpecs';
import { UnitInquiryCard } from '@/components/units/UnitInquiryCard';
import { CompareProvider, type CompareItem } from '@/components/compare/CompareContext';
import { CompareToggle } from '@/components/compare/CompareToggle';
import { CompareBar } from '@/components/compare/CompareBar';
import { JsonLd } from '@/components/seo/JsonLd';
import { breadcrumbLd, unitProductLd } from '@/lib/jsonld';
import { ViewTracker } from '@/components/analytics/ViewTracker';
import { ShareButton } from '@/components/ui/ShareButton';

const REVALIDATE = 60;

type StatusMeta = { label: string; tone: 'success' | 'warning' | 'neutral' };

const STATUS: Record<string, StatusMeta> = {
  AVAILABLE: { label: 'متاحة',  tone: 'success' },
  RESERVED:  { label: 'محجوزة', tone: 'warning' },
  SOLD:      { label: 'مباعة',  tone: 'neutral' },
};

const DEFAULT_STATUS: StatusMeta = { label: 'متاحة', tone: 'success' };

type Params = Promise<{ id: string }>;

function fetchUnit(id: string) {
  return safeFetch<PublicUnit>(`/public/units/${id}`, { revalidate: REVALIDATE });
}

function unitTitle(unit: PublicUnit): string {
  return unit.type ? unitTypeLabel(unit.type) : `وحدة ${unit.code}`;
}

/**
 * Section heading system — matches the project details page exactly.
 * Gold accent bar + tiny uppercase label + strong title.
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

export async function generateMetadata({ params }: { params: Params }) {
  const { id } = await params;
  const result = await fetchUnit(id);
  if (!result.ok) return buildMetadata({ title: 'تفاصيل الوحدة' });

  const unit = result.data;
  const project = unit.project ? pickAr(unit.project.name) : '';
  const title = [unitTitle(unit), project].filter(Boolean).join(' · ');
  const description = `${unitTitle(unit)}${project ? ` ضمن ${project}` : ''} — ${formatArea(unit.area)} · ${formatPrice(unit.price)}.`;
  const image = unit.coverImage ?? unit.media?.[0]?.url;
  return buildMetadata({ title, description, path: `/units/${id}`, ...(image ? { image } : {}) });
}

export default async function UnitDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const result = await fetchUnit(id);

  if (!result.ok) {
    if (result.error.status === 404) notFound();
    return (
      <Section tone="canvas" className="pt-36">
        <ErrorState
          title="تعذر تحميل تفاصيل الوحدة"
          message="حاول مرة أخرى بعد لحظات، أو تصفح بقية الوحدات."
          className="mx-auto max-w-2xl"
        />
        <div className="mt-8 text-center">
          <ButtonLink href={routes.units} variant="outline" size="md">
            العودة إلى الوحدات
          </ButtonLink>
        </div>
      </Section>
    );
  }

  const unit = result.data;
  const title = unitTitle(unit);
  const status = STATUS[unit.status] ?? DEFAULT_STATUS;
  const projectName = unit.project ? pickAr(unit.project.name) : '';
  const compareItem: CompareItem = {
    id: unit.id,
    label: [unit.type, projectName].filter(Boolean).join(' · ') || `وحدة ${unit.code}`,
    price: unit.price,
    coverImage: unit.coverImage,
  };

  const ldName = [title, projectName].filter(Boolean).join(' · ');

  let similarUnits: PublicUnit[] = [];
  if (unit.project) {
    const sim = await safeFetch<Paginated<PublicUnit>>(
      `/public/units?projectId=${unit.project.id}&pageSize=4`,
      { revalidate: REVALIDATE },
    );
    if (sim.ok) similarUnits = sim.data.data.filter((u) => u.id !== unit.id).slice(0, 3);
  }

  return (
    <CompareProvider>
      <ViewTracker event="unit_view" params={{ unit_id: unit.id, unit_status: unit.status }} />
      <JsonLd
        data={breadcrumbLd([
          { name: 'الرئيسية', path: '/' },
          { name: 'الوحدات',  path: '/units' },
          { name: ldName,     path: `/units/${unit.id}` },
        ])}
      />
      <JsonLd
        data={unitProductLd({
          name: ldName,
          price: unit.price,
          status: unit.status,
          image: unit.coverImage ?? unit.media?.[0]?.url ?? null,
          path: `/units/${unit.id}`,
        })}
      />

      {/* ── Cinematic gallery hero ── */}
      <section className="bg-canvas pt-24 sm:pt-28">
        <Container>
          {/* Breadcrumb — matches project details page pattern */}
          <nav aria-label="مسار التنقل" className="mb-5">
            <ol className="flex items-center gap-1.5 text-sm">
              <li>
                <Link
                  href={routes.units}
                  className="text-ink-muted transition-colors hover:text-ink-strong focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/50 focus-visible:ring-offset-2"
                >
                  الوحدات
                </Link>
              </li>
              <li className="select-none text-ink-muted/40" aria-hidden>/</li>
              <li
                className="max-w-[10rem] truncate font-medium text-ink-strong sm:max-w-xs"
                aria-current="page"
              >
                {title}
              </li>
            </ol>
          </nav>

          <ProjectGallery
            media={unit.media}
            alt={title}
            overlay={
              <Reveal>
                {/* Status badge alone at top — same logic as project featured badge */}
                <div className="mb-3">
                  <Badge
                    tone={status.tone}
                    className="shadow-[0_2px_10px_rgba(0,0,0,0.20)]"
                  >
                    {status.label}
                  </Badge>
                </div>

                {/* Unit title — dominant visual element */}
                <h1
                  className="text-display-1 text-white"
                  style={{ textShadow: '0 2px 24px rgba(11,23,38,0.55)' }}
                >
                  {title}
                </h1>

                {/* Price — the key fact, prominent gold right under the title */}
                <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
                  <span className="font-display text-2xl font-bold text-gold-200">
                    {formatPrice(unit.price)}
                  </span>
                  {unit.code && (
                    <span className="rounded-full bg-black/25 px-2.5 py-0.5 text-[11px] font-medium text-white/75 backdrop-blur-md ring-1 ring-white/10">
                      {unit.code}
                    </span>
                  )}
                </div>

                {/* Metadata chips — below price, same frosted-glass style as project page */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {projectName && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-black/30 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur-md ring-1 ring-white/10">
                      <Building2 className="h-3 w-3 text-gold-300" aria-hidden />
                      {projectName}
                    </span>
                  )}
                  {unit.project?.city && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-black/30 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur-md ring-1 ring-white/10">
                      <MapPin className="h-3 w-3 text-gold-300" aria-hidden />
                      {unit.project.city}
                    </span>
                  )}
                </div>

                {/* CTAs */}
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <ButtonLink
                    href={`${routes.contact}?unitId=${unit.id}` as Route}
                    variant="gold"
                    size="md"
                  >
                    طلب معلومات
                  </ButtonLink>
                  <ButtonLink
                    href={`${routes.contact}?type=visit&unitId=${unit.id}` as Route}
                    variant="outline"
                    size="md"
                    className="border-white/25 text-white backdrop-blur-sm hover:border-white/50 hover:bg-white/10"
                  >
                    طلب زيارة
                  </ButtonLink>
                  <CompareToggle item={compareItem} />
                  <ShareButton title={[title, projectName].filter(Boolean).join(' · ')} />
                </div>
              </Reveal>
            }
          />
        </Container>
      </section>

      {/* ── Body: main content + sticky sidebar ── */}
      <Section tone="canvas" className="pt-10 sm:pt-12 lg:pt-14">
        <div className="grid gap-8 lg:grid-cols-3 lg:gap-10">

          {/* ── Main content column ── */}
          <div className="space-y-14 lg:col-span-2">

            {/* Unit specifications */}
            <div>
              <SectionHead label="المواصفات" title="تفاصيل الوحدة" />
              <div className="mt-8">
                <UnitSpecs unit={unit} />
              </div>
            </div>

            {/* About the unit */}
            <div>
              <SectionHead label="نبذة" title="عن الوحدة" />
              <p className="mt-6 text-lg leading-loose text-ink-muted">
                وحدة مختارة بعناية ضمن مشروع مميز، صُممت لتمنحك توازنًا بين الراحة والقيمة والموقع.
              </p>
            </div>

            {/* Project relation — premium card matching the page's design language */}
            {unit.project && (
              <div>
                <SectionHead label="المشروع" title="ضمن مشروع" />
                <div className="mt-8 overflow-hidden rounded-3xl border border-hairline bg-surface shadow-card">
                  {/* Gold accent stripe */}
                  <div
                    className="h-1 w-full"
                    style={{ background: 'linear-gradient(to left, #b8923e, #e6c46a, #b8923e)' }}
                    aria-hidden
                  />
                  <div className="p-6 sm:p-7">
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-4">
                        {/* Gradient icon — same treatment as ProjectFacts / InquiryCard */}
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-gold-50 to-white shadow-[0_2px_10px_-2px_rgba(200,162,75,0.22)] ring-1 ring-gold-200/70">
                          <Building2 className="h-6 w-6 text-gold-600" aria-hidden />
                        </span>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gold-500">
                            مشروع
                          </p>
                          <h3 className="mt-0.5 text-lg font-bold text-ink-strong">
                            {projectName}
                          </h3>
                          {unit.project.city && (
                            <p className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-ink-muted">
                              <MapPin className="h-3.5 w-3.5 text-gold-500" aria-hidden />
                              {unit.project.city}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2.5">
                        <ButtonLink
                          href={routes.project(unit.project.id) as Route}
                          variant="primary"
                          size="sm"
                        >
                          عرض المشروع
                        </ButtonLink>
                        <ButtonLink
                          href={`${routes.units}?projectId=${unit.project.id}` as Route}
                          variant="outline"
                          size="sm"
                        >
                          وحدات المشروع
                        </ButtonLink>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Floor plan */}
            <div>
              <SectionHead label="المخطط" title="مخطط الوحدة" />
              <PremiumCard className="mt-8 overflow-hidden">
                {/* Blueprint-style graphic */}
                <div
                  className="relative flex min-h-56 items-center justify-center border-b border-hairline"
                  style={{
                    backgroundColor: '#0F1E33',
                    backgroundImage:
                      'linear-gradient(rgba(200,162,75,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(200,162,75,0.18) 1px, transparent 1px)',
                    backgroundSize: '28px 28px',
                  }}
                >
                  <div className="relative h-32 w-48 rounded-md border-2 border-gold-300/70">
                    <div className="absolute inset-y-0 left-1/2 w-px bg-gold-300/40" />
                    <div className="absolute inset-x-0 top-1/2 h-px bg-gold-300/40" />
                    <span className="absolute -bottom-3 right-3 inline-flex h-6 w-6 items-center justify-center rounded-full bg-gold-400 text-navy">
                      <LayoutPanelTop className="h-3.5 w-3.5" aria-hidden />
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-4 p-7 text-center sm:flex-row sm:justify-between sm:text-start">
                  <p className="text-ink-muted">
                    المخطط التفصيلي متاح عند الطلب — تواصل معنا للحصول عليه.
                  </p>
                  <ButtonLink
                    href={`${routes.contact}?unitId=${unit.id}` as Route}
                    variant="outline"
                    size="sm"
                  >
                    اطلب المخطط
                  </ButtonLink>
                </div>
              </PremiumCard>
            </div>
          </div>

          {/* ── Sticky aside ── */}
          <aside className="lg:col-span-1">
            <div className="lg:sticky lg:top-28">
              <UnitInquiryCard
                unitId={unit.id}
                price={unit.price}
                unitCode={unit.code}
                projectName={unit.project ? pickAr(unit.project.name) : ''}
              />
            </div>
          </aside>
        </div>
      </Section>

      {/* ── Related units — full-width soft band ── */}
      {unit.project && similarUnits.length > 0 && (
        <Section tone="soft">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHead label="وحدات ذات صلة" title="وحدات أخرى في المشروع" />
            {/* Premium gold text-link — matches project page "عرض كل الوحدات" */}
            <Link
              href={`${routes.units}?projectId=${unit.project.id}` as Route}
              className="group mb-0.5 flex shrink-0 items-center gap-2 text-sm font-medium text-gold-600 transition-colors hover:text-gold-700"
            >
              عرض كل الوحدات
              <span className="flex h-7 w-7 items-center justify-center rounded-full border border-gold-200 bg-gold-50 transition-colors group-hover:border-gold-300 group-hover:bg-gold-100">
                <ArrowLeft className="h-3.5 w-3.5" />
              </span>
            </Link>
          </div>
          <Stagger
            className="mt-8 grid gap-7 sm:grid-cols-2 lg:grid-cols-3"
            childClassName="h-full"
            step={80}
          >
            {similarUnits.map((u) => (
              <UnitCard key={u.id} unit={u} />
            ))}
          </Stagger>
        </Section>
      )}

      <CtaBand eyebrow="خطوتك التالية" title="هل ترغب في معاينة هذه الوحدة؟">
        <ButtonLink
          href={`${routes.contact}?type=visit&unitId=${unit.id}` as Route}
          variant="gold"
          size="lg"
        >
          طلب زيارة
        </ButtonLink>
        <ButtonLink
          href={`${routes.contact}?unitId=${unit.id}` as Route}
          variant="outline"
          size="lg"
          className="border-white/25 text-white hover:border-white/50 hover:bg-white/5"
        >
          تواصل مع مستشار
        </ButtonLink>
      </CtaBand>

      {/* Spacer so the mobile sticky inquiry bar doesn't overlap the CTA band */}
      <div className="h-[72px] lg:hidden" aria-hidden />

      <CompareBar />
    </CompareProvider>
  );
}
