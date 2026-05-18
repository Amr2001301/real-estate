import Link from 'next/link';
import {
  Building2,
  Home,
  CheckCircle2,
  UserCircle,
  ArrowLeft,
  Briefcase,
  Banknote,
  Activity,
  UserPlus,
  CalendarClock,
  XCircle,
  Copy,
  BookmarkCheck,
  FileText,
  FilePen,
  BadgePercent,
  Ban,
  Wallet,
  CircleDollarSign,
  Clock,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type {
  Paged,
  PortalActivityItem,
  PortalActivityType,
  PortalMe,
  PortalPerformanceResponse,
  PortalProject,
  PortalUnit,
} from '@/lib/types';
import { tx, formatDate, formatDateTime, formatCurrency } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageKpiCard } from '@/components/ui/page-kpi-card';
import { EmptyState } from '@/components/ui/empty-state';
import { BrokerStatusBadge, ProjectStatusBadge } from '@/components/badges';

const ACTIVITY_LABEL: Record<PortalActivityType, string> = {
  LEAD_SUBMITTED: 'إرسال فرصة',
  VISIT_REQUESTED: 'طلب زيارة',
  LEAD_APPROVED: 'اعتماد فرصة',
  LEAD_REJECTED: 'رفض فرصة',
  LEAD_MARKED_DUPLICATE: 'فرصة مكررة',
  RESERVATION_CREATED: 'إنشاء حجز',
  CONTRACT_CREATED: 'إنشاء عقد',
  CONTRACT_SIGNED: 'توقيع عقد',
  COMMISSION_EARNED: 'استحقاق عمولة',
  COMMISSION_APPROVED: 'اعتماد عمولة',
  COMMISSION_REJECTED: 'رفض عمولة',
  COMMISSION_CANCELLED: 'إلغاء عمولة',
  PAYOUT_CREATED: 'إنشاء دفعة',
  PAYOUT_APPROVED: 'اعتماد دفعة',
  PAYOUT_PROCESSING: 'دفعة قيد التنفيذ',
  PAYOUT_PAID: 'صرف دفعة',
  PAYOUT_CANCELLED: 'إلغاء دفعة',
};

const ACTIVITY_TONE: Record<PortalActivityType, string> = {
  LEAD_SUBMITTED: 'bg-blue-100 text-blue-700',
  VISIT_REQUESTED: 'bg-purple-100 text-purple-700',
  LEAD_APPROVED: 'bg-green-100 text-green-700',
  LEAD_REJECTED: 'bg-red-100 text-red-700',
  LEAD_MARKED_DUPLICATE: 'bg-amber-100 text-amber-700',
  RESERVATION_CREATED: 'bg-indigo-100 text-indigo-700',
  CONTRACT_CREATED: 'bg-cyan-100 text-cyan-700',
  CONTRACT_SIGNED: 'bg-emerald-100 text-emerald-700',
  COMMISSION_EARNED: 'bg-teal-100 text-teal-700',
  COMMISSION_APPROVED: 'bg-green-100 text-green-700',
  COMMISSION_REJECTED: 'bg-red-100 text-red-700',
  COMMISSION_CANCELLED: 'bg-gray-200 text-gray-600',
  PAYOUT_CREATED: 'bg-blue-100 text-blue-700',
  PAYOUT_APPROVED: 'bg-cyan-100 text-cyan-700',
  PAYOUT_PROCESSING: 'bg-amber-100 text-amber-700',
  PAYOUT_PAID: 'bg-emerald-100 text-emerald-700',
  PAYOUT_CANCELLED: 'bg-gray-200 text-gray-600',
};

