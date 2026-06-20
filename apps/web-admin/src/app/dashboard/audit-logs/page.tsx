import Link from 'next/link';
import { Eye, ScrollText, Clock, Activity } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { AuditLogItem, Paged, UserRole } from '@/lib/types';
import { formatDateTime } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { cn } from '@/lib/cn';
import { AuditFilterBar } from './_components/audit-filter-bar';
import {
  PremiumPageHero,
  PremiumMetricStrip,
  PremiumSectionCard,
  PremiumEmptyState,
} from '@/components/premium';

export const dynamic    = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface Search {
  page?: string;
  actorId?: string;
  action?: string;
  entityType?: string;
  q?: string;
  from?: string;
  to?: string;
}

const PAGE_SIZE = 25;

// ── Role display maps ─────────────────────────────────────────────────────────

const ROLE_LABEL: Record<UserRole, string> = {
  ADMIN:                  'مدير النظام',
  SALES:                  'مبيعات',
  SALES_MANAGER:          'مدير مبيعات',
  MAINTENANCE_SUPERVISOR: 'مشرف الصيانة',
  CLIENT:                 'متصفّح',
  CUSTOMER:               'عميل',
  BROKER:                 'وسيط',
};

const ROLE_BADGE_CLS: Record<UserRole, string> = {
  ADMIN:                  'bg-purple-100 text-purple-700',
  SALES_MANAGER:          'bg-blue-100   text-blue-700',
  SALES:                  'bg-brand-100  text-brand-700',
  MAINTENANCE_SUPERVISOR: 'bg-orange-100 text-orange-700',
  CLIENT:                 'bg-slate-100  text-slate-600',
  CUSTOMER:               'bg-teal-100   text-teal-700',
  BROKER:                 'bg-indigo-100 text-indigo-700',
};

// ── Event / area helpers ──────────────────────────────────────────────────────

function eventLabel(action: string, entityType: string): string {
  const m  = action.toUpperCase();
  const et = entityType.toLowerCase();
  const c  = (kw: string) => et.includes(kw);
  const is = (methods: string[]) => methods.includes(m);

  if (c('auth'))          return is(['POST']) ? 'محاولة دخول' : 'إجراء مصادقة';
  if (c('permission'))    return is(['POST', 'PATCH', 'PUT']) ? 'تعديل صلاحيات' : 'إجراء صلاحية';
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

  if (is(['POST']))         return 'إنشاء سجل';
  if (is(['PATCH', 'PUT'])) return 'تعديل سجل';
  if (is(['DELETE']))       return 'حذف سجل';
  return 'إجراء نظام';
}

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
  return entityType;
}

