'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, CircleAlert, Copy, Globe, Loader2, ShieldCheck, Star } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { DomainsMessages } from '../messages';
import { deleteDomainAction, setPrimaryDomainAction, verifyDomainAction } from '../actions';

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

function Pill({ tone, children }: { tone: 'ok' | 'wait' | 'bad' | 'muted' | 'gold'; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-semibold ring-1 ring-inset',
        tone === 'ok' && 'bg-success-50 text-success-700 ring-success-100',
        tone === 'wait' && 'bg-warning-50 text-warning-700 ring-warning-100',
        tone === 'bad' && 'bg-danger-50 text-danger-700 ring-danger-100',
        tone === 'muted' && 'bg-surface-muted text-slate-600 ring-hairline',
        tone === 'gold' && 'bg-brand-50 text-brand-700 ring-brand-400/30',
      )}
    >
      {children}
    </span>
  );
}

function CopyValue({ value, m }: { value: string; m: DomainsMessages }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      title={copied ? m.records.copied : m.records.copy}
      aria-label={copied ? m.records.copied : m.records.copy}
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-hairline text-slate-500 transition-colors hover:border-brand-400/50 hover:text-brand-700"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-success-600" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

export function DomainCard({ d, m, locale }: { d: DomainView; m: DomainsMessages; locale: 'ar' | 'en' }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const custom = d.type === 'CUSTOM';
  // A hosting status means the hosting is automated; none, it is added by hand.
  const hostingAutomated = d.hostingStatus !== null;
  const live = !!d.verifiedAt && (!hostingAutomated || d.hostingStatus === 'READY');

  const act = (fn: () => Promise<{ ok: boolean; error?: string; verified?: boolean }>, verify = false) =>
    start(async () => {
      setNote(null);
      const r = await fn();
      if (!r.ok) setNote({ tone: 'bad', text: r.error ?? '' });
      else if (verify) setNote(r.verified ? { tone: 'ok', text: m.actions.done } : { tone: 'bad', text: m.actions.notYet });
      router.refresh();
    });

  return (
    <article
      data-testid="domain-card"
      className={cn(
        'overflow-hidden rounded-[22px] border bg-surface shadow-[0_18px_40px_-28px_rgb(20_26_38/0.35)]',
        d.isPrimary ? 'border-[#C9A24E]/50' : 'border-hairline',
      )}
    >
      <header className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#C9A24E]/50 text-[#B08A3A]">
            <Globe className="h-[18px] w-[18px] stroke-[1.6]" />
          </span>
          <div className="min-w-0">
            <a
              href={`https://${d.hostname}`}
              target="_blank"
              rel="noreferrer"
              dir="ltr"
              className="block truncate font-mono text-[16px] font-semibold text-slate-900 hover:text-brand-700"
            >
              {d.hostname}
            </a>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Pill tone="muted">{m.type[d.type]}</Pill>
              {d.isPrimary && (
                <Pill tone="gold">
                  <Star className="h-3 w-3" /> {m.primary}
                </Pill>
              )}
              {custom && (
                <Pill tone={d.verifiedAt ? 'ok' : 'wait'}>
                  <ShieldCheck className="h-3 w-3" /> {d.verifiedAt ? m.ownership.verified : m.ownership.pending}
                </Pill>
              )}
              {custom &&
                (hostingAutomated && d.hostingStatus ? (
                  <Pill tone={d.hostingStatus === 'READY' ? 'ok' : d.hostingStatus === 'ERROR' ? 'bad' : 'wait'}>
                    {m.hosting[d.hostingStatus]}
                  </Pill>
                ) : (
                  !hostingAutomated && <Pill tone="muted">{m.hosting.manual}</Pill>
                ))}
            </div>
          </div>
        </div>

        {custom && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {!live && (
              <button
                type="button"
                disabled={pending}
                data-testid="domain-verify"
                onClick={() => act(() => verifyDomainAction(d.id), true)}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-navy-band px-4 text-[12.5px] font-semibold text-[#F4ECD8] disabled:opacity-50"
              >
                {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {m.actions.verify}
              </button>
            )}
            {!d.isPrimary && d.verifiedAt && (
              <button
                type="button"
                disabled={pending}
                onClick={() => act(() => setPrimaryDomainAction(d.id))}
                className="h-9 rounded-full border border-hairline px-4 text-[12.5px] font-semibold text-slate-700 hover:border-brand-400/50 disabled:opacity-50"
              >
                {m.actions.primary}
              </button>
            )}
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (window.confirm(m.actions.confirmDelete)) act(() => deleteDomainAction(d.id));
              }}
              className="h-9 rounded-full border border-hairline px-4 text-[12.5px] font-semibold text-danger-600 hover:border-danger-500/40 disabled:opacity-50"
            >
              {m.actions.delete}
            </button>
          </div>
        )}
      </header>

      {note && (
        <p className={cn('mx-6 mb-4 rounded-xl px-4 py-2.5 text-[12.5px]', note.tone === 'ok' ? 'bg-success-50 text-success-700' : 'bg-warning-50 text-warning-700')}>
          {note.text}
        </p>
      )}
      {d.hostingStatus === 'ERROR' && d.hostingError && (
        <p className="mx-6 mb-4 flex items-start gap-2 rounded-xl bg-danger-50 px-4 py-2.5 text-[12.5px] text-danger-700">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span dir="ltr">{d.hostingError}</span>
        </p>
      )}

      {/* The records to add, until the domain is live. */}
      {custom && !live && d.dns.length > 0 && (
        <div className="border-t border-hairline bg-surface-muted/30 px-6 py-5">
          <h4 className="text-[13px] font-bold text-slate-800">{m.records.title}</h4>
          <div className="mt-3 overflow-x-auto scrollbar-thin">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-[11px] font-semibold text-slate-500 [&>th]:bg-transparent [&>th]:text-slate-500">
                  <th className="py-2 pe-3 text-start font-semibold">{m.records.type}</th>
                  <th className="px-3 py-2 text-start font-semibold">{m.records.name}</th>
                  <th className="px-3 py-2 text-start font-semibold">{m.records.value}</th>
                  <th className="py-2 ps-3 text-start font-semibold" />
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {d.dns.map((r) => (
                  <tr key={`${r.type}-${r.name}`} data-testid="dns-record">
                    <td className="py-3 pe-3 align-top">
                      <span className="inline-flex rounded-md bg-navy-band px-2 py-0.5 font-mono text-[11px] font-bold text-[#F4ECD8]">{r.type}</span>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <div className="flex items-center gap-2">
                        <span dir="ltr" className="break-all font-mono text-slate-800">{r.name}</span>
                        <CopyValue value={r.name} m={m} />
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <div className="flex items-center gap-2">
                        <span dir="ltr" className="break-all font-mono text-slate-800">{r.value}</span>
                        <CopyValue value={r.value} m={m} />
                      </div>
                    </td>
                    <td className="py-3 ps-3 align-top text-[11.5px] text-slate-500">{m.records.purpose[r.purpose]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {d.hostingCheckedAt && (
            <p className="mt-3 text-[11.5px] text-slate-500">
              {m.lastCheck}:{' '}
              {new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'ar-EG-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(d.hostingCheckedAt))}
            </p>
          )}
        </div>
      )}
    </article>
  );
}
