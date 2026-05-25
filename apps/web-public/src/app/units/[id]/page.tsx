import type { Route } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MapPin, ArrowLeft, ArrowRight, Building2, LayoutPanelTop } from 'lucide-react';
import { buildMetadata } from '@/lib/seo';
import { safeFetch } from '@/lib/api';
import { pickAr, formatPrice, formatArea, unitTypeLabel } from '@/lib/format';
import { routes } from '@/lib/routes';
import type { PublicUnit, Paginated } from '@/lib/api-types';
import { Container } from '@/components/ui/Container';
import { Section, SectionHeading } from '@/components/ui/Section';
import { ButtonLink } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PremiumCard } from '@/components/ui/PremiumCard';
import { IconCircle } from '@/components/ui/IconCircle';
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

const REVALIDATE = 60;

type StatusMeta = { label: string; tone: 'success' | 'warning' | 'neutral' };

const STATUS: Record<string, StatusMeta> = {
  AVAILABLE: { label: 'متاحة', tone: 'success' },
  RESERVED: { label: 'محجوزة', tone: 'warning' },
  SOLD: { label: 'مباعة', tone: 'neutral' },
};

const DEFAULT_STATUS: StatusMeta = { label: 'متاحة', tone: 'success' };

type Params = Promise<{ id: string }>;

function fetchUnit(id: string) {
  return safeFetch<PublicUnit>(`/public/units/${id}`, { revalidate: REVALIDATE });
}

