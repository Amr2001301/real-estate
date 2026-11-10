import type { Route } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Locale } from '@/lib/locale';
import { getLocale } from '@/lib/locale';
import { getSiteCurrency } from '@/lib/site-currency';
import { Price } from '@/components/currency/CurrencyProvider';
import { buildMetadata } from '@/lib/seo';
import { apiFetch } from '@/lib/api-server';
import { getResolvedTenant } from '@/lib/tenant';
import { pickAr, formatPrice, formatArea, formatNumber, projectPlace, unitTypeLabel } from '@/lib/format';
import { routes } from '@/lib/routes';
import { siteT } from '@/messages/site';
import { extraT } from '@/messages/site-extra';
import type { PublicUnit, PublicPaymentPlan, PublicProjectDetail, Paginated } from '@/lib/api-types';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { ButtonLink } from '@/components/ui/Button';
import { ErrorState } from '@/components/states/ErrorState';
import { Stagger } from '@/components/motion/Stagger';
import { CtaBand } from '@/components/marketing/CtaBand';
import { UnitCard } from '@/components/home/UnitCard';
import { UnitSpecs } from '@/components/units/UnitSpecs';
import { DetailHero, HeroChip, heroIconClass } from '@/components/detail/DetailHero';
import { PaymentPlans, cashSaving } from '@/components/detail/PaymentPlans';
import { DetailStats, DetailHead } from '@/components/detail/DetailStats';
import { DetailBookingCard } from '@/components/detail/DetailBookingCard';
import { DetailProjectCard } from '@/components/detail/DetailProjectCard';
import { FavoriteButton } from '@/components/favorites/FavoriteButton';
import { CompareProvider, type CompareItem } from '@/components/compare/CompareContext';
import { CompareToggle } from '@/components/compare/CompareToggle';
import { CompareBar } from '@/components/compare/CompareBar';
import { JsonLd } from '@/components/seo/JsonLd';
import { breadcrumbLd, unitProductLd } from '@/lib/jsonld';
import { ViewTracker } from '@/components/analytics/ViewTracker';
import { ShareButton } from '@/components/ui/ShareButton';

const REVALIDATE = 60;

type Params = Promise<{ id: string }>;

function fetchUnit(id: string, tenantSlug: string) {
  return apiFetch<PublicUnit>(`/public/units/${id}`, { revalidate: REVALIDATE, tenantSlug });
}

function unitTitle(unit: PublicUnit, fallbackPrefix = 'وحدة', locale: Locale = 'ar'): string {
  return unit.type ? unitTypeLabel(unit.type, unit.typeName, locale) : `${fallbackPrefix} ${unit.code}`;
}

