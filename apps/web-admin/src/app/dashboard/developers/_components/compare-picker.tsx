'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Check } from 'lucide-react';
import type { Locale } from '@/lib/locale';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { developersT, type PlanOption } from '@/components/developers/messages';

const MAX = 4;

/** Pick the price and up to four plans; the page re-renders with them compared. */
export function ComparePicker({ locale, plans, price, selected }: { locale: Locale; plans: PlanOption[]; price: string; selected: string[] }) {
  const t = developersT(locale);
  const router = useRouter();
  const [value, setValue] = useState(price);
  const [picked, setPicked] = useState<string[]>(selected);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < MAX ? [...p, id] : p));
  const groups = new Map<string, { title: string; plans: PlanOption[] }>();
  for (const p of plans) {
    const key = p.project.id;
    if (!groups.has(key)) groups.set(key, { title: `${p.project.developer.name} — ${p.project.name}`, plans: [] });
    groups.get(key)!.plans.push(p);
  }
  const go = () => {
    const qs = new URLSearchParams();
    if (Number(value) > 0) qs.set('price', String(Number(value)));
    if (picked.length) qs.set('plans', picked.join(','));
    router.push(`/dashboard/developers/compare?${qs.toString()}` as never);
  };

  if (plans.length === 0) return <p className="text-[13.5px] text-slate-500">{t.compare.noPlans}</p>;
  return (
    <div className="space-y-5 print:hidden" data-testid="compare-picker">
      <label className="block max-w-xs text-[12.5px] font-semibold text-slate-600">
        {t.compare.price}
        <Input type="number" min={1} step="1000" dir="ltr" value={value} onChange={(e) => setValue(e.target.value)} className="mt-1.5" data-testid="compare-price" />
      </label>
      <div>
        <p className="text-[12.5px] font-semibold text-slate-600">{t.compare.pick}</p>
        <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
          {[...groups.values()].map((g) => (
            <div key={g.title} className="rounded-2xl border border-hairline p-3">
              <p className="truncate text-[13px] font-bold text-slate-900">{g.title}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {g.plans.map((p) => {
                  const on = picked.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggle(p.id)}
                      aria-pressed={on}
                      data-testid={`compare-plan-${p.id}`}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-bold transition-colors',
                        on ? 'border-[#0E1626] bg-[#0E1626] text-[#F4ECD8] dark:border-[#D8B66A] dark:bg-[#D8B66A] dark:text-[#0E1626]' : 'border-hairline text-slate-600 hover:border-[#D8B66A]/60',
                        !on && picked.length >= MAX && 'opacity-40',
                      )}
                    >
                      {on && <Check className="h-3.5 w-3.5" />}
                      {p.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      <Button type="button" variant="primary" size="md" onClick={go} disabled={!picked.length || !(Number(value) > 0)} data-testid="compare-go">
        {t.compare.show}
      </Button>
    </div>
  );
}
