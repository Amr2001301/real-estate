'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  Check,
  ChevronDown,
  Copy,
  FileText,
  GripVertical,
  Hash,
  List,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Type,
  UserRound,
  X,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import type { Locale } from '@/lib/locale';
import { Dialog } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { FIXED_DETAILS, fieldLabel, type CustomerFieldDef, type CustomerFieldType } from '@/lib/customer-fields';
import { createFieldAction, reorderFieldsAction, updateFieldAction } from '../actions';

const TYPES: CustomerFieldType[] = ['TEXT', 'NUMBER', 'DATE', 'SELECT'];
const TYPE_ICON: Record<CustomerFieldType, typeof Type> = { TEXT: Type, NUMBER: Hash, DATE: Calendar, SELECT: List };

/** Ready-made fields a company often wants, added in one click. */
const PRESETS: Array<{ key: string; ar: string; en: string; type: CustomerFieldType; options?: { ar: string[]; en: string[] } }> = [
  { key: 'spouse_name', ar: 'اسم الزوج / الزوجة', en: 'Spouse name', type: 'TEXT' },
  { key: 'passport_number', ar: 'رقم جواز السفر', en: 'Passport number', type: 'TEXT' },
  { key: 'family_size', ar: 'عدد أفراد الأسرة', en: 'Family size', type: 'NUMBER' },
  { key: 'passport_expiry', ar: 'تاريخ انتهاء الجواز', en: 'Passport expiry', type: 'DATE' },
  {
    key: 'heard_from',
    ar: 'كيف عرف الشركة؟',
    en: 'How they heard of us',
    type: 'SELECT',
    options: {
      ar: ['فيسبوك', 'إنستجرام', 'صديق', 'معرض', 'إعلان طرق', 'أخرى'],
      en: ['Facebook', 'Instagram', 'A friend', 'An expo', 'A billboard', 'Other'],
    },
  },
];

