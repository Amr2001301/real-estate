'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CircleAlert, Loader2, Sparkles, Trash2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import {
  PLACEHOLDER_GROUPS,
  amountInWords,
  renderTemplate,
  unknownPlaceholders,
  type TemplateValues,
} from '@/lib/document-template';
import { STARTER_WORDINGS } from '@/lib/document-starters';
import type { DocumentTemplate, TemplateDocument, TemplateVariant } from '@/lib/print-settings';
import type { PrintSettingsMessages } from '../messages';
import { createTemplateAction, deleteTemplateAction, updateTemplateAction } from '../actions';

const label = 'text-[12px] font-semibold text-slate-600';
const input =
  'h-10 w-full rounded-xl border border-hairline bg-surface px-3 text-[13px] text-slate-800 outline-none transition-colors focus:border-brand-400/60';
const card = 'rounded-[22px] border border-hairline bg-surface p-6 shadow-[0_18px_40px_-30px_rgb(20_26_38/0.35)]';

/** Sample values for the preview: what a real sale fills in. */
function sampleValues(locale: 'ar' | 'en', currency: string, company: string): TemplateValues {
  const ar = locale === 'ar';
  const money = (n: number) =>
    new Intl.NumberFormat(ar ? 'ar-EG-u-nu-latn' : 'en-EG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
  return {
    'company.name': company,
    'company.registration': '123456',
    'company.address': ar ? 'التجمع الخامس، القاهرة الجديدة' : 'Fifth Settlement, New Cairo',
    'company.phone': '+20 100 000 0000',
    'company.signatory': ar ? 'أحمد محمود' : 'Ahmed Mahmoud',
    'company.signatoryTitle': ar ? 'المدير التنفيذي' : 'Chief Executive',
    'customer.name': ar ? 'محمد علي حسن' : 'Mohamed Ali Hassan',
    'customer.phone': '+20 111 222 3333',
    'customer.email': 'client@example.com',
    'customer.nationalId': '29001011234567',
    'customer.address': ar ? '12 شارع التسعين، التجمع الخامس، القاهرة الجديدة' : '12 90th Street, Fifth Settlement, New Cairo',
    'unit.code': 'A-1204',
    'unit.type': ar ? 'شقة' : 'Apartment',
    'unit.area': '165',
    'unit.floor': '12',
    'unit.building': ar ? 'مبنى A' : 'Building A',
    'unit.project': ar ? 'مشروع النخيل' : 'Palm Residence',
    'contract.number': 'CT-2026-0148',
    'contract.date': ar ? '15 أكتوبر 2026' : '15 Oct 2026',
    'contract.total': money(3_250_000),
    'contract.totalWords': amountInWords(3_250_000, currency, locale),
    'contract.downPayment': money(650_000),
    'contract.downPaymentWords': amountInWords(650_000, currency, locale),
    'contract.remaining': money(2_600_000),
    'contract.deliveryDate': ar ? '30 يونيو 2029' : '30 Jun 2029',
    'plan.count': '20',
    'plan.installment': money(130_000),
    'plan.frequency': ar ? 'ربع سنوي' : 'Quarterly',
    'plan.months': '60',
    'plan.firstDue': ar ? '15 يناير 2027' : '15 Jan 2027',
    'plan.lastDue': ar ? '15 أكتوبر 2031' : '15 Oct 2031',
    'reservation.number': 'RS-2026-0311',
    'reservation.date': ar ? '1 أكتوبر 2026' : '1 Oct 2026',
    'reservation.amount': money(100_000),
    'reservation.amountWords': amountInWords(100_000, currency, locale),
    'reservation.expiresAt': ar ? '8 أكتوبر 2026' : '8 Oct 2026',
    today: new Intl.DateTimeFormat(ar ? 'ar-EG-u-nu-latn' : 'en-GB', { dateStyle: 'medium' }).format(new Date()),
  };
}

export function TemplateEditor({
  template,
  m,
  locale,
  currency,
  company,
}: {
  template: DocumentTemplate | null;
  m: PrintSettingsMessages;
  locale: 'ar' | 'en';
  currency: string;
  company: string;
}) {
  const router = useRouter();
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [documentType, setDocumentType] = useState<TemplateDocument>(template?.documentType ?? 'CONTRACT');
  const [variant, setVariant] = useState<TemplateVariant>(template?.variant ?? 'ANY');
  const [name, setName] = useState(template?.name ?? '');
  const [body, setBody] = useState(template?.body ?? '');
  const [isDefault, setIsDefault] = useState(template?.isDefault ?? true);
  const [pending, start] = useTransition();
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const values = useMemo(() => sampleValues(locale, currency, company), [locale, currency, company]);
  const blocks = useMemo(() => renderTemplate(body, values), [body, values]);
  const unknown = useMemo(() => unknownPlaceholders(body), [body]);
  const groups = PLACEHOLDER_GROUPS.map((g) => ({ ...g, items: g.items.filter((p) => p.docs.includes(documentType)) })).filter(
    (g) => g.items.length,
  );
  const starters = STARTER_WORDINGS.filter((s) => s.documentType === documentType);

  const insert = (key: string) => {
    const el = bodyRef.current;
    const token = `{{${key}}}`;
    if (!el) return setBody((b) => b + token);
    const { selectionStart: a, selectionEnd: b } = el;
    const next = body.slice(0, a) + token + body.slice(b);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(a + token.length, a + token.length);
    });
  };

  const save = () =>
    start(async () => {
      setNote(null);
      const input = { name, body, isDefault, variant: documentType === 'CONTRACT' ? variant : 'ANY' as TemplateVariant };
      const r = template
        ? await updateTemplateAction(template.id, input)
        : await createTemplateAction({ ...input, documentType });
      if (!r.ok) return setNote({ ok: false, text: r.error });
      setNote({ ok: true, text: m.editor.saved });
      if (!template) router.replace(`/dashboard/company/print/templates/${(r.data as DocumentTemplate).id}`);
      else router.refresh();
    });

  return (
    <div className="grid items-start gap-5 xl:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-5">
        <section className={card}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1.5 md:col-span-2">
              <span className={label}>{m.editor.name}</span>
              <input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} className={input} data-testid="template-name" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={label}>{m.editor.documentType}</span>
              <select
                value={documentType}
                disabled={!!template}
                onChange={(e) => setDocumentType(e.target.value as TemplateDocument)}
                className={cn(input, 'disabled:opacity-70')}
                data-testid="template-document"
              >
                <option value="CONTRACT">{m.templates.doc.CONTRACT}</option>
                <option value="RESERVATION">{m.templates.doc.RESERVATION}</option>
              </select>
            </label>
            {documentType === 'CONTRACT' && (
              <label className="flex flex-col gap-1.5">
                <span className={label}>{m.editor.variant}</span>
                <select value={variant} onChange={(e) => setVariant(e.target.value as TemplateVariant)} className={input} data-testid="template-variant">
                  {(['ANY', 'INSTALLMENT', 'CASH'] as const).map((v) => (
                    <option key={v} value={v}>
                      {m.templates.variant[v]}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="flex items-center gap-2.5 md:col-span-2">
              <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="h-4 w-4 accent-[#B08A3A]" />
              <span className="text-[13px] text-slate-700">{m.editor.isDefault}</span>
            </label>
          </div>
        </section>

        <section className={card}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className={label}>{m.editor.body}</span>
            {!body.trim() && starters.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {starters.map((s) => (
                  <button
                    key={s.name}
                    type="button"
                    data-testid="template-starter"
                    onClick={() => {
                      setBody(s.body);
                      if (!name) setName(s.name);
                      if (documentType === 'CONTRACT') setVariant(s.variant);
                    }}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#C9A24E]/50 px-3 text-[12px] font-semibold text-[#8A6A26] hover:bg-[#C9A24E]/[0.08]"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {m.editor.starter}: {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className="mt-1 text-[11.5px] leading-relaxed text-slate-500">{m.editor.bodyHint}</p>
          {!body.trim() && starters.length > 0 && <p className="mt-1 text-[11.5px] text-[#8A6A26]">{m.editor.starterNote}</p>}
          <textarea
            ref={bodyRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={18}
            dir="auto"
            data-testid="template-body"
            className="mt-3 w-full resize-y rounded-xl border border-hairline bg-surface p-3 text-[13px] leading-[1.9] text-slate-800 outline-none focus:border-brand-400/60"
          />
          {unknown.length > 0 && (
            <p className="mt-2 flex items-start gap-1.5 text-[12px] text-warning-700">
              <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                {m.editor.unknown}{' '}
                <span dir="ltr" className="font-mono">
                  {unknown.join(', ')}
                </span>
              </span>
            </p>
          )}

          <div className="mt-4">
            <div className={label}>{m.editor.placeholders}</div>
            <div className="mt-2 space-y-2.5">
              {groups.map((g) => (
                <div key={g.ar} className="flex flex-wrap items-center gap-1.5">
                  <span className="w-16 shrink-0 text-[11.5px] font-semibold text-slate-400">{locale === 'en' ? g.en : g.ar}</span>
                  {g.items.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => insert(p.key)}
                      title={`{{${p.key}}}`}
                      data-testid={`ph-${p.key}`}
                      className="rounded-full bg-surface-muted px-2.5 py-1 text-[11.5px] font-medium text-slate-700 ring-1 ring-inset ring-hairline hover:bg-brand-50 hover:text-brand-700"
                    >
                      {locale === 'en' ? p.en : p.ar}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={pending || !name.trim() || !body.trim()}
            data-testid="template-save"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-navy-band px-6 text-[13px] font-semibold text-[#F4ECD8] disabled:opacity-60"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {m.editor.save}
          </button>
          {template && (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (!window.confirm(m.editor.confirmDelete)) return;
                start(async () => {
                  const r = await deleteTemplateAction(template.id);
                  if (r.ok) router.replace('/dashboard/company/print');
                  else setNote({ ok: false, text: r.error });
                });
              }}
              className="inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold text-danger-600 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              {m.editor.delete}
            </button>
          )}
          {note && (
            <span role="status" className={cn('text-[12.5px]', note.ok ? 'text-success-700' : 'text-danger-600')}>
              {note.text}
            </span>
          )}
        </div>
      </div>

      {/* ── Preview: an A4 page with the wording filled in ── */}
      <aside className={cn(card, 'xl:sticky xl:top-6')}>
        <div className={label}>{m.editor.preview}</div>
        <div
          data-testid="template-preview"
          className="mt-3 max-h-[75vh] overflow-y-auto rounded-md bg-white px-8 py-7 shadow-[0_18px_40px_-20px_rgb(20_26_38/0.45)] ring-1 ring-slate-200"
        >
          {blocks.length === 0 ? (
            <p className="py-16 text-center text-[12.5px] text-slate-400">—</p>
          ) : (
            <div className="space-y-3 text-[12.5px] leading-[1.9] text-slate-800">
              {blocks.map((b, i) =>
                b.kind === 'heading' ? (
                  <h3 key={i} className="pt-2 text-[13px] font-bold text-[#0F1E33]">
                    {b.text}
                  </h3>
                ) : (
                  <p key={i} className="text-justify">
                    {b.lines.map((l, j) => (
                      <span key={j}>
                        {j > 0 && <br />}
                        {l}
                      </span>
                    ))}
                  </p>
                ),
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