/** «استلام فوري» when already due, else the month and year it is handed over. */
function handoverLabel(date: string, locale: Locale, now: string): string {
  const due = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(due.getTime())) return '';
  if (due.getTime() <= Date.now()) return now;
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(due);
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
        <ErrorState title={m.unitDetail.errorTitle} message={m.unitDetail.errorMsg} className="mx-auto max-w-2xl" />
        <div className="mt-8 text-center">
          <ButtonLink href={routes.units} variant="outline" size="md">{m.unitDetail.backToUnits}</ButtonLink>
        </div>
      </Section>
    );
  }

  const unit = result.data;
  const x = extraT(locale).unitPage;
  const title = unitTitle(unit, m.unitDetail.projectFallback, locale);
  const statusLabel = m.unitDetail.status[unit.status as keyof typeof m.unitDetail.status] ?? m.unitDetail.status.AVAILABLE;
  const projectName = unit.project ? pickAr(unit.project.name, '', locale) : '';
  const place = projectPlace(projectName, null, unit.project?.city, locale);
  const handover = unit.deliveryDate ? handoverLabel(unit.deliveryDate, locale, x.readyNow) : '';
  const residential = !unit.usage || unit.usage === 'RESIDENTIAL';

  const media = unit.media ?? [];
  const photos = media.filter((f) => f.type === 'IMAGE' || !f.type).map((f) => f.url);
  if (photos.length === 0 && unit.coverImage) photos.push(unit.coverImage);
  const floorPlans = media.filter((f) => f.type === 'FLOORPLAN').map((f) => f.url);

  // Its project, its public payment plans and the project's other units —
  // each best-effort, none blocks the page.
  const [projectRes, plansRes, simRes] = await Promise.all([
    unit.project ? apiFetch<PublicProjectDetail>(`/public/projects/${unit.project.id}`, { revalidate: REVALIDATE, tenantSlug: tenant.slug }) : null,
    apiFetch<PublicPaymentPlan[]>(`/public/units/${unit.id}/payment-plans`, { revalidate: REVALIDATE, tenantSlug: tenant.slug }),
    unit.project ? apiFetch<Paginated<PublicUnit>>(`/public/units?projectId=${unit.project.id}&pageSize=4`, { revalidate: REVALIDATE, tenantSlug: tenant.slug }) : null,
  ]);
  const project = projectRes?.ok ? projectRes.data : null;
  const plans = plansRes.ok && Array.isArray(plansRes.data) ? plansRes.data : [];
  const similarUnits = simRes?.ok ? simRes.data.data.filter((u) => u.id !== unit.id).slice(0, 3) : [];

  // The down payment comes from the plans the company published for this
  // unit (its own, its type's or its project's): the lowest share among the
  // instalment plans. No public plan → no down payment shown.
  const instalment = plans.filter((p) => !p.isCash && p.downPaymentPercent > 0).sort((a, b) => a.downPaymentPercent - b.downPaymentPercent);
  const down = instalment[0] ? { percent: instalment[0].downPaymentPercent, amount: instalment[0].downPaymentAmount } : null;
  // A discounted cash plan shows beside the (instalment) listed price.
  const cash = plans.find((p) => p.isCash && cashSaving(p, Number(unit.price)) > 0) ?? null;
  const monthly = instalment[0]?.options.reduce((a, o) => (a === 0 || o.installmentAmount < a ? o.installmentAmount : a), 0) ?? 0;
  const longestMonths = Math.max(0, ...instalment.flatMap((p) => p.options.map((o) => o.durationMonths)));
  const yearsText = longestMonths >= 12 && longestMonths % 12 === 0
    ? `${formatNumber(longestMonths / 12, locale)} ${longestMonths / 12 === 1 ? x.yearsOne : x.yearsMany}`
    : `${formatNumber(longestMonths, locale)} ${x.monthsMany}`;

  const visitHref = `${routes.contact}?type=visit&unitId=${unit.id}`;
  const infoHref = `${routes.contact}?unitId=${unit.id}`;
  const waMessage = m.unitInquiry.waInterest(unit.code ? m.unitInquiry.waUnitSubject(unit.code) : m.unitInquiry.waThisUnit, projectName);
  const compareItem: CompareItem = {
    id: unit.id,
    label: [title, projectName].filter(Boolean).join(' · ') || `${m.unitDetail.projectFallback} ${unit.code}`,
    price: unit.price,
    coverImage: unit.coverImage,
  };
  const ldName = [title, projectName].filter(Boolean).join(' · ');

  const stats = [
    {
      label: x.price,
      value: <Price value={unit.price} />,
      sub: unit.pricePerMeter ? <span data-testid="unit-price-per-meter"><Price value={unit.pricePerMeter} /> {m.unitDetail.perMeter}</span> : undefined,
    },
    { label: x.factArea, value: formatArea(unit.area, locale) },
    ...(residential ? [{ label: x.factBeds, value: formatNumber(unit.bedrooms, locale) }] : []),
    { label: x.factBaths, value: formatNumber(unit.bathrooms, locale) },
    ...(handover ? [{ label: x.handover, value: handover }] : []),
  ];

  return (
    <CompareProvider>
      <ViewTracker event="unit_view" params={{ unit_id: unit.id, unit_status: unit.status }} />
      <JsonLd
        data={breadcrumbLd([
          { name: m.unitDetail.breadHome, path: '/' },
          { name: m.unitDetail.breadUnits, path: '/units' },
          { name: ldName, path: `/units/${unit.id}` },
        ])}
      />
      <JsonLd
        data={unitProductLd({
          name: ldName,
          price: unit.price,
          currency,
          status: unit.status,
          image: photos[0] ?? null,
          path: `/units/${unit.id}`,
        })}
      />

      <section className="bg-canvas pt-24 sm:pt-28">
        <Container>
          <nav aria-label={m.unitDetail.breadNav} className="mb-5">
            <ol className="flex flex-wrap items-center gap-1.5 text-sm">
              <li><Link href={routes.units} className="text-ink-muted transition-colors hover:text-ink-strong">{m.unitDetail.breadUnits}</Link></li>
              {unit.project && projectName && (
                <>
                  <li className="select-none text-ink-muted/40" aria-hidden>/</li>
                  <li><Link href={routes.project(unit.project.id) as Route} className="text-ink-muted transition-colors hover:text-ink-strong">{projectName}</Link></li>
                </>
              )}
              <li className="select-none text-ink-muted/40" aria-hidden>/</li>
              <li className="font-medium text-ink-strong" aria-current="page">{unit.code || title}</li>
            </ol>
          </nav>

          <DetailHero
            images={photos}
            alt={title}
            title={title}
            eyebrow={[projectName, place].filter(Boolean).join(' — ') || undefined}
            status={<HeroChip tone={unit.status === 'AVAILABLE' ? 'success' : 'glass'}>{statusLabel}</HeroChip>}
            tools={
              <>
                <FavoriteButton kind="unit" id={unit.id} className={heroIconClass} />
                <CompareToggle item={compareItem} className={heroIconClass} />
                <ShareButton title={ldName} />
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
              <DetailHead eyebrow={m.unitDetail.specsLabel} title={m.unitDetail.specsTitle} />
              <UnitSpecs unit={unit} />
            </div>

            {plans.length > 0 && (
              <div>
                <DetailHead eyebrow={x.plansLabel} title={x.plansTitle} />
                <PaymentPlans plans={plans} listPrice={Number(unit.price)} locale={locale} />
              </div>
            )}

            {/* The floor plan the company uploaded; nothing when there is none. */}
            {floorPlans.length > 0 && (
              <div>
                <DetailHead eyebrow={x.floorLabel} title={x.floorTitle} />
                <div className="grid gap-4" data-testid="unit-floorplan">
                  {floorPlans.map((u, i) => (
                    <a key={`${u}-${i}`} href={u} target="_blank" rel="noopener noreferrer" aria-label={x.floorOpen} className="block overflow-hidden rounded-[1.25rem] border border-hairline bg-white p-4">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={u} alt={`${title} — ${x.floorTitle}`} className="mx-auto max-h-[600px] w-auto max-w-full object-contain" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div>
              <DetailHead eyebrow={m.unitDetail.aboutLabel} title={m.unitDetail.aboutTitle} />
              <p className="text-[17px] leading-[2] text-ink-muted">{m.unitDetail.aboutDefault}</p>
            </div>
          </div>

          <aside>
            <div className="lg:sticky lg:top-28">
              <DetailBookingCard
                eyebrow={unit.code ? `${m.unitInquiry.unitCode} ${unit.code}` : undefined}
                status={statusLabel}
                headline={<Price value={unit.price} />}
                headSub={cash || unit.pricePerMeter ? <>{cash && `${x.listPrice} (${x.payInstalment})`}{cash && unit.pricePerMeter && ' · '}{unit.pricePerMeter && <><Price value={unit.pricePerMeter} /> {m.unitDetail.perMeter}</>}</> : undefined}
                rows={[
                  down ? { label: `${x.downAmount} (${formatNumber(down.percent, locale)}%)`, value: <Price value={down.amount} />, testId: 'unit-down-payment' } : null,
                  monthly ? { label: x.installmentFrom, value: <><Price value={monthly} /> <span className="text-[13px] font-normal text-ink-muted">/ {x.perMonth}</span></> } : null,
                  longestMonths > 0 ? { label: x.duration, value: yearsText } : null,
                  cash ? { label: x.cashPrice, value: <span className="text-emerald-700 dark:text-emerald-400"><Price value={cash.netPrice} /></span> } : null,
                  handover ? { label: x.handover, value: handover } : null,
                ]}
                visitHref={visitHref}
                infoHref={infoHref}
                waMessage={waMessage}
              />
            </div>
          </aside>
        </div>
      </Section>

      {(project || similarUnits.length > 0) && (
        <Section tone="soft">
          {project && (
            <>
              <DetailHead eyebrow={x.projectEyebrow} title={x.projectTitle} />
              <DetailProjectCard project={project} locale={locale} />
            </>
          )}
          {unit.project && similarUnits.length > 0 && (
            <div className={project ? 'mt-16' : ''}>
              <DetailHead
                eyebrow={m.unitDetail.moreUnitsLabel}
                title={x.otherUnits}
                action={
                  <Link
                    href={`${routes.units}?projectId=${unit.project.id}` as Route}
                    className="inline-flex h-12 shrink-0 items-center justify-center rounded-2xl border border-hairline px-6 text-[15px] font-semibold text-ink-strong transition-colors hover:border-navy/40"
                  >
                    {m.unitDetail.viewAllUnits} ←
                  </Link>
                }
              />
              <Stagger className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3" childClassName="h-full" step={80}>
                {similarUnits.map((u) => (
                  <UnitCard key={u.id} unit={u} locale={locale} />
                ))}
              </Stagger>
            </div>
          )}
        </Section>
      )}

      <CtaBand eyebrow={m.unitDetail.ctaBandTitle} title={m.unitDetail.ctaBandSub}>
        <ButtonLink href={visitHref as Route} variant="gold" size="lg">{x.bookVisit}</ButtonLink>
        <ButtonLink href={infoHref as Route} variant="outline" size="lg" className="border-white/25 text-white hover:border-white/50 hover:bg-white/5">
          {m.unitDetail.ctaBandCta}
        </ButtonLink>
      </CtaBand>

      <div className="h-[72px] lg:hidden" aria-hidden />
      <CompareBar />
    </CompareProvider>
  );
}
