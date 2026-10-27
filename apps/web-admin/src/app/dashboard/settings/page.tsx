import { type ReactNode } from 'react';
import Link from 'next/link';
import {
  Settings, Info, Search, Building2, Users, TrendingUp, CreditCard, Bell, Shield, BarChart3,
  Globe, Wrench, Ban, Receipt, Clock, Percent, ArrowLeftRight,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { SettingItem } from '@/lib/types';
import { formatDate } from '@/lib/format';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { SettingRow, type SettingType } from './_components/setting-row';
import { AddSettingPanel } from './_components/add-setting-panel';
import { HIDDEN_SETTING_KEYS, KNOWN_SETTINGS, KNOWN_SETTING_KEYS } from './_components/known-settings';
import { PremiumPageHero } from '@/components/premium';

const KNOWN_BY_KEY = new Map(KNOWN_SETTINGS.map((k) => [k.key, k]));

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface Search {
  q?: string;
  group?: string;
  ok?: string;
  err?: string;
}

// ── Group metadata ─────────────────────────────────────────────────────────────

const GROUP_ORDER = ['company', 'pricing', 'lateFee', 'fees', 'transferFee', 'cancellation', 'cheque', 'broker', 'sales', 'notifications', 'reports', 'security'];

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
  cancellation:  <Ban />,
  cheque:        <Receipt />,
  lateFee:       <Clock />,
  fees:          <Receipt />,
  pricing:       <Percent />,
  transferFee:   <ArrowLeftRight />,
};

function groupIcon(g: string): ReactNode { return GROUP_ICON_NODE[g] ?? <Settings />; }

// ── Value helpers ─────────────────────────────────────────────────────────────

