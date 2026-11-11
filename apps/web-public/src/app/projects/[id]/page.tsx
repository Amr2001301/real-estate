import type { Route } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Home } from 'lucide-react';
import { extraT } from '@/messages/site-extra';
import { siteT } from '@/messages/site';
import { getLocale } from '@/lib/locale';
import { buildMetadata } from '@/lib/seo';
import { apiFetch } from '@/lib/api-server';
import { getResolvedTenant } from '@/lib/tenant';
import { pickAr, formatNumber, cityLabel, projectPlace, unitTypeLabel } from '@/lib/format';
import { routes } from '@/lib/routes';
import type { PublicProjectDetail, PublicProjectPlans, Paginated, PublicUnit } from '@/lib/api-types';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { ButtonLink } from '@/components/ui/Button';
import { ErrorState } from '@/components/states/ErrorState';
import { InlineNotice } from '@/components/states/InlineNotice';
import { Stagger } from '@/components/motion/Stagger';
import { ProjectAmenities } from '@/components/projects/ProjectAmenities';
import { ProjectLocation } from '@/components/projects/ProjectLocation';
import { UnitCard } from '@/components/home/UnitCard';
import { DetailHero, HeroChip, heroIconClass } from '@/components/detail/DetailHero';
import { DetailStats, DetailHead } from '@/components/detail/DetailStats';
import { DetailBookingCard } from '@/components/detail/DetailBookingCard';
import { ProjectPriceCard, type UnitMixRow } from '@/components/detail/ProjectPriceCard';
import { StickyAside } from '@/components/detail/StickyAside';
import { FavoriteButton } from '@/components/favorites/FavoriteButton';
import { JsonLd } from '@/components/seo/JsonLd';
import { breadcrumbLd, projectResidenceLd } from '@/lib/jsonld';
import { Accordion } from '@/components/ui/Accordion';
import { CtaBand } from '@/components/marketing/CtaBand';
import { ViewTracker } from '@/components/analytics/ViewTracker';
import { ShareButton } from '@/components/ui/ShareButton';

const REVALIDATE = 60;

type Params = Promise<{ id: string }>;

function fetchProject(id: string, tenantSlug: string) {
  return apiFetch<PublicProjectDetail>(`/public/projects/${id}`, { revalidate: REVALIDATE, tenantSlug });
}

export async function generateMetadata({ params }: { params: Params }) {
  const { id } = await params;
  const tenant = await getResolvedTenant();
  const [result, locale] = await Promise.all([
    tenant ? fetchProject(id, tenant.slug) : Promise.resolve({ ok: false as const, error: { message: '', status: 404 } }),
    getLocale(),
  ]);
  const m = siteT(locale);
  if (!result.ok) return buildMetadata({ title: m.projectDetail.errorTitle });
  const name = pickAr(result.data.name, m.projectDetail.breadProjects, locale);
  const description = pickAr(result.data.description, '', locale) || undefined;
  const image = result.data.media?.[0]?.url;
  return buildMetadata({ title: name, description, path: `/projects/${id}`, ...(image ? { image } : {}) });
}

