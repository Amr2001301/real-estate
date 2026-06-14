import { notFound } from 'next/navigation';
import {
  Mail,
  Phone,
  Building2,
  CalendarClock,
  AlertTriangle,
  Send,
  Search,
  CheckCircle2,
  XCircle,
  Copy,
  StickyNote,
  Clock,
  UserCog,
  CalendarDays,
  MapPin,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { PortalLead, AppointmentStatus } from '@/lib/types';
import { tx, formatDate, formatDateTime } from '@/lib/format';
import { cn } from '@/lib/cn';
import { PageHeader } from '@/components/ui/page-header';
import { CodeText } from '@/components/ui/code-text';
import {
  BrokerLeadStatusBadge,
  LeadStageBadge,
} from '@/components/badges';
import {
  DetailHero,
  DetailHeroCol,
  HeroColLabel,
  HeroDateRow,
  avatarColor,
  initials,
  type DetailHeroStatus,
} from '@/components/portal/detail-hero';
import { DetailSection } from '@/components/portal/detail-section';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const APPOINTMENT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  SCHEDULED: 'مجدولة',
  CONFIRMED: 'مؤكدة',
  PENDING_RESCHEDULE: 'إعادة جدولة',
  COMPLETED: 'مكتملة',
  CANCELLED: 'ملغاة',
  NO_SHOW: 'لم يحضر',
  RESCHEDULED: 'أُعيد جدولتها',
};

const APPOINTMENT_STATUS_STYLE: Record<AppointmentStatus, string> = {
  SCHEDULED: 'bg-amber-50 text-amber-700 border-amber-100',
  CONFIRMED: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  PENDING_RESCHEDULE: 'bg-amber-50 text-amber-700 border-amber-100',
  COMPLETED: 'bg-slate-50 text-slate-600 border-slate-100',
  CANCELLED: 'bg-red-50 text-red-600 border-red-100',
  NO_SHOW: 'bg-red-50 text-red-600 border-red-100',
  RESCHEDULED: 'bg-slate-50 text-slate-600 border-slate-100',
};

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
  const resolved =
    status === 'APPROVED' || status === 'REJECTED' || status === 'DUPLICATE';

  const finalStep =
    status === 'APPROVED'
      ? { icon: <CheckCircle2 />, label: 'تم الاعتماد', tone: 'success' as const, at: approvedAt }
      : status === 'REJECTED'
        ? { icon: <XCircle />, label: 'تم الرفض', tone: 'danger' as const, at: rejectedAt }
        : status === 'DUPLICATE'
          ? { icon: <Copy />, label: 'مكررة', tone: 'warning' as const, at: null }
          : { icon: <CheckCircle2 />, label: 'بانتظار القرار', tone: 'muted' as const, at: null };

  const steps = [
    { icon: <Send />, label: 'أُرسلت للإدارة', tone: 'brand' as const, at: submittedAt, done: true },
    { icon: <Search />, label: 'قيد المراجعة', tone: 'brand' as const, at: null, done: true },
    { icon: finalStep.icon, label: finalStep.label, tone: finalStep.tone, at: finalStep.at, done: resolved },
  ];

  const TONE: Record<string, string> = {
    brand: 'bg-brand-50 text-brand-600 ring-brand-100',
    success: 'bg-success-50 text-success-600 ring-success-100',
    danger: 'bg-danger-50 text-danger-600 ring-danger-100',
    warning: 'bg-warning-50 text-warning-600 ring-warning-100',
    muted: 'bg-slate-100 text-slate-400 ring-slate-200',
  };

  return (
    <DetailSection title="مسار الفرصة">
      <ol className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-0">
        {steps.map((s, i) => (
          <li key={i} className="flex sm:flex-col sm:flex-1 items-center gap-3 sm:gap-2 sm:text-center">
            <span
              className={`inline-flex h-9 w-9 items-center justify-center rounded-full ring-1 ring-inset shrink-0 [&_svg]:h-4 [&_svg]:w-4 ${
                s.done ? TONE[s.tone] : TONE['muted']
              }`}
            >
              {s.icon}
            </span>
            <div className="min-w-0">
              <p className={`text-xs font-medium ${s.done ? 'text-slate-800' : 'text-slate-400'}`}>
                {s.label}
              </p>
              {s.at && <p className="text-2xs text-slate-400 mt-0.5">{formatDate(s.at)}</p>}
            </div>
          </li>
        ))}
      </ol>
    </DetailSection>
  );
}

