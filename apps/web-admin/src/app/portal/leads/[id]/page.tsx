import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Phone,
  Mail,
  Send,
  Search,
  CheckCircle2,
  XCircle,
  Copy,
  StickyNote,
  Clock,
  UserCog,
  CalendarDays,
  CalendarClock,
  MapPin,
  ArrowLeft,
  AlertTriangle,
  Building2,
  ShieldCheck,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { PortalLead, AppointmentStatus } from '@/lib/types';
import { tx, formatDate, formatDateTime } from '@/lib/format';
import { cn } from '@/lib/cn';
import {
  PremiumPageHero,
  PremiumDetailLayout,
  PremiumSectionCard,
  PremiumCommandPanel,
  PremiumEmptyState,
} from '@/components/premium';
import { CodeText } from '@/components/ui/code-text';
import { BrokerLeadStatusBadge, LeadStageBadge } from '@/components/badges';
import { avatarColor, initials } from '@/components/portal/detail-hero';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// ── Constants ─────────────────────────────────────────────────────────────────
const APPOINTMENT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  SCHEDULED:          'مجدولة',
  CONFIRMED:          'مؤكدة',
  PENDING_RESCHEDULE: 'إعادة جدولة',
  COMPLETED:          'مكتملة',
  CANCELLED:          'ملغاة',
  NO_SHOW:            'لم يحضر',
  RESCHEDULED:        'أُعيد جدولتها',
};

const APPOINTMENT_STATUS_STYLE: Record<AppointmentStatus, string> = {
  SCHEDULED:          'bg-amber-50 text-amber-700 border-amber-100',
  CONFIRMED:          'bg-emerald-50 text-emerald-700 border-emerald-100',
  PENDING_RESCHEDULE: 'bg-amber-50 text-amber-700 border-amber-100',
  COMPLETED:          'bg-slate-50 text-slate-600 border-slate-100',
  CANCELLED:          'bg-red-50 text-red-600 border-red-100',
  NO_SHOW:            'bg-red-50 text-red-600 border-red-100',
  RESCHEDULED:        'bg-slate-50 text-slate-600 border-slate-100',
};

const CMD_LINK = 'group flex items-center gap-3 px-5 py-3.5 text-sm text-slate-700 hover:bg-canvas/40 transition-colors duration-150';
const CMD_ICON = 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 [&_svg]:h-[15px] [&_svg]:w-[15px]';

