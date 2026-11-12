'use client';

import { useEffect, useMemo, useState } from 'react';
import { Calculator } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { PremiumSectionCard } from '@/components/premium';
import { calculateQuote, type CalcPlan } from '@/lib/pricing-calc';
import type { PricingStrings } from '@/messages/super-admin';

interface PkgLike {
  id: string;
  planTier: string;
  nameAr: string;
  nameEn: string;
  currency: string;
  annualPrice: string | null;
  maxUsers: number | null;
  isActive: boolean;
}

interface AiPkg { id: string; name: string; questions: number; price: string; isActive: boolean }

const EXTRA_KEY = 'pricing-calc-extra-user';
const money = (n: number) => n.toLocaleString('en');

// The platform owner's price calculator: any staff count, any length, an optional discount.
export function PricingCalculator({ packages, locale, m }: { packages: PkgLike[]; locale: string; m: PricingStrings }) {
  const [users, setUsers] = useState('10');
  const [years, setYears] = useState('1');
  const [extra, setExtra] = useState('1500');
  const [discount, setDiscount] = useState('0');
  const [aiId, setAiId] = useState('');
  const [aiPackages, setAiPackages] = useState<AiPkg[]>([]);

  useEffect(() => {
    fetch('/api-proxy/super-admin/ai/packages')
      .then((r) => (r.ok ? r.json() : []))
      .then((d: AiPkg[]) => setAiPackages(d.filter((a) => a.isActive)))
      .catch(() => setAiPackages([]));
  }, []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(EXTRA_KEY);
      if (saved) setExtra(saved);
    } catch { /* storage unavailable: keep the default */ }
  }, []);

  const plans: CalcPlan[] = useMemo(
    () =>
      packages
        .filter((p) => p.isActive && p.planTier !== 'TRIAL' && p.planTier !== 'CUSTOM')
        .map((p) => ({
          id: p.id,
          planTier: p.planTier,
          name: locale === 'en' ? p.nameEn : p.nameAr,
          annualPrice: p.annualPrice === null ? null : Number(p.annualPrice),
          maxUsers: p.maxUsers,
        })),
    [packages, locale],
  );
  const currency = packages[0]?.currency ?? 'EGP';

  const result = useMemo(
    () =>
      calculateQuote({
        plans,
        users: Number(users),
        years: Number(years),
        extraUserPrice: Number(extra),
        discountPct: Number(discount),
        aiMonthlyPrice: Number(aiPackages.find((a) => a.id === aiId)?.price ?? 0),
      }),
    [plans, users, years, extra, discount, aiPackages, aiId],
  );

  const c = m.calc;
  const hasPlans = plans.some((p) => p.annualPrice !== null);

  return (
    <PremiumSectionCard title={c.title} icon={<Calculator />}>
      <p className="mb-4 text-[12px] text-slate-400">{c.hint}</p>
      <div data-testid="price-calc" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="block">
          <span className="mb-1 block text-[12px] font-semibold text-slate-500">{c.users}</span>
          <Input type="number" min={1} inputMode="numeric" value={users} onChange={(e) => setUsers(e.target.value)} inputSize="sm" aria-label={c.users} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12px] font-semibold text-slate-500">{c.years}</span>
          <Input type="number" min={1} max={20} inputMode="numeric" value={years} onChange={(e) => setYears(e.target.value)} inputSize="sm" aria-label={c.years} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12px] font-semibold text-slate-500">{c.extraPrice}</span>
          <Input
            type="number"
            min={0}
            inputMode="numeric"
            value={extra}
            onChange={(e) => {
              setExtra(e.target.value);
              try { window.localStorage.setItem(EXTRA_KEY, e.target.value); } catch { /* per-viewer convenience only */ }
            }}
            inputSize="sm"
            aria-label={c.extraPrice}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12px] font-semibold text-slate-500">{c.discount}</span>
          <Input type="number" min={0} max={100} inputMode="numeric" value={discount} onChange={(e) => setDiscount(e.target.value)} inputSize="sm" aria-label={c.discount} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12px] font-semibold text-slate-500">{c.ai}</span>
          <Select value={aiId} onChange={(e) => setAiId(e.target.value)} inputSize="sm" aria-label={c.ai}>
            <option value="">{c.aiNone}</option>
            {aiPackages.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </Select>
        </label>
      </div>

      <div data-testid="price-calc-result" className="mt-4 rounded-2xl border border-hairline bg-surface-soft/60 p-4">
        {!hasPlans ? (
          <p className="text-[13px] text-slate-400">{c.noPlans}</p>
        ) : !result ? (
          <p className="text-[13px] text-slate-400">{c.empty}</p>
        ) : (
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11.5px] text-slate-400">
                {result.kind === 'custom' ? c.custom : c.plan}
              </p>
              <p className="text-[15px] font-bold text-slate-900">
                {result.kind === 'custom' ? c.customNote(result.extraUsers, result.planName) : result.planName}
              </p>
              {result.kind === 'unlimited' && Number(users) > 0 && (
                <p className="text-[11.5px] text-amber-700">{c.unlimitedNote}</p>
              )}
              <p className="mt-2 text-[12px] text-slate-500">
                {c.perYear}: <span dir="ltr" className="tabular-nums">{money(result.perYear)}</span> {currency}
                {result.discount > 0 && (
                  <> · {c.discountLine}: <span dir="ltr" className="tabular-nums">−{money(result.discount)}</span></>
                )}
                {result.aiTotal > 0 && (
                  <> · {c.aiLine}: <span dir="ltr" className="tabular-nums">{money(result.aiTotal)}</span></>
                )}
                {result.perUserPerYear !== null && (
                  <> · {c.perUser}: <span dir="ltr" className="tabular-nums">{money(result.perUserPerYear)}</span></>
                )}
              </p>
            </div>
            <div className="text-end">
              <p className="text-[11.5px] text-slate-400">{c.total}</p>
              <p className="text-[26px] font-extrabold tabular-nums text-slate-900" dir="ltr">
                {money(result.grandTotal)} <span className="text-[13px] font-semibold text-slate-500">{currency}</span>
              </p>
            </div>
          </div>
        )}
      </div>
    </PremiumSectionCard>
  );
}