export default async function PortalLeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const r = await safe(api.get<PortalLead>(`/portal/leads/${id}`));
  if (r.error || !r.data) notFound();
  const lead = r.data;

  const isDuplicate = lead.brokerApprovalStatus === 'DUPLICATE';
  const isRejected  = lead.brokerApprovalStatus === 'REJECTED';

  const heroStatus: DetailHeroStatus =
    lead.brokerApprovalStatus === 'APPROVED' ? 'success' :
    lead.brokerApprovalStatus === 'REJECTED' ? 'danger' :
    lead.brokerApprovalStatus === 'DUPLICATE' ? 'neutral' :
    'warning';

  const appointments = lead.appointments ?? [];
  const now = new Date();
  const upcomingVisits = appointments.filter(
    (a) => (a.status === 'SCHEDULED' || a.status === 'CONFIRMED') && new Date(a.scheduledAt) > now
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title={lead.fullName}
        breadcrumbs={[
          { label: 'البوابة', href: '/portal' },
          { label: 'الفرص', href: '/portal/leads' },
          { label: lead.fullName },
        ]}
        meta={
          <>
            {lead.brokerApprovalStatus && (
              <BrokerLeadStatusBadge status={lead.brokerApprovalStatus} />
            )}
            <LeadStageBadge stage={lead.stage} />
          </>
        }
      />

      {/* Rejection reason */}
      {isRejected && lead.brokerRejectionReason && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">سبب الرفض</p>
            <p className="mt-1 leading-relaxed">{lead.brokerRejectionReason}</p>
          </div>
        </div>
      )}

      {/* Hero */}
      <DetailHero status={heroStatus}>
        {/* Client */}
        <DetailHeroCol position="first">
          <div className="flex items-start gap-4">
            <div
              className={cn(
                'h-14 w-14 rounded-2xl flex items-center justify-center shrink-0',
                isDuplicate ? 'bg-slate-100 text-slate-500' : avatarColor(lead.fullName),
              )}
            >
              {isDuplicate ? (
                <Copy className="h-6 w-6" />
              ) : (
                <span className="text-lg font-bold">{initials(lead.fullName)}</span>
              )}
            </div>
            <div className="min-w-0">
              <HeroColLabel>العميل</HeroColLabel>
              <p className="text-xl font-bold text-slate-900 leading-snug">{lead.fullName}</p>
              <a
                href={`tel:${lead.phone}`}
                className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-brand-700 transition-colors"
                dir="ltr"
              >
                <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                {lead.phone}
              </a>
              {lead.email && (
                <a
                  href={`mailto:${lead.email}`}
                  className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 hover:text-brand-700 transition-colors"
                  dir="ltr"
                >
                  <Mail className="h-3 w-3 text-slate-400 shrink-0" />
                  <span className="truncate max-w-[200px]">{lead.email}</span>
                </a>
              )}
              {lead.assignedSales && (
                <p className="mt-2 flex items-center gap-1.5 text-2xs text-slate-400">
                  <UserCog className="h-3 w-3 shrink-0" />
                  <span className="font-medium text-slate-500">{lead.assignedSales.fullName}</span>
                </p>
              )}
            </div>
          </div>
        </DetailHeroCol>

        {/* Interest + Stage */}
        <DetailHeroCol position="middle">
          <HeroColLabel>الاهتمام والمرحلة</HeroColLabel>
          {lead.projectInterest ? (
            <>
              <p className="text-lg font-bold text-slate-900 leading-snug">
                {tx(lead.projectInterest.name)}
              </p>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                <MapPin className="h-3 w-3 shrink-0" />
                {lead.projectInterest.city ?? ''}
              </p>
              <div className="mt-3">
                {lead.unitInterest ? (
                  <>
                    <CodeText className="text-base font-bold text-slate-800">
                      {lead.unitInterest.code}
                    </CodeText>
                    <p className="text-xs text-slate-500 mt-0.5">
                      <CodeText>{lead.unitInterest.type}</CodeText>
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-slate-400">أي وحدة متاحة في المشروع</p>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-400 mt-2">لم يُحدد مشروع بعد</p>
          )}
          <div className="mt-4 pt-3 border-t border-hairline flex items-center gap-2">
            <span className="text-2xs text-slate-400 shrink-0">المرحلة الحالية</span>
            <LeadStageBadge stage={lead.stage} />
          </div>
        </DetailHeroCol>

        {/* Dates + stats */}
        <DetailHeroCol position="last">
          <HeroColLabel>التواريخ والإحصاء</HeroColLabel>
          <div className="space-y-2.5">
            <HeroDateRow
              label={<span className="flex items-center gap-1.5"><CalendarDays className="h-3 w-3 text-slate-400" />تاريخ الإرسال</span>}
              value={lead.brokerSubmittedAt ? formatDate(lead.brokerSubmittedAt) : '—'}
            />
            {lead.brokerApprovedAt && (
              <HeroDateRow
                label="تاريخ الموافقة"
                value={formatDate(lead.brokerApprovedAt)}
                tone="success"
              />
            )}
            {lead.brokerRejectedAt && (
              <HeroDateRow
                label="تاريخ الرفض"
                value={formatDate(lead.brokerRejectedAt)}
                tone="warning"
              />
            )}
          </div>
          {/* Quick stats */}
          <div className={cn(
            'mt-4 pt-3 border-t border-hairline grid gap-3',
            (lead.notes?.length ?? 0) > 0 ? 'grid-cols-2' : 'grid-cols-1',
          )}>
            <div>
              <p className="text-2xs text-slate-400">الزيارات</p>
              <p className="text-xl font-bold text-slate-800 mt-0.5 tabular-nums">
                {appointments.length}
              </p>
              {upcomingVisits.length > 0 && (
                <p className="text-2xs text-brand-600 font-medium mt-0.5">
                  {upcomingVisits.length} قادمة
                </p>
              )}
            </div>
            {(lead.notes?.length ?? 0) > 0 && (
              <div>
                <p className="text-2xs text-slate-400">الملاحظات</p>
                <p className="text-xl font-bold text-slate-800 mt-0.5 tabular-nums">
                  {lead.notes!.length}
                </p>
              </div>
            )}
          </div>
        </DetailHeroCol>
      </DetailHero>

      {/* Approval timeline */}
      <StatusTimeline
        status={lead.brokerApprovalStatus}
        submittedAt={lead.brokerSubmittedAt ?? ''}
        approvedAt={lead.brokerApprovedAt}
        rejectedAt={lead.brokerRejectedAt}
      />

      {/* Linked visits — always rendered */}
      <DetailSection
        icon={<CalendarClock />}
        title="الزيارات المرتبطة"
        count={appointments.length}
        noBodyPad={appointments.length > 0}
      >
        {appointments.length === 0 ? (
          <div className="py-8 flex flex-col items-center gap-3 text-center">
            <CalendarClock className="h-9 w-9 text-slate-200" />
            <div>
              <p className="text-sm font-medium text-slate-400">لا توجد زيارات مرتبطة</p>
              <p className="text-2xs text-slate-300 mt-1">
                سيظهر هنا جدول الزيارات فور تحديد موعد مع العميل.
              </p>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-hairline">
            {appointments.map((a) => {
              const isPast = new Date(a.scheduledAt) < now;
              const isUpcoming = !isPast && (a.status === 'SCHEDULED' || a.status === 'CONFIRMED');
              return (
                <li
                  key={a.id}
                  className={cn(
                    'flex items-center justify-between gap-4 px-6 py-3',
                    isUpcoming && 'bg-brand-50/30',
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {isUpcoming ? (
                      <CalendarClock className="h-4 w-4 text-brand-500 shrink-0" />
                    ) : (
                      <Clock className="h-4 w-4 text-slate-300 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <CodeText className="text-xs font-semibold text-slate-800">
                        {a.visitNumber}
                      </CodeText>
                      <p className="text-2xs text-slate-500 mt-0.5" dir="ltr">
                        {formatDateTime(a.scheduledAt)}
                      </p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      'text-2xs font-medium border rounded-full px-2.5 py-0.5 shrink-0',
                      APPOINTMENT_STATUS_STYLE[a.status],
                    )}
                  >
                    {APPOINTMENT_STATUS_LABEL[a.status]}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </DetailSection>

      {/* Notes */}
      {lead.notes && lead.notes.length > 0 && (
        <DetailSection icon={<StickyNote />} title="ملاحظات فريق المبيعات">
          <ul className="divide-y divide-hairline">
            {lead.notes.map((n) => (
              <li key={n.id} className="py-3 first:pt-0 last:pb-0">
                <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {n.body}
                </p>
                <p className="text-2xs text-slate-400 mt-1.5">
                  {n.sales?.fullName && (
                    <span className="font-medium text-slate-500">{n.sales.fullName} · </span>
                  )}
                  {formatDateTime(n.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        </DetailSection>
      )}
    </div>
  );
}
