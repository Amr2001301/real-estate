import Link from 'next/link';
import {
  Activity,
  BadgePercent,
  BarChart3,
  Bell,
  Briefcase,
  Clock,
  ExternalLink,
  Eye,
  Pencil,
  Plus,
  ScrollText,
  Settings,
  Shield,
  Trash2,
  TrendingUp,
  Users as UsersIcon,
  Wallet,
  Zap,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { AuditLogItem, OperationsSummary, Paged } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { PremiumMetricStrip, PremiumPageHero, PremiumSectionCard } from '@/components/premium';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/cn';

export const dynamic    = 'force-dynamic';
export const fetchCache = 'force-no-store';

// ── Area / event helpers ──────────────────────────────────────────────────────

function areaLabel(entityType: string): string {
  const et = entityType.toLowerCase();
  if (et.includes('auth'))               return 'المصادقة';
  if (et.includes('permission'))         return 'الصلاحيات';
  if (et.includes('broker-lead'))        return 'عملاء الوسطاء';
  if (et.includes('broker-reservation')) return 'حجوزات الوسطاء';
  if (et.includes('broker-contract'))    return 'عقود الوسطاء';
  if (et.includes('broker-commission'))  return 'عمولات الوسطاء';
  if (et.includes('broker-payout'))      return 'مدفوعات الوسطاء';
  if (et.includes('broker'))             return 'الوسطاء';
  if (et.includes('user'))               return 'المستخدمون';
  if (et.includes('reservation'))        return 'الحجوزات';
  if (et.includes('contract'))           return 'العقود';
  if (et.includes('payment'))            return 'الدفعات';
  if (et.includes('lead'))               return 'فرص المبيعات';
  if (et.includes('project'))            return 'المشاريع';
  if (et.includes('unit'))               return 'الوحدات';
  if (et.includes('maintenance'))        return 'الصيانة';
  if (et.includes('document'))           return 'المستندات';
  if (et.includes('visit'))              return 'الزيارات';
  if (et.includes('notification'))       return 'الإشعارات';
  if (et.includes('audit'))              return 'سجلات التدقيق';
  if (et.includes('setting'))            return 'الإعدادات';
  if (et.includes('sales-target'))       return 'أهداف المبيعات';
  if (et.includes('bonus'))              return 'المكافآت';
  if (et.includes('report'))             return 'التقارير';
  if (et.includes('installment'))        return 'الأقساط';
  if (et.includes('deposit'))            return 'الودائع';
  if (et.includes('balance'))            return 'الأرصدة';
  if (et.includes('target'))             return 'الأهداف';
  return 'نشاط غير مصنف';
}

function eventLabel(action: string, entityType: string): string {
  const m  = action.toUpperCase();
  const et = entityType.toLowerCase();
  const c  = (kw: string) => et.includes(kw);
  const is = (methods: string[]) => methods.includes(m);

  if (c('auth'))         return is(['POST']) ? 'محاولة دخول' : 'إجراء مصادقة';
  if (c('permission'))   return is(['POST', 'PATCH', 'PUT']) ? 'تعديل صلاحيات' : 'إجراء صلاحية';
  if (c('user')) {
    if (is(['POST']))         return 'إنشاء مستخدم';
    if (is(['PATCH', 'PUT'])) return 'تعديل مستخدم';
    if (is(['DELETE']))       return 'حذف مستخدم';
  }
  if (c('reservation')) {
    if (is(['POST']))         return 'إنشاء حجز';
    if (is(['PATCH', 'PUT'])) return 'تعديل حجز';
    if (is(['DELETE']))       return 'إلغاء حجز';
  }
  if (c('contract')) {
    if (is(['POST']))         return 'إنشاء عقد';
    if (is(['PATCH', 'PUT'])) return 'تعديل عقد';
    if (is(['DELETE']))       return 'حذف عقد';
  }
  if (c('payout')) {
    if (is(['POST']))         return 'تسجيل مدفوعات';
    if (is(['PATCH', 'PUT'])) return 'تعديل مدفوعات';
  }
  if (c('commission')) {
    if (is(['POST']))         return 'تسجيل عمولة';
    if (is(['PATCH', 'PUT'])) return 'تعديل عمولة';
  }
  if (c('broker')) {
    if (is(['POST']))         return 'إضافة وسيط';
    if (is(['PATCH', 'PUT'])) return 'تعديل وسيط';
    if (is(['DELETE']))       return 'حذف وسيط';
  }
  if (c('payment')) {
    if (is(['POST']))         return 'تسجيل دفعة';
    if (is(['PATCH', 'PUT'])) return 'تعديل دفعة';
  }
  if (c('lead')) {
    if (is(['POST']))         return 'إنشاء فرصة مبيعات';
    if (is(['PATCH', 'PUT'])) return 'تعديل فرصة مبيعات';
    if (is(['DELETE']))       return 'حذف فرصة مبيعات';
  }
  if (c('project')) {
    if (is(['POST']))         return 'إنشاء مشروع';
    if (is(['PATCH', 'PUT'])) return 'تعديل مشروع';
    if (is(['DELETE']))       return 'حذف مشروع';
  }
  if (c('unit')) {
    if (is(['POST']))         return 'إنشاء وحدة';
    if (is(['PATCH', 'PUT'])) return 'تعديل وحدة';
    if (is(['DELETE']))       return 'حذف وحدة';
  }
  if (c('maintenance')) {
    if (is(['POST']))         return 'طلب صيانة';
    if (is(['PATCH', 'PUT'])) return 'تعديل طلب صيانة';
  }
  if (c('document')) {
    if (is(['POST']))   return 'رفع مستند';
    if (is(['DELETE'])) return 'حذف مستند';
  }
  if (c('visit')) {
    if (is(['POST']))         return 'إنشاء زيارة';
    if (is(['PATCH', 'PUT'])) return 'تعديل زيارة';
  }
  if (c('notification')) return 'إرسال إشعار';
  if (c('setting')) {
    if (is(['POST', 'PATCH', 'PUT'])) return 'تعديل إعداد نظام';
    if (is(['DELETE']))               return 'حذف إعداد نظام';
  }
  if (is(['POST']))         return 'إنشاء سجل';
  if (is(['PATCH', 'PUT'])) return 'تعديل سجل';
  if (is(['DELETE']))       return 'حذف سجل';
  return 'إجراء نظام';
}

function methodBadgeCls(action: string): string {
  switch (action.toUpperCase()) {
    case 'POST':   return 'bg-emerald-50 text-emerald-700 border border-emerald-100';
    case 'PATCH':
    case 'PUT':    return 'bg-amber-50 text-amber-700 border border-amber-100';
    case 'DELETE': return 'bg-danger-50 text-danger-700 border border-danger-100';
    default:       return 'bg-slate-50 text-slate-600 border border-slate-200';
  }
}

function methodIconCls(action: string): string {
  switch (action.toUpperCase()) {
    case 'POST':   return 'bg-emerald-100 text-emerald-700';
    case 'PATCH':
    case 'PUT':    return 'bg-amber-100 text-amber-700';
    case 'DELETE': return 'bg-danger-100 text-danger-700';
    default:       return 'bg-slate-100 text-slate-600';
  }
}

function methodBarCls(action: string): string {
  switch (action.toUpperCase()) {
    case 'POST':   return 'bg-emerald-400';
    case 'PATCH':
    case 'PUT':    return 'bg-amber-400';
    case 'DELETE': return 'bg-danger-500';
    default:       return 'bg-slate-400';
  }
}

function methodLabel(action: string): string {
  switch (action.toUpperCase()) {
    case 'POST':   return 'إنشاء';
    case 'PATCH':
    case 'PUT':    return 'تعديل';
    case 'DELETE': return 'حذف';
    case 'GET':    return 'عرض';
    default:       return action;
  }
}

type LucideIcon = React.ComponentType<{ className?: string }>;
function methodIcon(action: string): LucideIcon {
  switch (action.toUpperCase()) {
    case 'POST':   return Plus;
    case 'PATCH':
    case 'PUT':    return Pencil;
    case 'DELETE': return Trash2;
    default:       return Eye;
  }
}

function relativeTime(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return 'الآن';
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `منذ ${hrs} ساعة`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `منذ ${days} يوم`;
  return new Date(date).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' });
}

// ── Event grouping ────────────────────────────────────────────────────────────

interface EventGroup {
  firstId: string;
  action: string;
  entityType: string;
  actor: AuditLogItem['actor'];
  count: number;
  latestAt: string;
}

function groupRecentEvents(events: AuditLogItem[]): EventGroup[] {
  const groups: EventGroup[] = [];
  for (const ev of events) {
    const last = groups.at(-1);
    if (
      last &&
      last.action === ev.action &&
      last.entityType === ev.entityType &&
      last.actor?.id === ev.actor?.id
    ) {
      last.count++;
    } else {
      groups.push({
        firstId: ev.id,
        action: ev.action,
        entityType: ev.entityType,
        actor: ev.actor,
        count: 1,
        latestAt: ev.createdAt,
      });
    }
  }
  return groups;
}

// ── Role labels ───────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  ADMIN:                  'مدير النظام',
  SALES_MANAGER:          'مدير مبيعات',
  SALES:                  'مبيعات',
  BROKER:                 'وسيط',
  CLIENT:                 'متصفّح',
  CUSTOMER:               'عميل',
  MAINTENANCE_SUPERVISOR: 'مشرف الصيانة',
};

