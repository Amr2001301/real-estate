import { type ReactNode } from 'react';
import Link from 'next/link';
import {
  Settings, Database, Layers, ShieldAlert, Clock, Info, Search,
  Building2, Users, TrendingUp, CreditCard, Bell, Shield, BarChart3,
  Globe, Wrench,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { SettingItem } from '@/lib/types';
import { formatDateTime } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { SettingCard } from './_components/setting-row';
import { AddSettingPanel } from './_components/add-setting-panel';
import {
  PremiumPageHero,
  PremiumMetricStrip,
  PremiumSectionCard,
} from '@/components/premium';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface Search {
  q?: string;
  group?: string;
  ok?: string;
  err?: string;
}

// ── Group metadata ─────────────────────────────────────────────────────────────

const GROUP_ORDER = ['company', 'broker', 'sales', 'notifications', 'reports', 'security'];

const GROUP_LABEL: Record<string, string> = {
  company:       'الشركة',
  broker:        'الوسطاء',
  brokers:       'الوسطاء',
  sales:         'المبيعات',
  payments:      'المدفوعات',
  payment:       'المدفوعات',
  notifications: 'الإشعارات',
  notification:  'الإشعارات',
  security:      'الأمان',
  reports:       'التقارير',
  localization:  'اللغة والتوطين',
  system:        'النظام',
};

const GROUP_ICON_NODE: Record<string, ReactNode> = {
  company:       <Building2 />,
  broker:        <Users />,
  brokers:       <Users />,
  sales:         <TrendingUp />,
  payments:      <CreditCard />,
  payment:       <CreditCard />,
  notifications: <Bell />,
  notification:  <Bell />,
  security:      <Shield />,
  reports:       <BarChart3 />,
  localization:  <Globe />,
  system:        <Wrench />,
};

const KEY_LABEL: Record<string, string> = {
  'company.name':                'اسم الشركة',
  'company.phone':               'هاتف الشركة',
  'company.email':               'البريد الإلكتروني',
  'company.address':             'عنوان الشركة',
  'company.website':             'الموقع الإلكتروني',
  'company.logo':                'شعار الشركة',
  'company.vatNumber':           'الرقم الضريبي',
  'broker.defaultCommission':    'عمولة الوسيط الافتراضية',
  'broker.defaultCommissionPct': 'نسبة العمولة الافتراضية (%)',
  'broker.payoutCycleDays':      'دورة صرف المدفوعات (أيام)',
  'broker.minPayoutAmount':      'الحد الأدنى للصرف',
  'broker.autoApproveLeads':     'موافقة تلقائية على العملاء',
  'sales.leadExpireDays':        'مدة صلاحية العميل المحتمل (أيام)',
  'sales.reservationExpireDays': 'مدة صلاحية الحجز (أيام)',
  'sales.allowMultiReservation': 'السماح بحجوزات متعددة',
  'notifications.smsEnabled':    'الرسائل النصية',
  'notifications.emailEnabled':  'البريد الإلكتروني',
  'notifications.fromEmail':     'بريد إرسال الإشعارات',
  'security.sessionTimeoutMins': 'مهلة انتهاء الجلسة (دقيقة)',
  'security.maxLoginAttempts':   'محاولات الدخول القصوى',
  'security.requireMfa':         'المصادقة الثنائية',
  'reports.currency':            'عملة التقارير',
  'reports.dateFormat':          'تنسيق التاريخ',
  'reports.timezone':            'المنطقة الزمنية',
};

function groupLabel(g: string): string   { return GROUP_LABEL[g]      ?? g; }
function groupIcon(g: string):  ReactNode { return GROUP_ICON_NODE[g]  ?? <Settings />; }
function keyLabel(key: string): string   { return KEY_LABEL[key]       ?? key; }

// ── Value helpers ─────────────────────────────────────────────────────────────

function detectType(value: unknown): 'نص' | 'رقم' | 'منطقي' | 'JSON' {
  if (typeof value === 'string')  return 'نص';
  if (typeof value === 'number')  return 'رقم';
  if (typeof value === 'boolean') return 'منطقي';
  return 'JSON';
}

const TYPE_CLS: Record<string, string> = {
  'نص':    'bg-sky-50    text-sky-700    border border-sky-100',
  'رقم':   'bg-purple-50 text-purple-700 border border-purple-100',
  'منطقي': 'bg-teal-50   text-teal-700   border border-teal-100',
  'JSON':  'bg-amber-50  text-amber-700  border border-amber-100',
};

function valuePreview(s: SettingItem): string {
  if (s.sensitive) return '••••••••';
  if (s.value === null || s.value === undefined) return '—';
  if (typeof s.value === 'string') {
    return s.value.length > 100 ? s.value.slice(0, 100) + '…' : s.value;
  }
  if (typeof s.value === 'number' || typeof s.value === 'boolean') return String(s.value);
  try {
    const j = JSON.stringify(s.value, null, 2);
    return j.length > 300 ? j.slice(0, 300) + '\n…' : j;
  } catch { return String(s.value); }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  if (sp.q)     qs.set('q', sp.q);
  if (sp.group) qs.set('group', sp.group);

  const res   = await safe(api.get<SettingItem[]>(`/settings${qs.toString() ? `?${qs}` : ''}`));
  const items = res.data ?? [];

  // ── Group items ─────────────────────────────────────────────────────────────
  const grouped = new Map<string, SettingItem[]>();
  for (const item of items) {
    const arr = grouped.get(item.group) ?? [];
    arr.push(item);
    grouped.set(item.group, arr);
  }

  // Known groups first, then extras
  const orderedGroups: [string, SettingItem[]][] = [
    ...GROUP_ORDER
      .filter((g) => grouped.has(g))
      .map((g) => [g, grouped.get(g)!] as [string, SettingItem[]]),
    ...[...grouped.entries()].filter(([g]) => !GROUP_ORDER.includes(g)),
  ];

  // ── KPI ─────────────────────────────────────────────────────────────────────
  const sensitiveCount = items.filter((i) => i.sensitive).length;
  const lastUpdated    = items.length > 0
    ? items.reduce((a, b) => (a.updatedAt > b.updatedAt ? a : b)).updatedAt
    : null;

  const hasFilter = !!(sp.q || sp.group);

  const pillGroups = GROUP_ORDER.filter((g) => grouped.has(g));

  return (
    <div className="space-y-4">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <PremiumPageHero
        title="إعدادات النظام"
        description="إدارة إعدادات المنصة وقيمها التشغيلية. كل تعديل يُسجَّل تلقائياً في سجل التدقيق."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'إعدادات النظام' },
        ]}
        meta={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 border border-brand-200 px-2.5 py-1 text-[11px] font-bold text-brand-700">
            <Settings className="h-3.5 w-3.5" />
            إعدادات النظام
          </span>
        }
        actions={<AddSettingPanel />}
      />

      {/* ── Toast banners ───────────────────────────────────────────────── */}
      {sp.err && (
        <div className="rounded-[20px] bg-danger-50 border border-danger-100 text-danger-700 px-4 py-3 text-sm">
          {sp.err}
        </div>
      )}
      {sp.ok && (
        <div className="rounded-[20px] bg-success-50 border border-success-100 text-success-700 px-4 py-3 text-sm">
          تم حفظ إعداد «{sp.ok}» بنجاح.
        </div>
      )}
      {res.error && (
        <div className="rounded-[20px] bg-danger-50 border border-danger-100 text-danger-700 px-4 py-3 text-sm">
          تعذر تحميل الإعدادات: {res.error}
        </div>
      )}

      {/* ── KPI strip ───────────────────────────────────────────────────── */}
      <PremiumMetricStrip
        variant="dashboard"
        cols={4}
        metrics={[
          {
            label: 'إجمالي الإعدادات',
            value: items.length.toLocaleString('ar-EG'),
            icon: <Database />,
            tone: 'brand',
          },
          {
            label: 'المجموعات',
            value: grouped.size.toLocaleString('ar-EG'),
            icon: <Layers />,
            tone: 'neutral',
          },
          {
            label: 'محمية / حساسة',
            value: sensitiveCount.toLocaleString('ar-EG'),
            icon: <ShieldAlert />,
            tone: sensitiveCount > 0 ? 'warning' : 'neutral',
          },
          {
            label: 'آخر تحديث',
            value: lastUpdated ? formatDateTime(lastUpdated) : '—',
            icon: <Clock />,
            tone: 'neutral',
            valueSize: 'compact',
          },
        ]}
      />

      {/* ── Info banner ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 rounded-[20px] border border-brand-100 bg-brand-50/40 px-4 py-3 text-[12px] text-brand-800">
        <Info className="h-4 w-4 shrink-0 text-brand-600" />
        <p>بعض الإعدادات محفوظة للعرض فقط. كل تعديل يُسجَّل تلقائياً في سجل التدقيق.</p>
      </div>

      {/* ── Search + group filter ────────────────────────────────────────── */}
      <div className="bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden">
        <form method="get" action="/dashboard/settings" className="flex items-center gap-2 px-4 py-3">
          {/* Search input */}
          <div className="flex-1 min-w-0">
            <Input
              name="q"
              inputSize="sm"
              placeholder="بحث بالاسم أو المفتاح..."
              defaultValue={sp.q ?? ''}
              leftAddon={<Search className="h-3.5 w-3.5" />}
            />
          </div>

          {/* Group filter dropdown */}
          <Select
            name="group"
            inputSize="sm"
            defaultValue={sp.group ?? ''}
            className="w-44 shrink-0"
            aria-label="تصفية حسب المجموعة"
          >
            <option value="">كل المجموعات</option>
            {pillGroups.map((g) => (
              <option key={g} value={g}>
                {groupLabel(g)} ({grouped.get(g)!.length})
              </option>
            ))}
          </Select>

          <span className="h-5 w-px bg-hairline shrink-0" aria-hidden />

          <Button type="submit" variant="primary" size="sm">بحث</Button>
          {hasFilter && (
            <Link href="/dashboard/settings">
              <Button type="button" variant="ghost" size="sm">مسح</Button>
            </Link>
          )}
        </form>
      </div>

      {/* ── Empty state ──────────────────────────────────────────────────── */}
      {items.length === 0 && (
        <div className="rounded-[20px] border border-hairline bg-surface shadow-soft px-5 py-12 flex flex-col items-center text-center gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <Settings className="h-6 w-6" />
          </span>
          <div>
            <p className="text-[14px] font-semibold text-slate-900">
              {hasFilter ? 'لا توجد إعدادات مطابقة' : 'لا توجد إعدادات محفوظة بعد'}
            </p>
            <p className="text-[12px] text-slate-500 mt-1 max-w-sm">
              {hasFilter
                ? 'جرّب تعديل معايير البحث، أو انقر على "مسح" لإعادة ضبط الفلتر.'
                : 'انقر على "إضافة إعداد" أعلاه لإضافة أول إعداد.'}
            </p>
          </div>
          {hasFilter && (
            <Link href="/dashboard/settings">
              <Button variant="outline" size="sm">مسح الفلاتر</Button>
            </Link>
          )}
        </div>
      )}

      {/* ── Group cards ──────────────────────────────────────────────────── */}
      {orderedGroups.map(([group, rows]) => (
        <PremiumSectionCard
          key={group}
          icon={groupIcon(group)}
          title={groupLabel(group)}
          description={`${group}.*`}
          trailing={
            <span className="inline-flex h-5 min-w-[22px] px-1.5 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500 tabular-nums">
              {rows.length}
            </span>
          }
          padded={false}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
            {rows.map((row) => {
              const label    = keyLabel(row.key);
              const type     = detectType(row.value);
              const preview  = valuePreview(row);
              const hasLabel = label !== row.key;
              return (
                <SettingCard
                  key={row.key}
                  settingKey={row.key}
                  label={label}
                  hasLabel={hasLabel}
                  type={type}
                  typeCls={TYPE_CLS[type] ?? ''}
                  preview={preview}
                  sensitive={row.sensitive}
                  updatedAt={formatDateTime(row.updatedAt)}
                />
              );
            })}
          </div>
        </PremiumSectionCard>
      ))}

    </div>
  );
}
