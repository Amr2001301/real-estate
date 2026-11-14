'use client';

import { useActionState, useState, useTransition } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import type { Locale } from '@/lib/locale';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ErrorLine } from '@/app/dashboard/deals/_components/ui';
import { developersT, PLAN_FREQUENCIES, type Developer } from '@/components/developers/messages';
import {
  createDeveloperAction,
  createPlanAction,
  createProjectAction,
  removePlanAction,
  removeProjectAction,
  setDeveloperActiveAction,
  updateDeveloperAction,
  type DevFormState,
} from '../actions';

const label = 'block text-[12.5px] font-semibold text-slate-600';
const hint = 'mt-1 block text-[11.5px] font-normal text-slate-500';
const box = 'space-y-4 rounded-2xl border border-[#D8B66A]/40 bg-[#D8B66A]/[0.05] p-4';

function Buttons({ onClose, saving, text, closeText, testId }: { onClose: () => void; saving: boolean; text: string; closeText: string; testId?: string }) {
  return (
    <div className="flex justify-end gap-2">
      <Button type="button" variant="ghost" size="sm" onClick={onClose}>{closeText}</Button>
      <Button type="submit" variant="primary" size="sm" disabled={saving} data-testid={testId}>{text}</Button>
    </div>
  );
}

/** The developer's details; a new one or an edit. */
export function DeveloperForm({ locale, developer, onClose }: { locale: Locale; developer?: Developer; onClose: () => void }) {
  const f = developersT(locale).form;
  const [state, action, saving] = useActionState<DevFormState, FormData>(async (prev, fd) => {
    const res = developer ? await updateDeveloperAction(developer.id, prev, fd) : await createDeveloperAction(prev, fd);
    if (res.ok) onClose();
    return res;
  }, {});
  return (
    <form action={action} className={box} data-testid="developer-form">
      <ErrorLine error={state.error} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className={label}>
          {f.name}
          <Input name="name" required minLength={2} maxLength={120} defaultValue={developer?.name} className="mt-1.5" data-testid="developer-name" />
        </label>
        <label className={label}>
          {f.commission}
          <Input name="defaultCommissionPct" type="number" min={0} max={100} step="0.01" dir="ltr" defaultValue={developer?.defaultCommissionPct ? Number(developer.defaultCommissionPct) : ''} className="mt-1.5" />
          <span className={hint}>{f.commissionHint}</span>
        </label>
        <label className={label}>
          {f.contactName}
          <Input name="contactName" maxLength={120} defaultValue={developer?.contactName ?? ''} className="mt-1.5" />
        </label>
        <label className={label}>
          {f.phone}
          <Input name="phone" type="tel" dir="ltr" defaultValue={developer?.phone ?? ''} className="mt-1.5" />
        </label>
        <label className={label}>
          {f.email}
          <Input name="email" type="email" dir="ltr" defaultValue={developer?.email ?? ''} className="mt-1.5" />
        </label>
        <label className={label}>
          {f.website}
          <Input name="website" dir="ltr" defaultValue={developer?.website ?? ''} className="mt-1.5" />
        </label>
        <label className={cn(label, 'sm:col-span-2')}>
          {f.notes}
          <Textarea name="notes" rows={2} maxLength={2000} defaultValue={developer?.notes ?? ''} className="mt-1.5" />
        </label>
      </div>
      <Buttons onClose={onClose} saving={saving} text={f.save} closeText={f.cancel} testId="developer-save" />
    </form>
  );
}

export function AddDeveloperButton({ locale }: { locale: Locale }) {
  const [open, setOpen] = useState(false);
  const f = developersT(locale);
  if (open) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#0A1120]/55 p-4 backdrop-blur-[2px] sm:items-center" role="dialog" aria-modal="true" aria-label={f.form.newTitle}>
        <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[22px] border border-hairline bg-surface p-6 shadow-2xl">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-heading text-[18px] font-bold text-slate-900">{f.form.newTitle}</h2>
            <button type="button" onClick={() => setOpen(false)} className="rounded-full p-1 text-slate-400 hover:bg-slate-500/10" aria-label={f.form.cancel}>
              <X className="h-4 w-4" />
            </button>
          </div>
          <DeveloperForm locale={locale} onClose={() => setOpen(false)} />
        </div>
      </div>
    );
  }
  return (
    <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)} data-testid="developer-add">
      {f.list.add}
    </Button>
  );
}

export function EditDeveloperButton({ locale, developer }: { locale: Locale; developer: Developer }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const f = developersT(locale).form;
  return (
    <div className="space-y-3">
      {open ? (
        <DeveloperForm locale={locale} developer={developer} onClose={() => setOpen(false)} />
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>{f.edit}</Button>
          <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => start(async () => void (await setDeveloperActiveAction(developer.id, !developer.active)))}>
            {developer.active ? f.deactivate : f.activate}
          </Button>
        </div>
      )}
    </div>
  );
}