// ── Quick links ───────────────────────────────────────────────────────────────

const QUICK_LINKS: Array<{
  href: string;
  label: string;
  icon: LucideIcon;
  desc: string;
}> = [
  { href: '/dashboard/audit-logs',         label: 'سجلات التدقيق',  icon: ScrollText,   desc: 'متابعة جميع أحداث النظام' },
  { href: '/dashboard/notifications',      label: 'الإشعارات',       icon: Bell,         desc: 'مراجعة الإشعارات والقوالب' },
  { href: '/dashboard/broker-reports',     label: 'تقارير الوسطاء',  icon: BarChart3,    desc: 'متابعة أداء الوسطاء' },
  { href: '/dashboard/broker-payouts',     label: 'المدفوعات',       icon: Wallet,       desc: 'مراجعة المدفوعات' },
  { href: '/dashboard/broker-commissions', label: 'العمولات',        icon: BadgePercent, desc: 'مراجعة العمولات' },
  { href: '/dashboard/broker-leads',       label: 'فرص الوسطاء',    icon: Briefcase,    desc: 'متابعة فرص الوسطاء' },
  { href: '/dashboard/settings',           label: 'الإعدادات',       icon: Settings,     desc: 'إدارة إعدادات النظام' },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function OperationsCenterPage() {
  const [summaryRes, recentRes] = await Promise.all([
    safe(api.get<OperationsSummary>('/operations/summary')),
    safe(api.get<Paged<AuditLogItem>>('/audit-logs?pageSize=10')),
  ]);

  const summary        = summaryRes.data;
  const recent         = recentRes.data?.data ?? [];
  const topActor       = summary?.topActors[0]?.actor ?? null;
  const topEntityEntry = summary?.topEntities[0];
  const topActionEntry = summary?.topActions[0];

  const maxEntity = Math.max(...(summary?.topEntities.map((e) => e.count) ?? [1]), 1);
  const maxAction = Math.max(...(summary?.topActions.map((a) => a.count) ?? [1]), 1);

  const deleteCount   = summary?.topActions.find((a) => a.action.toUpperCase() === 'DELETE')?.count ?? 0;
  const authCount     = summary?.topEntities.find((e) => e.entityType.toLowerCase().includes('auth'))?.count ?? 0;
  const permCount     = summary?.topEntities.find((e) => e.entityType.toLowerCase().includes('permission'))?.count ?? 0;
  const recentGroups  = groupRecentEvents(recent);

  return (
    <div className="flex flex-col gap-5 pb-2">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <PremiumPageHero
        title="مركز العمليات"
        description="نظرة تشغيلية على نشاط النظام — أكثر المناطق استخدامًا، أكثر المستخدمين نشاطًا، وآخر الأحداث."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'مركز العمليات' },
        ]}
        meta={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 border border-brand-200 px-2.5 py-1 text-[11px] font-bold text-brand-700">
            <Activity className="h-3.5 w-3.5" />
            لحظي
          </span>
        }
      />

      {(summaryRes.error || recentRes.error) && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          تعذر تحميل بعض البيانات: {summaryRes.error ?? recentRes.error}
        </div>
      )}

      {summary && (
        <>
          {/* ── KPI strip ────────────────────────────────────────────────── */}
          <PremiumMetricStrip
            variant="dashboard"
            cols={4}
            metrics={[
              {
                label: 'أحداث اليوم',
                value: summary.totals.today.toLocaleString('ar-EG'),
                icon: <Activity />,
                tone: 'brand',
                sub: 'خلال الـ٢٤ ساعة الماضية',
              },
              {
                label: 'أحداث الأسبوع',
                value: summary.totals.last7Days.toLocaleString('ar-EG'),
                icon: <TrendingUp />,
                tone: 'info',
                sub: 'آخر ٧ أيام',
              },
              {
                label: 'أكثر مستخدم نشاطًا',
                value: topActor?.fullName ?? '—',
                icon: <UsersIcon />,
                tone: 'success',
                valueSize: 'compact',
                sub: topActor ? (ROLE_LABEL[topActor.role] ?? topActor.role) : undefined,
              },
              {
                label: 'أكثر مساحة نشاطًا',
                value: topEntityEntry ? areaLabel(topEntityEntry.entityType) : '—',
                icon: <Activity />,
                tone: 'purple',
                valueSize: 'compact',
                sub: topEntityEntry ? `${topEntityEntry.count} حدث في ٧ أيام` : undefined,
              },
            ]}
          />

          {/* ── Secondary insights strip ─────────────────────────────────── */}
          <PremiumMetricStrip
            variant="compact"
            cols={4}
            metrics={[
              {
                label: 'أكثر إجراء متكرر',
                value: topActionEntry
                  ? `${methodLabel(topActionEntry.action)} · ${topActionEntry.action}`
                  : '—',
                icon: <Zap />,
                tone: 'warning',
                sub: topActionEntry ? `${topActionEntry.count} مرة` : undefined,
              },
              {
                label: 'آخر نشاط',
                value: recent[0] ? relativeTime(recent[0].createdAt) : '—',
                icon: <Clock />,
                tone: 'brand',
              },
              {
                label: 'إجمالي ٣٠ يومًا',
                value: summary.totals.last30Days.toLocaleString('ar-EG'),
                icon: <TrendingUp />,
                tone: 'success',
              },
              {
                label: 'عمليات الحذف',
                value: deleteCount === 0 ? 'لا توجد' : deleteCount.toLocaleString('ar-EG'),
                icon: <Shield />,
                tone: deleteCount > 0 ? 'danger' : 'neutral',
              },
            ]}
          />

          {/* ── Main two-column section ────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">

            {/* ── Latest events (2/3) ──────────────────────────────────────── */}
            <PremiumSectionCard
              className="lg:col-span-2"
              icon={<ScrollText />}
              title="أحدث الأحداث"
              description="آخر نشاط تشغيلي مهم داخل النظام"
              trailing={
                <Link href="/dashboard/audit-logs">
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<ExternalLink className="h-3.5 w-3.5" />}
                  >
                    فتح سجل التدقيق
                  </Button>
                </Link>
              }
              padded={false}
            >
              {recentGroups.length === 0 && summary.topEntities.length === 0 ? (
                <div className="py-12">
                  <EmptyState
                    icon={<ScrollText />}
                    title="لا توجد أحداث بعد"
                    description="ستظهر هنا فور وقوع أول إجراء مُسجّل."
                  />
                </div>
              ) : (
                <>
                  {/* Grouped recent events */}
                  {recentGroups.length > 0 && (
                    <>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-5 py-2.5 border-b border-hairline bg-canvas/40">
                        آخر النشاط
                      </p>
                      <ul className="divide-y divide-hairline">
                        {recentGroups.map((g) => {
                          const Icon = methodIcon(g.action);
                          const href = g.count === 1
                            ? `/dashboard/audit-logs/${g.firstId}`
                            : `/dashboard/audit-logs?entityType=${encodeURIComponent(g.entityType)}&action=${encodeURIComponent(g.action)}`;
                          return (
                            <li key={g.firstId}>
                              <Link
                                href={href}
                                className="group flex items-center gap-4 px-5 py-3.5 hover:bg-canvas/40 transition-colors"
                              >
                                {/* Method icon */}
                                <span className={cn(
                                  'shrink-0 inline-flex items-center justify-center h-9 w-9 rounded-xl',
                                  methodIconCls(g.action),
                                )}>
                                  <Icon className="h-4 w-4" />
                                </span>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="text-[13px] font-semibold text-slate-900 truncate">
                                      {eventLabel(g.action, g.entityType)}
                                    </p>
                                    {g.count > 1 && (
                                      <span className="shrink-0 text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full tabular-nums whitespace-nowrap">
                                        {g.count} مرة
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[12px] text-slate-500 mt-0.5 truncate">
                                    بواسطة{' '}
                                    <span className="font-medium text-slate-700">
                                      {g.actor?.fullName ?? 'النظام'}
                                    </span>
                                    {' · '}
                                    {areaLabel(g.entityType)}
                                    {' · '}
                                    {relativeTime(g.latestAt)}
                                  </p>
                                </div>

                                {/* Method badge + eye */}
                                <div className="shrink-0 flex items-center gap-2">
                                  <span
                                    className={cn(
                                      'hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold font-mono',
                                      methodBadgeCls(g.action),
                                    )}
                                    dir="ltr"
                                  >
                                    {g.action}
                                  </span>
                                  <span className="inline-flex items-center justify-center h-7 w-7 rounded-lg text-slate-300 group-hover:text-brand-600 group-hover:bg-brand-50 transition-colors">
                                    <Eye className="h-3.5 w-3.5" />
                                  </span>
                                </div>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  )}

                  {/* Weekly entity activity */}
                  {summary.topEntities.length > 0 && (
                    <>
                      <p className={cn(
                        'text-[10px] font-bold uppercase tracking-widest text-slate-400 px-5 py-2.5 border-b border-hairline bg-canvas/40',
                        recentGroups.length > 0 && 'border-t',
                      )}>
                        نشاط الأسبوع حسب المساحة
                      </p>
                      <ul className="divide-y divide-hairline">
                        {summary.topEntities.map((e) => (
                          <li key={e.entityType}>
                            <Link
                              href={`/dashboard/audit-logs?entityType=${encodeURIComponent(e.entityType)}`}
                              className="group flex items-center gap-4 px-5 py-3.5 hover:bg-canvas/40 transition-colors"
                            >
                              <span className="shrink-0 inline-flex items-center justify-center h-9 w-9 rounded-xl bg-brand-50 text-brand-600">
                                <Activity className="h-4 w-4" />
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-semibold text-slate-900 truncate">
                                  {areaLabel(e.entityType)}
                                </p>
                                <p className="text-[12px] text-slate-500 mt-0.5">
                                  {e.count} حدث · آخر ٧ أيام
                                </p>
                              </div>
                              <span className="shrink-0 text-[13px] font-bold tabular-nums bg-slate-100 text-slate-700 px-3 py-1 rounded-full">
                                {e.count}
                              </span>
                              <span className="shrink-0 inline-flex items-center justify-center h-7 w-7 rounded-lg text-slate-300 group-hover:text-brand-600 group-hover:bg-brand-50 transition-colors">
                                <Eye className="h-3.5 w-3.5" />
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </>
              )}
            </PremiumSectionCard>

            {/* ── Side column ──────────────────────────────────────────────── */}
            <div className="flex flex-col gap-5">

              {/* Quick links */}
              <PremiumSectionCard
                icon={<Zap />}
                title="روابط سريعة"
                padded={false}
              >
                <div className="grid grid-cols-2 gap-3 p-4">
                  {QUICK_LINKS.map((q) => (
                    <Link key={q.href} href={q.href} className="flex">
                      <div className="flex flex-col gap-2 p-3.5 rounded-xl border border-hairline hover:border-brand-200 hover:bg-brand-50/40 transition-all duration-150 flex-1">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-surface-muted text-brand-600 [&_svg]:h-4 [&_svg]:w-4">
                          <q.icon className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="text-[12px] font-semibold text-slate-900 leading-tight">{q.label}</p>
                          <p className="text-[11px] text-slate-500 leading-snug mt-0.5">{q.desc}</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </PremiumSectionCard>

            </div>
          </div>

          {/* ── Bottom row: sensitive activity + distributions (3-col) ────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">

            {/* Sensitive activity */}
            <PremiumSectionCard
              icon={<Shield />}
              title="نشاط حساس"
              tone="warning"
              padded={false}
            >
              <div className="divide-y divide-hairline">
                {[
                  { label: 'عمليات الحذف',      count: deleteCount, warn: deleteCount > 0, icon: <Trash2 className="h-4 w-4" /> },
                  { label: 'أحداث المصادقة',     count: authCount,   warn: false,           icon: <Shield className="h-4 w-4" /> },
                  { label: 'تغييرات الصلاحيات',  count: permCount,   warn: permCount > 0,   icon: <UsersIcon className="h-4 w-4" /> },
                ].map(({ label, count, warn, icon }) => (
                  <div key={label} className="flex items-center gap-3.5 px-5 py-4">
                    <span className={cn(
                      'inline-flex h-9 w-9 items-center justify-center rounded-xl shrink-0',
                      warn ? 'bg-danger-50 text-danger-600' : 'bg-slate-100 text-slate-500',
                    )}>
                      {icon}
                    </span>
                    <span className="flex-1 text-[13px] font-medium text-slate-700">{label}</span>
                    <span className={cn(
                      'text-[20px] font-black tabular-nums shrink-0',
                      warn ? 'text-danger-700' : 'text-slate-400',
                    )}>
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </PremiumSectionCard>

            {/* By action */}
            <PremiumSectionCard
              icon={<Activity />}
              title="توزيع حسب الإجراء (٧ أيام)"
              padded={false}
            >
              {summary.topActions.length === 0 ? (
                <p className="text-[12px] text-slate-400 px-5 py-8 text-center">لا توجد بيانات</p>
              ) : (
                <div className="divide-y divide-hairline">
                  {summary.topActions.map((a) => {
                    const pct = Math.round((a.count / maxAction) * 100);
                    return (
                      <div key={a.action} className="flex items-center gap-4 px-5 py-4">
                        <div className="flex items-center gap-2.5 shrink-0 w-28">
                          <span className="text-[13px] font-semibold text-slate-800">
                            {methodLabel(a.action)}
                          </span>
                          <span
                            className={cn(
                              'text-[10px] font-bold font-mono px-1.5 py-0.5 rounded-md',
                              methodBadgeCls(a.action),
                            )}
                            dir="ltr"
                          >
                            {a.action}
                          </span>
                        </div>
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={cn('h-full rounded-full transition-all', methodBarCls(a.action))}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[13px] font-bold tabular-nums text-slate-900 w-8 text-right shrink-0">
                          {a.count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </PremiumSectionCard>

            {/* By area */}
            <PremiumSectionCard
              icon={<BarChart3 />}
              title="توزيع حسب المساحة (٧ أيام)"
              padded={false}
            >
              {summary.topEntities.length === 0 ? (
                <p className="text-[12px] text-slate-400 px-5 py-8 text-center">لا توجد بيانات</p>
              ) : (
                <div className="divide-y divide-hairline">
                  {summary.topEntities.map((e) => {
                    const pct = Math.round((e.count / maxEntity) * 100);
                    return (
                      <div key={e.entityType} className="flex items-center gap-4 px-5 py-4">
                        <span className="text-[13px] font-semibold text-slate-800 shrink-0 w-28 truncate">
                          {areaLabel(e.entityType)}
                        </span>
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-brand-400 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[13px] font-bold tabular-nums text-slate-900 w-8 text-right shrink-0">
                          {e.count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </PremiumSectionCard>

          </div>
        </>
      )}
    </div>
  );
}
