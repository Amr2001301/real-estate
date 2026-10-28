'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { ArrowLeftRight, Check, Copy, KeyRound, Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Field } from '@/components/form/field';
import { PremiumSectionCard } from '@/components/premium';
import { getClientLocale } from '@/lib/locale-client';
import { formatDate } from '@/lib/format';
import { readError } from '@/components/ai/ai-strings';
import { migrationApiBase } from './_migration-api-base';

type Entity = 'PROJECT' | 'UNIT' | 'CUSTOMER' | 'LEAD' | 'ACTIVITY';

interface Run {
  id: string;
  sourceSystem: string;
  sourceLabel: string;
  tokenPrefix: string;
  expiresAt: string;
  state: 'OPEN' | 'EXPIRED' | 'FINISHED';
  note: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  counts: Record<Entity, number>;
  withUnmapped: number;
  withExtra: number;
}

interface KeptRecord {
  id: string;
  entity: Entity;
  externalId: string;
  extra: Record<string, unknown> | null;
  unmapped: Record<string, string> | null;
}

const ENTITIES: Entity[] = ['PROJECT', 'UNIT', 'CUSTOMER', 'LEAD', 'ACTIVITY'];

const STATE_CLS: Record<Run['state'], string> = {
  OPEN: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  EXPIRED: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  FINISHED: 'bg-slate-100 text-slate-500 ring-1 ring-slate-200',
};

const T = {
  ar: {
    title: 'نقل بيانات من نظام تاني',
    description:
      'مفتاح يبعته النظام القديم مع بيانات الشركة (مشاريع، وحدات، عملاء، عملاء محتملين، متابعات). أي بيانات ملهاش مكان هنا بتتحفظ عشان متضيعش.',
    empty: 'لسه مفيش نقل بيانات للشركة دي.',
    newRun: 'مفتاح نقل جديد',
    label: 'اسم النظام',
    labelHint: 'زي ما الناس بتقوله: إنجاز',
    system: 'اسمه بالإنجليزي',
    systemHint: 'حروف صغيرة: engaz — السجلات بتتعرف بيه، فاستخدم نفس الاسم كل مرة لنفس النظام',
    days: 'المفتاح شغال لمدة',
    dayN: (n: number) => `${n} يوم`,
    note: 'ملاحظة',
    create: 'اعمل المفتاح',
    cancel: 'إلغاء',
    keyOnce: 'انسخ المفتاح دلوقتي وابعته للنظام التاني — مش هيظهر تاني.',
    address: 'العنوان',
    header: 'يتبعت في',
    copy: 'نسخ',
    copied: 'اتنسخ',
    docs: 'شرح الشكل المطلوب في ملف docs/DATA_MIGRATION_API.md — ابعته للمبرمج عندهم.',
    state: { OPEN: 'شغال', EXPIRED: 'انتهت مدته', FINISHED: 'خلص' } as Record<Run['state'], string>,
    expires: 'ينتهي',
    lastUsed: 'آخر استخدام',
    never: 'لسه متستخدمش',
    entity: { PROJECT: 'مشاريع', UNIT: 'وحدات', CUSTOMER: 'عملاء', LEAD: 'عملاء محتملين', ACTIVITY: 'متابعات' } as Record<Entity, string>,
    kept: (u: number, x: number) => `محفوظ للمراجعة: ${u} سجل فيه قيم مش معروفة، و${x} سجل فيه بيانات إضافية`,
    show: 'اعرضهم',
    hide: 'اخفي',
    unmapped: 'قيم مش معروفة',
    field: {
      stage: 'المرحلة', source: 'المصدر', assignedTo: 'المسؤول', type: 'نوع الوحدة', status: 'الحالة',
      kind: 'نوع النشاط', callResult: 'نتيجة المكالمة', by: 'بواسطة',
    } as Record<string, string>,
    extra: 'بيانات إضافية',
    finish: 'إنهاء النقل وإلغاء المفتاح',
    finishConfirm: 'المفتاح هيبطل يشتغل، واللي اتنقل هيفضل. متأكد؟',
    error: 'حصل خطأ، حاول تاني',
  },
  en: {
    title: 'Data from another system',
    description:
      'A key the old system sends the company’s data with (projects, units, customers, leads, activities). Anything with no place here is kept, so nothing is lost.',
    empty: 'No data moved in for this company yet.',
    newRun: 'New migration key',
    label: 'System name',
    labelHint: 'As people say it',
    system: 'Name in English',
    systemHint: 'Lowercase: engaz — records are matched by it, so reuse it for the same system',
    days: 'Key works for',
    dayN: (n: number) => `${n} days`,
    note: 'Note',
    create: 'Create the key',
    cancel: 'Cancel',
    keyOnce: 'Copy the key now and send it to the other system — it is not shown again.',
    address: 'Address',
    header: 'Sent in',
    copy: 'Copy',
    copied: 'Copied',
    docs: 'The format is in docs/DATA_MIGRATION_API.md — send it to their developer.',
    state: { OPEN: 'Open', EXPIRED: 'Expired', FINISHED: 'Finished' } as Record<Run['state'], string>,
    expires: 'Expires',
    lastUsed: 'Last used',
    never: 'Not used yet',
    entity: { PROJECT: 'Projects', UNIT: 'Units', CUSTOMER: 'Customers', LEAD: 'Leads', ACTIVITY: 'Activities' } as Record<Entity, string>,
    kept: (u: number, x: number) => `Kept for review: ${u} records with values not recognised, ${x} with extra data`,
    show: 'Show',
    hide: 'Hide',
    unmapped: 'Not recognised',
    field: {
      stage: 'Stage', source: 'Source', assignedTo: 'Assigned to', type: 'Unit type', status: 'Status',
      kind: 'Activity kind', callResult: 'Call result', by: 'By',
    } as Record<string, string>,
    extra: 'Extra data',
    finish: 'Finish and revoke the key',
    finishConfirm: 'The key stops working; what came in stays. Sure?',
    error: 'Something went wrong, try again',
  },
};

