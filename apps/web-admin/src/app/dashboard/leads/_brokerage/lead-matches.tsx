import Link from 'next/link';
import { Home, Sparkles } from 'lucide-react';
import { api, safe } from '@/lib/api';
import type { UnitTypeOption } from '@/lib/types';
import type { Locale } from '@/lib/locale';
import { cn } from '@/lib/cn';
import { formatCurrency, tx } from '@/lib/format';
import { KindTag } from '@/components/listings/listing-card';
import { developersT, type LeadRequirement, type ListingMatch, type MatchReason } from '@/components/developers/messages';
import { Panel } from '@/app/dashboard/deals/_components/ui';
import { RequirementCard } from './requirement-form';

export function ScoreBadge({ score }: { score: number }) {
  return (
    <span className={cn('num inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 text-[12.5px] font-bold', score >= 85 ? 'border-[#C79A3B] text-brand-700' : 'border-slate-300 text-slate-500')}>
      {score}%
    </span>
  );
}

export function ReasonChips({ reasons, locale }: { reasons: MatchReason[]; locale: Locale }) {
  const t = developersT(locale).match;
  return (
    <span className="flex flex-wrap gap-1">
      {reasons.map((r) => (
        <span key={r} className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold', r === 'budgetNear' ? 'bg-amber-500/10 text-amber-700' : 'bg-success-50 text-success-700')}>
          {t.reasons[r]}
        </span>
      ))}
    </span>
  );
}

/** BRK-5 — on a brokerage lead: what they're looking for, and the listings that fit. */
export async function LeadMatches({ leadId, locale, currency }: { leadId: string; locale: Locale; currency: string }) {
  const t = developersT(locale).match;
  const [res, typesRes] = await Promise.all([
    safe(api.get<{ requirement: LeadRequirement | null; matches: ListingMatch[] }>(`/listings/matches/${leadId}`)),
    safe(api.get<UnitTypeOption[]>('/unit-types')),
  ]);
  if (res.error) return null;
  const types = (typesRes.data ?? []).filter((u) => u.active).map((u) => ({ code: u.code, name: tx(u.name, locale) }));
  const matches = res.data?.matches ?? [];
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start" data-testid="lead-matching">
      <Panel icon={<Sparkles />} title={t.title} sub={t.sub}>
        <RequirementCard leadId={leadId} requirement={res.data?.requirement ?? null} unitTypes={types} locale={locale} currency={currency} />
      </Panel>
      <Panel icon={<Home />} title={t.matches} sub={t.matchesSub} className="lg:col-span-2" testId="lead-matches">
        {!res.data?.requirement ? (
          <p className="text-[13.5px] text-slate-500">{t.none}</p>
        ) : matches.length === 0 ? (
          <p className="text-[13.5px] text-slate-500">{t.noMatches}</p>
        ) : (
          <ul className="divide-y divide-hairline">
            {matches.slice(0, 8).map((l) => (
              <li key={l.id}>
                <Link href={`/dashboard/listings/${l.id}` as never} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 hover:text-brand-700" data-testid={`match-${l.code}`}>
                  {l.photos[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={l.photos[0]} alt="" className="h-14 w-16 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <span className="inline-flex h-14 w-16 shrink-0 items-center justify-center rounded-xl bg-[#0E1626] text-[#E6C77E]"><Home className="h-5 w-5" /></span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-[14px] font-bold text-slate-900">{l.title}</span>
                      <KindTag kind={l.kind} locale={locale} />
                    </p>
                    <p className="mt-0.5 truncate text-[12.5px] text-slate-500">
                      <span className="num">{l.code}</span> · {[l.district, l.city].filter(Boolean).join('، ')}
                      {l.bedrooms !== null && <span className="num"> · {t.rooms(l.bedrooms)}</span>}
                      <span className="num"> · {t.sqm(l.area)}</span>
                    </p>
                    <div className="mt-1.5">
                      <ReasonChips reasons={l.reasons} locale={locale} />
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <ScoreBadge score={l.score} />
                    <span className="num text-[13px] font-bold text-slate-900">{formatCurrency(l.price, currency, locale)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