function ActivityIcon({ type }: { type: PortalActivityType }) {
  const cls = 'h-3.5 w-3.5';
  switch (type) {
    case 'LEAD_SUBMITTED':
      return <UserPlus className={cls} />;
    case 'VISIT_REQUESTED':
      return <CalendarClock className={cls} />;
    case 'LEAD_APPROVED':
      return <CheckCircle2 className={cls} />;
    case 'LEAD_REJECTED':
      return <XCircle className={cls} />;
    case 'LEAD_MARKED_DUPLICATE':
      return <Copy className={cls} />;
    case 'RESERVATION_CREATED':
      return <BookmarkCheck className={cls} />;
    case 'CONTRACT_CREATED':
      return <FileText className={cls} />;
    case 'CONTRACT_SIGNED':
      return <FilePen className={cls} />;
    case 'COMMISSION_EARNED':
    case 'COMMISSION_APPROVED':
      return <BadgePercent className={cls} />;
    case 'COMMISSION_REJECTED':
      return <XCircle className={cls} />;
    case 'COMMISSION_CANCELLED':
      return <Ban className={cls} />;
    case 'PAYOUT_CREATED':
    case 'PAYOUT_APPROVED':
      return <Wallet className={cls} />;
    case 'PAYOUT_PROCESSING':
      return <Clock className={cls} />;
    case 'PAYOUT_PAID':
      return <CircleDollarSign className={cls} />;
    case 'PAYOUT_CANCELLED':
      return <Ban className={cls} />;
  }
}

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export default async function PortalDashboard() {
  const [meRes, projectsRes, availableUnitsRes, activityRes, perfRes] = await Promise.all([
    safe(api.get<PortalMe>('/portal/me')),
    safe(api.get<PortalProject[]>('/portal/projects')),
    safe(api.get<Paged<PortalUnit>>('/portal/units?status=AVAILABLE&pageSize=1')),
    safe(api.get<Paged<PortalActivityItem>>('/portal/activity?pageSize=8')),
    safe(api.get<PortalPerformanceResponse>('/portal/performance')),
  ]);

  if (meRes.error || !meRes.data) {
    return (
      <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-6 text-sm">
        تعذر تحميل بيانات البوابة: {meRes.error ?? 'غير متاحة'}
      </div>
    );
  }

  const me = meRes.data;
  const projects = projectsRes.data ?? [];
  const availableCount = availableUnitsRes.data?.meta.total ?? 0;
  const activity = activityRes.data?.data ?? [];
  const perf = perfRes.data?.summary;

  return (
    <div className="space-y-5">
      <PageHeader
        title={`أهلاً، ${me.user.fullName}`}
        description="نظرة سريعة على المشاريع والوحدات المتاحة للوسيط."
        breadcrumbs={[{ label: 'البوابة' }, { label: 'لوحة التحكم' }]}
        meta={
          <>
            <span className="text-xs text-slate-600">{me.broker.companyName}</span>
            <BrokerStatusBadge status={me.broker.status} />
            <span className="font-mono text-xs text-slate-500" dir="ltr">
              {me.broker.code}
            </span>
          </>
        }
      />

      {(projectsRes.error || availableUnitsRes.error) && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          تعذر تحميل بعض البيانات: {projectsRes.error ?? availableUnitsRes.error}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <PageKpiCard
          label="المشاريع المتاحة"
          value={projects.length}
          icon={<Building2 />}
          tone="brand"
        />
        <PageKpiCard
          label="الوحدات المتاحة للبيع"
          value={availableCount}
          icon={<CheckCircle2 />}
          tone="success"
        />
        <PageKpiCard
          label="النسبة الافتراضية"
          value={`${Number(me.broker.defaultCommissionPct ?? 0).toFixed(2)}%`}
          icon={<Banknote />}
          tone="info"
        />
        <PageKpiCard
          label="حالة الحساب"
          value={me.brokerUser.status === 'ACTIVE' ? 'نشط' : me.brokerUser.status}
          icon={<UserCircle />}
          tone={me.brokerUser.status === 'ACTIVE' ? 'success' : 'warning'}
          sub={me.brokerUser.jobTitle ?? undefined}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-brand-600" />
              أحدث المشاريع المتاحة
            </h2>
            <Link href="/portal/projects">
              <Button variant="ghost" size="sm" rightIcon={<ArrowLeft className="h-3.5 w-3.5" />}>
                عرض الكل
              </Button>
            </Link>
          </div>

          {projects.length === 0 ? (
            <EmptyState
              icon={<Building2 />}
              title="لا توجد مشاريع مسموح بها بعد"
              description="سيتواصل معك مدير المشاريع لمنح الصلاحيات."
            />
          ) : (
            <ul className="divide-y divide-hairline">
              {projects.slice(0, 6).map((p) => (
                <li
                  key={p.project.id}
                  className="py-3 flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 truncate">
                      {tx(p.project.name)}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {p.project.city} •{' '}
                      <span className="inline-block align-middle">
                        <ProjectStatusBadge status={p.project.status} />
                      </span>
                    </p>
                  </div>
                  <div className="text-end text-xs text-slate-500 shrink-0">
                    {p.access.commissionPct !== null && p.access.commissionPct !== undefined
                      ? `${Number(p.access.commissionPct).toFixed(2)}%`
                      : '—'}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">روابط سريعة</h2>
          <div className="flex flex-col gap-2">
            <Link href="/portal/leads/new">
              <Button variant="primary" size="md" leftIcon={<UserPlus className="h-4 w-4" />} fullWidth>
                إضافة فرصة
              </Button>
            </Link>
            <Link href="/portal/visits/new">
              <Button variant="outline" size="md" leftIcon={<CalendarClock className="h-4 w-4" />} fullWidth>
                طلب زيارة
              </Button>
            </Link>
            <Link href="/portal/reservations/new">
              <Button variant="outline" size="md" leftIcon={<BookmarkCheck className="h-4 w-4" />} fullWidth>
                حجز جديد
              </Button>
            </Link>
            <div className="grid grid-cols-2 gap-2">
              <Link href="/portal/commissions">
                <Button variant="ghost" size="sm" leftIcon={<BadgePercent className="h-3.5 w-3.5" />} fullWidth>
                  العمولات
                </Button>
              </Link>
              <Link href="/portal/payouts">
                <Button variant="ghost" size="sm" leftIcon={<Wallet className="h-3.5 w-3.5" />} fullWidth>
                  المدفوعات
                </Button>
              </Link>
              <Link href="/portal/projects">
                <Button variant="ghost" size="sm" leftIcon={<Building2 className="h-3.5 w-3.5" />} fullWidth>
                  المشاريع
                </Button>
              </Link>
              <Link href="/portal/units">
                <Button variant="ghost" size="sm" leftIcon={<Home className="h-3.5 w-3.5" />} fullWidth>
                  الوحدات
                </Button>
              </Link>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-hairline text-2xs text-slate-500 space-y-1">
            <p>
              عقد الوساطة:{' '}
              <span className="text-slate-700">
                {formatDate(me.broker.contractStartAt)} → {formatDate(me.broker.contractEndAt)}
              </span>
            </p>
            {me.permissions.isPrimaryContact && <p>أنت جهة الاتصال الرئيسية للوسيط.</p>}
          </div>
        </Card>
      </div>

      {perf && (
        <Card className="p-5">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <BadgePercent className="h-4 w-4 text-brand-600" />
              ملخص الأداء
            </h2>
            <Link href="/portal/performance">
              <Button variant="ghost" size="sm" rightIcon={<ArrowLeft className="h-3.5 w-3.5" />}>
                التفاصيل الكاملة
              </Button>
            </Link>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="rounded-xl border border-hairline px-3 py-3">
              <p className="text-2xs text-slate-500">فرص مُرسلة</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">{perf.leadsSubmitted}</p>
            </div>
            <div className="rounded-xl border border-hairline px-3 py-3">
              <p className="text-2xs text-slate-500">حجوزات</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">{perf.reservationsCreated}</p>
            </div>
            <div className="rounded-xl border border-hairline px-3 py-3">
              <p className="text-2xs text-slate-500">عقود موقّعة</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">{perf.contractsSigned}</p>
            </div>
            <div className="rounded-xl border border-hairline px-3 py-3 bg-amber-50/40">
              <p className="text-2xs text-slate-500">عمولات معتمدة</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-amber-700">{perf.commissionsApproved}</p>
            </div>
            <div className="rounded-xl border border-hairline px-3 py-3 bg-emerald-50/40">
              <p className="text-2xs text-slate-500">مدفوع (صافي)</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-emerald-700">
                {formatCurrency(perf.payoutsTotalNet)}
              </p>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Activity className="h-4 w-4 text-brand-600" />
            أحدث النشاط
          </h2>
          <Link href="/portal/activity">
            <Button variant="ghost" size="sm" rightIcon={<ArrowLeft className="h-3.5 w-3.5" />}>
              عرض الكل
            </Button>
          </Link>
        </div>

        {activityRes.error && (
          <p className="text-2xs text-danger-700">
            تعذر تحميل النشاط: {activityRes.error}
          </p>
        )}

        {activity.length === 0 && !activityRes.error ? (
          <EmptyState
            icon={<Activity />}
            title="لا يوجد نشاط بعد"
            description="ستظهر الأحداث الأخيرة هنا فور وقوعها."
          />
        ) : (
          <ol className="divide-y divide-hairline">
            {activity.slice(0, 8).map((item) => {
              const linkHref =
                item.entityType === 'VisitRequest'
                  ? '/portal/visits'
                  : item.entityType === 'Reservation'
                    ? `/portal/reservations/${item.entityId}`
                    : item.entityType === 'Contract'
                      ? `/portal/contracts/${item.entityId}`
                      : item.entityType === 'Commission'
                        ? `/portal/commissions/${item.entityId}`
                        : item.entityType === 'Payout'
                          ? `/portal/payouts/${item.entityId}`
                          : item.lead
                            ? `/portal/leads/${item.lead.id}`
                            : '/portal/activity';
              return (
                <li key={item.id} className="py-2.5 flex items-start gap-3">
                  <span
                    className={`inline-flex h-7 w-7 items-center justify-center rounded-full shrink-0 ${ACTIVITY_TONE[item.type]}`}
                  >
                    <ActivityIcon type={item.type} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <Link
                        href={linkHref as never}
                        className="text-sm font-semibold text-slate-900 hover:text-brand-700"
                      >
                        {ACTIVITY_LABEL[item.type]}
                      </Link>
                      <span className="text-2xs text-slate-400">
                        {formatDateTime(item.createdAt)}
                      </span>
                    </div>
                    <p className="text-2xs text-slate-500 mt-0.5">
                      {item.lead ? (
                        <>
                          {item.lead.fullName}
                          {item.lead.projectInterest && (
                            <> • {tx(item.lead.projectInterest.name)}</>
                          )}
                        </>
                      ) : (
                        'حدث على مستوى شركة الوساطة'
                      )}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Card>
    </div>
  );
}
