'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Lock, Merge, Phone } from 'lucide-react';
import type { DuplicateGroup } from '@/lib/types';
import type { Locale } from '@/lib/locale';
import { formatDate, tx } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { LeadStageBadge } from '@/components/badges';
import { mergeLeadsAction } from '../../actions';
import { duplicateT } from '@/components/crm/duplicate-messages';

/** One customer's open leads: pick the one to keep, tick the ones to fold in. */
export function DuplicateGroupCard({ group, locale }: { group: DuplicateGroup; locale: Locale }) {
  const m = duplicateT(locale);
  // Keep, by default, a lead that cannot be merged away; else the furthest along, else the oldest.
  const rank = { NEW: 0, INTERESTED: 1, VISIT: 2, NEGOTIATION: 3, WON: 4, LOST: -1 } as const;
  const initial =
    group.leads.find((l) => !l.mergeable) ??
    [...group.leads].sort((a, b) => rank[b.stage] - rank[a.stage] || a.createdAt.localeCompare(b.createdAt))[0]!;
  const [keep, setKeep] = useState(initial.id);
  const [chosen, setChosen] = useState<string[]>(group.leads.filter((l) => l.id !== initial.id && l.mergeable).map((l) => l.id));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toMerge = chosen.filter((id) => id !== keep);

  const pickKeep = (id: string) => {
    setKeep(id);
    setChosen(group.leads.filter((l) => l.id !== id && l.mergeable).map((l) => l.id));
  };
  const toggle = (id: string) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  const merge = () => {
    if (!window.confirm(m.confirm)) return;
    setError(null);
    start(async () => {
      const res = await mergeLeadsAction(keep, toMerge);
      if (res.error) setError(`${m.error}: ${res.error}`);
    });
  };

  return (
    <section data-testid="duplicate-group" className="overflow-hidden rounded-[22px] border border-hairline bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-4">
        <div className="min-w-0">
          <h2 className="truncate font-heading text-[18px] font-bold text-slate-900">{group.client.fullName}</h2>
          <p className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-slate-500">
            {group.client.phone && (
              <>
                <Phone className="h-3.5 w-3.5" /> <span dir="ltr">{group.client.phone}</span> ·
              </>
            )}
            {m.leadsOf(group.leads.length)}
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          leftIcon={<Merge className="h-4 w-4" />}
          disabled={pending || toMerge.length === 0}
          onClick={merge}
          data-testid="duplicate-merge"
        >
          {pending ? m.merging : m.mergeBtn(toMerge.length)}
        </Button>
      </header>
      {error && <p role="alert" className="bg-danger-500/10 px-5 py-2.5 text-[12.5px] text-danger-600">{error}</p>}
      <ul className="divide-y divide-hairline">
        {group.leads.map((l) => {
          const isKeep = l.id === keep;
          const broker = l.broker?.commercialName || l.broker?.companyName || l.broker?.code;
          return (
            <li key={l.id} data-testid="duplicate-lead" className={cn('flex flex-wrap items-center gap-4 px-5 py-3.5', isKeep && 'bg-[#D8B66A]/[0.07]')}>
              <label className="inline-flex cursor-pointer items-center gap-2 text-[12.5px] font-semibold text-slate-700">
                <input type="radio" name={`keep-${group.client.id}`} checked={isKeep} onChange={() => pickKeep(l.id)} className="accent-[#B8873A]" data-testid="duplicate-keep" />
                {m.keep}
              </label>
              <label className={cn('inline-flex items-center gap-2 text-[12.5px] font-semibold', l.mergeable && !isKeep ? 'cursor-pointer text-slate-700' : 'text-slate-300')}>
                <input
                  type="checkbox"
                  disabled={isKeep || !l.mergeable}
                  checked={!isKeep && chosen.includes(l.id)}
                  onChange={() => toggle(l.id)}
                  className="accent-[#B8873A]"
                />
                {m.merge}
              </label>
              <div className="min-w-0 flex-1">
                <Link href={`/dashboard/leads/${l.id}` as never} className="inline-flex items-center gap-2 font-semibold text-slate-900 hover:text-brand-700">
                  <LeadStageBadge stage={l.stage} locale={locale} />
                  <span className="truncate">{l.projectInterest ? tx(l.projectInterest.name, locale) : l.fullName}</span>
                </Link>
                <p className="mt-1 text-[12px] text-slate-500">
                  {m.owner}: {l.assignedSales?.fullName ?? m.unassigned}
                  {l.source && <> · {tx(l.source.name, locale)}</>}
                  {l.campaign && <> · {l.campaign.name}</>}
                  {broker && <> · {broker}</>}
                  {' · '}{m.created} {formatDate(l.createdAt, locale)} · {m.notes(l._count.notes)}
                </p>
              </div>
              {!l.mergeable && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/12 px-2.5 py-1 text-[11.5px] font-semibold text-amber-700">
                  <Lock className="h-3 w-3" /> {m.locked}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
