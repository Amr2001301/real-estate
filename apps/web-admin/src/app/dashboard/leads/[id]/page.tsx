import Link from 'next/link';
import {
  Phone,
  Mail,
  Building2,
  BookmarkCheck,
  Calendar,
  CalendarClock,
  UserCog,
  MessageSquare,
  Activity,
  ArrowLeft,
  ExternalLink,
  Briefcase,
  TrendingUp,
  DoorOpen,
  Hash,
  CheckCircle2,
  Zap,
  User,
  BarChart2,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type {
  Lead,
  Paged,
  Reservation,
  User as UserType,
  LeadStage,
  VisitRequest,
  VisitAppointment,
} from '@/lib/types';
import { formatDate, formatDateTime, tx } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  ReservationStatusBadge,
  VisitRequestStatusBadge,
  AppointmentStatusBadge,
} from '@/components/badges';
import { StageSegmented } from '@/components/crm/stage-segmented';
import { addNoteAction, assignLeadAction } from '../actions';
import { salesActorLabel } from '@/lib/sales-actor';
import {
  PremiumPageHero,
  PremiumDetailLayout,
  PremiumSectionCard,
  PremiumCommandPanel,
} from '@/components/premium';
import { cn } from '@/lib/cn';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface LeadDetail extends Lead {
  activities?: Array<{ id: string; type: string; payload: unknown; createdAt: string }>;
}

const STAGES: LeadStage[] = ['NEW', 'INTERESTED', 'VISIT', 'NEGOTIATION', 'WON', 'LOST'];

// ── Stage style maps ──────────────────────────────────────────────────────────

const STAGE_LABEL: Record<LeadStage, string> = {
  NEW: 'جديد',
  INTERESTED: 'مهتم',
  VISIT: 'زيارة',
  NEGOTIATION: 'تفاوض',
  WON: 'فاز',
  LOST: 'خسارة',
};

const STAGE_BADGE_CLS: Record<LeadStage, string> = {
  NEW:         'bg-slate-100   text-slate-700  border-slate-200',
  INTERESTED:  'bg-sky-50      text-sky-700    border-sky-100',
  VISIT:       'bg-violet-50   text-violet-700 border-violet-100',
  NEGOTIATION: 'bg-amber-50    text-amber-700  border-amber-100',
  WON:         'bg-emerald-50  text-emerald-700 border-emerald-100',
  LOST:        'bg-rose-50     text-rose-600   border-rose-100',
};

const STAGE_DOT: Record<LeadStage, string> = {
  NEW:         'bg-slate-400',
  INTERESTED:  'bg-sky-400',
  VISIT:       'bg-violet-400',
  NEGOTIATION: 'bg-amber-400',
  WON:         'bg-emerald-400',
  LOST:        'bg-rose-400',
};

const STAGE_TOP_BORDER: Record<LeadStage, string> = {
  NEW:         'border-t-slate-300',
  INTERESTED:  'border-t-sky-400',
  VISIT:       'border-t-violet-400',
  NEGOTIATION: 'border-t-amber-400',
  WON:         'border-t-emerald-400',
  LOST:        'border-t-rose-400',
};

// Command panel shared classes (same as reservations page)
const CMD_LINK =
  'group flex items-center gap-3 px-5 py-3.5 text-sm text-slate-700 hover:bg-canvas/40 transition-colors duration-150';
