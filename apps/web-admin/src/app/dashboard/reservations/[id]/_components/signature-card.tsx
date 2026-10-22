'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Check, Copy, ExternalLink, Loader2, MessageCircle, PenLine, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { Locale } from '@/lib/locale';
import { cancelSignatureAction, requestSignatureAction } from '../signature-actions';

export interface SignatureRequestView {
  id: string;
  state: 'PENDING' | 'SIGNED' | 'CANCELLED' | 'EXPIRED';
  createdAt: string;
  expiresAt: string;
  phone: string;
  snapshotHash: string;
  signerName: string | null;
  signedAt: string | null;
  outdated: boolean;
  signature: string | null;
}

const T = {
  ar: {
    title: 'توقيع العميل',
    hint: 'يصل العميلَ رابط يقرأ فيه استمارة الحجز ويوقّع بإصبعه، بعد تأكيد رقمه بكود.',
    send: 'إرسال للتوقيع',
    resend: 'إرسال رابط جديد',
    newRequest: 'طلب توقيع جديد',
    link: 'رابط التوقيع',
    linkOnce: 'يظهر الرابط الآن فقط — انسخه أو أرسله.',
    copy: 'نسخ',
    copied: 'تم النسخ',
    whatsapp: 'واتساب',
    openHere: 'التوقيع على هذا الجهاز',
    waiting: 'بانتظار توقيع العميل',
    sentTo: 'يصل الكود إلى',
    expires: 'ينتهي',
    cancel: 'إلغاء الرابط',
    signed: 'وقّع العميل',
    signedBy: 'الاسم',
    signedAt: 'بتاريخ',
    proof: 'رقم التحقق',
    outdated: 'تغيّرت بيانات الحجز بعد التوقيع — التوقيع على نسخة سابقة.',
    expired: 'انتهت صلاحية آخر رابط.',
    noPhone: 'أضف رقم هاتف للعميل أولاً.',
    message: (company: string, url: string) => `مرحباً، هذا رابط توقيع استمارة الحجز من ${company}:\n${url}`,
  },
  en: {
    title: 'Customer signature',
    hint: 'The customer gets a link to read the booking form and sign with a finger, after confirming their number with a code.',
    send: 'Send for signature',
    resend: 'Send a new link',
    newRequest: 'Request a new signature',
    link: 'Signing link',
    linkOnce: 'The link is shown now only — copy or send it.',
    copy: 'Copy',
    copied: 'Copied',
    whatsapp: 'WhatsApp',
    openHere: 'Sign on this device',
    waiting: 'Waiting for the customer to sign',
    sentTo: 'The code goes to',
    expires: 'Expires',
    cancel: 'Cancel link',
    signed: 'Signed by the customer',
    signedBy: 'Name',
    signedAt: 'On',
    proof: 'Verification no.',
    outdated: 'The booking changed after it was signed — the signature is on an earlier version.',
    expired: 'The last link expired.',
    noPhone: 'Add the customer’s phone number first.',
    message: (company: string, url: string) => `Hello, here is the link to sign your booking form with ${company}:\n${url}`,
  },
};

