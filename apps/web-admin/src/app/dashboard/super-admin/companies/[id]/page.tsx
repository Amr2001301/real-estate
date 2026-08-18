'use client';

import { useEffect, useState, useTransition, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Users, CheckCircle2, XCircle, PauseCircle,
  RotateCcw, AlertTriangle, UserPlus, Building2, Settings, Globe,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Field } from '@/components/form/field';
import { formatDate } from '@/lib/format';
import { getClientLocale } from '@/lib/locale-client';
import { saT, type SaStrings } from '@/messages/super-admin';
import { CompanyPricingPanel } from './_pricing-panel';
import {
  PremiumPageHero,
  PremiumDetailLayout,
  PremiumSectionCard,
  PremiumCommandPanel,
} from '@/components/premium';

const STATUS_CLS: Record<string, string> = {
  TRIAL:      'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  ACTIVE:     'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  CANCELLING: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  CANCELLED:  'bg-slate-100 text-slate-500 ring-1 ring-slate-200',
  EXPIRED:    'bg-red-50 text-red-700 ring-1 ring-red-200',
  SUSPENDED:  'bg-red-100 text-red-800 ring-1 ring-red-300',
};

const CMD_LINK = 'group flex items-center gap-3 px-5 py-3.5 text-sm text-slate-700 hover:bg-canvas/40 transition-colors duration-150';
const CMD_ICON = 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 [&_svg]:h-[15px] [&_svg]:w-[15px]';

interface CompanyDetail {
  id: string; name: string; slug: string; country: string | null;
  currency: string; timezone: string; isActive: boolean;
  subscriptionPlan: string; subscriptionStatus: string;
  subscriptionStartAt: string | null; subscriptionEndAt: string | null;
  maxUsers: number | null; cancelledAt: string | null; cancelReason: string | null;
  createdAt: string; updatedAt: string;
  _count: { users: number };
  users: Array<{
    id: string; fullName: string; email: string | null;
    role: string; active: boolean; lastLoginAt: string | null; createdAt: string;
  }>;
}

