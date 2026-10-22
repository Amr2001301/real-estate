'use client';

import { useEffect, useRef, useState } from 'react';
import { safePost } from '@/lib/api';
import { cn } from '@/lib/cn';
import { FormOverlay, type SignFormField } from '@/components/sign/FormOverlay';

interface Block {
  kind: 'heading' | 'paragraph';
  text?: string;
  lines?: string[];
}

/** The document as the company sent it (laid out by the dashboard). */
interface Snapshot {
  version: number;
  company: { name: string; logoUrl: string | null; primaryColor: string | null; registration: string | null; phone: string | null };
  eyebrow: string;
  title: string;
  reference: string | null;
  date: string;
  sections: { title: string; rows: { label: string; value: string }[] }[];
  amounts: { label: string; value: string; emphasis?: boolean }[];
  clausesTitle: string;
  clauses: Block[];
  /** The company's own paper form, filled in — shown in place of the sections. */
  form?: { pages: { imageUrl: string }[]; fields: SignFormField[] };
}

export interface SignView {
  state: 'PENDING' | 'SIGNED' | 'CANCELLED' | 'EXPIRED';
  expiresAt: string;
  phone: string;
  snapshot: Snapshot;
  snapshotHash: string;
  signerName: string | null;
  signedAt: string | null;
}

const T = {
  ar: {
    intro: 'راجِع المستند جيداً، ثم وقّع في الأسفل.',
    agree: 'قرأت المستند وأوافق على ما فيه.',
    sendCode: 'إرسال كود التأكيد',
    codeSent: (p: string) => `أرسلنا كوداً من ٦ أرقام إلى ${p}`,
    resend: 'إعادة الإرسال',
    code: 'كود التأكيد',
    name: 'الاسم بالكامل',
    sign: 'وقّع هنا',
    signHint: 'وقّع بإصبعك أو بالماوس داخل المربع.',
    clear: 'مسح',
    submit: 'توقيع المستند',
    done: 'تم التوقيع بنجاح',
    doneHint: 'شكراً لك. وصلت نسختك الموقعة إلى الشركة.',
    signedBefore: 'تم توقيع هذا المستند',
    signHere: 'توقيع العميل هنا',
    closed: { CANCELLED: 'تم إلغاء هذا الرابط. اطلب رابطاً جديداً من الشركة.', EXPIRED: 'انتهت صلاحية هذا الرابط. اطلب رابطاً جديداً من الشركة.' },
    proof: 'رقم التحقق',
    errors: {
      400: 'الكود غير صحيح أو انتهت صلاحيته.',
      403: 'محاولات كثيرة. اطلب كوداً جديداً.',
      409: 'تم توقيع هذا المستند بالفعل.',
      410: 'انتهت صلاحية الرابط أو أُلغي.',
      429: 'محاولات كثيرة. انتظر قليلاً ثم أعد المحاولة.',
      other: 'تعذّر الإرسال. حاول مرة أخرى.',
      empty: 'ارسم توقيعك أولاً.',
    },
  },
  en: {
    intro: 'Read the document carefully, then sign below.',
    agree: 'I have read the document and agree to it.',
    sendCode: 'Send confirmation code',
    codeSent: (p: string) => `We sent a 6-digit code to ${p}`,
    resend: 'Resend',
    code: 'Confirmation code',
    name: 'Full name',
    sign: 'Sign here',
    signHint: 'Sign with your finger or mouse inside the box.',
    clear: 'Clear',
    submit: 'Sign the document',
    done: 'Signed successfully',
    doneHint: 'Thank you. The company has received your signed copy.',
    signedBefore: 'This document has been signed',
    signHere: 'Customer signs here',
    closed: { CANCELLED: 'This link was cancelled. Ask the company for a new one.', EXPIRED: 'This link has expired. Ask the company for a new one.' },
    proof: 'Verification no.',
    errors: {
      400: 'The code is wrong or has expired.',
      403: 'Too many attempts. Request a new code.',
      409: 'This document has already been signed.',
      410: 'The link has expired or was cancelled.',
      429: 'Too many attempts. Wait a moment and try again.',
      other: 'Could not send. Please try again.',
      empty: 'Draw your signature first.',
    },
  },
};

