'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { AlertTriangle, Plus, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/form/field';
import { PremiumPageHero, PremiumSectionCard } from '@/components/premium';
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

interface Attention extends AiPlanView {
  reason: 'NEAR_LIMIT' | 'EXHAUSTED' | 'ENDING_SOON' | 'ENDED';
  company: { id: string; name: string; slug: string };
}

// The platform owner's AI assistant packages, and the companies to follow up.
export default function SuperAdminAiPage() {
  const locale = getClientLocale();
  const m = useMemo(() => aiT(locale), [locale]);
  const [packages, setPackages] = useState<AiPackage[]>([]);
  const [attention, setAttention] = useState<Attention[]>([]);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function load() {
    const [p, a] = await Promise.all([
      fetch('/api-proxy/super-admin/ai/packages'),
      fetch('/api-proxy/super-admin/ai/attention'),
    ]);
    if (p.ok) setPackages((await p.json()) as AiPackage[]);
    if (a.ok) setAttention((await a.json()) as Attention[]);
  }
  useEffect(() => {
    void load();
  }, []);

  function save(id: string | 'new', body: Record<string, unknown>) {
    setError(null);
    startTransition(async () => {
      const res = await fetch(
        id === 'new' ? '/api-proxy/super-admin/ai/packages' : `/api-proxy/super-admin/ai/packages/${id}`,
        { method: id === 'new' ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
      );
      if (!res.ok) return setError(await readError(res, m.error));
      setEditing(null);
      await load();
    });
  }

  function onSubmit(id: string | 'new') {
    return (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      save(id, {
        name: String(fd.get('name') ?? ''),
        questions: Number(fd.get('questions')),
        price: Number(fd.get('price')),
        currency: String(fd.get('currency') || 'EGP'),
      });
    };
  }

  const form = (id: string | 'new', pkg?: AiPackage) => (
    <form onSubmit={onSubmit(id)} className="grid grid-cols-1 gap-3 rounded-xl border border-hairline bg-canvas/50 p-4 sm:grid-cols-5" data-testid="ai-package-form">
      <div className="sm:col-span-2">
        <Field label={m.name} name="name" required>
          <Input name="name" required defaultValue={pkg?.name} />
        </Field>
      </div>
      <Field label={m.questions} name="questions" required>
        <Input name="questions" type="number" min={1} required dir="ltr" defaultValue={pkg?.questions} />
      </Field>
      <Field label={m.price} name="price" required>
        <Input name="price" type="number" min={0} step="0.01" required dir="ltr" defaultValue={pkg ? Number(pkg.price) : undefined} />
      </Field>
      <Field label={m.currency} name="currency">
        <Input name="currency" dir="ltr" defaultValue={pkg?.currency ?? 'EGP'} maxLength={3} />
      </Field>
      <div className="flex justify-end gap-2 sm:col-span-5">
        <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(null)}>{m.cancel}</Button>
        <Button type="submit" variant="primary" size="sm" loading={pending}>{m.save}</Button>
      </div>
    </form>
  );

  return (
    <div className="space-y-6">
      <PremiumPageHero
        title={m.title}
        description={m.description}
        breadcrumbs={[{ label: 'Platform', href: '/dashboard/super-admin' }, { label: m.title }]}
        actions={
          editing !== 'new' && (
            <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setEditing('new')}>
              {m.addPackage}
            </Button>
          )
        }
      />

      <PremiumSectionCard title={m.attention} icon={<AlertTriangle />}>
        {attention.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">{m.noAttention}</p>
        ) : (
          <ul className="divide-y divide-hairline">
            {attention.map((a) => (
              <li key={a.company.id} className="flex flex-wrap items-center gap-3 py-3">
                <Link href={`/dashboard/super-admin/companies/${a.company.id}`} className="font-semibold text-slate-900 hover:underline">
                  {a.company.name}
                </Link>
                <span className="rounded-full bg-warning-50 px-2.5 py-0.5 text-xs font-semibold text-warning-700">{m.reason[a.reason]}</span>
                <span className="ms-auto text-sm tabular-nums text-slate-600">
                  {a.used} {m.of} {a.quota} · {m.ends} {formatDate(a.periodEnd, locale)}
                </span>
                <span className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken sm:w-40">
                  <span className={`block h-full ${usageTone(a)}`} style={{ width: `${a.usedPct}%` }} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </PremiumSectionCard>

      <PremiumSectionCard title={m.packages} icon={<Sparkles />}>
        {error && <p className="mb-3 rounded-xl bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</p>}
        {editing === 'new' && <div className="mb-4">{form('new')}</div>}
        {packages.length === 0 && editing !== 'new' && <p className="py-6 text-center text-sm text-slate-500">{m.noPackages}</p>}
        <ul className="space-y-3" data-testid="ai-packages">
          {packages.map((p) =>
            editing === p.id ? (
              <li key={p.id}>{form(p.id, p)}</li>
            ) : (
              <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-hairline px-4 py-3">
                <span className="font-semibold text-slate-900">{p.name}</span>
                <span className="text-sm text-slate-600 tabular-nums">
                  {p.questions.toLocaleString(locale === 'en' ? 'en-US' : 'ar-EG-u-nu-latn')} · {Number(p.price).toLocaleString('en-US')} {p.currency}
                </span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${p.isActive ? 'bg-success-50 text-success-700' : 'bg-surface-sunken text-slate-500'}`}>
                  {p.isActive ? m.active : m.stopped}
                </span>
                <span className="ms-auto flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditing(p.id)}>{m.edit}</Button>
                  <Button variant="ghost" size="sm" loading={pending} onClick={() => save(p.id, { isActive: !p.isActive })}>
                    {p.isActive ? m.stop : m.resume}
                  </Button>
                </span>
              </li>
            ),
          )}
        </ul>
      </PremiumSectionCard>
    </div>
  );
}