const T = {
  ar: {
    how: [
      { title: 'أضف الخانة', text: 'مثل «اسم الزوجة» أو «رقم الجواز» — بالنوع المناسب.' },
      { title: 'الموظف يملؤها', text: 'تظهر في بيانات كل عميل عند إضافته أو تعديله.' },
      { title: 'تُطبع في العقد', text: 'اكتب كود الخانة في قالب العقد فيُستبدل بقيمتها.' },
    ],
    listTitle: 'خاناتك',
    count: (n: number) => (n === 1 ? 'خانة واحدة' : n === 2 ? 'خانتان' : `${n} خانات`),
    addField: 'إضافة خانة',
    emptyTitle: 'لم تُضف خانات بعد',
    emptyText: 'ابدأ بخانة جاهزة بضغطة واحدة، أو أضف خانة خاصة بك.',
    presets: 'خانات جاهزة',
    presetsHint: 'اضغط لإضافتها مباشرة',
    printCode: 'كود الطباعة',
    copy: 'نسخ',
    copied: 'تم النسخ',
    on: 'تظهر للموظفين',
    off: 'مخفية',
    offHint: 'الخانة المخفية لا تظهر في بيانات العميل، وتبقى القيم المحفوظة فيها.',
    edit: 'تعديل',
    dragHint: 'اسحب لتغيير الترتيب',
    fixedTitle: 'الخانات الموجودة لكل عميل',
    fixedHint: 'لا تحتاج إضافتها — موجودة في بيانات كل عميل بالفعل.',
    fixedBase: ['الاسم', 'الهاتف', 'البريد', 'الرقم القومي', 'العنوان'],
    dialogAdd: 'خانة جديدة',
    dialogEdit: 'تعديل الخانة',
    ar: 'اسم الخانة بالعربية',
    arPh: 'مثال: اسم الزوجة',
    en: 'اسم الخانة بالإنجليزية',
    enPh: 'e.g. Spouse name',
    type: 'نوع الخانة',
    types: { TEXT: 'نص', NUMBER: 'رقم', DATE: 'تاريخ', SELECT: 'اختيار من قائمة' } as Record<CustomerFieldType, string>,
    typeHint: { TEXT: 'كلمات أو جمل', NUMBER: 'أرقام فقط', DATE: 'يوم من التقويم', SELECT: 'الموظف يختار واحدًا' } as Record<
      CustomerFieldType,
      string
    >,
    options: 'الاختيارات',
    optionsHint: 'اختيار في كل سطر',
    code: 'كود الطباعة في العقود',
    codeHint: 'يُصنع تلقائيًا من الاسم الإنجليزي. اكتبه في قالب العقد ليُطبع مكانه قيمة الخانة.',
    codeFixed: 'النوع والكود ثابتان بعد الإضافة.',
    preview: 'هكذا تظهر للموظف في بيانات العميل',
    previewPick: 'اختر…',
    exampleTitle: 'في قالب العقد',
    exampleBefore: 'السيد/ة … ،',
    exampleAfter: (name: string) => `يُطبع مكانه ما كتبه الموظف في «${name}».`,
    save: 'حفظ',
    add: 'إضافة الخانة',
    cancel: 'إلغاء',
  },
  en: {
    how: [
      { title: 'Add a field', text: 'Like “Spouse name” or “Passport number” — with the right type.' },
      { title: 'Staff fill it', text: 'It shows on every customer when added or edited.' },
      { title: 'It prints on contracts', text: 'Put the field’s code in a contract template; its value prints there.' },
    ],
    listTitle: 'Your fields',
    count: (n: number) => (n === 1 ? '1 field' : `${n} fields`),
    addField: 'Add a field',
    emptyTitle: 'No fields yet',
    emptyText: 'Start from a ready-made field in one click, or add your own.',
    presets: 'Ready-made fields',
    presetsHint: 'Click to add it',
    printCode: 'Print code',
    copy: 'Copy',
    copied: 'Copied',
    on: 'Shown to staff',
    off: 'Hidden',
    offHint: 'A hidden field leaves the customer form; the values saved in it stay.',
    edit: 'Edit',
    dragHint: 'Drag to reorder',
    fixedTitle: 'Fields every customer already has',
    fixedHint: 'No need to add these — every customer has them.',
    fixedBase: ['Name', 'Phone', 'E-mail', 'National ID', 'Address'],
    dialogAdd: 'New field',
    dialogEdit: 'Edit field',
    ar: 'Field name (Arabic)',
    arPh: 'e.g. اسم الزوجة',
    en: 'Field name (English)',
    enPh: 'e.g. Spouse name',
    type: 'Field type',
    types: { TEXT: 'Text', NUMBER: 'Number', DATE: 'Date', SELECT: 'Choice from a list' } as Record<CustomerFieldType, string>,
    typeHint: { TEXT: 'Words or sentences', NUMBER: 'Numbers only', DATE: 'A calendar day', SELECT: 'Staff pick one' } as Record<
      CustomerFieldType,
      string
    >,
    options: 'Choices',
    optionsHint: 'One per line',
    code: 'Print code for contracts',
    codeHint: 'Made from the English name. Put it in a contract template and the field’s value prints there.',
    codeFixed: 'The type and the code stay as added.',
    preview: 'How staff see it on the customer form',
    previewPick: 'Choose…',
    exampleTitle: 'In a contract template',
    exampleBefore: 'Mr/Mrs …,',
    exampleAfter: (name: string) => `Prints what staff entered in “${name}”.`,
    save: 'Save',
    add: 'Add field',
    cancel: 'Cancel',
  },
};
type Msgs = (typeof T)['ar'];

/** The code the API makes from an English name: "Spouse name" → spouse_name. */
function keyFromLabel(en: string): string {
  return en
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^[^a-z]+/, '')
    .replace(/_+$/, '')
    .slice(0, 40)
    .replace(/_+$/, '');
}
const codeOf = (key: string) => `{{custom.${key}}}`;

