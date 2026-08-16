'use client';

import { useState, useTransition } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { submitSalesFeedbackAction } from '../actions';
import { uiT } from '@/messages/ui';
import type { Locale } from '@/lib/locale';

/**
 * Gap 7 — sales/manager/admin records their own feedback on a COMPLETED visit.
 * Rating is optional (a note alone is allowed); the API rejects an entirely
 * empty submission and enforces per-record scope (non-assigned SALES → 403),
 * surfaced here as an inline error.
 */
export function SalesFeedbackForm({
  appointmentId,
  initialRating,
  initialNotes,
  locale = 'ar',
}: {
  appointmentId: string;
  initialRating: number | null;
  initialNotes: string | null;
  locale?: Locale;
}) {
  const m = uiT(locale).pages.visitsAppointmentDetail;
  const [rating, setRating] = useState(initialRating ?? 0);
  const [hover, setHover] = useState(0);
  const [notes, setNotes] = useState(initialNotes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    setOk(false);
    startTransition(async () => {
      const res = await submitSalesFeedbackAction(appointmentId, {
        rating: rating > 0 ? rating : undefined,
        notes: notes.trim() || undefined,
      });
      if (res.ok) setOk(true);
      else setError(res.error);
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={m.salesFeedbackStarAriaLabel(String(n))}
            onClick={() => setRating(n === rating ? 0 : n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            disabled={pending}
          >
            <Star
              className={cn(
                'h-6 w-6 transition-colors',
                n <= (hover || rating) ? 'fill-brand-500 text-brand-500' : 'text-slate-300 hover:text-brand-300',
              )}
            />
          </button>
        ))}
        {rating > 0 && <span className="ms-1 text-xs text-slate-500 tabular-nums">{rating}/5</span>}
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        maxLength={1000}
        rows={2}
        placeholder={m.salesFeedbackPlaceholder}
        className="w-full rounded-xl border border-hairline bg-white px-3 py-2 text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15"
        disabled={pending}
      />
      {error && <p className="text-xs text-danger-700">{error}</p>}
      {ok && <p className="text-xs text-success-700">{m.salesFeedbackSaved}</p>}
      <Button type="button" variant="primary" size="sm" onClick={submit} disabled={pending}>
        {pending ? m.salesFeedbackSaving : m.salesFeedbackSaveBtn}
      </Button>
    </div>
  );
}
