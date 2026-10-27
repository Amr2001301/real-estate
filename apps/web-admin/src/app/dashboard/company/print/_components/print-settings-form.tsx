'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, FileImage, Loader2, PenLine, Stamp, Trash2, Upload } from 'lucide-react';
import { cn } from '@/lib/cn';
import { MediaUploader } from '@/components/media-uploader';
import type { LetterheadMode, PrintSettings, SealDocument } from '@/lib/print-settings';
import type { PrintSettingsMessages } from '../messages';
import { removeSealAction, savePrintSettingsAction, uploadSealAction } from '../actions';

const MODES: LetterheadMode[] = ['BUILT_IN', 'HEADER_FOOTER', 'FULL_PAGE'];
const DOCS: SealDocument[] = ['CONTRACT', 'RESERVATION', 'RECEIPT', 'STATEMENT'];

const card = 'rounded-[22px] border border-hairline bg-surface p-6 shadow-[0_18px_40px_-30px_rgb(20_26_38/0.35)]';
const label = 'text-[12px] font-semibold text-slate-600';
const input =
  'h-10 w-full rounded-xl border border-hairline bg-surface px-3 text-[13px] text-slate-800 outline-none transition-colors focus:border-brand-400/60';

/** One letterhead image: its preview, upload and remove. */
function PaperImage({
  title,
  spec,
  url,
  onChange,
  m,
  tall,
}: {
  title: string;
  spec: string;
  url: string | null;
  onChange: (url: string | null) => void;
  m: PrintSettingsMessages;
  tall?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-hairline p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[13px] font-semibold text-slate-800">{title}</div>
          <div className="mt-0.5 text-[11.5px] text-slate-500">{spec}</div>
        </div>
        {url && (
          <button type="button" onClick={() => onChange(null)} className="text-[12px] font-semibold text-danger-600">
            {m.paper.remove}
          </button>
        )}
      </div>
      <div
        className={cn(
          'mt-3 flex items-center justify-center overflow-hidden rounded-xl border border-dashed border-hairline bg-surface-muted/40',
          tall ? 'h-48' : 'h-20',
        )}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="max-h-full max-w-full object-contain" />
        ) : (
          <FileImage className="h-6 w-6 text-slate-300" />
        )}
      </div>
      <div className="mt-3">
        <MediaUploader
          folder="branding"
          accept="image/png,image/jpeg,image/webp"
          buttonLabel={url ? m.paper.replace : m.paper.upload}
          presignExtra={{ brandingAsset: 'letterhead' }}
          onUploaded={(u) => onChange(u)}
        />
      </div>
    </div>
  );
}

/** The signature or stamp: uploaded straight away, kept private by the API. */
function SealImage({
  asset,
  title,
  icon: Icon,
  src,
  m,
  onSaved,
}: {
  asset: 'signature' | 'stamp';
  title: string;
  icon: typeof PenLine;
  src: string | null;
  m: PrintSettingsMessages;
  onSaved: (s: PrintSettings) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="rounded-2xl border border-hairline p-4" data-testid={`seal-${asset}`}>
      <div className="flex items-center gap-2 text-[13px] font-semibold text-slate-800">
        <Icon className="h-4 w-4 text-[#B08A3A]" />
        {title}
      </div>
      <div className="mt-0.5 text-[11.5px] text-slate-500">{m.seal.spec}</div>
      <div className="mt-3 flex h-28 items-center justify-center rounded-xl border border-dashed border-hairline bg-[repeating-conic-gradient(#f1f3f6_0%_25%,#fff_0%_50%)] bg-[length:16px_16px]">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={title} className="max-h-24 max-w-[85%] object-contain" />
        ) : (
          <span className="text-[12px] text-slate-400">{m.seal.none}</span>
        )}
      </div>
      {error && <p className="mt-2 text-[12px] text-danger-600">{error}</p>}
      <div className="mt-3 flex items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            const form = new FormData();
            form.set('file', f);
            start(async () => {
              setError(null);
              const r = await uploadSealAction(asset, form);
              if (r.ok) onSaved(r.data);
              else setError(r.error);
            });
          }}
        />
        <button
          type="button"
          disabled={pending}
          onClick={() => fileRef.current?.click()}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-hairline px-4 text-[12.5px] font-semibold text-slate-700 hover:border-brand-400/50 disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {src ? m.seal.replace : m.seal.upload}
        </button>
        {src && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!window.confirm(m.seal.removeConfirm)) return;
              start(async () => {
                const r = await removeSealAction(asset);
                if (r.ok) onSaved(r.data);
                else setError(r.error);
              });
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold text-danger-600 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {m.seal.remove}
          </button>
        )}
      </div>
    </div>
  );
}

