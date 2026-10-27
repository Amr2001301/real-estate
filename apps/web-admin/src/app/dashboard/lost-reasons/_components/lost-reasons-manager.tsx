'use client';

import { useState, useTransition } from 'react';
import { ArrowDown, ArrowUp, Pencil, Plus } from 'lucide-react';
import type { LostReason } from '@/lib/types';
import type { Locale } from '@/lib/locale';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { createLostReasonAction, updateLostReasonAction } from '@/app/dashboard/leads/actions';
import { lostT } from '@/components/crm/lost-messages';

const nameOf = (r: LostReason) => (typeof r.name === 'string' ? { ar: r.name, en: r.name } : { ar: r.name.ar ?? '', en: r.name.en ?? '' });

/** The admin's list of lost reasons: add, rename, reorder, switch off. */
export function LostReasonsManager({ locale, reasons }: { locale: Locale; reasons: LostReason[] }) {
  const m = lostT(locale).manage;
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [ar, setAr] = useState('');
  const [en, setEn] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ error?: string }>, after?: () => void) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (res.error) return setError(`${m.error}: ${res.error}`);
      after?.();
    });
  const openEdit = (r: LostReason | null) => {
    setError(null);
    setEditing(r ? r.id : 'new');
    setAr(r ? nameOf(r).ar : '');
    setEn(r ? nameOf(r).en : '');
  };
  const save = () =>
    run(
      () => (editing === 'new' ? createLostReasonAction(ar, en) : updateLostReasonAction(editing!, { ar, en })),
      () => setEditing(null),
    );
  // Reorder by swapping the two neighbours' positions (1-based, kept dense).
  const swap = (i: number, j: number) =>
    run(async () => {
      const a = reasons[i]!;
      const b = reasons[j]!;
      const ra = await updateLostReasonAction(a.id, { sortOrder: j + 1 });
      if (ra.error) return ra;
      return updateLostReasonAction(b.id, { sortOrder: i + 1 });
    });

  const form = (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <label className="text-[12px] font-semibold text-slate-500">
        {m.ar}
        <Input data-testid="reason-ar" value={ar} onChange={(e) => setAr(e.target.value)} className="mt-1" />
      </label>
      <label className="text-[12px] font-semibold text-slate-500">
        {m.en}
        <Input data-testid="reason-en" dir="ltr" value={en} onChange={(e) => setEn(e.target.value)} className="mt-1" />
      </label>
      <div className="flex gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(null)}>{m.cancel}</Button>
        <Button type="button" variant="primary" size="sm" data-testid="reason-save" disabled={pending || !ar.trim() || !en.trim()} onClick={save}>
          {m.save}
        </Button>
      </div>
    </div>
  );

  return (
    <section data-testid="lost-reasons-manager" className="rounded-[22px] border border-hairline bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-[18px] font-semibold text-slate-900">{m.title}</h2>
          <p className="mt-1 max-w-2xl text-[13px] text-slate-500">{m.desc}</p>
        </div>
        {editing !== 'new' && (
          <Button type="button" variant="primary" size="sm" data-testid="reason-add" leftIcon={<Plus className="h-4 w-4" />} onClick={() => openEdit(null)}>
            {m.add}
          </Button>
        )}
      </div>

      {error && <p role="alert" className="mt-3 text-[12.5px] font-medium text-danger-600">{error}</p>}
      {editing === 'new' && <div className="mt-4 rounded-2xl bg-surface-muted/50 p-4">{form}</div>}

      <ol className="mt-4 divide-y divide-hairline">
        {reasons.map((r, i) => {
          const n = nameOf(r);
          return (
            <li key={r.id} data-testid="reason-row" className="py-3">
              {editing === r.id ? (
                form
              ) : (
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-muted text-[11.5px] font-bold tabular-nums text-slate-500">
                    {i + 1}
                  </span>
                  <div className={cn('min-w-0 flex-1', !r.active && 'opacity-60')}>
                    <p className="truncate text-[14px] font-semibold text-slate-800">{locale === 'en' ? n.en : n.ar}</p>
                    <p className="truncate text-[12px] text-slate-500" dir={locale === 'en' ? 'rtl' : 'ltr'}>{locale === 'en' ? n.ar : n.en}</p>
                  </div>
                  <span className={cn('text-[12px] font-semibold', r.active ? 'text-emerald-600' : 'text-slate-400')}>
                    {r.active ? m.active : m.inactive}
                  </span>
                  <Switch
                    checked={r.active}
                    aria-label={n.ar}
                    disabled={pending}
                    onCheckedChange={(next) => run(() => updateLostReasonAction(r.id, { active: next }))}
                  />
                  <button type="button" aria-label={m.up} disabled={pending || i === 0} onClick={() => swap(i, i - 1)} className="rounded-lg p-1.5 text-slate-400 hover:bg-surface-muted hover:text-slate-700 disabled:opacity-30">
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button type="button" aria-label={m.down} disabled={pending || i === reasons.length - 1} onClick={() => swap(i, i + 1)} className="rounded-lg p-1.5 text-slate-400 hover:bg-surface-muted hover:text-slate-700 disabled:opacity-30">
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  <button type="button" aria-label={m.edit} onClick={() => openEdit(r)} className="rounded-lg p-1.5 text-slate-400 hover:bg-surface-muted hover:text-brand-700">
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
