import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ScrollText, Activity, ArrowRightLeft } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { AuditLogItem, UserRole } from '@/lib/types';
import { formatDateTime } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

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

function methodBadgeCls(action: string): string {
  switch (action.toUpperCase()) {
    case 'POST':   return 'bg-emerald-50 text-emerald-700 border border-emerald-100';
    case 'PATCH':
    case 'PUT':    return 'bg-amber-50 text-amber-700 border border-amber-100';
    case 'DELETE': return 'bg-danger-50 text-danger-700 border border-danger-100';
    default:       return 'bg-slate-50 text-slate-600 border border-slate-200';
  }
}

function formatIpLabel(ip: string | null): { label: string; isLocal: boolean } {
  if (!ip) return { label: '—', isLocal: false };
  if (ip === '::1' || ip === '127.0.0.1' || ip.toLowerCase() === 'localhost') {
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
};

const ENUM_LABELS: Record<string, string> = {
  ADMIN: 'مدير النظام', SALES: 'مبيعات', SALES_MANAGER: 'مدير مبيعات',
  CLIENT: 'متصفّح', CUSTOMER: 'عميل', BROKER: 'وسيط',
  MAINTENANCE_SUPERVISOR: 'مشرف الصيانة',
  PENDING: 'قيد الانتظار', APPROVED: 'معتمد', REJECTED: 'مرفوض',
  ACTIVE: 'نشط', INACTIVE: 'غير نشط', true: 'نعم', false: 'لا',
};

function fieldLabel(key: string): string { return FIELD_LABELS[key] ?? key; }

function formatFieldValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'نعم' : 'لا';
  if (Array.isArray(v)) return `${v.length} ${v.length === 1 ? 'عنصر' : 'عناصر'}`;
  if (typeof v === 'object') return 'بيانات مركّبة';
  const s = String(v);
  return ENUM_LABELS[s] ?? s;
}

interface DiffRow   { key: string; before: string; after: string }
interface ScalarRow { key: string; value: string }
interface KeyRow    { key: string; summary: string }

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
    if (bv !== av) diffs.push({ key, before: bv, after: av });
  }
  return diffs.length > 0 ? diffs : null;
}

function extractScalars(value: unknown): ScalarRow[] | null {
  if (typeof value !== 'object' || !value) return null;
  const obj = value as Record<string, unknown>;
  const rows = Object.entries(obj)
    .filter(([, v]) => v === null || typeof v !== 'object')
    .map(([k, v]) => ({ key: k, value: formatFieldValue(v) }));
  return rows.length > 0 ? rows : null;
}

