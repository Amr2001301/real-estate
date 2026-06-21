import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Phone,
  Mail,
  Building2,
  BadgePercent,
  CalendarRange,
  CalendarX2,
  UserCog,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { PortalReservation, ReservationActivityType } from '@/lib/types';
import { tx, formatDate, formatDateTime, formatCurrency } from '@/lib/format';
import { cn } from '@/lib/cn';
import { PremiumPageHero } from '@/components/premium';
import { CodeText } from '@/components/ui/code-text';
import { ReservationStatusBadge } from '@/components/badges';
import {
  DetailHero,
  DetailHeroCol,
  HeroColLabel,
  HeroDateRow,
  avatarColor,
  initials,
  type DetailHeroStatus,
} from '@/components/portal/detail-hero';
import { MetricGrid, MetricTile } from '@/components/portal/metric-grid';
import { DetailSection } from '@/components/portal/detail-section';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const ACTIVITY_LABEL: Record<ReservationActivityType, string> = {
  CREATED: 'تم إنشاء الحجز',
  APPROVED: 'تمت الموافقة على الحجز',
  REJECTED: 'تم رفض الحجز',
  CANCELLED: 'تم إلغاء الحجز',
  EXPIRED: 'انتهت صلاحية الحجز',
  NOTE_ADDED: 'إضافة ملاحظة',
  BOOKING_PAYMENT_CONFIRMED: 'تأكيد دفع مبلغ الحجز',
  BOOKING_PAYMENT_UNCONFIRMED: 'إلغاء تأكيد دفع الحجز',
  CONVERTED: 'تحويل إلى عقد',
};

