'use client';

import { useState, useTransition } from 'react';
import { Check, CircleAlert, Copy, ExternalLink, Globe, Loader2, RefreshCw, Star } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { DomainMessages } from './messages';

export interface DomainView {
  id: string;
  hostname: string;
  type: 'PLATFORM_SUBDOMAIN' | 'CUSTOM';
  isPrimary: boolean;
  verifiedAt: string | null;
  hostingStatus: 'PENDING' | 'READY' | 'ERROR' | null;
  hostingError: string | null;
  hostingCheckedAt: string | null;
  dns: Array<{ type: string; name: string; value: string; purpose: 'routing' | 'ownership' | 'hosting' }>;
}

export type DomainActionResult = { ok: true; verified?: boolean } | { ok: false; error: string };

/** What the platform owner can do with a domain; without them the card only shows it. */
export interface DomainActions {
  verify: (id: string) => Promise<DomainActionResult>;
  primary: (id: string) => Promise<DomainActionResult>;
  remove: (id: string) => Promise<DomainActionResult>;
}

/** Second-level suffixes a domain sits under (acme.com.eg is the domain itself). */
const MULTI_PART = /\.(com|net|org|edu|gov|sci|co)\.[a-z]{2}$/;

/** The zone at the provider: acme.com for acme.com, www.acme.com or shop.acme.com. */
function zoneOf(hostname: string): string {
  const labels = hostname.split('.');
  const keep = MULTI_PART.test(hostname) ? 3 : 2;
  return labels.slice(-keep).join('.');
}

/** A record's name as DNS panels ask for it: @ for the domain itself, else the part before it. */
export function hostLabel(name: string, hostname: string): string {
  const zone = zoneOf(hostname);
  if (name === zone) return '@';
  return name.endsWith(`.${zone}`) ? name.slice(0, -(zone.length + 1)) : name;
}

export type DomainState = 'live' | 'waiting' | 'error';

export function domainState(d: DomainView): DomainState {
  if (d.hostingStatus === 'ERROR') return 'error';
  // A hosting status means the hosting is automated; none, it is set up by hand.
  const hostingReady = d.hostingStatus === null || d.hostingStatus === 'READY';
  return d.verifiedAt && hostingReady ? 'live' : 'waiting';
}

function CopyButton({ value, m, label }: { value: string; m: DomainMessages; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      title={copied ? m.records.copied : (label ?? m.records.copy)}
      aria-label={copied ? m.records.copied : (label ?? m.records.copy)}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg text-slate-500 transition-colors hover:text-brand-700',
        label ? 'h-8 border border-hairline bg-surface px-3 text-[12px] font-semibold hover:border-brand-400/50' : 'h-7 w-7 hover:bg-brand-50',
      )}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-success-600" /> : <Copy className="h-3.5 w-3.5" />}
      {label && (copied ? m.records.copied : label)}
    </button>
  );
}

/** One value to type at the provider: a label, the value on one line, a copy button. */
function RecordField({ label, value, m, wide }: { label: string; value: string; m: DomainMessages; wide?: boolean }) {
  return (
    <div className={cn('min-w-0', wide && 'sm:col-span-2')}>
      <p className="mb-1 text-[11px] font-semibold text-slate-500">{label}</p>
      <div className="flex items-center gap-1 rounded-xl border border-hairline bg-surface ps-3 pe-1">
        <span dir="ltr" title={value} className="min-w-0 flex-1 truncate py-2 text-start font-mono text-[12.5px] text-slate-800">
          {value}
        </span>
        <CopyButton value={value} m={m} />
      </div>
    </div>
  );
}

const STATE_STYLE: Record<DomainState, string> = {
  live: 'bg-success-50 text-success-700 ring-success-100',
  waiting: 'bg-warning-50 text-warning-700 ring-warning-100',
  error: 'bg-danger-50 text-danger-700 ring-danger-100',
};

