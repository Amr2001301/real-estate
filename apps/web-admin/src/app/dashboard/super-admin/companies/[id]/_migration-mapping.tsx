'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { Check, Link2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { PremiumSectionCard } from '@/components/premium';
import { getClientLocale } from '@/lib/locale-client';
import { readError } from '@/components/ai/ai-strings';

type Entity = 'PROJECT' | 'UNIT' | 'CUSTOMER' | 'LEAD' | 'ACTIVITY';
type Action = 'MAP' | 'IGNORE' | 'NOTE' | 'CUSTOMER_FIELD';
type Named = { ar?: string; en?: string } | string | null;

interface Group {
  field: string;
  entity: Entity;
  value: string;
  sample: string;
  count: number;
  mapping: { action: Action; target: string | null; systemWide: boolean } | null;
}

interface Screen {
  systems: { sourceSystem: string; sourceLabel: string }[];
  sourceSystem: string | null;
  groups: Group[];
  options: {
    stages: string[];
    noteKinds: string[];
    callResults: string[];
    sources: { id: string; name: Named }[];
    unitTypes: { code: string; name: Named }[];
    staff: { id: string; fullName: string; role: string }[];
    customerFields: { key: string; label: Named }[];
  };
}

interface Result {
  applied: number;
  kept: number;
  futureOnly?: boolean;
}

const T = {
  ar: {
    title: 'ربط البيانات المحفوظة',
    description:
      'القيم اللي النظام التاني بعتها ومتعرفتش هنا، والبيانات الإضافية. اختار كل قيمة تبقى إيه هنا مرة واحدة: بتتطبق على اللي اتنقل، ما عدا اللي حد عدّله بإيده بعد النقل، وعلى أي حاجة تتبعت بعد كده.',
    empty: 'مفيش قيم محتاجة ربط.',
    system: 'النظام',
    records: (n: number) => `${n} سجل`,
    choose: '— اختار —',
    ignore: 'تجاهل',
    note: 'ملاحظة على العميل المحتمل',
    save: 'احفظ',
    saved: 'محفوظ',
    systemWide: 'لكل الشركات من النظام ده',
    result: (r: Result) =>
      r.futureOnly
        ? 'اتحفظ — هيتطبق على اللي يتبعت بعد كده بس'
        : `اتطبق على ${r.applied}${r.kept ? `، و${r.kept} اتسابوا لأن حد عدّلهم بعد النقل` : ''}`,
    field: {
      'LEAD.stage': 'مرحلة العميل المحتمل',
      'LEAD.source': 'المصدر',
      'LEAD.assignedTo': 'المسؤول عن العميل المحتمل',
      'ACTIVITY.kind': 'نوع المتابعة',
      'ACTIVITY.callResult': 'نتيجة المكالمة',
      'ACTIVITY.by': 'كاتب المتابعة',
      'UNIT.type': 'نوع الوحدة',
    } as Record<string, string>,
    extraOf: { CUSTOMER: 'بيانات إضافية للعميل', LEAD: 'بيانات إضافية للعميل المحتمل', PROJECT: 'بيانات إضافية للمشروع', UNIT: 'بيانات إضافية للوحدة', ACTIVITY: 'بيانات إضافية للمتابعة' } as Record<Entity, string>,
    stage: { NEW: 'جديد', INTERESTED: 'مهتم', VISIT: 'زيارة', NEGOTIATION: 'تفاوض', WON: 'تم البيع', LOST: 'خسارة' } as Record<string, string>,
    noteKind: { NOTE: 'ملاحظة', CALL: 'مكالمة', MEETING: 'اجتماع', WHATSAPP: 'واتساب', FOLLOW_UP: 'متابعة' } as Record<string, string>,
    callResult: { ANSWERED: 'رد', NO_ANSWER: 'لم يرد', BUSY: 'مشغول', UNREACHABLE: 'غير متاح', WRONG_NUMBER: 'رقم غلط' } as Record<string, string>,
    error: 'حصل خطأ، حاول تاني',
  },
  en: {
    title: 'Mapping what was kept',
    description:
      'Values the other system sent that are not recognised here, and extra data. Choose once what each becomes here: it applies to what was moved — except what someone changed by hand since — and to anything sent later.',
    empty: 'Nothing to map.',
    system: 'System',
    records: (n: number) => `${n} records`,
    choose: '— Choose —',
    ignore: 'Ignore',
    note: 'A note on the lead',
    save: 'Save',
    saved: 'Saved',
    systemWide: 'For every company from this system',
    result: (r: Result) =>
      r.futureOnly
        ? 'Saved — it applies to what is sent from now on'
        : `Applied to ${r.applied}${r.kept ? `; ${r.kept} left as someone changed them since the move` : ''}`,
    field: {
      'LEAD.stage': 'Lead stage',
      'LEAD.source': 'Source',
      'LEAD.assignedTo': 'Lead owner',
      'ACTIVITY.kind': 'Activity kind',
      'ACTIVITY.callResult': 'Call result',
      'ACTIVITY.by': 'Activity author',
      'UNIT.type': 'Unit type',
    } as Record<string, string>,
    extraOf: { CUSTOMER: 'Customer extra data', LEAD: 'Lead extra data', PROJECT: 'Project extra data', UNIT: 'Unit extra data', ACTIVITY: 'Activity extra data' } as Record<Entity, string>,
    stage: { NEW: 'New', INTERESTED: 'Interested', VISIT: 'Visit', NEGOTIATION: 'Negotiation', WON: 'Won', LOST: 'Lost' } as Record<string, string>,
    noteKind: { NOTE: 'Note', CALL: 'Call', MEETING: 'Meeting', WHATSAPP: 'WhatsApp', FOLLOW_UP: 'Follow-up' } as Record<string, string>,
    callResult: { ANSWERED: 'Answered', NO_ANSWER: 'No answer', BUSY: 'Busy', UNREACHABLE: 'Unreachable', WRONG_NUMBER: 'Wrong number' } as Record<string, string>,
    error: 'Something went wrong, try again',
  },
};

