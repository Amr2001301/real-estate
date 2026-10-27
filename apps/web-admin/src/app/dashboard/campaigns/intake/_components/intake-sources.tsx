'use client';

import { useState, useTransition } from 'react';
import { Check, Copy, KeyRound, Plus, RefreshCw, ShieldCheck, Trash2, Webhook } from 'lucide-react';
import type { CampaignChannel, IntakeKey, Translatable } from '@/lib/types';
import type { Locale } from '@/lib/locale';
import { formatDateTime, tx } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ChannelMark } from '@/components/campaigns/visuals';
import type { IntakeMessages } from '@/components/campaigns/intake-messages';
import { createIntakeKeyAction, deleteIntakeKeyAction, rotateIntakeKeyAction, updateIntakeKeyAction } from '../actions';

function CopyField({ label, value, testId, m }: { label: string; value: string; testId: string; m: IntakeMessages['reveal'] }) {
  const [done, setDone] = useState(false);
  return (
    <div>
      <p className="mb-1.5 text-[12px] font-semibold text-slate-500">{label}</p>
      <div className="flex items-stretch gap-2">
        <code dir="ltr" data-testid={testId} className="min-w-0 flex-1 select-all break-all rounded-xl bg-navy-band px-3.5 py-2.5 font-mono text-[12px] leading-relaxed text-[#E9D9B0]">
          {value}
        </code>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setDone(true);
              setTimeout(() => setDone(false), 1800);
            } catch {
              /* stays selectable */
            }
          }}
          className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 text-[12.5px] font-semibold ring-1 ring-inset', done ? 'bg-emerald-500/12 text-emerald-700 ring-emerald-500/30' : 'bg-surface text-slate-700 ring-hairline hover:ring-[#D8B66A]/60')}
        >
          {done ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {done ? m.copied : m.copy}
        </button>
      </div>
    </div>
  );
}

