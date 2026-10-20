import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import { KeyRound, Plus, Users, UserCheck, UserX, Shield, Search } from 'lucide-react';
import { api, safe } from '@/lib/api';
import { staffOptions } from '@/lib/options';
import type { Paged, User, UserRole } from '@/lib/types';
import { formatDate, intlLocale } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import {
  PremiumPageHero,
  PremiumPanel,
  PremiumFilterBar,
  PremiumFilterField,
} from '@/components/premium';
import { getLocale } from '@/lib/locale';
import { getSession } from '@/lib/session';
import { getDisabledFeatures } from '@/lib/capabilities';
import { uiT } from '@/messages/ui';

export const dynamic    = 'force-dynamic';
export const fetchCache = 'force-no-store';

// ── Server actions ────────────────────────────────────────────────────────────

async function deactivateAction(id: string) {
  'use server';
  await api.patch(`/users/${id}/deactivate`);
  revalidatePath('/dashboard/users');
}

async function activateAction(id: string) {
  'use server';
  await api.patch(`/users/${id}/activate`);
  revalidatePath('/dashboard/users');
}

async function createUserAction(formData: FormData) {
  'use server';
  await api.post('/users', {
    role:     String(formData.get('role')     ?? 'SALES'),
    fullName: String(formData.get('fullName') ?? ''),
    email:    String(formData.get('email')    ?? '') || undefined,
    phone:    String(formData.get('phone')    ?? '') || undefined,
    password: String(formData.get('password') ?? '') || undefined,
  });
  revalidatePath('/dashboard/users');
}

// ADMIN-only: assign/clear the SALES_MANAGER who owns a SALES rep.
async function assignManagerAction(userId: string, formData: FormData) {
  'use server';
  const managerId = String(formData.get('managerId') ?? '') || null;
  await api.patch(`/users/${userId}/manager`, { managerId });
  revalidatePath('/dashboard/users');
}

// ── Constants ─────────────────────────────────────────────────────────────────

const FILTERABLE_ROLES: UserRole[] = [
  'ADMIN', 'SALES', 'SALES_MANAGER', 'MAINTENANCE_SUPERVISOR', 'CLIENT', 'CUSTOMER',
];

const ROLE_CHIP: Partial<Record<UserRole, string>> = {
  ADMIN:                  'bg-brand-500/12 text-brand-700',
  SALES_MANAGER:          'bg-sky-500/12 text-sky-600',
  SALES:                  'bg-emerald-500/12 text-emerald-600',
  MAINTENANCE_SUPERVISOR: 'bg-orange-500/12 text-orange-600',
  CUSTOMER:               'bg-teal-500/12 text-teal-600',
  BROKER:                 'bg-indigo-500/12 text-indigo-600',
};

/** The role chips under the summary, in this order, each with its colour. */
const ROLE_DOT: Partial<Record<UserRole, string>> = {
  ADMIN:                  'bg-brand-500',
  SALES_MANAGER:          'bg-sky-500',
  SALES:                  'bg-emerald-500',
  MAINTENANCE_SUPERVISOR: 'bg-orange-500',
  BROKER:                 'bg-indigo-500',
  CUSTOMER:               'bg-teal-500',
  CLIENT:                 'bg-slate-400',
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase();
}

// ── Page ──────────────────────────────────────────────────────────────────────

interface Search {
  role?: string;
  q?: string;
  status?: string;
  page?: string;
  showCreate?: string;
}