function extractKeySummary(value: unknown): KeyRow[] | null {
  if (typeof value !== 'object' || !value) return null;
  const obj = value as Record<string, unknown>;
  return Object.entries(obj).map(([key, v]) => ({
    key,
    summary: formatFieldValue(v),
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

  return (
    <div className="space-y-4">

      {/* ── Header — breadcrumbs only ────────────────────────────────────── */}
      <PageHeader
        title="تفاصيل حدث التدقيق"
        description="سجل كامل لما تغيّر، من قِبل من، ومن أين."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'سجلات التدقيق', href: '/dashboard/audit-logs' },
          { label: id.slice(0, 8) },
        ]}
        meta={<ScrollText className="h-4 w-4 text-brand-600" />}
      />

      {/* ── Hero event card ──────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-hairline bg-surface shadow-xs overflow-hidden">

        {/* Main row: icon + title/actor + method badge */}
        <div className="flex items-start gap-4 px-5 py-5">
          <span
            className={cn(
              'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl mt-0.5',
              methodBadgeCls(log.action),
            )}
          >
            <Activity className="h-5 w-5" />
          </span>

          <div className="min-w-0 flex-1">
            {/* Title + badge */}
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="text-xl font-bold text-slate-900 leading-tight">
                  {eventLabel(log.action, log.entityType)}
                </p>
                <p className="text-sm text-slate-500 mt-0.5">
                  {log.actor?.fullName ?? 'نظام / غير معروف'}
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

            {/* Meta chips */}
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="inline-flex items-center text-xs text-slate-600 bg-slate-50 border border-hairline px-2.5 py-1 rounded-lg">
                {areaLabel(log.entityType)}
              </span>
              <span className="text-xs text-slate-500">{formatDateTime(log.createdAt)}</span>
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
            </div>
          </div>
        </div>

        {/* Entity ID footer bar — full UUID, always readable */}
        {log.entityId && (
          <div className="border-t border-hairline bg-surface-muted/40 px-5 py-2.5 flex items-center gap-3 flex-wrap">
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

      {/* ── ملخص الحدث — 2-row × 3-col grid ────────────────────────────── */}
      <Card className="overflow-hidden">
        <div className="px-5 py-3 border-b border-hairline bg-surface-muted/30">
          <h2 className="text-sm font-semibold text-slate-900">ملخص الحدث</h2>
        </div>

        {/* Row 1: who · what · where */}
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-hairline border-b border-hairline">

          {/* من قام بالإجراء */}
          <div className="px-5 py-4">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
              من قام بالإجراء
            </p>
            {log.actor ? (
              <div className="space-y-1.5">
                <p className="text-sm font-semibold text-slate-900">{log.actor.fullName}</p>
                <span
                  className={cn(
                    'inline-block px-2 py-0.5 rounded-full text-xs font-medium',
                    ROLE_BADGE_CLS[log.actor.role] ?? 'bg-slate-100 text-slate-600',
                  )}
                >
                  {ROLE_LABEL[log.actor.role] ?? log.actor.role}
                </span>
                {log.actor.email && (
                  <p className="text-xs text-slate-500 font-mono" dir="ltr">{log.actor.email}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic">نظام / غير معروف</p>
            )}
          </div>

          {/* نوع الإجراء */}
          <div className="px-5 py-4">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
              نوع الإجراء
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-slate-900">
                {eventLabel(log.action, log.entityType)}
              </span>
              <span
                className={cn(
                  'inline-block px-2 py-0.5 rounded font-mono text-xs font-bold',
                  methodBadgeCls(log.action),
                )}
                dir="ltr"
              >
                {log.action}
              </span>
            </div>
          </div>

          {/* القسم / المساحة */}
          <div className="px-5 py-4">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
              القسم / المساحة
            </p>
            <p className="text-sm font-semibold text-slate-900">{areaLabel(log.entityType)}</p>
          </div>
        </div>

        {/* Row 2: when · IP · entity ID */}
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-hairline">

          {/* وقت التنفيذ */}
          <div className="px-5 py-4">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
              وقت التنفيذ
            </p>
            <p className="text-sm font-semibold text-slate-900">{formatDateTime(log.createdAt)}</p>
          </div>

          {/* عنوان IP */}
          <div className="px-5 py-4">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
              عنوان IP
            </p>
            {ipFmt.isLocal ? (
              <span
                className="inline-block px-2.5 py-1 rounded-lg text-sm font-medium bg-slate-100 text-slate-600"
                title={log.ip ?? ''}
              >
                محلي
              </span>
            ) : ipFmt.label !== '—' ? (
              <span className="font-mono text-sm text-slate-900" dir="ltr">{ipFmt.label}</span>
            ) : (
              <span className="text-sm text-slate-400">—</span>
            )}
          </div>

          {/* معرّف الكيان المستهدف */}
          <div className="px-5 py-4">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
              معرّف الكيان المستهدف
            </p>
            {log.entityId ? (
              <div className="space-y-2">
                <span
                  className="font-mono text-[11px] text-slate-600 bg-surface-muted border border-hairline px-2 py-1.5 rounded-md break-all inline-block"
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
              <span className="text-sm text-slate-400">—</span>
            )}
          </div>
        </div>
      </Card>

      {/* ── ما الذي تغير؟ ────────────────────────────────────────────────── */}
      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-hairline bg-surface-muted/30">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-brand-50 text-brand-600 shrink-0">
            <ArrowRightLeft className="h-3.5 w-3.5" />
          </span>
          <h2 className="text-sm font-semibold text-slate-900">ما الذي تغير؟</h2>
          {diffs && (
            <span className="ms-auto text-2xs text-slate-400">
              {diffs.length} {diffs.length === 1 ? 'حقل' : 'حقول'} تغيّرت
            </span>
          )}
        </div>

        {diffs ? (
          /* Diff table: before/after available */
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-muted/50 text-2xs font-semibold text-slate-500 border-b border-hairline">
                <tr>
                  <th className="text-start py-2.5 ps-5 pe-4">الحقل</th>
                  <th className="text-start py-2.5 px-4">القيمة السابقة</th>
                  <th className="text-start py-2.5 px-4">القيمة الجديدة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {diffs.map((d) => (
                  <tr key={d.key} className="hover:bg-surface-muted/20 transition-colors">
                    <td className="py-2.5 ps-5 pe-4 whitespace-nowrap">
                      <span className="font-medium text-slate-900">{fieldLabel(d.key)}</span>
                      <span className="font-mono text-2xs text-slate-400 ms-1.5">{d.key}</span>
                    </td>
                    <td className="py-2.5 px-4 text-xs text-danger-700 bg-danger-50/40">{d.before}</td>
                    <td className="py-2.5 px-4 text-xs text-success-700 bg-success-50/40 font-medium">{d.after}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : afterScalars ? (
          /* Scalar fields from after — no before captured */
          <div>
            <p className="px-5 pt-3 pb-2 text-2xs text-amber-700 bg-amber-50/60 border-b border-hairline">
              القيمة قبل التغيير غير متوفرة. يُعرض أدناه الوضع بعد تنفيذ الحدث.
            </p>
            {afterScalars.map((f) => (
              <div
                key={f.key}
                className="flex items-center gap-4 px-5 py-2.5 border-b border-hairline last:border-0 hover:bg-surface-muted/20 transition-colors"
              >
                <div className="w-48 shrink-0">
                  <span className="text-sm font-medium text-slate-700">{fieldLabel(f.key)}</span>
                  <span className="font-mono text-2xs text-slate-400 block">{f.key}</span>
                </div>
                <span className="text-sm text-slate-900 flex-1">{f.value}</span>
              </div>
            ))}
          </div>
        ) : keySummary ? (
          /* Key summary for complex/nested after data */
          <div>
            <p className="px-5 pt-3 pb-2 text-2xs text-amber-700 bg-amber-50/60 border-b border-hairline">
              القيمة قبل التغيير غير متوفرة. فيما يلي ملخص البيانات المحدَّثة.
            </p>
            {keySummary.map((f) => (
              <div
                key={f.key}
                className="flex items-center gap-4 px-5 py-2.5 border-b border-hairline last:border-0 hover:bg-surface-muted/20 transition-colors"
              >
                <div className="w-48 shrink-0">
                  <span className="text-sm font-medium text-slate-700">{fieldLabel(f.key)}</span>
                  <span className="font-mono text-2xs text-slate-400 block">{f.key}</span>
                </div>
                <span className="text-sm text-slate-500 flex-1">{f.summary}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="px-5 py-6 text-sm text-slate-400 text-center">
            لا تتوفر بيانات تغيير لهذا الحدث.
          </p>
        )}
      </Card>

      {/* ── التفاصيل التقنية — collapsed by default ──────────────────────── */}
      {(beforeJson || afterJson) && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-400 px-1">التفاصيل التقنية (البيانات الخام)</p>

          {/* Technical route info */}
          <div className="rounded-2xl border border-hairline bg-surface shadow-xs px-5 py-3 flex flex-wrap items-center gap-x-6 gap-y-1.5">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide shrink-0">المسار التقني</span>
            <span className="font-mono text-xs text-slate-600" dir="ltr">{log.entityType}</span>
            <span
              className={cn(
                'inline-block px-2 py-0.5 rounded font-mono text-xs font-bold shrink-0',
                methodBadgeCls(log.action),
              )}
              dir="ltr"
            >
              {log.action}
            </span>
          </div>

          <details className="rounded-2xl border border-hairline bg-surface shadow-xs overflow-hidden">
            <summary className="flex items-center justify-between px-5 py-3 cursor-pointer select-none hover:bg-surface-muted/30 transition-colors list-none">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-amber-50 text-amber-600 text-[10px] font-bold shrink-0">ق</span>
                <span className="text-sm font-medium text-slate-700">البيانات قبل التغيير</span>
                {!beforeJson && <span className="text-2xs text-slate-400">(غير متوفر)</span>}
              </div>
              <span className="text-2xs text-slate-400">انقر للتوسيع</span>
            </summary>
            <div className="border-t border-hairline">
              {beforeJson ? (
                <pre dir="ltr" className="px-5 py-4 text-2xs font-mono text-slate-700 leading-relaxed overflow-auto max-h-80 scrollbar-thin bg-surface-muted/20">
                  {beforeJson}
                </pre>
              ) : (
                <p className="px-5 py-3 text-2xs text-slate-500">
                  غير متوفر — المعترض الحالي لا يلتقط القيمة السابقة.
                </p>
              )}
            </div>
          </details>

          <details className="rounded-2xl border border-hairline bg-surface shadow-xs overflow-hidden">
            <summary className="flex items-center justify-between px-5 py-3 cursor-pointer select-none hover:bg-surface-muted/30 transition-colors list-none">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-emerald-50 text-emerald-600 text-[10px] font-bold shrink-0">ب</span>
                <span className="text-sm font-medium text-slate-700">البيانات بعد التغيير</span>
                {!afterJson && <span className="text-2xs text-slate-400">(غير متوفر)</span>}
              </div>
              <span className="text-2xs text-slate-400">انقر للتوسيع</span>
            </summary>
            <div className="border-t border-hairline">
              {afterJson ? (
                <pre dir="ltr" className="px-5 py-4 text-2xs font-mono text-slate-700 leading-relaxed overflow-auto max-h-[28rem] scrollbar-thin bg-surface-muted/20">
                  {afterJson}
                </pre>
              ) : (
                <p className="px-5 py-3 text-2xs text-slate-500">غير متوفر</p>
              )}
            </div>
          </details>
        </div>
      )}

    </div>
  );
}
