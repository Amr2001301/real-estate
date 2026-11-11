'use client';

import { useState, useTransition, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Plus, Sparkles, Trash2, Wand2 } from 'lucide-react';
import type { AmenityGroup, AmenityIcon } from '@rep/shared-types';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/toast';
import { AMENITY_ICON_COMPONENTS, AmenityIconView } from '@/components/projects/amenity-icons';
import type { Locale } from '@/lib/locale';
import { pcT } from '@/messages/project-content';
import { saveProjectContentAction, suggestProjectContentAction, type ProjectContentPatch } from './actions';

type Text = { ar: string; en: string };
export interface ProjectContent {
  sections: Array<{ title: Text; body: Text }>;
  faqs: Array<{ question: Text; answer: Text }>;
  amenities: Array<{ name: Text; icon: AmenityIcon; group: AmenityGroup }>;
  progressStages: Array<{ name: Text; percent: number }>;
  progressUpdatedAt: string | null;
}
export type ContentTab = 'sections' | 'amenities' | 'faqs' | 'progress';

/** Every icon key the API accepts — the map's keys (its type makes it complete). */
const ICONS = Object.keys(AMENITY_ICON_COMPONENTS) as AmenityIcon[];
const blank = (): Text => ({ ar: '', en: '' });

/** Move an item one place up or down. */
function move<T>(list: T[], i: number, by: -1 | 1): T[] {
  const j = i + by;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

/**
 * «محتوى صفحة المشروع»: one tab per list (sections, amenities, FAQ, construction
 * progress). Each list is edited in place and saved on its own — a save
 * replaces that list whole.
 */
export function ProjectContentEditor({
  projectId,
  projectName,
  tab,
  initial,
  locale,
}: {
  projectId: string;
  projectName: Text;
  tab: ContentTab;
  initial: ProjectContent;
  locale: Locale;
}) {
  const t = pcT(locale);
  const toast = useToast();
  const [pending, start] = useTransition();
  const [sections, setSections] = useState(initial.sections);
  const [faqs, setFaqs] = useState(initial.faqs);
  const [amenities, setAmenities] = useState(initial.amenities);
  const [stages, setStages] = useState(initial.progressStages);
  const [notify, setNotify] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(initial.progressUpdatedAt);

  const save = (patch: ProjectContentPatch) =>
    start(async () => {
      const r = await saveProjectContentAction(projectId, patch);
      if (!r.ok) {
        toast.show({ tone: 'danger', title: t.errors.save, description: r.error });
        return;
      }
      if ('progressStages' in patch) setUpdatedAt(new Date().toISOString());
      toast.show({
        tone: 'success',
        title: t.saved,
        description: r.notifiedOwners ? t.progress.notified(r.notifiedOwners) : undefined,
      });
      setNotify(false);
    });

  const trimmed = (x: Text): Text => ({ ar: x.ar.trim(), en: x.en.trim() });

  // «املأ من بيانات المشروع»: the project's records fill the empty places of
  // this tab only (new sections, unanswered or missing questions, plain-tick
  // icons); nothing is saved until the admin reviews and saves.
  const [filling, startFill] = useTransition();
  const fill = (which: 'sections' | 'faqs' | 'amenities') =>
    startFill(async () => {
      const s = await suggestProjectContentAction(projectId);
      if (!s) {
        toast.show({ tone: 'danger', title: t.autofill.failed });
        return;
      }
      const key = (x: Text) => x.ar.trim();
      let n = 0;
      if (which === 'sections') {
        const have = new Set(sections.map((x) => key(x.title)));
        const add = s.sections.filter((x) => !have.has(key(x.title)));
        n = add.length;
        if (n) setSections([...sections, ...add]);
      } else if (which === 'faqs') {
        const byQ = new Map(s.faqs.map((f) => [key(f.question), f]));
        const next = faqs.map((f) => {
          const hit = byQ.get(key(f.question));
          if (hit && !f.answer.ar.trim() && !f.answer.en.trim()) {
            n += 1;
            return { ...f, answer: hit.answer };
          }
          return f;
        });
        const have = new Set(faqs.map((f) => key(f.question)));
        const add = s.faqs.filter((f) => !have.has(key(f.question)));
        n += add.length;
        if (n) setFaqs([...next, ...add]);
      } else {
        const iconBy = new Map(s.amenities.map((a) => [key(a.name), a.icon as AmenityIcon]));
        const next = amenities.map((a) => {
          const icon = iconBy.get(key(a.name));
          if (a.icon === 'check' && icon && icon !== 'check') {
            n += 1;
            return { ...a, icon };
          }
          return a;
        });
        if (n) setAmenities(next);
      }
      toast.show(n ? { tone: 'success', title: t.autofill.filled(n) } : { tone: 'info', title: t.autofill.nothing });
    });
  const fillButton = (which: 'sections' | 'faqs' | 'amenities') => (
    <Button type="button" variant="subtle" size="sm" onClick={() => fill(which)} disabled={filling} title={t.autofill.hint} data-testid="content-autofill">
      <Wand2 className="h-4 w-4" aria-hidden />
      {t.autofill.button}
    </Button>
  );

  if (tab === 'sections') {
    return (
      <ListPanel
        hint={t.sections.hint}
        empty={t.empty}
        count={sections.length}
        addLabel={t.sections.add}
        onAdd={() => setSections([...sections, { title: blank(), body: blank() }])}
        extra={fillButton('sections')}
        saveLabel={pending ? t.saving : t.save}
        saving={pending}
        onSave={() =>
          save({ sections: sections.filter((s) => s.title.ar.trim() || s.title.en.trim()).map((s) => ({ title: trimmed(s.title), body: trimmed(s.body) })) })
        }
      >
        {sections.map((s, i) => (
          <Row key={i} index={i} total={sections.length} t={t} onMove={(by) => setSections(move(sections, i, by))} onRemove={() => setSections(sections.filter((_, k) => k !== i))}>
            <Pair label={t.sections.title} t={t} value={s.title} onChange={(v) => setSections(sections.map((x, k) => (k === i ? { ...x, title: v } : x)))} />
            <Pair label={t.sections.body} t={t} value={s.body} multiline onChange={(v) => setSections(sections.map((x, k) => (k === i ? { ...x, body: v } : x)))} />
          </Row>
        ))}
      </ListPanel>
    );
  }

  if (tab === 'faqs') {
    const name = projectName.ar || projectName.en;
    const useTemplate = () => {
      const ar = t.faqTemplate(projectName.ar || name);
      const en = t.faqTemplateEn(projectName.en || name);
      const have = new Set(faqs.map((f) => f.question.ar.trim()));
      setFaqs([
        ...faqs,
        ...ar
          .map((q, k) => ({ question: { ar: q.q, en: en[k]?.q ?? '' }, answer: blank() }))
          .filter((f) => !have.has(f.question.ar)),
      ]);
    };
    return (
      <ListPanel
        hint={t.faqs.hint}
        empty={t.empty}
        count={faqs.length}
        addLabel={t.faqs.add}
        onAdd={() => setFaqs([...faqs, { question: blank(), answer: blank() }])}
        extra={
          <>
            {fillButton('faqs')}
            <Button type="button" variant="subtle" size="sm" onClick={useTemplate} title={t.faqs.templateHint}>
              <Sparkles className="h-4 w-4" aria-hidden />
              {t.faqs.template}
            </Button>
          </>
        }
        saveLabel={pending ? t.saving : t.save}
        saving={pending}
        onSave={() =>
          save({ faqs: faqs.filter((f) => f.question.ar.trim() || f.question.en.trim()).map((f) => ({ question: trimmed(f.question), answer: trimmed(f.answer) })) })
        }
      >
        {faqs.map((f, i) => (
          <Row key={i} index={i} total={faqs.length} t={t} onMove={(by) => setFaqs(move(faqs, i, by))} onRemove={() => setFaqs(faqs.filter((_, k) => k !== i))}>
            <Pair label={t.faqs.question} t={t} value={f.question} onChange={(v) => setFaqs(faqs.map((x, k) => (k === i ? { ...x, question: v } : x)))} />
            <Pair label={t.faqs.answer} t={t} value={f.answer} multiline onChange={(v) => setFaqs(faqs.map((x, k) => (k === i ? { ...x, answer: v } : x)))} />
          </Row>
        ))}
      </ListPanel>
    );
  }

  if (tab === 'amenities') {
    return (
      <ListPanel
        hint={t.amenities.hint}
        empty={t.empty}
        count={amenities.length}
        addLabel={t.amenities.add}
        onAdd={() => setAmenities([...amenities, { name: blank(), icon: 'check', group: 'INSIDE' }])}
        extra={amenities.length ? fillButton('amenities') : undefined}
        saveLabel={pending ? t.saving : t.save}
        saving={pending}
        onSave={() => save({ amenities: amenities.filter((a) => a.name.ar.trim() || a.name.en.trim()).map((a) => ({ ...a, name: trimmed(a.name) })) })}
      >
        {amenities.map((a, i) => {
          const set = (patch: Partial<(typeof amenities)[number]>) => setAmenities(amenities.map((x, k) => (k === i ? { ...x, ...patch } : x)));
          return (
            <Row key={i} index={i} total={amenities.length} t={t} onMove={(by) => setAmenities(move(amenities, i, by))} onRemove={() => setAmenities(amenities.filter((_, k) => k !== i))}>
              <Pair label={t.amenities.name} t={t} value={a.name} onChange={(v) => set({ name: v })} />
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-slate-700">{t.amenities.group}</span>
                <div className="inline-flex w-fit gap-1 rounded-xl bg-slate-100 p-1" role="group">
                  {(['INSIDE', 'AROUND'] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => set({ group: g })}
                      aria-pressed={a.group === g}
                      className={cn('rounded-lg px-3 py-1.5 text-sm font-medium', a.group === g ? 'bg-surface text-navy shadow-xs' : 'text-slate-500 hover:text-slate-800')}
                    >
                      {t.amenities.groups[g]}
                    </button>
                  ))}
                </div>
              </div>
              <IconPicker label={t.amenities.icon} changeLabel={t.amenities.change} value={a.icon} onChange={(icon) => set({ icon })} />
            </Row>
          );
        })}
      </ListPanel>
    );
  }

  // Construction progress.
  const overall = stages.length ? Math.round(stages.reduce((s, x) => s + x.percent, 0) / stages.length) : null;
  return (
    <ListPanel
      hint={t.progress.hint}
      empty={t.empty}
      count={stages.length}
      addLabel={t.progress.add}
      onAdd={() => setStages([...stages, { name: blank(), percent: 0 }])}
      extra={
        stages.length === 0 ? (
          <Button
            type="button"
            variant="subtle"
            size="sm"
            onClick={() => setStages(t.progress.suggested.map((ar, k) => ({ name: { ar, en: t.progress.suggestedEn[k] ?? '' }, percent: 0 })))}
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            {t.progress.useSuggested}
          </Button>
        ) : undefined
      }
      header={
        overall !== null ? (
          <div className="rounded-2xl border border-hairline bg-slate-50 px-5 py-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-navy">{t.progress.overall}</span>
              <span className="font-bold text-navy">{overall}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
              <span className="block h-full rounded-full bg-brand-600" style={{ width: `${overall}%` }} />
            </div>
            {updatedAt && <p className="mt-2 text-xs text-slate-500">{t.progress.updatedAt(new Date(updatedAt).toLocaleDateString(locale === 'en' ? 'en-GB' : 'ar-EG-u-nu-latn'))}</p>}
          </div>
        ) : undefined
      }
      footer={
        <label className="flex items-start gap-2.5 text-sm text-slate-700">
          <Checkbox checked={notify} onChange={(e) => setNotify(e.target.checked)} className="mt-0.5" />
          <span>
            <span className="font-medium">{t.progress.notify}</span>
            <span className="block text-xs text-slate-500">{t.progress.notifyHint}</span>
          </span>
        </label>
      }
      saveLabel={pending ? t.saving : t.save}
      saving={pending}
      onSave={() =>
        save({
          progressStages: stages
            .filter((s) => s.name.ar.trim() || s.name.en.trim())
            .map((s) => ({ name: trimmed(s.name), percent: Math.max(0, Math.min(100, Math.round(s.percent))) })),
          notifyOwners: notify,
        })
      }
    >
      {stages.map((s, i) => (
        <Row key={i} index={i} total={stages.length} t={t} onMove={(by) => setStages(move(stages, i, by))} onRemove={() => setStages(stages.filter((_, k) => k !== i))}>
          <Pair label={t.progress.stage} t={t} value={s.name} onChange={(v) => setStages(stages.map((x, k) => (k === i ? { ...x, name: v } : x)))} />
          <div className="flex items-center gap-3">
            <label className="w-28 shrink-0 text-sm font-medium text-slate-700" htmlFor={`stage-${i}-pct`}>
              {t.progress.percent}
            </label>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={s.percent}
              onChange={(e) => setStages(stages.map((x, k) => (k === i ? { ...x, percent: Number(e.target.value) } : x)))}
              className="flex-1 accent-brand-600"
              aria-label={t.progress.percent}
            />
            <Input
              id={`stage-${i}-pct`}
              type="number"
              min={0}
              max={100}
              value={s.percent}
              onChange={(e) => setStages(stages.map((x, k) => (k === i ? { ...x, percent: Number(e.target.value) || 0 } : x)))}
              className="w-20"
            />
          </div>
        </Row>
      ))}
    </ListPanel>
  );
}

