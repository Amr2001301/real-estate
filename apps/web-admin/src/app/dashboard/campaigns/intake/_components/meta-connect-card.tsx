'use client';

import { useState, useTransition } from 'react';
import { CheckCircle2, Link2, Plug, Trash2 } from 'lucide-react';
import type { CampaignChannel, Translatable } from '@/lib/types';
import type { Locale } from '@/lib/locale';
import { formatDateTime, tx } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import type { IntakeMessages } from '@/components/campaigns/intake-messages';
import { activateMetaPageAction, connectMetaAction, disconnectMetaPageAction, routeMetaPageAction } from '../actions';

/** The Facebook "f" (lucide has no brand marks). */
function Facebook({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.6-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H7.9v3h2.6V21h3z" />
    </svg>
  );
}

export interface MetaConnection {
  id: string;
  pageId: string;
  pageName: string;
  status: 'PENDING' | 'ACTIVE';
  lastLeadAt: string | null;
  leadCount: number;
  campaign: { id: string; name: string } | null;
  project: { id: string; name: Translatable | string } | null;
}
export interface MetaStatus {
  configured: boolean;
  connections: MetaConnection[];
}

/** Links the company's Facebook Page so lead-ad customers arrive without Zapier / Make. */
export function MetaConnectCard({
  locale,
  status,
  campaigns,
  projects,
  result,
  m,
}: {
  locale: Locale;
  status: MetaStatus;
  campaigns: Array<{ id: string; name: string; channel: CampaignChannel }>;
  projects: Array<{ id: string; name: Translatable }>;
  result: string | null;
  m: IntakeMessages['meta'];
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [choice, setChoice] = useState<Record<string, { campaignId: string; projectId: string }>>({});

  const pick = (c: MetaConnection) => choice[c.id] ?? { campaignId: c.campaign?.id ?? '', projectId: typeof c.project?.id === 'string' ? c.project.id : '' };
  const set = (c: MetaConnection, patch: Partial<{ campaignId: string; projectId: string }>) =>
    setChoice((prev) => ({ ...prev, [c.id]: { ...pick(c), ...patch } }));
  const route = (c: MetaConnection) => ({ campaignId: pick(c).campaignId || null, projectId: pick(c).projectId || null });

  const connect = () =>
    start(async () => {
      setError(null);
      const r = await connectMetaAction();
      if (r.ok) window.location.assign(r.url);
      else setError(r.error);
    });
  const run = (fn: () => Promise<{ ok?: boolean; error?: string }>, id: string) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (r.error) setError(r.error);
      else setSaved(id);
    });

  const active = status.connections.filter((c) => c.status === 'ACTIVE');
  const waiting = status.connections.filter((c) => c.status === 'PENDING');

  const selects = (c: MetaConnection) => (
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <label className="block">
        <span className="mb-1 block text-[12px] font-semibold text-slate-500">{m.campaign}</span>
        <Select value={pick(c).campaignId} onChange={(e) => set(c, { campaignId: e.target.value })} inputSize="sm" aria-label={m.campaign}>
          <option value="">{m.none}</option>
          {campaigns.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </Select>
      </label>
      <label className="block">
        <span className="mb-1 block text-[12px] font-semibold text-slate-500">{m.project}</span>
        <Select value={pick(c).projectId} onChange={(e) => set(c, { projectId: e.target.value })} inputSize="sm" aria-label={m.project}>
          <option value="">{m.none}</option>
          {projects.map((x) => <option key={x.id} value={x.id}>{tx(x.name, locale)}</option>)}
        </Select>
      </label>
    </div>
  );

  return (
    <section data-testid="meta-card" className="rounded-[24px] border border-hairline bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#1877F2]/10 text-[#1877F2]"><Facebook className="h-5 w-5" /></span>
          <div>
            <h2 className="font-heading text-[18px] font-bold text-slate-900">{m.title}</h2>
            <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-slate-500">{m.desc}</p>
          </div>
        </div>
        {status.configured && (
          <Button variant="primary" leftIcon={<Plug className="h-4 w-4" />} loading={pending} onClick={connect} data-testid="meta-connect">
            {status.connections.length ? m.addPage : m.connect}
          </Button>
        )}
      </div>

      {!status.configured && (
        <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-[12.5px] text-amber-800 ring-1 ring-inset ring-amber-200">{m.notConfigured}</p>
      )}
      {result && m.result[result] && (
        <p className={`mt-4 rounded-2xl px-4 py-3 text-[12.5px] ring-1 ring-inset ${result === 'connected' ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : 'bg-red-50 text-red-700 ring-red-200'}`}>{m.result[result]}</p>
      )}
      {error && <p className="mt-4 text-[12.5px] font-semibold text-red-600">{error}</p>}
      {status.configured && <p className="mt-3 text-[12px] text-slate-400">{m.hint}</p>}

      {status.configured && status.connections.length === 0 && <p className="mt-5 text-[13px] text-slate-400">{m.empty}</p>}

      {waiting.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-[13px] font-bold text-slate-900">{m.pending}</p>
          <ul className="space-y-3">
            {waiting.map((c) => (
              <li key={c.id} data-testid="meta-pending" className="rounded-2xl border border-hairline bg-surface-soft/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-[14px] font-semibold text-slate-900"><Facebook className="h-4 w-4 text-[#1877F2]" />{c.pageName}</span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="primary" leftIcon={<Link2 className="h-4 w-4" />} loading={pending} onClick={() => run(() => activateMetaPageAction(c.id, route(c)), c.id)}>{m.link}</Button>
                    <Button size="sm" variant="outline" leftIcon={<Trash2 className="h-4 w-4" />} onClick={() => confirm(m.unlinkConfirm) && run(() => disconnectMetaPageAction(c.id), c.id)}>{m.unlink}</Button>
                  </div>
                </div>
                {selects(c)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {active.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-[13px] font-bold text-slate-900">{m.active}</p>
          <ul className="space-y-3">
            {active.map((c) => (
              <li key={c.id} data-testid="meta-active" className="rounded-2xl border border-hairline p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-[14px] font-semibold text-slate-900"><CheckCircle2 className="h-4 w-4 text-emerald-500" />{c.pageName}</span>
                  <span className="text-[12px] text-slate-500">
                    {m.leads.replace('{n}', String(c.leadCount))} · {m.lastLead}: {c.lastLeadAt ? formatDateTime(c.lastLeadAt, locale) : m.never}
                  </span>
                </div>
                {selects(c)}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" loading={pending} onClick={() => run(() => routeMetaPageAction(c.id, route(c)), c.id)}>{m.save}</Button>
                  <Button size="sm" variant="outline" leftIcon={<Trash2 className="h-4 w-4" />} onClick={() => confirm(m.unlinkConfirm) && run(() => disconnectMetaPageAction(c.id), c.id)}>{m.unlink}</Button>
                  {saved === c.id && <span className="text-[12px] font-semibold text-emerald-600">{m.saved}</span>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
