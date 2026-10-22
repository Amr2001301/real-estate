'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, Check, Loader2, Pencil, Plus, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { Locale } from '@/lib/locale';
import { FIXED_DETAILS, fieldLabel, type CustomerFieldDef, type CustomerFieldType } from '@/lib/customer-fields';
import { createFieldAction, reorderFieldsAction, updateFieldAction } from '../actions';

const TYPES: CustomerFieldType[] = ['TEXT', 'NUMBER', 'DATE', 'SELECT'];

const T = {
  ar: {
    fixedTitle: 'موجودة لكل عميل',
    fixedHint: 'هذه الخانات موجودة في بيانات كل عميل بالفعل — لا تحتاج إضافتها.',
    fixedBase: ['الاسم', 'الهاتف', 'البريد', 'الرقم القومي', 'العنوان'],
    listTitle: 'خانات شركتك',
    listHint: 'تظهر في نموذج العميل لموظفيك، وتُطبع في الصياغة بالرمز المكتوب بجانب كل خانة.',
    empty: 'لم تُضف خانات بعد.',
    addTitle: 'إضافة خانة',
    ar: 'الاسم بالعربية',
    en: 'الاسم بالإنجليزية',
    type: 'نوع الخانة',
    types: { TEXT: 'نص', NUMBER: 'رقم', DATE: 'تاريخ', SELECT: 'اختيار من قائمة' } as Record<CustomerFieldType, string>,
    options: 'الاختيارات (اختيار في كل سطر)',
    key: 'الرمز في الصياغة (اختياري)',
    keyHint: 'حروف إنجليزية صغيرة وأرقام و _ — يُصنع من الاسم الإنجليزي إن تُرك فارغاً، ولا يتغير بعد الإضافة.',
    add: 'إضافة',
    save: 'حفظ',
    cancel: 'إلغاء',
    edit: 'تعديل',
    on: 'مفعّلة',
    off: 'موقوفة',
    turnOff: 'إيقاف',
    turnOn: 'تفعيل',
    offHint: 'الخانة الموقوفة لا تظهر في نموذج العميل، وتبقى قيمها المحفوظة.',
    up: 'لأعلى',
    down: 'لأسفل',
    fixedNote: 'النوع والرمز ثابتان بعد الإضافة.',
  },
  en: {
    fixedTitle: 'Every customer has',
    fixedHint: 'These are already part of every customer’s data — no need to add them.',
    fixedBase: ['Name', 'Phone', 'E-mail', 'National ID', 'Address'],
    listTitle: 'Your fields',
    listHint: 'Your staff fill them on the customer form; a wording prints one with the code shown next to it.',
    empty: 'No fields yet.',
    addTitle: 'Add a field',
    ar: 'Arabic name',
    en: 'English name',
    type: 'Field type',
    types: { TEXT: 'Text', NUMBER: 'Number', DATE: 'Date', SELECT: 'Choice from a list' } as Record<CustomerFieldType, string>,
    options: 'Choices (one per line)',
    key: 'Code in wordings (optional)',
    keyHint: 'Lower-case letters, digits and _ — made from the English name if left empty; fixed once added.',
    add: 'Add',
    save: 'Save',
    cancel: 'Cancel',
    edit: 'Edit',
    on: 'On',
    off: 'Off',
    turnOff: 'Turn off',
    turnOn: 'Turn on',
    offHint: 'A field that is off leaves the customer form; the values saved in it stay.',
    up: 'Up',
    down: 'Down',
    fixedNote: 'The type and the code stay as added.',
  },
};

const card = 'rounded-[22px] border border-hairline bg-surface p-6 shadow-[0_18px_40px_-30px_rgb(20_26_38/0.35)]';
const label = 'text-[12px] font-semibold text-slate-600';
const input =
  'h-10 w-full rounded-xl border border-hairline bg-surface px-3 text-[13px] text-slate-800 outline-none transition-colors focus:border-brand-400/60';
const btn =
  'inline-flex h-9 items-center justify-center gap-1.5 rounded-full px-4 text-[12.5px] font-semibold transition-colors disabled:opacity-50';

const lines = (v: string) =>
  v
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

