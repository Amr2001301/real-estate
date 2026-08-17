'use client';

import { useEffect, useState, useTransition, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowRight, Users, CheckCircle2, XCircle, PauseCircle,
  RotateCcw, AlertTriangle, UserPlus, Building2, Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Field } from '@/components/form/field';
import { formatDate } from '@/lib/format';
import { getClientLocale } from '@/lib/locale-client';
import { saT, type SaStrings } from '@/messages/super-admin';
import { PremiumPageHero, PremiumDetailLayout, PremiumSectionCard, PremiumCommandPanel } from '@/components/premium';

const STATUS_BADGE: Record<string, string> = {
  TRIAL: 'bg-blue-100 text-blue-700', ACTIVE: 'bg-emerald-100 text-emerald-700',
  CANCELLING: 'bg-amber-100 text-amber-700', CANCELLED: 'bg-slate-100 text-slate-500',
  EXPIRED: 'bg-red-100 text-red-700', SUSPENDED: 'bg-red-200 text-red-800',
};

interface CompanyDetail {
  id: string; name: string; slug: string; country: string | null;
  currency: string; timezone: string; isActive: boolean;
  subscriptionPlan: string; subscriptionStatus: string;
  subscriptionStartAt: string | null; subscriptionEndAt: string | null;
  maxUsers: number | null; cancelledAt: string | null; cancelReason: string | null;
  createdAt: string; updatedAt: string;
  _count: { users: number };
  users: Array<{ id: string; fullName: string; email: string | null; role: string; active: boolean; lastLoginAt: string | null; createdAt: string }>;
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
    const data = await fetchCompany(id);
    setCompany(data);
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
      <div className="flex items-center justify-center py-20 text-sm text-slate-400">
        {m.detail.loading}
      </div>
    );
  }

  if (!company) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-red-500">
        {m.detail.notFound}
      </div>
    );
  }

  const isCancellable = ['ACTIVE', 'TRIAL'].includes(company.subscriptionStatus);
  const isActivatable = ['CANCELLED', 'EXPIRED', 'SUSPENDED'].includes(company.subscriptionStatus);

  return (
    <div className="space-y-6">
      <PremiumPageHero
        title={company.name}
        description={`${company.slug} · ${company.id}`}
        breadcrumbs={[
          { label: m.detail.breadcrumbs.platform, href: '/dashboard/super-admin' },
          { label: company.name },
        ]}
        badge={{
          label: m.status[company.subscriptionStatus] ?? company.subscriptionStatus,
          dot: false,
        }}
        actions={
          <span className={`inline-flex px-3 py-1.5 rounded-full text-[12px] font-bold ${STATUS_BADGE[company.subscriptionStatus] ?? 'bg-slate-100 text-slate-600'}`}>
            {m.plan[company.subscriptionPlan] ?? company.subscriptionPlan}
          </span>
        }
      />

      {actionError && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-red-100 bg-red-50/40 px-5 py-3.5 text-sm text-red-700">
          <XCircle className="h-4 w-4 shrink-0" />
          {actionError}
        </div>
      )}

      {company.subscriptionStatus === 'CANCELLING' && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-amber-100 bg-amber-50 px-5 py-3.5 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {m.detail.cancellingBanner(company.subscriptionEndAt ? formatDate(company.subscriptionEndAt) : '—')}
        </div>
      )}

      <PremiumDetailLayout
        main={<>


          <PremiumSectionCard
            title={m.detail.detailsTitle}
            icon={<Building2 />}
            trailing={
              <Button variant="ghost" size="sm" onClick={() => setEditMode(!editMode)}>
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
              <dl className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
                {[
                  [m.detail.fields.name,     company.name],
                  [m.detail.fields.country,  company.country ?? '—'],
                  [m.detail.fields.currency, company.currency],
                  [m.detail.fields.timezone, company.timezone],
                  [m.detail.fields.plan,     m.detail.planOptions[company.subscriptionPlan] ?? company.subscriptionPlan],
                  [m.detail.fields.startAt,  company.subscriptionStartAt ? formatDate(company.subscriptionStartAt) : '—'],
                  [m.detail.fields.endAt,    company.subscriptionEndAt ? formatDate(company.subscriptionEndAt) : '—'],
                  [m.detail.fields.maxUsers, company.maxUsers?.toString() ?? m.detail.unlimitedUsers],
                  [m.detail.fields.usersCount, `${company._count.users}${company.maxUsers ? ` / ${company.maxUsers}` : ''}`],
                  [m.detail.fields.createdAt, formatDate(company.createdAt)],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-slate-400 text-[11px] font-semibold uppercase tracking-wide mb-1">{k}</dt>
                    <dd className="text-slate-900 font-semibold">{v}</dd>
                  </div>
                ))}
                {company.cancelReason && (
                  <div className="col-span-2">
                    <dt className="text-slate-400 text-[11px] font-semibold uppercase tracking-wide mb-1">{m.detail.fields.cancelReason}</dt>
                    <dd className="text-slate-700">{company.cancelReason}</dd>
                  </div>
                )}
              </dl>
            )}
          </PremiumSectionCard>

          <PremiumSectionCard
            title={`${m.detail.usersTitle} (${company._count.users})`}
            icon={<Users />}
            trailing={
              <Button variant="outline" size="sm" onClick={() => setShowAddAdmin(true)}>
                <UserPlus className="h-3.5 w-3.5 me-1" />
                {m.detail.newAdminBtn}
              </Button>
            }
            padded={false}
          >
            {showAddAdmin && (
              <div className="p-5 border-b border-hairline">
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
              <table className="w-full text-sm">
                <thead className="text-right text-xs text-slate-400 border-b border-hairline bg-canvas/40">
                  <tr>
                    <th className="px-5 py-3 font-semibold">{m.detail.userCols.name}</th>
                    <th className="px-4 py-3 font-semibold">{m.detail.userCols.role}</th>
                    <th className="px-4 py-3 font-semibold">{m.detail.userCols.lastLogin}</th>
                    <th className="px-4 py-3 font-semibold">{m.detail.userCols.status}</th>
                  </tr>
                </thead>
                <tbody>
                  {company.users.map((u) => (
                    <tr key={u.id} className="border-b border-hairline hover:bg-canvas/40 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-900">{u.fullName}</p>
                        <p className="text-[11px] text-slate-400">{u.email}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-[13px]">{u.role}</td>
                      <td className="px-4 py-3 text-slate-500 text-[12px]">
                        {u.lastLoginAt ? formatDate(u.lastLoginAt) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${u.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          {u.active ? m.detail.userActive : m.detail.userInactive}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {company.users.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-5 py-8 text-center text-slate-400 text-sm">
                        {m.detail.noUsers}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </PremiumSectionCard>
        </>}
        side={<>
          <PremiumCommandPanel title={m.detail.actionsTitle} icon={<Settings />}>
            <div className="p-4 space-y-2">
              {isActivatable && (
                <Button variant="primary" size="sm" className="w-full" loading={pending}
                  onClick={() => startTransition(async () => { if (await callAction('activate')) await reload(); })}>
                  <CheckCircle2 className="h-4 w-4 me-1.5" />
                  {m.detail.actions.activate}
                </Button>
              )}
              {isCancellable && !showCancelForm && (
                <Button variant="outline" size="sm" className="w-full"
                  onClick={() => setShowCancelForm(true)}>
                  <XCircle className="h-4 w-4 me-1.5" />
                  {m.detail.actions.cancelSub}
                </Button>
              )}
              {isCancellable && !showCancelForm && (
                <Button variant="outline" size="sm" className="w-full text-red-600 border-red-200 hover:bg-red-50" loading={pending}
                  onClick={() => startTransition(async () => { if (await callAction('suspend')) await reload(); })}>
                  <PauseCircle className="h-4 w-4 me-1.5" />
                  {m.detail.actions.suspend}
                </Button>
              )}
              {company.subscriptionStatus === 'SUSPENDED' && (
                <Button variant="ghost" size="sm" className="w-full" loading={pending}
                  onClick={() => startTransition(async () => { if (await callAction('activate')) await reload(); })}>
                  <RotateCcw className="h-4 w-4 me-1.5" />
                  {m.detail.actions.unsuspend}
                </Button>
              )}
              <div className="pt-1">
                <Link href="/dashboard/super-admin/companies" className="flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] text-slate-500 hover:bg-canvas/50 transition-colors">
                  <ArrowRight className="h-4 w-4" />
                  {m.detail.breadcrumbs.platform}
                </Link>
              </div>
            </div>
          </PremiumCommandPanel>

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
        </>}
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
      <div className="flex justify-end gap-2 pt-2">
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
          <label className="flex items-start gap-2.5 text-sm cursor-pointer text-red-700">
            <input type="radio" className="mt-0.5" checked={immediate} onChange={() => setImmediate(true)} />
            <span>{m.immediate}</span>
          </label>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{m.reasonLabel}</label>
          <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
            placeholder={m.reasonPlaceholder} />
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>{cancelLabel}</Button>
          <Button variant="primary" size="sm" loading={pending}
            className="bg-red-600 hover:bg-red-700 focus:ring-red-500"
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
      <p className="text-[13px] font-bold text-slate-700">{m.title}</p>
      <div className="grid grid-cols-2 gap-3">
        <Input name="fullName" required placeholder={m.fullName} />
        <Input name="email" type="email" required placeholder="admin@company.com" dir="ltr" />
      </div>
      <Input name="password" type="password" required placeholder={m.password} dir="ltr" />
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>{cancelLabel}</Button>
        <Button type="submit" variant="primary" size="sm" loading={pending}>{m.addBtn}</Button>
      </div>
    </form>
  );
}