type TypeKey = 'text' | 'number' | 'boolean' | 'json';

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

  function groupLabel(g: string): string {
    return groupLabels[g] ?? (m.groupLabels as Record<string, string>)[g] ?? g;
  }
  function keyLabel(key: string): string { return m.keyLabels[key] ?? key; }

  const sp = await searchParams;
  const qs = new URLSearchParams();
  if (sp.q)     qs.set('q', sp.q);
  if (sp.group) qs.set('group', sp.group);

  const filtered = qs.toString() !== '';
  const [res, allRes] = await Promise.all([
    safe(api.get<SettingItem[]>(`/settings${filtered ? `?${qs}` : ''}`)),
    filtered ? safe(api.get<SettingItem[]>('/settings')) : Promise.resolve(null),
  ]);
  const items = (res.data ?? []).filter((s) => !HIDDEN_SETTING_KEYS.has(s.key));
  // The add list offers only the known settings the company does not have yet.
  const existingKeys = (allRes ?? res).data?.map((s) => s.key) ?? [];

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
  const lastUpdated    = items.length > 0
    ? items.reduce((a, b) => (a.updatedAt > b.updatedAt ? a : b)).updatedAt
    : null;

  const hasFilter = !!(sp.q || sp.group);


  const relative = (iso: string): string => {
    const rt = uiT(locale).operationsPage.relativeTime;
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
    if (mins < 1) return rt.now;
    if (mins < 60) return rt.minutes(mins);
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return rt.hours(hrs);
    const days = Math.floor(hrs / 24);
    if (days < 7) return rt.days(days);
    return formatDate(iso, locale);
  };

  return (
    <div className="flex flex-col gap-5 pb-2 lg:gap-6">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <PremiumPageHero
        title={m.title}
        description={m.description}
        breadcrumbs={[
          { label: uiT(locale).common.breadcrumbHome, href: '/dashboard' },
          { label: m.breadcrumb },
        ]}
        meta={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1 text-[11px] font-bold text-brand-700">
            <Settings className="h-3.5 w-3.5" />
            {m.count(items.length)}
            {lastUpdated && <span className="font-medium opacity-80">· {m.updated(relative(lastUpdated))}</span>}
          </span>
        }
        actions={<AddSettingPanel locale={locale} existingKeys={existingKeys} />}
      />

      {/* ── Toast banners ───────────────────────────────────────────────── */}
      {sp.err && (
        <div className="rounded-[20px] border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-700">{sp.err}</div>
      )}
      {sp.ok && (
        <div className="rounded-[20px] border border-success-100 bg-success-50 px-4 py-3 text-sm text-success-700">
          {m.savedToast.replace('{key}', keyLabel(sp.ok))}
        </div>
      )}
      {res.error && (
        <div className="rounded-[20px] border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          {m.errorPrefix} {res.error}
        </div>
      )}

      {/* ── Search + sections ───────────────────────────────────────────── */}
      <section className="rounded-[22px] border border-hairline bg-surface">
        <form method="get" action="/dashboard/settings" className="flex flex-wrap items-center gap-2 px-4 py-3">
          <div className="min-w-[200px] flex-1">
            <Input
              name="q"
              inputSize="sm"
              placeholder={m.filter.searchPlaceholder}
              defaultValue={sp.q ?? ''}
              leftAddon={<Search className="h-3.5 w-3.5" />}
            />
          </div>
          <Select name="group" inputSize="sm" defaultValue={sp.group ?? ''} className="w-44 shrink-0" aria-label={m.filter.groupAriaLabel}>
            <option value="">{m.filter.allGroups}</option>
            {orderedGroups.map(([g, rows]) => (
              <option key={g} value={g}>{groupLabel(g)} ({rows.length})</option>
            ))}
          </Select>
          <Button type="submit" variant="primary" size="sm">{uiT(locale).common.searchBtn}</Button>
          {hasFilter && (
            <Link href="/dashboard/settings">
              <Button type="button" variant="ghost" size="sm">{uiT(locale).common.clearBtn}</Button>
            </Link>
          )}
        </form>
        {orderedGroups.length > 1 && (
          <nav aria-label={m.jump} className="flex flex-wrap items-center gap-2 border-t border-hairline px-4 py-3" data-testid="settings-sections">
            {orderedGroups.map(([g, rows]) => (
              <a
                key={g}
                href={`#group-${g}`}
                className="inline-flex items-center gap-2 rounded-full border border-hairline px-3 py-1.5 text-[12.5px] font-semibold text-slate-700 transition-colors hover:border-brand-500/40 hover:text-brand-700"
              >
                <span className="text-brand-600 [&_svg]:h-3.5 [&_svg]:w-3.5">{groupIcon(g)}</span>
                {groupLabel(g)}
                <span className="text-[11px] font-medium text-slate-400 tabular-nums">{rows.length}</span>
              </a>
            ))}
          </nav>
        )}
        <p className="flex items-center gap-2 border-t border-hairline px-4 py-2.5 text-[12px] text-slate-500">
          <Info className="h-3.5 w-3.5 shrink-0 text-brand-600" />
          {m.infoBanner}
        </p>
      </section>

      {/* ── Empty state ──────────────────────────────────────────────────── */}
      {items.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-[22px] border border-hairline bg-surface px-5 py-12 text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-muted text-slate-400">
            <Settings className="h-6 w-6" />
          </span>
          <div>
            <p className="text-[14px] font-semibold text-slate-900">{hasFilter ? m.empty.filteredTitle : m.empty.emptyTitle}</p>
            <p className="mt-1 max-w-sm text-[12px] text-slate-500">{hasFilter ? m.empty.filteredDesc : m.empty.emptyDesc}</p>
          </div>
          {hasFilter && (
            <Link href="/dashboard/settings">
              <Button variant="outline" size="sm">{m.empty.clearBtn}</Button>
            </Link>
          )}
        </div>
      )}

      {/* ── Groups ──────────────────────────────────────────────────────── */}
      {orderedGroups.map(([group, rows]) => (
        <section
          key={group}
          id={`group-${group}`}
          data-testid="settings-group"
          className="scroll-mt-24 overflow-hidden rounded-[22px] border border-hairline bg-surface"
        >
          <header className="flex items-center gap-3 px-6 pb-4 pt-5">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/12 text-brand-700 [&_svg]:h-[18px] [&_svg]:w-[18px]">
              {groupIcon(group)}
            </span>
            <div className="min-w-0">
              <h2 className="font-heading text-[19px] font-bold leading-snug text-slate-900">{groupLabel(group)}</h2>
              <p className="text-[12.5px] text-slate-500">{m.count(rows.length)}</p>
            </div>
          </header>
          <ul className="divide-y divide-hairline border-t border-hairline">
            {rows.map((row) => {
              const known = KNOWN_BY_KEY.get(row.key);
              const type: SettingType = known?.type === 'enum' ? 'enum' : detectType(row.value);
              return (
                <SettingRow
                  key={row.key}
                  settingKey={row.key}
                  label={keyLabel(row.key)}
                  type={type}
                  options={known?.options?.map((o) => ({ value: o, label: m.optionLabels[o] ?? o }))}
                  preview={valuePreview(row)}
                  sensitive={row.sensitive}
                  unused={!KNOWN_SETTING_KEYS.has(row.key)}
                  updated={m.updated(relative(row.updatedAt))}
                  locale={locale}
                />
              );
            })}
          </ul>
        </section>
      ))}

    </div>
  );
}