/** A to-scale sketch of an A4 page with the paper, the text area and the seal. */
function PagePreview({ s, m }: { s: PrintSettings; m: PrintSettingsMessages }) {
  // 210mm → 252px: 1.2px per mm.
  const k = 1.2;
  const own = s.letterheadMode !== 'BUILT_IN';
  return (
    <div className="flex flex-col items-center">
      <div className="mb-3 self-start text-[12px] font-semibold text-slate-600">{m.paper.preview}</div>
      <div
        data-testid="print-preview"
        className="relative overflow-hidden rounded-md bg-white shadow-[0_18px_40px_-20px_rgb(20_26_38/0.45)] ring-1 ring-slate-200"
        style={{ width: 210 * k, height: 297 * k }}
      >
        {/* eslint-disable @next/next/no-img-element */}
        {s.letterheadMode === 'FULL_PAGE' && s.pageImageUrl && (
          <img src={s.pageImageUrl} alt="" className="absolute inset-0 h-full w-full object-fill" />
        )}
        {s.letterheadMode === 'HEADER_FOOTER' && s.headerImageUrl && (
          <img src={s.headerImageUrl} alt="" className="absolute inset-x-0 top-0 w-full" />
        )}
        {s.letterheadMode === 'HEADER_FOOTER' && s.footerImageUrl && (
          <img src={s.footerImageUrl} alt="" className="absolute inset-x-0 bottom-0 w-full" />
        )}
        <div
          className="absolute border border-dashed border-brand-400/70 bg-brand-50/30"
          style={{
            top: (own ? s.marginTopMm : 14) * k,
            bottom: (own ? s.marginBottomMm : 16) * k,
            insetInline: (own ? s.marginSideMm : 16) * k,
          }}
        >
          {!own && <div className="m-2 h-5 w-16 rounded bg-slate-200" />}
          <div className="mx-2 mt-2 space-y-1.5">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="h-1.5 rounded bg-slate-200" style={{ width: `${92 - (i % 3) * 14}%` }} />
            ))}
          </div>
          <div className="absolute inset-x-2 bottom-2 flex items-end justify-between">
            <div className="flex flex-col items-center">
              {s.signature ? (
                <img src={s.signature} alt="" className="h-7 max-w-[70px] object-contain mix-blend-multiply" />
              ) : (
                <div className="h-7" />
              )}
              <div className="h-px w-16 bg-slate-300" />
            </div>
            {s.stamp && <img src={s.stamp} alt="" className="h-12 w-12 -rotate-6 object-contain opacity-90 mix-blend-multiply" />}
          </div>
        </div>
        {/* eslint-enable @next/next/no-img-element */}
      </div>
    </div>
  );
}

/** The fields the save button writes (the signature and stamp save on upload). */
const editable = (s: PrintSettings) =>
  JSON.stringify([
    s.letterheadMode,
    s.headerImageUrl,
    s.footerImageUrl,
    s.pageImageUrl,
    s.marginTopMm,
    s.marginBottomMm,
    s.marginSideMm,
    s.signatoryName,
    s.signatoryTitle,
    [...s.sealDocuments].sort(),
  ]);

/** A small picture of each paper choice. */
function ModeArt({ mode, active }: { mode: LetterheadMode; active: boolean }) {
  const ink = active ? 'bg-[#B08A3A]' : 'bg-slate-300';
  return (
    <span className="relative mx-auto block h-[74px] w-[54px] overflow-hidden rounded-[5px] bg-white shadow-[0_6px_16px_-8px_rgb(20_26_38/0.5)] ring-1 ring-slate-200">
      {mode === 'BUILT_IN' && <span className={cn('absolute end-1.5 top-1.5 h-2 w-4 rounded-sm', ink)} />}
      {mode === 'HEADER_FOOTER' && (
        <>
          <span className={cn('absolute inset-x-0 top-0 h-2.5', ink)} />
          <span className={cn('absolute inset-x-0 bottom-0 h-1.5', ink)} />
        </>
      )}
      {mode === 'FULL_PAGE' && <span className={cn('absolute inset-0 opacity-30', ink)} />}
      <span className="absolute inset-x-2 top-5 space-y-1">
        {[100, 80, 92, 70, 86].map((w, i) => (
          <span key={i} className="block h-[3px] rounded bg-slate-200" style={{ width: `${w}%` }} />
        ))}
      </span>
    </span>
  );
}

