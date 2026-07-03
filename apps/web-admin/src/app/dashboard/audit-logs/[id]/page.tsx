import Link from 'next/link';
import { notFound } from 'next/navigation';
import { type ReactNode } from 'react';
import {
  ScrollText, Activity, ArrowRightLeft,
  Plus, Pencil, Trash2, Shield, Clock, Info, Lock, User,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { AuditLogItem, UserRole } from '@/lib/types';
import { formatDateTime } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import {
  PremiumPageHero,
  PremiumDetailLayout,
  PremiumSectionCard,
  PremiumCommandPanel,
} from '@/components/premium';

export const dynamic    = 'force-dynamic';
export const fetchCache = 'force-no-store';

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

// ── Human-readable helpers ────────────────────────────────────────────────────

function eventLabel(action: string, entityType: string): string {
  const m  = action.toUpperCase();
  const et = entityType.toLowerCase();
  const c  = (kw: string) => et.includes(kw);
  const is = (methods: string[]) => methods.includes(m);

  if (c('auth'))        return is(['POST']) ? 'محاولة دخول' : 'إجراء مصادقة';
  if (c('permission'))  return is(['POST', 'PATCH', 'PUT']) ? 'تعديل صلاحيات' : 'إجراء صلاحية';
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

function areaBadgeCls(entityType: string): string {
  const et = entityType.toLowerCase();
  if (et.includes('auth'))        return 'bg-purple-50 text-purple-700 border border-purple-200';
  if (et.includes('permission'))  return 'bg-brand-50  text-brand-700  border border-brand-200';
  if (et.includes('user'))        return 'bg-blue-50   text-blue-700   border border-blue-200';
  if (et.includes('contract'))    return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
  if (et.includes('payment'))     return 'bg-amber-50  text-amber-700  border border-amber-200';
  if (et.includes('reservation')) return 'bg-teal-50   text-teal-700   border border-teal-200';
  if (et.includes('broker'))      return 'bg-indigo-50 text-indigo-700 border border-indigo-200';
  if (et.includes('maintenance')) return 'bg-orange-50 text-orange-700 border border-orange-200';
  if (et.includes('document'))    return 'bg-slate-50  text-slate-600  border border-slate-200';
  if (et.includes('project'))     return 'bg-violet-50 text-violet-700 border border-violet-200';
  if (et.includes('unit'))        return 'bg-cyan-50   text-cyan-700   border border-cyan-200';
  if (et.includes('lead'))        return 'bg-rose-50   text-rose-700   border border-rose-200';
  return 'bg-slate-50 text-slate-600 border border-slate-200';
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

function methodTopBorderCls(action: string): string {
  switch (action.toUpperCase()) {
    case 'POST':   return 'border-t-[3px] border-t-success-500';
    case 'PATCH':
    case 'PUT':    return 'border-t-[3px] border-t-amber-400';
    case 'DELETE': return 'border-t-[3px] border-t-danger-500';
    default:       return 'border-t-[3px] border-t-slate-200';
  }
}

function actionIcon(action: string, entityType: string): ReactNode {
  const et = entityType.toLowerCase();
  if (et.includes('auth') || et.includes('permission')) return <Shield className="h-5 w-5" />;
  switch (action.toUpperCase()) {
    case 'POST':   return <Plus className="h-5 w-5" />;
    case 'PATCH':
    case 'PUT':    return <Pencil className="h-5 w-5" />;
    case 'DELETE': return <Trash2 className="h-5 w-5" />;
    default:       return <Activity className="h-5 w-5" />;
  }
}

function formatIpLabel(ip: string | null): { label: string; isLocal: boolean } {
  if (!ip) return { label: '—', isLocal: false };
  if (
    ip === '::1' ||
    ip === '127.0.0.1' ||
    ip.toLowerCase() === 'localhost' ||
    ip.startsWith('::ffff:127.')
  ) {
    return { label: 'محلي', isLocal: true };
  }
  return { label: ip, isLocal: false };
}

// ── Change-diff helpers ───────────────────────────────────────────────────────

const FIELD_LABELS: Record<string, string> = {
  fullName: 'الاسم الكامل', email: 'البريد', phone: 'الجوال', role: 'الدور',
  active: 'الحالة', status: 'الحالة', amount: 'المبلغ', paidAt: 'تاريخ الدفع',
  createdAt: 'تاريخ الإنشاء', updatedAt: 'تاريخ التحديث', notes: 'ملاحظات',
  name: 'الاسم', description: 'الوصف', price: 'السعر', type: 'النوع',
  date: 'التاريخ', title: 'العنوان', total: 'الإجمالي', currency: 'العملة',
  approved: 'معتمد', id: 'المعرّف', floor: 'الطابق', area: 'المساحة',
  bedrooms: 'غرف النوم', bathrooms: 'دورات المياه', category: 'التصنيف',
  contractDate: 'تاريخ العقد', startDate: 'تاريخ البدء', endDate: 'تاريخ الانتهاء',
  managerId: 'معرّف المدير', projectId: 'معرّف المشروع',
  unitId: 'معرّف الوحدة', customerId: 'معرّف العميل', brokerId: 'معرّف الوسيط',
  user: 'بيانات المستخدم', assigned: 'الصلاحيات المسندة', available: 'الصلاحيات المتاحة',
  data: 'البيانات', permissions: 'الصلاحيات', meta: 'بيانات وصفية',
  tokens: 'رموز الجلسة', password: 'كلمة المرور', passwordHash: 'هاش كلمة المرور',
};

const ENUM_LABELS: Record<string, string> = {
  ADMIN: 'مدير النظام', SALES: 'مبيعات', SALES_MANAGER: 'مدير مبيعات',
  CLIENT: 'متصفّح', CUSTOMER: 'عميل', BROKER: 'وسيط',
  MAINTENANCE_SUPERVISOR: 'مشرف الصيانة',
  PENDING: 'قيد الانتظار', APPROVED: 'معتمد', REJECTED: 'مرفوض',
  ACTIVE: 'نشط', INACTIVE: 'غير نشط', true: 'نعم', false: 'لا',
};

function fieldLabel(key: string): string { return FIELD_LABELS[key] ?? key; }

function isRedactedValue(v: unknown): boolean {
  return typeof v === 'string' && v.includes('REDACTED');
}

function formatFieldValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'نعم' : 'لا';
  if (Array.isArray(v)) return `${v.length} ${v.length === 1 ? 'عنصر' : 'عناصر'}`;
  if (typeof v === 'object') return 'بيانات مركّبة';
  const s = String(v);
  return ENUM_LABELS[s] ?? s;
}

interface DiffRow   { key: string; before: string; after: string; beforeRedacted: boolean; afterRedacted: boolean }
interface ScalarRow { key: string; value: string; redacted: boolean }
interface KeyRow    { key: string; summary: string; redacted: boolean }

function computeDiff(before: unknown, after: unknown): DiffRow[] | null {
  if (typeof before !== 'object' || typeof after !== 'object') return null;
  if (!before || !after) return null;
  const b = before as Record<string, unknown>;
  const a = after  as Record<string, unknown>;
  const allKeys = new Set([...Object.keys(b), ...Object.keys(a)]);
  const diffs: DiffRow[] = [];
  for (const key of allKeys) {
    const bv = formatFieldValue(b[key]);
    const av = formatFieldValue(a[key]);
    if (bv !== av) diffs.push({
      key,
      before: bv, after: av,
      beforeRedacted: isRedactedValue(b[key]),
      afterRedacted:  isRedactedValue(a[key]),
    });
  }
  return diffs.length > 0 ? diffs : null;
}

function extractScalars(value: unknown): ScalarRow[] | null {
  if (typeof value !== 'object' || !value) return null;
  const obj = value as Record<string, unknown>;
  const rows = Object.entries(obj)
    .filter(([, v]) => v === null || typeof v !== 'object')
    .map(([k, v]) => ({ key: k, value: formatFieldValue(v), redacted: isRedactedValue(v) }));
  return rows.length > 0 ? rows : null;
}

function extractKeySummary(value: unknown): KeyRow[] | null {
  if (typeof value !== 'object' || !value) return null;
  const obj = value as Record<string, unknown>;
  return Object.entries(obj).map(([key, v]) => ({
    key,
    summary: formatFieldValue(v),
    redacted: isRedactedValue(v),
  }));
}

// ── Entity navigation ─────────────────────────────────────────────────────────

const RELATED_LINK_MAP: Array<{ match: string; build: (id: string) => string }> = [
  { match: 'brokers',               build: (id) => `/dashboard/brokers/${id}` },
  { match: 'broker-users',          build: (id) => `/dashboard/brokers/${id}` },
  { match: 'broker-leads',          build: (id) => `/dashboard/broker-leads/${id}` },
  { match: 'broker-reservations',   build: (id) => `/dashboard/broker-reservations/${id}` },
  { match: 'broker-contracts',      build: (id) => `/dashboard/broker-contracts/${id}` },
  { match: 'broker-commissions',    build: (id) => `/dashboard/broker-commissions/${id}` },
  { match: 'broker-payouts',        build: (id) => `/dashboard/broker-payouts/${id}` },
  { match: 'reservations',          build: (id) => `/dashboard/reservations/${id}` },
  { match: 'contracts',             build: (id) => `/dashboard/contracts/${id}` },
];

function relatedHref(entityType: string, entityId: string | null): string | null {
  if (!entityId) return null;
  for (const { match, build } of RELATED_LINK_MAP) {
    if (entityType.endsWith(match)) return build(entityId);
  }
  return null;
}

function jsonPreview(value: unknown): string {
  if (value === null || value === undefined) return '';
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}

const CMD_LINK = 'group flex items-center gap-3 px-5 py-3.5 text-sm text-slate-700 hover:bg-canvas/40 transition-colors duration-150';
const CMD_ICON = 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 [&_svg]:h-[15px] [&_svg]:w-[15px]';

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AuditLogDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const res = await safe(api.get<AuditLogItem>(`/audit-logs/${id}`));
  if (res.error || !res.data) notFound();
  const log = res.data;

  const link       = relatedHref(log.entityType, log.entityId);
  const beforeJson = jsonPreview(log.before);
  const afterJson  = jsonPreview(log.after);
  const ipFmt      = formatIpLabel(log.ip);

  const diffs        = computeDiff(log.before, log.after);
  const afterScalars = !diffs ? extractScalars(log.after) : null;
  const keySummary   = !diffs && !afterScalars ? extractKeySummary(log.after) : null;

  const isAuth     = log.entityType.toLowerCase().includes('auth');
  const isDelete   = log.action.toUpperCase() === 'DELETE';

  return (
    <div className="space-y-4">

      {/* ── Page header ──────────────────────────────────────────────────────── */}
      <PremiumPageHero
        title={eventLabel(log.action, log.entityType)}
        description={`${areaLabel(log.entityType)} · ${log.actor?.fullName ?? 'نظام / غير معروف'}`}
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'سجلات التدقيق', href: '/dashboard/audit-logs' },
          { label: id.slice(0, 8) },
        ]}
        meta={
          <>
            <span
              className={cn(
                'inline-block px-3 py-1 rounded-xl font-mono text-xs font-bold',
                methodBadgeCls(log.action),
              )}
              dir="ltr"
            >
              {log.action}
            </span>
            <span className="text-xs text-slate-500 tabular-nums">{formatDateTime(log.createdAt)}</span>
          </>
        }
      />

      {/* ── Hero event card ──────────────────────────────────────────────────── */}
      <div
        className={cn(
          'rounded-2xl border border-hairline bg-surface shadow-soft overflow-hidden',
          methodTopBorderCls(log.action),
        )}
      >
        <div className="flex items-start gap-4 px-5 py-5">
          {/* Action icon */}
          <span
            className={cn(
              'inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl mt-0.5',
              methodBadgeCls(log.action),
            )}
          >
            {actionIcon(log.action, log.entityType)}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="text-xl font-bold text-slate-900 leading-tight">
                  {eventLabel(log.action, log.entityType)}
                </p>
                <p className="text-sm text-slate-500 mt-0.5 leading-snug">
                  {log.actor?.fullName ?? (
                    <span className="italic text-slate-400">نظام / غير معروف</span>
                  )}
                </p>
              </div>
              <span
                className={cn(
                  'inline-block shrink-0 px-3 py-1.5 rounded-xl font-mono text-sm font-bold leading-none',
                  methodBadgeCls(log.action),
                )}
                dir="ltr"
              >
                {log.action}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-3">
              {/* Colored area badge */}
              <span
                className={cn(
                  'inline-flex items-center text-[12px] font-semibold px-2.5 py-1 rounded-full',
                  areaBadgeCls(log.entityType),
                )}
              >
                {areaLabel(log.entityType)}
              </span>

              <span className="text-xs text-slate-500 tabular-nums">
                {formatDateTime(log.createdAt)}
              </span>

              {/* IP display */}
              {ipFmt.label !== '—' && (
                ipFmt.isLocal ? (
                  <span
                    className="inline-block px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-500 border border-hairline"
                    title={log.ip ?? ''}
                  >
                    محلي
                  </span>
                ) : (
                  <span
                    className="font-mono text-xs text-slate-500 bg-slate-50 border border-hairline px-2.5 py-1 rounded-lg"
                    dir="ltr"
                  >
                    {ipFmt.label}
                  </span>
                )
              )}

              {/* High-risk notice */}
              {(isDelete || isAuth) && (
                <span className={cn(
                  'inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full',
                  isDelete
                    ? 'bg-danger-50 text-danger-700 border border-danger-100'
                    : 'bg-purple-50 text-purple-700 border border-purple-100',
                )}>
                  <Shield className="h-3 w-3 shrink-0" />
                  {isDelete ? 'حدث حذف' : 'حدث مصادقة'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Entity ID footer */}
        {log.entityId && (
          <div className="border-t border-hairline bg-canvas/40 px-5 py-2.5 flex items-center gap-3 flex-wrap">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide shrink-0">
              معرّف الكيان:
            </span>
            <span className="font-mono text-[11px] text-slate-600 flex-1 break-all" dir="ltr">
              {log.entityId}
            </span>
            {link && (
              <Link href={link as never} className="shrink-0">
                <Button variant="outline" size="sm">فتح السجل</Button>
              </Link>
            )}
          </div>
        )}
      </div>

      {/* ── Detail layout ────────────────────────────────────────────────────── */}
      <PremiumDetailLayout
        main={
          <div className="space-y-4">

            {/* ── ملخص الحدث ─────────────────────────────────────────────── */}
            <PremiumSectionCard
              icon={<Activity />}
              title="ملخص الحدث"
              padded={false}
            >
              {/* Row 1: actor | event type | area */}
              <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-hairline border-b border-hairline">
                <div className="px-5 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2">
                    من قام بالإجراء
                  </p>
                  {log.actor ? (
                    <div className="space-y-1.5">
                      <p className="text-[14px] font-bold text-slate-900 leading-tight">
                        {log.actor.fullName}
                      </p>
                      <span
                        className={cn(
                          'inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold',
                          ROLE_BADGE_CLS[log.actor.role] ?? 'bg-slate-100 text-slate-600',
                        )}
                      >
                        {ROLE_LABEL[log.actor.role] ?? log.actor.role}
                      </span>
                      {log.actor.email && (
                        <p className="text-[11px] text-slate-500 font-mono" dir="ltr">
                          {log.actor.email}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-400 shrink-0">
                        <User className="h-4 w-4" />
                      </span>
                      <span className="text-[13px] text-slate-400 italic">نظام / غير معروف</span>
                    </div>
                  )}
                </div>

                <div className="px-5 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2">
                    نوع الإجراء
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[14px] font-bold text-slate-900 leading-tight">
                      {eventLabel(log.action, log.entityType)}
                    </span>
                    <span
                      className={cn(
                        'inline-block px-2 py-0.5 rounded font-mono text-[11px] font-bold',
                        methodBadgeCls(log.action),
                      )}
                      dir="ltr"
                    >
                      {log.action}
                    </span>
                  </div>
                </div>

                <div className="px-5 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2">
                    القسم
                  </p>
                  <span
                    className={cn(
                      'inline-flex items-center text-[13px] font-semibold px-2.5 py-1 rounded-full',
                      areaBadgeCls(log.entityType),
                    )}
                  >
                    {areaLabel(log.entityType)}
                  </span>
                </div>
              </div>

              {/* Row 2: timestamp | IP | entity ID */}
              <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-hairline">
                <div className="px-5 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2">
                    وقت التنفيذ
                  </p>
                  <p className="text-[13px] font-semibold text-slate-900 tabular-nums" dir="ltr">
                    {formatDateTime(log.createdAt)}
                  </p>
                </div>

                <div className="px-5 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2">
                    عنوان IP
                  </p>
                  {ipFmt.isLocal ? (
                    <span className="inline-block px-2.5 py-1 rounded-lg text-[13px] font-semibold bg-slate-100 text-slate-600">
                      محلي
                    </span>
                  ) : ipFmt.label !== '—' ? (
                    <span className="font-mono text-[13px] font-semibold text-slate-900" dir="ltr">
                      {ipFmt.label}
                    </span>
                  ) : (
                    <span className="text-[13px] text-slate-400">—</span>
                  )}
                </div>

                <div className="px-5 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2">
                    معرّف الكيان المستهدف
                  </p>
                  {log.entityId ? (
                    <div className="space-y-2">
                      <span
                        className="font-mono text-[11px] text-slate-600 bg-canvas border border-hairline px-2 py-1.5 rounded-md break-all inline-block"
                        dir="ltr"
                      >
                        {log.entityId}
                      </span>
                      {link && (
                        <div>
                          <Link href={link as never}>
                            <Button variant="outline" size="sm">فتح السجل</Button>
                          </Link>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-[13px] text-slate-400">—</span>
                  )}
                </div>
              </div>
            </PremiumSectionCard>

            {/* ── ما الذي تغير؟ ───────────────────────────────────────────── */}
            <PremiumSectionCard
              icon={<ArrowRightLeft />}
              title="ما الذي تغير؟"
              trailing={
                diffs ? (
                  <span className="inline-flex h-5 min-w-[28px] px-1.5 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-[10px] font-bold tabular-nums">
                    {diffs.length}
                  </span>
                ) : undefined
              }
              padded={false}
            >
              {diffs ? (
                /* Diff table — before vs after */
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-canvas/40 border-b border-hairline text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400">
                      <tr>
                        <th className="text-start py-2.5 ps-5 pe-4 whitespace-nowrap">الحقل</th>
                        <th className="text-start py-2.5 px-4 w-[38%]">القيمة السابقة</th>
                        <th className="text-start py-2.5 px-4 w-[38%]">القيمة الجديدة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hairline">
                      {diffs.map((d) => (
                        <tr key={d.key} className="hover:bg-canvas/40 transition-colors duration-100">
                          <td className="py-3 ps-5 pe-4 whitespace-nowrap">
                            <span className="text-[13px] font-semibold text-slate-800">{fieldLabel(d.key)}</span>
                            <span className="font-mono text-[10px] text-slate-400 block mt-0.5">{d.key}</span>
                          </td>
                          <td className="py-3 px-4 bg-danger-50/30">
                            {d.beforeRedacted ? (
                              <span className="inline-flex items-center gap-1.5 text-[12px] text-slate-400 italic">
                                <Lock className="h-3 w-3 text-amber-500 shrink-0" />
                                مُخفى لأسباب أمنية
                              </span>
                            ) : (
                              <span className="text-[12px] text-danger-700 line-through">{d.before}</span>
                            )}
                          </td>
                          <td className="py-3 px-4 bg-success-50/30">
                            {d.afterRedacted ? (
                              <span className="inline-flex items-center gap-1.5 text-[12px] text-slate-400 italic">
                                <Lock className="h-3 w-3 text-amber-500 shrink-0" />
                                مُخفى لأسباب أمنية
                              </span>
                            ) : (
                              <span className="text-[12px] text-success-700 font-semibold">{d.after}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : afterScalars ? (
                /* After-only scalars (no before snapshot) */
                <div>
                  <div className="flex items-start gap-2.5 px-5 py-3 bg-amber-50/60 border-b border-amber-100 text-[12px] text-amber-700">
                    <Info className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
                    <span>القيمة قبل التغيير غير متوفرة. يُعرض أدناه الوضع بعد تنفيذ الحدث.</span>
                  </div>
                  <div className="divide-y divide-hairline">
                    {afterScalars.map((f) => (
                      <div
                        key={f.key}
                        className="flex items-start gap-4 px-5 py-3 hover:bg-canvas/40 transition-colors"
                      >
                        <div className="w-44 shrink-0 pt-0.5">
                          <span className="text-[13px] font-semibold text-slate-700 leading-tight">
                            {fieldLabel(f.key)}
                          </span>
                          <span className="font-mono text-[10px] text-slate-400 block mt-0.5">{f.key}</span>
                        </div>
                        {f.redacted ? (
                          <span className="inline-flex items-center gap-1.5 text-[12px] text-slate-400 italic pt-0.5">
                            <Lock className="h-3 w-3 text-amber-500 shrink-0" />
                            مُخفى لأسباب أمنية
                          </span>
                        ) : (
                          <span className="text-[13px] text-slate-800 flex-1 pt-0.5">{f.value}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : keySummary ? (
                /* Key summary (nested objects) */
                <div>
                  <div className="flex items-start gap-2.5 px-5 py-3 bg-amber-50/60 border-b border-amber-100 text-[12px] text-amber-700">
                    <Info className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
                    <span>القيمة قبل التغيير غير متوفرة. فيما يلي ملخص البيانات المحدَّثة.</span>
                  </div>
                  <div className="divide-y divide-hairline">
                    {keySummary.map((f) => (
                      <div
                        key={f.key}
                        className="flex items-start gap-4 px-5 py-3 hover:bg-canvas/40 transition-colors"
                      >
                        <div className="w-44 shrink-0 pt-0.5">
                          <span className="text-[13px] font-semibold text-slate-700">{fieldLabel(f.key)}</span>
                          <span className="font-mono text-[10px] text-slate-400 block mt-0.5">{f.key}</span>
                        </div>
                        {f.redacted ? (
                          <span className="inline-flex items-center gap-1.5 text-[12px] text-slate-400 italic pt-0.5">
                            <Lock className="h-3 w-3 text-amber-500 shrink-0" />
                            مُخفى لأسباب أمنية
                          </span>
                        ) : (
                          <span className="text-[12px] text-slate-500 flex-1 pt-0.5">{f.summary}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <ArrowRightLeft className="h-8 w-8 text-slate-200" />
                  <p className="text-[13px] text-slate-400">لا تتوفر بيانات تغيير لهذا الحدث.</p>
                </div>
              )}
            </PremiumSectionCard>

            {/* ── البيانات التقنية الخام ──────────────────────────────────── */}
            {(beforeJson || afterJson) && (
              <PremiumSectionCard
                icon={<ScrollText />}
                title="البيانات التقنية الخام"
                padded={false}
              >
                {/* Technical path row */}
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3 border-b border-hairline bg-canvas/30">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 shrink-0">
                    المسار التقني
                  </span>
                  <span className="font-mono text-[12px] text-slate-600 flex-1" dir="ltr">
                    {log.entityType}
                  </span>
                  <span
                    className={cn(
                      'inline-block px-2 py-0.5 rounded font-mono text-[11px] font-bold shrink-0',
                      methodBadgeCls(log.action),
                    )}
                    dir="ltr"
                  >
                    {log.action}
                  </span>
                </div>

                {/* Before collapsible */}
                <details className="border-b border-hairline">
                  <summary className="flex items-center justify-between px-5 py-3.5 cursor-pointer select-none hover:bg-canvas/40 transition-colors list-none">
                    <div className="flex items-center gap-2.5">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-danger-50 text-danger-600 text-[10px] font-bold shrink-0">
                        ق
                      </span>
                      <span className="text-[13px] font-semibold text-slate-700">
                        البيانات قبل التغيير
                      </span>
                      {!beforeJson && (
                        <span className="text-[11px] text-slate-400">(غير متوفر)</span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 shrink-0">انقر للتوسيع</span>
                  </summary>
                  <div className="border-t border-hairline">
                    {beforeJson ? (
                      <pre
                        dir="ltr"
                        className="px-5 py-4 text-[11px] font-mono text-slate-700 leading-relaxed overflow-auto max-h-80 scrollbar-thin bg-canvas/20"
                      >
                        {beforeJson}
                      </pre>
                    ) : (
                      <p className="px-5 py-3 text-[12px] text-slate-500">
                        غير متوفر — المعترض الحالي لا يلتقط القيمة السابقة.
                      </p>
                    )}
                  </div>
                </details>

                {/* After collapsible */}
                <details>
                  <summary className="flex items-center justify-between px-5 py-3.5 cursor-pointer select-none hover:bg-canvas/40 transition-colors list-none">
                    <div className="flex items-center gap-2.5">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-success-50 text-success-600 text-[10px] font-bold shrink-0">
                        ب
                      </span>
                      <span className="text-[13px] font-semibold text-slate-700">
                        البيانات بعد التغيير
                      </span>
                      {!afterJson && (
                        <span className="text-[11px] text-slate-400">(غير متوفر)</span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 shrink-0">انقر للتوسيع</span>
                  </summary>
                  <div className="border-t border-hairline">
                    {afterJson ? (
                      <pre
                        dir="ltr"
                        className="px-5 py-4 text-[11px] font-mono text-slate-700 leading-relaxed overflow-auto max-h-[28rem] scrollbar-thin bg-canvas/20"
                      >
                        {afterJson}
                      </pre>
                    ) : (
                      <p className="px-5 py-3 text-[12px] text-slate-500">غير متوفر</p>
                    )}
                  </div>
                </details>
              </PremiumSectionCard>
            )}

          </div>
        }
        side={
          <div className="space-y-4">

            {/* Navigation */}
            <PremiumCommandPanel title="التنقل">
              {link && (
                <Link href={link as never} className={CMD_LINK}>
                  <span className={CMD_ICON}><Activity /></span>
                  فتح السجل المرتبط
                </Link>
              )}
              <Link href="/dashboard/audit-logs" className={CMD_LINK}>
                <span className={CMD_ICON}><ScrollText /></span>
                قائمة سجلات التدقيق
              </Link>
            </PremiumCommandPanel>

            {/* Actor card */}
            <PremiumSectionCard
              icon={<User />}
              title={log.actor ? 'المنفّذ' : 'المنفّذ'}
              padded
            >
              {log.actor ? (
                <dl className="flex flex-col gap-3 text-sm">
                  <div>
                    <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">
                      الاسم
                    </dt>
                    <dd className="text-[14px] font-bold text-slate-900">{log.actor.fullName}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">
                      الدور
                    </dt>
                    <dd>
                      <span
                        className={cn(
                          'inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold',
                          ROLE_BADGE_CLS[log.actor.role] ?? 'bg-slate-100 text-slate-600',
                        )}
                      >
                        {ROLE_LABEL[log.actor.role] ?? log.actor.role}
                      </span>
                    </dd>
                  </div>
                  {log.actor.email && (
                    <div>
                      <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">
                        البريد
                      </dt>
                      <dd className="text-[12px] font-mono text-slate-700 break-all" dir="ltr">
                        {log.actor.email}
                      </dd>
                    </div>
                  )}
                </dl>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-400 shrink-0">
                    <User className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-[13px] font-semibold text-slate-700">نظام / غير معروف</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">إجراء آلي أو غير مصادق</p>
                  </div>
                </div>
              )}
            </PremiumSectionCard>

            {/* Event details */}
            <PremiumSectionCard
              icon={<Clock />}
              title="تفاصيل الحدث"
              padded
            >
              <dl className="flex flex-col gap-3 text-sm">
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">
                    القسم
                  </dt>
                  <dd>
                    <span
                      className={cn(
                        'inline-flex items-center text-[12px] font-semibold px-2.5 py-1 rounded-full',
                        areaBadgeCls(log.entityType),
                      )}
                    >
                      {areaLabel(log.entityType)}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">
                    الوقت
                  </dt>
                  <dd className="text-[12px] text-slate-700 tabular-nums" dir="ltr">
                    {formatDateTime(log.createdAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">
                    عنوان IP
                  </dt>
                  <dd>
                    {ipFmt.isLocal ? (
                      <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[12px] font-medium">
                        محلي
                      </span>
                    ) : ipFmt.label !== '—' ? (
                      <span className="font-mono text-[12px] text-slate-700" dir="ltr">{ipFmt.label}</span>
                    ) : (
                      <span className="text-[12px] text-slate-400">—</span>
                    )}
                  </dd>
                </div>
                {log.entityId && (
                  <div>
                    <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">
                      معرّف الكيان
                    </dt>
                    <dd
                      className="font-mono text-[11px] text-slate-600 break-all bg-canvas border border-hairline px-2 py-1.5 rounded-md"
                      dir="ltr"
                    >
                      {log.entityId}
                    </dd>
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
