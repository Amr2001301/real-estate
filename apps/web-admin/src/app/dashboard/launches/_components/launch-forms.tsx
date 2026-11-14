'use client';

import { useActionState, useState, useTransition } from 'react';
import { Plus, X } from 'lucide-react';
import type { Locale } from '@/lib/locale';
import { cn } from '@/lib/cn';
import { formatDate, formatExactCurrency } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { SearchSelect } from '@/components/form/search-select';
import { ErrorLine, Pill, type Tone } from '@/app/dashboard/deals/_components/ui';
import { launchesT, type Eoi, type EoiStatus, type LaunchStatus } from '@/components/launches/messages';
import {
  allocateEoiAction,
  cancelEoiAction,
  createEoiAction,
  createLaunchAction,
  payEoiAction,
  refundEoiAction,
  setLaunchStatusAction,
  type LaunchFormState,
} from '../actions';

const label = 'block text-[12.5px] font-semibold text-slate-600';
const box = 'space-y-4 rounded-2xl border border-[#D8B66A]/40 bg-[#D8B66A]/[0.05] p-4';

export const EOI_TONE: Record<EoiStatus, Tone> = { PENDING_PAYMENT: 'amber', PAID: 'gold', ALLOCATED: 'green', REFUNDED: 'slate', CANCELLED: 'slate' };
export const LAUNCH_TONE: Record<LaunchStatus, Tone> = { UPCOMING: 'gold', OPEN: 'green', CLOSED: 'slate' };

interface ProjectOption {
  id: string;
  name: string;
  developer: { name: string };
}

/** A new launch, in a dialog. */
export function NewLaunchButton({ locale, projects, today }: { locale: Locale; projects: ProjectOption[]; today: string }) {
  const t = launchesT(locale);
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [state, action, saving] = useActionState<LaunchFormState, FormData>(createLaunchAction, {});
  return (
    <>
      <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)} data-testid="launch-add">
        {t.list.add}
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#0A1120]/55 p-4 backdrop-blur-[2px] sm:items-center" role="dialog" aria-modal="true" aria-label={t.form.title}>
          <form action={action} className="w-full max-w-xl space-y-4 rounded-[22px] border border-hairline bg-surface p-6 shadow-2xl" data-testid="launch-form">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-[18px] font-bold text-slate-900">{t.form.title}</h2>
              <button type="button" onClick={() => setOpen(false)} className="rounded-full p-1 text-slate-400 hover:bg-slate-500/10" aria-label={t.form.cancel}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <ErrorLine error={state.error} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className={cn(label, 'sm:col-span-2')}>
                {t.form.name}
                <Input name="name" required minLength={2} maxLength={120} className="mt-1.5" />
              </label>
              {projects.length > 0 && (
                <label className={cn(label, 'sm:col-span-2')}>
                  {t.form.project}
                  <Select name="developerProjectId" value={projectId} onChange={(e) => setProjectId(e.target.value)} className="mt-1.5">
                    <option value="">{t.form.noProject}</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.developer.name} — {p.name}</option>
                    ))}
                  </Select>
                </label>
              )}
              {!projectId && (
                <label className={cn(label, 'sm:col-span-2')}>
                  {t.form.developer}
                  <Input name="developerName" required minLength={2} maxLength={120} className="mt-1.5" />
                </label>
              )}
              <label className={label}>
                {t.form.date}
                <Input name="launchDate" type="date" required min={today} className="mt-1.5" />
              </label>
              <label className={label}>
                {t.form.amount}
                <Input name="eoiAmount" type="number" required min={0} step="1000" dir="ltr" className="mt-1.5" />
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>{t.form.cancel}</Button>
              <Button type="submit" variant="primary" size="sm" disabled={saving} data-testid="launch-save">{t.form.save}</Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

export function LaunchStatusSwitch({ id, status, locale }: { id: string; status: LaunchStatus; locale: Locale }) {
  const t = launchesT(locale).detail;
  const [pending, start] = useTransition();
  const next: LaunchStatus[] = status === 'UPCOMING' ? ['OPEN', 'CLOSED'] : status === 'OPEN' ? ['CLOSED'] : ['OPEN'];
  return (
    <span className="inline-flex gap-2">
      {next.map((s) => (
        <Button key={s} type="button" variant={s === 'CLOSED' ? 'outline' : 'primary'} size="md" disabled={pending} onClick={() => start(async () => void (await setLaunchStatusAction(id, s)))} data-testid={`launch-${s}`}>
          {t.setStatus[s]}
        </Button>
      ))}
    </span>
  );
}

interface LeadOption {
  id: string;
  fullName: string;
  phone: string;
}