export function DomainCard({
  d,
  m,
  locale,
  actions,
}: {
  d: DomainView;
  m: DomainMessages;
  locale: 'ar' | 'en';
  actions?: DomainActions;
}) {
  const [pending, start] = useTransition();
  const [note, setNote] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const state = domainState(d);
  const owned = !!d.verifiedAt;

  const act = (fn: () => Promise<DomainActionResult>, verify = false) =>
    start(async () => {
      setNote(null);
      const r = await fn();
      if (!r.ok) setNote({ tone: 'bad', text: r.error });
      else if (verify) setNote(r.verified ? { tone: 'ok', text: m.actions.done } : { tone: 'bad', text: m.actions.notYet });
    });

  const steps = [
    { label: m.progress.added, done: true },
    { label: m.progress.records, done: owned },
    { label: m.progress.live, done: state === 'live' },
  ];
  const checkedAt = d.hostingCheckedAt
    ? new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'ar-EG-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' }).format(
        new Date(d.hostingCheckedAt),
      )
    : null;

  return (
    <article
      data-testid="domain-card"
      className={cn(
        'overflow-hidden rounded-[20px] border bg-surface',
        d.isPrimary ? 'border-brand-400/50 shadow-[0_18px_40px_-30px_rgb(176_138_58/0.6)]' : 'border-hairline',
      )}
    >
      {/* ── Domain and its state ── */}
      <header className="flex flex-wrap items-center gap-4 px-5 py-4 sm:px-6">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-navy-band text-[#D8B66A]">
          <Globe className="h-5 w-5 stroke-[1.6]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`https://${d.hostname}`}
              target="_blank"
              rel="noreferrer"
              dir="ltr"
              className="group inline-flex min-w-0 items-center gap-1.5 text-[17px] font-bold text-slate-900 hover:text-brand-700"
            >
              <span className="truncate">{d.hostname}</span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-400 group-hover:text-brand-700" />
            </a>
            {d.isPrimary && (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700">
                <Star className="h-3 w-3" /> {m.primary}
              </span>
            )}
          </div>
          <p className="mt-1 text-[12.5px] text-slate-500">{(actions ? m.stateHint : m.company.stateHint)[state]}</p>
        </div>
        <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold ring-1 ring-inset', STATE_STYLE[state])}>
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              state === 'live' ? 'bg-success-600' : state === 'error' ? 'bg-danger-600' : 'animate-pulse bg-warning-600',
            )}
          />
          {m.state[state]}
        </span>
      </header>

      {/* ── Progress ── */}
      {state !== 'live' && (
        <ol className="flex items-center gap-2 border-t border-hairline px-5 py-3.5 sm:px-6">
          {steps.map((s, i) => (
            <li key={s.label} className={cn('flex items-center gap-2', i < steps.length - 1 && 'flex-1')}>
              <span
                className={cn(
                  'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                  s.done ? 'bg-success-600 text-white' : 'border border-hairline bg-surface text-slate-400',
                )}
              >
                {s.done ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span className={cn('whitespace-nowrap text-[12px] font-semibold', s.done ? 'text-slate-800' : 'text-slate-400')}>
                {s.label}
              </span>
              {i < steps.length - 1 && <span className={cn('h-px flex-1', s.done ? 'bg-success-600/40' : 'bg-hairline')} />}
            </li>
          ))}
        </ol>
      )}

      {d.hostingStatus === 'ERROR' && d.hostingError && (
        <p className="mx-5 mb-3 flex items-start gap-2 rounded-xl bg-danger-50 px-4 py-2.5 text-[12.5px] text-danger-700 sm:mx-6">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span dir="ltr">{d.hostingError}</span>
        </p>
      )}

      {/* ── What to add at the provider, until it is live — for the platform owner ── */}
      {actions && state !== 'live' && d.dns.length > 0 && (
        <div className="border-t border-hairline bg-canvas/50 px-5 py-5 sm:px-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-[13.5px] font-bold text-slate-900">{m.records.title}</h4>
              <p className="mt-0.5 text-[12px] text-slate-500">{m.records.hint}</p>
            </div>
            <CopyButton
              m={m}
              label={m.records.copyAll}
              value={d.dns.map((r) => `${r.type}\t${hostLabel(r.name, d.hostname)}\t${r.value}`).join('\n')}
            />
          </div>
          <ol className="space-y-3">
            {d.dns.map((r, i) => (
              <li key={`${r.type}-${r.name}`} data-testid="dns-record" className="rounded-2xl border border-hairline bg-surface p-4">
                <p className="mb-3 flex items-center gap-2 text-[12.5px] font-semibold text-slate-700">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-navy-band text-[10.5px] font-bold text-[#F4ECD8]">
                    {i + 1}
                  </span>
                  {m.records.purpose[r.purpose]}
                </p>
                <div className="grid gap-3 sm:grid-cols-[88px_minmax(0,1.2fr)_minmax(0,1.8fr)]">
                  <div>
                    <p className="mb-1 text-[11px] font-semibold text-slate-500">{m.records.type}</p>
                    <span className="inline-flex h-[38px] items-center rounded-xl bg-navy-band px-3 font-mono text-[12.5px] font-bold text-[#F4ECD8]">
                      {r.type}
                    </span>
                  </div>
                  <RecordField label={m.records.name} value={hostLabel(r.name, d.hostname)} m={m} />
                  <RecordField label={m.records.value} value={r.value} m={m} />
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {note && (
        <p
          role="status"
          className={cn(
            'mx-5 mt-3 rounded-xl px-4 py-2.5 text-[12.5px] sm:mx-6',
            note.tone === 'ok' ? 'bg-success-50 text-success-700' : 'bg-warning-50 text-warning-700',
          )}
        >
          {note.text}
        </p>
      )}

      {/* ── Actions ── */}
      {actions && (
        <footer className="flex flex-wrap items-center gap-3 px-5 py-4 sm:px-6">
          {state !== 'live' && (
            <button
              type="button"
              disabled={pending}
              data-testid="domain-verify"
              onClick={() => act(() => actions.verify(d.id), true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-navy-band px-4 text-[12.5px] font-semibold text-[#F4ECD8] disabled:opacity-50"
            >
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {m.actions.verify}
            </button>
          )}
          {!d.isPrimary && owned && (
            <button
              type="button"
              disabled={pending}
              onClick={() => act(() => actions.primary(d.id))}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-brand-400/50 px-4 text-[12.5px] font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-50"
            >
              <Star className="h-3.5 w-3.5" />
              {m.actions.primary}
            </button>
          )}
          {checkedAt && state !== 'live' && (
            <span className="text-[11.5px] text-slate-400">
              {m.lastCheck}: {checkedAt}
            </span>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (window.confirm(m.actions.confirmDelete)) act(() => actions.remove(d.id));
            }}
            className="ms-auto text-[12.5px] font-semibold text-slate-400 underline-offset-4 hover:text-danger-600 hover:underline disabled:opacity-50"
          >
            {m.actions.delete}
          </button>
        </footer>
      )}
    </article>
  );
}

/** The platform address (slug.platform): always there, so one quiet line, not a card. */
export function PlatformAddressLine({ d, m }: { d: DomainView; m: DomainMessages }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-slate-500">
      <Globe className="h-3.5 w-3.5 text-slate-400" aria-hidden />
      <span className="font-semibold text-slate-600">{m.platformAddress}:</span>
      <a href={`https://${d.hostname}`} target="_blank" rel="noreferrer" dir="ltr" className="font-mono text-slate-700 hover:text-brand-700">
        {d.hostname}
      </a>
      {d.isPrimary && (
        <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700">
          <Star className="h-3 w-3" /> {m.primary}
        </span>
      )}
      <span className="text-slate-400">— {m.platformHint}</span>
    </p>
  );
}
