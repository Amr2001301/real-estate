import type { Route } from 'next';
import type { Locale } from '@/lib/locale';
import { getSiteCurrency } from '@/lib/site-currency';
import { Price } from '@/components/currency/CurrencyProvider';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MapPin, ArrowLeft, Building2, Maximize, BedDouble, Bath, Layers } from 'lucide-react';
import { buildMetadata } from '@/lib/seo';
import { apiFetch } from '@/lib/api-server';
import { getResolvedTenant } from '@/lib/tenant';
import { pickAr, formatPrice, formatArea, formatNumber, projectPlace, unitTypeLabel } from '@/lib/format';
import { extraT } from '@/messages/site-extra';
import { DEEP_BG } from '@/components/home/Hero';
import { UnitGallery } from '@/components/units/UnitGallery';
import { FloorPlanArt } from '@/components/ui/BuildingArt';
import { routes } from '@/lib/routes';
import { getLocale } from '@/lib/locale';
import { siteT } from '@/messages/site';
import type { PublicUnit, PublicPaymentPlan, Paginated } from '@/lib/api-types';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { ButtonLink } from '@/components/ui/Button';
import { ErrorState } from '@/components/states/ErrorState';
import { Stagger } from '@/components/motion/Stagger';
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

const STATUS_TONES: Record<string, StatusMeta['tone']> = {
  AVAILABLE: 'success',
  RESERVED:  'warning',
  SOLD:      'neutral',
};

const DEFAULT_STATUS_TONE: StatusMeta['tone'] = 'success';

type Params = Promise<{ id: string }>;

function fetchUnit(id: string, tenantSlug: string) {
  return apiFetch<PublicUnit>(`/public/units/${id}`, { revalidate: REVALIDATE, tenantSlug });
}

/** «استلام فوري» when already due, else the month and year it is handed over. */
function handoverLabel(date: string, locale: Locale, now: string): string {
  const due = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(due.getTime())) return '';
  if (due.getTime() <= Date.now()) return now;
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(due);
}

function unitTitle(unit: PublicUnit, fallbackPrefix = 'وحدة', locale: Locale = 'ar'): string {
  return unit.type ? unitTypeLabel(unit.type, unit.typeName, locale) : `${fallbackPrefix} ${unit.code}`;
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
  const tenant = await getResolvedTenant();
  const [result, locale, currency] = await Promise.all([
    tenant ? fetchUnit(id, tenant.slug) : Promise.resolve({ ok: false as const, error: { message: '', status: 404 } }),
    getLocale(),
    getSiteCurrency(),
  ]);
  const m = siteT(locale);
  if (!result.ok) return buildMetadata({ title: m.unitDetail.errorTitle });

  const unit = result.data;
  const project = unit.project ? pickAr(unit.project.name, '', locale) : '';
  const title = [unitTitle(unit, m.unitDetail.projectFallback, locale), project].filter(Boolean).join(' · ');
  const description = `${unitTitle(unit, m.unitDetail.projectFallback, locale)}${project ? ` ${m.unitDetail.projectPrefix} ${project}` : ''} — ${formatArea(unit.area, locale)} · ${formatPrice(unit.price, currency, locale)}.`;
  const image = unit.coverImage ?? unit.media?.[0]?.url;
  return buildMetadata({ title, description, path: `/units/${id}`, ...(image ? { image } : {}) });
}

