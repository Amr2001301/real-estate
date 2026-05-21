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
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type {
  Lead,
  Paged,
  Reservation,
  User,
  LeadStage,
  VisitRequest,
  VisitAppointment,
} from '@/lib/types';
import { formatDate, formatDateTime, tx } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/ui/empty-state';
import {
  LeadStageBadge,
  ReservationStatusBadge,
  VisitRequestStatusBadge,
  AppointmentStatusBadge,
} from '@/components/badges';
import { StageSegmented } from '@/components/crm/stage-segmented';
import { addNoteAction, assignLeadAction } from '../actions';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface LeadDetail extends Lead {
  activities?: Array<{ id: string; type: string; payload: unknown; createdAt: string }>;
}

const STAGES: LeadStage[] = ['NEW', 'INTERESTED', 'VISIT', 'NEGOTIATION', 'WON', 'LOST'];

function firstLetter(name: string): string {
  return name.trim().charAt(0) || '·';
}

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [leadRes, salesRes, visitRequestsRes, appointmentsRes, reservationsRes] =
    await Promise.all([
      safe(api.get<LeadDetail>(`/leads/${id}`)),
      safe(api.get<Paged<User>>('/users?role=SALES&pageSize=100')),
      safe(api.get<Paged<VisitRequest>>(`/visits/requests?leadId=${id}&pageSize=10`)),
      safe(api.get<Paged<VisitAppointment>>(`/visits/appointments?leadId=${id}&pageSize=10`)),
      safe(api.get<Paged<Reservation>>(`/reservations?leadId=${id}&pageSize=10`)),
    ]);

  if (leadRes.error || !leadRes.data) {
    return (
      <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-6 text-sm">
        تعذر تحميل بيانات العميل: {leadRes.error ?? 'غير موجود'}
      </div>
    );
  }
  const lead = leadRes.data;
  const visitRequests = visitRequestsRes.data?.data ?? [];
  const appointments = appointmentsRes.data?.data ?? [];
  const reservations = reservationsRes.data?.data ?? [];
  // Prefer the linked client's contact info; fall back to the denormalized
  // copy on the lead row for older records.
  const displayName = lead.client?.fullName ?? lead.fullName;
  const displayPhone = lead.client?.phone ?? lead.phone ?? null;
  const displayEmail = lead.client?.email ?? lead.email ?? null;

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        title={displayName}
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'فرص المبيعات (CRM)', href: '/dashboard/leads' },
          { label: displayName },
        ]}
        meta={
          <>
            <LeadStageBadge stage={lead.stage} />
            {displayPhone && (
              <span className="text-sm text-slate-500" dir="ltr">
                {displayPhone}
              </span>
            )}
            {displayEmail && (
              <span className="text-sm text-slate-500" dir="ltr">
                · {displayEmail}
              </span>
            )}
          </>
        }
        actions={
          <>
            {lead.client?.id && (
              <Link href={`/dashboard/clients/${lead.client.id}` as never}>
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  leftIcon={<ExternalLink className="h-4 w-4" />}
                >
                  ملف العميل
                </Button>
              </Link>
            )}
            {displayPhone && (
              <a href={`tel:${displayPhone}`}>
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  leftIcon={<Phone className="h-4 w-4" />}
                >
                  اتصال
                </Button>
              </a>
            )}
            {displayEmail && (
              <a href={`mailto:${displayEmail}`}>
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  leftIcon={<Mail className="h-4 w-4" />}
                >
                  إرسال بريد
                </Button>
              </a>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          {/* Stage selector */}
          <Card className="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900 tracking-tight">
                  مرحلة الفرصة
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  انقل الفرصة بين مراحل البيع المختلفة
                </p>
              </div>
            </div>
            <StageSegmented leadId={lead.id} currentStage={lead.stage} stages={STAGES} />
          </Card>

          {/* Notes */}
          <Card className="p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="h-5 w-5 text-brand-600" />
              <h2 className="text-base font-semibold text-slate-900 tracking-tight">
                الملاحظات
              </h2>
              <span className="ms-auto text-2xs font-semibold text-slate-400">
                {lead.notes?.length ?? 0} ملاحظة
              </span>
            </div>

            <form action={addNoteAction.bind(null, lead.id)} className="mb-5 flex flex-col gap-2">
              <Textarea
                name="body"
                required
                rows={3}
                placeholder="اكتب ملاحظة جديدة عن آخر تفاعل مع العميل…"
              />
              <div className="flex justify-end">
                <Button type="submit" variant="primary" size="sm">
                  حفظ الملاحظة
                </Button>
              </div>
            </form>

            {(!lead.notes || lead.notes.length === 0) ? (
              <EmptyState
                icon={<MessageSquare />}
                title="لا توجد ملاحظات بعد"
                description="ابدأ بتدوين أول ملاحظة لتتبع تفاعلاتك مع العميل."
              />
            ) : (
              <ul className="space-y-3">
                {lead.notes.map((n) => (
                  <li
                    key={n.id}
                    className="relative rounded-2xl bg-surface-muted/50 border border-hairline px-4 py-3 ps-5"
                  >
                    <span
                      aria-hidden
                      className="absolute end-0 top-3 bottom-3 w-[3px] rounded-e-full bg-brand-500"
                    />
                    <p className="text-sm text-slate-800 leading-relaxed">{n.body}</p>
                    <p className="mt-2 text-2xs text-slate-400 flex items-center gap-1.5">
                      <UserCog className="h-3 w-3" />
                      {n.sales?.fullName ?? 'مجهول'} · {formatDateTime(n.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Visits section */}
          {(visitRequests.length > 0 || appointments.length > 0) && (
            <Card className="p-5 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <CalendarClock className="h-5 w-5 text-brand-600" />
                <h2 className="text-base font-semibold text-slate-900 tracking-tight">الزيارات</h2>
              </div>

              {visitRequests.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">طلبات الزيارة</p>
                  <ul className="space-y-2">
                    {visitRequests.map((r) => (
                      <li key={r.id} className="flex items-center justify-between gap-3 rounded-xl bg-surface-muted/50 px-3 py-2 text-sm">
                        <Link href={`/dashboard/visits/requests/${r.id}` as never} className="text-brand-700 hover:underline font-mono text-xs">
                          {r.requestNumber ?? r.id.slice(0, 8)}
                        </Link>
                        <span className="text-slate-500 text-xs">{formatDate(r.preferredDate)}</span>
                        {r.requestStatus && <VisitRequestStatusBadge status={r.requestStatus} />}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {appointments.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">الزيارات المجدولة</p>
                  <ul className="space-y-2">
                    {appointments.map((a) => (
                      <li key={a.id} className="flex items-center justify-between gap-3 rounded-xl bg-surface-muted/50 px-3 py-2 text-sm">
                        <Link href={`/dashboard/visits/appointments/${a.id}` as never} className="text-brand-700 hover:underline font-mono text-xs">
                          {a.visitNumber}
                        </Link>
                        <span className="text-slate-500 text-xs">{formatDateTime(a.scheduledAt)}</span>
                        <AppointmentStatusBadge status={a.status} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          )}

          {/* Reservations */}
          {reservations.length > 0 && (
            <Card className="p-5 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <BookmarkCheck className="h-5 w-5 text-brand-600" />
                <h2 className="text-base font-semibold text-slate-900 tracking-tight">
                  الحجوزات المرتبطة
                </h2>
                <span className="ms-auto text-2xs font-semibold text-slate-400">
                  {reservations.length} حجز
                </span>
              </div>
              <ul className="space-y-2">
                {reservations.map((r) => {
                  const projectName = r.unit?.building?.phase?.project?.name
                    ? tx(r.unit.building.phase.project.name)
                    : null;
                  return (
                    <li
                      key={r.id}
                      className="flex items-center justify-between gap-3 rounded-xl bg-surface-muted/50 px-3 py-2 text-sm"
                    >
                      <Link
                        href={`/dashboard/reservations/${r.id}` as never}
                        className="text-brand-700 hover:underline font-mono text-xs"
                      >
                        {r.reservationNumber ?? r.id.slice(0, 8)}
                      </Link>
                      <span className="text-slate-600 text-xs truncate">
                        {projectName ? `${projectName} · ` : ''}
                        {r.unit?.code ?? '—'}
                      </span>
                      <span className="text-slate-500 text-xs">
                        ينتهي {formatDate(r.expiresAt)}
                      </span>
                      <ReservationStatusBadge status={r.status} />
                    </li>
                  );
                })}
              </ul>
              <div className="mt-3 flex justify-end">
                <Link
                  href={`/dashboard/reservations?leadId=${lead.id}` as never}
                  className="text-xs font-semibold text-brand-700 hover:text-brand-800 inline-flex items-center gap-1"
                >
                  عرض كل الحجوزات
                  <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
                </Link>
              </div>
            </Card>
          )}

          {/* Timeline */}
          <Card className="p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="h-5 w-5 text-brand-600" />
              <h2 className="text-base font-semibold text-slate-900 tracking-tight">
                السجل الزمني
              </h2>
            </div>
            {(!lead.activities || lead.activities.length === 0) ? (
              <EmptyState
                icon={<Activity />}
                title="لا يوجد نشاط بعد"
                description="ستظهر التغييرات والتفاعلات هنا تلقائياً."
              />
            ) : (
              <ul className="space-y-3">
                {lead.activities.map((a) => {
                  const meta = renderLeadActivity(a.type, a.payload);
                  return (
                    <li key={a.id} className="flex items-start gap-3">
                      <span
                        className={`mt-1 inline-flex h-2 w-2 rounded-full shrink-0 ${meta.dotColor}`}
                      />
                      <div className="flex-1 min-w-0 flex flex-wrap items-baseline gap-2">
                        <span className="text-xs font-medium text-slate-700">
                          {meta.label}
                        </span>
                        {meta.link && (
                          <Link
                            href={meta.link as never}
                            className="font-mono text-2xs text-brand-700 hover:underline"
                          >
                            {meta.linkLabel}
                          </Link>
                        )}
                        <span className="text-2xs text-slate-400">
                          {formatDateTime(a.createdAt)}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          {/* Assignment */}
          <Card className="p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <UserCog className="h-5 w-5 text-brand-600" />
              <h2 className="text-base font-semibold text-slate-900 tracking-tight">
                إسناد المبيعات
              </h2>
            </div>

            <div className="flex items-center gap-3 rounded-2xl bg-surface-muted/60 px-3 py-3 mb-4">
              {lead.assignedSales ? (
                <>
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-xs font-bold ring-1 ring-inset ring-white">
                    {firstLetter(lead.assignedSales.fullName)}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {lead.assignedSales.fullName}
                    </p>
                    <p className="text-2xs text-slate-500">المسؤول الحالي</p>
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-500">— غير مسند —</p>
              )}
            </div>

            <form action={assignLeadAction.bind(null, lead.id)} className="flex flex-col gap-2">
              <Select
                name="assignedSalesId"
                defaultValue={lead.assignedSalesId ?? ''}
                inputSize="sm"
              >
                <option value="">— اختر مندوب —</option>
                {salesRes.data?.data.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName}
                  </option>
                ))}
              </Select>
              <Button type="submit" variant="secondary" size="sm">
                تحديث الإسناد
              </Button>
            </form>
          </Card>

          {/* Linked Client */}
          {lead.client && (
            <Card className="p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
                  العميل المرتبط
                </h3>
                <Link
                  href={`/dashboard/clients/${lead.client.id}` as never}
                  className="text-xs font-semibold text-brand-700 hover:text-brand-800 inline-flex items-center gap-1"
                >
                  ملف العميل
                  <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
                </Link>
              </div>
              <Link
                href={`/dashboard/clients/${lead.client.id}` as never}
                className="flex items-center gap-3 rounded-2xl bg-surface-muted/60 hover:bg-surface-muted px-3 py-3 transition-colors"
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-sm font-bold ring-1 ring-inset ring-white">
                  {firstLetter(lead.client.fullName)}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {lead.client.fullName}
                  </p>
                  <p className="text-2xs text-slate-500 mt-0.5" dir="ltr">
                    {lead.client.phone ?? lead.client.email ?? '—'}
                  </p>
                </div>
                <Badge
                  tone={lead.client.role === 'CUSTOMER' ? 'success' : 'info'}
                  variant="soft"
                  size="sm"
                  className="ms-auto"
                >
                  {lead.client.role === 'CUSTOMER' ? 'مالك' : 'متصفّح'}
                </Badge>
              </Link>
            </Card>
          )}

          {/* Info */}
          <Card className="p-5 sm:p-6">
            <h2 className="text-base font-semibold text-slate-900 tracking-tight mb-4">
              معلومات
            </h2>
            <dl className="flex flex-col gap-3 text-sm">
              <Row label="المشروع المهتم" icon={<Building2 className="h-3.5 w-3.5" />}>
                {lead.projectInterest ? (
                  <span className="font-medium text-slate-900">
                    {tx(lead.projectInterest.name)}
                  </span>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </Row>
              <Row label="مصدر الفرصة" icon={<ArrowLeft className="h-3.5 w-3.5" />}>
                {lead.brokerId ? (
                  <Badge tone="brand" variant="soft" size="sm">
                    من وسيط
                  </Badge>
                ) : lead.source ? (
                  <Badge tone="info" variant="soft" size="sm">
                    {tx(lead.source.name)}
                  </Badge>
                ) : (
                  <span className="text-slate-400">مباشر</span>
                )}
              </Row>
              {lead.brokerId && (
                <>
                  <Row label="الوسيط" icon={<Briefcase className="h-3.5 w-3.5" />}>
                    {lead.broker ? (
                      <span className="font-medium text-slate-900">
                        {lead.broker.commercialName || lead.broker.companyName}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </Row>
                  <Row label="مندوب الوسيط" icon={<UserCog className="h-3.5 w-3.5" />}>
                    {lead.brokerAgent?.fullName ? (
                      <span className="text-slate-700">{lead.brokerAgent.fullName}</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </Row>
                </>
              )}
              <Row label="تاريخ الإنشاء" icon={<Calendar className="h-3.5 w-3.5" />}>
                <span className="text-slate-700">{formatDateTime(lead.createdAt)}</span>
              </Row>
              <Row label="معرّف الفرصة" icon={<UserCog className="h-3.5 w-3.5" />}>
                <span className="font-mono text-2xs text-slate-500">
                  #{lead.id.slice(0, 8).toUpperCase()}
                </span>
              </Row>
            </dl>
          </Card>

          {/* Quick contact card */}
          {(displayPhone || displayEmail) && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-900 tracking-tight mb-3">
                وسائل التواصل
              </h3>
              <div className="flex flex-col gap-2">
                {displayPhone && (
                  <a
                    href={`tel:${displayPhone}`}
                    className="flex items-center gap-3 rounded-xl bg-surface-muted/60 hover:bg-surface-muted px-3 py-2.5 transition-colors"
                  >
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                      <Phone className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-2xs text-slate-500">الهاتف</p>
                      <p className="text-sm font-mono text-slate-900" dir="ltr">
                        {displayPhone}
                      </p>
                    </div>
                  </a>
                )}
                {displayEmail && (
                  <a
                    href={`mailto:${displayEmail}`}
                    className="flex items-center gap-3 rounded-xl bg-surface-muted/60 hover:bg-surface-muted px-3 py-2.5 transition-colors"
                  >
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-info-50 text-info-600">
                      <Mail className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-2xs text-slate-500">البريد الإلكتروني</p>
                      <p className="text-sm text-slate-900 truncate" dir="ltr">
                        {displayEmail}
                      </p>
                    </div>
                  </a>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({
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
      <dt className="inline-flex items-center gap-1.5 text-2xs uppercase tracking-wide text-slate-500 font-semibold">
        <span className="text-slate-400">{icon}</span>
        {label}
      </dt>
      <dd className="text-end">{children}</dd>
    </div>
  );
}

interface ActivityMeta {
  label: string;
  dotColor: string;
  link?: string;
  linkLabel?: string;
}

const RESERVATION_LABELS: Record<string, string> = {
  CREATED: 'تم إنشاء حجز',
  APPROVED: 'تمت الموافقة على الحجز',
  REJECTED: 'تم رفض الحجز',
  CANCELLED: 'تم إلغاء الحجز',
  EXPIRED: 'انتهت صلاحية الحجز',
};

function renderLeadActivity(type: string, payload: unknown): ActivityMeta {
  const p = (payload ?? {}) as Record<string, unknown>;

  if (type === 'reservation') {
    const status = typeof p.status === 'string' ? p.status : '';
    const reservationId = typeof p.reservationId === 'string' ? p.reservationId : undefined;
    const reservationNumber =
      typeof p.reservationNumber === 'string' ? p.reservationNumber : undefined;
    return {
      label: RESERVATION_LABELS[status] ?? 'تحديث على الحجز',
      dotColor:
        status === 'APPROVED'
          ? 'bg-success-500'
          : status === 'REJECTED' || status === 'CANCELLED'
            ? 'bg-danger-500'
            : status === 'EXPIRED'
              ? 'bg-warning-500'
              : 'bg-brand-500',
      link: reservationId ? `/dashboard/reservations/${reservationId}` : undefined,
      linkLabel: reservationNumber ?? reservationId?.slice(0, 8),
    };
  }

  if (type === 'status_change') {
    const from = typeof p.from === 'string' ? p.from : '';
    const to = typeof p.to === 'string' ? p.to : '';
    return {
      label: `تغيير المرحلة: ${from} ← ${to}`,
      dotColor: 'bg-warning-500',
    };
  }

  if (type === 'note') {
    return { label: 'تم إضافة ملاحظة', dotColor: 'bg-slate-400' };
  }

  return { label: type, dotColor: 'bg-brand-500' };
}