export default async function PortalReservationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const r = await safe(api.get<PortalReservation>(`/portal/reservations/${id}`));
  if (r.error || !r.data) notFound();
  const res = r.data;
  const project = res.unit?.building?.phase.project;

  const clientName  = res.lead?.fullName ?? res.client?.fullName ?? '';
  const clientPhone = res.lead?.phone    ?? res.client?.phone    ?? null;
  const clientEmail = res.lead?.email    ?? res.client?.email    ?? null;

  const isExpired =
    res.expiresAt != null &&
    new Date(res.expiresAt) < new Date() &&
    res.status !== 'CONVERTED' &&
    res.status !== 'CANCELLED' &&
    res.status !== 'EXPIRED';

  const hasCommission =
    res.commissionLockedPct !== null && res.commissionLockedPct !== undefined;

  const heroStatus: DetailHeroStatus =
    res.status === 'CONVERTED' || res.status === 'APPROVED' ? 'success' :
    res.status === 'REJECTED' || res.status === 'CANCELLED' || res.status === 'EXPIRED' ? 'danger' :
    'warning';

  return (
    <div className="space-y-5">
      <PremiumPageHero
        title={res.reservationNumber ?? 'حجز'}
        breadcrumbs={[
          { label: 'البوابة', href: '/portal' },
          { label: 'الحجوزات', href: '/portal/reservations' },
          { label: res.reservationNumber ?? id },
        ]}
        meta={
          <>
            <ReservationStatusBadge status={res.status} />
            {project && <span className="text-xs text-slate-500">{tx(project.name)}</span>}
          </>
        }
      />

      {isExpired && (
        <div className="flex items-start gap-3 rounded-2xl bg-amber-50 border border-amber-100 text-amber-800 p-4 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">انتهت مدة الحجز</p>
            <p className="mt-0.5 text-xs leading-relaxed">
              انقضى تاريخ انتهاء صلاحية هذا الحجز. تواصل مع الإدارة لتجديده إن كان العميل لا يزال مهتماً.
            </p>
          </div>
        </div>
      )}

      <DetailHero status={heroStatus}>
        {/* Client */}
        <DetailHeroCol position="first">
          <div className="flex items-start gap-4">
            {clientName && (
              <div className={cn('h-14 w-14 rounded-2xl flex items-center justify-center text-lg font-bold shrink-0', avatarColor(clientName))}>
                {initials(clientName)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <HeroColLabel>العميل</HeroColLabel>
              <p className="text-xl font-bold text-slate-900 leading-snug">{clientName || '—'}</p>
              {clientPhone && (
                <a href={`tel:${clientPhone}`} className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-brand-700 transition-colors" dir="ltr">
                  <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />{clientPhone}
                </a>
              )}
              {clientEmail && (
                <a href={`mailto:${clientEmail}`} className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 hover:text-brand-700 transition-colors" dir="ltr">
                  <Mail className="h-3 w-3 text-slate-400 shrink-0" />
                  <span className="truncate max-w-[200px]">{clientEmail}</span>
                </a>
              )}
              {res.lead && (
                <p className="mt-2 text-2xs text-slate-400">
                  الفرصة:{' '}
                  <Link href={`/portal/leads/${res.lead.id}` as never} className="text-brand-600 hover:underline font-medium">
                    {res.lead.fullName}
                  </Link>
                </p>
              )}
            </div>
          </div>
        </DetailHeroCol>

        {/* Unit / Project */}
        <DetailHeroCol position="middle">
          <HeroColLabel>الوحدة والمشروع</HeroColLabel>
          {project ? (
            <>
              <p className="text-lg font-bold text-slate-900 leading-snug">{tx(project.name)}</p>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                <Building2 className="h-3 w-3 shrink-0" />{project.city}
              </p>
            </>
          ) : (
            <p className="text-slate-400 text-sm">—</p>
          )}
          {res.unit && (
            <div className="mt-4 flex items-end justify-between gap-2">
              <div>
                <CodeText className="text-base font-bold text-slate-800">{res.unit.code}</CodeText>
                <p className="text-xs text-slate-500 mt-0.5"><CodeText>{res.unit.type}</CodeText></p>
              </div>
              <div className="text-end shrink-0">
                <p className="text-2xs text-slate-400">سعر الوحدة</p>
                <p className="text-sm font-bold text-slate-900 tabular-nums mt-0.5">{formatCurrency(res.unit.price)}</p>
              </div>
            </div>
          )}
        </DetailHeroCol>

        {/* Meta */}
        <DetailHeroCol position="last">
          <HeroColLabel>تفاصيل الحجز</HeroColLabel>
          <div className="space-y-2.5">
            {res.sales?.fullName && (
              <HeroDateRow
                label={<span className="flex items-center gap-1.5"><UserCog className="h-3 w-3 text-slate-400" />المندوب</span>}
                value={res.sales.fullName}
              />
            )}
            <HeroDateRow
              label={<span className="flex items-center gap-1.5"><CalendarRange className="h-3 w-3 text-slate-400" />تاريخ الإنشاء</span>}
              value={formatDate(res.createdAt)}
            />
            <HeroDateRow
              label={
                <span className={cn('flex items-center gap-1.5', isExpired ? 'text-amber-700' : '')}>
                  <CalendarX2 className={cn('h-3 w-3', isExpired ? 'text-amber-500' : 'text-slate-400')} />
                  تاريخ الانتهاء
                </span>
              }
              value={
                <>
                  {res.expiresAt ? formatDate(res.expiresAt) : '—'}
                  {isExpired && (
                    <span className="ms-1.5 text-2xs font-semibold bg-amber-100 text-amber-700 rounded px-1.5 py-0.5">منتهي</span>
                  )}
                </>
              }
              tone={isExpired ? 'warning' : undefined}
            />
            {res.status === 'CONVERTED' && (
              <HeroDateRow
                label={<span className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-500" />محوَّل لعقد</span>}
                value="نعم"
                tone="success"
              />
            )}
          </div>
        </DetailHeroCol>
      </DetailHero>

      {/* Locked commission */}
      {hasCommission && (
        <DetailSection
          icon={<BadgePercent />}
          title="العمولة المُقفلة"
          description="مثبتة عند إنشاء الحجز — لن تتغير بعد توقيع العقد"
        >
          <MetricGrid cols={4}>
            <MetricTile
              label="النسبة"
              value={<>{Number(res.commissionLockedPct).toFixed(2)}<span className="text-xl ms-0.5">%</span></>}
              variant="accent"
              size="lg"
            />
            <MetricTile
              label="المبلغ المُقفل"
              value={res.commissionLockedAmount != null ? formatCurrency(res.commissionLockedAmount) : '—'}
              size="md"
            />
            <MetricTile label="قيمة الحجز" value={formatCurrency(res.bookingAmount)} size="md" />
            <MetricTile
              label="إجمالي الخطة"
              value={res.snapshotTotalPayable ? formatCurrency(res.snapshotTotalPayable) : '—'}
              size="md"
            />
          </MetricGrid>
        </DetailSection>
      )}

      {/* Notes */}
      {res.notes && (
        <DetailSection title="ملاحظات">
          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{res.notes}</p>
        </DetailSection>
      )}

      {/* Activity timeline */}
      {res.activities && res.activities.length > 0 && (
        <DetailSection title="سجل الأحداث">
          <ol className="relative border-s border-hairline ms-2 space-y-0">
            {res.activities.map((a, i) => {
              const isLast = i === res.activities!.length - 1;
              const isDone = a.type === 'CONVERTED' || a.type === 'APPROVED' || a.type === 'BOOKING_PAYMENT_CONFIRMED';
              const isNeg  = a.type === 'REJECTED' || a.type === 'CANCELLED' || a.type === 'EXPIRED';
              return (
                <li key={a.id} className={cn('ms-5', !isLast && 'pb-5')}>
                  <span className={cn('absolute -start-2 flex h-4 w-4 items-center justify-center rounded-full ring-2 ring-white', isDone ? 'bg-emerald-100' : isNeg ? 'bg-danger-100' : 'bg-slate-100')}>
                    {isDone ? <CheckCircle2 className="h-3 w-3 text-emerald-600" /> :
                     isNeg  ? <AlertTriangle className="h-3 w-3 text-danger-500" /> :
                               <Clock className="h-3 w-3 text-slate-400" />}
                  </span>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-800 leading-snug">{ACTIVITY_LABEL[a.type] ?? a.type}</p>
                      {a.note && <p className="text-2xs text-slate-500 mt-0.5 leading-relaxed">{a.note}</p>}
                      {a.actor?.fullName && <p className="text-2xs text-slate-400 mt-0.5">{a.actor.fullName}</p>}
                    </div>
                    <p className="text-2xs text-slate-400 whitespace-nowrap shrink-0">{formatDateTime(a.createdAt)}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </DetailSection>
      )}
    </div>
  );
}