export default async function ProjectDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const tenant = await getResolvedTenant();
  if (!tenant) notFound();
  const [result, locale] = await Promise.all([fetchProject(id, tenant.slug), getLocale()]);
  const m = siteT(locale);

  if (!result.ok) {
    if (result.error.status === 404) notFound();
    return (
      <Section tone="canvas" className="pt-36">
        <ErrorState title={m.projectDetail.errorTitle} message={m.projectDetail.errorMsg} className="mx-auto max-w-2xl" />
        <div className="mt-8 text-center">
          <ButtonLink href={routes.projects} variant="outline" size="md">{m.projectDetail.backToProjects}</ButtonLink>
        </div>
      </Section>
    );
  }

  const project = result.data;
  const x = extraT(locale).unitPage;
  const name = pickAr(project.name, m.projectDetail.breadProjects, locale);
  const description = pickAr(project.description, '', locale);
  const place = projectPlace(name, project.district, project.city, locale) || cityLabel(project.city, locale);
  const type = project.type ? m.projectTypes[project.type] ?? null : null;
  const hasCoords = project.lat !== 0 || project.lng !== 0;
  const photos = (project.media ?? []).filter((f) => f.type === 'IMAGE' || !f.type).map((f) => f.url);

  // Its available units (a few shown, all of them for the prices and the
  // mix by type), the company's names for its types, and its public payment
  // terms — best-effort.
  const [unitsResult, plansRes, typesRes] = await Promise.all([
    apiFetch<Paginated<PublicUnit>>(`/public/units?projectId=${project.id}&pageSize=200`, { revalidate: REVALIDATE, tenantSlug: tenant.slug }),
    apiFetch<PublicProjectPlans>(`/public/projects/${project.id}/payment-plans`, { revalidate: REVALIDATE, tenantSlug: tenant.slug }),
    apiFetch<Array<{ code: string; name: string | { ar?: string; en?: string } }>>('/public/unit-types', { revalidate: REVALIDATE, tenantSlug: tenant.slug }),
  ]);
  const allUnits = unitsResult.ok ? unitsResult.data.data : [];
  const previewUnits = allUnits.slice(0, 6);
  const prices = allUnits.map((u) => Number(u.price)).filter((n) => Number.isFinite(n) && n > 0);
  const priceMin = prices.length ? Math.min(...prices) : null;
  const priceMax = prices.length ? Math.max(...prices) : null;
  const typeNames = new Map((typesRes.ok ? typesRes.data : []).map((t) => [t.code, t.name]));
  const mixCounts = new Map<string, number>();
  for (const u of allUnits) mixCounts.set(u.type, (mixCounts.get(u.type) ?? 0) + 1);
  const mix: UnitMixRow[] = [...mixCounts.entries()]
    .map(([code, count]) => ({
      label: unitTypeLabel(code, typeNames.get(code), locale),
      count,
      href: `${routes.units}?projectId=${project.id}&type=${encodeURIComponent(code)}`,
    }))
    .sort((a, b) => b.count - a.count);

  const plans = plansRes.ok ? plansRes.data : null;
  const downMin = plans?.minDownPaymentPercent ?? null;
  const maxMonths = plans?.maxMonths ?? null;
  const yearsText = maxMonths
    ? maxMonths % 12 === 0
      ? `${formatNumber(maxMonths / 12, locale)} ${maxMonths / 12 === 1 ? x.yearsOne : x.yearsMany}`
      : `${formatNumber(maxMonths, locale)} ${x.monthsMany}`
    : null;

  const visitHref = `${routes.contact}?type=visit&projectId=${project.id}`;
  const infoHref = `${routes.contact}?projectId=${project.id}`;
  const waMessage = extraT(locale).inquiry.whatsappMessage(name);
  const units = formatNumber(project.availableUnitsCount, locale);

  const stats = [
    { label: x.availableUnits, value: units },
    ...(downMin ? [{ label: x.downMin, value: `${formatNumber(downMin, locale)}%`, sub: yearsText ? x.planMonths(yearsText) : undefined }] : []),
    ...(project.totalArea ? [{ label: x.projectArea, value: `${formatNumber(project.totalArea, locale)} ${m.projectFacts.sqm}` }] : []),
    ...(type ? [{ label: x.projectType, value: type }] : []),
    { label: x.city, value: cityLabel(project.city, locale) },
  ];

  return (
    <>
      <ViewTracker event="project_view" params={{ project_id: project.id, city: project.city }} />
      <JsonLd
        data={breadcrumbLd([
          { name: m.projectDetail.breadHome, path: '/' },
          { name: m.projectDetail.breadProjects, path: '/projects' },
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
          image: photos[0] ?? null,
          path: `/projects/${project.id}`,
        })}
      />

      <section className="bg-canvas pt-24 sm:pt-28">
        <Container>
          <nav aria-label={m.projectDetail.breadNav} className="mb-5">
            <ol className="flex items-center gap-1.5 text-sm">
              <li><Link href={routes.projects} className="text-ink-muted transition-colors hover:text-ink-strong">{m.projectDetail.breadProjects}</Link></li>
              <li className="select-none text-ink-muted/40" aria-hidden>/</li>
              <li className="max-w-[14rem] truncate font-medium text-ink-strong sm:max-w-sm" aria-current="page">{name}</li>
            </ol>
          </nav>

          <DetailHero
            images={photos}
            alt={name}
            title={name}
            eyebrow={[place, type].filter(Boolean).join(' · ')}
            status={project.featured ? <HeroChip tone="gold">{m.projectDetail.featured}</HeroChip> : undefined}
            tools={
              <>
                <FavoriteButton kind="project" id={project.id} className={heroIconClass} />
                <ShareButton title={name} />
              </>
            }
          />
          <DetailStats items={stats} />
        </Container>
      </section>

      <Section tone="canvas" className="pt-14 sm:pt-16">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-14">
            <div>
              <DetailHead eyebrow={m.projectDetail.overviewLabel} title={m.projectDetail.aboutTitle} />
              <p className="text-[17px] leading-[2] text-ink-muted">{description || m.projectDetail.aboutEmpty}</p>
            </div>

            <ProjectAmenities services={project.services} locale={locale} />

            <div>
              <DetailHead
                eyebrow={m.projectDetail.unitsLabel}
                title={m.projectDetail.unitsTitle}
                action={
                  previewUnits.length > 0 ? (
                    <Link
                      href={`${routes.units}?projectId=${project.id}` as Route}
                      className="inline-flex h-12 shrink-0 items-center justify-center rounded-2xl border border-hairline px-6 text-[15px] font-semibold text-ink-strong transition-colors hover:border-navy/40"
                    >
                      {m.projectDetail.viewAllUnits} ←
                    </Link>
                  ) : undefined
                }
              />
              {!unitsResult.ok ? (
                <InlineNotice tone="warning">{m.projectDetail.unitsError}</InlineNotice>
              ) : previewUnits.length === 0 ? (
                <div className="flex flex-col items-center gap-5 rounded-[1.25rem] border border-hairline bg-surface p-6 text-center sm:flex-row sm:justify-between sm:text-start">
                  <div className="flex items-center gap-4">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gold-400/15 text-gold-700 dark:text-gold-300">
                      <Home className="h-6 w-6" aria-hidden />
                    </span>
                    <div>
                      <h3 className="text-base font-semibold text-ink-strong">{m.projectDetail.unitsEmpty}</h3>
                      <p className="mt-1 text-sm text-ink-muted">{m.projectDetail.unitsEmptyMsg}</p>
                    </div>
                  </div>
                  <ButtonLink href={infoHref as Route} variant="primary" size="md" className="w-full shrink-0 sm:w-auto">
                    {m.projectDetail.unitsAdvisor}
                  </ButtonLink>
                </div>
              ) : (
                <Stagger className="grid gap-6 sm:grid-cols-2" childClassName="h-full" step={80}>
                  {previewUnits.slice(0, 4).map((unit) => (
                    <UnitCard key={unit.id} unit={unit} locale={locale} />
                  ))}
                </Stagger>
              )}
            </div>

            <ProjectLocation city={cityLabel(project.city, locale)} lat={hasCoords ? project.lat : null} lng={hasCoords ? project.lng : null} locale={locale} />

            <div>
              <DetailHead eyebrow={m.projectDetail.faqLabel} title={m.projectDetail.faqTitle} />
              <Accordion items={extraT(locale).projectFaq(name)} defaultOpenFirst />
            </div>
          </div>

          <aside>
            <StickyAside>
              <DetailBookingCard
                eyebrow={name}
                headline={x.unitsAvailable(units)}
                headSub={place}
                rows={[
                  downMin ? { label: x.downMin, value: `${formatNumber(downMin, locale)}%` } : null,
                  yearsText ? { label: x.duration, value: yearsText } : null,
                  type ? { label: x.projectType, value: type } : null,
                  project.licenseNumber ? { label: m.projectFacts.license, value: <span dir="ltr">{project.licenseNumber}</span>, testId: 'project-license' } : null,
                ]}
                visitHref={visitHref}
                infoHref={infoHref}
                waMessage={waMessage}
              />
              {priceMin != null && priceMax != null && (
                <div className="mt-5 hidden lg:block">
                  <ProjectPriceCard min={priceMin} max={priceMax} mix={mix} locale={locale} />
                </div>
              )}
            </StickyAside>
          </aside>
        </div>
      </Section>

      <CtaBand eyebrow={m.projectDetail.ctaBandTitle} title={m.projectDetail.ctaBandSub}>
        <ButtonLink href={visitHref as Route} variant="gold" size="lg">{x.bookVisit}</ButtonLink>
        <ButtonLink href={`${routes.units}?projectId=${project.id}` as Route} variant="outline" size="lg" className="border-white/25 text-white hover:border-white/50 hover:bg-white/5">
          {m.projectDetail.ctaBandExplore}
        </ButtonLink>
      </CtaBand>

      <div className="h-[72px] lg:hidden" aria-hidden />
    </>
  );
}