const lines = (v: string) =>
  v
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

const card = 'rounded-[22px] border border-hairline bg-surface shadow-[0_18px_40px_-30px_rgb(20_26_38/0.35)]';
const inputCls =
  'h-11 w-full rounded-xl border border-hairline bg-surface px-3.5 text-[13.5px] text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-brand-400/70 focus:ring-4 focus:ring-brand-500/10';
const primaryBtn =
  'inline-flex h-10 items-center justify-center gap-2 rounded-full bg-navy-band px-5 text-[13px] font-semibold text-[#F4ECD8] transition-opacity disabled:opacity-50';

function CopyCode({ code, t }: { code: string; t: Msgs }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(code).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      title={copied ? t.copied : t.copy}
      className="group inline-flex max-w-full items-center gap-1.5 rounded-lg border border-hairline bg-canvas/60 px-2 py-1 text-[11.5px] text-slate-600 transition-colors hover:border-brand-400/50 hover:text-brand-700"
    >
      <span dir="ltr" className="truncate font-mono">
        {code}
      </span>
      {copied ? <Check className="h-3 w-3 shrink-0 text-success-600" /> : <Copy className="h-3 w-3 shrink-0" />}
    </button>
  );
}

export function CustomerFieldsManager({ fields, locale }: { fields: CustomerFieldDef[]; locale: Locale }) {
  const t = T[locale === 'en' ? 'en' : 'ar'];
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // null: closed; 'new': adding; a field: editing it.
  const [dialog, setDialog] = useState<null | 'new' | CustomerFieldDef>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [showFixed, setShowFixed] = useState(false);

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) return setError(r.error ?? '');
      after?.();
      router.refresh();
    });

  const dropOn = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const ids = fields.map((f) => f.id).filter((id) => id !== dragId);
    ids.splice(ids.indexOf(targetId), 0, dragId);
    setDragId(null);
    act(() => reorderFieldsAction(ids));
  };

  const taken = new Set(fields.map((f) => f.key));
  const presets = PRESETS.filter((p) => !taken.has(p.key));
  const lang = locale === 'en' ? 'en' : 'ar';

  return (
    <div className="flex flex-col gap-5">
      {/* ── How it works ── */}
      <ol className="grid gap-3 md:grid-cols-3" data-testid="fields-how">
        {t.how.map((s, i) => {
          const Icon = [Plus, UserRound, FileText][i]!;
          return (
            <li key={s.title} className={cn(card, 'flex items-start gap-3.5 p-5')}>
              <span className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-navy-band text-[#D8B66A]">
                <Icon className="h-[18px] w-[18px]" />
                <span className="absolute -top-1.5 -start-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-[10.5px] font-bold text-[#1A1406]">
                  {i + 1}
                </span>
              </span>
              <div>
                <p className="text-[14px] font-bold text-slate-900">{s.title}</p>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-slate-500">{s.text}</p>
              </div>
            </li>
          );
        })}
      </ol>

      {/* ── The company's fields ── */}
      <section className={cn(card, 'p-6')} data-testid="customer-fields">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-heading text-[18px] font-bold text-slate-900">{t.listTitle}</h2>
            {fields.length > 0 && <p className="mt-0.5 text-[12.5px] text-slate-500">{t.count(fields.length)}</p>}
          </div>
          <button type="button" onClick={() => setDialog('new')} className={primaryBtn} data-testid="field-new">
            <Plus className="h-4 w-4" />
            {t.addField}
          </button>
        </header>

        {error && <p className="mt-4 rounded-xl bg-danger-50 px-4 py-2.5 text-[12.5px] text-danger-700">{error}</p>}

        {fields.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-brand-400/40 bg-brand-50/30 px-6 py-8 text-center">
            <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-navy-band text-[#D8B66A]">
              <Sparkles className="h-5 w-5" />
            </span>
            <p className="mt-3 text-[15px] font-bold text-slate-900">{t.emptyTitle}</p>
            <p className="mt-1 text-[13px] text-slate-500">{t.emptyText}</p>
          </div>
        ) : (
          <ul className="mt-5 flex flex-col gap-2.5">
            {fields.map((f) => {
              const Icon = TYPE_ICON[f.type];
              return (
                <li
                  key={f.id}
                  data-testid={`field-${f.key}`}
                  draggable
                  onDragStart={() => setDragId(f.id)}
                  onDragEnd={() => setDragId(null)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => dropOn(f.id)}
                  className={cn(
                    'group flex flex-wrap items-center gap-3 rounded-2xl border border-hairline bg-surface px-3 py-3 transition-[opacity,box-shadow] sm:flex-nowrap',
                    dragId === f.id && 'opacity-40',
                    dragId && dragId !== f.id && 'hover:shadow-[0_0_0_2px_rgb(200_162_75/0.5)]',
                  )}
                >
                  <span title={t.dragHint} className="cursor-grab text-slate-300 group-hover:text-slate-500 active:cursor-grabbing">
                    <GripVertical className="h-4 w-4" />
                  </span>
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <div className={cn('min-w-0 flex-1', !f.active && 'opacity-55')}>
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-[14.5px] font-bold text-slate-900">{fieldLabel(f, locale)}</span>
                      <span className="text-[12px] text-slate-400">{fieldLabel(f, lang === 'en' ? 'ar' : 'en')}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-slate-500">
                      <span>{t.types[f.type]}</span>
                      {f.type === 'SELECT' && f.options.length > 0 && (
                        <span className="truncate text-slate-400">· {f.options.slice(0, 4).join('، ')}{f.options.length > 4 ? '…' : ''}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex w-full items-center gap-3 ps-7 sm:w-auto sm:ps-0">
                    <div className="hidden min-w-0 md:block">
                      <p className="mb-0.5 text-[10.5px] font-semibold text-slate-400">{t.printCode}</p>
                      <CopyCode code={codeOf(f.key)} t={t} />
                    </div>
                    <label className="flex items-center gap-2 text-[12px] font-semibold text-slate-600">
                      <Switch
                        checked={f.active}
                        disabled={pending}
                        data-testid={`toggle-${f.key}`}
                        label={f.active ? t.on : t.off}
                        onCheckedChange={(active) => act(() => updateFieldAction(f.id, { active }))}
                      />
                      <span className="min-w-[92px] whitespace-nowrap">{f.active ? t.on : t.off}</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setDialog(f)}
                      title={t.edit}
                      aria-label={t.edit}
                      className="ms-auto inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-brand-50 hover:text-brand-700"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* Ready-made fields not added yet */}
        {presets.length > 0 && (
          <div className="mt-5" data-testid="field-presets">
            <p className="text-[12.5px] font-bold text-slate-700">
              {t.presets} <span className="font-normal text-slate-400">— {t.presetsHint}</span>
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {presets.map((p) => {
                const Icon = TYPE_ICON[p.type];
                return (
                  <button
                    key={p.key}
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      act(() =>
                        createFieldAction({ ar: p.ar, en: p.en, type: p.type, key: p.key, ...(p.options ? { options: p.options[lang] } : {}) }),
                      )
                    }
                    className="inline-flex items-center gap-2 rounded-full border border-dashed border-brand-400/50 bg-surface px-3.5 py-2 text-[12.5px] font-semibold text-slate-700 transition-colors hover:border-solid hover:bg-brand-50 hover:text-brand-700 disabled:opacity-50"
                  >
                    <Plus className="h-3.5 w-3.5 text-brand-700" />
                    {lang === 'en' ? p.en : p.ar}
                    <Icon className="h-3.5 w-3.5 text-slate-400" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {fields.some((f) => !f.active) && <p className="mt-4 text-[11.5px] text-slate-400">{t.offHint}</p>}
      </section>

      {/* ── What every customer already has ── */}
      <section className={cn(card, 'px-6 py-4')}>
        <button type="button" onClick={() => setShowFixed((v) => !v)} className="flex w-full items-center justify-between gap-3 text-start">
          <span>
            <span className="block text-[13.5px] font-bold text-slate-800">{t.fixedTitle}</span>
            <span className="block text-[12px] text-slate-500">{t.fixedHint}</span>
          </span>
          <ChevronDown className={cn('h-4 w-4 shrink-0 text-slate-400 transition-transform', showFixed && 'rotate-180')} />
        </button>
        {showFixed && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {[...t.fixedBase, ...FIXED_DETAILS.map((d) => (lang === 'en' ? d.en : d.ar))].map((n) => (
              <span key={n} className="rounded-full bg-surface-muted px-2.5 py-1 text-[12px] text-slate-600 ring-1 ring-inset ring-hairline">
                {n}
              </span>
            ))}
          </div>
        )}
      </section>

      {dialog && (
        <FieldDialog
          key={dialog === 'new' ? 'new' : dialog.id}
          t={t}
          field={dialog === 'new' ? null : dialog}
          pending={pending}
          error={error}
          onClose={() => {
            setDialog(null);
            setError(null);
          }}
          onSubmit={(input) =>
            dialog === 'new'
              ? act(() => createFieldAction(input), () => setDialog(null))
              : act(
                  () =>
                    updateFieldAction(dialog.id, {
                      ar: input.ar,
                      en: input.en,
                      ...(dialog.type === 'SELECT' ? { options: input.options ?? [] } : {}),
                    }),
                  () => setDialog(null),
                )
          }
        />
      )}
    </div>
  );
}

function FieldDialog({
  t,
  field,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  t: Msgs;
  field: CustomerFieldDef | null;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (input: { ar: string; en: string; type: CustomerFieldType; key?: string; options?: string[] }) => void;
}) {
  const [ar, setAr] = useState(field?.label.ar ?? '');
  const [en, setEn] = useState(field?.label.en ?? '');
  const [type, setType] = useState<CustomerFieldType>(field?.type ?? 'TEXT');
  const [options, setOptions] = useState(field?.options.join('\n') ?? '');
  const key = field?.key ?? keyFromLabel(en);
  const opts = lines(options);
  const ready = !!ar.trim() && !!en.trim() && (type !== 'SELECT' || opts.length > 0);

  return (
    <Dialog open onClose={onClose} title={field ? t.dialogEdit : t.dialogAdd} size="lg">
      <form
        data-testid="field-add"
        className="grid gap-6 px-6 py-5 md:grid-cols-[minmax(0,1fr)_260px]"
        onSubmit={(e) => {
          e.preventDefault();
          if (!ready) return;
          onSubmit({ ar: ar.trim(), en: en.trim(), type, ...(type === 'SELECT' ? { options: opts } : {}) });
        }}
      >
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-bold text-slate-700">{t.ar}</span>
            <input autoFocus value={ar} maxLength={100} placeholder={t.arPh} onChange={(e) => setAr(e.target.value)} className={inputCls} data-testid="field-ar" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-bold text-slate-700">{t.en}</span>
            <input value={en} maxLength={100} dir="ltr" placeholder={t.enPh} onChange={(e) => setEn(e.target.value)} className={inputCls} data-testid="field-en" />
          </label>

          <fieldset disabled={!!field}>
            <legend className="mb-1.5 text-[12.5px] font-bold text-slate-700">{t.type}</legend>
            <div className="grid grid-cols-2 gap-2" data-testid="field-type">
              {TYPES.map((x) => {
                const Icon = TYPE_ICON[x];
                return (
                  <button
                    key={x}
                    type="button"
                    onClick={() => setType(x)}
                    aria-pressed={type === x}
                    data-testid={`field-type-${x}`}
                    className={cn(
                      'flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-start transition-colors disabled:cursor-not-allowed',
                      type === x ? 'border-brand-500 bg-brand-50 shadow-[0_0_0_3px_rgb(200_162_75/0.18)]' : 'border-hairline bg-surface hover:border-brand-400/50',
                      field && type !== x && 'opacity-40',
                    )}
                  >
                    <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', type === x ? 'text-brand-700' : 'text-slate-400')} />
                    <span className="flex-1">
                      <span className="block text-[13px] font-bold text-slate-800">{t.types[x]}</span>
                      <span className="block text-[11.5px] text-slate-500">{t.typeHint[x]}</span>
                    </span>
                    {type === x && <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {type === 'SELECT' && (
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-bold text-slate-700">
                {t.options} <span className="font-normal text-slate-400">— {t.optionsHint}</span>
              </span>
              <textarea
                value={options}
                rows={4}
                onChange={(e) => setOptions(e.target.value)}
                className={cn(inputCls, 'h-auto py-2.5 leading-relaxed')}
                data-testid="field-options"
              />
            </label>
          )}

          <div className="rounded-xl bg-surface-muted/60 px-4 py-3">
            <p className="text-[12.5px] font-bold text-slate-700">{t.code}</p>
            {key ? (
              <div className="mt-1.5">
                <CopyCode code={codeOf(key)} t={t} />
              </div>
            ) : (
              <p dir="ltr" className="mt-1.5 text-start font-mono text-[12px] text-slate-400">
                {codeOf('…')}
              </p>
            )}
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-slate-500">{field ? t.codeFixed : t.codeHint}</p>
          </div>
        </div>

        {/* Live preview: the field as staff see it */}
        <aside className="flex flex-col gap-3">
          <p className="text-[11.5px] font-bold text-slate-500">{t.preview}</p>
          <div className="rounded-2xl border border-hairline bg-canvas/60 p-4">
            <p className="mb-1.5 text-[12.5px] font-semibold text-slate-700">{ar.trim() || t.arPh}</p>
            {type === 'SELECT' ? (
              <div className="flex h-10 items-center justify-between rounded-xl border border-hairline bg-surface px-3 text-[13px] text-slate-400">
                {opts[0] ?? t.previewPick}
                <ChevronDown className="h-4 w-4" />
              </div>
            ) : (
              <div className="flex h-10 items-center justify-between rounded-xl border border-hairline bg-surface px-3 text-[13px] text-slate-400">
                <span>{type === 'NUMBER' ? '0' : type === 'DATE' ? 'dd / mm / yyyy' : ''}</span>
                {type === 'DATE' && <Calendar className="h-4 w-4" />}
              </div>
            )}
          </div>
          {key && (
            <div className="rounded-2xl border border-hairline bg-surface p-4">
              <p className="mb-2 flex items-center gap-1.5 text-[11.5px] font-bold text-slate-500">
                <FileText className="h-3.5 w-3.5" />
                {t.exampleTitle}
              </p>
              <p className="text-[12.5px] leading-loose text-slate-700">
                {t.exampleBefore}{' '}
                <span dir="ltr" className="rounded bg-brand-50 px-1 font-mono text-[11.5px] text-brand-700">
                  {codeOf(key)}
                </span>
              </p>
              <p className="mt-1 text-[11.5px] text-slate-400">{t.exampleAfter(ar.trim() || t.arPh)}</p>
            </div>
          )}
        </aside>

        {error && <p className="rounded-xl bg-danger-50 px-4 py-2.5 text-[12.5px] text-danger-700 md:col-span-2">{error}</p>}

        <div className="flex items-center gap-2 border-t border-hairline pt-4 md:col-span-2">
          <button type="submit" disabled={pending || !ready} className={primaryBtn} data-testid="field-submit">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : field ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {field ? t.save : t.add}
          </button>
          <button type="button" onClick={onClose} className="inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold text-slate-600 hover:text-slate-900">
            <X className="h-4 w-4" />
            {t.cancel}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