/** The company's intake sources: one secret key each, shown once when made. */
export function IntakeSources({
  locale,
  keys,
  campaigns,
  projects,
  endpoint,
  canManage,
  m,
}: {
  locale: Locale;
  keys: IntakeKey[];
  campaigns: Array<{ id: string; name: string; channel: CampaignChannel }>;
  projects: Array<{ id: string; name: Translatable }>;
  endpoint: string;
  canManage: boolean;
  m: IntakeMessages;
}) {
  const k = m.keys;
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', campaignId: '', projectId: '' });
  const [revealed, setRevealed] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const act = (fn: () => Promise<{ error?: string; key?: string }>, after?: (r: { key?: string }) => void) =>
    start(async () => {
      const r = await fn();
      if (r.error) return setError(`${k.error}: ${r.error}`);
      setError(null);
      after?.(r);
    });

  return (
    <section data-testid="intake-sources" className="rounded-[24px] border border-hairline bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-[18px] font-bold text-slate-900">{k.title}</h2>
          <p className="mt-1 max-w-2xl text-[12.5px] text-slate-500">{k.desc}</p>
        </div>
        {canManage && (
          <Button type="button" variant="primary" size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)} data-testid="intake-new">
            {k.add}
          </Button>
        )}
      </div>
      {error && <p role="alert" className="mt-3 text-[12.5px] text-danger-600">{error}</p>}

      {keys.length === 0 ? (
        <div className="mt-5 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-hairline px-6 py-10 text-center">
          <Webhook className="h-7 w-7 text-[#D8B66A]" />
          <p className="font-heading text-[15px] font-bold text-slate-800">{k.empty}</p>
          <p className="max-w-md text-[12.5px] text-slate-500">{k.emptyHint}</p>
        </div>
      ) : (
        <ul className="mt-5 grid grid-cols-1 gap-3 xl:grid-cols-2">
          {keys.map((key) => (
            <li key={key.id} data-testid="intake-key" className={cn('rounded-2xl p-4 ring-1 ring-inset ring-hairline transition-opacity', key.active ? 'bg-surface-muted/40' : 'bg-surface-muted/20 opacity-70')}>
              <div className="flex items-start gap-3">
                {key.campaign ? (
                  <ChannelMark channel={key.campaign.channel} size={40} />
                ) : (
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[30%] bg-navy-band text-[#D8B66A]"><KeyRound className="h-5 w-5" /></span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14.5px] font-bold text-slate-900">{key.name}</p>
                  <p className="mt-0.5 truncate text-[12px] text-slate-500">
                    {key.campaign?.name ?? k.none}
                    {key.project && <> · {tx(key.project.name, locale)}</>}
                  </p>
                </div>
                {canManage && (
                  <Switch
                    checked={key.active}
                    disabled={pending}
                    aria-label={key.name}
                    onCheckedChange={(on) => act(() => updateIntakeKeyAction(key.id, { active: on }))}
                  />
                )}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px] text-slate-500">
                <code dir="ltr" className="rounded-md bg-surface px-1.5 py-0.5 font-mono text-slate-600 ring-1 ring-hairline">{key.tokenPrefix}…</code>
                <span><span className="num text-[14px] text-slate-900">{key.useCount}</span> {k.uses}</span>
                <span className="tabular-nums">{k.lastUsed}: {key.lastUsedAt ? formatDateTime(key.lastUsedAt, locale) : k.never}</span>
                <span className={cn('font-semibold', key.active ? 'text-emerald-600' : 'text-slate-400')}>{key.active ? k.active : k.inactive}</span>
                {canManage && (
                  <span className="ms-auto flex items-center gap-1">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => confirm(k.confirmRotate) && act(() => rotateIntakeKeyAction(key.id), (r) => r.key && setRevealed(r.key))}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-semibold text-slate-500 hover:bg-surface hover:text-brand-700"
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> {k.rotate}
                    </button>
                    <button
                      type="button"
                      aria-label={k.remove}
                      disabled={pending}
                      onClick={() => confirm(k.confirmRemove) && act(() => deleteIntakeKeyAction(key.id))}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-danger-500/10 hover:text-danger-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={creating} onClose={() => setCreating(false)} title={k.add} description={m.desc} size="md">
        <div className="space-y-4">
          <label className="block text-[12.5px] font-semibold text-slate-600">
            {k.name}
            <Input data-testid="intake-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={k.namePlaceholder} className="mt-1.5" />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-[12.5px] font-semibold text-slate-600">
              {k.campaign}
              <Select value={form.campaignId} onChange={(e) => setForm({ ...form, campaignId: e.target.value })} className="mt-1.5" data-testid="intake-campaign">
                <option value="">{k.none}</option>
                {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </label>
            <label className="text-[12.5px] font-semibold text-slate-600">
              {k.project}
              <Select value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })} className="mt-1.5">
                <option value="">{k.none}</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{tx(p.name, locale)}</option>)}
              </Select>
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setCreating(false)}>{k.cancel}</Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={pending || !form.name.trim()}
              data-testid="intake-create"
              onClick={() =>
                act(() => createIntakeKeyAction(form), (r) => {
                  setCreating(false);
                  setForm({ name: '', campaignId: '', projectId: '' });
                  if (r.key) setRevealed(r.key);
                })
              }
            >
              {k.create}
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={!!revealed} onClose={() => setRevealed(null)} title={m.reveal.title} size="lg">
        <div data-testid="intake-reveal" className="space-y-4">
          <p className="flex items-start gap-2 rounded-2xl bg-amber-500/10 px-4 py-3 text-[12.5px] text-amber-800">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /> {m.reveal.desc}
          </p>
          <CopyField label={m.reveal.url} value={endpoint} testId="intake-url" m={m.reveal} />
          <CopyField label={m.reveal.key} value={revealed ?? ''} testId="intake-secret" m={m.reveal} />
          <div className="flex justify-end">
            <Button type="button" variant="primary" size="sm" onClick={() => setRevealed(null)}>{m.reveal.done}</Button>
          </div>
        </div>
      </Dialog>
    </section>
  );
}
