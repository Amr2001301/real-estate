import Link from 'next/link';
import {
  Plus,
  Users,
  Crown,
  ShieldCheck,
  BadgePercent,
  Mail,
  Phone,
  Pencil,
  UserCheck,
  UserMinus,
  UserX,
  AlertCircle,
} from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { BrokerUser, BrokerUserStatus, Paged } from '@/lib/types';
import { formatDate } from '@/lib/format';
import { getLocale } from '@/lib/locale';
import { portalMoneyTeamT } from '@/messages/portal/money-team';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';
import { BrokerUserStatusBadge } from '@/components/badges';
import { ConfirmingForm } from '@/components/confirming-form';
import {
  PremiumPageHero,
  PremiumFilterBar,
  PremiumFilterField,
  PremiumSectionCard,
} from '@/components/premium';
import { Avatar, FigureBar } from '@/components/cockpit/cockpit';
import { RowMenu, MenuItem } from '@/components/premium/row-menu';
import { setTeamMemberStatusAction } from './actions';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface Search {
  page?: string;
  status?: BrokerUserStatus;
  q?: string;
  err?: string;
}

const PAGE_SIZE = 25;

function PermissionPill({
  icon: Icon,
  label,
  on,
}: {
  icon: typeof Crown;
  label: string;
  on: boolean;
}) {
  if (!on) return null;
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-[#C9A24E]/12 px-2.5 py-1 text-[11.5px] font-semibold text-brand-700">
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

export default async function PortalTeamPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const locale = await getLocale();
  const mt = portalMoneyTeamT(locale);
  const t = mt.team.list;
  const page = Math.max(1, Number(sp.page ?? '1') || 1);

  const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (sp.status) qs.set('status', sp.status);
  if (sp.q)      qs.set('q', sp.q);

  const [res, rActive, rInvited, rSuspended] = await Promise.all([
    safe(api.get<Paged<BrokerUser>>(`/portal/team?${qs.toString()}`)),
    safe(api.get<Paged<BrokerUser>>('/portal/team?page=1&pageSize=1&status=ACTIVE')),
    safe(api.get<Paged<BrokerUser>>('/portal/team?page=1&pageSize=1&status=INVITED')),
    safe(api.get<Paged<BrokerUser>>('/portal/team?page=1&pageSize=1&status=SUSPENDED')),
  ]);

  const items          = res.data?.data ?? [];
  const meta           = res.data?.meta;
  const totalAll       = meta?.total       ?? 0;
  const activeCount    = rActive.data?.meta.total    ?? 0;
  const invitedCount   = rInvited.data?.meta.total   ?? 0;
  const suspendedCount = rSuspended.data?.meta.total ?? 0;

  return (
    <div className="space-y-5">

      <PremiumPageHero
        title={t.title}
        description={t.description}
        breadcrumbs={[
          { label: mt.common.breadcrumbPortal, href: '/portal' },
          { label: mt.team.breadcrumb },
        ]}
        actions={
          <Link href="/portal/team/new">
            <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />}>
              {t.addMember}
            </Button>
          </Link>
        }
      />

      {sp.err && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          {sp.err}
        </div>
      )}
      {res.error && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          {t.loadError(res.error)}
        </div>
      )}

      <section className="overflow-hidden rounded-[22px] border border-hairline bg-surface">
        <FigureBar
          bare
          cols={4}
          figures={[
            { label: t.metrics.total, value: totalAll, href: '/portal/team' },
            { label: t.metrics.active, value: activeCount, href: '/portal/team?status=ACTIVE' },
            { label: t.metrics.invited, value: invitedCount, href: '/portal/team?status=INVITED', warn: invitedCount > 0 },
            { label: t.metrics.suspended, value: suspendedCount, href: '/portal/team?status=SUSPENDED', warn: suspendedCount > 0 },
          ]}
        />
      </section>

      <PremiumFilterBar
        method="get"
        action="/portal/team"
        trailing={
          <div className="flex items-center gap-1.5 ms-auto shrink-0">
            <Button type="submit" variant="primary" size="sm">{t.filterBtn}</Button>
            {(sp.q || sp.status) && (
              <Link href="/portal/team">
                <Button type="button" variant="ghost" size="sm">{t.clearBtn}</Button>
              </Link>
            )}
          </div>
        }
      >
        <PremiumFilterField label={t.searchLabel}>
          <Input
            name="q"
            inputSize="sm"
            placeholder={t.searchPlaceholder}
            defaultValue={sp.q ?? ''}
            className="w-64"
          />
        </PremiumFilterField>
        <PremiumFilterField label={t.statusLabel}>
          <Select name="status" inputSize="sm" defaultValue={sp.status ?? ''} className="w-44">
            <option value="">{t.statusOptions.all}</option>
            <option value="ACTIVE">{t.statusOptions.ACTIVE}</option>
            <option value="INVITED">{t.statusOptions.INVITED}</option>
            <option value="SUSPENDED">{t.statusOptions.SUSPENDED}</option>
            <option value="REMOVED">{t.statusOptions.REMOVED}</option>
          </Select>
        </PremiumFilterField>
      </PremiumFilterBar>

      <PremiumSectionCard
        icon={<Users />}
        title={t.tableTitle}
        padded={false}
        trailing={
          meta ? (
            <span className="text-xs tabular-nums text-slate-400">
              {meta.total} {t.countUnit}
            </span>
          ) : undefined
        }
      >
        {items.length === 0 ? (
          <EmptyState
            icon={<Users />}
            title={t.emptyTitle}
            description={t.emptyDescription}
          />
        ) : (
          <ul className="divide-y divide-hairline" data-testid="team-rows">
            {items.map((m) => (
              <li
                key={m.id}
                data-testid="team-row"
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-6 py-4 transition-colors hover:bg-surface-muted/30 lg:grid-cols-[auto_minmax(0,1.4fr)_110px_minmax(0,1.3fr)_130px_auto]"
              >
                <Avatar name={m.user.fullName} />

                {/* Member: name, job title, contact */}
                <div className="min-w-0">
                  <p className="truncate text-[14.5px] font-bold text-slate-900">{m.user.fullName}</p>
                  {m.jobTitle && <p className="mt-0.5 truncate text-[12px] text-slate-500">{m.jobTitle}</p>}
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-slate-500">
                    {m.user.phone && (
                      <a href={`tel:${m.user.phone}`} className="inline-flex items-center gap-1 tabular-nums hover:text-brand-700">
                        <Phone className="h-3 w-3 shrink-0" />
                        <span dir="ltr">{m.user.phone}</span>
                      </a>
                    )}
                    {m.user.email && (
                      <a href={`mailto:${m.user.email}`} className="inline-flex min-w-0 items-center gap-1 hover:text-brand-700">
                        <Mail className="h-3 w-3 shrink-0" />
                        <bdi className="truncate">{m.user.email}</bdi>
                      </a>
                    )}
                  </div>
                </div>

                {/* Status */}
                <div className="hidden lg:block">
                  <BrokerUserStatusBadge status={m.status} locale={locale} />
                </div>

                {/* Permissions */}
                <div className="hidden flex-wrap items-center gap-1.5 lg:flex">
                  <PermissionPill icon={Crown}        label={t.perms.primaryContact} on={m.isPrimaryContact} />
                  <PermissionPill icon={ShieldCheck}  label={t.perms.manageTeam} on={m.canManageBrokerUsers} />
                  <PermissionPill icon={BadgePercent} label={t.perms.viewCommissions} on={m.canViewCommissions} />
                  {!m.isPrimaryContact && !m.canManageBrokerUsers && !m.canViewCommissions && (
                    <span className="text-[12px] text-slate-400">{t.perms.none}</span>
                  )}
                </div>

                {/* Joined */}
                <div className="hidden text-[12.5px] lg:block">
                  <p className="text-[11px] text-slate-400">{t.cols.joined}</p>
                  {m.joinedAt ? (
                    <p className="mt-0.5 whitespace-nowrap font-semibold tabular-nums text-slate-800">{formatDate(m.joinedAt, locale)}</p>
                  ) : (
                    <p className="mt-0.5 inline-flex items-center gap-1 font-semibold text-amber-600">
                      <Mail className="h-3 w-3" />
                      {t.pendingInvite}
                    </p>
                  )}
                </div>

                {/* Actions: edit stays visible; status changes sit in the menu */}
                <div className="flex items-center justify-end gap-2">
                  <Link
                    href={`/portal/team/${m.id}/edit`}
                    className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border border-[#C9A24E]/50 bg-[#C9A24E]/10 px-4 text-[13px] font-bold text-brand-700 transition-colors hover:bg-[#C9A24E]/20"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    {t.edit}
                  </Link>
                  {/* Every status has at least one change (activate, suspend or remove). */}
                  <RowMenu label={t.cols.actions}>
                      {m.status !== 'ACTIVE' && (
                        <form action={setTeamMemberStatusAction}>
                          <input type="hidden" name="id"     value={m.id} />
                          <input type="hidden" name="status" value="ACTIVE" />
                          <MenuItem type="submit" icon={<UserCheck />}>{t.activate}</MenuItem>
                        </form>
                      )}
                      {m.status === 'ACTIVE' && (
                        <form action={setTeamMemberStatusAction}>
                          <input type="hidden" name="id"     value={m.id} />
                          <input type="hidden" name="status" value="SUSPENDED" />
                          <MenuItem type="submit" icon={<UserMinus />} tone="warning">{t.suspend}</MenuItem>
                        </form>
                      )}
                      {m.status !== 'REMOVED' && (
                        <ConfirmingForm
                          action={setTeamMemberStatusAction}
                          confirmMessage={t.removeConfirm(m.user.fullName)}
                        >
                          <input type="hidden" name="id"     value={m.id} />
                          <input type="hidden" name="status" value="REMOVED" />
                          <MenuItem type="submit" icon={<UserX />} tone="danger">{t.remove}</MenuItem>
                        </ConfirmingForm>
                      )}
                  </RowMenu>
                </div>
              </li>
            ))}
          </ul>
        )}

        {meta && meta.total > meta.pageSize && (
          <Pagination
            basePath="/portal/team"
            locale={locale}
            page={meta.page}
            pageSize={meta.pageSize}
            total={meta.total}
            params={{ status: sp.status, q: sp.q }}
          />
        )}
      </PremiumSectionCard>
    </div>
  );
}
