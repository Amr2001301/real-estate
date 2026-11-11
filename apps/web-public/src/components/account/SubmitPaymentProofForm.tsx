'use client';

import { useRef, useState, useTransition, type ChangeEvent, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useSiteLocale } from '@/components/locale/SiteLocaleProvider';
import { accountT } from '@/messages/account';

interface Props {
  /** Installment proof mode. Exactly one of installmentId / reservationId is set. */
  installmentId?: string;
  /** Gap 3 — booking-amount proof mode (reservation booking payment). */
  reservationId?: string;
  amount: string;
  /** Resubmit mode: when set, the form POSTs to /me/deposits/:id/resubmit. */
  resubmitDepositId?: string;
  onClose?: () => void;
}

// P11 — Manual/offline payment-proof submission. Two-step flow:
//   1) POST /me/payments/presign  → { uploadUrl, publicUrl }
//   2) browser PUT to MinIO/R2 (Content-Type only — no Bearer leak)
//   3) POST /me/deposits (or /me/deposits/:id/resubmit) with payment method
//      and proof metadata.
// MIME whitelist mirrors the backend presign gate; the API re-validates so
// any client tampering is rejected. Strings stay Arabic, no raw backend
// errors are surfaced to the customer.

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_BYTES = 25 * 1024 * 1024;
const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp';

const PAYMENT_METHOD_VALUES = ['BANK_TRANSFER', 'CASH', 'CHEQUE', 'OTHER'];

function formatSize(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

export function SubmitPaymentProofForm({
  installmentId,
  reservationId,
  amount,
  resubmitDepositId,
  onClose,
}: Props) {
  const t = accountT(useSiteLocale()).proof;
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>('BANK_TRANSFER');
  const [paidAt, setPaidAt] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState<string>('');
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'submitting' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null);
    if (f.size > MAX_SIZE_BYTES) {
      setError(t.tooBig(formatSize(MAX_SIZE_BYTES)));
      return;
    }
    if (!ALLOWED_TYPES.includes(f.type)) {
      setError(t.badType);
      return;
    }
    setPickedFile(f);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!pickedFile) {
      setError(t.pickFile);
      return;
    }
    setError(null);
    setProgress(0);

    try {
      // 1) Presign.
      setPhase('uploading');
      const presignRes = await fetch('/api-proxy/me/payments/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          contentType: pickedFile.type,
          sizeBytes: pickedFile.size,
          fileName: pickedFile.name,
        }),
      });
      if (!presignRes.ok) {
        throw new Error(t.prepFail);
      }
      const { uploadUrl, publicUrl } = (await presignRes.json()) as {
        uploadUrl: string;
        publicUrl: string;
        key: string;
      };

      // 2) PUT to MinIO/R2 — NO Authorization header (signed URL only).
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', pickedFile.type);
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(t.uploadFail));
        };
        xhr.onerror = () => reject(new Error(t.connection));
        xhr.send(pickedFile);
      });

      // 3) Submit deposit.
      setPhase('submitting');
      const url = resubmitDepositId
        ? `/api-proxy/me/deposits/${resubmitDepositId}/resubmit`
        : '/api-proxy/me/deposits';
      const common = {
        paidAt: new Date(paidAt).toISOString(),
        paymentMethod,
        receiptUrl: publicUrl,
        fileName: pickedFile.name,
        mimeType: pickedFile.type,
        sizeBytes: pickedFile.size,
        note: note.trim() || undefined,
      };
      const body = resubmitDepositId
        ? common
        : reservationId
          ? // Gap 3 — booking-amount proof: server uses the reservation's
            // authoritative bookingAmount, so no amount is sent.
            { reservationId, ...common }
          : { installmentId, amount: Number(amount), ...common };
      const submitRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!submitRes.ok) {
        throw new Error(t.submitFail);
      }
      setPhase('done');
      startTransition(() => {
        router.refresh();
        onClose?.();
      });
    } catch (err) {
      setPhase('error');
      setError((err as Error).message);
    }
  }

  const busy = phase === 'uploading' || phase === 'submitting' || pending;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl bg-surface border border-hairline p-5">
      <div>
        <h3 className="text-base font-semibold text-ink-strong">
          {resubmitDepositId ? t.titleResubmit : t.title}
        </h3>
        <p className="mt-0.5 text-xs text-ink-muted">
          {t.review}
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-ink-strong">{t.method}</label>
        <select
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value)}
          className="mt-1 w-full rounded-xl border border-hairline bg-surface px-3 py-2 text-sm focus:border-navy/50 focus:outline-none focus:ring-2 focus:ring-navy/15"
          disabled={busy}
        >
          {PAYMENT_METHOD_VALUES.map((value) => ({ value, label: t.methods[value] ?? value })).map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-ink-strong">{t.paidAt}</label>
        <input
          type="date"
          value={paidAt}
          onChange={(e) => setPaidAt(e.target.value)}
          className="mt-1 w-full rounded-xl border border-hairline bg-surface px-3 py-2 text-sm focus:border-navy/50 focus:outline-none focus:ring-2 focus:ring-navy/15"
          disabled={busy}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-ink-strong">{t.file}</label>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          onChange={onPick}
          className="mt-1 block w-full text-xs file:me-3 file:rounded-lg file:border-0 file:bg-gold-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-gold-700 hover:file:bg-gold-200 disabled:opacity-50"
          disabled={busy}
        />
        <p className="mt-1 text-xs text-ink-muted">
          {t.fileHint(formatSize(MAX_SIZE_BYTES))}
        </p>
        {pickedFile && (
          <p className="mt-1 text-xs text-ink-muted" dir="ltr">
            {pickedFile.name} ({formatSize(pickedFile.size)})
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-ink-strong">{t.note}</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          rows={2}
          placeholder={t.noteHint}
          className="mt-1 w-full rounded-xl border border-hairline bg-surface px-3 py-2 text-sm focus:border-navy/50 focus:outline-none focus:ring-2 focus:ring-navy/15"
          disabled={busy}
        />
      </div>

      {phase === 'uploading' && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-soft">
          <div className="h-full bg-gold-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}

      {error && (
        <p className="flex items-start gap-2 rounded-xl bg-error/5 border border-error/20 p-2.5 text-xs text-error">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          {error}
        </p>
      )}

      {phase === 'done' && (
        <p className="flex items-center gap-1.5 text-xs text-success">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {t.done}
        </p>
      )}

      <div className="flex items-center justify-end gap-2">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 py-2 text-sm text-ink-muted hover:text-ink-strong"
            disabled={busy}
          >
            {t.cancel}
          </button>
        )}
        <button
          type="submit"
          disabled={busy || !pickedFile}
          className="inline-flex items-center gap-1 rounded-full bg-navy px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-navy/90 disabled:opacity-60"
        >
          <Upload className="h-3.5 w-3.5" aria-hidden />
          {phase === 'submitting' ? t.sending : phase === 'uploading' ? `${progress}%` : t.send}
        </button>
      </div>
    </form>
  );
}