function unitTitle(unit: PublicUnit): string {
  return unit.type ? unitTypeLabel(unit.type) : `وحدة ${unit.code}`;
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

  // Best-effort: similar units from the same project (excluding this one).
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
      <JsonLd
        data={breadcrumbLd([
          { name: 'الرئيسية', path: '/' },
          { name: 'الوحدات', path: '/units' },
          { name: ldName, path: `/units/${unit.id}` },
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
      {/* Cinematic gallery hero */}
      <section className="bg-canvas pt-24 sm:pt-28">
        <Container>
          <Link
            href={routes.units}
            className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink-strong"
          >
            <ArrowRight className="h-4 w-4" aria-hidden />
            العودة إلى الوحدات
          </Link>
          <ProjectGallery
            media={unit.media}
            alt={title}
            overlay={
              <Reveal>
                <div className="flex flex-wrap items-center gap-3">
                  <Badge tone={status.tone}>{status.label}</Badge>
                  {projectName && (
                    <span className="inline-flex items-center gap-1.5 text-sm text-white/85">
                      <MapPin className="h-4 w-4 text-gold-200" aria-hidden />
                      {projectName}
                      {unit.project?.city ? ` · ${unit.project.city}` : ''}
                    </span>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <h1 className="text-display-1 text-white">{title}</h1>
                    <p className="mt-1 text-sm text-white/70">رمز الوحدة: {unit.code}</p>
                  </div>
                  <div className="text-end">
                    <div className="text-sm text-white/70">السعر</div>
                    <div className="font-display text-3xl text-gold-200">{formatPrice(unit.price)}</div>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <ButtonLink href={`${routes.contact}?unitId=${unit.id}` as Route} variant="gold" size="md">
                    طلب معلومات
                  </ButtonLink>
                  <ButtonLink
                    href={`${routes.contact}?type=visit&unitId=${unit.id}` as Route}
                    variant="outline"
                    size="md"
                    className="border-white/30 text-white hover:border-white/60 hover:bg-white/5"
                  >
                    طلب زيارة
                  </ButtonLink>
                  <CompareToggle item={compareItem} />
                </div>
              </Reveal>
            }
          />
        </Container>
      </section>

      {/* Body */}
      <Section tone="canvas" className="pt-10 sm:pt-12">
        <div className="grid gap-10 lg:grid-cols-3">
          <div className="space-y-12 lg:col-span-2">
            {/* Specs */}
            <div>
              <SectionHeading eyebrow="المواصفات" title="تفاصيل الوحدة" />
              <div className="mt-6">
                <UnitSpecs unit={unit} />
              </div>
            </div>

            {/* About */}
            <div>
              <SectionHeading eyebrow="نبذة" title="عن الوحدة" />
              <p className="mt-5 text-lg leading-loose text-ink-muted">
                وحدة مختارة بعناية ضمن مشروع مميز، صُممت لتمنحك توازنًا بين الراحة والقيمة والموقع.
              </p>
            </div>

            {/* Project relation */}
            {unit.project && (
              <div>
                <SectionHeading eyebrow="المشروع" title="ضمن مشروع" />
                <PremiumCard className="mt-8 p-7">
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                      <IconCircle tone="gold">
                        <Building2 className="h-6 w-6" aria-hidden />
                      </IconCircle>
                      <div>
                        <h3 className="text-lg text-ink-strong">{projectName}</h3>
                        {unit.project.city && (
                          <p className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-ink-muted">
                            <MapPin className="h-4 w-4 text-gold-500" aria-hidden />
                            {unit.project.city}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <ButtonLink href={routes.project(unit.project.id) as Route} variant="primary" size="sm">
                        عرض المشروع
                      </ButtonLink>
                      <ButtonLink href={`${routes.units}?projectId=${unit.project.id}` as Route} variant="outline" size="sm">
                        عرض وحدات المشروع
                      </ButtonLink>
                    </div>
                  </div>
                </PremiumCard>
              </div>
            )}

            {/* Floor plan — intentional blueprint-style fallback (no plan media yet) */}
            <div>
              <SectionHeading eyebrow="المخطط" title="مخطط الوحدة" />
              <PremiumCard className="mt-6 overflow-hidden">
                <div
                  className="relative flex min-h-56 items-center justify-center border-b border-hairline"
                  style={{
                    backgroundColor: '#0F1E33',
                    backgroundImage:
                      'linear-gradient(rgba(200,162,75,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(200,162,75,0.18) 1px, transparent 1px)',
                    backgroundSize: '28px 28px',
                  }}
                >
                  {/* Stylised plan outline */}
                  <div className="relative h-32 w-48 rounded-md border-2 border-gold-300/70">
                    <div className="absolute inset-y-0 left-1/2 w-px bg-gold-300/40" />
                    <div className="absolute inset-x-0 top-1/2 h-px bg-gold-300/40" />
                    <span className="absolute -bottom-3 right-3 inline-flex h-6 w-6 items-center justify-center rounded-full bg-gold-400 text-navy">
                      <LayoutPanelTop className="h-3.5 w-3.5" aria-hidden />
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-4 p-7 text-center sm:flex-row sm:justify-between sm:text-start">
                  <p className="text-ink-muted">المخطط التفصيلي متاح عند الطلب — تواصل معنا للحصول عليه.</p>
                  <ButtonLink href={`${routes.contact}?unitId=${unit.id}` as Route} variant="outline" size="sm">
                    اطلب المخطط
                  </ButtonLink>
                </div>
              </PremiumCard>
            </div>
          </div>

          {/* Inquiry aside */}
          <aside className="lg:col-span-1">
            <div className="lg:sticky lg:top-28">
              <UnitInquiryCard unitId={unit.id} price={unit.price} />
            </div>
          </aside>
        </div>
      </Section>

      {/* Similar units — full-width so cards breathe */}
      {unit.project && similarUnits.length > 0 && (
        <Section tone="soft">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-3xl font-bold text-ink-strong lg:text-4xl">وحدات أخرى في المشروع</h2>
            <ButtonLink href={`${routes.units}?projectId=${unit.project.id}` as Route} variant="outline" size="sm">
              عرض كل الوحدات
              <ArrowLeft className="h-4 w-4" aria-hidden />
            </ButtonLink>
          </div>
          <Stagger className="mt-8 grid gap-7 sm:grid-cols-2 lg:grid-cols-3" childClassName="h-full" step={80}>
            {similarUnits.map((u) => (
              <UnitCard key={u.id} unit={u} />
            ))}
          </Stagger>
        </Section>
      )}

      <CtaBand eyebrow="خطوتك التالية" title="هل ترغب في معاينة هذه الوحدة؟">
        <ButtonLink href={`${routes.contact}?type=visit&unitId=${unit.id}` as Route} variant="gold" size="lg">
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

      <CompareBar />
    </CompareProvider>
  );
}
