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
  ArrowLeft,
  MapPin,
  ShieldCheck,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { PortalReservation, ReservationActivityType } from '@/lib/types';
import { tx, formatDate, formatDateTime, formatCurrency } from '@/lib/format';
import { getReportsCurrency } from '@/lib/currency';
import { cn } from '@/lib/cn';
import {
  PremiumPageHero,
  PremiumDetailLayout,
  PremiumSectionCard,
  PremiumCommandPanel,
} from '@/components/premium';
import { CodeText } from '@/components/ui/code-text';
import { ReservationStatusBadge } from '@/components/badges';
import { avatarColor, initials } from '@/components/portal/detail-hero';
import { MetricGrid, MetricTile } from '@/components/portal/metric-grid';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const ACTIVITY_LABEL: Record<ReservationActivityType, string> = {
  CREATED:                    'تم إنشاء الحجز',
  APPROVED:                   'تمت الموافقة على الحجز',
  REJECTED:                   'تم رفض الحجز',
  CANCELLED:                  'تم إلغاء الحجز',
  EXPIRED:                    'انتهت صلاحية الحجز',
  NOTE_ADDED:                 'إضافة ملاحظة',
  BOOKING_PAYMENT_CONFIRMED:  'تأكيد دفع مبلغ الحجز',
  BOOKING_PAYMENT_UNCONFIRMED:'إلغاء تأكيد دفع الحجز',
  CONVERTED:                  'تحويل إلى عقد',
};

const CMD_LINK = 'group flex items-center gap-3 px-5 py-3.5 text-sm text-slate-700 hover:bg-canvas/40 transition-colors duration-150';
const CMD_ICON = 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 [&_svg]:h-[15px] [&_svg]:w-[15px]';

// ── Shared sub-components ──────────────────────────────────────────────────────
function InfoRow({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="inline-flex items-center gap-1.5 text-2xs uppercase tracking-wide text-slate-500 font-semibold shrink-0">
        <span className="text-slate-400">{icon}</span>
        {label}
      </dt>
      <dd className="text-end">{children}</dd>
    </div>
  );
}