// ── StatusTimeline ─────────────────────────────────────────────────────────────
function StatusTimeline({
  status,
  submittedAt,
  approvedAt,
  rejectedAt,
}: {
  status: PortalLead['brokerApprovalStatus'];
  submittedAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
}) {
  const resolved = status === 'APPROVED' || status === 'REJECTED' || status === 'DUPLICATE';

  const finalStep =
    status === 'APPROVED'
      ? { icon: <CheckCircle2 />, label: 'تم الاعتماد',     tone: 'success' as const, at: approvedAt }
      : status === 'REJECTED'
        ? { icon: <XCircle />,      label: 'تم الرفض',        tone: 'danger'  as const, at: rejectedAt }
        : status === 'DUPLICATE'
          ? { icon: <Copy />,       label: 'مكررة',            tone: 'warning' as const, at: null }
          : { icon: <CheckCircle2 />, label: 'بانتظار القرار', tone: 'muted'   as const, at: null };

  const steps = [
    { icon: <Send />,         label: 'أُرسلت للإدارة', tone: 'brand'  as const, at: submittedAt, done: true     },
    { icon: <Search />,       label: 'قيد المراجعة',   tone: 'brand'  as const, at: null,         done: true     },
    { icon: finalStep.icon,   label: finalStep.label,   tone: finalStep.tone,    at: finalStep.at, done: resolved },
  ];

  const ICON_CLS: Record<string, string> = {
    brand:   'bg-brand-50   text-brand-600   ring-1 ring-brand-100',
    success: 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100',
    danger:  'bg-red-50     text-red-600     ring-1 ring-red-100',
    warning: 'bg-amber-50   text-amber-600   ring-1 ring-amber-100',
    muted:   'bg-slate-100  text-slate-400   ring-1 ring-slate-200',
  };

  return (
    <ol className="flex flex-col sm:flex-row sm:items-start gap-6 sm:gap-0">
      {steps.map((s, i) => (
        <li key={i} className="flex sm:flex-col sm:flex-1 items-center gap-3 sm:gap-0 relative">
          <div className="flex items-center w-full sm:flex-col sm:items-center">
            {i > 0 && <div className="hidden sm:block flex-1 h-px bg-hairline" />}
            <span className={cn(
              'inline-flex h-10 w-10 items-center justify-center rounded-full shrink-0 [&_svg]:h-4 [&_svg]:w-4',
              s.done ? ICON_CLS[s.tone] : ICON_CLS['muted'],
            )}>
              {s.icon}
            </span>
            {i < steps.length - 1 && <div className="hidden sm:block flex-1 h-px bg-hairline" />}
          </div>
          <div className="min-w-0 text-start sm:text-center sm:mt-3 sm:px-2">
            <p className={cn('text-xs font-semibold', s.done ? 'text-slate-800' : 'text-slate-400')}>
              {s.label}
            </p>
            {s.at && <p className="text-2xs text-slate-400 mt-0.5 tabular-nums">{formatDate(s.at)}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

// ── Row helper (sidebar DL) ────────────────────────────────────────────────────
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

// ── ContactCell ───────────────────────────────────────────────────────────────
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
  tone: 'brand' | 'info' | 'violet';
}) {
  const ICON_TONE: Record<typeof tone, string> = {
    brand:  'bg-brand-50 text-brand-600',
    info:   'bg-info-50 text-info-600',
    violet: 'bg-violet-50 text-violet-600',
  };

  const inner = (
    <>
      <span className={cn('inline-flex h-9 w-9 items-center justify-center rounded-xl shrink-0', ICON_TONE[tone])}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-2xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <p className="text-sm font-medium text-slate-900 truncate" dir={label === 'البريد الإلكتروني' || label === 'رقم الهاتف' ? 'ltr' : undefined}>
          {value ?? <span className="text-slate-400">—</span>}
        </p>
      </div>
    </>
  );

  const cls = 'flex items-center gap-3 rounded-xl bg-canvas/60 px-3 py-2.5 ring-1 ring-inset ring-hairline';
  if (href && value) {
    return <a href={href} className={cn(cls, 'hover:bg-canvas transition-colors')}>{inner}</a>;
  }
  return <div className={cls}>{inner}</div>;
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default async function PortalLeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const r = await safe(api.get<PortalLead>(`/portal/leads/${id}`));
  if (r.error || !r.data) notFound();
  const lead = r.data;

  const isRejected  = lead.brokerApprovalStatus === 'REJECTED';
  const isDuplicate = lead.brokerApprovalStatus === 'DUPLICATE';

  const appointments  = lead.appointments ?? [];
  const now           = new Date();
  const upcomingCount = appointments.filter(
    (a) => (a.status === 'SCHEDULED' || a.status === 'CONFIRMED') && new Date(a.scheduledAt) > now,
  ).length;

  return (
    <div className="space-y-5">
      {/* Hero */}
      <PremiumPageHero
        title={lead.fullName}
        breadcrumbs={[
          { label: 'البوابة', href: '/portal' },
          { label: 'الفرص',  href: '/portal/leads' },
          { label: lead.fullName },
        ]}
        meta={
          <>
            {lead.brokerApprovalStatus && <BrokerLeadStatusBadge status={lead.brokerApprovalStatus} />}
            <LeadStageBadge stage={lead.stage} />
          </>
        }
      />

      {/* Rejection banner */}
      {isRejected && lead.brokerRejectionReason && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">سبب الرفض</p>
            <p className="mt-1 leading-relaxed">{lead.brokerRejectionReason}</p>
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
                {/* Avatar */}
                <div
                  className={cn(
                    'h-20 w-20 rounded-2xl flex items-center justify-center shrink-0 text-2xl font-bold ring-2 ring-white shadow-sm uppercase',
                    isDuplicate ? 'bg-slate-100 text-slate-500' : avatarColor(lead.fullName),
                  )}
                >
                  {isDuplicate ? <Copy className="h-8 w-8" /> : initials(lead.fullName)}
                </div>

                {/* Info */}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h2 className="text-xl font-semibold text-navy tracking-tight truncate">
                      {lead.fullName}
                    </h2>
                    {lead.assignedSales && (
                      <span className="inline-flex items-center gap-1.5 text-2xs text-slate-500 bg-slate-50 border border-hairline rounded-lg px-2 py-1">
                        <UserCog className="h-3 w-3 shrink-0 text-slate-400" />
                        {lead.assignedSales.fullName}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    عميل مُرسَل عبر بوابة الوساطة العقارية
                  </p>
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <ContactCell
                      icon={<Phone className="h-4 w-4" />}
                      tone="brand"
                      label="رقم الهاتف"
                      value={lead.phone}
                      href={lead.phone ? `tel:${lead.phone}` : undefined}
                    />
                    {lead.email && (
                      <ContactCell
                        icon={<Mail className="h-4 w-4" />}
                        tone="info"
                        label="البريد الإلكتروني"
                        value={lead.email}
                        href={`mailto:${lead.email}`}
                      />
                    )}
                  </div>
                </div>
              </div>
            </PremiumSectionCard>

            {/* ── Interest ────────────────────────────────────────────── */}
            <PremiumSectionCard
              title="الاهتمام والمرحلة"
              icon={<Building2 className="h-4 w-4" />}
              trailing={<LeadStageBadge stage={lead.stage} />}
            >
              {lead.projectInterest ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-start gap-3">
                    <span className="h-10 w-10 rounded-xl bg-brand-50 ring-1 ring-brand-100 flex items-center justify-center shrink-0 [&_svg]:h-4.5 [&_svg]:w-4.5 text-brand-600">
                      <Building2 className="h-4.5 w-4.5" />
                    </span>
                    <div>
                      <p className="text-[15px] font-extrabold text-slate-900 leading-snug">
                        {tx(lead.projectInterest.name)}
                      </p>
                      {lead.projectInterest.city && (
                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                          <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
                          {lead.projectInterest.city}
                        </p>
                      )}
                    </div>
                  </div>
                  {lead.unitInterest ? (
                    <div className="flex items-center gap-2.5 rounded-xl bg-canvas/60 ring-1 ring-inset ring-hairline px-4 py-3">
                      <div>
                        <p className="text-2xs font-medium uppercase tracking-wide text-slate-500">الوحدة المطلوبة</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <CodeText className="text-sm font-bold text-slate-800">{lead.unitInterest.code}</CodeText>
                          <CodeText className="text-2xs text-slate-500">{lead.unitInterest.type}</CodeText>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">أي وحدة متاحة في المشروع</p>
                  )}
                </div>
              ) : (
                <PremiumEmptyState
                  icon={<Building2 />}
                  title="لم يُحدد مشروع بعد"
                  description="لم يتم تحديد اهتمام بمشروع أو وحدة معينة لهذه الفرصة."
                />
              )}
            </PremiumSectionCard>

            {/* ── Timeline ────────────────────────────────────────────── */}
            <PremiumSectionCard title="مسار الفرصة" icon={<Send className="h-4 w-4" />}>
              <StatusTimeline
                status={lead.brokerApprovalStatus}
                submittedAt={lead.brokerSubmittedAt ?? ''}
                approvedAt={lead.brokerApprovedAt}
                rejectedAt={lead.brokerRejectedAt}
              />
            </PremiumSectionCard>

            {/* ── Linked visits ────────────────────────────────────────── */}
            <PremiumSectionCard
              title="الزيارات المرتبطة"
              icon={<CalendarClock className="h-4 w-4" />}
              trailing={
                appointments.length > 0 ? (
                  <span className="text-xs text-slate-400 tabular-nums">{appointments.length}</span>
                ) : undefined
              }
              padded={appointments.length === 0}
            >
              {appointments.length === 0 ? (
                <PremiumEmptyState
                  icon={<CalendarClock />}
                  title="لا توجد زيارات مرتبطة"
                  description="سيظهر هنا جدول الزيارات فور تحديد موعد مع العميل."
                />
              ) : (
                <ul className="divide-y divide-hairline">
                  {appointments.map((a) => {
                    const isPast     = new Date(a.scheduledAt) < now;
                    const isUpcoming = !isPast && (a.status === 'SCHEDULED' || a.status === 'CONFIRMED');
                    return (
                      <li
                        key={a.id}
                        className={cn(
                          'flex items-center justify-between gap-4 px-5 py-3.5',
                          isUpcoming && 'bg-brand-50/30',
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {isUpcoming
                            ? <CalendarClock className="h-4 w-4 text-brand-500 shrink-0" />
                            : <Clock         className="h-4 w-4 text-slate-300 shrink-0" />
                          }
                          <div className="min-w-0">
                            <CodeText className="text-xs font-semibold text-slate-800">{a.visitNumber}</CodeText>
                            <p className="text-2xs text-slate-500 mt-0.5" dir="ltr">{formatDateTime(a.scheduledAt)}</p>
                          </div>
                        </div>
                        <span className={cn(
                          'text-2xs font-medium border rounded-full px-2.5 py-0.5 shrink-0',
                          APPOINTMENT_STATUS_STYLE[a.status],
                        )}>
                          {APPOINTMENT_STATUS_LABEL[a.status]}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </PremiumSectionCard>

            {/* ── Notes ────────────────────────────────────────────────── */}
            {lead.notes && lead.notes.length > 0 && (
              <PremiumSectionCard
                title="ملاحظات فريق المبيعات"
                icon={<StickyNote className="h-4 w-4" />}
                trailing={
                  <span className="text-xs text-slate-400 tabular-nums">{lead.notes.length}</span>
                }
              >
                <ul className="divide-y divide-hairline -mx-1">
                  {lead.notes.map((n) => (
                    <li key={n.id} className="py-3 first:pt-0 last:pb-0">
                      <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{n.body}</p>
                      <p className="text-2xs text-slate-400 mt-1.5">
                        {n.sales?.fullName && (
                          <span className="font-medium text-slate-500">{n.sales.fullName} · </span>
                        )}
                        {formatDateTime(n.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              </PremiumSectionCard>
            )}
          </div>
        }
        side={
          <div className="space-y-4">

            {/* ── Quick actions ────────────────────────────────────────── */}
            <PremiumCommandPanel title="إجراءات سريعة">
              {lead.phone && (
                <a href={`tel:${lead.phone}`} className={CMD_LINK}>
                  <span className={CMD_ICON}><Phone /></span>
                  اتصال بالعميل
                </a>
              )}
              {lead.email && (
                <a href={`mailto:${lead.email}`} className={CMD_LINK}>
                  <span className={CMD_ICON}><Mail /></span>
                  إرسال بريد إلكتروني
                </a>
              )}
              <Link href={'/portal/leads' as never} className={CMD_LINK}>
                <span className={CMD_ICON}><ArrowLeft /></span>
                قائمة الفرص
              </Link>
            </PremiumCommandPanel>

            {/* ── Lead info (meta) ─────────────────────────────────────── */}
            <PremiumSectionCard title="معلومات الفرصة">
              <dl className="flex flex-col gap-3 text-sm">
                <InfoRow label="حالة الموافقة" icon={<ShieldCheck className="h-3.5 w-3.5" />}>
                  {lead.brokerApprovalStatus
                    ? <BrokerLeadStatusBadge status={lead.brokerApprovalStatus} />
                    : <span className="text-slate-400 text-xs">—</span>
                  }
                </InfoRow>
                <InfoRow label="المرحلة" icon={<Search className="h-3.5 w-3.5" />}>
                  <LeadStageBadge stage={lead.stage} />
                </InfoRow>
                <InfoRow label="تاريخ الإرسال" icon={<CalendarDays className="h-3.5 w-3.5" />}>
                  <span className="text-slate-700 text-xs tabular-nums">
                    {lead.brokerSubmittedAt ? formatDate(lead.brokerSubmittedAt) : '—'}
                  </span>
                </InfoRow>
                {lead.brokerApprovedAt && (
                  <InfoRow label="تاريخ الموافقة" icon={<CheckCircle2 className="h-3.5 w-3.5" />}>
                    <span className="text-emerald-700 text-xs font-semibold tabular-nums">
                      {formatDate(lead.brokerApprovedAt)}
                    </span>
                  </InfoRow>
                )}
                {lead.brokerRejectedAt && (
                  <InfoRow label="تاريخ الرفض" icon={<XCircle className="h-3.5 w-3.5" />}>
                    <span className="text-red-600 text-xs font-semibold tabular-nums">
                      {formatDate(lead.brokerRejectedAt)}
                    </span>
                  </InfoRow>
                )}
                <div className="pt-2 mt-1 border-t border-hairline grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-slate-50 border border-hairline px-3 py-2.5 text-center">
                    <p className="text-2xs text-slate-400 font-medium">الزيارات</p>
                    <p className="text-2xl font-black text-slate-800 mt-1 tabular-nums leading-none">
                      {appointments.length}
                    </p>
                    {upcomingCount > 0 && (
                      <p className="text-2xs text-brand-600 font-semibold mt-1">{upcomingCount} قادمة</p>
                    )}
                  </div>
                  <div className="rounded-xl bg-slate-50 border border-hairline px-3 py-2.5 text-center">
                    <p className="text-2xs text-slate-400 font-medium">الملاحظات</p>
                    <p className="text-2xl font-black text-slate-800 mt-1 tabular-nums leading-none">
                      {lead.notes?.length ?? 0}
                    </p>
                  </div>
                </div>
              </dl>
            </PremiumSectionCard>

          </div>
        }
      />
    </div>
  );
}
