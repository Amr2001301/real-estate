import { notFound } from 'next/navigation';
import { Star, Mail, Phone, UserPlus, Users, Plus, X, Pencil, Trash2 } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { Broker, BrokerUser, BrokerUserStatus } from '@/lib/types';
import { formatDate } from '@/lib/format';
import { getLocale } from '@/lib/locale';
import { uiT } from '@/messages/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BrokerUserStatusBadge } from '@/components/badges';
import { ConfirmingForm } from '@/components/confirming-form';
import { PremiumPageHero, PremiumEmptyState } from '@/components/premium';
import { Avatar } from '@/components/cockpit/cockpit';
import {
  updateBrokerUserAction,
  setBrokerUserPrimaryAction,
  updateBrokerUserStatusAction,
} from '../../actions';
import CreateBrokerUserForm from './_create-form';
import { Switch } from './_switch';

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <label className="text-[12.5px] font-semibold text-slate-700">{label}</label>
      {children}
    </div>
  );
}

const PILL = 'inline-flex h-8 items-center rounded-full border px-3 text-[12px] font-bold transition-colors';

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

  const en = locale === 'en';

  return (
    <div className="space-y-6">
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

      {usersRes.error && (
        <div className="rounded-2xl bg-danger-500/10 p-4 text-sm text-danger-600">
          {m.errorLoad}{usersRes.error}
        </div>
      )}

      {/* ── Add employee: closed until asked for (open when there is nobody yet) ── */}
      <details data-testid="add-employee" open={users.length === 0} className="group rounded-[22px] border border-hairline bg-surface">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 [&::-webkit-details-marker]:hidden">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#D8B66A]/[0.16] text-[#B8913F] dark:text-[#D8B66A]">
              <UserPlus className="h-[18px] w-[18px]" />
            </span>
            <div>
              <h2 className="font-heading text-[18px] font-bold text-slate-900">{m.addEmployeeTitle}</h2>
              <p className="text-[12.5px] text-slate-500">
                {en
                  ? 'A person who already has a broker account is linked to this company; other roles are never converted.'
                  : 'إن كان للشخص حساب بدور وسيط يُربط بهذه الشركة، ولا تُحوَّل حسابات الأدوار الأخرى.'}
              </p>
            </div>
          </div>
          <span className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-gradient-to-l from-[#E6C77E] to-[#C9A24E] px-4 text-[13px] font-bold text-[#1a1408] group-open:hidden">
            <Plus className="h-4 w-4" />
            {m.createFormSubmitBtn}
          </span>
          <span className="hidden h-10 shrink-0 items-center gap-2 rounded-full border border-hairline px-4 text-[13px] font-bold text-slate-600 group-open:inline-flex">
            <X className="h-4 w-4" />
            {m.editToggleClose}
          </span>
        </summary>
        <div className="border-t border-hairline px-6 py-6">
          <CreateBrokerUserForm brokerId={id} locale={locale} />
        </div>
      </details>

      {/* ── Employees: one row each, editing opens in place ─────────────────── */}
      <section data-testid="broker-employees" className="rounded-[22px] border border-hairline bg-surface">
        <header className="flex items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#D8B66A]/[0.16] text-[#B8913F] dark:text-[#D8B66A]">
              <Users className="h-[18px] w-[18px]" />
            </span>
            <h2 className="font-heading text-[18px] font-bold text-slate-900">{m.employeesTitle}</h2>
          </div>
          <span className="text-[12.5px] tabular-nums text-slate-500">{users.length} {m.employeesSuffix}</span>
        </header>

        {users.length === 0 ? (
          <div className="border-t border-hairline">
            <PremiumEmptyState icon={<UserPlus />} title={m.noEmployeesTitle} description={m.noEmployeesDesc} />
          </div>
        ) : (
          <ul className="divide-y divide-hairline border-t border-hairline">
            {users.map((bu) => {
              const u = bu.user;
              return (
                <li key={bu.id} data-testid="broker-employee-row">
                  <details className="group/row">
                    <summary className="grid cursor-pointer list-none grid-cols-[auto_1fr_auto] items-center gap-x-5 gap-y-3 px-6 py-4 transition-colors hover:bg-surface-muted/30 lg:grid-cols-[44px_minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,1fr)_110px_110px_auto] [&::-webkit-details-marker]:hidden">
                      <Avatar name={u.fullName} className="h-11 w-11 text-[14px]" />

                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 truncate text-[14.5px] font-bold text-slate-900">
                          {u.fullName}
                          {bu.isPrimaryContact && <Star className="h-3.5 w-3.5 shrink-0 fill-current text-[#C9A24E]" />}
                        </p>
                        <p className="mt-0.5 truncate text-[12px] text-slate-500">
                          {bu.jobTitle || '—'}
                          {bu.isPrimaryContact && (
                            <span className="ms-2 rounded-full bg-[#D8B66A]/[0.16] px-2 py-0.5 text-[10.5px] font-bold text-[#9A7A2E] dark:text-[#D8B66A]">
                              {m.primaryContactLabel}
                            </span>
                          )}
                        </p>
                      </div>

                      <div className="hidden min-w-0 space-y-1 text-[12.5px] text-slate-600 lg:block">
                        {u.email && (
                          <p className="flex items-center gap-1.5 truncate"><Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" /><span className="truncate" dir="ltr">{u.email}</span></p>
                        )}
                        {u.phone && (
                          <p className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" /><span dir="ltr">{u.phone}</span></p>
                        )}
                        {!u.email && !u.phone && <p className="text-slate-400">—</p>}
                      </div>

                      <div className="hidden flex-wrap gap-1.5 lg:flex">
                        {bu.canManageBrokerUsers && (
                          <span className="rounded-full bg-sky-500/12 px-2.5 py-0.5 text-[11px] font-bold text-sky-600">{m.permManageEmployees}</span>
                        )}
                        {bu.canViewCommissions && (
                          <span className="rounded-full bg-violet-500/12 px-2.5 py-0.5 text-[11px] font-bold text-violet-600">{m.permViewCommissions}</span>
                        )}
                        {!bu.canManageBrokerUsers && !bu.canViewCommissions && <span className="text-[12px] text-slate-400">—</span>}
                      </div>

                      <div className="hidden lg:block">
                        <BrokerUserStatusBadge status={bu.status} locale={locale} />
                      </div>

                      <div className="hidden text-[12px] lg:block">
                        <p className="text-[11px] text-slate-500">{m.colLastLogin}</p>
                        <p className="font-semibold tabular-nums text-slate-800">{formatDate(u.lastLoginAt, locale) ?? '—'}</p>
                      </div>

                      <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-hairline px-3.5 text-[12.5px] font-bold text-slate-600 transition-colors group-open/row:border-[#C9A24E]/60 group-open/row:text-slate-900">
                        <Pencil className="h-3.5 w-3.5 group-open/row:hidden" />
                        <X className="hidden h-3.5 w-3.5 group-open/row:block" />
                        <span className="group-open/row:hidden">{m.editToggleOpen}</span>
                        <span className="hidden group-open/row:inline">{m.editToggleClose}</span>
                      </span>
                    </summary>

                    <div className="border-t border-hairline bg-surface-muted/20 px-6 py-6">
                      <form action={updateUser.bind(null, bu.id)} autoComplete="off" className="flex flex-col gap-5">
                        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                          <FormField label={m.fieldFullName}>
                            <Input id={`fullName-${bu.id}`} name="fullName" defaultValue={u.fullName} autoComplete="off" />
                          </FormField>
                          <FormField label={m.fieldJob}>
                            <Input id={`jobTitle-${bu.id}`} name="jobTitle" defaultValue={bu.jobTitle ?? ''} autoComplete="off" />
                          </FormField>
                          <FormField label={m.fieldEmail}>
                            <Input id={`email-${bu.id}`} name="email" type="email" dir="ltr" defaultValue={u.email ?? ''} autoComplete="off" leftAddon={<Mail />} />
                          </FormField>
                          <FormField label={m.fieldPhone}>
                            <Input id={`phone-${bu.id}`} name="phone" dir="ltr" defaultValue={u.phone ?? ''} autoComplete="off" leftAddon={<Phone />} />
                          </FormField>
                        </div>
                        <div>
                          <p className="mb-3 text-[12.5px] font-semibold text-slate-700">{m.permissionsLabel}</p>
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <Switch
                              name="canManageBrokerUsers"
                              label={m.permManageEmployeesLabel}
                              desc={en ? 'Can add and edit colleagues in the portal' : 'يضيف ويعدّل زملاءه من بوابة الوسيط'}
                              defaultChecked={bu.canManageBrokerUsers}
                            />
                            <Switch
                              name="canViewCommissions"
                              label={m.permViewCommissionsLabel}
                              desc={en ? 'Sees the company’s commissions and payouts' : 'يرى عمولات الشركة ومدفوعاتها'}
                              defaultChecked={bu.canViewCommissions}
                            />
                          </div>
                        </div>
                        <div className="flex justify-end border-t border-hairline pt-5">
                          <Button type="submit" variant="primary" size="md">{m.btnSaveChanges}</Button>
                        </div>
                      </form>
                      {/* Status actions: their own forms, outside the edit form (forms cannot nest). */}
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                            {!bu.isPrimaryContact && bu.status !== 'REMOVED' && (
                              <form action={makePrimary.bind(null, bu.id)}>
                                <button type="submit" className={`${PILL} border-[#C9A24E]/50 text-[#9A7A2E] hover:bg-[#D8B66A]/10 dark:text-[#D8B66A]`}>
                                  <Star className="me-1.5 h-3.5 w-3.5" />{m.btnSetPrimary}
                                </button>
                              </form>
                            )}
                            {bu.status !== 'ACTIVE' && bu.status !== 'REMOVED' && (
                              <form action={changeStatus.bind(null, bu.id, 'ACTIVE')}>
                                <button type="submit" className={`${PILL} border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10`}>{m.btnActivate}</button>
                              </form>
                            )}
                            {bu.status === 'ACTIVE' && (
                              <form action={changeStatus.bind(null, bu.id, 'SUSPENDED')}>
                                <button type="submit" className={`${PILL} border-amber-500/40 text-amber-600 hover:bg-amber-500/10`}>{m.btnSuspend}</button>
                              </form>
                            )}
                            {bu.status !== 'REMOVED' && (
                              <ConfirmingForm action={changeStatus.bind(null, bu.id, 'REMOVED')} confirmMessage={m.removeConfirm(bu.user.fullName)}>
                                <button type="submit" className={`${PILL} border-danger-500/40 text-danger-600 hover:bg-danger-500/10`}>
                                  <Trash2 className="me-1.5 h-3.5 w-3.5" />{m.btnRemove}
                                </button>
                              </ConfirmingForm>
                            )}
                      </div>
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
