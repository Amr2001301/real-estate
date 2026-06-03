'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Star, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { MeAppointmentSummary } from '@/lib/api-types';

/**
 * Gap 7 — post-visit feedback for the customer account ticket. Only meaningful
 * once the appointment is COMPLETED:
 *   - already rated → read-only stars + comment
 *   - not rated yet → a 1–5 star picker + optional comment, posting to
 *     /me/visit-appointments/:id/feedback (one-time; the API enforces it).
 * Warm-luxe RTL styling; no admin KPI look.
 */
function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)} aria-label={`${value} من 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn('h-4 w-4', n <= value ? 'fill-gold-400 text-gold-400' : 'text-hairline')}
          aria-hidden
        />
      ))}
    </span>
  );
}

export function VisitFeedback({ appointment }: { appointment: MeAppointmentSummary }) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  if (appointment.status !== 'COMPLETED') return null;

  // Already submitted → read-only.
  if (appointment.customerRatingSubmittedAt && appointment.customerRating) {
    return (
      <div className="mt-3 rounded-xl border border-hairline bg-surface-soft/60 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-ink-strong">تقييمك للزيارة</span>
          <Stars value={appointment.customerRating} />
        </div>
        {appointment.customerRatingText && (
          <p className="mt-2 text-xs leading-relaxed text-ink-muted" dir="auto">
            {appointment.customerRatingText}
          </p>
        )}
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (rating < 1) {
      setError('يرجى اختيار تقييم من 1 إلى 5 نجوم.');
      return;
    }
    setError(null);
    try {
      const res = await fetch(`/api-proxy/me/visit-appointments/${appointment.id}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ rating, comment: comment.trim() || undefined }),
      });
      if (!res.ok) throw new Error();
      setDone(true);
      startTransition(() => router.refresh());
    } catch {
      setError('تعذّر إرسال التقييم. يُرجى المحاولة مرة أخرى.');
    }
  }

  if (done) {
    return (
      <p className="mt-3 flex items-center gap-1.5 rounded-xl bg-success/[0.06] px-3 py-2.5 text-xs font-semibold text-success">
        <CheckCircle2 className="h-4 w-4" aria-hidden />
        شكراً لك! تم استلام تقييمك.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 rounded-xl border border-hairline bg-surface-soft/60 p-4">
      <p className="text-xs font-semibold text-ink-strong">كيف كانت زيارتك؟</p>
      <div className="mt-2 flex items-center gap-1" role="radiogroup" aria-label="تقييم الزيارة">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} نجوم`}
            onClick={() => setRating(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            className="p-0.5"
            disabled={pending}
          >
            <Star
              className={cn(
                'h-7 w-7 transition-colors',
                n <= (hover || rating) ? 'fill-gold-400 text-gold-400' : 'text-hairline hover:text-gold-300',
              )}
              aria-hidden
            />
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={1000}
        rows={2}
        placeholder="أضف ملاحظة عن زيارتك أو عن المستشار (اختياري)"
        className="mt-3 w-full rounded-xl border border-hairline bg-surface px-3 py-2 text-sm"
        disabled={pending}
      />
      {error && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-error">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-navy px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-navy/90 disabled:opacity-60"
      >
        إرسال التقييم
      </button>
    </form>
  );
}
