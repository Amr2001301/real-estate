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
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { PortalLead } from '@/lib/types';
import { tx, formatDate, formatDateTime } from '@/lib/format';
import { cn } from '@/lib/cn';
import { PageHeader } from '@/components/ui/page-header';
import { CodeText } from '@/components/ui/code-text';
import {
  BrokerLeadStatusBadge,
  LeadStageBadge,
  AppointmentStatusBadge,
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

  const TONE: Record<'brand' | 'success' | 'danger' | 'warning' | 'muted', string> = {
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
                s.done ? TONE[s.tone] : TONE.muted
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

      {/* ── Rejection reason ──────────────────────────────────────────── */}
      {isRejected && lead.brokerRejectionReason && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">سبب الرفض</p>
            <p className="mt-1 leading-relaxed">{lead.brokerRejectionReason}</p>
          </div>
        </div>
      )}

      {/* ── Hero summary card ──────────────────────────────────────────── */}
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
            </div>
          </div>
        </DetailHeroCol>

        {/* Interest */}
        <DetailHeroCol position="middle">
          <HeroColLabel>الاهتمام والمرحلة</HeroColLabel>
          {lead.projectInterest ? (
            <>
              <p className="text-lg font-bold text-slate-900 leading-snug">
                {tx(lead.projectInterest.name)}
              </p>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                <Building2 className="h-3 w-3 shrink-0" />
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
            <p className="text-sm text-slate-400">لم يُحدد مشروع بعد</p>
          )}
          <div className="mt-4 pt-3 border-t border-hairline flex items-center gap-2">
            <span className="text-2xs text-slate-400 shrink-0">المرحلة</span>
            <LeadStageBadge stage={lead.stage} />
          </div>
        </DetailHeroCol>

        {/* Dates + context */}
        <DetailHeroCol position="last">
          <HeroColLabel>التواريخ والإحصاء</HeroColLabel>
          <div className="space-y-2.5">
            <HeroDateRow
              label="تاريخ الإرسال"
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
          <div className="mt-4 pt-3 border-t border-hairline grid grid-cols-2 gap-3">
            <div>
              <p className="text-2xs text-slate-400">الزيارات</p>
              <p className="text-lg font-bold text-slate-800 mt-0.5 tabular-nums">
                {lead.appointments?.length ?? 0}
              </p>
            </div>
            {lead.notes && lead.notes.length > 0 && (
              <div>
                <p className="text-2xs text-slate-400">الملاحظات</p>
                <p className="text-lg font-bold text-slate-800 mt-0.5 tabular-nums">
                  {lead.notes.length}
                </p>
              </div>
            )}
          </div>
        </DetailHeroCol>
      </DetailHero>

      {/* ── Approval timeline ──────────────────────────────────────────── */}
      <StatusTimeline
        status={lead.brokerApprovalStatus}
        submittedAt={lead.brokerSubmittedAt ?? ''}
        approvedAt={lead.brokerApprovedAt}
        rejectedAt={lead.brokerRejectedAt}
      />

      {/* ── Linked visits ─────────────────────────────────────────────── */}
      {lead.appointments && lead.appointments.length > 0 && (
        <DetailSection
          icon={<CalendarClock />}
          title="الزيارات المرتبطة"
          count={lead.appointments.length}
        >
          <ol className="relative border-s border-hairline ms-2 space-y-0">
            {lead.appointments.map((a, i) => {
              const isLast = i === lead.appointments!.length - 1;
              return (
                <li key={a.id} className={cn('ms-5', !isLast && 'pb-4')}>
                  <span className="absolute -start-2 flex h-4 w-4 items-center justify-center rounded-full bg-brand-50 ring-2 ring-white">
                    <Clock className="h-2.5 w-2.5 text-brand-500" />
                  </span>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CodeText className="text-xs font-semibold text-slate-800">
                        {a.visitNumber}
                      </CodeText>
                      <p className="text-2xs text-slate-500 mt-0.5">
                        <CodeText>{formatDateTime(a.scheduledAt)}</CodeText>
                      </p>
                    </div>
                    <AppointmentStatusBadge status={a.status} />
                  </div>
                </li>
              );
            })}
          </ol>
        </DetailSection>
      )}

      {/* ── Notes ─────────────────────────────────────────────────────── */}
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
