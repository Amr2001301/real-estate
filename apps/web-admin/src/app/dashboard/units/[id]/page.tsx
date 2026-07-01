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
import type {
  Paged,
  Reservation,
  Unit,
  UnitStatus,
  UnitStatusHistoryEntry,
} from '@/lib/types';
import { tx, formatCurrency, formatDate, formatDateTime } from '@/lib/format';
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

const STATUS_LABEL: Record<UnitStatus, string> = {
  AVAILABLE: 'متاحة',
  RESERVED: 'محجوزة',
  SOLD: 'مباعة',
};

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
  const [unitRes, reservationsRes] = await Promise.all([
    safe(api.get<Unit>(`/units/${id}`)),
    safe(api.get<Paged<Reservation>>(`/reservations?unitId=${id}&pageSize=20`)),
  ]);

  if (unitRes.error || !unitRes.data) {
    return (
      <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-6 text-sm">
        تعذر تحميل الوحدة: {unitRes.error ?? 'غير موجودة'}
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
  const cover = unit.media?.find((m) => m.type === 'IMAGE')?.url;
  const history = unit.history ?? [];
  const reservations = reservationsRes.data?.data ?? [];
  const activeReservation = reservations.find(
    (r) => r.status === 'PENDING' || r.status === 'APPROVED',
  );
  const pastReservations = reservations.filter((r) => r.id !== activeReservation?.id);

  const locationParts = [
    projectName !== '—' ? projectName : null,
    phaseName !== '—' ? phaseName : null,
    buildingName ? `مبنى ${buildingName}` : null,
    city || null,
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-5">
      <PremiumPageHero
        title={`الوحدة ${unit.code}`}
        description={locationParts.join(' · ') || undefined}
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'الوحدات', href: '/dashboard/units' },
          { label: unit.code },
        ]}
        meta={
          <>
            <UnitStatusBadge status={unit.status} />
            <Badge tone="gray" variant="soft">{unit.type}</Badge>
            <span className="text-sm font-semibold text-navy tabular-nums">
              {formatCurrency(unit.price)}
            </span>
          </>
        }
        actions={
          isAdmin ? (
            <Link href={`/dashboard/units/${id}/edit` as never}>
              <Button variant="outline" size="md" leftIcon={<Pencil className="h-4 w-4" />}>
                تعديل الوحدة
              </Button>
            </Link>
          ) : undefined
        }
      />

      {/* Media / price band */}
      <div className="bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden">
        <div className="relative grid grid-cols-1 lg:grid-cols-[1.5fr_1fr]">
          {/* Image / placeholder */}
          <div className="relative h-48 sm:h-56 lg:h-64 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 lg:rounded-s-[19px] overflow-hidden">
            {cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cover}
                alt={unit.code}
                className="absolute inset-0 h-full w-full object-cover opacity-90"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                <Building2 className="h-12 w-12 opacity-40" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/10 to-transparent" />
            <div className="absolute bottom-4 start-4 end-4 flex items-end justify-between gap-3">
              <div>
                <p className="text-xs text-white/70">السعر الإجمالي</p>
                <p className="mt-0.5 text-2xl sm:text-3xl font-bold text-white tabular-nums">
                  {formatCurrency(unit.price)}
                </p>
              </div>
              <UnitStatusBadge status={unit.status} />
            </div>
          </div>
          {/* Quick stats */}
          <div className="grid grid-cols-2 gap-px bg-hairline">
            <QuickStat
              label="المساحة"
              value={`${unit.area} م²`}
              icon={<Ruler className="h-4 w-4" />}
            />
            <QuickStat
              label="الغرف"
              value={unit.bedrooms}
              icon={<BedDouble className="h-4 w-4" />}
            />
            <QuickStat
              label="دورات المياه"
              value={unit.bathrooms}
              icon={<Bath className="h-4 w-4" />}
            />
            <QuickStat
              label="الطابق"
              value={unit.floor === 0 ? 'أرضي' : unit.floor}
              icon={<Layers className="h-4 w-4" />}
            />
          </div>
        </div>
      </div>

      <PremiumDetailLayout
        main={
          <>
            {/* Specifications */}
            <PremiumSectionCard title="المواصفات الفنية">
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
                <KV label="كود الوحدة" value={<span className="font-mono">{unit.code}</span>} />
                <KV label="النوع" value={unit.type} />
                <KV label="الطابق" value={unit.floor === 0 ? 'أرضي' : unit.floor} />
                <KV label="المساحة" value={`${unit.area} م²`} />
                <KV label="الغرف" value={unit.bedrooms} />
                <KV label="دورات المياه" value={unit.bathrooms} />
              </dl>
            </PremiumSectionCard>

            {/* Project / Location */}
            <PremiumSectionCard title="بيانات المشروع" icon={<Building2 />}>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                <KV
                  label="المشروع"
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
                <KV label="المرحلة" value={phaseName} />
                <KV label="المبنى" value={buildingName ? `مبنى ${buildingName}` : '—'} />
                <KV
                  label="المدينة"
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
            <PremiumSectionCard title="حالة الحجز">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Stat
                  icon={<Bookmark className="h-4 w-4" />}
                  label="الحالة الحالية"
                  value={<UnitStatusBadge status={unit.status} />}
                />
                <Stat
                  icon={<CalendarClock className="h-4 w-4" />}
                  label="انتهاء الحجز"
                  value={
                    unit.reservationExpiresAt
                      ? formatDate(unit.reservationExpiresAt)
                      : '—'
                  }
                />
                <Stat
                  icon={<History className="h-4 w-4" />}
                  label="آخر تحديث"
                  value={formatDate(unit.updatedAt)}
                />
              </div>

              {activeReservation ? (
                <div className="mt-5 rounded-2xl border border-warning-100 bg-warning-50/40 p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                    <div className="flex items-center gap-2">
                      <BookmarkCheck className="h-5 w-5 text-warning-600" />
                      <h3 className="text-sm font-semibold text-slate-900">الحجز النشط</h3>
                      <ReservationStatusBadge status={activeReservation.status} />
                    </div>
                    <Link
                      href={`/dashboard/reservations/${activeReservation.id}` as never}
                      className="text-xs font-semibold text-brand-700 hover:text-brand-800 inline-flex items-center gap-1"
                    >
                      تفاصيل الحجز
                      <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
                    </Link>
                  </div>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    <KV
                      label="رقم الحجز"
                      value={
                        <span className="font-mono">
                          {activeReservation.reservationNumber ??
                            `#${activeReservation.id.slice(0, 8).toUpperCase()}`}
                        </span>
                      }
                    />
                    <KV
                      label="العميل"
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
                      label="المندوب المسؤول"
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
                      label="ينتهي في"
                      value={formatDate(activeReservation.expiresAt)}
                    />
                  </dl>
                </div>
              ) : (
                unit.status === 'AVAILABLE' && (
                  <p className="mt-4 text-xs text-slate-500">
                    لا توجد حجوزات نشطة لهذه الوحدة حالياً. الوحدة جاهزة للعرض والبيع الفوري.
                  </p>
                )
              )}
            </PremiumSectionCard>

            {/* Reservation history */}
            {pastReservations.length > 0 && (
              <PremiumSectionCard
                title="سجل الحجوزات"
                trailing={
                  <span className="text-xs text-slate-400 tabular-nums">
                    {pastReservations.length} حجز
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
            {isAdmin && <MaintenanceItemsCard unitId={id} />}

            {/* Activity / history timeline */}
            <PremiumSectionCard
              title="سجل النشاط"
              trailing={
                history.length > 0 ? (
                  <span className="text-xs text-slate-400 tabular-nums">
                    {history.length} نشاط
                  </span>
                ) : undefined
              }
            >
              {history.length === 0 ? (
                <PremiumEmptyState
                  icon={<History />}
                  title="لا توجد أحداث بعد"
                  description="ستظهر هنا تغييرات الحالة وعمليات الحجز للوحدة."
                />
              ) : (
                <ol className="relative ms-4 border-s-2 border-hairline ps-6 space-y-5">
                  {history.map((h) => (
                    <HistoryItem key={h.id} entry={h} />
                  ))}
                </ol>
              )}
            </PremiumSectionCard>
          </>
        }
        side={
          <>
            <PremiumCommandPanel title="إجراءات سريعة">
                {isAdmin && (
                  <Link href={`/dashboard/units/${id}/edit` as never} className={CMD_LINK}>
                    <span className={CMD_ICON}><Pencil /></span>
                    <span>تعديل الوحدة</span>
                  </Link>
                )}
                <Link href="/dashboard/units" className={CMD_LINK}>
                  <span className={CMD_ICON}><ArrowLeft /></span>
                  <span>قائمة الوحدات</span>
                </Link>
                {unit.building?.phase?.project && (
                  <Link
                    href={`/dashboard/projects/${unit.building.phase.project.id}` as never}
                    className={CMD_LINK}
                  >
                    <span className={CMD_ICON}><Building2 /></span>
                    <span>عرض المشروع</span>
                  </Link>
                )}
                <Link
                  href={`/dashboard/reservations?unitId=${id}` as never}
                  className={CMD_LINK}
                >
                  <span className={CMD_ICON}><Bookmark /></span>
                  <span>حجوزات الوحدة</span>
                </Link>
              </PremiumCommandPanel>

            <UnitMediaPanel unit={unit} />

            {isAdmin && (
              <PremiumSectionCard title="منطقة الخطر" tone="danger">
                <div className="space-y-3">
                  <p className="text-xs text-slate-500">
                    حذف الوحدة سيؤدي إلى إزالتها نهائياً. لا يمكن التراجع.
                  </p>
                  <ConfirmButton
                    label="حذف الوحدة"
                    confirm="هل أنت متأكد من حذف هذه الوحدة؟"
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
    <div className="min-w-0">
      <dt className="text-2xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-slate-900 truncate">{value}</dd>
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
    <div className="rounded-xl bg-canvas/60 p-3 ring-1 ring-inset ring-hairline">
      <div className="flex items-center gap-1.5 text-2xs font-medium uppercase tracking-wide text-slate-500">
        <span className="text-slate-400">{icon}</span>
        {label}
      </div>
      <div className="mt-1.5 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function QuickStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-surface p-4 sm:p-5">
      <div className="text-2xs font-medium uppercase tracking-wide text-slate-500 inline-flex items-center gap-1.5">
        <span className="text-slate-400">{icon}</span>
        {label}
      </div>
      <p className="mt-1.5 text-lg sm:text-xl font-bold text-slate-900 tabular-nums">{value}</p>
    </div>
  );
}

function HistoryItem({ entry }: { entry: UnitStatusHistoryEntry }) {
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
            تغيير الحالة من{' '}
            <Badge tone="gray" variant="soft" size="sm">
              {STATUS_LABEL[entry.oldStatus]}
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
              بواسطة{' '}
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