async function fetchCompany(id: string): Promise<CompanyDetail | null> {
  const res = await fetch(`/api-proxy/super-admin/companies/${id}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return res.json() as Promise<CompanyDetail>;
}

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const locale = getClientLocale();
  const m = useMemo(() => saT(locale), [locale]);

  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [editMode, setEditMode] = useState(false);

  async function reload() {
    setLoading(true);
    setCompany(await fetchCompany(id));
    setLoading(false);
  }

  useEffect(() => { void reload(); }, [id]);

  async function callAction(path: string, body?: object) {
    setActionError(null);
    const res = await fetch(`/api-proxy/super-admin/companies/${id}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const d = (await res.json()) as { message?: string };
      setActionError(d.message ?? m.detail.error);
      return false;
    }
    return true;
  }

  async function patchCompany(body: object) {
    setActionError(null);
    const res = await fetch(`/api-proxy/super-admin/companies/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const d = (await res.json()) as { message?: string };
      setActionError(d.message ?? m.detail.error);
      return false;
    }
    return true;
  }

  if (loading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="h-40 rounded-[20px] bg-slate-100" />
        <div className="grid xl:grid-cols-3 gap-5">
          <div className="xl:col-span-2 h-64 rounded-[20px] bg-slate-100" />
          <div className="h-40 rounded-[20px] bg-slate-100" />
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="rounded-2xl border border-danger-100 bg-danger-50 px-5 py-4 text-sm text-danger-700">
        {m.detail.notFound}
      </div>
    );
  }

  const isCancellable = ['ACTIVE', 'TRIAL'].includes(company.subscriptionStatus);
  const isActivatable = ['CANCELLED', 'EXPIRED', 'SUSPENDED'].includes(company.subscriptionStatus);
  const statusCls = STATUS_CLS[company.subscriptionStatus] ?? 'bg-slate-100 text-slate-600';

  return (
    <div className="space-y-5">
      <PremiumPageHero
        title={company.name}
        description={`${company.slug} · ${company.id.slice(0, 8).toUpperCase()}`}
        breadcrumbs={[
          { label: m.detail.breadcrumbs.platform, href: '/dashboard/super-admin' },
          { label: m.companies.title, href: '/dashboard/super-admin/companies' },
          { label: company.name },
        ]}
        meta={
          <>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusCls}`}>
              {m.status[company.subscriptionStatus] ?? company.subscriptionStatus}
            </span>
            <span className="inline-flex items-center rounded-full bg-brand-50 text-brand-700 ring-1 ring-brand-200 px-2.5 py-0.5 text-[11px] font-semibold">
              {m.plan[company.subscriptionPlan] ?? company.subscriptionPlan}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-500 px-2.5 py-0.5 text-[11px] font-semibold">
              <Users className="h-3 w-3" />
              {company._count.users}{company.maxUsers ? ` / ${company.maxUsers}` : ''}
            </span>
          </>
        }
      />

      {actionError && (
        <div className="flex items-center gap-2.5 rounded-xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          <XCircle className="h-4 w-4 shrink-0" />
          {actionError}
        </div>
      )}

      {company.subscriptionStatus === 'CANCELLING' && (
        <div className="flex items-center gap-2.5 rounded-xl border border-warning-100 bg-warning-50 px-4 py-3 text-sm text-warning-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {m.detail.cancellingBanner(company.subscriptionEndAt ? formatDate(company.subscriptionEndAt) : '—')}
        </div>
      )}

      <PremiumDetailLayout
        main={
          <div className="space-y-5">
            {/* Company details */}
            <PremiumSectionCard
              title={m.detail.detailsTitle}
              icon={<Building2 />}
              trailing={
                <Button variant="outline" size="sm" onClick={() => setEditMode(!editMode)}>
                  {editMode ? m.detail.cancelBtn : m.detail.editBtn}
                </Button>
              }
            >
              {editMode ? (
                <EditForm
                  company={company}
                  m={m.detail}
                  onSave={async (data) => {
                    startTransition(async () => {
                      if (await patchCompany(data)) { setEditMode(false); await reload(); }
                    });
                  }}
                  pending={pending}
                />
              ) : (
                <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                  <Field label={m.detail.fields.name}>
                    <span className="text-[14px] font-bold text-slate-900">{company.name}</span>
                  </Field>
                  <Field label={m.detail.fields.plan}>
                    <span className="text-[14px] font-bold text-slate-900">
                      {m.detail.planOptions[company.subscriptionPlan] ?? company.subscriptionPlan}
                    </span>
                  </Field>
                  <Field label={m.detail.fields.country}>
                    <span className="text-[13px] text-slate-700">{company.country ?? '—'}</span>
                  </Field>
                  <Field label={m.detail.fields.currency}>
                    <span className="text-[13px] font-mono text-slate-700">{company.currency}</span>
                  </Field>
                  <Field label={m.detail.fields.timezone}>
                    <span className="text-[13px] font-mono text-slate-700 flex items-center gap-1.5">
                      <Globe className="h-3.5 w-3.5 text-slate-400" />
                      {company.timezone}
                    </span>
                  </Field>
                  <Field label={m.detail.fields.maxUsers}>
                    <span className="text-[13px] text-slate-700">
                      {company.maxUsers?.toString() ?? m.detail.unlimitedUsers}
                    </span>
                  </Field>
                  <Field label={m.detail.fields.startAt}>
                    <span className="text-[13px] tabular-nums text-slate-700">
                      {company.subscriptionStartAt ? formatDate(company.subscriptionStartAt) : '—'}
                    </span>
                  </Field>
                  <Field label={m.detail.fields.endAt}>
                    <span className="text-[13px] tabular-nums text-slate-700">
                      {company.subscriptionEndAt ? formatDate(company.subscriptionEndAt) : '—'}
                    </span>
                  </Field>
                  <Field label={m.detail.fields.usersCount}>
                    <span className="text-[13px] tabular-nums text-slate-700">
                      {company._count.users}
                      {company.maxUsers ? ` / ${company.maxUsers}` : ''}
                    </span>
                  </Field>
                  <Field label={m.detail.fields.createdAt}>
                    <span className="text-[13px] tabular-nums text-slate-700">{formatDate(company.createdAt)}</span>
                  </Field>
                  {company.cancelReason && (
                    <div className="col-span-2">
                      <Field label={m.detail.fields.cancelReason}>
                        <span className="text-[13px] text-slate-700">{company.cancelReason}</span>
                      </Field>
                    </div>
                  )}
                </div>
              )}
            </PremiumSectionCard>

            {/* Users */}
            <PremiumSectionCard
              title={`${m.detail.usersTitle} (${company._count.users})`}
              icon={<Users />}
              trailing={
                !showAddAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<UserPlus className="h-3.5 w-3.5" />}
                    onClick={() => setShowAddAdmin(true)}
                  >
                    {m.detail.newAdminBtn}
                  </Button>
                )
              }
              padded={false}
            >
              {showAddAdmin && (
                <div className="px-5 pt-5 pb-4 border-b border-hairline bg-canvas/40">
                  <AddAdminForm
                    m={m.detail.addAdminForm}
                    cancelLabel={m.detail.cancelBtn}
                    onSubmit={async (data) => {
                      startTransition(async () => {
                        if (await callAction('admin', data)) { setShowAddAdmin(false); await reload(); }
                      });
                    }}
                    onCancel={() => setShowAddAdmin(false)}
                    pending={pending}
                  />
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[500px]">
                  <thead className="bg-canvas/50 border-b border-hairline">
                    <tr>
                      <th className="px-5 py-3 text-start text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400">{m.detail.userCols.name}</th>
                      <th className="px-4 py-3 text-start text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400">{m.detail.userCols.role}</th>
                      <th className="px-4 py-3 text-start text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400">{m.detail.userCols.lastLogin}</th>
                      <th className="px-4 py-3 text-start text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400">{m.detail.userCols.status}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {company.users.map((u) => (
                      <tr key={u.id} className="hover:bg-canvas/40 transition-colors duration-100">
                        <td className="px-5 py-3">
                          <p className="font-semibold text-slate-900">{u.fullName}</p>
                          <p className="text-[11px] text-slate-400 font-mono">{u.email}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex rounded-full bg-slate-100 text-slate-600 px-2 py-0.5 text-[11px] font-semibold">
                            {u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[12px] text-slate-500 tabular-nums">
                          {u.lastLoginAt ? formatDate(u.lastLoginAt) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${u.active ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-slate-100 text-slate-500'}`}>
                            {u.active ? m.detail.userActive : m.detail.userInactive}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {company.users.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-5 py-10 text-center text-slate-400 text-sm">
                          {m.detail.noUsers}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </PremiumSectionCard>

            {/* Company-specific pricing */}
            <CompanyPricingPanel companyId={company.id} />
          </div>
        }
        side={
          <div className="space-y-4">
            <PremiumCommandPanel title={m.detail.actionsTitle} icon={<Settings />}>
              {/* Subscription actions */}
              {isActivatable && (
                <button
                  disabled={pending}
                  onClick={() => startTransition(async () => { if (await callAction('activate')) await reload(); })}
                  className="group flex w-full items-center gap-3 px-5 py-3.5 text-sm text-slate-700 hover:bg-emerald-50 transition-colors duration-150 disabled:opacity-50"
                >
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 [&_svg]:h-[15px] [&_svg]:w-[15px]">
                    <CheckCircle2 />
                  </span>
                  <div className="text-start">
                    <p className="font-semibold text-slate-900 text-[13px]">{m.detail.actions.activate}</p>
                  </div>
                </button>
              )}
              {company.subscriptionStatus === 'SUSPENDED' && (
                <button
                  disabled={pending}
                  onClick={() => startTransition(async () => { if (await callAction('activate')) await reload(); })}
                  className="group flex w-full items-center gap-3 px-5 py-3.5 text-sm hover:bg-emerald-50 transition-colors duration-150 disabled:opacity-50"
                >
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 [&_svg]:h-[15px] [&_svg]:w-[15px]">
                    <RotateCcw />
                  </span>
                  <div className="text-start">
                    <p className="font-semibold text-slate-900 text-[13px]">{m.detail.actions.unsuspend}</p>
                  </div>
                </button>
              )}
              {isCancellable && !showCancelForm && (
                <button
                  onClick={() => setShowCancelForm(true)}
                  className="group flex w-full items-center gap-3 px-5 py-3.5 text-sm hover:bg-amber-50 transition-colors duration-150"
                >
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 [&_svg]:h-[15px] [&_svg]:w-[15px]">
                    <XCircle />
                  </span>
                  <div className="text-start">
                    <p className="font-semibold text-slate-900 text-[13px]">{m.detail.actions.cancelSub}</p>
                  </div>
                </button>
              )}
              {isCancellable && !showCancelForm && (
                <button
                  disabled={pending}
                  onClick={() => startTransition(async () => { if (await callAction('suspend')) await reload(); })}
                  className="group flex w-full items-center gap-3 px-5 py-3.5 text-sm hover:bg-red-50 transition-colors duration-150 disabled:opacity-50"
                >
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600 [&_svg]:h-[15px] [&_svg]:w-[15px]">
                    <PauseCircle />
                  </span>
                  <div className="text-start">
                    <p className="font-semibold text-red-700 text-[13px]">{m.detail.actions.suspend}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{m.detail.actions.cancelSub}</p>
                  </div>
                </button>
              )}

              {/* Divider */}
              <div className="border-t border-hairline" />

              {/* Nav links */}
              <Link href="/dashboard/super-admin/companies" className={CMD_LINK}>
                <span className={CMD_ICON}><ArrowLeft /></span>
                {m.companies.title}
              </Link>
              <Link href="/dashboard/super-admin" className={CMD_LINK}>
                <span className={CMD_ICON}><Building2 /></span>
                {m.detail.breadcrumbs.platform}
              </Link>
            </PremiumCommandPanel>

            {/* Cancel form */}
            {showCancelForm && (
              <CancelForm
                m={m.detail.cancelForm}
                cancelLabel={m.detail.cancelBtn}
                onSubmit={async (data) => {
                  startTransition(async () => {
                    if (await callAction('cancel', data)) { setShowCancelForm(false); await reload(); }
                  });
                }}
                onClose={() => setShowCancelForm(false)}
                pending={pending}
                subscriptionEndAt={company.subscriptionEndAt}
              />
            )}
          </div>
        }
      />
    </div>
  );
}

function EditForm({ company, m, onSave, pending }: {
  company: CompanyDetail;
  m: SaStrings['detail'];
  onSave: (data: object) => void;
  pending: boolean;
}) {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    onSave({
      name: fd.get('name'),
      country: fd.get('country'),
      currency: fd.get('currency'),
      timezone: fd.get('timezone'),
      subscriptionPlan: fd.get('subscriptionPlan'),
      subscriptionStartAt: fd.get('subscriptionStartAt') || null,
      subscriptionEndAt: fd.get('subscriptionEndAt') || null,
      maxUsers: fd.get('maxUsers') ? Number(fd.get('maxUsers')) : null,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label={m.fields.name} name="name" required>
          <Input name="name" defaultValue={company.name} required />
        </Field>
        <Field label={m.fields.country} name="country">
          <Input name="country" defaultValue={company.country ?? ''} dir="ltr" />
        </Field>
        <Field label={m.fields.currency} name="currency">
          <Input name="currency" defaultValue={company.currency} dir="ltr" />
        </Field>
        <Field label={m.fields.timezone} name="timezone">
          <Input name="timezone" defaultValue={company.timezone} dir="ltr" />
        </Field>
        <Field label={m.fields.plan} name="subscriptionPlan">
          <Select name="subscriptionPlan" defaultValue={company.subscriptionPlan}>
            {Object.entries(m.planOptions).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
        </Field>
        <Field label={m.fields.maxUsers} name="maxUsers">
          <Input name="maxUsers" type="number" defaultValue={company.maxUsers ?? ''} dir="ltr" />
        </Field>
        <Field label={m.fields.startAt} name="subscriptionStartAt">
          <Input name="subscriptionStartAt" type="date" dir="ltr"
            defaultValue={company.subscriptionStartAt ? company.subscriptionStartAt.slice(0, 10) : ''} />
        </Field>
        <Field label={m.fields.endAt} name="subscriptionEndAt">
          <Input name="subscriptionEndAt" type="date" dir="ltr"
            defaultValue={company.subscriptionEndAt ? company.subscriptionEndAt.slice(0, 10) : ''} />
        </Field>
      </div>
      <div className="flex justify-end gap-2 pt-2 border-t border-hairline">
        <Button type="submit" variant="primary" size="sm" loading={pending}>{m.saveBtn}</Button>
      </div>
    </form>
  );
}

function CancelForm({ m, cancelLabel, onSubmit, onClose, pending, subscriptionEndAt }: {
  m: SaStrings['detail']['cancelForm'];
  cancelLabel: string;
  onSubmit: (data: { immediate: boolean; reason?: string }) => void;
  onClose: () => void;
  pending: boolean;
  subscriptionEndAt: string | null;
}) {
  const [immediate, setImmediate] = useState(false);
  const [reason, setReason] = useState('');

  return (
    <PremiumSectionCard title={m.title} tone="danger">
      <div className="space-y-4">
        <div className="space-y-2.5">
          <label className="flex items-start gap-2.5 text-sm cursor-pointer">
            <input type="radio" className="mt-0.5" checked={!immediate} onChange={() => setImmediate(false)} />
            <span>{m.endOfPeriodFn(subscriptionEndAt ? formatDate(subscriptionEndAt) : '—')}</span>
          </label>
          <label className="flex items-start gap-2.5 text-sm cursor-pointer text-danger-700">
            <input type="radio" className="mt-0.5" checked={immediate} onChange={() => setImmediate(true)} />
            <span>{m.immediate}</span>
          </label>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-[0.06em] mb-1.5">{m.reasonLabel}</label>
          <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-xl border border-hairline bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600/15 resize-none"
            placeholder={m.reasonPlaceholder} />
        </div>
        <div className="flex gap-2 justify-end pt-1">
          <Button variant="ghost" size="sm" onClick={onClose}>{cancelLabel}</Button>
          <Button variant="primary" size="sm" loading={pending}
            className="bg-danger-600 hover:bg-danger-700 focus:ring-danger-500"
            onClick={() => onSubmit({ immediate, reason: reason || undefined })}>
            {m.confirm}
          </Button>
        </div>
      </div>
    </PremiumSectionCard>
  );
}

function AddAdminForm({ m, cancelLabel, onSubmit, onCancel, pending }: {
  m: SaStrings['detail']['addAdminForm'];
  cancelLabel: string;
  onSubmit: (data: { email: string; password: string; fullName: string }) => void;
  onCancel: () => void;
  pending: boolean;
}) {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    onSubmit({
      fullName: fd.get('fullName') as string,
      email: fd.get('email') as string,
      password: fd.get('password') as string,
    });
  }
  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-[12px] font-bold text-slate-700 uppercase tracking-[0.06em]">{m.title}</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label={m.fullName} name="fullName">
          <Input name="fullName" required placeholder={m.fullName} />
        </Field>
        <Field label={m.email} name="adminEmail">
          <Input name="email" type="email" required placeholder="admin@company.com" dir="ltr" />
        </Field>
      </div>
      <Field label={m.password} name="adminPassword">
        <Input name="password" type="password" required placeholder="••••••••" dir="ltr" />
      </Field>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>{cancelLabel}</Button>
        <Button type="submit" variant="primary" size="sm" loading={pending}>{m.addBtn}</Button>
      </div>
    </form>
  );
}
