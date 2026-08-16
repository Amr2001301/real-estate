import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  ShieldCheck, Search as SearchIcon, Users as UsersIcon, Info,
  TrendingUp, Calendar, Bookmark, FileText, CreditCard, Wrench,
  BarChart3, Lock, LayoutGrid, Award, CircleDollarSign,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import type { PermissionItem, Paged, User, UserRole } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/cn';
import {
  getPermissionMeta,
  PERMISSION_CATEGORIES,
  PERMISSION_TYPE_CLS,
  type PermissionCategory,
  type PermissionMeta,
} from '@/lib/permission-labels';
import {
  PremiumPageHero,
  PremiumMetricStrip,
  PremiumFilterBar,
  PremiumSectionCard,
} from '@/components/premium';

export const dynamic    = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface Search { q?: string }

type EnrichedPermission = PermissionItem & { meta: PermissionMeta };

const ROLE_BADGE_CLS: Record<UserRole, string> = {
  ADMIN:                  'bg-purple-100 text-purple-700',
  SALES_MANAGER:          'bg-blue-100 text-blue-700',
  SALES:                  'bg-brand-100 text-brand-700',
  MAINTENANCE_SUPERVISOR: 'bg-orange-100 text-orange-700',
  CLIENT:                 'bg-slate-100 text-slate-600',
  CUSTOMER:               'bg-teal-100 text-teal-700',
  BROKER:                 'bg-indigo-100 text-indigo-700',
};

const CATEGORY_ICON: Record<PermissionCategory, ReactNode> = {
  'المبيعات':                  <TrendingUp />,
  'الزيارات':                  <Calendar />,
  'الحجوزات':                  <Bookmark />,
  'العقود':                    <FileText />,
  'الدفعات':                   <CreditCard />,
  'الصيانة':                   <Wrench />,
  'المستندات':                 <FileText />,
  'الوسطاء':                   <UsersIcon />,
  'عمولات الوسطاء':            <CircleDollarSign />,
  'عمولات المبيعات':           <Award />,
  'التقارير':                  <BarChart3 />,
  'المستخدمون والصلاحيات':     <ShieldCheck />,
  'النظام والأمان':            <Lock />,
  'أخرى':                      <LayoutGrid />,
};

const AVATAR_PALETTE = [
  'bg-violet-100 text-violet-700',
  'bg-sky-100    text-sky-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100  text-amber-700',
  'bg-pink-100   text-pink-700',
  'bg-indigo-100 text-indigo-700',
];

function avatarColor(id: string): string {
  const n = id.charCodeAt(0) + id.charCodeAt(id.length - 1);
  return AVATAR_PALETTE[n % AVATAR_PALETTE.length] ?? 'bg-slate-100 text-slate-700';
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase();
}