// «نقل بيانات من نظام تاني»: the platform owner opens a migration run for the
// company, hands its key to the other system, follows what came in and what
// is kept for mapping, and finishes it.
export function CompanyMigrationPanel({ companyId }: { companyId: string }) {
  const locale = getClientLocale();
  const m = useMemo(() => T[locale === 'en' ? 'en' : 'ar'], [locale]);
  const base = `/api-proxy/super-admin/companies/${companyId}/migrations`;
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [slug, setSlug] = useState('');
  const [apiBase, setApiBase] = useState('');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ sourceLabel: '', sourceSystem: '', days: '7', note: '' });
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [kept, setKept] = useState<Record<string, KeptRecord[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function load() {
    const res = await fetch(base, { cache: 'no-store' });
    if (!res.ok) return;
    const d = (await res.json()) as { companySlug: string; runs: Run[] };
    setSlug(d.companySlug);
    setRuns(d.runs);
  }
  useEffect(() => {
    void load();
    void migrationApiBase().then(setApiBase);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await fetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceLabel: form.sourceLabel.trim(),
          ...(form.sourceSystem.trim() ? { sourceSystem: form.sourceSystem.trim().toLowerCase() } : {}),
          days: Number(form.days),
          ...(form.note.trim() ? { note: form.note.trim() } : {}),
        }),
      });
      if (!res.ok) return setError(await readError(res, m.error));
      setNewKey(((await res.json()) as { key: string }).key);
      setAdding(false);
      setForm({ sourceLabel: '', sourceSystem: '', days: '7', note: '' });
      await load();
    });
  }

  function finish(run: Run) {
    if (!window.confirm(m.finishConfirm)) return;
    startTransition(async () => {
      const res = await fetch(`${base}/${run.id}/finish`, { method: 'POST' });
      if (!res.ok) return setError(await readError(res, m.error));
      await load();
    });
  }

  async function toggleKept(run: Run) {
    if (kept[run.id]) {
      const next = { ...kept };
      delete next[run.id];
      return setKept(next);
    }
    const [u, x] = await Promise.all([
      fetch(`${base}/${run.id}/records?kept=unmapped`, { cache: 'no-store' }),
      fetch(`${base}/${run.id}/records?kept=extra`, { cache: 'no-store' }),
    ]);
    if (!u.ok || !x.ok) return setError(m.error);
    const rows = new Map<string, KeptRecord>();
    for (const r of [...((await u.json()) as KeptRecord[]), ...((await x.json()) as KeptRecord[])]) rows.set(r.id, r);
    setKept({ ...kept, [run.id]: [...rows.values()] });
  }

  async function copy(text: string, id: string) {
    await navigator.clipboard.writeText(text).catch(() => undefined);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  }

  const address = `${apiBase}/v1/migration/${slug}/`;

  const CopyButton = ({ text, id }: { text: string; id: string }) => (
    <button
      type="button"
      onClick={() => void copy(text, id)}
      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-hairline px-2.5 py-1 text-[11.5px] font-semibold text-slate-600 hover:border-brand-400/50"
    >
      {copied === id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied === id ? m.copied : m.copy}
    </button>
  );

  return (
    <PremiumSectionCard title={m.title} description={m.description} icon={<ArrowLeftRight className="h-4 w-4" />}>
      <div data-testid="migration-panel" className="flex flex-col gap-4">
        {newKey && (
          <div data-testid="migration-new-key" className="rounded-[20px] border border-amber-200 bg-amber-50/60 p-4 text-[13px]">
            <p className="mb-2 font-semibold text-amber-800">{m.keyOnce}</p>
            <div className="mb-2 flex items-center gap-2">
              <code dir="ltr" className="flex-1 truncate rounded-xl bg-white px-3 py-2 font-mono text-[12.5px] text-slate-800 ring-1 ring-hairline">
                {newKey}
              </code>
              <CopyButton text={newKey} id="key" />
            </div>
            <p className="text-slate-600">
              {m.header}: <code dir="ltr" className="font-mono">X-Migration-Key</code>
            </p>
            <div className="mt-1 flex items-center gap-2 text-slate-600">
              <span>{m.address}:</span>
              <code dir="ltr" className="truncate font-mono text-[12px]">{address}</code>
              <CopyButton text={address} id="addr" />
            </div>
            <p className="mt-2 text-[12px] text-slate-500">{m.docs}</p>
          </div>
        )}

        {runs === null ? (
          <div className="h-20 animate-pulse rounded-2xl bg-slate-100" />
        ) : runs.length === 0 ? (
          <p className="text-[13px] text-slate-500">{m.empty}</p>
        ) : (
          runs.map((run) => (
            <div key={run.id} data-testid="migration-run" className="rounded-[20px] border border-hairline p-4">
              <div className="flex flex-wrap items-center gap-2">
                <KeyRound className="h-4 w-4 text-slate-400" />
                <span className="font-semibold text-slate-900">{run.sourceLabel}</span>
                <span dir="ltr" className="font-mono text-[11.5px] text-slate-400">
                  {run.sourceSystem} · {run.tokenPrefix}…
                </span>
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATE_CLS[run.state]}`}>{m.state[run.state]}</span>
              </div>
              <p className="mt-1 text-[12px] text-slate-500">
                {m.expires} {formatDate(run.expiresAt, locale)} · {m.lastUsed}{' '}
                {run.lastUsedAt ? formatDate(run.lastUsedAt, locale) : m.never}
                {run.note ? ` · ${run.note}` : ''}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {ENTITIES.map((e) => (
                  <span key={e} className="rounded-xl bg-canvas px-3 py-1.5 text-[12px] text-slate-600">
                    {m.entity[e]} <b className="tabular-nums text-slate-900">{run.counts[e]}</b>
                  </span>
                ))}
              </div>
              {(run.withUnmapped > 0 || run.withExtra > 0) && (
                <div className="mt-3 text-[12.5px] text-slate-600">
                  {m.kept(run.withUnmapped, run.withExtra)}{' '}
                  <button type="button" onClick={() => void toggleKept(run)} className="font-semibold text-brand-600 hover:underline">
                    {kept[run.id] ? m.hide : m.show}
                  </button>
                </div>
              )}
              {kept[run.id] && (
                <div className="mt-2 max-h-72 overflow-auto rounded-xl border border-hairline">
                  <table className="w-full text-[12px]">
                    <tbody>
                      {(kept[run.id] ?? []).map((r) => (
                        <tr key={r.id} className="border-b border-hairline align-top last:border-0">
                          <td className="whitespace-nowrap px-3 py-2 text-slate-500">{m.entity[r.entity]}</td>
                          <td dir="ltr" className="px-3 py-2 font-mono text-slate-700">{r.externalId}</td>
                          <td className="px-3 py-2">
                            {r.unmapped &&
                              Object.entries(r.unmapped).map(([k, v]) => (
                                <span key={k} className="me-1 mb-1 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-amber-800 ring-1 ring-amber-200">
                                  {m.field[k] ?? k}: {v}
                                </span>
                              ))}
                            {r.extra &&
                              Object.entries(r.extra).map(([k, v]) => (
                                <span key={k} className="me-1 mb-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">
                                  {k}: {String(v)}
                                </span>
                              ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {run.state === 'OPEN' && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => finish(run)}
                  className="mt-3 text-[12.5px] font-semibold text-danger-700 hover:underline disabled:opacity-60"
                >
                  {m.finish}
                </button>
              )}
            </div>
          ))
        )}

        {adding ? (
          <form onSubmit={create} data-testid="migration-add" className="rounded-[20px] border border-dashed border-brand-400/40 bg-brand-50/30 p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={m.label} hint={m.labelHint}>
                <Input value={form.sourceLabel} onChange={(e) => setForm({ ...form, sourceLabel: e.target.value })} required maxLength={80} />
              </Field>
              <Field label={m.system} hint={m.systemHint}>
                <Input dir="ltr" className="font-mono" value={form.sourceSystem} onChange={(e) => setForm({ ...form, sourceSystem: e.target.value })} maxLength={60} />
              </Field>
              <Field label={m.days}>
                <Select value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })}>
                  {[3, 7, 14, 30].map((n) => (
                    <option key={n} value={n}>
                      {m.dayN(n)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={m.note}>
                <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} maxLength={300} />
              </Field>
            </div>
            <div className="mt-4 flex gap-2">
              <Button type="submit" variant="primary" size="sm" disabled={pending || !form.sourceLabel.trim()}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {m.create}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)}>
                {m.cancel}
              </Button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => {
              setAdding(true);
              setNewKey(null);
            }}
            className="inline-flex items-center gap-1.5 self-start rounded-full border border-hairline px-4 py-2 text-[12.5px] font-semibold text-slate-700 hover:border-brand-400/50 hover:text-brand-700"
          >
            <Plus className="h-3.5 w-3.5" />
            {m.newRun}
          </button>
        )}

        {error && (
          <p role="alert" className="text-sm text-danger-700">
            {error}
          </p>
        )}
      </div>
    </PremiumSectionCard>
  );
}
