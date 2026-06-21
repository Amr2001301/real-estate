import Link from 'next/link';
import {
  Settings,
  Database,
  Layers,
  ShieldAlert,
  Clock,
  Info,
  Search,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { SettingItem } from '@/lib/types';
import { formatDateTime } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import { SettingCard } from './_components/setting-row';
import { AddSettingPanel } from './_components/add-setting-panel';
import {
  PremiumPageHero,
  PremiumMetricStrip,
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

const GROUP_ICON: Record<string, string> = {
  company:       '🏢',
  broker:        '🤝',
  brokers:       '🤝',
  sales:         '📊',
  payments:      '💳',
  payment:       '💳',
  notifications: '🔔',
  notification:  '🔔',
  security:      '🔐',
  reports:       '📈',
  localization:  '🌐',
  system:        '⚙️',
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

function groupLabel(g: string) { return GROUP_LABEL[g] ?? g; }
function groupIcon(g: string)  { return GROUP_ICON[g] ?? '⚙️'; }
function keyLabel(key: string) { return KEY_LABEL[key] ?? key; }

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

  // Ordered: known groups first, then any extras
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

  const hasSearch = !!sp.q;
  const hasFilter = !!(sp.q || sp.group);

  // ── Group tab hrefs ─────────────────────────────────────────────────────────
  const activeHref = sp.group
    ? `/dashboard/settings?group=${sp.group}`
    : '/dashboard/settings';

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
        meta={<Settings className="h-4 w-4 text-brand-600" />}
        actions={<AddSettingPanel />}
      />

      {/* ── Toast banners ───────────────────────────────────────────────── */}
      {sp.err && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 px-4 py-3 text-sm">
          {sp.err}
        </div>
      )}
      {sp.ok && (
        <div className="rounded-2xl bg-success-50 border border-success-100 text-success-700 px-4 py-3 text-sm">
          تم حفظ إعداد «{sp.ok}» بنجاح.
        </div>
      )}
      {res.error && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 px-4 py-3 text-sm">
          تعذر تحميل الإعدادات: {res.error}
        </div>
      )}

      {/* ── KPI strip ───────────────────────────────────────────────────── */}
      <PremiumMetricStrip
        metrics={[
          {
            label: 'إجمالي الإعدادات',
            value: items.length,
            icon: <Database />,
            tone: 'brand',
          },
          {
            label: 'المجموعات',
            value: grouped.size,
            icon: <Layers />,
            tone: 'neutral',
          },
          {
            label: 'محمية / حساسة',
            value: sensitiveCount,
            icon: <ShieldAlert />,
            tone: 'warning',
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
      <div className="flex items-center gap-2.5 rounded-2xl bg-info-50 border border-info-100 text-info-800 px-4 py-3 text-sm">
        <Info className="h-4 w-4 shrink-0 text-info-500" />
        <p>بعض الإعدادات محفوظة للعرض فقط. كل تعديل يُسجَّل تلقائياً في سجل التدقيق.</p>
      </div>

      {/* ── Group nav + search ───────────────────────────────────────────── */}
      <div className="bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden">

        {/* Group pills */}
        <div className="flex items-center gap-2 px-4 pt-3 pb-2.5 overflow-x-auto scrollbar-thin border-b border-hairline flex-nowrap">
          {/* الكل pill */}
          <Link
            href="/dashboard/settings"
            className={cn(
              'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors shrink-0',
              activeHref === '/dashboard/settings'
                ? 'bg-brand-600 text-white'
                : 'bg-surface-muted/50 text-slate-600 hover:bg-surface-muted/80 border border-hairline',
            )}
          >
            الكل
            <span className={cn(
              'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold',
              activeHref === '/dashboard/settings'
                ? 'bg-white/25 text-white'
                : 'bg-slate-200 text-slate-600',
            )}>
              {items.length}
            </span>
          </Link>

          {/* One pill per group */}
          {pillGroups.map((g) => {
            const href     = `/dashboard/settings?group=${g}`;
            const isActive = activeHref === href;
            return (
              <Link
                key={g}
                href={href}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors shrink-0',
                  isActive
                    ? 'bg-brand-600 text-white'
                    : 'bg-surface-muted/50 text-slate-600 hover:bg-surface-muted/80 border border-hairline',
                )}
              >
                <span aria-hidden>{groupIcon(g)}</span>
                {groupLabel(g)}
                <span className={cn(
                  'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold',
                  isActive ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-600',
                )}>
                  {grouped.get(g)!.length}
                </span>
              </Link>
            );
          })}
        </div>

        {/* Search bar */}
        <form method="get" action="/dashboard/settings" className="flex items-center gap-2 px-4 py-3">
          {sp.group && <input type="hidden" name="group" value={sp.group} />}
          <div className="flex-1">
            <Input
              name="q"
              inputSize="sm"
              placeholder="بحث بالاسم أو المفتاح..."
              defaultValue={sp.q ?? ''}
              dir="ltr"
              leftAddon={<Search className="h-3.5 w-3.5" />}
            />
          </div>
          <Button type="submit" variant="primary" size="sm">بحث</Button>
          {hasSearch && (
            <Link href={sp.group ? `/dashboard/settings?group=${sp.group}` : '/dashboard/settings'}>
              <Button type="button" variant="ghost" size="sm">مسح</Button>
            </Link>
          )}
        </form>
      </div>

      {/* ── Empty state ──────────────────────────────────────────────────── */}
      {items.length === 0 && (
        <div className="rounded-2xl border border-hairline bg-surface shadow-soft px-5 py-12 flex flex-col items-center text-center gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <Settings className="h-6 w-6" />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {hasFilter ? 'لا توجد إعدادات مطابقة' : 'لا توجد إعدادات محفوظة بعد'}
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
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
        <div key={group} className="bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden">

          {/* Group header */}
          <div className="flex items-center gap-3 px-5 py-3.5 bg-surface-muted/30 border-b border-hairline">
            <span className="text-xl leading-none" aria-hidden>{groupIcon(group)}</span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-900">{groupLabel(group)}</h2>
              <p className="font-mono text-[11px] text-slate-400 mt-0.5" dir="ltr">{group}.*</p>
            </div>
            <span className="ms-auto inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full text-[10px] font-semibold bg-surface border border-hairline text-slate-600 tabular-nums">
              {rows.length}
            </span>
          </div>

          {/* Responsive card grid — 1 col mobile / 2 col tablet / 3 col desktop */}
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
        </div>
      ))}

    </div>
  );
}