export function AddProjectForm({ locale, developerId }: { locale: Locale; developerId: string }) {
  const t = developersT(locale);
  const [open, setOpen] = useState(false);
  const [state, action, saving] = useActionState<DevFormState, FormData>(async (prev, fd) => {
    const res = await createProjectAction(developerId, prev, fd);
    if (res.ok) setOpen(false);
    return res;
  }, {});
  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)} data-testid="project-add">
        {t.detail.addProject}
      </Button>
    );
  }
  return (
    <form action={action} className={cn(box, 'w-full')} data-testid="project-form">
      <ErrorLine error={state.error} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className={label}>
          {t.detail.projectName}
          <Input name="name" required minLength={2} maxLength={120} className="mt-1.5" />
        </label>
        <label className={label}>
          {t.detail.city}
          <Input name="city" maxLength={80} className="mt-1.5" />
        </label>
        <label className={label}>
          {t.detail.district}
          <Input name="district" maxLength={80} className="mt-1.5" />
        </label>
        <label className={label}>
          {t.detail.projectCommission}
          <Input name="commissionPct" type="number" min={0} max={100} step="0.01" dir="ltr" className="mt-1.5" />
        </label>
        <label className={label}>
          {t.detail.delivery}
          <Input name="deliveryDate" type="date" className="mt-1.5" />
        </label>
      </div>
      <Buttons onClose={() => setOpen(false)} saving={saving} text={t.form.save} closeText={t.form.cancel} testId="project-save" />
    </form>
  );
}

export function AddPlanForm({ locale, projectId }: { locale: Locale; projectId: string }) {
  const t = developersT(locale);
  const [open, setOpen] = useState(false);
  const [years, setYears] = useState('7');
  const cash = Number(years) === 0;
  const [state, action, saving] = useActionState<DevFormState, FormData>(async (prev, fd) => {
    const res = await createPlanAction(projectId, prev, fd);
    if (res.ok) setOpen(false);
    return res;
  }, {});
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12.5px] font-bold text-brand-700 hover:bg-[#D8B66A]/10" data-testid={`plan-add-${projectId}`}>
        <Plus className="h-3.5 w-3.5" /> {t.detail.addPlan}
      </button>
    );
  }
  return (
    <form action={action} className={cn(box, 'mt-3')} data-testid="plan-form">
      <ErrorLine error={state.error} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <label className={cn(label, 'col-span-2 sm:col-span-1')}>
          {t.detail.planName}
          <Input name="name" required minLength={2} maxLength={80} className="mt-1.5" />
        </label>
        <label className={label}>
          {t.detail.years}
          <Input name="years" type="number" min={0} max={30} step="1" dir="ltr" required value={years} onChange={(e) => setYears(e.target.value)} className="mt-1.5" />
          <span className={hint}>{t.detail.yearsHint}</span>
        </label>
        {cash ? (
          <label className={label}>
            {t.detail.cashDiscount}
            <Input name="cashDiscountPct" type="number" min={0} max={100} step="0.01" dir="ltr" className="mt-1.5" />
          </label>
        ) : (
          <>
            <label className={label}>
              {t.detail.downPayment}
              <Input name="downPaymentPct" type="number" min={0} max={100} step="0.01" dir="ltr" required className="mt-1.5" />
            </label>
            <label className={label}>
              {t.detail.frequency}
              <Select name="frequency" defaultValue="QUARTERLY" className="mt-1.5">
                {PLAN_FREQUENCIES.map((fq) => <option key={fq} value={fq}>{t.frequency[fq]}</option>)}
              </Select>
            </label>
            <label className={label}>
              {t.detail.deliveryPct}
              <Input name="deliveryPct" type="number" min={0} max={100} step="0.01" dir="ltr" className="mt-1.5" />
            </label>
          </>
        )}
      </div>
      <Buttons onClose={() => setOpen(false)} saving={saving} text={t.form.save} closeText={t.form.cancel} testId="plan-save" />
    </form>
  );
}

/** A small "remove" for a project or a plan; a refusal shows next to it. */
export function RemoveButton({ kind, id, label: text }: { kind: 'project' | 'plan'; id: string; label: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        aria-label={text}
        title={text}
        onClick={() =>
          start(async () => {
            const res = kind === 'project' ? await removeProjectAction(id) : await removePlanAction(id);
            setError(res.error);
          })
        }
        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-danger-50 hover:text-danger-700"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
      {error && <span role="alert" className="max-w-[14rem] text-end text-[11.5px] text-danger-700">{error}</span>}
    </span>
  );
}