export function SignatureCard({
  reservationId,
  requests,
  canRequest,
  customerPhone,
  company,
  locale,
}: {
  reservationId: string;
  requests: SignatureRequestView[];
  canRequest: boolean;
  customerPhone: string | null;
  company: string;
  locale: Locale;
}) {
  const t = T[locale === 'en' ? 'en' : 'ar'];
  const router = useRouter();
  const [pending, start] = useTransition();
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latest = requests[0];
  const dt = (v: string) =>
    new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'ar-EG-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(v));

  const send = () =>
    start(async () => {
      setError(null);
      setUrl(null);
      const r = await requestSignatureAction(reservationId);
      if (!r.ok) return setError(r.error);
      setUrl(r.url ?? null);
      router.refresh();
    });

  const waLink = (link: string) => {
    const digits = (customerPhone ?? '').replace(/\D/g, '');
    return `https://wa.me/${digits}?text=${encodeURIComponent(t.message(company, link))}`;
  };

  const btn =
    'inline-flex h-9 items-center justify-center gap-1.5 rounded-full px-4 text-[12.5px] font-semibold transition-colors disabled:opacity-50';

  return (
    <section data-testid="signature-card" className="rounded-[22px] border border-hairline bg-surface p-6">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#C9A24E]/50 text-[#B08A3A]">
          <PenLine className="h-[18px] w-[18px] stroke-[1.6]" />
        </span>
        <div>
          <h3 className="font-heading text-[15px] font-bold text-slate-900">{t.title}</h3>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-slate-500">{t.hint}</p>
        </div>
      </div>

      {/* Signed */}
      {latest?.state === 'SIGNED' && (
        <div data-testid="signature-signed" className="mt-5 rounded-2xl border border-success-100 bg-success-50/50 p-4">
          <div className="flex items-center gap-1.5 text-[12.5px] font-bold text-success-700">
            <ShieldCheck className="h-4 w-4" />
            {t.signed}
          </div>
          {latest.signature && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={latest.signature} alt={t.signed} className="mt-2 h-16 max-w-full object-contain mix-blend-multiply" />
          )}
          <dl className="mt-2 space-y-1 text-[12px] text-slate-600">
            <div>
              <dt className="inline text-slate-400">{t.signedBy}: </dt>
              <dd className="inline font-semibold text-slate-800">{latest.signerName}</dd>
            </div>
            {latest.signedAt && (
              <div>
                <dt className="inline text-slate-400">{t.signedAt}: </dt>
                <dd className="inline">{dt(latest.signedAt)}</dd>
              </div>
            )}
            <div>
              <dt className="inline text-slate-400">{t.proof}: </dt>
              <dd dir="ltr" className="inline font-mono text-[11px]">{latest.snapshotHash.slice(0, 16).toUpperCase()}</dd>
            </div>
          </dl>
          {latest.outdated && (
            <p data-testid="signature-outdated" className="mt-3 flex items-start gap-1.5 rounded-xl bg-warning-50 px-3 py-2 text-[12px] text-warning-700">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {t.outdated}
            </p>
          )}
        </div>
      )}

      {/* Just sent: the link, shown once */}
      {url && (
        <div data-testid="signature-link" className="mt-5 rounded-2xl border border-[#C9A24E]/40 bg-[#C9A24E]/[0.06] p-4">
          <div className="text-[12px] font-semibold text-slate-700">{t.link}</div>
          <div dir="ltr" className="mt-1.5 break-all rounded-lg bg-white px-3 py-2 font-mono text-[11.5px] text-slate-700 ring-1 ring-hairline">
            {url}
          </div>
          <p className="mt-1.5 text-[11px] text-slate-500">{t.linkOnce}</p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(url).catch(() => {});
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className={cn(btn, 'border border-hairline text-slate-700 hover:border-brand-400/50')}
            >
              {copied ? <Check className="h-3.5 w-3.5 text-success-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? t.copied : t.copy}
            </button>
            <a href={waLink(url)} target="_blank" rel="noreferrer" className={cn(btn, 'bg-[#25D366] text-white')}>
              <MessageCircle className="h-3.5 w-3.5" />
              {t.whatsapp}
            </a>
            <a href={url} target="_blank" rel="noreferrer" className={cn(btn, 'bg-navy-band text-[#F4ECD8]')}>
              <ExternalLink className="h-3.5 w-3.5" />
              {t.openHere}
            </a>
          </div>
        </div>
      )}

      {/* Waiting */}
      {latest?.state === 'PENDING' && !url && (
        <div data-testid="signature-pending" className="mt-5 rounded-2xl border border-warning-100 bg-warning-50/50 p-4 text-[12.5px]">
          <div className="font-bold text-warning-700">{t.waiting}</div>
          <div className="mt-1 text-slate-600">
            {t.sentTo} <span dir="ltr" className="font-mono">{latest.phone}</span> · {t.expires} {dt(latest.expiresAt)}
          </div>
        </div>
      )}
      {latest?.state === 'EXPIRED' && <p className="mt-4 text-[12px] text-slate-500">{t.expired}</p>}

      {error && <p className="mt-3 text-[12px] text-danger-600">{error}</p>}
      {canRequest && !customerPhone && <p className="mt-3 text-[12px] text-warning-700">{t.noPhone}</p>}

      {canRequest && !(latest?.state === 'SIGNED' && !latest.outdated) && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={pending || !customerPhone}
            onClick={send}
            data-testid="signature-send"
            className={cn(btn, 'bg-navy-band text-[#F4ECD8]')}
          >
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {latest?.state === 'PENDING' ? t.resend : latest?.state === 'SIGNED' ? t.newRequest : t.send}
          </button>
          {latest?.state === 'PENDING' && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await cancelSignatureAction(reservationId, latest.id);
                  if (!r.ok) setError(r.error);
                  setUrl(null);
                  router.refresh();
                })
              }
              className={cn(btn, 'text-danger-600')}
            >
              {t.cancel}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
