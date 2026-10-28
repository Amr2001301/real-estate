'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { CalendarClock } from 'lucide-react';
import type { LeadCallResult, LeadFollowUpType, LeadNoteKind } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import { logActivityAction } from '@/app/dashboard/leads/actions';
import type { FollowUpMessages } from './follow-up-messages';
import { KIND_ICON } from './follow-up-icons';

const KINDS: LeadNoteKind[] = ['CALL', 'WHATSAPP', 'MEETING', 'FOLLOW_UP', 'NOTE'];
const RESULTS: LeadCallResult[] = ['ANSWERED', 'NO_ANSWER', 'BUSY', 'UNREACHABLE', 'WRONG_NUMBER'];
const NEXT_TYPES: LeadFollowUpType[] = ['CALL', 'WHATSAPP', 'MEETING', 'FOLLOW_UP'];
type When = 'keep' | 'none' | 'tomorrow' | 'in3' | 'week' | 'pick';

/** yyyy-mm-dd of the viewer's local day, `days` from today. */
function dayFromToday(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const chip = (on: boolean) =>
  cn(
    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
    on
      ? 'border-brand-500 bg-brand-500/12 text-brand-700'
      : 'border-hairline bg-surface text-slate-600 hover:border-brand-500/40 hover:text-slate-800',
  );

export function ActivityComposer({
  leadId,
  m,
  hasNextAction,
  closed,
  logKind,
}: {
  leadId: string;
  m: FollowUpMessages;
  /** The lead already has a follow-up set: "keep" is offered and chosen by default. */
  hasNextAction: boolean;
  /** Won or lost: nothing left to follow up. */
  closed: boolean;
  /** Arrived from a call / WhatsApp button: that kind, and a prompt to log it. */
  logKind?: 'CALL' | 'WHATSAPP';
}) {
  const [kind, setKind] = useState<LeadNoteKind>(logKind ?? 'CALL');
  const [prompted, setPrompted] = useState(!!logKind);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (logKind) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [logKind]);
  const [result, setResult] = useState<LeadCallResult | null>(null);
  const [body, setBody] = useState('');
  const [when, setWhen] = useState<When>(closed ? 'none' : hasNextAction ? 'keep' : 'tomorrow');
  const [date, setDate] = useState(dayFromToday(1));
  const [time, setTime] = useState('11:00');
  const [nextType, setNextType] = useState<LeadFollowUpType>('CALL');
  const [nextNote, setNextNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const options: When[] = [...(hasNextAction ? (['keep'] as const) : []), 'tomorrow', 'in3', 'week', 'pick', 'none'];
  const scheduling = when !== 'keep' && when !== 'none';
  const dayFor = (w: When) => (w === 'tomorrow' ? dayFromToday(1) : w === 'in3' ? dayFromToday(3) : w === 'week' ? dayFromToday(7) : date);

  const submit = () => {
    setError(null);
    setSaved(false);
    let nextActionAt: string | null | undefined;
    if (when === 'none') nextActionAt = hasNextAction ? null : undefined;
    else if (scheduling) {
      const at = new Date(`${dayFor(when)}T${time || '11:00'}`);
      if (Number.isNaN(at.getTime()) || at.getTime() < Date.now()) return setError(m.composer.pastDate);
      nextActionAt = at.toISOString();
    }
    start(async () => {
      const res = await logActivityAction(leadId, {
        body,
        kind,
        callResult: kind === 'CALL' ? result : null,
        nextActionAt,
        nextActionType: nextType,
        nextActionNote: nextNote,
      });
      if (res.error) return setError(res.error === 'empty' ? m.composer.bodyPlaceholder[kind] : `${m.composer.error}: ${res.error}`);
      setBody('');
      setResult(null);
      setNextNote('');
      setWhen(closed ? 'none' : scheduling || when === 'keep' ? 'keep' : 'tomorrow');
      setSaved(true);
      setPrompted(false);
    });
  };

  return (
    <div ref={ref} data-testid="activity-composer" className="space-y-4">
      {prompted && logKind && (
        <p data-testid="activity-prompt" className="rounded-xl bg-[#D8B66A]/12 px-3.5 py-2.5 text-[12.5px] font-semibold text-brand-800">
          {m.composer.prompt[logKind]}
        </p>
      )}
      <div>
        <p className="mb-2 text-[12.5px] font-semibold text-slate-500">{m.composer.whatHappened}</p>
        <div role="radiogroup" className="flex flex-wrap gap-2">
          {KINDS.map((k) => {
            const Icon = KIND_ICON[k];
            return (
              <button key={k} type="button" role="radio" aria-checked={kind === k} data-testid={`kind-${k}`} onClick={() => setKind(k)} className={chip(kind === k)}>
                <Icon className="h-3.5 w-3.5" /> {m.kind[k]}
              </button>
            );
          })}
        </div>
      </div>

      {kind === 'CALL' && (
        <div>
          <p className="mb-2 text-[12.5px] font-semibold text-slate-500">{m.composer.callResult}</p>
          <div role="radiogroup" className="flex flex-wrap gap-2">
            {RESULTS.map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={result === r}
                data-testid={`result-${r}`}
                onClick={() => setResult(result === r ? null : r)}
                className={chip(result === r)}
              >
                {m.callResult[r]}
              </button>
            ))}
          </div>
        </div>
      )}

      <Textarea
        data-testid="activity-body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder={m.composer.bodyPlaceholder[kind]}
        aria-label={m.composer.body}
        className="text-[13px]"
      />

      {!closed && (
        <div className="rounded-2xl border border-hairline bg-surface-muted/40 p-4">
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-800">
            <CalendarClock className="h-4 w-4 text-brand-600" /> {m.composer.next}
          </p>
          <p className="mt-0.5 text-[12px] text-slate-500">{m.composer.nextHint}</p>
          <div role="radiogroup" className="mt-3 flex flex-wrap gap-2">
            {options.map((w) => (
              <button key={w} type="button" role="radio" aria-checked={when === w} data-testid={`when-${w}`} onClick={() => setWhen(w)} className={chip(when === w)}>
                {m.composer[w]}
              </button>
            ))}
          </div>
          {scheduling && (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[auto_auto_1fr]">
              {when === 'pick' && (
                <label className="text-[12px] font-semibold text-slate-500">
                  {m.composer.date}
                  <Input data-testid="next-date" type="date" value={date} min={dayFromToday(0)} onChange={(e) => setDate(e.target.value)} className="mt-1" />
                </label>
              )}
              <label className="text-[12px] font-semibold text-slate-500">
                {m.composer.time}
                <Input data-testid="next-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className="mt-1" />
              </label>
              <div className="text-[12px] font-semibold text-slate-500">
                {m.composer.nextType}
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {NEXT_TYPES.map((t) => (
                    <button key={t} type="button" aria-pressed={nextType === t} onClick={() => setNextType(t)} className={chip(nextType === t)}>
                      {m.nextType[t]}
                    </button>
                  ))}
                </div>
              </div>
              <label className="text-[12px] font-semibold text-slate-500 sm:col-span-3">
                {m.composer.nextNote}
                <Input data-testid="next-note" value={nextNote} onChange={(e) => setNextNote(e.target.value)} placeholder={m.composer.nextNotePlaceholder} className="mt-1" />
              </label>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-3">
        {error && <p role="alert" className="me-auto text-[12.5px] font-medium text-danger-600">{error}</p>}
        {saved && !error && <p role="status" className="me-auto text-[12.5px] font-medium text-emerald-600">{m.composer.saved}</p>}
        <Button type="button" data-testid="activity-save" variant="primary" size="sm" disabled={pending || !body.trim()} onClick={submit}>
          {pending ? m.composer.saving : m.composer.save}
        </Button>
      </div>
    </div>
  );
}
