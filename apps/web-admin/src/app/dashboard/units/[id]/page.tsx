import Link from 'next/link';
import {
  Pencil,
  Ruler,
  BedDouble,
  Bath,
  Layers,
  Building2,
  MapPin,
  CalendarClock,
  Bookmark,
  BookmarkCheck,
  ArrowLeft,
  ArrowRightLeft,
  ArrowRight,
  User as UserIcon,
  UserCog,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import { getSession } from '@/lib/session';
import { getLocale, type Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import type {
  Paged,
  Reservation,
  Unit,
  UnitStatusHistoryEntry,
} from '@/lib/types';
import { tx, formatCurrency, formatDate, formatDateTime } from '@/lib/format';
import { getReportsCurrency } from '@/lib/currency';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ReservationStatusBadge, UnitStatusBadge } from '@/components/badges';
import { ConfirmButton } from '@/components/confirm-button';
import { UnitMediaPanel } from './media-panel';
import { MaintenanceItemsCard } from './maintenance-items-card';
import { deleteUnitAction } from '../actions';
import {
  PremiumDetailLayout,
  PremiumPanel,
  PremiumEmptyNote,
} from '@/components/premium';

export const dynamic = 'force-dynamic';

export default async function UnitDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [unitRes, reservationsRes, currency, locale] = await Promise.all([
    safe(api.get<Unit>(`/units/${id}`)),
    safe(api.get<Paged<Reservation>>(`/reservations?unitId=${id}&pageSize=20`)),
    getReportsCurrency(),
    getLocale(),
  ]);

  const unitsM = uiT(locale).pages.units;
  const m = unitsM.detail;

  if (unitRes.error || !unitRes.data) {
    return (
      <div className="rounded-2xl bg-danger-500/10 text-danger-600 p-6 text-sm">
        {m.errorLoad} {unitRes.error ?? m.errorNotFound}
      </div>
    );
  }

  const unit = unitRes.data;
  const session = await getSession();
  const isAdmin = session?.role === 'ADMIN';
  const projectName = tx(unit.building?.phase?.project?.name);
  const phaseName = tx(unit.building?.phase?.name);
  const buildingName = unit.building?.name;
  const city = unit.building?.phase?.project?.city;
  const cover = unit.media?.find((med) => med.type === 'IMAGE')?.url;
  const history = unit.history ?? [];
  const reservations = reservationsRes.data?.data ?? [];
  const activeReservation = reservations.find(
    (r) => r.status === 'PENDING' || r.status === 'APPROVED',
  );
  const pastReservations = reservations.filter((r) => r.id !== activeReservation?.id);

  const locationParts = [
    projectName !== '—' ? projectName : null,
    phaseName !== '—' ? phaseName : null,
    buildingName ? m.buildingLabel(buildingName) : null,
    city || null,
  ].filter(Boolean) as string[];

  const project = unit.building?.phase?.project;
  const typeLabel = tx(unit.typeName, locale) || unit.type;
  const facts = [
    { label: m.metrics.area, value: `${unit.area}`, suffix: m.metrics.areaSuffix, icon: <Ruler /> },
    { label: m.metrics.bedrooms, value: unit.bedrooms, icon: <BedDouble /> },
    { label: m.metrics.bathrooms, value: unit.bathrooms, icon: <Bath /> },
    { label: m.metrics.floor, value: unit.floor === 0 ? m.metrics.groundFloor : unit.floor, icon: <Layers /> },
  ];
  const specs: Array<[string, React.ReactNode]> = [
    [m.fieldCode, <span key="c" className="font-mono">{unit.code}</span>],
    [m.fieldType, typeLabel],
    ...(['netArea', 'gardenArea', 'roofArea', 'terraceArea', 'landArea'] as const)
      .filter((f) => unit[f])
      .map((f) => [unitsM.specLabels[f] ?? f, `${unit[f]} ${m.metrics.areaSuffix}`] as [string, React.ReactNode]),
    ...(unit.pricePerMeter != null
      ? [[unitsM.pricePerMeter, formatCurrency(unit.pricePerMeter, currency, locale)] as [string, React.ReactNode]]
      : []),
    ...(unit.finishing ? [[unitsM.specLabels.finishing ?? '', unitsM.finishingLabels[unit.finishing] ?? unit.finishing] as [string, React.ReactNode]] : []),
    ...(unit.view ? [[unitsM.specLabels.view ?? '', unitsM.viewLabels[unit.view] ?? unit.view] as [string, React.ReactNode]] : []),
    ...(unit.orientation
      ? [[unitsM.specLabels.orientation ?? '', unitsM.orientationLabels[unit.orientation] ?? unit.orientation] as [string, React.ReactNode]]
      : []),
    ...(unit.model
      ? [[uiT(locale).pages.unitsForm.labelModel, `${unit.model.code} — ${tx(unit.model.name, locale)}`] as [string, React.ReactNode]]
      : []),
    ...(unit.effectiveDeliveryDate
      ? [[
          uiT(locale).pages.unitsForm.labelDelivery,
          `${unit.effectiveDeliveryDate}${unit.deliveryDate ? '' : ` ${uiT(locale).pages.unitsForm.fromPhase}`}`,
        ] as [string, React.ReactNode]]
      : []),
  ];

  return (
    <div className="space-y-6">
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section data-testid="unit-hero" className="relative isolate overflow-hidden rounded-[26px] border border-hairline bg-surface">
        {cover ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cover} alt="" aria-hidden className="absolute inset-0 -z-10 h-full w-full object-cover" />
            <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#070b14] via-[#070b14]/80 to-[#070b14]/30" />
          </>
        ) : (
          <div className="absolute inset-0 -z-10 bg-gradient-to-bl from-brand-500/[0.14] via-transparent to-transparent" />
        )}
        <div className={cn('flex flex-col gap-6 p-7 sm:p-9', cover && 'min-h-[300px] justify-end')}>
          <nav aria-label="breadcrumb">
            <ol className={cn('flex flex-wrap items-center gap-1.5 text-[13px]', cover ? 'text-white/70' : 'text-slate-500')}>
              <li><Link href={'/dashboard' as never} className="hover:text-brand-400">{m.breadcrumbDashboard}</Link></li>
              <li aria-hidden>›</li>
              <li><Link href={'/dashboard/units' as never} className="hover:text-brand-400">{m.breadcrumbList}</Link></li>
              <li aria-hidden>›</li>
              <li className="font-semibold text-brand-400">{unit.code}</li>
            </ol>
          </nav>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <UnitStatusBadge status={unit.status} locale={locale} />
                <span className={cn('rounded-full px-3 py-0.5 text-[12px] font-semibold', cover ? 'bg-white/10 text-white ring-1 ring-white/20' : 'bg-surface-muted text-slate-600')}>
                  {typeLabel}
                </span>
              </div>
              <h1 className={cn('mt-3 font-heading text-[34px] font-bold leading-tight sm:text-[42px]', cover ? 'text-white' : 'text-slate-900')}>
                {m.title(unit.code)}
              </h1>
              {locationParts.length > 0 && (
                <p className={cn('mt-2 inline-flex items-center gap-1.5 text-[14px]', cover ? 'text-white/80' : 'text-slate-500')}>
                  <MapPin className="h-4 w-4 text-brand-400" />
                  {locationParts.join(' · ')}
                </p>
              )}
            </div>
            <div className="flex flex-col items-start gap-4 lg:items-end">
              <div className={cn('lg:text-end', cover ? 'text-white' : 'text-slate-900')}>
                <p className={cn('text-[12.5px] font-semibold', cover ? 'text-white/70' : 'text-slate-500')}>{m.coverPriceLabel}</p>
                <p className="num mt-1 text-[36px] font-semibold leading-none text-brand-400" dir="ltr">
                  {formatCurrency(unit.price, currency, locale)}
                </p>
              </div>
              {isAdmin && (
                <Link href={`/dashboard/units/${id}/edit` as never}>
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<Pencil className="h-4 w-4" />}
                    className={cn(cover && 'border-white/30 bg-black/20 text-white backdrop-blur hover:bg-black/30')}
                  >
                    {m.editBtn}
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Facts ──────────────────────────────────────────────────────── */}
      <div data-testid="unit-facts" className="grid grid-cols-2 overflow-hidden rounded-[22px] border border-hairline bg-surface lg:grid-cols-4">
        {facts.map((f, i) => (
          <div
            key={f.label}
            className={cn(
              'flex items-center gap-4 p-5',
              i > 0 && 'lg:border-s lg:border-hairline',
              i % 2 === 1 && 'max-lg:border-s max-lg:border-hairline',
              i >= 2 && 'max-lg:border-t max-lg:border-hairline',
            )}
          >
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-500/12 text-brand-700 [&_svg]:h-5 [&_svg]:w-5">
              {f.icon}
            </span>
            <div>
              <p className="num text-[30px] font-semibold leading-none text-slate-900">
                {f.value}
                {f.suffix && <span className="ms-1 font-sans text-[14px] font-medium text-slate-500">{f.suffix}</span>}
              </p>
              <p className="mt-1 text-[12.5px] font-semibold text-slate-500">{f.label}</p>
            </div>
          </div>
        ))}
      </div>

      <PremiumDetailLayout
        main={
          <>
            {/* Specifications */}
            <PremiumPanel title={m.specsTitle}>
              <div className="overflow-hidden rounded-2xl border border-hairline">
              <dl className={cn('-mb-px -me-px grid grid-cols-1 sm:grid-cols-2', specs.length >= 3 && 'lg:grid-cols-3')}>
                {specs.map(([label, value]) => (
                  <div key={label} className="border-b border-e border-hairline px-5 py-4">
                    <dt className="text-[11.5px] font-semibold text-slate-500">{label}</dt>
                    <dd className="mt-1.5 text-[15px] font-bold text-slate-900">{value}</dd>
                  </div>
                ))}
              </dl>
              </div>
            </PremiumPanel>

            {/* Reservation */}
            <PremiumPanel
              title={m.reservationTitle}
              trailing={<UnitStatusBadge status={unit.status} locale={locale} />}
            >
              {activeReservation ? (
                <div data-testid="unit-active-reservation" className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/15 text-amber-600">
                        <BookmarkCheck className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="text-[14px] font-bold text-slate-900">{m.activeReservationTitle}</p>
                        <p className="font-mono text-[12.5px] text-slate-500">
                          {activeReservation.reservationNumber ?? `#${activeReservation.id.slice(0, 8).toUpperCase()}`}
                        </p>
                      </div>
                      <ReservationStatusBadge status={activeReservation.status} locale={locale} />
                    </div>
                    <Link
                      href={`/dashboard/reservations/${activeReservation.id}` as never}
                      className="inline-flex items-center gap-1 text-[13px] font-bold text-brand-700 hover:text-brand-600"
                    >
                      {m.reservationDetailsLink}
                      <ArrowLeft className="h-3.5 w-3.5 ltr:rotate-180" />
                    </Link>
                  </div>
                  <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Mini icon={<UserIcon />} label={m.fieldClient}>
                      {activeReservation.client?.fullName ?? activeReservation.lead?.fullName ?? '—'}
                    </Mini>
                    <Mini icon={<UserCog />} label={m.fieldSales}>
                      {activeReservation.sales?.fullName ?? '—'}
                    </Mini>
                    <Mini icon={<CalendarClock />} label={m.fieldExpiresAt}>
                      {formatDate(activeReservation.expiresAt, locale)}
                    </Mini>
                  </dl>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-hairline bg-surface-muted/40 p-5">
                  <span
                    className={cn(
                      'inline-flex h-10 w-10 items-center justify-center rounded-full',
                      unit.status === 'AVAILABLE' ? 'bg-emerald-500/12 text-emerald-600' : 'bg-amber-500/12 text-amber-600',
                    )}
                  >
                    <Bookmark className="h-5 w-5" />
                  </span>
                  <p className="min-w-0 flex-1 text-[13.5px] text-slate-600">
                    {unit.status === 'AVAILABLE' ? m.noActiveReservation : m.statusLabels[unit.status] ?? unit.status}
                  </p>
                  <span className="text-[12px] text-slate-500 tabular-nums">
                    {m.statLastUpdated}: {formatDate(unit.updatedAt, locale)}
                  </span>
                </div>
              )}

              {pastReservations.length > 0 && (
                <div className="mt-5">
                  <p className="mb-2 text-[12.5px] font-semibold text-slate-500">
                    {m.reservationHistoryTitle} · <span className="tabular-nums">{pastReservations.length}</span>
                  </p>
                  <ul className="divide-y divide-hairline overflow-hidden rounded-2xl border border-hairline">
                    {pastReservations.map((r) => (
                      <li key={r.id}>
                        <Link
                          href={`/dashboard/reservations/${r.id}` as never}
                          className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-surface-muted/40"
                        >
                          <span className="shrink-0 font-mono text-[12px] text-slate-500">
                            {r.reservationNumber ?? `#${r.id.slice(0, 8).toUpperCase()}`}
                          </span>
                          <p className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-slate-900">
                            {r.client?.fullName ?? r.lead?.fullName ?? '—'}
                          </p>
                          <ReservationStatusBadge status={r.status} locale={locale} />
                          <span className="hidden text-[12px] text-slate-500 tabular-nums sm:inline">
                            {formatDate(r.createdAt, locale)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </PremiumPanel>

            {/* Maintenance / warranty items (ADMIN-only API) */}
            {isAdmin && <MaintenanceItemsCard unitId={id} locale={locale} />}

            {/* Activity */}
            <PremiumPanel
              title={m.activityTitle}
              trailing={
                history.length > 0 ? (
                  <span className="rounded-full bg-surface-muted px-2.5 py-0.5 text-[12px] font-semibold text-slate-600 tabular-nums">
                    {history.length}
                  </span>
                ) : undefined
              }
            >
              {history.length === 0 ? (
                <PremiumEmptyNote>
                  <span className="block font-semibold text-slate-700">{m.activityEmpty}</span>
                  {m.activityEmptyDesc}
                </PremiumEmptyNote>
              ) : (
                <ol className="relative ms-4 space-y-5 border-s-2 border-hairline ps-6">
                  {history.map((h) => (
                    <HistoryItem
                      key={h.id}
                      entry={h}
                      statusLabels={m.statusLabels}
                      historyChangeFrom={m.historyChangeFrom}
                      historyChangedBy={m.historyChangedBy}
                      locale={locale}
                    />
                  ))}
                </ol>
              )}
            </PremiumPanel>
          </>
        }
        side={
          <>
            {/* Location */}
            <PremiumPanel title={m.projectTitle} padding="none">
              <div data-testid="unit-location" className="divide-y divide-hairline border-t border-hairline">
                {project && (
                  <Link
                    href={`/dashboard/projects/${project.id}` as never}
                    className="group flex items-center gap-3.5 px-6 py-4 transition-colors hover:bg-surface-muted/50"
                  >
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-500/12 text-brand-700">
                      <Building2 className="h-[18px] w-[18px]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11.5px] text-slate-500">{m.fieldProject}</p>
                      <p className="truncate text-[14.5px] font-bold text-slate-900">{projectName}</p>
                    </div>
                    <ArrowLeft className="h-4 w-4 text-slate-400 transition-colors group-hover:text-brand-600 ltr:rotate-180" />
                  </Link>
                )}
                <div className="grid grid-cols-2">
                  <SideFact label={m.fieldPhase}>{phaseName}</SideFact>
                  <SideFact label={m.fieldBuilding} start>{buildingName ? m.buildingLabel(buildingName) : '—'}</SideFact>
                </div>
                <div className="grid grid-cols-2">
                  <SideFact label={m.fieldCity}>{city || '—'}</SideFact>
                  <SideFact label={m.statLastUpdated} start>{formatDate(unit.updatedAt, locale)}</SideFact>
                </div>
                <Link
                  href={`/dashboard/reservations?unitId=${id}` as never}
                  className="group flex items-center justify-between gap-3 px-6 py-3.5 text-[13px] font-bold text-brand-700 hover:text-brand-600"
                >
                  {m.cmdReservations}
                  <ArrowLeft className="h-4 w-4 ltr:rotate-180" />
                </Link>
              </div>
            </PremiumPanel>

            <UnitMediaPanel unit={unit} locale={locale} />

            {isAdmin && (
              <PremiumPanel title={m.dangerTitle} className="border-danger-500/25">
                <p className="mb-4 text-[12.5px] leading-relaxed text-slate-500">{m.dangerDesc}</p>
                <ConfirmButton
                  label={m.deleteBtn}
                  confirm={m.deleteConfirm}
                  action={deleteUnitAction.bind(null, id)}
                />
              </PremiumPanel>
            )}
          </>
        }
      />
    </div>
  );
}

// ── Local helpers ─────────────────────────────────────────────────────────────

function Mini({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-surface/60 px-3.5 py-3">
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-slate-500 [&_svg]:h-3.5 [&_svg]:w-3.5">
        {icon}
      </span>
      <div className="min-w-0">
        <dt className="text-[11.5px] text-slate-500">{label}</dt>
        <dd className="truncate text-[13.5px] font-semibold text-slate-900">{children}</dd>
      </div>
    </div>
  );
}

function SideFact({ label, children, start }: { label: string; children: React.ReactNode; start?: boolean }) {
  return (
    <div className={cn('px-6 py-3.5', start && 'border-s border-hairline')}>
      <p className="text-[11.5px] text-slate-500">{label}</p>
      <p className="mt-0.5 truncate text-[13.5px] font-semibold text-slate-900">{children}</p>
    </div>
  );
}

function HistoryItem({
  entry,
  statusLabels,
  historyChangeFrom,
  historyChangedBy,
  locale = 'ar',
}: {
  entry: UnitStatusHistoryEntry;
  statusLabels: Record<string, string>;
  historyChangeFrom: string;
  historyChangedBy: string;
  locale?: Locale;
}) {
  const tone =
    entry.newStatus === 'SOLD'
      ? 'success'
      : entry.newStatus === 'RESERVED'
        ? 'warning'
        : 'brand';
  const dotClass: Record<typeof tone, string> = {
    success: 'bg-success-100 text-success-700 ring-success-200',
    warning: 'bg-warning-100 text-warning-700 ring-warning-200',
    brand: 'bg-brand-100 text-brand-700 ring-brand-200',
  };
  return (
    <li className="relative">
      <span
        className={`absolute -start-[33px] top-1 inline-flex h-7 w-7 items-center justify-center rounded-full ring-2 ${dotClass[tone]}`}
      >
        <ArrowRightLeft className="h-3.5 w-3.5" />
      </span>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm text-slate-900">
            {historyChangeFrom}{' '}
            <Badge tone="gray" variant="soft" size="sm">
              {statusLabels[entry.oldStatus] ?? entry.oldStatus}
            </Badge>{' '}
            <ArrowRight className="inline h-3 w-3 text-slate-400 mx-1 rtl:rotate-180" />{' '}
            <span className="font-semibold text-slate-900">
              <UnitStatusBadge status={entry.newStatus} />
            </span>
          </p>
          {entry.reason && (
            <p className="mt-1 text-xs text-slate-500">{entry.reason}</p>
          )}
          {entry.changedBy?.fullName && (
            <p className="mt-1 text-2xs text-slate-500">
              {historyChangedBy}{' '}
              <span className="font-medium text-slate-700">{entry.changedBy.fullName}</span>
            </p>
          )}
        </div>
        <time className="shrink-0 text-2xs text-slate-500 tabular-nums">
          {formatDateTime(entry.changedAt, locale)}
        </time>
      </div>
    </li>
  );
}