export function PrintSettingsForm({
  initial,
  m,
  section,
}: {
  initial: PrintSettings;
  m: PrintSettingsMessages;
  section: 'paper' | 'seal';
}) {
  const router = useRouter();
  const [s, setS] = useState<PrintSettings>(initial);
  const [savedAs, setSavedAs] = useState(() => editable(initial));
  const dirty = editable(s) !== savedAs;
  const [pending, start] = useTransition();
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const set = <K extends keyof PrintSettings>(k: K, v: PrintSettings[K]) => {
    setNote(null);
    setS((prev) => ({ ...prev, [k]: v }));
  };
  const num = (v: string, fallback: number) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : fallback;
  };

  const save = () =>
    start(async () => {
      const r = await savePrintSettingsAction({
        letterheadMode: s.letterheadMode,
        headerImageUrl: s.headerImageUrl,
        footerImageUrl: s.footerImageUrl,
        pageImageUrl: s.pageImageUrl,
        marginTopMm: s.marginTopMm,
        marginBottomMm: s.marginBottomMm,
        marginSideMm: s.marginSideMm,
        signatoryName: s.signatoryName,
        signatoryTitle: s.signatoryTitle,
        sealDocuments: s.sealDocuments,
      });
      if (r.ok) {
        setS(r.data);
        setSavedAs(editable(r.data));
        setNote({ ok: true, text: m.saved });
        router.refresh();
      } else setNote({ ok: false, text: r.error });
    });

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex min-w-0 flex-col gap-5">
        {/* ── Paper ── */}
        {section === 'paper' && (
        <section className={card} data-testid="print-paper-settings">
          <h2 className="font-heading text-[17px] font-bold text-slate-900">{m.paper.title}</h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-slate-500">{m.paper.hint}</p>

          <div className="mt-5 grid gap-3 sm:grid-cols-3" role="radiogroup">
            {MODES.map((mode) => {
              const active = s.letterheadMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  data-testid={`paper-mode-${mode}`}
                  onClick={() => set('letterheadMode', mode)}
                  className={cn(
                    'rounded-2xl border p-4 text-start transition-colors',
                    active ? 'border-[#C9A24E] bg-[#C9A24E]/[0.07]' : 'border-hairline hover:border-brand-400/40',
                  )}
                >
                  <ModeArt mode={mode} active={active} />
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="text-[13px] font-bold text-slate-900">{m.paper.modes[mode].label}</span>
                    <span
                      className={cn(
                        'inline-flex h-5 w-5 items-center justify-center rounded-full border',
                        active ? 'border-[#B08A3A] bg-[#B08A3A] text-white' : 'border-hairline',
                      )}
                    >
                      {active && <Check className="h-3 w-3" />}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[11.5px] leading-relaxed text-slate-500">{m.paper.modes[mode].hint}</p>
                </button>
              );
            })}
          </div>

          {s.letterheadMode === 'HEADER_FOOTER' && (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <PaperImage title={m.paper.header} spec={m.paper.spec} url={s.headerImageUrl} onChange={(u) => set('headerImageUrl', u)} m={m} />
              <PaperImage title={m.paper.footer} spec={m.paper.spec} url={s.footerImageUrl} onChange={(u) => set('footerImageUrl', u)} m={m} />
            </div>
          )}
          {s.letterheadMode === 'FULL_PAGE' && (
            <div className="mt-4 max-w-sm">
              <PaperImage title={m.paper.page} spec={m.paper.pageSpec} url={s.pageImageUrl} onChange={(u) => set('pageImageUrl', u)} m={m} tall />
            </div>
          )}

          {s.letterheadMode !== 'BUILT_IN' && (
            <div className="mt-5">
              <div className={label}>{m.paper.margins}</div>
              <div className="mt-2 grid grid-cols-3 gap-3">
                {(
                  [
                    ['marginTopMm', m.paper.top, 80],
                    ['marginBottomMm', m.paper.bottom, 80],
                    ['marginSideMm', m.paper.side, 40],
                  ] as const
                ).map(([k, l, max]) => (
                  <label key={k} className="flex flex-col gap-1">
                    <span className="text-[11.5px] text-slate-500">{l}</span>
                    <input
                      type="number"
                      min={5}
                      max={max}
                      value={s[k]}
                      onChange={(e) => set(k, num(e.target.value, s[k]))}
                      className={cn(input, 'tabular-nums')}
                      data-testid={`paper-${k}`}
                    />
                  </label>
                ))}
              </div>
            </div>
          )}
        </section>
        )}

        {/* ── Signature & stamp ── */}
        {section === 'seal' && (
        <section className={card} data-testid="print-seal-settings">
          <h2 className="font-heading text-[17px] font-bold text-slate-900">{m.seal.title}</h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-slate-500">{m.seal.hint}</p>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <SealImage asset="signature" title={m.seal.signature} icon={PenLine} src={s.signature} m={m} onSaved={(r) => set('signature', r.signature)} />
            <SealImage asset="stamp" title={m.seal.stamp} icon={Stamp} src={s.stamp} m={m} onSaved={(r) => set('stamp', r.stamp)} />
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className={label}>{m.seal.signatoryName}</span>
              <input
                value={s.signatoryName ?? ''}
                maxLength={120}
                onChange={(e) => set('signatoryName', e.target.value || null)}
                className={input}
                data-testid="signatory-name"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={label}>{m.seal.signatoryTitle}</span>
              <input
                value={s.signatoryTitle ?? ''}
                maxLength={120}
                placeholder={m.seal.signatoryTitlePlaceholder}
                onChange={(e) => set('signatoryTitle', e.target.value || null)}
                className={input}
              />
            </label>
          </div>

          <div className="mt-5">
            <div className={label}>{m.seal.documents}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {DOCS.map((d) => {
                const on = s.sealDocuments.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={on}
                    data-testid={`seal-doc-${d}`}
                    onClick={() => set('sealDocuments', on ? s.sealDocuments.filter((x) => x !== d) : [...s.sealDocuments, d])}
                    className={cn(
                      'inline-flex h-9 items-center gap-1.5 rounded-full border px-4 text-[12.5px] font-semibold transition-colors',
                      on ? 'border-[#B08A3A] bg-[#B08A3A] text-white' : 'border-hairline text-slate-600 hover:border-brand-400/50',
                    )}
                  >
                    {on && <Check className="h-3.5 w-3.5" />}
                    {m.seal.docs[d]}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
        )}

        {/* Save: in view only while there is something to save. */}
        {(dirty || note) && (
          <div
            className={cn(
              'sticky bottom-4 z-10 flex flex-wrap items-center gap-3 rounded-[20px] border bg-surface/95 p-3.5 ps-5 shadow-[0_24px_60px_-28px_rgb(14_22_38/0.55)] backdrop-blur',
              dirty ? 'border-brand-400/50' : 'border-hairline',
            )}
          >
            {dirty ? (
              <span className="flex items-center gap-2 text-[13px] font-semibold text-slate-700">
                <span className="h-2 w-2 animate-pulse rounded-full bg-brand-500" />
                {m.unsaved}
              </span>
            ) : (
              note && (
                <span className={cn('flex items-center gap-1.5 text-[13px] font-semibold', note.ok ? 'text-success-700' : 'text-danger-600')} role="status">
                  {note.ok && <Check className="h-4 w-4" />}
                  {note.text}
                </span>
              )
            )}
            {dirty && note && !note.ok && (
              <span className="text-[12.5px] text-danger-600" role="status">
                {note.text}
              </span>
            )}
            {dirty && (
              <div className="ms-auto flex items-center gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setS(initial);
                    setNote(null);
                  }}
                  className="inline-flex h-10 items-center rounded-full px-4 text-[13px] font-semibold text-slate-500 hover:text-slate-900"
                >
                  {m.discard}
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={pending}
                  data-testid="print-settings-save"
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-gradient-to-l from-[#E2C77F] via-[#C8A24B] to-[#B08A38] px-6 text-[13px] font-bold text-[#1A1406] shadow-[0_10px_30px_-12px_rgb(200_162_75/0.7)] disabled:opacity-60"
                >
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {m.save}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <aside className={cn(card, 'xl:sticky xl:top-6')}>
        <PagePreview s={s} m={m} />
      </aside>
    </div>
  );
}
