import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  ShieldCheck, Search as SearchIcon, Users as UsersIcon, Info,
  TrendingUp, Calendar, Bookmark, FileText, CreditCard, Wrench,
  BarChart3, Lock, LayoutGrid, Award, CircleDollarSign,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
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
} from '@/components/premium';

export const dynamic    = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface Search { q?: string }

type EnrichedPermission = PermissionItem & { meta: PermissionMeta };

// ── Role display maps (same pattern as /dashboard/users) ─────────────────────

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
  SALES_MANAGER:          'bg-blue-100 text-blue-700',
  SALES:                  'bg-brand-100 text-brand-700',
  MAINTENANCE_SUPERVISOR: 'bg-orange-100 text-orange-700',
  CLIENT:                 'bg-slate-100 text-slate-600',
  CUSTOMER:               'bg-teal-100 text-teal-700',
  BROKER:                 'bg-indigo-100 text-indigo-700',
};

// ── Category icons ────────────────────────────────────────────────────────────

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

// ── Avatar helpers ────────────────────────────────────────────────────────────

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

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PermissionsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;

  const [permsRes, usersRes] = await Promise.all([
    safe(api.get<PermissionItem[]>('/permissions')),
    safe(api.get<Paged<User>>('/users?pageSize=50')),
  ]);

  // Enrich each permission with business-friendly display metadata.
  const all: EnrichedPermission[] = (permsRes.data ?? []).map((p) => ({
    ...p,
    meta: getPermissionMeta(p.code, p.description),
  }));

  // Search matches code, Arabic label, description, and category.
  const needle = sp.q?.trim().toLowerCase();
  const filtered = needle
    ? all.filter((p) =>
        [p.code, p.meta.label, p.meta.description, p.meta.category]
          .some((field) => field.toLowerCase().includes(needle)),
      )
    : all;

  // Group by business category in canonical display order.
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

  // KPI metrics derived from unfiltered data only.
  const totalGroups = PERMISSION_CATEGORIES.filter((cat) =>
    all.some((p) => p.meta.category === cat),
  ).length;
  const adminPerms = all.filter((p) => p.meta.type === 'إداري').length;

  return (
    <div className="space-y-5">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <PremiumPageHero
        title="الصلاحيات"
        description="مراجعة صلاحيات النظام وإدارة صلاحيات المستخدمين حسب الأدوار والأقسام."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'الصلاحيات' },
        ]}
        meta={<ShieldCheck className="h-4 w-4 text-brand-600" />}
      />

      {/* ── KPI summary strip ───────────────────────────────────────────── */}
      <PremiumMetricStrip
        metrics={[
          { label: 'إجمالي الصلاحيات', value: all.length, icon: <ShieldCheck />, tone: 'brand' },
          { label: 'المجموعات', value: totalGroups, icon: <ShieldCheck />, tone: 'neutral' },
          { label: 'المستخدمون', value: users.length, icon: <UsersIcon />, tone: 'info' },
          { label: 'صلاحيات إدارية', value: adminPerms, icon: <ShieldCheck />, tone: 'warning' },
        ]}
      />

      {/* ── Info notice (compact) ────────────────────────────────────────── */}
      <div className="flex items-center gap-2 rounded-xl border border-info-100 bg-info-50 px-4 py-2.5 text-xs text-info-800">
        <Info className="h-3.5 w-3.5 shrink-0 text-info-600" />
        <span>
          الصلاحيات تتحكم فيما يمكن للمستخدم عرضه أو تنفيذه. الأكواد التقنية للمرجعة فقط — الأسماء هنا مكتوبة بلغة العمل.
        </span>
      </div>

      {/* ── Error ───────────────────────────────────────────────────────── */}
      {permsRes.error && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          تعذر تحميل الصلاحيات: {permsRes.error}
        </div>
      )}

      {/* ── Two-column layout ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">

        {/* ── Permissions catalog (2 cols) ──────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Search bar */}
          <PremiumFilterBar
            method="get"
            action="/dashboard/permissions"
            trailing={
              <>
                <Button type="submit" variant="primary" size="sm">بحث</Button>
                {sp.q && (
                  <Link href="/dashboard/permissions">
                    <Button type="button" variant="ghost" size="sm">مسح</Button>
                  </Link>
                )}
              </>
            }
          >
            <div className="flex-1 min-w-[240px]">
              <Input
                name="q"
                inputSize="sm"
                placeholder="بحث بالاسم أو الوصف أو القسم أو الرمز (مثل: حجز، دفعة، عمولة، audit)"
                defaultValue={sp.q ?? ''}
                leftAddon={<SearchIcon />}
              />
            </div>
          </PremiumFilterBar>

          {/* Permission group cards */}
          {sections.length === 0 ? (
            <div className="bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden">
              <EmptyState
                icon={<ShieldCheck />}
                title="لا توجد صلاحيات مطابقة"
                description="جرّب توسيع البحث أو تأكّد من بذر رموز الصلاحيات في النظام."
                action={
                  sp.q ? (
                    <Link href="/dashboard/permissions">
                      <Button variant="outline" size="sm">مسح البحث</Button>
                    </Link>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <div className="space-y-4">
              {sections.map((section) => (
                <div key={section.category} className="bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden">
                  {/* Group header */}
                  <div className="flex items-center justify-between px-5 py-3 border-b border-hairline bg-surface-muted/40">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-brand-100 text-brand-700 shrink-0 [&_svg]:h-3.5 [&_svg]:w-3.5">
                        {CATEGORY_ICON[section.category]}
                      </span>
                      <h2 className="text-sm font-semibold text-slate-800">{section.category}</h2>
                    </div>
                    <span className="text-2xs font-medium text-slate-400 tabular-nums bg-surface-muted rounded-full px-2 py-0.5">
                      {section.items.length}
                    </span>
                  </div>

                  {/* Permission rows */}
                  <ul className="divide-y divide-hairline">
                    {section.items.map((p) => (
                      <li
                        key={p.id}
                        className="px-5 py-3 flex items-start justify-between gap-3 hover:bg-surface-muted/20 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-slate-900">{p.meta.label}</span>
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
                            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{p.meta.description}</p>
                          )}
                          <p className="font-mono text-2xs text-slate-400 mt-1 select-all" dir="ltr">
                            {p.code}
                          </p>
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-2xs font-medium text-slate-500 shrink-0 whitespace-nowrap mt-0.5">
                          <UsersIcon className="h-3 w-3 shrink-0" />
                          {p.userCount}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── User permissions side panel (1 col, sticky) ──────────────── */}
        <div className="lg:sticky lg:top-4">
          <div className="bg-surface border border-hairline rounded-[20px] shadow-soft overflow-hidden">

            {/* Panel header */}
            <div className="px-4 pt-4 pb-3 border-b border-hairline bg-surface-muted/40">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-brand-100 text-brand-700 shrink-0 [&_svg]:h-3.5 [&_svg]:w-3.5">
                  <UsersIcon />
                </span>
                <h2 className="text-sm font-semibold text-slate-900">إدارة صلاحيات مستخدم</h2>
              </div>
              <p className="text-2xs text-slate-500 mt-2 leading-relaxed">
                اختر مستخدمًا لإدارة الصلاحيات المسندة إليه. سيُكتب التغيير في سجل التدقيق.
              </p>
            </div>

            {/* Scrollable user list */}
            <div className="overflow-y-auto scrollbar-thin max-h-[calc(100vh-260px)]">
              {users.length === 0 ? (
                <div className="p-5">
                  <EmptyState
                    icon={<UsersIcon />}
                    title="لا يوجد مستخدمون"
                    description="لم يتم تحميل أي مستخدمين."
                  />
                </div>
              ) : (
                <ul className="divide-y divide-hairline">
                  {users.map((u) => (
                    <li
                      key={u.id}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-brand-50/20 transition-colors"
                    >
                      {/* Avatar initials */}
                      <span
                        className={cn(
                          'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold',
                          avatarColor(u.id),
                        )}
                        aria-hidden
                      >
                        {initials(u.fullName)}
                      </span>

                      {/* Name + role badge */}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900 truncate leading-tight">
                          {u.fullName}
                        </p>
                        <span
                          className={cn(
                            'inline-block mt-0.5 px-1.5 py-px rounded-full text-[10px] font-medium leading-tight whitespace-nowrap',
                            ROLE_BADGE_CLS[u.role] ?? 'bg-slate-100 text-slate-600',
                          )}
                        >
                          {ROLE_LABEL[u.role] ?? u.role}
                        </span>
                      </div>

                      {/* Manage action */}
                      <Link href={`/dashboard/users/${u.id}/permissions` as never} className="shrink-0">
                        <Button variant="outline" size="sm">إدارة</Button>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