/** A hand-drawn signature: pointer strokes on a canvas, exported as PNG. */
function SignaturePad({ onChange, clearLabel }: { onChange: (dataUrl: string | null) => void; clearLabel: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const drawn = useRef(false);

  useEffect(() => {
    const c = ref.current!;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const { width, height } = c.getBoundingClientRect();
    c.width = Math.round(width * ratio);
    c.height = Math.round(height * ratio);
    const ctx = c.getContext('2d')!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1d3a8a';
  }, []);

  const point = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  return (
    <div>
      <canvas
        ref={ref}
        data-testid="signature-pad"
        className="h-48 w-full touch-none rounded-2xl border-2 border-dashed border-hairline bg-white"
        onPointerDown={(e) => {
          drawing.current = true;
          try {
            // Keeps the stroke when the finger leaves the box; not every input supports it.
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            /* drawing goes on without capture */
          }
          const ctx = ref.current!.getContext('2d')!;
          const p = point(e);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const ctx = ref.current!.getContext('2d')!;
          const p = point(e);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
          drawn.current = true;
        }}
        onPointerUp={() => {
          drawing.current = false;
          onChange(drawn.current ? ref.current!.toDataURL('image/png') : null);
        }}
      />
      <button
        type="button"
        onClick={() => {
          const c = ref.current!;
          c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
          drawn.current = false;
          onChange(null);
        }}
        className="mt-2 text-sm font-medium text-ink-muted underline-offset-4 hover:underline"
      >
        {clearLabel}
      </button>
    </div>
  );
}

export function SignFlow({ token, view, locale }: { token: string; view: SignView; locale: 'ar' | 'en' }) {
  const t = T[locale];
  const s = view.snapshot;
  const [agreed, setAgreed] = useState(false);
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [signature, setSignature] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signedAt, setSignedAt] = useState<string | null>(view.state === 'SIGNED' ? view.signedAt : null);
  const brand = s.company.primaryColor ?? '#0F1E33';
  const errorFor = (status: number) => (t.errors as Record<string, string | undefined>)[String(status)] ?? t.errors.other;
  const dt = (v: string) =>
    new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'ar-EG-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(v));

  const sendCode = async () => {
    setBusy(true);
    setError(null);
    const r = await safePost<{ phone: string }>(`/public/e-sign/${token}/code`, {});
    setBusy(false);
    if (r.ok) setCodeSentTo(r.data.phone);
    else setError(errorFor(r.error.status));
  };

  /** A smaller copy when a high-density screen made the image too large to send. */
  const fit = async (dataUrl: string): Promise<string> => {
    if (dataUrl.length < 90_000) return dataUrl;
    const img = document.createElement('img');
    img.src = dataUrl;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = Math.round(img.width / 2);
    c.height = Math.round(img.height / 2);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  };

  const submit = async () => {
    if (!signature) return setError(t.errors.empty);
    setBusy(true);
    setError(null);
    const r = await safePost<{ signedAt: string }>(`/public/e-sign/${token}/sign`, {
      code,
      name,
      signature: await fit(signature),
    });
    setBusy(false);
    if (r.ok) setSignedAt(r.data.signedAt);
    else setError(errorFor(r.error.status));
  };

  const closed = view.state === 'CANCELLED' || view.state === 'EXPIRED';
  const card = 'rounded-3xl border border-hairline bg-surface p-5 shadow-sm sm:p-8';

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      {/* ── The document: the company's own form, or the standard layout ── */}
      {s.form ? (
        <article data-testid="sign-document" className={card}>
          <FormOverlay pages={s.form.pages} fields={s.form.fields} signHereLabel={t.signHere} signature={signature} />
        </article>
      ) : (
      <article data-testid="sign-document" className={card}>
        <header className="flex flex-col gap-4 border-b-2 pb-4 sm:flex-row sm:items-start sm:justify-between" style={{ borderColor: brand }}>
          <div className="flex min-w-0 items-center gap-3">
            {s.company.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.company.logoUrl} alt="" className="h-12 w-auto max-w-[120px] object-contain" />
            )}
            <div className="min-w-0">
              <div className="text-lg font-bold leading-tight" style={{ color: brand }}>{s.company.name}</div>
              {s.company.registration && <div className="text-xs text-ink-muted">{s.company.registration}</div>}
            </div>
          </div>
          <div className="shrink-0 sm:text-end">
            <div className="text-[11px] font-bold uppercase tracking-widest text-gold-500">{s.eyebrow}</div>
            <h1 className="mt-0.5 text-xl font-bold" style={{ color: brand }}>{s.title}</h1>
            <div className="mt-1 text-xs text-ink-muted">
              {s.reference && (
                <>
                  <span dir="ltr">{s.reference}</span> ·{' '}
                </>
              )}
              {s.date}
            </div>
          </div>
        </header>

        {s.sections.map((sec) => (
          <section key={sec.title} className="mt-6">
            <h2 className="text-sm font-bold" style={{ color: brand }}>{sec.title}</h2>
            <dl className="mt-2 grid gap-x-6 sm:grid-cols-2">
              {sec.rows.map((row) => (
                <div key={row.label} className="flex items-baseline justify-between gap-3 border-b border-hairline py-2">
                  <dt className="shrink-0 text-xs text-ink-muted">{row.label}</dt>
                  <dd className="text-end text-sm font-medium text-ink-strong"><bdi>{row.value}</bdi></dd>
                </div>
              ))}
            </dl>
          </section>
        ))}

        {s.amounts.length > 0 && (
          <div className="mt-6 overflow-hidden rounded-2xl border border-hairline">
            {s.amounts.map((a) => (
              <div
                key={a.label}
                className={cn('flex items-center justify-between gap-4 px-4 py-2.5 text-sm', a.emphasis && 'font-bold text-white')}
                style={a.emphasis ? { background: brand } : undefined}
              >
                <span className={a.emphasis ? '' : 'text-ink-muted'}>{a.label}</span>
                <span className={a.emphasis ? 'text-base' : 'font-semibold text-ink-strong'}>{a.value}</span>
              </div>
            ))}
          </div>
        )}

        {s.clauses.length > 0 && (
          <section className="mt-6">
            <h2 className="text-sm font-bold" style={{ color: brand }}>{s.clausesTitle}</h2>
            <div className="mt-3 space-y-3 text-[14px] leading-8 text-ink">
              {s.clauses.map((b, i) =>
                b.kind === 'heading' ? (
                  <h3 key={i} className="pt-1 font-bold" style={{ color: brand }}>{b.text}</h3>
                ) : (
                  <p key={i} className="text-justify">
                    {(b.lines ?? []).map((l, j) => (
                      <span key={j}>
                        {j > 0 && <br />}
                        {l}
                      </span>
                    ))}
                  </p>
                ),
              )}
            </div>
          </section>
        )}
      </article>
      )}

      {/* ── Signing ── */}
      <section data-testid="sign-panel" className={card}>
        {signedAt ? (
          <div data-testid="sign-done" className="py-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-2xl text-success">✓</div>
            <h2 className="mt-4 text-xl font-bold text-ink-strong">{view.state === 'SIGNED' ? t.signedBefore : t.done}</h2>
            <p className="mt-1 text-sm text-ink-muted">{dt(signedAt)}</p>
            {view.state !== 'SIGNED' && <p className="mt-3 text-sm text-ink-muted">{t.doneHint}</p>}
            <p className="mt-4 text-xs text-ink-muted">
              {t.proof}: <span dir="ltr" className="font-mono">{view.snapshotHash.slice(0, 16).toUpperCase()}</span>
            </p>
          </div>
        ) : closed ? (
          <p data-testid="sign-closed" className="py-6 text-center text-ink-muted">{t.closed[view.state as 'CANCELLED' | 'EXPIRED']}</p>
        ) : (
          <div className="flex flex-col gap-5">
            <p className="text-sm text-ink-muted">{t.intro}</p>
            <label className="flex items-start gap-3 text-[15px] text-ink-strong">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                data-testid="sign-agree"
                className="mt-1 h-5 w-5 accent-[#B7902F]"
              />
              {t.agree}
            </label>

            {agreed && !codeSentTo && (
              <button
                type="button"
                disabled={busy}
                onClick={sendCode}
                data-testid="sign-send-code"
                className="h-12 rounded-full text-[15px] font-semibold text-white disabled:opacity-60"
                style={{ background: brand }}
              >
                {t.sendCode}
              </button>
            )}

            {agreed && codeSentTo && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink-muted">
                  <span>{t.codeSent(codeSentTo)}</span>
                  <button type="button" disabled={busy} onClick={sendCode} className="font-semibold text-gold-600">
                    {t.resend}
                  </button>
                </div>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-semibold text-ink-strong">{t.code}</span>
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    dir="ltr"
                    data-testid="sign-code"
                    className="h-12 rounded-2xl border border-hairline bg-canvas px-4 text-center font-mono text-xl tracking-[0.5em] text-ink-strong outline-none focus:border-gold-400"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-semibold text-ink-strong">{t.name}</span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={120}
                    data-testid="sign-name"
                    className="h-12 rounded-2xl border border-hairline bg-canvas px-4 text-[15px] text-ink-strong outline-none focus:border-gold-400"
                  />
                </label>
                <div>
                  <div className="text-sm font-semibold text-ink-strong">{t.sign}</div>
                  <p className="mb-2 text-xs text-ink-muted">{t.signHint}</p>
                  <SignaturePad onChange={setSignature} clearLabel={t.clear} />
                </div>
                <button
                  type="button"
                  disabled={busy || code.length !== 6 || name.trim().length < 2 || !signature}
                  onClick={submit}
                  data-testid="sign-submit"
                  className="h-12 rounded-full text-[15px] font-semibold text-white disabled:opacity-50"
                  style={{ background: brand }}
                >
                  {t.submit}
                </button>
              </>
            )}

            {error && (
              <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