const isExtra = (field: string) => field.includes('.extra.');
const extraKey = (field: string) => field.split('.extra.')[1] ?? field;

// MG2 — «ربط البيانات المحفوظة»: the platform owner maps what a move kept
// (an unrecognised stage, source, person, activity kind, unit type, or an
// extra field) once; the API applies it to what was moved and to later sends.
export function CompanyMigrationMapping({ companyId }: { companyId: string }) {
  const locale = getClientLocale();
  const m = useMemo(() => T[locale === 'en' ? 'en' : 'ar'], [locale]);
  const base = `/api-proxy/super-admin/companies/${companyId}/migrations/mapping`;
  const [screen, setScreen] = useState<Screen | null>(null);
  const [system, setSystem] = useState<string | undefined>();
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, Result>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const name = (n: Named) => (typeof n === 'string' ? n : (locale === 'en' ? n?.en || n?.ar : n?.ar || n?.en) ?? '');

  async function load(sys?: string) {
    const res = await fetch(`${base}${sys ? `?system=${encodeURIComponent(sys)}` : ''}`, { cache: 'no-store' });
    if (!res.ok) return;
    const d = (await res.json()) as Screen;
    setScreen(d);
    setSystem(d.sourceSystem ?? undefined);
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  if (!screen || screen.systems.length === 0) return null;
  const o = screen.options;

  /** The choices a group offers, as "ACTION:target". */
  function optionsFor(g: Group): { value: string; label: string }[] {
    const ignore = { value: 'IGNORE:', label: m.ignore };
    if (isExtra(g.field)) {
      if (g.entity === 'CUSTOMER') return [...o.customerFields.map((f) => ({ value: `CUSTOMER_FIELD:${f.key}`, label: name(f.label) || f.key })), ignore];
      if (g.entity === 'LEAD') return [{ value: 'NOTE:', label: m.note }, ignore];
      return [ignore];
    }
    const map = (list: { value: string; label: string }[]) => [...list.map((x) => ({ value: `MAP:${x.value}`, label: x.label })), ignore];
    switch (g.field) {
      case 'LEAD.stage':
        return map(o.stages.map((s) => ({ value: s, label: m.stage[s] ?? s })));
      case 'ACTIVITY.kind':
        return map(o.noteKinds.map((s) => ({ value: s, label: m.noteKind[s] ?? s })));
      case 'ACTIVITY.callResult':
        return map(o.callResults.map((s) => ({ value: s, label: m.callResult[s] ?? s })));
      case 'LEAD.source':
        return map(o.sources.map((s) => ({ value: s.id, label: name(s.name) })));
      case 'UNIT.type':
        return map(o.unitTypes.map((t) => ({ value: t.code, label: name(t.name) || t.code })));
      case 'LEAD.assignedTo':
      case 'ACTIVITY.by':
        return map(o.staff.map((s) => ({ value: s.id, label: s.fullName })));
      default:
        return [ignore];
    }
  }

  const idOf = (g: Group) => `${g.field}|${g.value}`;
  const current = (g: Group) => (g.mapping ? `${g.mapping.action}:${g.mapping.target ?? ''}` : '');

  function save(g: Group) {
    const picked = choice[idOf(g)] ?? current(g);
    if (!picked) return;
    const [action, ...rest] = picked.split(':');
    const target = rest.join(':');
    setError(null);
    startTransition(async () => {
      const res = await fetch(base, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceSystem: screen!.sourceSystem,
          field: g.field,
          ...(isExtra(g.field) ? {} : { value: g.sample }),
          action,
          ...(target ? { target } : {}),
        }),
      });
      if (!res.ok) return setError(await readError(res, m.error));
      const r = (await res.json()) as Result;
      setResults((prev) => ({ ...prev, [idOf(g)]: r }));
      await load(system);
    });
  }

  const sections = new Map<string, Group[]>();
  for (const g of screen.groups) {
    const title = isExtra(g.field) ? m.extraOf[g.entity] : (m.field[g.field] ?? g.field);
    sections.set(title, [...(sections.get(title) ?? []), g]);
  }

  return (
    <PremiumSectionCard title={m.title} description={m.description} icon={<Link2 className="h-4 w-4" />}>
      <div data-testid="migration-mapping" className="flex flex-col gap-4">
        {screen.systems.length > 1 && (
          <label className="flex items-center gap-2 text-[13px] text-slate-600">
            {m.system}
            <Select value={system} onChange={(e) => void load(e.target.value)} className="w-56">
              {screen.systems.map((s) => (
                <option key={s.sourceSystem} value={s.sourceSystem}>
                  {s.sourceLabel} ({s.sourceSystem})
                </option>
              ))}
            </Select>
          </label>
        )}

        {screen.groups.length === 0 ? (
          <p className="text-[13px] text-slate-500">{m.empty}</p>
        ) : (
          [...sections.entries()].map(([title, groups]) => (
            <div key={title} className="rounded-[20px] border border-hairline">
              <p className="border-b border-hairline px-4 py-2.5 text-[12.5px] font-bold text-slate-700">{title}</p>
              <ul className="divide-y divide-hairline">
                {groups.map((g) => {
                  const id = idOf(g);
                  const picked = choice[id] ?? current(g);
                  const result = results[id];
                  return (
                    <li key={id} data-testid="mapping-row" className="flex flex-wrap items-center gap-3 px-4 py-3 text-[13px]">
                      <div className="min-w-[180px] flex-1">
                        <p className="font-semibold text-slate-900">{isExtra(g.field) ? extraKey(g.field) : g.sample}</p>
                        <p className="text-[11.5px] text-slate-500">
                          {m.records(g.count)}
                          {isExtra(g.field) && g.sample ? ` · ${g.sample}` : ''}
                          {g.mapping?.systemWide ? ` · ${m.systemWide}` : ''}
                        </p>
                        {result && <p className="mt-0.5 text-[11.5px] text-emerald-700">{m.result(result)}</p>}
                      </div>
                      <Select
                        value={picked}
                        onChange={(e) => setChoice({ ...choice, [id]: e.target.value })}
                        className="w-56"
                        aria-label={m.choose}
                      >
                        <option value="">{m.choose}</option>
                        {optionsFor(g).map((x) => (
                          <option key={x.value} value={x.value}>
                            {x.label}
                          </option>
                        ))}
                      </Select>
                      <Button
                        type="button"
                        size="sm"
                        variant={g.mapping && picked === current(g) ? 'ghost' : 'primary'}
                        disabled={pending || !picked}
                        onClick={() => save(g)}
                      >
                        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : g.mapping && picked === current(g) ? <Check className="h-4 w-4" /> : null}
                        {g.mapping && picked === current(g) ? m.saved : m.save}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
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