const CMD_ICON =
  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 [&_svg]:h-[15px] [&_svg]:w-[15px]';

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '؟';
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase();
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [leadRes, salesRes, visitRequestsRes, appointmentsRes, reservationsRes] =
    await Promise.all([
      safe(api.get<LeadDetail>(`/leads/${id}`)),
      safe(api.get<Paged<UserType>>('/users?role=SALES,SALES_MANAGER&pageSize=100')),
      safe(api.get<Paged<VisitRequest>>(`/visits/requests?leadId=${id}&pageSize=10`)),
      safe(api.get<Paged<VisitAppointment>>(`/visits/appointments?leadId=${id}&pageSize=10`)),
      safe(api.get<Paged<Reservation>>(`/reservations?leadId=${id}&pageSize=10`)),
    ]);

  if (leadRes.error || !leadRes.data) {
    return (
      <div className="flex items-start gap-3 rounded-[20px] bg-danger-50 border border-danger-100 text-danger-700 p-6 text-sm">
        تعذر تحميل بيانات الفرصة: {leadRes.error ?? 'غير موجود'}
      </div>
    );
  }

  const lead = leadRes.data;
  const visitRequests = visitRequestsRes.data?.data ?? [];
  const appointments = appointmentsRes.data?.data ?? [];
  const reservations = reservationsRes.data?.data ?? [];

  const displayName  = lead.client?.fullName ?? lead.fullName ?? 'فرصة غير مُعرَّفة';
  const displayPhone = lead.client?.phone ?? lead.phone ?? null;
  const displayEmail = lead.client?.email ?? lead.email ?? null;
  const isBrokerLead = !!lead.brokerId;
  const brokerName   = lead.broker?.commercialName || lead.broker?.companyName || lead.broker?.code || null;
  const notesCount   = lead.notes?.length ?? 0;

  return (
    <div className="space-y-5">

      {/* ── Hero ──────────────────────────────────────────────────── */}
      <PremiumPageHero
        title={displayName}
        description={[displayPhone, displayEmail].filter(Boolean).join(' · ') || undefined}
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'فرص المبيعات (CRM)', href: '/dashboard/leads' },
          { label: displayName },
        ]}
        meta={
          <span className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold',
            STAGE_BADGE_CLS[lead.stage],
          )}>
            <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', STAGE_DOT[lead.stage])} />
            {STAGE_LABEL[lead.stage]}
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            {lead.client?.id && (
              <Link href={`/dashboard/clients/${lead.client.id}` as never}>
                <Button variant="outline" size="md" leftIcon={<ExternalLink className="h-4 w-4" />}>
                  ملف العميل
                </Button>
              </Link>
            )}
            {displayPhone && (
              <a href={`tel:${displayPhone}`}>
                <Button variant="outline" size="md" leftIcon={<Phone className="h-4 w-4" />}>
                  اتصال
                </Button>
              </a>
            )}
            {displayEmail && (
              <a href={`mailto:${displayEmail}`}>
                <Button variant="primary" size="md" leftIcon={<Mail className="h-4 w-4" />}>
                  إرسال بريد
                </Button>
              </a>
            )}
          </div>
        }
      />

      {/* ── Detail layout ─────────────────────────────────────────── */}
      <PremiumDetailLayout
        main={
          <>
            {/* Stage card with colored top border */}
            <PremiumSectionCard
              icon={<TrendingUp />}
              title="مرحلة الفرصة"
              description="انقل الفرصة بين مراحل البيع المختلفة"
              trailing={
                <span className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-bold',
                  STAGE_BADGE_CLS[lead.stage],
                )}>
                  <span className={cn('h-2 w-2 rounded-full shrink-0', STAGE_DOT[lead.stage])} />
                  {STAGE_LABEL[lead.stage]}
                </span>
              }
              className={cn('border-t-[3px]', STAGE_TOP_BORDER[lead.stage])}
            >
              <StageSegmented leadId={lead.id} currentStage={lead.stage} stages={STAGES} />
            </PremiumSectionCard>

            {/* Notes */}
            <PremiumSectionCard
              icon={<MessageSquare />}
              title="الملاحظات"
              description="سجّل تفاعلاتك مع العميل وتحديثات المتابعة"
              trailing={
                <span className="inline-flex h-5 min-w-[22px] px-1.5 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500 tabular-nums">
                  {notesCount}
                </span>
              }
              padded={false}
            >
              {/* Add note form */}
              <div className="p-5 sm:p-6 border-b border-hairline">
                <form action={addNoteAction.bind(null, lead.id)} className="flex flex-col gap-3">
                  <Textarea
                    name="body"
                    required
                    rows={3}
                    placeholder="اكتب ملاحظة جديدة عن آخر تفاعل مع العميل…"
                    className="text-[13px]"
                  />
                  <div className="flex justify-start">
                    <Button type="submit" variant="primary" size="sm">
                      حفظ الملاحظة
                    </Button>
                  </div>
                </form>
              </div>

              {/* Notes list */}
              <div className="p-5 sm:p-6">
                {notesCount === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-6 text-center">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                      <MessageSquare className="h-5 w-5" />
                    </span>
                    <p className="text-[13px] font-semibold text-slate-600">لا توجد ملاحظات بعد</p>
                    <p className="text-[11px] text-slate-400">ابدأ بتدوين أول ملاحظة لتتبع تفاعلاتك مع العميل.</p>
                  </div>
                ) : (
                  <ul className="flex flex-col gap-2.5">
                    {lead.notes!.map((n) => (
                      <li
                        key={n.id}
                        className="relative rounded-2xl bg-canvas/50 ring-1 ring-inset ring-hairline px-4 py-3.5 pe-5"
                      >
                        <span
                          aria-hidden
                          className="absolute start-0 top-3 bottom-3 w-[3px] rounded-s-full bg-brand-400"
                        />
                        <p className="text-[13px] text-slate-800 leading-relaxed">{n.body}</p>
                        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400">
                          <UserCog className="h-3 w-3 shrink-0" />
                          <span className="font-medium text-slate-500">{n.sales?.fullName ?? 'مجهول'}</span>
                          <span className="text-slate-300">·</span>
                          <span dir="ltr">{formatDateTime(n.createdAt)}</span>
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </PremiumSectionCard>

            {/* Visits */}
            {(visitRequests.length > 0 || appointments.length > 0) && (
              <PremiumSectionCard
                icon={<CalendarClock />}
                title="الزيارات"
                description="طلبات الزيارة والمواعيد المجدولة"
                trailing={
                  <span className="inline-flex h-5 min-w-[22px] px-1.5 items-center justify-center rounded-full bg-violet-100 text-[10px] font-bold text-violet-600 tabular-nums">
                    {visitRequests.length + appointments.length}
                  </span>
                }
                padded={false}
              >
                <div className="p-5 sm:p-6 space-y-5">
                  {visitRequests.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.12em] mb-2.5">
                        طلبات الزيارة
                      </p>
                      <ul className="flex flex-col gap-2">
                        {visitRequests.map((r) => (
                          <li
                            key={r.id}
                            className="flex items-center gap-3 rounded-xl bg-canvas/60 ring-1 ring-inset ring-hairline px-4 py-2.5"
                          >
                            <Link
                              href={`/dashboard/visits/requests/${r.id}` as never}
                              className="font-mono text-[11px] font-bold text-brand-700 hover:underline shrink-0"
                            >
                              {r.requestNumber ?? r.id.slice(0, 8)}
                            </Link>
                            <span className="text-[11px] text-slate-500 flex-1" dir="ltr">
                              {formatDate(r.preferredDate)}
                            </span>
                            {r.requestStatus && <VisitRequestStatusBadge status={r.requestStatus} />}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {appointments.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.12em] mb-2.5">
                        الزيارات المجدولة
                      </p>
                      <ul className="flex flex-col gap-2">
                        {appointments.map((a) => (
                          <li
                            key={a.id}
                            className="flex items-center gap-3 rounded-xl bg-canvas/60 ring-1 ring-inset ring-hairline px-4 py-2.5"
                          >
                            <Link
                              href={`/dashboard/visits/appointments/${a.id}` as never}
                              className="font-mono text-[11px] font-bold text-brand-700 hover:underline shrink-0"
                            >
                              {a.visitNumber}
                            </Link>
                            <span className="text-[11px] text-slate-500 flex-1" dir="ltr">
                              {formatDateTime(a.scheduledAt)}
                            </span>
                            <AppointmentStatusBadge status={a.status} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </PremiumSectionCard>
            )}

            {/* Reservations */}
            {reservations.length > 0 && (
              <PremiumSectionCard
                icon={<BookmarkCheck />}
                title="الحجوزات المرتبطة"
                trailing={
                  <span className="inline-flex h-5 min-w-[22px] px-1.5 items-center justify-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-700 tabular-nums">
                    {reservations.length}
                  </span>
                }
                padded={false}
              >
                <div className="p-5 sm:p-6 space-y-2">
                  {reservations.map((r) => {
                    const projectName = r.unit?.building?.phase?.project?.name
                      ? tx(r.unit.building.phase.project.name)
                      : null;
                    return (
                      <div
                        key={r.id}
                        className="flex items-center gap-3 rounded-xl bg-canvas/60 ring-1 ring-inset ring-hairline px-4 py-2.5"
                      >
                        <Link
                          href={`/dashboard/reservations/${r.id}` as never}
                          className="font-mono text-[11px] font-bold text-brand-700 hover:underline shrink-0"
                        >
                          {r.reservationNumber ?? r.id.slice(0, 8)}
                        </Link>
                        <span className="text-[11px] text-slate-600 flex-1 truncate min-w-0">
                          {projectName ? `${projectName} · ` : ''}{r.unit?.code ?? '—'}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0 whitespace-nowrap tabular-nums" dir="ltr">
                          {formatDate(r.expiresAt)}
                        </span>
                        <ReservationStatusBadge status={r.status} />
                      </div>
                    );
                  })}
                </div>
                <div className="px-5 sm:px-6 pb-4">
                  <Link
                    href={`/dashboard/reservations?leadId=${lead.id}` as never}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:text-brand-800"
                  >
                    عرض كل الحجوزات
                    <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
                  </Link>
                </div>
              </PremiumSectionCard>
            )}

            {/* Timeline */}
            <PremiumSectionCard
              icon={<Activity />}
              title="سجل النشاط"
              description="التغييرات والتفاعلات على هذه الفرصة"
            >
              {(!lead.activities || lead.activities.length === 0) ? (
                <div className="flex flex-col items-center gap-2 py-4 text-center">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                    <Activity className="h-5 w-5" />
                  </span>
                  <p className="text-[13px] font-semibold text-slate-600">لا يوجد نشاط بعد</p>
                  <p className="text-[11px] text-slate-400">ستظهر التغييرات والتفاعلات هنا تلقائياً.</p>
                </div>
              ) : (
                <ul className="relative space-y-0 ps-5 before:absolute before:start-2 before:top-2 before:bottom-2 before:w-px before:bg-hairline">
                  {lead.activities.map((a) => {
                    const meta = renderLeadActivity(a.type, a.payload);
                    return (
                      <li key={a.id} className="relative flex items-start gap-3 pb-4 last:pb-0">
                        <span className={cn(
                          'absolute -start-[17px] top-1.5 h-3 w-3 rounded-full border-2 border-surface shrink-0',
                          meta.dotColor,
                        )} />
                        <div className="flex-1 min-w-0 pt-px">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span className="text-[12px] font-semibold text-slate-700">{meta.label}</span>
                            {meta.link && (
                              <Link
                                href={meta.link as never}
                                className="font-mono text-[10px] font-bold text-brand-700 hover:underline"
                              >
                                {meta.linkLabel}
                              </Link>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5 tabular-nums" dir="ltr">
                            {formatDateTime(a.createdAt)}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </PremiumSectionCard>
          </>
        }
        side={
          <>
            {/* Quick actions */}
            <PremiumCommandPanel title="إجراءات سريعة" icon={<Zap />}>
              {lead.client?.id && (
                <Link href={`/dashboard/clients/${lead.client.id}` as never} className={CMD_LINK}>
                  <span className={CMD_ICON}><User /></span>
                  <span>ملف العميل</span>
                </Link>
              )}
              {displayPhone && (
                <a href={`tel:${displayPhone}`} className={CMD_LINK}>
                  <span className={CMD_ICON}><Phone /></span>
                  <span dir="ltr">{displayPhone}</span>
                </a>
              )}
              {displayEmail && (
                <a href={`mailto:${displayEmail}`} className={CMD_LINK}>
                  <span className={CMD_ICON}><Mail /></span>
                  <span className="truncate min-w-0" dir="ltr">{displayEmail}</span>
                </a>
              )}
            </PremiumCommandPanel>

            {/* Assignment */}
            <PremiumSectionCard icon={<UserCog />} title="إسناد المبيعات" padded={false}>
              <div className="p-5 space-y-3">
                {/* Current assignee chip */}
                <div className="flex items-center gap-3 rounded-xl bg-canvas/60 ring-1 ring-inset ring-hairline px-3.5 py-3">
                  {lead.assignedSales ? (
                    <>
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-[11px] font-bold shrink-0 ring-1 ring-white">
                        {initials(lead.assignedSales.fullName)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-slate-900 truncate leading-tight">
                          {lead.assignedSales.fullName}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">المسؤول الحالي</p>
                      </div>
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    </>
                  ) : (
                    <p className="text-[12px] text-slate-400 italic">— غير مسند —</p>
                  )}
                </div>

                {/* Update form */}
                <form action={assignLeadAction.bind(null, lead.id)} className="flex flex-col gap-2">
                  <Select
                    name="assignedSalesId"
                    defaultValue={lead.assignedSalesId ?? ''}
                    inputSize="sm"
                  >
                    <option value="">— اختر مندوب —</option>
                    {salesRes.data?.data.map((s) => (
                      <option key={s.id} value={s.id}>{salesActorLabel(s)}</option>
                    ))}
                  </Select>
                  <Button type="submit" variant="secondary" size="sm" className="w-full">
                    تحديث الإسناد
                  </Button>
                </form>
              </div>
            </PremiumSectionCard>

            {/* Client */}
            <PremiumSectionCard icon={<User />} title="معلومات العميل">
              <div className="space-y-2.5">
                {lead.client ? (
                  <p className="text-[15px] font-bold text-slate-900">{lead.client.fullName}</p>
                ) : (
                  <p className="text-[13px] font-semibold text-slate-500">{displayName}</p>
                )}

                {displayPhone && (
                  <a
                    href={`tel:${displayPhone}`}
                    className="flex items-center gap-2.5 rounded-xl bg-canvas/60 px-3 py-2.5 ring-1 ring-inset ring-hairline hover:bg-canvas transition-colors"
                  >
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 [&_svg]:h-3.5 [&_svg]:w-3.5">
                      <Phone />
                    </span>
                    <span className="text-[13px] font-medium text-slate-700" dir="ltr">{displayPhone}</span>
                  </a>
                )}

                {displayEmail && (
                  <a
                    href={`mailto:${displayEmail}`}
                    className="flex items-center gap-2.5 rounded-xl bg-canvas/60 px-3 py-2.5 ring-1 ring-inset ring-hairline hover:bg-canvas transition-colors"
                  >
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600 [&_svg]:h-3.5 [&_svg]:w-3.5">
                      <Mail />
                    </span>
                    <span className="text-[13px] font-medium text-slate-700 truncate" dir="ltr">{displayEmail}</span>
                  </a>
                )}

                {lead.client && (
                  <div className="pt-1 flex items-center justify-between">
                    <span className={cn(
                      'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border',
                      lead.client.role === 'CUSTOMER'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                        : 'bg-slate-100 text-slate-600 border-slate-200',
                    )}>
                      {lead.client.role === 'CUSTOMER' ? 'مالك' : 'متصفّح'}
                    </span>
                    <Link
                      href={`/dashboard/clients/${lead.client.id}` as never}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:text-brand-800"
                    >
                      ملف كامل
                      <ArrowLeft className="h-3 w-3 rtl:rotate-180" />
                    </Link>
                  </div>
                )}
              </div>
            </PremiumSectionCard>

            {/* Ad Attribution — only shown when at least one UTM field is set */}
            {(lead.utmSource || lead.utmMedium || lead.utmCampaign || lead.utmContent || lead.fbclid) && (
              <PremiumSectionCard icon={<BarChart2 />} title="مصدر الإعلان" padded={false}>
                <dl className="divide-y divide-hairline/60">
                  {lead.utmSource && (
                    <InfoRow label="المصدر (Source)" icon={<BarChart2 className="h-3.5 w-3.5" />}>
                      <span className="font-mono text-[12px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-lg">
                        {lead.utmSource}
                      </span>
                    </InfoRow>
                  )}
                  {lead.utmMedium && (
                    <InfoRow label="الوسيلة (Medium)" icon={<BarChart2 className="h-3.5 w-3.5" />}>
                      <span className="font-mono text-[12px] text-slate-700">{lead.utmMedium}</span>
                    </InfoRow>
                  )}
                  {lead.utmCampaign && (
                    <InfoRow label="الحملة (Campaign)" icon={<BarChart2 className="h-3.5 w-3.5" />}>
                      <span className="font-mono text-[12px] text-slate-700 text-end">{lead.utmCampaign}</span>
                    </InfoRow>
                  )}
                  {lead.utmContent && (
                    <InfoRow label="المحتوى (Content)" icon={<BarChart2 className="h-3.5 w-3.5" />}>
                      <span className="font-mono text-[12px] text-slate-700 text-end">{lead.utmContent}</span>
                    </InfoRow>
                  )}
                  {lead.fbclid && (
                    <InfoRow label="Facebook Click ID" icon={<BarChart2 className="h-3.5 w-3.5" />}>
                      <span className="font-mono text-[10px] text-slate-500 truncate max-w-[140px]">{lead.fbclid}</span>
                    </InfoRow>
                  )}
                </dl>
              </PremiumSectionCard>
            )}

            {/* Info fields */}
            <PremiumSectionCard icon={<Building2 />} title="معلومات الفرصة" padded={false}>
              <dl className="divide-y divide-hairline/60">

                {/* Project */}
                <InfoRow label="المشروع المهتم" icon={<Building2 className="h-3.5 w-3.5" />}>
                  {lead.projectInterest ? (
                    <span className="text-[13px] font-semibold text-slate-900 text-end leading-snug">
                      {tx(lead.projectInterest.name)}
                    </span>
                  ) : (
                    <span className="text-[12px] text-slate-400">—</span>
                  )}
                </InfoRow>

                {/* Unit */}
                {lead.unitInterest && (
                  <InfoRow label="الوحدة" icon={<DoorOpen className="h-3.5 w-3.5" />}>
                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      <span className="font-mono text-[12px] font-bold text-brand-700 bg-brand-50 border border-brand-100 px-2 py-0.5 rounded-lg">
                        {lead.unitInterest.code}
                      </span>
                      {lead.unitInterest.type && (
                        <span className="text-[11px] text-slate-500 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded-lg">
                          {lead.unitInterest.type}
                        </span>
                      )}
                    </div>
                  </InfoRow>
                )}

                {/* Source */}
                <InfoRow label="مصدر الفرصة" icon={<ArrowLeft className="h-3.5 w-3.5" />}>
                  {lead.brokerId ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                      من وسيط
                    </span>
                  ) : lead.source ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-100">
                      {tx(lead.source.name)}
                    </span>
                  ) : (
                    <span className="text-[12px] text-slate-500">مباشر</span>
                  )}
                </InfoRow>

                {/* Broker block — full-width indigo highlight */}
                {isBrokerLead && (
                  <div className="px-4 py-3">
                    <div className="rounded-[14px] bg-indigo-50 border border-indigo-100 px-4 py-3 space-y-2">
                      {/* Broker */}
                      <div className="flex items-center gap-2.5">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 shrink-0">
                          <Briefcase className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wide">الوسيط</p>
                          <p className="text-[13px] font-bold text-indigo-900 truncate leading-tight">
                            {brokerName ?? '—'}
                          </p>
                        </div>
                      </div>
                      {/* Agent */}
                      {lead.brokerAgent?.fullName && (
                        <div className="flex items-center gap-2.5 ps-[42px]">
                          <UserCog className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[10px] text-indigo-400">مندوب الوسيط</p>
                            <p className="text-[12px] font-semibold text-indigo-700 truncate">
                              {lead.brokerAgent.fullName}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Created */}
                <InfoRow label="تاريخ الإنشاء" icon={<Calendar className="h-3.5 w-3.5" />}>
                  <span className="text-[12px] font-semibold text-slate-700 tabular-nums" dir="ltr">
                    {formatDateTime(lead.createdAt)}
                  </span>
                </InfoRow>

                {/* ID */}
                <InfoRow label="معرّف الفرصة" icon={<Hash className="h-3.5 w-3.5" />}>
                  <span className="font-mono text-[13px] font-bold text-slate-600 tracking-wide">
                    #{lead.id.slice(0, 8).toUpperCase()}
                  </span>
                </InfoRow>

              </dl>
            </PremiumSectionCard>
          </>
        }
      />
    </div>
  );
}

// ── InfoRow — label+icon on right, value on left (RTL) ───────────────────────

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
    <div className="flex items-center justify-between gap-3 px-4 py-3.5">
      <dt className="inline-flex items-center gap-1.5 shrink-0 text-[11px] font-semibold text-slate-400">
        <span className="text-slate-300 shrink-0">{icon}</span>
        {label}
      </dt>
      <dd className="flex items-center justify-end min-w-0 flex-1">{children}</dd>
    </div>
  );
}

// ── Activity renderer ─────────────────────────────────────────────────────────

interface ActivityMeta {
  label: string;
  dotColor: string;
  link?: string;
  linkLabel?: string;
}

const RESERVATION_LABELS: Record<string, string> = {
  CREATED:   'تم إنشاء حجز',
  APPROVED:  'تمت الموافقة على الحجز',
  REJECTED:  'تم رفض الحجز',
  CANCELLED: 'تم إلغاء الحجز',
  EXPIRED:   'انتهت صلاحية الحجز',
};

function renderLeadActivity(type: string, payload: unknown): ActivityMeta {
  const p = (payload ?? {}) as Record<string, unknown>;

  if (type === 'reservation') {
    const status = typeof p.status === 'string' ? p.status : '';
    const reservationId = typeof p.reservationId === 'string' ? p.reservationId : undefined;
    const reservationNumber = typeof p.reservationNumber === 'string' ? p.reservationNumber : undefined;
    return {
      label: RESERVATION_LABELS[status] ?? 'تحديث على الحجز',
      dotColor:
        status === 'APPROVED'
          ? 'bg-emerald-400'
          : status === 'REJECTED' || status === 'CANCELLED'
            ? 'bg-rose-400'
            : status === 'EXPIRED'
              ? 'bg-amber-400'
              : 'bg-brand-400',
      link: reservationId ? `/dashboard/reservations/${reservationId}` : undefined,
      linkLabel: reservationNumber ?? reservationId?.slice(0, 8),
    };
  }

  if (type === 'status_change') {
    const from = typeof p.from === 'string' ? p.from : '';
    const to   = typeof p.to   === 'string' ? p.to   : '';
    return { label: `تغيير المرحلة: ${from} ← ${to}`, dotColor: 'bg-amber-400' };
  }

  if (type === 'note') {
    return { label: 'تم إضافة ملاحظة', dotColor: 'bg-slate-400' };
  }

  if (type === 'broker_submitted') {
    return { label: 'تم إرسال الفرصة من وسيط', dotColor: 'bg-indigo-400' };
  }

  return { label: type.replace(/_/g, ' '), dotColor: 'bg-brand-400' };
}