export function CustomerFieldsManager({ fields, locale }: { fields: CustomerFieldDef[]; locale: Locale }) {
  const t = T[locale === 'en' ? 'en' : 'ar'];
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) return setError(r.error ?? '');
      after?.();
      router.refresh();
    });

  const move = (i: number, d: -1 | 1) => {
    const ids = fields.map((f) => f.id);
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    act(() => reorderFieldsAction(ids));
  };

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex min-w-0 flex-col gap-5">
        <section className={card} data-testid="customer-fields">
          <h2 className="font-heading text-[17px] font-bold text-slate-900">{t.listTitle}</h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-slate-500">{t.listHint}</p>
          {error && <p className="mt-3 rounded-xl bg-danger-50 px-3 py-2 text-[12.5px] text-danger-700">{error}</p>}
          {fields.length === 0 ? (
            <p className="mt-5 rounded-2xl border border-dashed border-hairline px-4 py-8 text-center text-[13px] text-slate-500">
              {t.empty}
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-hairline rounded-2xl border border-hairline">
              {fields.map((f, i) =>
                editing === f.id ? (
                  <EditRow key={f.id} f={f} t={t} pending={pending} onCancel={() => setEditing(null)} onSave={(patch) => act(() => updateFieldAction(f.id, patch), () => setEditing(null))} />
                ) : (
                  <li key={f.id} data-testid={`field-${f.key}`} className={cn('flex flex-wrap items-center gap-3 px-4 py-3', !f.active && 'opacity-60')}>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13.5px] font-bold text-slate-900">{fieldLabel(f, locale)}</span>
                        <span className="text-[12px] text-slate-400">{fieldLabel(f, locale === 'en' ? 'ar' : 'en')}</span>
                        <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-inset ring-hairline">
                          {t.types[f.type]}
                        </span>
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                            f.active ? 'bg-success-50 text-success-700' : 'bg-slate-100 text-slate-500',
                          )}
                        >
                          {f.active ? t.on : t.off}
                        </span>
                      </div>
                      <div dir="ltr" className="mt-1 text-start font-mono text-[11.5px] text-slate-500">{`{{custom.${f.key}}}`}</div>
                      {f.type === 'SELECT' && <div className="mt-1 text-[12px] text-slate-500">{f.options.join(' · ')}</div>}
                    </div>
                    <div className="flex items-center gap-1">
                      <button type="button" title={t.up} disabled={pending || i === 0} onClick={() => move(i, -1)} className={cn(btn, 'w-9 px-0 text-slate-500 hover:text-slate-900')}>
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button type="button" title={t.down} disabled={pending || i === fields.length - 1} onClick={() => move(i, 1)} className={cn(btn, 'w-9 px-0 text-slate-500 hover:text-slate-900')}>
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button type="button" disabled={pending} onClick={() => setEditing(f.id)} className={cn(btn, 'text-slate-700 hover:text-brand-700')}>
                        <Pencil className="h-3.5 w-3.5" />
                        {t.edit}
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        data-testid={`toggle-${f.key}`}
                        onClick={() => act(() => updateFieldAction(f.id, { active: !f.active }))}
                        className={cn(btn, f.active ? 'text-danger-600' : 'text-success-700')}
                      >
                        {f.active ? t.turnOff : t.turnOn}
                      </button>
                    </div>
                  </li>
                ),
              )}
            </ul>
          )}
          <p className="mt-3 text-[11.5px] text-slate-400">{t.offHint}</p>
        </section>

        <section className={card}>
          <h2 className="font-heading text-[15px] font-bold text-slate-900">{t.fixedTitle}</h2>
          <p className="mt-1 text-[12.5px] text-slate-500">{t.fixedHint}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {[...t.fixedBase, ...FIXED_DETAILS.map((d) => (locale === 'en' ? d.en : d.ar))].map((n) => (
              <span key={n} className="rounded-full bg-surface-muted px-2.5 py-1 text-[12px] text-slate-600 ring-1 ring-inset ring-hairline">
                {n}
              </span>
            ))}
          </div>
        </section>
      </div>

      <AddField t={t} pending={pending} onAdd={(input, done) => act(() => createFieldAction(input), done)} />
    </div>
  );
}

type Msgs = (typeof T)['ar'];

