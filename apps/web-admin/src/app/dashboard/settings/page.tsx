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
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
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

// GROUP_LABEL is built lazily in the page body using m.groupLabels

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

function groupIcon(g: string): ReactNode { return GROUP_ICON_NODE[g] ?? <Settings />; }

// ── Value helpers ─────────────────────────────────────────────────────────────

type TypeKey = 'text' | 'number' | 'boolean' | 'json';

const TYPE_CLS: Record<TypeKey, string> = {
  text:    'bg-sky-50    text-sky-700    border border-sky-100',
  number:  'bg-purple-50 text-purple-700 border border-purple-100',
  boolean: 'bg-teal-50   text-teal-700   border border-teal-100',
  json:    'bg-amber-50  text-amber-700  border border-amber-100',
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
  const locale = await getLocale();
  const m = uiT(locale).pages.settings;

  function detectType(value: unknown): TypeKey {
    if (typeof value === 'string')  return 'text';
    if (typeof value === 'number')  return 'number';
    if (typeof value === 'boolean') return 'boolean';
    return 'json';
  }

  const groupLabels: Record<string, string> = {
    company:       m.groupLabels.company,
    broker:        m.groupLabels.brokers,
    brokers:       m.groupLabels.brokers,
    sales:         m.groupLabels.sales,
    payments:      m.groupLabels.payments,
    payment:       m.groupLabels.payments,
    notifications: m.groupLabels.notifications,
    notification:  m.groupLabels.notifications,
    security:      m.groupLabels.security,
    reports:       m.groupLabels.reports,
    localization:  m.groupLabels.localization,
    system:        m.groupLabels.system,
  };

  function groupLabel(g: string): string { return groupLabels[g] ?? g; }
  function keyLabel(key: string): string { return m.keyLabels[key] ?? key; }

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
        title={m.title}
        description={m.description}
        breadcrumbs={[
          { label: uiT(locale).common.breadcrumbHome, href: '/dashboard' },
          { label: m.breadcrumb },
        ]}
        meta={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 border border-brand-200 px-2.5 py-1 text-[11px] font-bold text-brand-700">
            <Settings className="h-3.5 w-3.5" />
            {m.badge}
          </span>
        }
        actions={<AddSettingPanel locale={locale} />}
      />

      {/* ── Toast banners ───────────────────────────────────────────────── */}
      {sp.err && (
        <div className="rounded-[20px] bg-danger-50 border border-danger-100 text-danger-700 px-4 py-3 text-sm">
          {sp.err}
        </div>
      )}
      {sp.ok && (
        <div className="rounded-[20px] bg-success-50 border border-success-100 text-success-700 px-4 py-3 text-sm">
          {m.savedToast.replace('{key}', sp.ok)}
        </div>
      )}
      {res.error && (
        <div className="rounded-[20px] bg-danger-50 border border-danger-100 text-danger-700 px-4 py-3 text-sm">
          {m.errorPrefix} {res.error}
        </div>
      )}

      {/* ── KPI strip ───────────────────────────────────────────────────── */}
      <PremiumMetricStrip
        variant="dashboard"
        cols={4}
        metrics={[
          {
            label: m.kpi.total,
            value: items.length.toLocaleString('ar-EG'),
            icon: <Database />,
            tone: 'brand',
          },
          {
            label: m.kpi.groups,
            value: grouped.size.toLocaleString('ar-EG'),
            icon: <Layers />,
            tone: 'neutral',
          },
          {
            label: m.kpi.sensitive,
            value: sensitiveCount.toLocaleString('ar-EG'),
            icon: <ShieldAlert />,
            tone: sensitiveCount > 0 ? 'warning' : 'neutral',
          },
          {
            label: m.kpi.lastUpdated,
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
        <p>{m.infoBanner}</p>
      </div>

      {/* ── Search + group filter ────────────────────────────────────────── */}
      <div className="bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden">
        <form method="get" action="/dashboard/settings" className="flex items-center gap-2 px-4 py-3">
          {/* Search input */}
          <div className="flex-1 min-w-0">
            <Input
              name="q"
              inputSize="sm"
              placeholder={m.filter.searchPlaceholder}
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
            aria-label={m.filter.groupAriaLabel}
          >
            <option value="">{m.filter.allGroups}</option>
            {pillGroups.map((g) => (
              <option key={g} value={g}>
                {groupLabel(g)} ({grouped.get(g)!.length})
              </option>
            ))}
          </Select>

          <span className="h-5 w-px bg-hairline shrink-0" aria-hidden />

          <Button type="submit" variant="primary" size="sm">{uiT(locale).common.searchBtn}</Button>
          {hasFilter && (
            <Link href="/dashboard/settings">
              <Button type="button" variant="ghost" size="sm">{uiT(locale).common.clearBtn}</Button>
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
              {hasFilter ? m.empty.filteredTitle : m.empty.emptyTitle}
            </p>
            <p className="text-[12px] text-slate-500 mt-1 max-w-sm">
              {hasFilter ? m.empty.filteredDesc : m.empty.emptyDesc}
            </p>
          </div>
          {hasFilter && (
            <Link href="/dashboard/settings">
              <Button variant="outline" size="sm">{m.empty.clearBtn}</Button>
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
                  typeLabel={m.typeLabels[type]}
                  typeCls={TYPE_CLS[type]}
                  preview={preview}
                  sensitive={row.sensitive}
                  updatedAt={formatDateTime(row.updatedAt)}
                  locale={locale}
                />
              );
            })}
          </div>
        </PremiumSectionCard>
      ))}

    </div>
  );
}
