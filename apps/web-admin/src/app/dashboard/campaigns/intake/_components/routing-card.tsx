'use client';

import { useState, useTransition } from 'react';
import { Check, Shuffle, Timer } from 'lucide-react';
import type { LeadRoutingSettings } from '@/lib/types';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/cn';
import type { IntakeMessages } from '@/components/campaigns/intake-messages';
import { saveRoutingAction } from '../actions';

const MINUTES = [15, 30, 60, 120, 1440, 0];

/** Round-robin on/off and when the first call is due. */
export function RoutingCard({ initial, canManage, m }: { initial: LeadRoutingSettings; canManage: boolean; m: IntakeMessages['routing'] }) {
  const [s, setS] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const save = (patch: Partial<LeadRoutingSettings>) => {
    const prev = s;
    setS({ ...s, ...patch });
    setSaved(false);
    start(async () => {
      const r = await saveRoutingAction(patch as { autoAssign?: 'ROUND_ROBIN' | 'NONE'; firstCallMinutes?: number });
      if (r.error) {
        setS(prev);
        setError(r.error);
      } else {
        setError(null);
        setSaved(true);
      }
    });
  };

  return (
    <section data-testid="routing-card" className="rounded-[24px] border border-hairline bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-heading text-[18px] font-bold text-slate-900">{m.title}</h2>
        <p className="text-[12px] text-slate-500">
          {saved && !pending ? (
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-600"><Check className="h-3.5 w-3.5" /> {m.saved}</span>
          ) : canManage ? m.desc : m.readonly}
        </p>
      </div>
      {error && <p role="alert" className="mt-2 text-[12.5px] text-danger-600">{error}</p>}

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex items-start gap-4 rounded-2xl bg-surface-muted/50 p-4 ring-1 ring-inset ring-hairline">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#D8B66A]/15 text-brand-700"><Shuffle className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[14px] font-bold text-slate-900">{m.roundRobin}</p>
              <Switch
                checked={s.autoAssign === 'ROUND_ROBIN'}
                disabled={!canManage || pending}
                aria-label={m.roundRobin}
                data-testid="routing-round-robin"
                onCheckedChange={(on) => save({ autoAssign: on ? 'ROUND_ROBIN' : 'NONE' })}
              />
            </div>
            <p className="mt-1 text-[12.5px] leading-relaxed text-slate-500">{m.roundRobinHint}</p>
          </div>
        </div>

        <div className="flex items-start gap-4 rounded-2xl bg-surface-muted/50 p-4 ring-1 ring-inset ring-hairline">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#D8B66A]/15 text-brand-700"><Timer className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-bold text-slate-900">{m.firstCall}</p>
            <p className="mt-1 text-[12.5px] text-slate-500">{m.firstCallHint}</p>
            <div role="radiogroup" className="mt-3 flex flex-wrap gap-1.5">
              {MINUTES.map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={s.firstCallMinutes === n}
                  disabled={!canManage || pending}
                  onClick={() => save({ firstCallMinutes: n })}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors disabled:cursor-default',
                    s.firstCallMinutes === n
                      ? 'border-[#D8B66A] bg-[#D8B66A]/15 text-brand-800'
                      : 'border-hairline bg-surface text-slate-600 enabled:hover:border-[#D8B66A]/50',
                  )}
                >
                  {m.options[n]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
