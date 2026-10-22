'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlignCenter, AlignLeft, AlignRight, Bold, Eye, Loader2, PenLine, Plus, Stamp, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { FormOverlay } from '@/components/print/FormOverlay';
import { sampleValues } from '@/lib/document-samples';
import type { CustomerFieldDef } from '@/lib/customer-fields';
import {
  DOCUMENT_PAPER,
  PAPER,
  fieldLabel,
  fillForm,
  formFieldGroups,
  isSignKey,
  signKeysFor,
  type FormDocument,
  type FormField,
  type FormLayout,
  type PaperSize,
} from '@/lib/form-layout';
import { deleteFormAction, saveFormAction } from '../actions';
import { PageUploader } from './page-uploader';

const T = {
  ar: {
    name: 'اسم النموذج',
    namePlaceholder: 'مثال: استمارة الحجز المعتمدة',
    isDefault: { RESERVATION: 'النموذج الافتراضي لاستمارات الحجز', RECEIPT: 'النموذج الافتراضي لإيصالات الدفع' },
    document: 'المستند',
    documents: { RESERVATION: 'استمارة الحجز', RECEIPT: 'إيصال الدفع' },
    paper: 'مقاس الورق',
    papers: { A4: 'A4', A5: 'A5', HALF: 'نص صفحة A4 (بالعرض)' },
    pages: 'صفحات الاستمارة',
    pagesHint: 'ارفع ملف PDF للاستمارة (تُقسَّم صفحاته تلقائياً) أو صورة واضحة لكل صفحة (PNG أو JPEG حتى ٢ ميجابايت). يُفضَّل الاستمارة فارغة.',
    addPage: 'إضافة صفحات (PDF أو صورة)',
    busy: (done: number, total: number) => (total ? `جارٍ رفع الصفحة ${done + 1} من ${total}…` : 'جارٍ قراءة الملف…'),
    page: 'صفحة',
    removePage: 'حذف الصفحة',
    fields: 'الخانات',
    fieldsHint: 'اضغط على خانة لإضافتها، ثم اسحبها لمكانها على الاستمارة وغيّر حجمها من الركن.',
    signatures: 'التوقيعات والختم',
    selected: 'الخانة المحددة',
    noSelection: 'اختر خانة على الاستمارة لتعديلها.',
    size: 'حجم الخط',
    align: 'المحاذاة',
    bold: 'عريض',
    remove: 'حذف الخانة',
    preview: 'معاينة ببيانات تجريبية',
    edit: 'تعديل الأماكن',
    save: 'حفظ النموذج',
    saved: 'تم الحفظ.',
    delete: 'حذف النموذج',
    confirmDelete: 'حذف هذا النموذج؟ يُطبع المستند بالتصميم القياسي.',
    emptyPages: 'ارفع صورة الصفحة الأولى من الاستمارة للبدء.',
    nudge: 'الأسهم تحرك الخانة بدقة، و Shift لخطوة أكبر.',
  },
  en: {
    name: 'Form name',
    namePlaceholder: 'e.g. Approved booking form',
    isDefault: { RESERVATION: 'Default form for booking forms', RECEIPT: 'Default form for payment receipts' },
    document: 'Document',
    documents: { RESERVATION: 'Booking form', RECEIPT: 'Payment receipt' },
    paper: 'Paper size',
    papers: { A4: 'A4', A5: 'A5', HALF: 'Half A4 (landscape)' },
    pages: 'Form pages',
    pagesHint: 'Upload your form as a PDF (its pages are split for you) or a clear image of each page (PNG or JPEG, up to 2 MB). A blank form works best.',
    addPage: 'Add pages (PDF or image)',
    busy: (done: number, total: number) => (total ? `Uploading page ${done + 1} of ${total}…` : 'Reading the file…'),
    page: 'Page',
    removePage: 'Remove page',
    fields: 'Fields',
    fieldsHint: 'Click a field to add it, then drag it into place on the form and resize it from the corner.',
    signatures: 'Signatures & stamp',
    selected: 'Selected field',
    noSelection: 'Select a field on the form to edit it.',
    size: 'Font size',
    align: 'Alignment',
    bold: 'Bold',
    remove: 'Remove field',
    preview: 'Preview with sample data',
    edit: 'Edit positions',
    save: 'Save form',
    saved: 'Saved.',
    delete: 'Delete form',
    confirmDelete: 'Delete this form? The document will print with the standard layout.',
    emptyPages: 'Upload the first page of your form to begin.',
    nudge: 'Arrow keys move the field precisely; Shift for a bigger step.',
  },
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round = (v: number) => Math.round(v * 10000) / 10000;
const newId = () => Math.random().toString(36).slice(2, 10);

type Drag = { id: string; mode: 'move' | 'resize'; startX: number; startY: number; orig: FormField; rect: DOMRect };

export function FormDesigner({
  layout,
  initialDocument = 'RESERVATION',
  customFields,
  locale,
  currency,
  company,
}: {
  layout: FormLayout | null;
  /** A new form's document (from the link that opened it). */
  initialDocument?: FormDocument;
  /** The company's own customer fields: placeable like the others. */
  customFields: CustomerFieldDef[];
  locale: 'ar' | 'en';
  currency: string;
  company: string;
}) {
  const t = T[locale];
  const router = useRouter();
  const [name, setName] = useState(layout?.name ?? '');
  const [isDefault, setIsDefault] = useState(layout?.isDefault ?? true);
  const [documentType, setDocumentType] = useState<FormDocument>(layout?.documentType ?? initialDocument);
  const [paperSize, setPaperSize] = useState<PaperSize>(layout?.paperSize ?? 'A4');
  const paper = PAPER[paperSize];
  const [pages, setPages] = useState(layout?.pages ?? []);
  const [fields, setFields] = useState<FormField[]>(layout?.fields ?? []);
  const [pageIndex, setPageIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [pending, start] = useTransition();
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);

  const selected = fields.find((f) => f.id === selectedId) ?? null;
  const values = useMemo(() => sampleValues(locale, currency, company), [locale, currency, company]);
  const groups = formFieldGroups(documentType, customFields);
  const signKeys = signKeysFor(documentType);
  const label = (key: string) => fieldLabel(key, locale, customFields);

  // A new form's document decides its papers and its signature boxes.
  const chooseDocument = (doc: FormDocument) => {
    setDocumentType(doc);
    if (!DOCUMENT_PAPER[doc].includes(paperSize)) setPaperSize('A4');
    const allowed = signKeysFor(doc) as string[];
    setFields((fs) => fs.filter((f) => !isSignKey(f.key) || allowed.includes(f.key)));
  };
  const update = useCallback((id: string, patch: Partial<FormField>) => {
    setNote(null);
    setFields((fs) => fs.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }, []);

  const addField = (key: string) => {
    const sign = isSignKey(key);
    const f: FormField = {
      id: newId(),
      key,
      page: pageIndex,
      x: 0.35,
      y: 0.45,
      w: sign ? 0.22 : 0.3,
      h: sign ? (key === 'sign.stamp' ? 0.12 : 0.06) : 0.025,
      size: 11,
      align: 'start',
      bold: false,
    };
    setFields((fs) => [...fs, f]);
    setSelectedId(f.id);
    setPreview(false);
    // The palette is long: bring the page with the new field into view.
    requestAnimationFrame(() => pageRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  };

  // Dragging and resizing in fractions of the page.
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const dx = (e.clientX - d.startX) / d.rect.width;
      const dy = (e.clientY - d.startY) / d.rect.height;
      if (d.mode === 'move') {
        update(d.id, {
          x: round(clamp(d.orig.x + dx, 0, 1 - d.orig.w)),
          y: round(clamp(d.orig.y + dy, 0, 1 - d.orig.h)),
        });
      } else {
        update(d.id, {
          w: round(clamp(d.orig.w + dx, 0.01, 1 - d.orig.x)),
          h: round(clamp(d.orig.h + dy, 0.008, 1 - d.orig.y)),
        });
      }
    };
    const up = () => {
      drag.current = null;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [update]);

  // Arrow keys nudge the selected field.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!selected || preview) return;
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      const step = e.shiftKey ? 0.01 : 0.002;
      const moves: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      };
      const m = moves[e.key];
      if (m) {
        e.preventDefault();
        update(selected.id, {
          x: round(clamp(selected.x + m[0], 0, 1 - selected.w)),
          y: round(clamp(selected.y + m[1], 0, 1 - selected.h)),
        });
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        setFields((fs) => fs.filter((f) => f.id !== selected.id));
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [selected, preview, update]);

  const startDrag = (e: React.PointerEvent, f: FormField, mode: Drag['mode']) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(f.id);
    drag.current = { id: f.id, mode, startX: e.clientX, startY: e.clientY, orig: f, rect: pageRef.current!.getBoundingClientRect() };
  };

  const save = () =>
    start(async () => {
      setNote(null);
      const r = await saveFormAction(layout?.id ?? null, { documentType, paperSize, name, pages, fields, isDefault });
      if (!r.ok) return setNote({ ok: false, text: r.error });
      setNote({ ok: true, text: t.saved });
      if (!layout && r.id) router.replace(`/dashboard/company/print/forms/${r.id}`);
      else router.refresh();
    });

  const removePage = (i: number) => {
    setPages((ps) => ps.filter((_, j) => j !== i));
    setFields((fs) => fs.filter((f) => f.page !== i).map((f) => (f.page > i ? { ...f, page: f.page - 1 } : f)));
    setPageIndex(0);
  };

  const card = 'rounded-[22px] border border-hairline bg-surface p-5 shadow-[0_18px_40px_-30px_rgb(20_26_38/0.35)]';
  const chip =
    'rounded-full bg-surface-muted px-2.5 py-1 text-[11.5px] font-medium text-slate-700 ring-1 ring-inset ring-hairline hover:bg-brand-50 hover:text-brand-700';
  const page = pages[pageIndex];

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[300px_minmax(0,1fr)_280px]">
      {/* ── Settings + pages ── */}
      <aside className="flex flex-col gap-4 xl:sticky xl:top-6">
        <section className={card}>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-slate-600">{t.name}</span>
            <input
              value={name}
              maxLength={120}
              placeholder={t.namePlaceholder}
              onChange={(e) => setName(e.target.value)}
              data-testid="form-name"
              className="h-10 rounded-xl border border-hairline bg-surface px-3 text-[13px] outline-none focus:border-brand-400/60"
            />
          </label>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-slate-600">{t.document}</span>
              <select
                value={documentType}
                disabled={!!layout}
                onChange={(e) => chooseDocument(e.target.value as FormDocument)}
                data-testid="form-document"
                className="h-10 rounded-xl border border-hairline bg-surface px-2 text-[13px] outline-none focus:border-brand-400/60 disabled:bg-surface-muted"
              >
                {(Object.keys(DOCUMENT_PAPER) as FormDocument[]).map((d) => (
                  <option key={d} value={d}>
                    {t.documents[d]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-slate-600">{t.paper}</span>
              <select
                value={paperSize}
                disabled={DOCUMENT_PAPER[documentType].length < 2}
                onChange={(e) => setPaperSize(e.target.value as PaperSize)}
                data-testid="form-paper"
                className="h-10 rounded-xl border border-hairline bg-surface px-2 text-[13px] outline-none focus:border-brand-400/60 disabled:bg-surface-muted"
              >
                {DOCUMENT_PAPER[documentType].map((p) => (
                  <option key={p} value={p}>
                    {t.papers[p]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="mt-3 flex items-center gap-2.5">
            <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="h-4 w-4 accent-[#B08A3A]" />
            <span className="text-[12.5px] text-slate-700">{t.isDefault[documentType]}</span>
          </label>
        </section>

        <section className={card} data-testid="form-pages">
          <div className="text-[13px] font-bold text-slate-900">{t.pages}</div>
          <p className="mt-1 text-[11.5px] leading-relaxed text-slate-500">{t.pagesHint}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {pages.map((p, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setPageIndex(i)}
                className={cn(
                  'relative w-14 overflow-hidden rounded-md ring-2',
                  i === pageIndex ? 'ring-[#B08A3A]' : 'ring-hairline',
                )}
                style={{ aspectRatio: `${paper.w} / ${paper.h}` }}
                title={`${t.page} ${i + 1}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
                <span className="absolute inset-x-0 bottom-0 bg-black/50 text-[10px] text-white">{i + 1}</span>
              </button>
            ))}
          </div>
          <div className="mt-3">
            <PageUploader
              label={t.addPage}
              busyLabel={t.busy}
              room={10 - pages.length}
              onError={(text) => setNote({ ok: false, text })}
              onPages={(urls) => {
                setNote(null);
                setPages((ps) => [...ps, ...urls.map((imageUrl) => ({ imageUrl }))]);
                setPageIndex(pages.length);
              }}
            />
          </div>
          {page && pages.length > 1 && (
            <button type="button" onClick={() => removePage(pageIndex)} className="mt-2 text-[12px] font-semibold text-danger-600">
              {t.removePage} {pageIndex + 1}
            </button>
          )}
        </section>

        <section className={card} data-testid="form-palette">
          <div className="text-[13px] font-bold text-slate-900">{t.fields}</div>
          <p className="mt-1 text-[11.5px] leading-relaxed text-slate-500">{t.fieldsHint}</p>
          <div className="mt-3 space-y-2.5">
            {groups.map((g) => (
              <div key={g.ar}>
                <div className="mb-1 text-[11px] font-semibold text-slate-400">{locale === 'en' ? g.en : g.ar}</div>
                <div className="flex flex-wrap gap-1.5">
                  {g.items.map((p) => (
                    <button key={p.key} type="button" disabled={!page} onClick={() => addField(p.key)} data-testid={`add-${p.key}`} className={cn(chip, 'disabled:opacity-40')}>
                      {locale === 'en' ? p.en : p.ar}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div>
              <div className="mb-1 text-[11px] font-semibold text-slate-400">{t.signatures}</div>
              <div className="flex flex-wrap gap-1.5">
                {signKeys.map((k) => (
                  <button key={k} type="button" disabled={!page} onClick={() => addField(k)} data-testid={`add-${k}`} className={cn(chip, 'inline-flex items-center gap-1 disabled:opacity-40')}>
                    {k === 'sign.stamp' ? <Stamp className="h-3 w-3" /> : <PenLine className="h-3 w-3" />}
                    {label(k)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      </aside>

      {/* ── The form ── */}
      <section className={card}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="text-[12px] text-slate-500">{page ? `${t.page} ${pageIndex + 1} / ${pages.length}` : ''}</div>
          {page && (
            <button
              type="button"
              onClick={() => {
                setPreview((v) => !v);
                setSelectedId(null);
              }}
              data-testid="form-preview-toggle"
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-hairline px-3 text-[12px] font-semibold text-slate-700 hover:border-brand-400/50"
            >
              <Eye className="h-3.5 w-3.5" />
              {preview ? t.edit : t.preview}
            </button>
          )}
        </div>
        {!page ? (
          <div
            className="flex items-center justify-center rounded-xl border-2 border-dashed border-hairline text-[13px] text-slate-400"
            style={{ aspectRatio: `${paper.w} / ${paper.h}` }}
          >
            {t.emptyPages}
          </div>
        ) : preview ? (
          <FormOverlay
            pages={[page]}
            fields={fillForm({ fields: fields.filter((f) => f.page === pageIndex).map((f) => ({ ...f, page: 0 })) }, values, {})}
            paperSize={paperSize}
            className="mx-auto max-w-[640px] shadow-lg ring-1 ring-slate-200"
          />
        ) : (
          <div
            ref={pageRef}
            data-testid="form-page"
            onPointerDown={() => setSelectedId(null)}
            className="relative mx-auto w-full max-w-[640px] select-none overflow-hidden bg-white shadow-lg ring-1 ring-slate-200"
            style={{ aspectRatio: `${paper.w} / ${paper.h}` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={page.imageUrl} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full object-fill" />
            {fields
              .filter((f) => f.page === pageIndex)
              .map((f) => (
                <div
                  key={f.id}
                  data-testid="form-field"
                  onPointerDown={(e) => startDrag(e, f, 'move')}
                  className={cn(
                    'absolute flex cursor-move items-center overflow-hidden rounded-[3px] border px-1 text-[10.5px] font-semibold',
                    isSignKey(f.key) ? 'border-dashed border-[#B08A3A] bg-[#C9A24E]/15 text-[#7A5D1E]' : 'border-sky-500 bg-sky-500/15 text-sky-900',
                    f.id === selectedId && 'ring-2 ring-sky-600',
                  )}
                  style={{
                    left: `${f.x * 100}%`,
                    top: `${f.y * 100}%`,
                    width: `${f.w * 100}%`,
                    height: `${f.h * 100}%`,
                    justifyContent: f.align === 'center' ? 'center' : f.align === 'end' ? 'flex-end' : 'flex-start',
                  }}
                >
                  <span className="truncate">{label(f.key)}</span>
                  <span
                    onPointerDown={(e) => startDrag(e, f, 'resize')}
                    className="absolute bottom-0 right-0 h-2.5 w-2.5 cursor-nwse-resize bg-sky-600"
                    data-testid="form-field-resize"
                  />
                </div>
              ))}
          </div>
        )}
        {page && !preview && <p className="mt-2 text-center text-[11px] text-slate-400">{t.nudge}</p>}
      </section>

      {/* ── Field properties + save ── */}
      <aside className="flex flex-col gap-4 xl:sticky xl:top-6">
        <section className={card} data-testid="form-field-props">
          <div className="text-[13px] font-bold text-slate-900">{t.selected}</div>
          {!selected ? (
            <p className="mt-2 text-[12px] text-slate-500">{t.noSelection}</p>
          ) : (
            <div className="mt-3 flex flex-col gap-4">
              <div className="text-[13px] font-semibold text-brand-700">{label(selected.key)}</div>
              {!isSignKey(selected.key) && (
                <>
                  <label className="flex flex-col gap-1.5">
                    <span className="flex justify-between text-[12px] text-slate-600">
                      {t.size} <span className="tabular-nums">{selected.size}pt</span>
                    </span>
                    <input
                      type="range"
                      min={6}
                      max={36}
                      step={0.5}
                      value={selected.size}
                      onChange={(e) => update(selected.id, { size: Number(e.target.value) })}
                      className="accent-[#B08A3A]"
                    />
                  </label>
                  <div>
                    <div className="mb-1.5 text-[12px] text-slate-600">{t.align}</div>
                    <div className="flex gap-1.5">
                      {(
                        [
                          ['start', AlignRight],
                          ['center', AlignCenter],
                          ['end', AlignLeft],
                        ] as const
                      ).map(([a, Icon]) => (
                        <button
                          key={a}
                          type="button"
                          onClick={() => update(selected.id, { align: a })}
                          className={cn(
                            'inline-flex h-8 w-9 items-center justify-center rounded-lg border',
                            selected.align === a ? 'border-[#B08A3A] bg-[#C9A24E]/10 text-[#7A5D1E]' : 'border-hairline text-slate-500',
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => update(selected.id, { bold: !selected.bold })}
                        title={t.bold}
                        className={cn(
                          'inline-flex h-8 w-9 items-center justify-center rounded-lg border',
                          selected.bold ? 'border-[#B08A3A] bg-[#C9A24E]/10 text-[#7A5D1E]' : 'border-hairline text-slate-500',
                        )}
                      >
                        <Bold className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </>
              )}
              <button
                type="button"
                onClick={() => {
                  setFields((fs) => fs.filter((f) => f.id !== selected.id));
                  setSelectedId(null);
                }}
                className="inline-flex items-center gap-1.5 self-start text-[12.5px] font-semibold text-danger-600"
              >
                <X className="h-3.5 w-3.5" />
                {t.remove}
              </button>
            </div>
          )}
        </section>

        <section className={card}>
          <button
            type="button"
            onClick={save}
            disabled={pending || !name.trim() || pages.length === 0}
            data-testid="form-save"
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-navy-band text-[13px] font-semibold text-[#F4ECD8] disabled:opacity-60"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {t.save}
          </button>
          {note && (
            <p role="status" className={cn('mt-2 text-center text-[12.5px]', note.ok ? 'text-success-700' : 'text-danger-600')}>
              {note.text}
            </p>
          )}
          {layout && (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (!window.confirm(t.confirmDelete)) return;
                start(async () => {
                  const r = await deleteFormAction(layout.id);
                  if (r.ok) router.replace('/dashboard/company/print');
                  else setNote({ ok: false, text: r.error });
                });
              }}
              className="mt-3 inline-flex w-full items-center justify-center gap-1.5 text-[12.5px] font-semibold text-danger-600"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t.delete}
            </button>
          )}
        </section>
      </aside>
    </div>
  );
}