// Rows per page. The list is server-paged (FG-23); this is the page the table
// renders, not a ceiling on how many users the directory may hold.
const PAGE_SIZE = 20;

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const locale = await getLocale();
  const m = uiT(locale).pages.users;

  // A maintenance supervisor only works maintenance; the API refuses one on
  // a plan without it (F36).
  const session = await getSession();
  const disabledFeatures = session ? await getDisabledFeatures(session.role) : new Set<string>();
  const CREATABLE_ROLES: { value: string; label: string }[] = [
    { value: 'ADMIN',                  label: m.roleLabels.ADMIN },
    { value: 'SALES',                  label: m.roleLabels.SALES },
    { value: 'SALES_MANAGER',          label: m.roleLabels.SALES_MANAGER },
    ...(disabledFeatures.has('feature.maintenance')
      ? []
      : [{ value: 'MAINTENANCE_SUPERVISOR', label: m.roleLabels.MAINTENANCE_SUPERVISOR }]),
  ];

  const ROLE_LABEL: Record<UserRole, string> = {
    ADMIN:                  m.roleLabels.ADMIN,
    SALES:                  m.roleLabels.SALES,
    SALES_MANAGER:          m.roleLabels.SALES_MANAGER,
    MAINTENANCE_SUPERVISOR: m.roleLabels.MAINTENANCE_SUPERVISOR,
    CLIENT:                 m.roleLabels.CLIENT,
    CUSTOMER:               m.roleLabels.CUSTOMER,
    BROKER:                 m.roleLabels.BROKER,
  };

  // FG-23 — this page used to fetch ?pageSize=100 and then search, filter AND
  // render from that array. Above a hundred users it did not show wrong counts;
  // it did not show the users, with nothing on screen to say so. Search, status
  // and paging are now the server's job.
  const page   = Math.max(1, Number(sp.page ?? '1') || 1);
  const q      = sp.q?.trim() ?? '';
  const status = sp.status ?? '';

  const listQs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (sp.role) listQs.set('role', sp.role);
  if (q) listQs.set('q', q);
  if (status === 'active')   listQs.set('active', 'true');
  if (status === 'inactive') listQs.set('active', 'false');

  // A second call carries the KPI strip. It keeps the role filter but drops q
  // and status on purpose: the tiles describe the directory, not the current
  // search, which is what they did before. Changing the page size made them
  // correct; changing what they count would be a separate decision.
  const kpiQs = new URLSearchParams({ pageSize: '1' });
  if (sp.role) kpiQs.set('role', sp.role);

  const [usersRes, kpiRes, managersRes, allRolesRes] = await Promise.all([
    safe(api.get<Paged<User>>(`/users?${listQs}`)),
    safe(api.get<Paged<User>>(`/users?${kpiQs}`)),
    safe(staffOptions(['SALES_MANAGER'])),
    // The role chips count every role, whichever one is picked.
    sp.role ? safe(api.get<Paged<User>>('/users?pageSize=1')) : Promise.resolve(null),
  ]);

  const paged    = usersRes.data;
  const rows     = paged?.data ?? [];
  const managers = managersRes.data?.data ?? [];

  const facets     = kpiRes.data?.meta.facets;
  const byActive   = facets?.counts?.active ?? {};
  const byRole     = facets?.counts?.role ?? {};
  const total      = kpiRes.data?.meta.total ?? 0;
  const active     = byActive.true ?? 0;
  const inactive   = byActive.false ?? 0;
  const adminRoles = (byRole.ADMIN ?? 0) + (byRole.SALES_MANAGER ?? 0);
  const lastLogin  = facets?.max?.lastLoginAt;

  const showCreate = sp.showCreate === '1';
  const hasFilter  = !!(sp.q || sp.role || sp.status);

  // URL builders
  const showCreateUrl = (() => {
    const p = new URLSearchParams();
    if (sp.role)   p.set('role',   sp.role);
    if (sp.q)      p.set('q',      sp.q);
    if (sp.status) p.set('status', sp.status);
    p.set('showCreate', '1');
    return `/dashboard/users?${p.toString()}`;
  })();

  const cancelCreateUrl = (() => {
    const p = new URLSearchParams();
    if (sp.role)   p.set('role',   sp.role);
    if (sp.q)      p.set('q',      sp.q);
    if (sp.status) p.set('status', sp.status);
    const s = p.toString();
    return `/dashboard/users${s ? `?${s}` : ''}`;
  })();

  const clearFilterUrl = `/dashboard/users${showCreate ? '?showCreate=1' : ''}`;

  const num = (n: number) => n.toLocaleString(intlLocale(locale));
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
  const allFacets = (allRolesRes ?? kpiRes).data?.meta;
  const allByRole = allFacets?.facets?.counts?.role ?? {};
  const allTotal = allFacets?.total ?? total;
  const roleMix = (Object.keys(ROLE_DOT) as UserRole[])
    .map((r) => [r, allByRole[r] ?? 0] as const)
    .filter(([, n]) => n > 0);

  return (
    <div className="flex flex-col gap-5 pb-2 lg:gap-6">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <PremiumPageHero
        title={m.title}
        description={m.description}
        breadcrumbs={[
          { label: uiT(locale).common.breadcrumbHome, href: '/dashboard' },
          { label: m.breadcrumb },
        ]}
        actions={
          !showCreate ? (
            <Link href={showCreateUrl as never}>
              <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />}>
                {m.addBtn}
              </Button>
            </Link>
          ) : undefined
        }
      />

      {/* ── Summary ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard testId="users-total" icon={<Users />} label={m.kpi.total}>
          <p className="num text-[34px] font-semibold leading-none text-slate-900">{num(total)}</p>
          <p className="mt-2 text-[12px] text-slate-500">{m.kpi.rolesSub(Object.values(byRole).filter((n) => (n ?? 0) > 0).length)}</p>
        </SummaryCard>
        <SummaryCard testId="users-active" icon={<UserCheck />} label={m.kpi.active} tone="good">
          <p className="num text-[34px] font-semibold leading-none text-slate-900">{num(active)}</p>
          <p className="mt-2 text-[12px] text-slate-500">{m.kpi.activeShare(total > 0 ? Math.round((active / total) * 100) : 0)}</p>
        </SummaryCard>
        <SummaryCard testId="users-inactive" icon={<UserX />} label={m.kpi.inactive} tone={inactive > 0 ? 'warn' : 'neutral'}>
          <p className="num text-[34px] font-semibold leading-none text-slate-900">{num(inactive)}</p>
          <p className="mt-2 text-[12px] text-slate-500">{inactive > 0 ? m.kpi.inactiveSome : m.kpi.inactiveNone}</p>
        </SummaryCard>
        <SummaryCard testId="users-admins" icon={<Shield />} label={m.kpi.adminRoles}>
          <p className="num text-[34px] font-semibold leading-none text-slate-900">{num(adminRoles)}</p>
          <p className="mt-2 truncate text-[12px] text-slate-500">
            {lastLogin ? `${m.kpi.lastLogin}: ${relative(lastLogin)}` : m.kpi.adminSub}
          </p>
        </SummaryCard>
      </div>

      {/* ── Roles: a chip per role, each a filter ─────────────────────────── */}
      {roleMix.length > 0 && (
        <nav className="flex flex-wrap items-center gap-2" data-testid="users-roles">
          {[['', allTotal] as const, ...roleMix].map(([r, n]) => {
            const on = (sp.role ?? '') === r;
            const p = new URLSearchParams();
            if (r) p.set('role', r);
            if (sp.status) p.set('status', sp.status);
            const qs = p.toString();
            return (
              <Link
                key={r || 'all'}
                href={`/dashboard/users${qs ? `?${qs}` : ''}` as never}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors',
                  on
                    ? 'border-brand-500/50 bg-brand-500/12 text-brand-700'
                    : 'border-hairline bg-surface text-slate-600 hover:border-brand-500/30 hover:text-slate-900',
                )}
              >
                {r && <span className={cn('h-2 w-2 rounded-full', ROLE_DOT[r as UserRole])} />}
                {r ? ROLE_LABEL[r as UserRole] : m.kpi.allRoles}
                <span className={cn('tabular-nums', on ? 'text-brand-700' : 'text-slate-400')}>{num(n)}</span>
              </Link>
            );
          })}
        </nav>
      )}

      {/* ── Create user (collapsible via showCreate=1) ──────────────────── */}
      {showCreate && (
        <PremiumPanel
          title={m.createCard.title}
          trailing={
            <Link href={cancelCreateUrl as never} className="text-[13px] text-slate-500 transition-colors hover:text-slate-700">
              {m.createCard.cancelLink}
            </Link>
          }
        >
          <form action={createUserAction} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-600">{m.createCard.roleLabel}</label>
              <Select name="role" inputSize="sm" defaultValue="SALES">
                {CREATABLE_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-600">{m.createCard.nameLabel}</label>
              <Input name="fullName" inputSize="sm" required placeholder={m.createCard.namePlaceholder} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-600">{m.createCard.emailLabel}</label>
              <Input name="email" type="email" inputSize="sm" required placeholder={m.createCard.emailPlaceholder} dir="ltr" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-600">{m.createCard.passwordLabel}</label>
              <Input name="password" type="password" inputSize="sm" required minLength={8} placeholder={m.createCard.passwordPlaceholder} />
            </div>
            <div className="flex items-end">
              <Button type="submit" variant="primary" size="sm" fullWidth>{m.createCard.submitBtn}</Button>
            </div>
          </form>
        </PremiumPanel>
      )}

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <PremiumFilterBar
        method="get"
        action="/dashboard/users"
        trailing={
          <>
            <Button type="submit" variant="primary" size="sm">{uiT(locale).common.filterBtn}</Button>
            {hasFilter && (
              <Link href={clearFilterUrl as never}>
                <Button type="button" variant="ghost" size="sm">{uiT(locale).common.clearBtn}</Button>
              </Link>
            )}
          </>
        }
      >
        {showCreate && <input type="hidden" name="showCreate" value="1" />}
        <PremiumFilterField label={m.filter.searchLabel}>
          <div className="w-60">
            <Input name="q" inputSize="sm" placeholder={m.filter.searchPlaceholder} defaultValue={sp.q ?? ''} leftAddon={<Search />} />
          </div>
        </PremiumFilterField>
        <PremiumFilterField label={m.filter.roleLabel}>
          <Select name="role" inputSize="sm" defaultValue={sp.role ?? ''} className="w-40">
            <option value="">{m.filter.allRoles}</option>
            {FILTERABLE_ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABEL[r]}</option>
            ))}
          </Select>
        </PremiumFilterField>
        <PremiumFilterField label={m.filter.statusLabel}>
          <Select name="status" inputSize="sm" defaultValue={sp.status ?? ''} className="w-36">
            <option value="">{m.filter.allStatuses}</option>
            <option value="active">{m.filter.activeOnly}</option>
            <option value="inactive">{m.filter.inactiveOnly}</option>
          </Select>
        </PremiumFilterField>
      </PremiumFilterBar>

      {usersRes.error && (
        <div className="rounded-2xl border border-danger-100 bg-danger-50 p-4 text-sm text-danger-700">{usersRes.error}</div>
      )}

      {/* ── Users ───────────────────────────────────────────────────────── */}
      <PremiumPanel
        title={m.sectionTitle}
        sub={`${num(paged?.meta.total ?? 0)} ${m.userSuffix}`}
        padding="none"
      >
        {rows.length === 0 ? (
          <EmptyState
            icon={<Users />}
            title={hasFilter ? m.empty.filteredTitle : m.empty.emptyTitle}
            description={hasFilter ? m.empty.filteredDesc : m.empty.emptyDesc}
            action={
              hasFilter ? (
                <Link href={clearFilterUrl as never}>
                  <Button variant="outline" size="sm">{m.empty.clearBtn}</Button>
                </Link>
              ) : (
                <Link href={showCreateUrl as never}>
                  <Button variant="primary" size="sm" leftIcon={<Plus className="h-4 w-4" />}>{m.empty.addBtn}</Button>
                </Link>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[860px] text-[13px]" data-testid="users-table">
              <thead>
                <tr className="text-[11.5px] text-slate-500">
                  <th className="py-3 ps-6 pe-4 text-start font-semibold">{m.cols.user}</th>
                  <th className="px-4 py-3 text-start font-semibold">{m.cols.role}</th>
                  <th className="px-4 py-3 text-start font-semibold">{m.cols.manager}</th>
                  <th className="px-4 py-3 text-start font-semibold">{m.cols.lastLogin}</th>
                  <th className="px-4 py-3 text-start font-semibold">{m.cols.status}</th>
                  <th className="py-3 ps-4 pe-6" />
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline border-t border-hairline">
                {rows.map((u) => {
                  const manager = managers.find((x) => x.id === u.managerId);
                  return (
                    <tr key={u.id} className="align-middle transition-colors hover:bg-surface-muted/40">
                      {/* User + contact */}
                      <td className="py-3.5 ps-6 pe-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            aria-hidden
                            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400/30 to-brand-600/20 text-[13px] font-bold text-brand-700 ring-1 ring-inset ring-brand-500/30"
                          >
                            {initials(u.fullName)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-[14px] font-semibold text-slate-900">{u.fullName}</p>
                            <p className="truncate text-[12px] text-slate-500" dir="ltr" style={{ textAlign: 'start' }}>
                              {u.email || u.phone || '—'}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <span className={cn('inline-block rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold', ROLE_CHIP[u.role] ?? 'bg-slate-500/10 text-slate-600')}>
                          {ROLE_LABEL[u.role] ?? u.role}
                        </span>
                      </td>

                      {/* Sales manager: shown, changed on demand */}
                      <td className="whitespace-nowrap px-4 py-3.5">
                        {u.role === 'SALES' ? (
                          <details className="group/mgr">
                            <summary className="inline-flex cursor-pointer list-none items-center gap-2 text-[13px] text-slate-700 [&::-webkit-details-marker]:hidden">
                              <span className={manager ? 'font-medium' : 'text-slate-400'}>{manager?.fullName ?? m.noManager}</span>
                              <span className="rounded-full border border-hairline px-2 py-0.5 text-[11px] font-semibold text-brand-700 transition-colors hover:border-brand-500/40">
                                {m.change}
                              </span>
                            </summary>
                            <form action={assignManagerAction.bind(null, u.id)} className="mt-2 flex items-center gap-1.5">
                              <Select name="managerId" defaultValue={u.managerId ?? ''} inputSize="sm" className="w-40">
                                <option value="">{m.noManager}</option>
                                {managers.map((mgr) => (
                                  <option key={mgr.id} value={mgr.id}>{mgr.fullName}</option>
                                ))}
                              </Select>
                              <Button type="submit" variant="outline" size="sm">{m.saveBtn}</Button>
                            </form>
                          </details>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* Last sign-in (joined under it) */}
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <p className={cn('text-[13px]', u.lastLoginAt ? 'font-medium text-slate-800' : 'text-slate-400')}>
                          {u.lastLoginAt ? relative(u.lastLoginAt) : m.kpi.never}
                        </p>
                        <p className="mt-0.5 text-[11.5px] text-slate-400">
                          {m.cols.joined} {formatDate(u.createdAt, locale)}
                        </p>
                      </td>

                      {/* Status */}
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold',
                            u.active ? 'bg-emerald-500/12 text-emerald-600' : 'bg-slate-500/10 text-slate-500',
                          )}
                        >
                          <span className={cn('h-1.5 w-1.5 rounded-full', u.active ? 'bg-emerald-500' : 'bg-slate-400')} aria-hidden />
                          {u.active ? m.statusBadge.active : m.statusBadge.inactive}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 ps-4 pe-6">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`/dashboard/users/${u.id}/permissions` as never}
                            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-hairline px-3 text-[12px] font-semibold text-slate-700 transition-colors hover:border-brand-500/40 hover:text-brand-700"
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                            {m.actionBtns.permissions}
                          </Link>
                          {u.active ? (
                            <form action={deactivateAction.bind(null, u.id)}>
                              <button
                                type="submit"
                                className="inline-flex h-8 items-center rounded-full px-3 text-[12px] font-semibold text-danger-600 transition-colors hover:bg-danger-500/10"
                              >
                                {m.actionBtns.deactivate}
                              </button>
                            </form>
                          ) : (
                            <form action={activateAction.bind(null, u.id)}>
                              <button
                                type="submit"
                                className="inline-flex h-8 items-center rounded-full border border-emerald-500/30 px-3 text-[12px] font-semibold text-emerald-600 transition-colors hover:bg-emerald-500/10"
                              >
                                {m.actionBtns.activate}
                              </button>
                            </form>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </PremiumPanel>

      {paged && paged.meta.total > paged.meta.pageSize && (
        <Pagination
          page={paged.meta.page}
          pageSize={paged.meta.pageSize}
          total={paged.meta.total}
          basePath="/dashboard/users"
          params={{ role: sp.role, q: sp.q, status: sp.status }}
        />
      )}
    </div>
  );
}

function SummaryCard({
  icon, label, children, tone = 'neutral', testId,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  tone?: 'neutral' | 'good' | 'warn';
  testId?: string;
}) {
  return (
    <div
      data-testid={testId}
      className={cn(
        'flex flex-col gap-4 rounded-[20px] border bg-surface p-5',
        tone === 'warn' ? 'border-amber-500/40' : tone === 'good' ? 'border-emerald-500/25' : 'border-hairline',
      )}
    >
      <div className="flex items-center gap-2 text-[12px] font-semibold text-slate-500">
        <span className={cn(
          'inline-flex h-7 w-7 items-center justify-center rounded-lg [&_svg]:h-3.5 [&_svg]:w-3.5',
          tone === 'warn' ? 'bg-amber-500/15 text-amber-600' : tone === 'good' ? 'bg-emerald-500/12 text-emerald-600' : 'bg-brand-500/12 text-brand-700',
        )}>
          {icon}
        </span>
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}