function ContactCell({
  icon,
  label,
  value,
  href,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null | undefined;
  href?: string;
  tone: 'brand' | 'info';
}) {
  const ICON_TONE = { brand: 'bg-brand-50 text-brand-600', info: 'bg-info-50 text-info-600' };
  const inner = (
    <>
      <span className={cn('inline-flex h-9 w-9 items-center justify-center rounded-xl shrink-0', ICON_TONE[tone])}>{icon}</span>
      <div className="min-w-0">
        <p className="text-2xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <p className="text-sm font-medium text-slate-900 truncate" dir={tone === 'brand' || tone === 'info' ? 'ltr' : undefined}>
          {value ?? <span className="text-slate-400">—</span>}
        </p>
      </div>
    </>
  );
  const cls = 'flex items-center gap-3 rounded-xl bg-canvas/60 px-3 py-2.5 ring-1 ring-inset ring-hairline';
  if (href && value) return <a href={href} className={cn(cls, 'hover:bg-canvas transition-colors')}>{inner}</a>;
  return <div className={cls}>{inner}</div>;
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default async function PortalReservationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const currency = await getReportsCurrency();
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

  return (
    <div className="space-y-5">
      {/* Hero */}
      <PremiumPageHero
        title={res.reservationNumber ?? 'حجز'}
        breadcrumbs={[
          { label: 'البوابة',   href: '/portal' },
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

      {/* Expiry banner */}
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

      {/* Layout */}
      <PremiumDetailLayout
        main={
          <div className="space-y-5">

            {/* ── Client profile ──────────────────────────────────────── */}
            <PremiumSectionCard title="العميل">
              <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-5">
                <div className={cn(
                  'h-20 w-20 rounded-2xl flex items-center justify-center shrink-0 text-2xl font-bold ring-2 ring-white shadow-sm uppercase',
                  clientName ? avatarColor(clientName) : 'bg-slate-100 text-slate-400',
                )}>
                  {clientName ? initials(clientName) : '?'}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h2 className="text-xl font-semibold text-navy tracking-tight truncate">{clientName || '—'}</h2>
                  </div>
                  {res.lead && (
                    <Link
                      href={`/portal/leads/${res.lead.id}` as never}
                      className="mt-1 inline-flex items-center gap-1.5 text-2xs text-brand-600 hover:text-brand-700 bg-brand-50 border border-brand-100 rounded-lg px-2 py-1 font-medium transition-colors"
                    >
                      الفرصة: {res.lead.fullName}
                    </Link>
                  )}
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {clientPhone && (
                      <ContactCell icon={<Phone className="h-4 w-4" />} tone="brand" label="رقم الهاتف" value={clientPhone} href={`tel:${clientPhone}`} />
                    )}
                    {clientEmail && (
                      <ContactCell icon={<Mail className="h-4 w-4" />} tone="info" label="البريد الإلكتروني" value={clientEmail} href={`mailto:${clientEmail}`} />
                    )}
                  </div>
                </div>
              </div>
            </PremiumSectionCard>

            {/* ── Unit & Project ───────────────────────────────────────── */}
            <PremiumSectionCard
              title="الوحدة والمشروع"
              icon={<Building2 className="h-4 w-4" />}
            >
              {project ? (
                <div className="flex flex-col gap-4">
                  <div className="flex items-start gap-3">
                    <span className="h-10 w-10 rounded-xl bg-brand-50 ring-1 ring-brand-100 flex items-center justify-center shrink-0 text-brand-600">
                      <Building2 className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-[16px] font-extrabold text-slate-900 leading-snug">{tx(project.name)}</p>
                      {project.city && (
                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                          <MapPin className="h-3 w-3 shrink-0 text-slate-400" />{project.city}
                        </p>
                      )}
                    </div>
                  </div>
                  {res.unit && (
                    <div className="flex items-center justify-between rounded-xl bg-canvas/60 ring-1 ring-inset ring-hairline px-4 py-3">
                      <div>
                        <p className="text-2xs font-medium uppercase tracking-wide text-slate-500">الوحدة</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <CodeText className="text-sm font-bold text-slate-800">{res.unit.code}</CodeText>
                          <CodeText className="text-2xs text-slate-500">{res.unit.type}</CodeText>
                        </div>
                      </div>
                      {res.unit.price != null && (
                        <div className="text-end">
                          <p className="text-2xs font-medium uppercase tracking-wide text-slate-500">سعر الوحدة</p>
                          <p className="text-sm font-bold text-slate-900 tabular-nums mt-0.5">{formatCurrency(res.unit.price, currency)}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-400 italic">لا توجد وحدة مرتبطة</p>
              )}
            </PremiumSectionCard>

            {/* ── Locked commission ────────────────────────────────────── */}
            {hasCommission && (
              <PremiumSectionCard
                title="العمولة المُقفلة"
                icon={<BadgePercent className="h-4 w-4" />}
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
                    value={res.commissionLockedAmount != null ? formatCurrency(res.commissionLockedAmount, currency) : '—'}
                    size="md"
                  />
                  <MetricTile label="قيمة الحجز" value={formatCurrency(res.bookingAmount, currency)} size="md" />
                  <MetricTile
                    label="إجمالي الخطة"
                    value={res.snapshotTotalPayable ? formatCurrency(res.snapshotTotalPayable, currency) : '—'}
                    size="md"
                  />
                </MetricGrid>
              </PremiumSectionCard>
            )}

            {/* ── Notes ─────────────────────────────────────────────────── */}
            {res.notes && (
              <PremiumSectionCard title="ملاحظات">
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{res.notes}</p>
              </PremiumSectionCard>
            )}

            {/* ── Activity timeline ─────────────────────────────────────── */}
            {res.activities && res.activities.length > 0 && (
              <PremiumSectionCard title="سجل الأحداث" icon={<Clock className="h-4 w-4" />}>
                <ol className="relative border-s border-hairline ms-2 space-y-0">
                  {res.activities.map((a, i) => {
                    const isLast = i === res.activities!.length - 1;
                    const isDone = a.type === 'CONVERTED' || a.type === 'APPROVED' || a.type === 'BOOKING_PAYMENT_CONFIRMED';
                    const isNeg  = a.type === 'REJECTED' || a.type === 'CANCELLED' || a.type === 'EXPIRED';
                    return (
                      <li key={a.id} className={cn('ms-5', !isLast && 'pb-5')}>
                        <span className={cn(
                          'absolute -start-2 flex h-4 w-4 items-center justify-center rounded-full ring-2 ring-white',
                          isDone ? 'bg-emerald-100' : isNeg ? 'bg-danger-100' : 'bg-slate-100',
                        )}>
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
                          <p className="text-2xs text-slate-400 whitespace-nowrap shrink-0 tabular-nums">{formatDateTime(a.createdAt)}</p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </PremiumSectionCard>
            )}
          </div>
        }
        side={
          <div className="space-y-4">

            {/* ── Quick actions ────────────────────────────────────────── */}
            <PremiumCommandPanel title="إجراءات سريعة">
              {clientPhone && (
                <a href={`tel:${clientPhone}`} className={CMD_LINK}>
                  <span className={CMD_ICON}><Phone /></span>
                  اتصال بالعميل
                </a>
              )}
              {clientEmail && (
                <a href={`mailto:${clientEmail}`} className={CMD_LINK}>
                  <span className={CMD_ICON}><Mail /></span>
                  إرسال بريد إلكتروني
                </a>
              )}
              <Link href={'/portal/reservations' as never} className={CMD_LINK}>
                <span className={CMD_ICON}><ArrowLeft /></span>
                قائمة الحجوزات
              </Link>
            </PremiumCommandPanel>

            {/* ── Reservation info ─────────────────────────────────────── */}
            <PremiumSectionCard title="معلومات الحجز">
              <dl className="flex flex-col gap-3 text-sm">
                <InfoRow label="الحالة" icon={<ShieldCheck className="h-3.5 w-3.5" />}>
                  <ReservationStatusBadge status={res.status} />
                </InfoRow>
                {res.sales?.fullName && (
                  <InfoRow label="المندوب" icon={<UserCog className="h-3.5 w-3.5" />}>
                    <span className="text-slate-700 text-xs font-medium">{res.sales.fullName}</span>
                  </InfoRow>
                )}
                <InfoRow label="تاريخ الإنشاء" icon={<CalendarRange className="h-3.5 w-3.5" />}>
                  <span className="text-slate-700 text-xs tabular-nums">{formatDate(res.createdAt)}</span>
                </InfoRow>
                {res.expiresAt && (
                  <InfoRow label="تاريخ الانتهاء" icon={<CalendarX2 className="h-3.5 w-3.5" />}>
                    <span className={cn('text-xs tabular-nums font-medium', isExpired ? 'text-amber-700' : 'text-slate-700')}>
                      {formatDate(res.expiresAt)}
                      {isExpired && <span className="ms-1 text-2xs bg-amber-100 text-amber-700 rounded px-1.5 py-0.5">منتهي</span>}
                    </span>
                  </InfoRow>
                )}
                {res.status === 'CONVERTED' && (
                  <InfoRow label="تحويل لعقد" icon={<CheckCircle2 className="h-3.5 w-3.5" />}>
                    <span className="text-emerald-700 text-xs font-semibold">نعم</span>
                  </InfoRow>
                )}
                {res.lead && (
                  <InfoRow label="الفرصة" icon={<BadgePercent className="h-3.5 w-3.5" />}>
                    <Link
                      href={`/portal/leads/${res.lead.id}` as never}
                      className="text-xs text-brand-600 hover:text-brand-700 font-medium"
                    >
                      {res.lead.fullName}
                    </Link>
                  </InfoRow>
                )}
                {hasCommission && (
                  <div className="pt-2 mt-1 border-t border-hairline">
                    <div className="rounded-xl bg-amber-50 border border-amber-100 px-3 py-2.5 text-center">
                      <p className="text-2xs text-amber-500 font-semibold uppercase tracking-wide">العمولة المُقفلة</p>
                      <p className="text-2xl font-black text-amber-700 tabular-nums mt-1 leading-none">
                        {Number(res.commissionLockedPct).toFixed(2)}%
                      </p>
                    </div>
                  </div>
                )}
              </dl>
            </PremiumSectionCard>

          </div>
        }
      />
    </div>
  );
}