function ListPanel({
  hint,
  empty,
  count,
  addLabel,
  onAdd,
  extra,
  header,
  footer,
  saveLabel,
  saving,
  onSave,
  children,
}: {
  hint: string;
  empty: string;
  count: number;
  addLabel: string;
  onAdd: () => void;
  extra?: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  saveLabel: string;
  saving: boolean;
  onSave: () => void;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-[22px] border border-hairline bg-surface p-5 sm:p-7">
      <p className="text-sm text-slate-500">{hint}</p>
      {header}
      {count === 0 ? <p className="rounded-xl border border-dashed border-hairline px-4 py-8 text-center text-sm text-slate-400">{empty}</p> : <ol className="flex flex-col gap-3">{children}</ol>}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onAdd}>
          <Plus className="h-4 w-4" aria-hidden />
          {addLabel}
        </Button>
        {extra}
      </div>
      {footer}
      <div className="flex justify-end border-t border-hairline pt-4">
        <Button type="button" onClick={onSave} disabled={saving}>
          {saveLabel}
        </Button>
      </div>
    </section>
  );
}

function Row({
  index,
  total,
  t,
  onMove,
  onRemove,
  children,
}: {
  index: number;
  total: number;
  t: ReturnType<typeof pcT>;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
  children: ReactNode;
}) {
  return (
    <li className="flex gap-3 rounded-2xl border border-hairline p-4">
      <div className="flex shrink-0 flex-col items-center gap-1 pt-1">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">{index + 1}</span>
        <button type="button" onClick={() => onMove(-1)} disabled={index === 0} aria-label={t.up} className="rounded p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30">
          <ArrowUp className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => onMove(1)} disabled={index === total - 1} aria-label={t.down} className="rounded p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30">
          <ArrowDown className="h-4 w-4" />
        </button>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3">{children}</div>
      <button type="button" onClick={onRemove} aria-label={t.remove} className="self-start rounded-lg p-2 text-slate-400 hover:bg-danger-50 hover:text-danger-600">
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}