export function NewEoiForm({ locale, launchId }: { locale: Locale; launchId: string }) {
  const t = launchesT(locale).detail;
  const [open, setOpen] = useState(false);
  const [lead, setLead] = useState<LeadOption | null>(null);
  const [state, action, saving] = useActionState<LaunchFormState, FormData>(async (prev, fd) => {
    const res = await createEoiAction(launchId, prev, fd);
    if (res.ok) {
      setOpen(false);
      setLead(null);
    }
    return res;
  }, {});
  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)} data-testid="eoi-add">
        {t.addEoi}
      </Button>
    );
  }
  return (
    <form action={action} className={cn(box, 'w-full')} data-testid="eoi-form">
      <ErrorLine error={state.error} />
      <div className={label}>
        {t.lead}
        <div className="mt-1.5">
          <SearchSelect<LeadOption>
            name="leadId"
            endpoint="/api-proxy/leads"
            toOption={(l) => ({ id: l.id, label: `${l.fullName} — ${l.phone}`, raw: l })}
            onChange={setLead}
            placeholder={t.leadPlaceholder}
            locale={locale}
          />
        </div>
      </div>
      {!lead && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <p className="text-[12px] font-semibold text-slate-400 sm:col-span-2">{t.orWalkIn}</p>
          <label className={label}>
            {t.customerName}
            <Input name="customerName" required minLength={2} className="mt-1.5" />
          </label>
          <label className={label}>
            {t.customerPhone}
            <Input name="customerPhone" type="tel" dir="ltr" required className="mt-1.5" />
          </label>
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className={cn(label, 'sm:col-span-2')}>
          {t.preference}
          <Input name="preference" maxLength={300} placeholder={t.preferencePlaceholder} className="mt-1.5" />
        </label>
        <label className={label}>
          {t.budget}
          <Input name="budget" type="number" min={0} step="1000" dir="ltr" className="mt-1.5" />
        </label>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>{t.cancel}</Button>
        <Button type="submit" variant="primary" size="sm" disabled={saving} data-testid="eoi-save">{t.save}</Button>
      </div>
    </form>
  );
}

/** One EOI: the customer, their place, what they want; the runner's actions. */
export function EoiRow({ eoi, locale, currency, canRun, canCancel }: { eoi: Eoi; locale: Locale; currency: string; canRun: boolean; canCancel: boolean }) {
  const t = launchesT(locale);
  const [mode, setMode] = useState<null | 'pay' | 'allocate'>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const done = (res: LaunchFormState) => {
    if (res.ok) setMode(null);
    return res;
  };
  const [payState, payAction, paying] = useActionState<LaunchFormState, FormData>(async (p, fd) => done(await payEoiAction(eoi.id, p, fd)), {});
  const [allocState, allocAction, allocating] = useActionState<LaunchFormState, FormData>(async (p, fd) => done(await allocateEoiAction(eoi.id, p, fd)), {});
  const run = (fn: () => Promise<LaunchFormState>) => start(async () => setError((await fn()).error));

  return (
    <li className="py-3 first:pt-0 last:pb-0" data-testid={`eoi-${eoi.id}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className={cn('num inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-heading text-[15px] font-bold', eoi.queue ? 'bg-[#0E1626] text-[#E6C77E]' : 'border border-dashed border-slate-300 text-slate-400')}>
            {eoi.queue ? t.detail.place(eoi.queue) : '—'}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-bold text-slate-900">{eoi.customerName}</p>
            <p className="truncate text-[12px] text-slate-500">
              <span className="num" dir="ltr">{eoi.customerPhone}</span>
              {eoi.preference ? ` · ${eoi.preference}` : ''}
              {eoi.agent ? ` · ${eoi.agent.fullName}` : ''}
            </p>
            {eoi.allocation && <p className="mt-0.5 text-[12.5px] font-bold text-success-700">{eoi.allocation}</p>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-end">
            <Pill tone={EOI_TONE[eoi.status]}>{t.eoiStatus[eoi.status]}</Pill>
            {eoi.paidAt && <span className="num mt-0.5 block text-[11.5px] text-slate-500">{t.detail.paidOn(formatDate(eoi.paidAt, locale))}</span>}
          </span>
          <span className="num text-[13px] font-bold text-slate-900">{formatExactCurrency(eoi.amount, currency, locale)}</span>
          {canRun && eoi.status === 'PENDING_PAYMENT' && mode === null && (
            <Button type="button" variant="primary" size="sm" onClick={() => setMode('pay')} data-testid="eoi-pay">{t.detail.pay}</Button>
          )}
          {canRun && eoi.status === 'PAID' && mode === null && (
            <>
              <Button type="button" variant="primary" size="sm" onClick={() => setMode('allocate')} data-testid="eoi-allocate">{t.detail.allocate}</Button>
              <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => run(() => refundEoiAction(eoi.id))}>{t.detail.refund}</Button>
            </>
          )}
          {canCancel && eoi.status === 'PENDING_PAYMENT' && mode === null && (
            <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => run(() => cancelEoiAction(eoi.id))}>{t.detail.cancelEoi}</Button>
          )}
        </div>
      </div>
      <ErrorLine error={error} />
      {mode === 'pay' && (
        <form action={payAction} className={cn(box, 'mt-3')}>
          <ErrorLine error={payState.error} />
          <label className={label}>
            {t.detail.paymentRef}
            <Input name="paymentRef" maxLength={120} className="mt-1.5" />
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setMode(null)}>{t.detail.cancel}</Button>
            <Button type="submit" variant="primary" size="sm" disabled={paying} data-testid="eoi-pay-save">{t.detail.confirm}</Button>
          </div>
        </form>
      )}
      {mode === 'allocate' && (
        <form action={allocAction} className={cn(box, 'mt-3')}>
          <ErrorLine error={allocState.error} />
          <label className={label}>
            {t.detail.allocation}
            <Input name="allocation" required minLength={2} maxLength={300} placeholder={t.detail.allocationPlaceholder} className="mt-1.5" />
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setMode(null)}>{t.detail.cancel}</Button>
            <Button type="submit" variant="primary" size="sm" disabled={allocating} data-testid="eoi-allocate-save">{t.detail.confirm}</Button>
          </div>
        </form>
      )}
    </li>
  );
}
