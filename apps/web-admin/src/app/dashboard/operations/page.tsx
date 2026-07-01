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
  Gauge,
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
import { Card } from '@/components/ui/card';
import { PremiumMetricStrip, PremiumPageHero } from '@/components/premium';
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
  if (et.includes('audit'))             return 'سجلات التدقيق';
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
  { href: '/dashboard/audit-logs',         label: 'سجلات التدقيق',   icon: ScrollText,   desc: 'متابعة جميع أحداث النظام' },
  { href: '/dashboard/notifications',      label: 'الإشعارات',        icon: Bell,         desc: 'مراجعة الإشعارات والقوالب' },
  { href: '/dashboard/broker-reports',     label: 'تقارير الوسطاء',   icon: BarChart3,    desc: 'متابعة أداء الوسطاء' },
  { href: '/dashboard/broker-payouts',     label: 'المدفوعات',        icon: Wallet,       desc: 'مراجعة المدفوعات' },
  { href: '/dashboard/broker-commissions', label: 'العمولات',         icon: BadgePercent, desc: 'مراجعة العمولات' },
  { href: '/dashboard/broker-leads',       label: 'فرص الوسطاء',     icon: Briefcase,    desc: 'متابعة فرص الوسطاء' },
  { href: '/dashboard/settings',           label: 'الإعدادات',        icon: Settings,     desc: 'إدارة إعدادات النظام' },
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
    <div className="flex flex-col gap-5 lg:gap-6 pb-2">
      <PremiumPageHero
        title="مركز العمليات"
        description="نظرة تشغيلية على نشاط النظام — أكثر المناطق استخدامًا، أكثر المستخدمين نشاطًا، وآخر الأحداث."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'مركز العمليات' },
        ]}
      />

      {(summaryRes.error || recentRes.error) && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          تعذر تحميل بعض البيانات: {summaryRes.error ?? recentRes.error}
        </div>
      )}

      {summary && (
        <>
          {/* ── KPI row ─────────────────────────────────────────────────────── */}
          <PremiumMetricStrip
            variant="compact"
            cols={4}
            metrics={[
              { label: 'أحداث اليوم',         value: String(summary.totals.today),                                icon: <Activity />,   tone: 'brand',   sub: 'خلال الـ٢٤ ساعة الماضية' },
              { label: 'أحداث الأسبوع',       value: String(summary.totals.last7Days),                            icon: <TrendingUp />, tone: 'info',    sub: 'آخر ٧ أيام' },
              { label: 'أكثر مستخدم نشاطًا',  value: topActor?.fullName ?? '—',                                   icon: <UsersIcon />,  tone: 'success', valueSize: 'compact', sub: topActor ? (ROLE_LABEL[topActor.role] ?? topActor.role) : undefined },
              { label: 'أكثر مساحة نشاطًا',   value: topEntityEntry ? areaLabel(topEntityEntry.entityType) : '—', icon: <Activity />,   tone: 'purple',  valueSize: 'compact', sub: topEntityEntry ? `${topEntityEntry.count} حدث في ٧ أيام` : undefined },
            ]}
          />

          {/* ── Insights strip ───────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-2xl border border-hairline bg-surface p-4 shadow-xs">
            {[
              {
                icon: <Zap className="h-3.5 w-3.5" />,
                label: 'أكثر إجراء متكرر',
                value: topActionEntry ? methodLabel(topActionEntry.action) : '—',
                sub: topActionEntry ? `${topActionEntry.count} مرة` : null,
                badge: topActionEntry
                  ? { text: topActionEntry.action, cls: methodBadgeCls(topActionEntry.action) }
                  : null,
                iconCls: 'bg-amber-50 text-amber-600',
              },
              {
                icon: <Clock className="h-3.5 w-3.5" />,
                label: 'آخر نشاط',
                value: recent[0] ? relativeTime(recent[0].createdAt) : '—',
                sub: null,
                badge: null,
                iconCls: 'bg-brand-50 text-brand-600',
              },
              {
                icon: <TrendingUp className="h-3.5 w-3.5" />,
                label: 'إجمالي ٣٠ يومًا',
                value: String(summary.totals.last30Days),
                sub: null,
                badge: null,
                iconCls: 'bg-success-50 text-success-600',
              },
              {
                icon: <Shield className="h-3.5 w-3.5" />,
                label: 'عمليات الحذف',
                value: deleteCount === 0 ? 'لا توجد' : String(deleteCount),
                sub: null,
                badge: null,
                iconCls: deleteCount > 0 ? 'bg-danger-50 text-danger-600' : 'bg-slate-100 text-slate-500',
              },
            ].map(({ icon, label, value, sub, badge, iconCls }) => (
              <div key={label} className="flex items-center gap-2.5">
                <span className={cn(
                  'inline-flex h-7 w-7 rounded-lg items-center justify-center shrink-0',
                  iconCls,
                )}>
                  {icon}
                </span>
                <div className="min-w-0">
                  <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest leading-none truncate">
                    {label}
                  </p>
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    <span className="text-xs font-semibold text-slate-800 tabular-nums">{value}</span>
                    {badge && (
                      <span className={cn('text-[9px] font-bold font-mono px-1 py-px rounded', badge.cls)} dir="ltr">
                        {badge.text}
                      </span>
                    )}
                    {sub && (
                      <span className="text-[10px] text-slate-400">{sub}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Events + side ────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:items-start">

            {/* Latest events (2/3) */}
            <Card className="overflow-hidden lg:col-span-2">
              {/* Card header */}
              <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    <ScrollText className="h-4 w-4 text-brand-600" />
                    أحدث الأحداث
                  </h2>
                  <p className="text-2xs text-slate-500 mt-0.5 ms-6">
                    آخر نشاط تشغيلي مهم داخل النظام
                  </p>
                </div>
                <Link
                  href="/dashboard/audit-logs"
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-hairline px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-surface-muted hover:border-slate-300 transition-all"
                >
                  <ExternalLink className="h-3.5 w-3.5 text-brand-600" />
                  فتح سجل التدقيق
                </Link>
              </div>

              {recentGroups.length === 0 && (!summary || summary.topEntities.length === 0) ? (
                <div className="px-5 pb-5">
                  <EmptyState
                    icon={<ScrollText />}
                    title="لا توجد أحداث بعد"
                    description="ستظهر هنا فور وقوع أول إجراء مُسجّل."
                  />
                </div>
              ) : (
                <div>

                  {/* Grouped recent events */}
                  {recentGroups.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest px-5 mb-1">
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
                                aria-label={`عرض تفاصيل: ${eventLabel(g.action, g.entityType)}`}
                                className="group flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors"
                              >
                                <span className={cn(
                                  'shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-lg',
                                  methodIconCls(g.action),
                                )}>
                                  <Icon className="h-3.5 w-3.5" />
                                </span>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <p className="text-sm font-semibold text-slate-900 truncate">
                                      {eventLabel(g.action, g.entityType)}
                                    </p>
                                    {g.count > 1 && (
                                      <span className="shrink-0 text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-px rounded-full tabular-nums">
                                        {g.count} مرة
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-2xs text-slate-500 mt-0.5 truncate">
                                    {'بواسطة '}
                                    {g.actor?.fullName ?? 'النظام'}
                                    {' · داخل '}
                                    {areaLabel(g.entityType)}
                                    {' · '}
                                    {relativeTime(g.latestAt)}
                                  </p>
                                </div>

                                <div className="shrink-0 flex items-center gap-1.5">
                                  <span className={cn(
                                    'hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold font-mono',
                                    methodBadgeCls(g.action),
                                  )} dir="ltr">
                                    {g.action}
                                  </span>
                                  <span
                                    className="inline-flex items-center justify-center h-7 w-7 rounded-lg text-slate-300 group-hover:text-brand-600 group-hover:bg-brand-50 transition-colors"
                                    aria-hidden="true"
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                  </span>
                                </div>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}

                  {/* Weekly entity activity summaries */}
                  {summary && summary.topEntities.length > 0 && (
                    <div className={cn(recentGroups.length > 0 && 'border-t border-hairline mt-2 pt-2')}>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest px-5 mb-1">
                        نشاط الأسبوع حسب المساحة
                      </p>
                      <ul className="divide-y divide-hairline">
                        {summary.topEntities.map((e) => (
                          <li key={e.entityType}>
                            <Link
                              href={`/dashboard/audit-logs?entityType=${encodeURIComponent(e.entityType)}`}
                              aria-label={`عرض نشاط ${areaLabel(e.entityType)}`}
                              className="group flex items-center gap-3 px-5 py-2.5 hover:bg-slate-50 transition-colors"
                            >
                              <span className="shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-lg bg-brand-50 text-brand-600">
                                <Activity className="h-3.5 w-3.5" />
                              </span>

                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-slate-900 truncate">
                                  {areaLabel(e.entityType)}
                                </p>
                                <p className="text-2xs text-slate-500 mt-0.5">
                                  {e.count} حدث · آخر ٧ أيام
                                </p>
                              </div>

                              <span className="shrink-0 text-xs font-bold tabular-nums bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full">
                                {e.count}
                              </span>

                              <span
                                className="shrink-0 inline-flex items-center justify-center h-7 w-7 rounded-lg text-slate-300 group-hover:text-brand-600 group-hover:bg-brand-50 transition-colors"
                                aria-hidden="true"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                      <div className="h-2" />
                    </div>
                  )}
                </div>
              )}
            </Card>

            {/* Side column (1/3) */}
            <div className="flex flex-col gap-4">

              {/* Quick links */}
              <Card className="p-4 flex-1">
                <h2 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-brand-600" />
                  روابط سريعة
                </h2>
                <div className="grid grid-cols-2 gap-2">
                  {QUICK_LINKS.map((q) => (
                    <Link key={q.href} href={q.href} className="flex">
                      <div className="flex flex-col gap-1 p-2.5 rounded-xl border border-hairline hover:border-brand-200 hover:bg-brand-50/40 transition-all duration-150 flex-1">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-surface-muted">
                          <q.icon className="h-3.5 w-3.5 text-brand-600" />
                        </span>
                        <p className="text-xs font-semibold text-slate-900 leading-snug mt-0.5">{q.label}</p>
                        <p className="text-[10px] text-slate-500 leading-relaxed">{q.desc}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </Card>

              {/* Sensitive activity */}
              <Card className="p-4">
                <h2 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-amber-500" />
                  نشاط حساس
                </h2>
                <ul className="space-y-2.5">
                  {[
                    {
                      label: 'عمليات الحذف',
                      count: deleteCount,
                      warn: deleteCount > 0,
                      icon: <Trash2 className="h-3.5 w-3.5" />,
                    },
                    {
                      label: 'أحداث المصادقة',
                      count: authCount,
                      warn: false,
                      icon: <Shield className="h-3.5 w-3.5" />,
                    },
                    {
                      label: 'تغييرات الصلاحيات',
                      count: permCount,
                      warn: permCount > 0,
                      icon: <UsersIcon className="h-3.5 w-3.5" />,
                    },
                  ].map(({ label, count, warn, icon }) => (
                    <li key={label} className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
                      <span className={cn(
                        'inline-flex items-center justify-center h-5 w-5 rounded shrink-0',
                        warn ? 'bg-danger-50 text-danger-600' : 'bg-slate-100 text-slate-500',
                      )}>
                        {icon}
                      </span>
                      <span className="text-xs text-slate-700 truncate">{label}</span>
                      <span className={cn(
                        'text-xs font-bold tabular-nums px-2.5 py-0.5 rounded-full min-w-[2rem] text-center',
                        warn ? 'bg-danger-50 text-danger-700' : 'bg-slate-100 text-slate-600',
                      )}>
                        {count}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          </div>

          {/* ── Distribution row ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* By area */}
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-brand-600" />
                توزيع حسب المساحة (٧ أيام)
              </h2>
              {summary.topEntities.length === 0 ? (
                <p className="text-2xs text-slate-500">لا توجد بيانات</p>
              ) : (
                <ul className="space-y-4">
                  {summary.topEntities.map((e) => (
                    <li key={e.entityType} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-slate-700 font-medium truncate">
                          {areaLabel(e.entityType)}
                        </span>
                        <span className="text-sm font-bold tabular-nums text-slate-900 shrink-0">{e.count}</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand-400 rounded-full transition-all"
                          style={{ width: `${Math.round((e.count / maxEntity) * 100)}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {/* By action */}
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Activity className="h-4 w-4 text-brand-600" />
                توزيع حسب الإجراء (٧ أيام)
              </h2>
              {summary.topActions.length === 0 ? (
                <p className="text-2xs text-slate-500">لا توجد بيانات</p>
              ) : (
                <ul className="space-y-4">
                  {summary.topActions.map((a) => (
                    <li key={a.action} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm text-slate-700 font-medium">{methodLabel(a.action)}</span>
                          <span className={cn(
                            'text-[10px] font-bold font-mono px-1.5 py-px rounded',
                            methodBadgeCls(a.action),
                          )} dir="ltr">
                            {a.action}
                          </span>
                        </div>
                        <span className="text-sm font-bold tabular-nums text-slate-900 shrink-0">{a.count}</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all', methodBarCls(a.action))}
                          style={{ width: `${Math.round((a.count / maxAction) * 100)}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