function AddField({
  t,
  pending,
  onAdd,
}: {
  t: Msgs;
  pending: boolean;
  onAdd: (input: { ar: string; en: string; type: CustomerFieldType; key?: string; options?: string[] }, done: () => void) => void;
}) {
  const [ar, setAr] = useState('');
  const [en, setEn] = useState('');
  const [type, setType] = useState<CustomerFieldType>('TEXT');
  const [options, setOptions] = useState('');
  const [key, setKey] = useState('');
  const reset = () => {
    setAr('');
    setEn('');
    setType('TEXT');
    setOptions('');
    setKey('');
  };
  return (
    <section className={cn(card, 'xl:sticky xl:top-4')} data-testid="field-add">
      <h2 className="font-heading text-[15px] font-bold text-slate-900">{t.addTitle}</h2>
      <div className="mt-4 flex flex-col gap-3.5">
        <label className="flex flex-col gap-1.5">
          <span className={label}>{t.ar}</span>
          <input value={ar} maxLength={100} onChange={(e) => setAr(e.target.value)} className={input} data-testid="field-ar" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={label}>{t.en}</span>
          <input value={en} maxLength={100} dir="ltr" onChange={(e) => setEn(e.target.value)} className={input} data-testid="field-en" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={label}>{t.type}</span>
          <select value={type} onChange={(e) => setType(e.target.value as CustomerFieldType)} className={input} data-testid="field-type">
            {TYPES.map((x) => (
              <option key={x} value={x}>
                {t.types[x]}
              </option>
            ))}
          </select>
        </label>
        {type === 'SELECT' && (
          <label className="flex flex-col gap-1.5">
            <span className={label}>{t.options}</span>
            <textarea value={options} rows={4} onChange={(e) => setOptions(e.target.value)} className={cn(input, 'h-auto py-2 leading-relaxed')} data-testid="field-options" />
          </label>
        )}
        <label className="flex flex-col gap-1.5">
          <span className={label}>{t.key}</span>
          <input value={key} maxLength={40} dir="ltr" onChange={(e) => setKey(e.target.value)} className={cn(input, 'font-mono')} data-testid="field-key" />
          <span className="text-[11px] leading-relaxed text-slate-400">{t.keyHint}</span>
        </label>
        <button
          type="button"
          disabled={pending || !ar.trim() || !en.trim()}
          data-testid="field-submit"
          onClick={() =>
            onAdd(
              {
                ar: ar.trim(),
                en: en.trim(),
                type,
                ...(key.trim() ? { key: key.trim() } : {}),
                ...(type === 'SELECT' ? { options: lines(options) } : {}),
              },
              reset,
            )
          }
          className={cn(btn, 'h-10 bg-navy-band text-[#F4ECD8]')}
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {t.add}
        </button>
      </div>
    </section>
  );
}

function EditRow({
  f,
  t,
  pending,
  onCancel,
  onSave,
}: {
  f: CustomerFieldDef;
  t: Msgs;
  pending: boolean;
  onCancel: () => void;
  onSave: (patch: { ar: string; en: string; options?: string[] }) => void;
}) {
  const [ar, setAr] = useState(f.label.ar);
  const [en, setEn] = useState(f.label.en);
  const [options, setOptions] = useState(f.options.join('\n'));
  return (
    <li className="flex flex-col gap-3 bg-surface-muted/50 px-4 py-4" data-testid={`field-edit-${f.key}`}>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className={label}>{t.ar}</span>
          <input value={ar} maxLength={100} onChange={(e) => setAr(e.target.value)} className={input} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={label}>{t.en}</span>
          <input value={en} maxLength={100} dir="ltr" onChange={(e) => setEn(e.target.value)} className={input} />
        </label>
        {f.type === 'SELECT' && (
          <label className="flex flex-col gap-1.5 md:col-span-2">
            <span className={label}>{t.options}</span>
            <textarea value={options} rows={4} onChange={(e) => setOptions(e.target.value)} className={cn(input, 'h-auto py-2 leading-relaxed')} />
          </label>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending || !ar.trim() || !en.trim()}
          onClick={() => onSave({ ar: ar.trim(), en: en.trim(), ...(f.type === 'SELECT' ? { options: lines(options) } : {}) })}
          className={cn(btn, 'bg-navy-band text-[#F4ECD8]')}
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          {t.save}
        </button>
        <button type="button" onClick={onCancel} className={cn(btn, 'text-slate-600')}>
          <X className="h-3.5 w-3.5" />
          {t.cancel}
        </button>
        <span className="text-[11.5px] text-slate-400">{t.fixedNote}</span>
      </div>
    </li>
  );
}
