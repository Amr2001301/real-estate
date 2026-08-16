import { notFound } from 'next/navigation';
import { Star, Mail, Phone, UserPlus, Users } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Broker, BrokerUser, BrokerUserStatus } from '@/lib/types';
import { formatDate } from '@/lib/format';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { BrokerUserStatusBadge } from '@/components/badges';
import { ConfirmingForm } from '@/components/confirming-form';
import {
  PremiumPageHero,
  PremiumSectionCard,
  PremiumEmptyState,
} from '@/components/premium';
import {
  updateBrokerUserAction,
  setBrokerUserPrimaryAction,
  updateBrokerUserStatusAction,
} from '../../actions';
import CreateBrokerUserForm from './_create-form';

function FormField({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">{label}</p>
      {children}
      {hint && <p className="text-[11px] text-slate-400 mt-0.5">{hint}</p>}
    </div>
  );
}

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export default async function BrokerUsersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getLocale();
  const m = uiT(locale).pages.brokerUsersPage;

  const [brokerRes, usersRes] = await Promise.all([
    safe(api.get<Broker>(`/brokers/${id}`)),
    safe(api.get<BrokerUser[]>(`/brokers/${id}/users`)),
  ]);
  if (brokerRes.error || !brokerRes.data) notFound();

  const broker = brokerRes.data;
  const users = usersRes.data ?? [];

  async function updateUser(brokerUserId: string, formData: FormData) {
    'use server';
    await updateBrokerUserAction(id, brokerUserId, formData);
  }
  async function makePrimary(brokerUserId: string) {
    'use server';
    await setBrokerUserPrimaryAction(id, brokerUserId);
  }
  async function changeStatus(brokerUserId: string, status: BrokerUserStatus) {
    'use server';
    await updateBrokerUserStatusAction(id, brokerUserId, status);
  }

  return (
    <div className="space-y-5">

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <PremiumPageHero
        title={m.heroTitle}
        description={m.heroDescription(broker.companyName)}
        breadcrumbs={[
          { label: m.breadcrumbDashboard, href: '/dashboard' },
          { label: m.breadcrumbBrokers, href: '/dashboard/brokers' },
          { label: broker.companyName, href: `/dashboard/brokers/${id}` as never },
          { label: m.breadcrumbEmployees },
        ]}
      />

      {/* ── Error ────────────────────────────────────────────────────── */}
      {usersRes.error && (
        <div className="rounded-2xl bg-danger-50 border border-danger-100 text-danger-700 p-4 text-sm">
          {m.errorLoad}{usersRes.error}
        </div>
      )}

      {/* ── Add employee ─────────────────────────────────────────────── */}
      <PremiumSectionCard title={m.addEmployeeTitle} icon={<UserPlus />}>
        <p className="text-[12px] text-slate-500 mb-5">
          {m.addEmployeeNote}
        </p>
        <CreateBrokerUserForm brokerId={id} locale={locale} />
      </PremiumSectionCard>

      {/* ── Employees table ──────────────────────────────────────────── */}
      <PremiumSectionCard
        title={m.employeesTitle}
        icon={<Users />}
        trailing={
          <span className="text-xs text-slate-400 tabular-nums">
            {users.length} {m.employeesSuffix}
          </span>
        }
        padded={false}
      >
        {users.length === 0 ? (
          <PremiumEmptyState
            icon={<UserPlus />}
            title={m.noEmployeesTitle}
            description={m.noEmployeesDesc}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead className="bg-canvas/50 border-b border-hairline">
                <tr>
                  <th className="px-5 py-3 text-start text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400 whitespace-nowrap">{m.colEmployee}</th>
                  <th className="px-5 py-3 text-start text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400 whitespace-nowrap">{m.colJob}</th>
                  <th className="px-5 py-3 text-start text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400 whitespace-nowrap">{m.colContact}</th>
                  <th className="px-5 py-3 text-start text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400 whitespace-nowrap">{m.colPermissions}</th>
                  <th className="px-5 py-3 text-start text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400 whitespace-nowrap">{m.colStatus}</th>
                  <th className="px-5 py-3 text-start text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400 whitespace-nowrap">{m.colLastLogin}</th>
                  <th className="px-5 py-3 text-start w-px"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {users.map((bu) => {
                  const u = bu.user;
                  return (
                    <tr
                      key={bu.id}
                      className="hover:bg-canvas/40 transition-colors duration-100 align-middle"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-start gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              {bu.isPrimaryContact && (
                                <Star className="h-3.5 w-3.5 text-amber-500 fill-current shrink-0" />
                              )}
                              <p className="text-[13px] font-semibold text-slate-900">{u.fullName}</p>
                            </div>
                            {bu.isPrimaryContact && (
                              <p className="text-[11px] text-amber-600 mt-0.5">{m.primaryContactLabel}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        <span className="text-[12px] text-slate-600">{bu.jobTitle || '—'}</span>
                      </td>

                      <td className="px-5 py-3.5 max-w-[200px]">
                        <div className="space-y-1">
                          {u.email && (
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                              <span className="text-[12px] text-slate-700 truncate min-w-0" dir="ltr">{u.email}</span>
                            </div>
                          )}
                          {u.phone && (
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                              <span className="text-[12px] text-slate-700 truncate min-w-0" dir="ltr">{u.phone}</span>
                            </div>
                          )}
                          {!u.email && !u.phone && <span className="text-[12px] text-slate-300">—</span>}
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap gap-1.5">
                          {bu.canManageBrokerUsers && (
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                              {m.permManageEmployees}
                            </span>
                          )}
                          {bu.canViewCommissions && (
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                              {m.permViewCommissions}
                            </span>
                          )}
                          {!bu.canManageBrokerUsers && !bu.canViewCommissions && (
                            <span className="text-[12px] text-slate-300">—</span>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        <BrokerUserStatusBadge status={bu.status} />
                      </td>

                      <td className="px-5 py-3.5">
                        <span className="text-[12px] text-slate-500 tabular-nums">
                          {formatDate(u.lastLoginAt) ?? '—'}
                        </span>
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="flex flex-col items-end gap-1.5">
                          {!bu.isPrimaryContact && bu.status !== 'REMOVED' && (
                            <form action={makePrimary.bind(null, bu.id)}>
                              <button type="submit" className="text-[11px] font-semibold text-amber-700 hover:underline underline-offset-2 whitespace-nowrap">
                                {m.btnSetPrimary}
                              </button>
                            </form>
                          )}
                          {bu.status !== 'ACTIVE' && bu.status !== 'REMOVED' && (
                            <form action={changeStatus.bind(null, bu.id, 'ACTIVE')}>
                              <button type="submit" className="text-[11px] font-semibold text-success-700 hover:underline underline-offset-2 whitespace-nowrap">
                                {m.btnActivate}
                              </button>
                            </form>
                          )}
                          {bu.status === 'ACTIVE' && (
                            <form action={changeStatus.bind(null, bu.id, 'SUSPENDED')}>
                              <button type="submit" className="text-[11px] font-semibold text-amber-700 hover:underline underline-offset-2 whitespace-nowrap">
                                {m.btnSuspend}
                              </button>
                            </form>
                          )}
                          {bu.status !== 'REMOVED' && (
                            <ConfirmingForm
                              action={changeStatus.bind(null, bu.id, 'REMOVED')}
                              confirmMessage={m.removeConfirm(bu.user.fullName)}
                            >
                              <button type="submit" className="text-[11px] font-semibold text-danger-600 hover:underline underline-offset-2 whitespace-nowrap">
                                {m.btnRemove}
                              </button>
                            </ConfirmingForm>
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
      </PremiumSectionCard>

      {/* ── Edit employees ───────────────────────────────────────────── */}
      {users.length > 0 && (
        <PremiumSectionCard title={m.editSectionTitle} padded={false}>
          <div className="divide-y divide-hairline">
            {users.map((bu) => {
              const u = bu.user;
              return (
                <details key={bu.id} className="group">
                  <summary className="flex items-center gap-5 px-5 py-4 cursor-pointer list-none hover:bg-canvas/40 transition-colors duration-100">
                    {/* Avatar + Name */}
                    <div className="flex items-center gap-3 w-[200px] shrink-0 min-w-0">
                      <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 border border-brand-100 text-brand-700 text-[13px] font-bold">
                        {u.fullName.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          {bu.isPrimaryContact && <Star className="h-3.5 w-3.5 text-amber-500 fill-current shrink-0" />}
                          <p className="text-[13px] font-semibold text-slate-900 truncate">{u.fullName}</p>
                        </div>
                        {bu.jobTitle && <p className="text-[11px] text-slate-400 truncate">{bu.jobTitle}</p>}
                      </div>
                    </div>

                    {/* Contact column */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 mb-0.5">{m.colContact}</p>
                      {u.email && (
                        <p className="text-[12px] font-medium text-slate-700 truncate" dir="ltr">{u.email}</p>
                      )}
                      {u.phone && (
                        <p className="text-[12px] font-medium text-slate-700 truncate" dir="ltr">{u.phone}</p>
                      )}
                      {!u.email && !u.phone && <p className="text-[12px] text-slate-300">—</p>}
                    </div>

                    {/* Status + toggle */}
                    <div className="flex items-center gap-2.5 shrink-0">
                      <BrokerUserStatusBadge status={bu.status} />
                      <span className="inline-flex items-center rounded-lg bg-brand-50 border border-brand-100 px-2.5 py-1 text-[11px] font-semibold text-brand-700 group-open:hidden">
                        {m.editToggleOpen}
                      </span>
                      <span className="inline-flex items-center rounded-lg bg-slate-100 border border-hairline px-2.5 py-1 text-[11px] font-semibold text-slate-500 hidden group-open:inline-flex">
                        {m.editToggleClose}
                      </span>
                    </div>
                  </summary>
                  <div className="px-5 py-5 border-t border-hairline bg-canvas/30">
                    <form action={updateUser.bind(null, bu.id)} className="flex flex-col gap-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField label={m.fieldFullName}>
                          <Input id={`fullName-${bu.id}`} name="fullName" defaultValue={u.fullName} />
                        </FormField>
                        <FormField label={m.fieldJob}>
                          <Input id={`jobTitle-${bu.id}`} name="jobTitle" defaultValue={bu.jobTitle ?? ''} />
                        </FormField>
                        <FormField label={m.fieldEmail}>
                          <Input id={`email-${bu.id}`} name="email" type="email" dir="ltr" defaultValue={u.email ?? ''} />
                        </FormField>
                        <FormField label={m.fieldPhone}>
                          <Input id={`phone-${bu.id}`} name="phone" dir="ltr" defaultValue={u.phone ?? ''} />
                        </FormField>
                      </div>
                      <div className="flex flex-wrap items-end justify-between gap-4 pt-4 border-t border-hairline">
                        <div className="flex flex-col gap-2.5">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">{m.permissionsLabel}</p>
                          <div className="flex flex-wrap items-center gap-5">
                            <label className="inline-flex items-center gap-2 text-[13px] text-slate-700 cursor-pointer select-none">
                              <Checkbox name="canManageBrokerUsers" defaultChecked={bu.canManageBrokerUsers} />
                              <span>{m.permManageEmployeesLabel}</span>
                            </label>
                            <label className="inline-flex items-center gap-2 text-[13px] text-slate-700 cursor-pointer select-none">
                              <Checkbox name="canViewCommissions" defaultChecked={bu.canViewCommissions} />
                              <span>{m.permViewCommissionsLabel}</span>
                            </label>
                          </div>
                        </div>
                        <Button type="submit" variant="primary" size="sm">{m.btnSaveChanges}</Button>
                      </div>
                    </form>
                  </div>
                </details>
              );
            })}
          </div>
        </PremiumSectionCard>
      )}

    </div>
  );
}