function Pair({
  label,
  t,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  t: ReturnType<typeof pcT>;
  value: Text;
  onChange: (v: Text) => void;
  multiline?: boolean;
}) {
  const Field = multiline ? Textarea : Input;
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1 text-sm font-medium text-slate-700">{label}</legend>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <Field
          aria-label={`${label} — ${t.ar}`}
          placeholder={t.ar}
          dir="rtl"
          value={value.ar}
          onChange={(e: { target: { value: string } }) => onChange({ ...value, ar: e.target.value })}
          {...(multiline ? { rows: 3 } : {})}
        />
        <Field
          aria-label={`${label} — ${t.en}`}
          placeholder={t.en}
          dir="ltr"
          value={value.en}
          onChange={(e: { target: { value: string } }) => onChange({ ...value, en: e.target.value })}
          {...(multiline ? { rows: 3 } : {})}
        />
      </div>
    </fieldset>
  );
}

/** The amenity's icon, with the full set opening on «تغيير» (one row stays short). */
function IconPicker({ label, changeLabel, value, onChange }: { label: string; changeLabel: string; value: AmenityIcon; onChange: (v: AmenityIcon) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="flex items-center gap-2">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-brand-600 bg-brand-50 text-brand-700">
          <AmenityIconView icon={value} className="h-5 w-5" />
        </span>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(!open)} aria-expanded={open}>
          {changeLabel}
        </Button>
      </div>
      {open && (
        <div className="flex flex-wrap gap-1.5 rounded-xl border border-hairline p-2" role="radiogroup" aria-label={label}>
          {ICONS.map((key) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={value === key}
              aria-label={key}
              title={key}
              onClick={() => {
                onChange(key);
                setOpen(false);
              }}
              className={cn(
                'inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors',
                value === key ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800',
              )}
            >
              <AmenityIconView icon={key} className="h-4 w-4" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
