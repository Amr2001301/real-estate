'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Field } from '@/components/form/field';
import { PremiumSectionCard } from '@/components/premium';
import { getClientLocale } from '@/lib/locale-client';
import { formatDate } from '@/lib/format';
import { aiT, readError, usageTone, type AiPlanView } from '@/components/ai/ai-strings';

interface AiPackage {
  id: string;
  name: string;
  questions: number;
  price: string;
  currency: string;
  isActive: boolean;
}

interface LedgerEntry {
  id: string;
  type: 'ACTIVATE' | 'RENEW' | 'TOP_UP';
  questions: number;
  price: string;
  currency: string;
  periodStart: string;
  periodEnd: string;
  note: string | null;
  createdAt: string;
  package: { name: string } | null;
}

type Mode = 'ACTIVATE' | 'RENEW' | 'TOP_UP' | null;

// The company's AI assistant account: its current month, the three actions
// (enable, renew, add questions) and every entry with its agreed price.
export function CompanyAiPanel({ companyId }: { companyId: string }) {
  const locale = getClientLocale();
  const m = useMemo(() => aiT(locale), [locale]);
  const [plan, setPlan] = useState<AiPlanView | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [packages, setPackages] = useState<AiPackage[]>([]);
  const [mode, setMode] = useState<Mode>(null);
  const [pkgId, setPkgId] = useState('');
  const [price, setPrice] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function load() {
    const [acc, pk] = await Promise.all([
      fetch(`/api-proxy/super-admin/ai/companies/${companyId}`),
      fetch('/api-proxy/super-admin/ai/packages'),
    ]);
    if (acc.ok) {
      const d = (await acc.json()) as { plan: AiPlanView | null; ledger: LedgerEntry[] };
      setPlan(d.plan);
      setLedger(d.ledger);
    }
    if (pk.ok) setPackages(((await pk.json()) as AiPackage[]).filter((p) => p.isActive));
  }
  useEffect(() => {
    void load();
  }, [companyId]);

  function open(next: Mode) {
    setError(null);
    setMode(next);
    const first = packages.find((p) => p.id === plan?.packageId) ?? packages[0];
    setPkgId(first?.id ?? '');
    setPrice(next === 'TOP_UP' ? '' : first ? String(Number(first.price)) : '');
  }

  function pickPackage(id: string) {
    setPkgId(id);
    const p = packages.find((x) => x.id === id);
    if (p) setPrice(String(Number(p.price)));
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const note = String(fd.get('note') ?? '').trim() || undefined;
    const path = mode === 'ACTIVATE' ? 'activate' : mode === 'RENEW' ? 'renew' : 'top-up';
    const body =
      mode === 'TOP_UP'
        ? { questions: Number(fd.get('questions')), price: Number(price), note }
        : { packageId: pkgId, price: Number(price), note };
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api-proxy/super-admin/ai/companies/${companyId}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) return setError(await readError(res, m.error));
      setMode(null);
      await load();
    });
  }

  const live = plan && plan.status !== 'ENDED';
  const money = (v: string, c: string) => `${Number(v).toLocaleString('en-US')} ${c}`;

  return (
    <PremiumSectionCard
      title={m.panelTitle}
      icon={<Sparkles />}
      trailing={
        !mode && (
          <span className="flex gap-2">
            {!live && (
              <Button variant="primary" size="sm" onClick={() => open(plan ? 'RENEW' : 'ACTIVATE')} data-testid="ai-activate">
                {plan ? m.renew : m.activate}
              </Button>
            )}
            {live && (
              <>
                <Button variant="outline" size="sm" onClick={() => open('TOP_UP')}>{m.topUp}</Button>
                <Button variant="outline" size="sm" onClick={() => open('RENEW')}>{m.renew}</Button>
              </>
            )}
          </span>
        )
      }
    >
      {plan ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline gap-3">
            <span className="font-semibold text-slate-900">{plan.packageName ?? '—'}</span>
            <span className="rounded-full bg-surface-sunken px-2.5 py-0.5 text-xs font-semibold text-slate-700">{m.status[plan.status]}</span>
            <span className="ms-auto text-sm tabular-nums text-slate-600">
              {plan.used} {m.of} {plan.quota} · {m.remaining} {plan.remaining}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-sunken">
            <div className={`h-full ${usageTone(plan)}`} style={{ width: `${plan.usedPct}%` }} />
          </div>
          <p className="text-xs text-slate-500">
            {m.period}: {formatDate(plan.periodStart, locale)} – {formatDate(plan.periodEnd, locale)}
          </p>
        </div>
      ) : (
        <p className="text-sm text-slate-500">{m.notEnabled}</p>
      )}

      {mode && (
        <form onSubmit={submit} className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-hairline bg-canvas/50 p-4 sm:grid-cols-2">
          {mode === 'TOP_UP' ? (
            <Field label={m.extraQuestions} name="questions" required hint={m.topUpHint}>
              <Input name="questions" type="number" min={1} required dir="ltr" />
            </Field>
          ) : (
            <Field label={m.package} name="packageId" required hint={mode === 'RENEW' ? m.renewHint : undefined}>
              <Select name="packageId" value={pkgId} onChange={(e) => pickPackage(e.target.value)} required>
                {packages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.questions} · {money(p.price, p.currency)}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label={m.agreedPrice} name="price" required hint={mode === 'TOP_UP' ? undefined : m.agreedHint}>
            <Input name="price" type="number" min={0} step="0.01" required dir="ltr" value={price} onChange={(e) => setPrice(e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Field label={m.note} name="note">
              <Input name="note" maxLength={500} />
            </Field>
          </div>
          {error && <p className="rounded-xl bg-danger-50 px-3 py-2 text-sm text-danger-700 sm:col-span-2">{error}</p>}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setMode(null)}>{m.cancel}</Button>
            <Button type="submit" variant="primary" size="sm" loading={pending}>
              {mode === 'ACTIVATE' ? m.activate : mode === 'RENEW' ? m.renew : m.topUp}
            </Button>
          </div>
        </form>
      )}

      <h3 className="mt-6 mb-2 text-sm font-bold text-slate-900">{m.ledger}</h3>
      {ledger.length === 0 ? (
        <p className="text-sm text-slate-500">{m.noLedger}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-start text-xs text-slate-500">
                <th className="py-2 text-start font-semibold">{m.date}</th>
                <th className="py-2 text-start font-semibold">{m.package}</th>
                <th className="py-2 text-start font-semibold">{m.questions}</th>
                <th className="py-2 text-start font-semibold">{m.price}</th>
                <th className="py-2 text-start font-semibold">{m.period}</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((e) => (
                <tr key={e.id} className="border-t border-hairline">
                  <td className="py-2">
                    <span className="font-semibold">{m.type[e.type]}</span>
                    <span className="block text-xs text-slate-500">{formatDate(e.createdAt, locale)}</span>
                  </td>
                  <td className="py-2">{e.package?.name ?? '—'}{e.note ? <span className="block text-xs text-slate-500">{e.note}</span> : null}</td>
                  <td className="py-2 tabular-nums">{e.questions}</td>
                  <td className="py-2 tabular-nums">{money(e.price, e.currency)}</td>
                  <td className="py-2 text-xs text-slate-500">{formatDate(e.periodStart, locale)} – {formatDate(e.periodEnd, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PremiumSectionCard>
  );
}