function formatIpLabel(ip: string | null): { label: string; isLocal: boolean } {
  if (!ip) return { label: '—', isLocal: false };
  if (ip === '::1' || ip === '127.0.0.1' || ip.toLowerCase() === 'localhost') {
    return { label: 'محلي', isLocal: true };
  }
  return { label: ip, isLocal: false };
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? '1') || 1);

  const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  for (const k of ['actorId', 'action', 'entityType', 'q', 'from', 'to'] as const) {
    if (sp[k]) qs.set(k, sp[k]!);
  }

  const res  = await safe(api.get<Paged<AuditLogItem>>(`/audit-logs?${qs.toString()}`));
  const rows = res.data?.data ?? [];
  const meta = res.data?.meta;

  const hasFilter = !!(sp.q || sp.action || sp.entityType || sp.actorId || sp.from || sp.to);

  const actionCounts = new Map<string, number>();
  for (const r of rows) {
    actionCounts.set(r.action, (actionCounts.get(r.action) ?? 0) + 1);
  }
  const topAction = [...actionCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const topActionLabel: Record<string, string> = {
    POST: 'إنشاء', PATCH: 'تعديل', PUT: 'تحديث', DELETE: 'حذف',
  };

  return (
    <div className="space-y-5">
      <PremiumPageHero
        title="سجل التدقيق"
        description="مراجعة الأنشطة والإجراءات الإدارية داخل المنصة."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'سجلات التدقيق' },
        ]}
      />

      {res.error && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          تعذر تحميل السجلات: {res.error}
        </div>
      )}

      {(meta || rows.length > 0) && (
        <PremiumMetricStrip
          metrics={[
            {
              label: 'إجمالي السجلات',
              value: meta ? meta.total.toLocaleString('ar-SA') : rows.length,
              icon: <ScrollText className="h-4 w-4" />,
              primary: true,
              tone: 'brand',
            },
            {
              label: 'آخر نشاط',
              value: rows[0] ? formatDateTime(rows[0].createdAt) : '—',
              icon: <Clock className="h-4 w-4" />,
              tone: 'neutral',
              valueSize: 'compact',
            },
            ...(topAction
              ? [
                  {
                    label: 'أكثر إجراء (في الصفحة)',
                    value: topActionLabel[topAction] ?? topAction,
                    icon: <Activity className="h-4 w-4" />,
                    tone: 'neutral' as const,
                  },
                ]
              : []),
          ]}
          cols={topAction ? 3 : 2}
        />
      )}

      <AuditFilterBar
        defaultQ={sp.q ?? ''}
        defaultAction={sp.action ?? ''}
        defaultEntityType={sp.entityType ?? ''}
        defaultActorId={sp.actorId ?? ''}
        defaultFrom={sp.from ?? ''}
        defaultTo={sp.to ?? ''}
      />

      <PremiumSectionCard
        title="سجلات التدقيق"
        trailing={
          meta ? (
            <span className="text-xs text-slate-400 tabular-nums">
              {meta.total.toLocaleString('ar-EG')} سجل
            </span>
          ) : undefined
        }
        padded={false}
      >
        {rows.length === 0 ? (
          <PremiumEmptyState
            icon={<ScrollText />}
            title={hasFilter ? 'لا توجد سجلات مطابقة' : 'لا توجد سجلات تدقيق'}
            description={
              hasFilter
                ? 'جرّب تعديل الفلاتر أو مسحها للعرض الكامل.'
                : 'ستظهر هنا العمليات التي تُنفَّذ على النظام تلقائيًا.'
            }
            action={
              hasFilter ? (
                <Link href="/dashboard/audit-logs">
                  <Button variant="outline" size="sm">مسح الفلاتر</Button>
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead className="bg-canvas/40 border-b border-hairline text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500">
                <tr>
                  <th className="text-start py-3 ps-5 pe-4 whitespace-nowrap">الوقت</th>
                  <th className="text-start py-3 px-4">المستخدم</th>
                  <th className="text-start py-3 px-4">الحدث</th>
                  <th className="text-start py-3 px-4">المساحة</th>
                  <th className="text-start py-3 px-4 whitespace-nowrap">المعرّف</th>
                  <th className="text-start py-3 px-4">IP</th>
                  <th className="text-end py-3 ps-4 pe-5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-canvas/40 transition-colors duration-100 align-middle"
                  >
                    <td className="py-3 ps-5 pe-4 whitespace-nowrap">
                      <span className="text-xs text-slate-700 font-medium">
                        {formatDateTime(row.createdAt)}
                      </span>
                    </td>

                    <td className="py-3 px-4 max-w-[160px]">
                      {row.actor ? (
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate leading-tight">
                            {row.actor.fullName}
                          </p>
                          <span
                            className={cn(
                              'inline-block mt-0.5 px-1.5 py-px rounded-full text-[10px] font-medium leading-tight whitespace-nowrap',
                              ROLE_BADGE_CLS[row.actor.role] ?? 'bg-slate-100 text-slate-600',
                            )}
                          >
                            {ROLE_LABEL[row.actor.role] ?? row.actor.role}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">نظام / غير معروف</span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 leading-tight whitespace-nowrap">
                          {eventLabel(row.action, row.entityType)}
                        </p>
                        <span
                          className={cn(
                            'inline-block mt-1 px-1.5 py-px rounded font-mono text-[10px] font-semibold leading-tight',
                            methodBadgeCls(row.action),
                          )}
                          dir="ltr"
                        >
                          {row.action}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className="text-sm text-slate-700 leading-tight whitespace-nowrap cursor-default"
                        title={row.entityType}
                      >
                        {areaLabel(row.entityType)}
                      </span>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      {row.entityId ? (
                        <span className="font-mono text-[11px] text-slate-500" dir="ltr">
                          {row.entityId}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      {(() => {
                        const { label, isLocal } = formatIpLabel(row.ip);
                        return isLocal ? (
                          <span
                            className="inline-block px-1.5 py-px rounded text-[10px] font-medium bg-slate-100 text-slate-500"
                            title={row.ip ?? ''}
                          >
                            {label}
                          </span>
                        ) : (
                          <span className="font-mono text-2xs text-slate-400" dir="ltr">
                            {label}
                          </span>
                        );
                      })()}
                    </td>

                    <td className="py-3 ps-4 pe-5 text-end">
                      <Link href={`/dashboard/audit-logs/${row.id}`} aria-label="عرض تفاصيل الحدث">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-hairline bg-surface text-slate-500 shadow-xs hover:bg-canvas hover:text-slate-700 transition-colors">
                          <Eye className="h-3.5 w-3.5" />
                        </span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PremiumSectionCard>

      {meta && meta.total > meta.pageSize && (
        <Pagination
          basePath="/dashboard/audit-logs"
          page={meta.page}
          pageSize={meta.pageSize}
          total={meta.total}
          params={{
            actorId: sp.actorId,
            action: sp.action,
            entityType: sp.entityType,
            q: sp.q,
            from: sp.from,
            to: sp.to,
          }}
        />
      )}
    </div>
  );
}
