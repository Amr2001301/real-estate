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
  ArrowRightLeft,
  ArrowRight,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Unit, UnitStatus, UnitStatusHistoryEntry } from '@/lib/types';
import { tx, formatCurrency, formatDate, formatDateTime } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { UnitStatusBadge } from '@/components/badges';
import { ConfirmButton } from '@/components/confirm-button';
import { UnitMediaPanel } from './media-panel';
import { deleteUnitAction } from '../actions';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<UnitStatus, string> = {
  AVAILABLE: 'متاحة',
  RESERVED: 'محجوزة',
  SOLD: 'مباعة',
};

export default async function UnitDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const unitRes = await safe(api.get<Unit>(`/units/${id}`));

  if (unitRes.error || !unitRes.data) {
    return (
      <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-6 text-sm">
        تعذر تحميل الوحدة: {unitRes.error ?? 'غير موجودة'}
      </div>
    );
  }

  const unit = unitRes.data;
  const projectName = tx(unit.building?.phase?.project?.name);
  const phaseName = tx(unit.building?.phase?.name);
  const buildingName = unit.building?.name;
  const city = unit.building?.phase?.project?.city;
  const cover = unit.media?.find((m) => m.type === 'IMAGE')?.url;
  const history = unit.history ?? [];

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        title={`الوحدة ${unit.code}`}
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'الوحدات', href: '/dashboard/units' },
          { label: unit.code },
        ]}
        meta={
          <>
            <UnitStatusBadge status={unit.status} />
            <Badge tone="gray" variant="soft">
              {unit.type}
            </Badge>
            {projectName !== '—' && (
              <span className="text-sm text-slate-500 inline-flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                {projectName}
                {phaseName !== '—' && ` · ${phaseName}`}
                {buildingName && ` · مبنى ${buildingName}`}
              </span>
            )}
          </>
        }
        actions={
          <>
            <Link href={`/dashboard/units/${id}/edit` as never}>
              <Button
                variant="outline"
                size="md"
                leftIcon={<Pencil className="h-4 w-4" />}
              >
                تعديل الوحدة
              </Button>
            </Link>
          </>
        }
      />

      {/* Hero / price band */}
      <Card className="overflow-hidden">
        <div className="relative grid grid-cols-1 lg:grid-cols-[1.5fr_1fr]">
          {/* Image / placeholder */}
          <div className="relative h-48 sm:h-56 lg:h-64 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 lg:rounded-s-2xl overflow-hidden">
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
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          {/* Specifications */}
          <Card className="p-5 sm:p-6">
            <SectionTitle title="المواصفات الفنية" accent="brand" />
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4 mt-4">
              <KV label="كود الوحدة" value={<span className="font-mono">{unit.code}</span>} />
              <KV label="النوع" value={unit.type} />
              <KV label="الطابق" value={unit.floor === 0 ? 'أرضي' : unit.floor} />
              <KV label="المساحة" value={`${unit.area} م²`} />
              <KV label="الغرف" value={unit.bedrooms} />
              <KV label="دورات المياه" value={unit.bathrooms} />
            </dl>
          </Card>

          {/* Project / Location */}
          <Card className="p-5 sm:p-6">
            <SectionTitle title="بيانات المشروع" accent="info" />
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 mt-4">
              <KV
                label="المشروع"
                value={
                  unit.building?.phase?.project ? (
                    <Link
                      href={
                        `/dashboard/projects/${unit.building.phase.project.id}` as never
                      }
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
          </Card>

          {/* Status & reservation */}
          <Card className="p-5 sm:p-6">
            <SectionTitle title="حالة الحجز" accent="warning" />
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
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
            {unit.status === 'AVAILABLE' && (
              <p className="mt-4 text-xs text-slate-500">
                لا توجد حجوزات نشطة لهذه الوحدة حالياً. الوحدة جاهزة للعرض والبيع الفوري.
              </p>
            )}
          </Card>

          {/* Activity / history timeline */}
          <Card className="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <SectionTitle title="سجل النشاط" accent="accent" />
              {history.length > 0 && (
                <span className="text-2xs font-semibold text-slate-500">
                  {history.length} نشاط
                </span>
              )}
            </div>
            <div className="mt-4">
              {history.length === 0 ? (
                <EmptyState
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
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <UnitMediaPanel unit={unit} />

          <Card className="p-5">
            <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
              منطقة الخطر
            </h3>
            <p className="mt-2 text-xs text-slate-500">
              حذف الوحدة سيؤدي إلى إزالتها نهائياً. لا يمكن التراجع.
            </p>
            <div className="mt-4">
              <ConfirmButton
                label="حذف الوحدة"
                confirm="هل أنت متأكد من حذف هذه الوحدة؟"
                action={deleteUnitAction.bind(null, id)}
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({
  title,
  accent,
}: {
  title: string;
  accent: 'brand' | 'info' | 'warning' | 'accent';
}) {
  const color: Record<typeof accent, string> = {
    brand: 'bg-brand-500',
    info: 'bg-info-500',
    warning: 'bg-warning-500',
    accent: 'bg-accent-500',
  };
  return (
    <div className="flex items-center gap-2">
      <span className={`h-5 w-1 rounded-full ${color[accent]}`} />
      <h2 className="text-base font-semibold text-slate-900 tracking-tight">
        {title}
      </h2>
    </div>
  );
}

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-2xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </dt>
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
    <div className="rounded-xl bg-surface-muted/60 p-3 ring-1 ring-inset ring-hairline">
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
      <p className="mt-1.5 text-lg sm:text-xl font-bold text-slate-900 tabular-nums">
        {value}
      </p>
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
              بواسطة <span className="font-medium text-slate-700">{entry.changedBy.fullName}</span>
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
