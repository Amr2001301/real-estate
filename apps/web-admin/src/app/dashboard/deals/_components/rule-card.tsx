'use client';

import { useActionState, useState } from 'react';
import { Building, Check, Home, KeyRound } from 'lucide-react';
import type { Locale } from '@/lib/locale';
import { formatDate, formatExactCurrency } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { listingsT, type ListingKind } from '@/components/listings/messages';
import { dealsT, type CommissionRule } from '@/components/deals/messages';
import { setRuleAction, type DealFormState } from '../actions';
import { ErrorLine } from './ui';

const KIND_ICON: Record<ListingKind, typeof Building> = { PRIMARY: Building, RESALE: Home, RENT: KeyRound };
/** The worked example on each card: a round commission, so the split reads at a glance. */
const EXAMPLE = 100_000;

/** One kind's rates: the agent's and the manager's share, with what they come to. */
export function RuleCard({ rule, locale, currency, canEdit }: { rule: CommissionRule; locale: Locale; currency: string; canEdit: boolean }) {
  const t = dealsT(locale).rules;
  const lm = listingsT(locale);
  const [agent, setAgent] = useState(String(rule.agentPct));
  const [manager, setManager] = useState(String(rule.managerPct));
  const [state, action, saving] = useActionState<DealFormState, FormData>(setRuleAction.bind(null, rule.kind), {});
  const a = Number(agent) || 0;
  const mg = Number(manager) || 0;
  const money = (n: number) => formatExactCurrency(n, currency, locale);
  const Icon = KIND_ICON[rule.kind];
  const over = a + mg > 100;

  return (
    <form action={action} className="flex flex-col rounded-[22px] border border-hairline bg-surface p-5 sm:p-6" data-testid={`rule-${rule.kind}`}>
      <header className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#D8B66A]/45 bg-[#0E1626] text-[#E6C77E]">
          <Icon className="h-[18px] w-[18px] stroke-[1.6]" />
        </span>
        <div>
          <h2 className="font-heading text-[17px] font-bold text-slate-900">{lm.kind[rule.kind]}</h2>
          <p className="mt-0.5 text-[12px] text-slate-500">{rule.updatedAt ? t.updated(formatDate(rule.updatedAt, locale)) : t.never}</p>
        </div>
      </header>

      <div className="mt-5 grid grid-cols-2 gap-4">
        <label className="block text-[12.5px] font-semibold text-slate-600">
          {t.agentPct}
          <Input name="agentPct" type="number" min={0} max={100} step="0.01" dir="ltr" required disabled={!canEdit} value={agent} onChange={(e) => setAgent(e.target.value)} className="mt-1.5" />
        </label>
        <label className="block text-[12.5px] font-semibold text-slate-600">
          {t.managerPct}
          <Input name="managerPct" type="number" min={0} max={100} step="0.01" dir="ltr" required disabled={!canEdit} value={manager} onChange={(e) => setManager(e.target.value)} className="mt-1.5" />
        </label>
      </div>

      {/* The split as a bar: agent, manager, and what the company keeps. */}
      <div className="mt-5">
        <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-500/15" aria-hidden>
          <span className="h-full bg-[#C79A3B]" style={{ width: `${Math.min(100, a)}%` }} />
          <span className="h-full bg-[#5E7F6B]" style={{ width: `${Math.max(0, Math.min(100 - a, mg))}%` }} />
        </div>
        <p className="mt-3 text-[11.5px] text-slate-500">{t.onCommission(money(EXAMPLE))}</p>
        <dl className="mt-2 grid grid-cols-3 gap-2">
          {[
            [t.legendAgent, (EXAMPLE * a) / 100, 'bg-[#C79A3B]'],
            [t.legendManager, (EXAMPLE * mg) / 100, 'bg-[#5E7F6B]'],
            [t.legendCompany, Math.max(0, EXAMPLE * (1 - (a + mg) / 100)), 'bg-slate-400/50'],
          ].map(([k, v, dot]) => (
            <div key={String(k)} className="min-w-0 rounded-xl bg-surface-muted/50 px-2.5 py-2">
              <dt className="flex items-center gap-1.5 text-[11.5px] font-semibold text-slate-500">
                <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden />
                <span className="truncate">{k}</span>
              </dt>
              <dd className="num mt-1 truncate text-[13.5px] font-bold text-slate-900">{money(Number(v))}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mt-auto pt-5">
        <ErrorLine error={over ? '≤ 100%' : state.error} />
        {canEdit ? (
          <div className="mt-2 flex items-center justify-end gap-3">
            {state.ok && !saving && (
              <span className="inline-flex items-center gap-1 text-[12.5px] font-bold text-success-700">
                <Check className="h-4 w-4" /> {t.saved}
              </span>
            )}
            <Button type="submit" variant="primary" size="sm" disabled={saving || over} data-testid={`rule-save-${rule.kind}`}>
              {t.save}
            </Button>
          </div>
        ) : (
          <p className="text-[12px] text-slate-500">{t.readOnly}</p>
        )}
      </div>
    </form>
  );
}