export default async function PermissionsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const [sp, locale] = await Promise.all([searchParams, getLocale()]);
  const m = uiT(locale).permissionsPage;

  const [permsRes, usersRes] = await Promise.all([
    safe(api.get<PermissionItem[]>('/permissions')),
    safe(api.get<Paged<User>>('/users?pageSize=50')),
  ]);

  const all: EnrichedPermission[] = (permsRes.data ?? []).map((p) => ({
    ...p,
    meta: getPermissionMeta(p.code, p.description),
  }));

  const needle = sp.q?.trim().toLowerCase();
  const filtered = needle
    ? all.filter((p) =>
        [p.code, p.meta.label, p.meta.description, p.meta.category]
          .some((field) => field.toLowerCase().includes(needle)),
      )
    : all;

  const byCategory = new Map<PermissionCategory, EnrichedPermission[]>();
  for (const p of filtered) {
    const list = byCategory.get(p.meta.category) ?? [];
    list.push(p);
    byCategory.set(p.meta.category, list);
  }
  const sections = PERMISSION_CATEGORIES.map((cat) => ({
    category: cat,
    items: (byCategory.get(cat) ?? [])
      .slice()
      .sort((a, b) => a.meta.label.localeCompare(b.meta.label, 'ar')),
  })).filter((s) => s.items.length > 0);

  const users = usersRes.data?.data ?? [];

  const totalGroups = PERMISSION_CATEGORIES.filter((cat) =>
    all.some((p) => p.meta.category === cat),
  ).length;
  const adminPerms = all.filter((p) => p.meta.type === 'إداري').length;

  return (
    <div className="space-y-5">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <PremiumPageHero
        title={m.title}
        description={m.description}
        breadcrumbs={[
          { label: m.breadcrumbDashboard, href: '/dashboard' },
          { label: m.breadcrumbPermissions },
        ]}
        meta={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 border border-brand-200 px-2.5 py-1 text-[11px] font-bold text-brand-700">
            <ShieldCheck className="h-3.5 w-3.5" />
            {m.metaBadge}
          </span>
        }
      />

      {/* ── KPI strip ──────────────────────────────────────────────────── */}
      <PremiumMetricStrip
        variant="dashboard"
        cols={4}
        metrics={[
          {
            label: m.kpiTotal,
            value: all.length.toLocaleString('ar-EG'),
            icon: <ShieldCheck />,
            tone: 'brand',
          },
          {
            label: m.kpiGroups,
            value: totalGroups.toLocaleString('ar-EG'),
            icon: <LayoutGrid />,
            tone: 'neutral',
          },
          {
            label: m.kpiUsers,
            value: users.length.toLocaleString('ar-EG'),
            icon: <UsersIcon />,
            tone: 'info',
          },
          {
            label: m.kpiAdmin,
            value: adminPerms.toLocaleString('ar-EG'),
            icon: <Lock />,
            tone: 'warning',
          },
        ]}
      />

      {/* ── Info notice ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 rounded-xl border border-brand-100 bg-brand-50/40 px-4 py-3 text-[12px] text-brand-800">
        <Info className="h-4 w-4 shrink-0 text-brand-600" />
        <span>{m.infoNotice}</span>
      </div>

      {/* ── Error ───────────────────────────────────────────────────────── */}
      {permsRes.error && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          {m.errorLoad} {permsRes.error}
        </div>
      )}

      {/* ── Two-column layout ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">

        {/* ── Permissions catalog (2 cols) ──────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Search bar */}
          <PremiumFilterBar
            method="get"
            action="/dashboard/permissions"
            trailing={
              <>
                <Button type="submit" variant="primary" size="sm">{m.searchBtn}</Button>
                {sp.q && (
                  <Link href="/dashboard/permissions">
                    <Button type="button" variant="ghost" size="sm">{m.clearBtn}</Button>
                  </Link>
                )}
              </>
            }
          >
            <div className="flex-1 min-w-[240px]">
              <Input
                name="q"
                inputSize="sm"
                placeholder={m.searchPlaceholder}
                defaultValue={sp.q ?? ''}
                leftAddon={<SearchIcon />}
              />
            </div>
          </PremiumFilterBar>

          {/* Permission group cards */}
          {sections.length === 0 ? (
            <PremiumSectionCard icon={<ShieldCheck />} title={m.noResultsTitle} padded={false}>
              <EmptyState
                icon={<ShieldCheck />}
                title={m.emptyTitle}
                description={m.emptyDesc}
                action={
                  sp.q ? (
                    <Link href="/dashboard/permissions">
                      <Button variant="outline" size="sm">{m.clearSearch}</Button>
                    </Link>
                  ) : undefined
                }
              />
            </PremiumSectionCard>
          ) : (
            <div className="space-y-4">
              {sections.map((section) => (
                <PremiumSectionCard
                  key={section.category}
                  icon={CATEGORY_ICON[section.category]}
                  title={section.category}
                  trailing={
                    <span className="inline-flex h-5 min-w-[20px] px-1.5 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500 tabular-nums">
                      {section.items.length}
                    </span>
                  }
                  padded={false}
                >
                  <ul className="divide-y divide-hairline">
                    {section.items.map((p) => (
                      <li
                        key={p.id}
                        className="flex items-start gap-4 px-5 py-4 hover:bg-canvas/40 transition-colors"
                      >
                        {/* Label + description + code */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[13px] font-semibold text-slate-900">
                              {p.meta.label}
                            </span>
                            <span
                              className={cn(
                                'inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold leading-tight shrink-0',
                                PERMISSION_TYPE_CLS[p.meta.type],
                              )}
                            >
                              {p.meta.type}
                            </span>
                          </div>
                          {p.meta.description && (
                            <p className="text-[12px] text-slate-500 mt-1 leading-relaxed">
                              {p.meta.description}
                            </p>
                          )}
                          <p
                            className="font-mono text-[11px] text-slate-400 mt-1.5 select-all"
                            dir="ltr"
                          >
                            {p.code}
                          </p>
                        </div>

                        {/* User count pill */}
                        <div className="flex items-center gap-1.5 shrink-0 mt-0.5 rounded-full bg-slate-100 px-2.5 py-1">
                          <UsersIcon className="h-3 w-3 text-slate-400 shrink-0" />
                          <span className="text-[11px] font-semibold text-slate-600 tabular-nums">
                            {p.userCount}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </PremiumSectionCard>
              ))}
            </div>
          )}
        </div>

        {/* ── User permissions sidebar (sticky) ─────────────────────────── */}
        <div className="lg:sticky lg:top-4">
          <PremiumSectionCard
            icon={<UsersIcon />}
            title={m.sidebarTitle}
            description={m.sidebarDesc}
            padded={false}
          >
            {users.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  icon={<UsersIcon />}
                  title={m.noUsersTitle}
                  description={m.noUsersDesc}
                />
              </div>
            ) : (
              <div className="overflow-y-auto scrollbar-thin max-h-[calc(100vh-300px)]">
                <ul className="divide-y divide-hairline">
                  {users.map((u) => (
                    <li
                      key={u.id}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-canvas/40 transition-colors"
                    >
                      {/* Avatar */}
                      <span
                        className={cn(
                          'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[12px] font-bold',
                          avatarColor(u.id),
                        )}
                        aria-hidden
                      >
                        {initials(u.fullName)}
                      </span>

                      {/* Name + role */}
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-slate-900 truncate leading-tight">
                          {u.fullName}
                        </p>
                        <span
                          className={cn(
                            'inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold leading-tight whitespace-nowrap',
                            ROLE_BADGE_CLS[u.role] ?? 'bg-slate-100 text-slate-600',
                          )}
                        >
                          {m.roleLabels[u.role] ?? u.role}
                        </span>
                      </div>

                      {/* Action */}
                      <Link
                        href={`/dashboard/users/${u.id}/permissions` as never}
                        className="shrink-0"
                      >
                        <Button variant="outline" size="sm">{m.manageBtn}</Button>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </PremiumSectionCard>
        </div>

      </div>
    </div>
  );
}
