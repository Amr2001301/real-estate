import { notFound } from 'next/navigation';
import { Mail, Phone } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { UserPermissionsResponse, UserRole } from '@/lib/types';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { cn } from '@/lib/cn';
import { PremiumPageHero } from '@/components/premium';
import { PermissionPicker } from './permission-picker';

export const dynamic    = 'force-dynamic';
export const fetchCache = 'force-no-store';

const ROLE_CHIP: Partial<Record<UserRole, string>> = {
  ADMIN:                  'bg-brand-500/12 text-brand-700',
  SALES_MANAGER:          'bg-sky-500/12 text-sky-600',
  SALES:                  'bg-emerald-500/12 text-emerald-600',
  MAINTENANCE_SUPERVISOR: 'bg-orange-500/12 text-orange-600',
  CUSTOMER:               'bg-teal-500/12 text-teal-600',
  BROKER:                 'bg-indigo-500/12 text-indigo-600',
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('');
}

export default async function UserPermissionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [res, locale] = await Promise.all([
    safe(api.get<UserPermissionsResponse>(`/users/${id}/permissions`)),
    getLocale(),
  ]);
  if (res.error || !res.data) notFound();
  const { user, assigned, available } = res.data;
  const m = uiT(locale).userPermissionsPage;

  const total = assigned.length + available.length;
  const pct = total > 0 ? Math.round((assigned.length / total) * 100) : 0;
  const r = 44;
  const c = 2 * Math.PI * r;

  return (
    <div className="flex flex-col gap-5 pb-2 lg:gap-6">
      <PremiumPageHero
        title={`${m.titlePrefix} ${user.fullName}`}
        description={m.description}
        breadcrumbs={[
          { label: m.breadcrumbDashboard, href: '/dashboard' },
          { label: m.breadcrumbPermissions, href: '/dashboard/permissions' },
          { label: user.fullName },
        ]}
      />

      {/* ── Who, and how much of the catalogue they hold ──────────────────── */}
      <section
        data-testid="user-permissions-hero"
        className="relative overflow-hidden rounded-[26px] border border-hairline bg-surface"
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-bl from-brand-500/[0.10] via-transparent to-transparent" />
        <div className="pointer-events-none absolute -top-24 start-1/4 h-56 w-56 rounded-full bg-brand-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="flex min-w-0 items-center gap-5">
            <span
              aria-hidden
              className="inline-flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400/35 to-brand-700/20 font-heading text-[26px] font-bold text-brand-700 ring-2 ring-brand-500/40 ring-offset-4 ring-offset-surface"
            >
              {initials(user.fullName)}
            </span>
            <div className="min-w-0">
              <p className="truncate font-heading text-[26px] font-bold leading-tight text-slate-900">{user.fullName}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className={cn('rounded-full px-3 py-1 text-[12px] font-semibold', ROLE_CHIP[user.role] ?? 'bg-slate-500/10 text-slate-600')}>
                  {m.roleLabels[user.role] ?? user.role}
                </span>
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold',
                    user.active ? 'bg-emerald-500/12 text-emerald-600' : 'bg-slate-500/10 text-slate-500',
                  )}
                >
                  <span className={cn('h-1.5 w-1.5 rounded-full', user.active ? 'bg-emerald-500' : 'bg-slate-400')} />
                  {user.active ? m.activeLabel : m.inactiveLabel}
                </span>
              </div>
              {(user.email || user.phone) && (
                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[12.5px] text-slate-500">
                  {user.email && (
                    <span className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /><span dir="ltr">{user.email}</span></span>
                  )}
                  {user.phone && (
                    <span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /><span dir="ltr">{user.phone}</span></span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-5">
            <div className="relative h-[110px] w-[110px] shrink-0" data-testid="user-permissions-ring">
              <svg viewBox="0 0 110 110" className="h-full w-full -rotate-90">
                <circle cx="55" cy="55" r={r} fill="none" strokeWidth="9" className="stroke-surface-muted" />
                <circle cx="55" cy="55" r={r} fill="none" strokeWidth="9" strokeLinecap="round" strokeDasharray={`${(pct / 100) * c} ${c}`} className="stroke-brand-500" />
              </svg>
              <span className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="num text-[30px] font-semibold leading-none text-slate-900">{assigned.length}</span>
                <span className="mt-1 text-[11px] text-slate-500 tabular-nums">{m.ofLabel} {total}</span>
              </span>
            </div>
            <div>
              <p className="text-[14px] font-bold text-slate-900">{m.grantedTitle}</p>
              <p className="mt-1 max-w-[220px] text-[12px] leading-relaxed text-slate-500">{m.infoNotice(user.fullName)}</p>
            </div>
          </div>
        </div>
      </section>

      <PermissionPicker
        userId={id}
        userName={user.fullName}
        assigned={assigned}
        available={available}
        locale={locale}
      />
    </div>
  );
}