export default async function UnitDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const tenant = await getResolvedTenant();
  if (!tenant) notFound();
  const [result, locale, currency] = await Promise.all([fetchUnit(id, tenant.slug), getLocale(), getSiteCurrency()]);
  const m = siteT(locale);

  if (!result.ok) {
    if (result.error.status === 404) notFound();
    return (
      <Section tone="canvas" className="pt-36">
        <ErrorState
          title={m.unitDetail.errorTitle}
          message={m.unitDetail.errorMsg}
          className="mx-auto max-w-2xl"
        />
        <div className="mt-8 text-center">
          <ButtonLink href={routes.units} variant="outline" size="md">
            {m.unitDetail.backToUnits}
          </ButtonLink>
        </div>
      </Section>
    );
  }

  const unit = result.data;
  const title = unitTitle(unit, m.unitDetail.projectFallback, locale);
  const statusLabel = m.unitDetail.status[unit.status as keyof typeof m.unitDetail.status] ?? m.unitDetail.status.AVAILABLE;
  const status: StatusMeta = { label: statusLabel, tone: STATUS_TONES[unit.status] ?? DEFAULT_STATUS_TONE };
  const projectName = unit.project ? pickAr(unit.project.name, '', locale) : '';
  const compareItem: CompareItem = {
    id: unit.id,
    label: [unit.type, projectName].filter(Boolean).join(' · ') || `${m.unitDetail.projectFallback} ${unit.code}`,
    price: unit.price,
    coverImage: unit.coverImage,
  };

  const ldName = [title, projectName].filter(Boolean).join(' · ');

  let similarUnits: PublicUnit[] = [];
  if (unit.project) {
    const sim = await apiFetch<Paginated<PublicUnit>>(
      `/public/units?projectId=${unit.project.id}&pageSize=4`,
      { revalidate: REVALIDATE, tenantSlug: tenant.slug },
    );
    if (sim.ok) similarUnits = sim.data.data.filter((u) => u.id !== unit.id).slice(0, 3);
  }

  const x = extraT(locale).unitPage;
  const place = projectPlace(projectName, null, unit.project?.city, locale);
  const finishingLabel = unit.finishing ? m.unitSpecs.finishingLabels[unit.finishing] ?? null : null;
  const handover = unit.deliveryDate ? handoverLabel(unit.deliveryDate, locale, x.readyNow) : null;
  const floorPlans = (unit.media ?? []).filter((f) => f.type === 'FLOORPLAN').map((f) => f.url);
  const plansRes = await apiFetch<PublicPaymentPlan[]>(`/public/units/${unit.id}/payment-plans`, { revalidate: REVALIDATE, tenantSlug: tenant.slug });
  const plans = plansRes.ok && Array.isArray(plansRes.data) ? plansRes.data : [];
  // The down payment comes from the plans the company published for this unit:
  // the lowest share among the instalment plans.
  const instalment = plans.filter((p) => !p.isCash && p.downPaymentPercent > 0).sort((a, b) => a.downPaymentPercent - b.downPaymentPercent);
  const down = instalment[0] ? { percent: instalment[0].downPaymentPercent, amount: instalment[0].downPaymentAmount } : null;
  const bandCols = ['sm:grid-cols-1', 'sm:grid-cols-2', 'sm:grid-cols-3'][(down ? 1 : 0) + (handover ? 1 : 0)];
  const facts: { icon: typeof Maximize; label: string; value: string }[] = [
    { icon: Maximize, label: x.factArea, value: formatArea(unit.area, locale) },
    ...(!unit.usage || unit.usage === 'RESIDENTIAL' ? [{ icon: BedDouble, label: x.factBeds, value: formatNumber(unit.bedrooms, locale) }] : []),
    { icon: Bath, label: x.factBaths, value: formatNumber(unit.bathrooms, locale) },
    { icon: Layers, label: x.factFloor, value: formatNumber(unit.floor, locale) },
  ];

  return (
    <CompareProvider>
      <ViewTracker event="unit_view" params={{ unit_id: unit.id, unit_status: unit.status }} />
      <JsonLd
        data={breadcrumbLd([
          { name: m.unitDetail.breadHome,  path: '/' },
          { name: m.unitDetail.breadUnits, path: '/units' },
          { name: ldName,                  path: `/units/${unit.id}` },
        ])}
      />
      <JsonLd
        data={unitProductLd({
          name: ldName,
          price: unit.price,
          currency,
          status: unit.status,
          image: unit.coverImage ?? unit.media?.[0]?.url ?? null,
          path: `/units/${unit.id}`,
        })}
      />

      {/* ── Gallery ── */}
      <section className="bg-canvas pt-24 sm:pt-28">
        <Container>
          <nav aria-label={m.unitDetail.breadNav} className="mb-5">
            <ol className="flex items-center gap-1.5 text-sm">
              <li>
                <Link href={routes.units} className="text-ink-muted transition-colors hover:text-ink-strong">
                  {m.unitDetail.breadUnits}
                </Link>
              </li>
              <li className="select-none text-ink-muted/40" aria-hidden>/</li>
              <li className="max-w-[12rem] truncate font-medium text-ink-strong sm:max-w-xs" aria-current="page">{title}</li>
            </ol>
          </nav>
          <UnitGallery media={unit.media} alt={title} locale={locale} />
        </Container>
      </section>

      {/* ── Body: main column + sticky booking card ── */}
      <Section tone="canvas" className="pt-8 sm:pt-10">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-12">
          <div className="min-w-0 space-y-12">
            {/* Header */}
            <header>
              <div className="flex flex-wrap gap-2">
                <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${status.tone === 'success' ? 'bg-success/10 text-success' : 'bg-surface-soft text-ink'}`}>{status.label}</span>
                {finishingLabel && <span className="rounded-full bg-surface-soft px-3 py-1.5 text-xs font-semibold text-ink">{finishingLabel}</span>}
                {handover && <span className="rounded-full bg-surface-soft px-3 py-1.5 text-xs font-semibold text-ink">{x.handover}: {handover}</span>}
              </div>
              <h1 className="mt-4 font-display text-[2rem] font-semibold leading-[1.3] text-ink-strong sm:text-[2.6rem]">{title}</h1>
              {(projectName || place) && (
                <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] text-ink-muted">
                  <MapPin className="h-4 w-4 shrink-0" aria-hidden />
                  {[projectName, place, unit.code].filter(Boolean).join(' · ')}
                </p>
              )}
            </header>

            {/* Price band */}
            <div className={`grid gap-px overflow-hidden rounded-[1.25rem] border border-hairline bg-hairline ${bandCols}`}>
              <div className="bg-surface px-6 py-5">
                <p className="text-xs font-medium text-ink-muted">{x.price}</p>
                <p className="mt-1 font-display text-[1.75rem] font-semibold text-ink-strong"><Price value={unit.price} /></p>
                {unit.pricePerMeter && (
                  <p className="mt-0.5 text-sm text-ink-muted" data-testid="unit-price-per-meter">
                    <Price value={unit.pricePerMeter} /> {m.unitDetail.perMeter}
                  </p>
                )}
              </div>
              {down && (
                <div className="bg-surface px-6 py-5">
                  <p className="text-xs font-medium text-ink-muted">{x.downAmount}</p>
                  <p className="mt-1 font-display text-[1.75rem] font-semibold text-ink-strong">{formatNumber(down.percent, locale)}٪</p>
                  {down.amount > 0 && <p className="mt-0.5 text-sm text-ink-muted"><Price value={down.amount} /></p>}
                </div>
              )}
              {handover && (
                <div className="bg-surface px-6 py-5">
                  <p className="text-xs font-medium text-ink-muted">{x.handover}</p>
                  <p className="mt-1 font-display text-[1.75rem] font-semibold text-ink-strong">{handover}</p>
                </div>
              )}
            </div>

            {/* Key facts */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {facts.map((f) => (
                <div key={f.label} className="rounded-2xl border border-hairline bg-surface px-5 py-5">
                  <f.icon className="h-5 w-5 text-gold-500" aria-hidden />
                  <p className="mt-3 font-display text-[1.6rem] font-semibold leading-none text-ink-strong">{f.value}</p>
                  <p className="mt-1.5 text-sm text-ink-muted">{f.label}</p>
                </div>
              ))}
            </div>

            {/* Specs */}
            <div>
              <SectionHead label={m.unitDetail.specsLabel} title={m.unitDetail.specsTitle} />
              <div className="mt-8"><UnitSpecs unit={unit} /></div>
            </div>

            {/* Payment plans — only when the company published some for this unit */}
            {plans.length > 0 && (
              <div>
                <SectionHead label={x.plansLabel} title={x.plansTitle} />
                <div className="mt-8 grid gap-3 sm:grid-cols-2" data-testid="unit-plans">
                  {plans.slice(0, 4).map((p) => {
                    const longest = p.options.reduce<PublicPaymentPlan['options'][number] | null>((a, o) => (!a || o.durationMonths > a.durationMonths ? o : a), null);
                    return (
                      <div key={p.id} className="rounded-2xl border border-hairline bg-surface px-5 py-5">
                        <p className="font-display text-lg font-semibold text-ink-strong">{p.name || (p.isCash ? x.planCash : x.plansLabel)}</p>
                        {p.isCash ? (
                          <p className="mt-2 text-sm text-ink-muted"><Price value={p.netPrice} /></p>
                        ) : (
                          <dl className="mt-3 space-y-1.5 text-sm">
                            <div className="flex justify-between gap-3"><dt className="text-ink-muted">{x.downAmount}</dt><dd className="font-semibold text-ink-strong">{formatNumber(p.downPaymentPercent, locale)}٪ · <Price value={p.downPaymentAmount} /></dd></div>
                            {longest && <div className="flex justify-between gap-3"><dt className="text-ink-muted">{x.planMonths(`${formatNumber(longest.durationMonths, locale)} ${x.monthsMany}`)}</dt><dd className="font-semibold text-ink-strong"><Price value={longest.installmentAmount} /></dd></div>}
                          </dl>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* About */}
            <div>
              <SectionHead label={m.unitDetail.aboutLabel} title={m.unitDetail.aboutTitle} />
              <p className="mt-6 text-lg leading-loose text-ink-muted">{m.unitDetail.aboutDefault}</p>
            </div>

            {/* Floor plan: the company's upload, else an honest «on request». */}
            <div>
              <SectionHead label={x.floorLabel} title={x.floorTitle} />
              {floorPlans.length > 0 ? (
                <div className="mt-8 grid gap-4" data-testid="unit-floorplan">
                  {floorPlans.map((u, i) => (
                    <a key={`${u}-${i}`} href={u} target="_blank" rel="noopener noreferrer" aria-label={x.floorOpen} className="block overflow-hidden rounded-[1.25rem] border border-hairline bg-white p-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={u} alt={`${title} — ${x.floorTitle}`} className="mx-auto max-h-[560px] w-auto max-w-full object-contain" />
                    </a>
                  ))}
                </div>
              ) : (
                <div className="mt-8 overflow-hidden rounded-[1.25rem] border border-hairline bg-surface">
                  <FloorPlanArt label={x.floorTitle} className="h-64 sm:h-72" />
                  <div className="flex flex-col items-center gap-4 p-6 text-center sm:flex-row sm:justify-between sm:text-start">
                    <p className="text-ink-muted">{x.floorOnRequest}</p>
                    <ButtonLink href={`${routes.contact}?unitId=${unit.id}` as Route} variant="outline" size="sm">{m.unitDetail.floorplanCta}</ButtonLink>
                  </div>
                </div>
              )}
            </div>

            {/* Project */}
            {unit.project && (
              <div>
                <SectionHead label={m.unitDetail.projectLabel} title={m.unitDetail.projectPrefix} />
                <div className="mt-8 flex flex-col gap-5 rounded-[1.25rem] border border-hairline bg-surface p-6 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white" style={{ background: DEEP_BG }}>
                      <Building2 className="h-6 w-6" aria-hidden />
                    </span>
                    <div>
                      <h3 className="font-display text-lg font-semibold text-ink-strong">{projectName}</h3>
                      {place && <p className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-ink-muted"><MapPin className="h-3.5 w-3.5" aria-hidden />{place}</p>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    <ButtonLink href={routes.project(unit.project.id) as Route} variant="primary" size="sm">{m.unitDetail.viewProject}</ButtonLink>
                    <ButtonLink href={`${routes.units}?projectId=${unit.project.id}` as Route} variant="outline" size="sm">{m.unitDetail.relatedLabel}</ButtonLink>
                  </div>
                </div>
              </div>
            )}
          </div>

          <aside>
            <div className="lg:sticky lg:top-28">
              <UnitInquiryCard
                unitId={unit.id}
                price={unit.price}
                unitCode={unit.code}
                projectName={projectName}
                statusLabel={status.label}
                down={down}
                locale={locale}
                tools={
                  <>
                    <CompareToggle item={compareItem} />
                    <ShareButton title={[title, projectName].filter(Boolean).join(' · ')} variant="card" />
                  </>
                }
              />
            </div>
          </aside>
        </div>
      </Section>

      {/* ── Related units — full-width soft band ── */}
      {unit.project && similarUnits.length > 0 && (
        <Section tone="soft">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHead label={m.unitDetail.moreUnitsLabel} title={m.unitDetail.moreUnitsTitle} />
            {/* Premium gold text-link — matches project page */}
            <Link
              href={`${routes.units}?projectId=${unit.project.id}` as Route}
              className="group mb-0.5 flex shrink-0 items-center gap-2 text-sm font-medium text-gold-600 transition-colors hover:text-gold-700"
            >
              {m.unitDetail.viewAllUnits}
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
              <UnitCard key={u.id} unit={u} locale={locale} />
            ))}
          </Stagger>
        </Section>
      )}

      <CtaBand eyebrow={m.unitDetail.ctaBandTitle} title={m.unitDetail.ctaBandSub}>
        <ButtonLink
          href={`${routes.contact}?type=visit&unitId=${unit.id}` as Route}
          variant="gold"
          size="lg"
        >
          {m.unitDetail.ctaVisit}
        </ButtonLink>
        <ButtonLink
          href={`${routes.contact}?unitId=${unit.id}` as Route}
          variant="outline"
          size="lg"
          className="border-white/25 text-white hover:border-white/50 hover:bg-white/5"
        >
          {m.unitDetail.ctaBandCta}
        </ButtonLink>
      </CtaBand>

      {/* Spacer so the mobile sticky inquiry bar doesn't overlap the CTA band */}
      <div className="h-[72px] lg:hidden" aria-hidden />

      <CompareBar />
    </CompareProvider>
  );
}
