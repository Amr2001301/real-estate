import Link from 'next/link';
import {
  Pencil,
  Ruler,
  BedDouble,
  Bath,
  Layers,
  Building2,
  MapPin,
  History,
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
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import type {
  Paged,
  Reservation,
  Unit,
  UnitStatusHistoryEntry,
} from '@/lib/types';
import { tx, formatCurrency, formatDate, formatDateTime } from '@/lib/format';
import { getReportsCurrency } from '@/lib/currency';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ReservationStatusBadge, UnitStatusBadge } from '@/components/badges';
import { ConfirmButton } from '@/components/confirm-button';
import { UnitMediaPanel } from './media-panel';
import { MaintenanceItemsCard } from './maintenance-items-card';
import { deleteUnitAction } from '../actions';
import {
  PremiumPageHero,
  PremiumDetailLayout,
  PremiumSectionCard,
  PremiumCommandPanel,
  PremiumEmptyState,
} from '@/components/premium';

export const dynamic = 'force-dynamic';

const CMD_LINK =
  'group flex items-center gap-3 px-5 py-3.5 text-sm text-slate-700 hover:bg-canvas/40 transition-colors duration-150';
const CMD_ICON =
  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 [&_svg]:h-[15px] [&_svg]:w-[15px]';

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

  const m = uiT(locale).pages.units.detail;

  if (unitRes.error || !unitRes.data) {
    return (
      <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-6 text-sm">
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

  return (
    <div className="space-y-5">
      <PremiumPageHero
        title={m.title(unit.code)}
        description={locationParts.join(' · ') || undefined}
        breadcrumbs={[
          { label: m.breadcrumbDashboard, href: '/dashboard' },
          { label: m.breadcrumbList, href: '/dashboard/units' },
          { label: unit.code },
        ]}
        meta={
          <>
            <UnitStatusBadge status={unit.status} />
            <Badge tone="gray" variant="soft">{unit.type}</Badge>
            <span className="text-sm font-semibold text-navy tabular-nums">
              {formatCurrency(unit.price, currency)}
            </span>
          </>
        }
        actions={
          isAdmin ? (
            <Link href={`/dashboard/units/${id}/edit` as never}>
              <Button variant="outline" size="md" leftIcon={<Pencil className="h-4 w-4" />}>
                {m.editBtn}
              </Button>
            </Link>
          ) : undefined
        }
      />

      {/* Cover image — only when media exists */}
      {cover && (
        <div className="relative h-48 sm:h-52 overflow-hidden rounded-[20px] border border-hairline shadow-soft">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cover} alt={unit.code} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/55 via-transparent to-transparent" />
          <div className="absolute bottom-4 start-5 end-5 flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] text-white/60">{m.coverPriceLabel}</p>
              <p className="mt-0.5 text-xl font-bold text-white tabular-nums">{formatCurrency(unit.price, currency)}</p>
            </div>
            <UnitStatusBadge status={unit.status} />
          </div>
        </div>
      )}

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: m.metrics.area,      value: `${unit.area} ${m.metrics.areaSuffix}`,                 icon: <Ruler /> },
          { label: m.metrics.bedrooms,  value: unit.bedrooms,                                           icon: <BedDouble /> },
          { label: m.metrics.bathrooms, value: unit.bathrooms,                                          icon: <Bath /> },
          { label: m.metrics.floor,     value: unit.floor === 0 ? m.metrics.groundFloor : unit.floor,  icon: <Layers /> },
        ].map(({ label, value, icon }) => (
          <div key={label} className="relative overflow-hidden rounded-2xl border border-hairline bg-surface shadow-xs">
            <div className="h-[3px] w-full" style={{ background: 'linear-gradient(to left, #b8923e, #e6c46a, #b8923e)' }} />
            <div className="px-5 py-4">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 [&_svg]:h-[15px] [&_svg]:w-[15px]">
                  {icon}
                </span>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.12em] text-end">{label}</p>
              </div>
              <p className="mt-3 text-[26px] font-black tabular-nums leading-none text-slate-900">{value}</p>
            </div>
          </div>
        ))}
      </div>

      <PremiumDetailLayout
        main={
          <>
            {/* Specifications */}
            <PremiumSectionCard title={m.specsTitle} icon={<Ruler />}>
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <KV label={m.fieldCode} value={<span className="font-mono">{unit.code}</span>} />
                <KV label={m.fieldType} value={unit.type} />
                <KV label={m.fieldFloor} value={unit.floor === 0 ? m.metrics.groundFloor : unit.floor} />
                <KV label={m.fieldArea} value={`${unit.area} ${m.metrics.areaSuffix}`} />
                <KV label={m.fieldBedrooms} value={unit.bedrooms} />
                <KV label={m.fieldBathrooms} value={unit.bathrooms} />
              </dl>
            </PremiumSectionCard>

            {/* Project / Location */}
            <PremiumSectionCard title={m.projectTitle} icon={<Building2 />}>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                <KV
                  label={m.fieldProject}
                  value={
                    unit.building?.phase?.project ? (
                      <Link
                        href={`/dashboard/projects/${unit.building.phase.project.id}` as never}
                        className="text-brand-700 hover:text-brand-800 font-medium"
                      >
                        {projectName}
                      </Link>
                    ) : (
                      projectName
                    )
                  }
                />
                <KV label={m.fieldPhase} value={phaseName} />
                <KV label={m.fieldBuilding} value={buildingName ? m.buildingLabel(buildingName) : '—'} />
                <KV
                  label={m.fieldCity}
                  value={
                    city ? (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-slate-400" />
                        {city}
                      </span>
                    ) : (
                      '—'
                    )
                  }
                />
              </dl>
            </PremiumSectionCard>

            {/* Status & reservation */}
            <PremiumSectionCard title={m.reservationTitle}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Stat
                  icon={<Bookmark className="h-4 w-4" />}
                  label={m.statCurrentStatus}
                  value={<UnitStatusBadge status={unit.status} />}
                />
                <Stat
                  icon={<CalendarClock className="h-4 w-4" />}
                  label={m.statExpiresAt}
                  value={
                    unit.reservationExpiresAt
                      ? formatDate(unit.reservationExpiresAt)
                      : '—'
                  }
                />
                <Stat
                  icon={<History className="h-4 w-4" />}
                  label={m.statLastUpdated}
                  value={formatDate(unit.updatedAt)}
                />
              </div>

              {activeReservation ? (
                <div className="mt-5 rounded-2xl border border-warning-100 bg-warning-50/40 p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                    <div className="flex items-center gap-2">
                      <BookmarkCheck className="h-5 w-5 text-warning-600" />
                      <h3 className="text-sm font-semibold text-slate-900">{m.activeReservationTitle}</h3>
                      <ReservationStatusBadge status={activeReservation.status} />
                    </div>
                    <Link
                      href={`/dashboard/reservations/${activeReservation.id}` as never}
                      className="text-xs font-semibold text-brand-700 hover:text-brand-800 inline-flex items-center gap-1"
                    >
                      {m.reservationDetailsLink}
                      <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
                    </Link>
                  </div>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    <KV
                      label={m.fieldReservationNumber}
                      value={
                        <span className="font-mono">
                          {activeReservation.reservationNumber ??
                            `#${activeReservation.id.slice(0, 8).toUpperCase()}`}
                        </span>
                      }
                    />
                    <KV
                      label={m.fieldClient}
                      value={
                        <span className="inline-flex items-center gap-1.5">
                          <UserIcon className="h-3.5 w-3.5 text-slate-400" />
                          {activeReservation.client?.fullName ??
                            activeReservation.lead?.fullName ??
                            '—'}
                        </span>
                      }
                    />
                    <KV
                      label={m.fieldSales}
                      value={
                        activeReservation.sales?.fullName ? (
                          <span className="inline-flex items-center gap-1.5">
                            <UserCog className="h-3.5 w-3.5 text-slate-400" />
                            {activeReservation.sales.fullName}
                          </span>
                        ) : (
                          '—'
                        )
                      }
                    />
                    <KV
                      label={m.fieldExpiresAt}
                      value={formatDate(activeReservation.expiresAt)}
                    />
                  </dl>
                </div>
              ) : (
                unit.status === 'AVAILABLE' && (
                  <p className="mt-4 text-xs text-slate-500">
                    {m.noActiveReservation}
                  </p>
                )
              )}
            </PremiumSectionCard>

            {/* Reservation history */}
            {pastReservations.length > 0 && (
              <PremiumSectionCard
                title={m.reservationHistoryTitle}
                trailing={
                  <span className="text-xs text-slate-400 tabular-nums">
                    {pastReservations.length} {m.reservationSuffix}
                  </span>
                }
                padded={false}
              >
                <ul className="flex flex-col divide-y divide-hairline">
                  {pastReservations.map((r) => (
                    <li key={r.id}>
                      <Link
                        href={`/dashboard/reservations/${r.id}` as never}
                        className="flex items-center gap-3 px-5 py-3.5 hover:bg-canvas/40 transition-colors duration-100"
                      >
                        <span className="font-mono text-2xs text-slate-400 shrink-0">
                          {r.reservationNumber ?? `#${r.id.slice(0, 8).toUpperCase()}`}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-slate-900 truncate">
                              {r.client?.fullName ?? r.lead?.fullName ?? '—'}
                            </p>
                            <ReservationStatusBadge status={r.status} />
                          </div>
                          <p className="text-2xs text-slate-500 mt-0.5">
                            {formatDateTime(r.createdAt)}
                          </p>
                        </div>
                        <ArrowLeft className="h-4 w-4 text-slate-300 rtl:rotate-180" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </PremiumSectionCard>
            )}

            {/* Maintenance / warranty items (ADMIN-only API) */}
            {isAdmin && <MaintenanceItemsCard unitId={id} locale={locale} />}

            {/* Activity / history timeline */}
            <PremiumSectionCard
              title={m.activityTitle}
              trailing={
                history.length > 0 ? (
                  <span className="text-xs text-slate-400 tabular-nums">
                    {history.length} {m.activitySuffix}
                  </span>
                ) : undefined
              }
            >
              {history.length === 0 ? (
                <PremiumEmptyState
                  icon={<History />}
                  title={m.activityEmpty}
                  description={m.activityEmptyDesc}
                />
              ) : (
                <ol className="relative ms-4 border-s-2 border-hairline ps-6 space-y-5">
                  {history.map((h) => (
                    <HistoryItem
                      key={h.id}
                      entry={h}
                      statusLabels={m.statusLabels}
                      historyChangeFrom={m.historyChangeFrom}
                      historyChangedBy={m.historyChangedBy}
                    />
                  ))}
                </ol>
              )}
            </PremiumSectionCard>
          </>
        }
        side={
          <>
            <PremiumCommandPanel title={m.cmdTitle}>
                {isAdmin && (
                  <Link href={`/dashboard/units/${id}/edit` as never} className={CMD_LINK}>
                    <span className={CMD_ICON}><Pencil /></span>
                    <span>{m.cmdEdit}</span>
                  </Link>
                )}
                <Link href="/dashboard/units" className={CMD_LINK}>
                  <span className={CMD_ICON}><ArrowLeft /></span>
                  <span>{m.cmdList}</span>
                </Link>
                {unit.building?.phase?.project && (
                  <Link
                    href={`/dashboard/projects/${unit.building.phase.project.id}` as never}
                    className={CMD_LINK}
                  >
                    <span className={CMD_ICON}><Building2 /></span>
                    <span>{m.cmdProject}</span>
                  </Link>
                )}
                <Link
                  href={`/dashboard/reservations?unitId=${id}` as never}
                  className={CMD_LINK}
                >
                  <span className={CMD_ICON}><Bookmark /></span>
                  <span>{m.cmdReservations}</span>
                </Link>
              </PremiumCommandPanel>

            <UnitMediaPanel unit={unit} locale={locale} />

            {isAdmin && (
              <PremiumSectionCard title={m.dangerTitle} tone="danger">
                <div className="space-y-3">
                  <p className="text-xs text-slate-500">
                    {m.dangerDesc}
                  </p>
                  <ConfirmButton
                    label={m.deleteBtn}
                    confirm={m.deleteConfirm}
                    action={deleteUnitAction.bind(null, id)}
                  />
                </div>
              </PremiumSectionCard>
            )}
          </>
        }
      />
    </div>
  );
}

// ── Local helpers ─────────────────────────────────────────────────────────────

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl bg-canvas/50 px-4 py-3.5 ring-1 ring-inset ring-hairline">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 leading-none">
        {label}
      </dt>
      <dd className="mt-2 text-[15px] font-bold text-slate-900">{value}</dd>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-canvas/50 p-4 ring-1 ring-inset ring-hairline">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-500 [&_svg]:h-[15px] [&_svg]:w-[15px]">
        {icon}
      </span>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 leading-none">
          {label}
        </p>
        <div className="mt-1.5 text-sm font-semibold text-slate-900">{value}</div>
      </div>
    </div>
  );
}

function HistoryItem({
  entry,
  statusLabels,
  historyChangeFrom,
  historyChangedBy,
}: {
  entry: UnitStatusHistoryEntry;
  statusLabels: Record<string, string>;
  historyChangeFrom: string;
  historyChangedBy: string;
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
          {formatDateTime(entry.changedAt)}
        </time>
      </div>
    </li>
  );
}
