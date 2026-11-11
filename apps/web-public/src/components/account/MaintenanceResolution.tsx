'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Star, CheckCircle2, AlertCircle, Clock, ShieldCheck, MessageSquareWarning } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { MeMaintenanceRequest } from '@/lib/api-types';
import { useSiteLocale } from '@/components/locale/SiteLocaleProvider';
import { accountT } from '@/messages/account';
import { formatDateTimeShort } from '@/lib/format';

/**
 * Phase C — customer-facing maintenance resolution loop: SLA/overdue/unresolved
 * status, a complaint action (≥24h overdue), and a confirm-resolution star
 * rating form (RESOLVED/CLOSED). Backend stays authoritative — the UI pre-gates
 * but always handles API errors. Warm-luxe RTL; mirrors VisitFeedback.
 */
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function Stars({ value }: { value: number }) {
  const t = accountT(useSiteLocale()).resolution;
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={t.outOf(value)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn('h-4 w-4', n <= value ? 'fill-gold-400 text-gold-400' : 'text-hairline')} aria-hidden />
      ))}
    </span>
  );
}

export function MaintenanceResolution({ request }: { request: MeMaintenanceRequest }) {
  const locale = useSiteLocale();
  const t = accountT(locale).resolution;
  const formatDate = (iso?: string | null) => formatDateTimeShort(iso, locale);
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  const isClosedish = request.status === 'RESOLVED' || request.status === 'CLOSED';
  const dueAtMs = request.dueAt ? new Date(request.dueAt).getTime() : null;
  const overdueMs = dueAtMs != null && !isClosedish ? Date.now() - dueAtMs : null;
  const isOverdue = overdueMs != null && overdueMs > 0;
  const overdueDays = isOverdue ? Math.floor(overdueMs! / DAY_MS) : 0;
  const overdueHours = isOverdue ? Math.floor((overdueMs! % DAY_MS) / HOUR_MS) : 0;

  const alreadyConfirmed = !!request.customerConfirmedResolutionAt;
  const canConfirm = isClosedish && !alreadyConfirmed;
  // Pre-gate the complaint exactly like the backend (≥24h overdue, unresolved,
  // no prior complaint) — the API re-validates and we surface any error.
  const canComplain =
    !isClosedish && !request.complaintAt && overdueMs != null && overdueMs >= DAY_MS;

  const resolvedBy = request.resolvedBy ?? null;
  const resolvedByLabel =
    resolvedBy === 'BOTH'
      ? t.both
      : resolvedBy === 'CUSTOMER'
        ? t.customer
        : resolvedBy === 'SUPERVISOR'
          ? t.supervisor
          : t.none;
  const resolvedByCls =
    resolvedBy === 'BOTH'
      ? 'bg-success/10 text-success ring-1 ring-success/20'
      : resolvedBy
        ? 'bg-gold-100 text-gold-600 ring-1 ring-gold-200/70'
        : 'bg-surface-soft text-ink-muted';

  async function post(path: string, body?: unknown): Promise<boolean> {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api-proxy/me/maintenance-requests/${request.id}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) throw new Error();
      startTransition(() => router.refresh());
      return true;
    } catch {
      setError(t.fail);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function onConfirm(e: FormEvent) {
    e.preventDefault();
    if (rating < 1) {
      setError(t.pick);
      return;
    }
    await post('confirm-resolution', { rating, note: note.trim() || undefined });
  }

  const working = busy || pending;

  return (
    <section className="space-y-4 rounded-2xl border border-hairline bg-surface p-6 shadow-sm sm:p-8">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-gold-500" aria-hidden />
        <h2 className="text-lg font-bold text-ink-strong">{t.title}</h2>
      </div>

      {/* Status badges */}
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold', resolvedByCls)}>
          {resolvedByLabel}
        </span>
        {isOverdue && (
          <span className="inline-flex items-center gap-1 rounded-full bg-error/10 px-2.5 py-1 text-xs font-bold text-error ring-1 ring-error/20">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            {overdueDays > 0 ? t.overdueDays(overdueDays) : t.overdueHours(overdueHours)}
          </span>
        )}
        {request.unresolvedAt && (
          <span className="inline-flex items-center rounded-full bg-error/10 px-2.5 py-1 text-xs font-bold text-error ring-1 ring-error/20">
            {t.unresolved}
          </span>
        )}
        {request.complaintAt && (
          <span className="inline-flex items-center rounded-full bg-warning/10 px-2.5 py-1 text-xs font-bold text-warning ring-1 ring-warning/20">
            {t.complained}
          </span>
        )}
      </div>

      {/* SLA + confirmation timestamps */}
      <div className="grid grid-cols-2 gap-3 border-t border-hairline pt-4 text-xs sm:grid-cols-2">
        <Meta label={t.target} value={request.dueAt ? formatDate(request.dueAt) : t.afterApproval} />
        <Meta label={t.supervisorConfirm} value={request.supervisorConfirmedResolutionAt ? formatDate(request.supervisorConfirmedResolutionAt) : t.notYet} />
        {request.complaintAt && <Meta label={t.complaintDate} value={formatDate(request.complaintAt)} />}
        {request.unresolvedAt && <Meta label={t.unresolvedDate} value={formatDate(request.unresolvedAt)} />}
      </div>

      {error && (
        <p className="flex items-start gap-1.5 rounded-xl bg-error/5 px-3 py-2.5 text-xs text-error">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      {/* Complaint action */}
      {canComplain && (
        <div className="border-t border-hairline pt-4">
          <p className="text-xs text-ink-muted">
            {t.overdueNote}
          </p>
          <button
            type="button"
            onClick={() => post('complaint')}
            disabled={working}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-navy px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-navy/90 disabled:opacity-60"
          >
            <MessageSquareWarning className="h-3.5 w-3.5" aria-hidden />
            {t.complain}
          </button>
        </div>
      )}

      {/* Confirm resolution + rating */}
      {alreadyConfirmed ? (
        <div className="border-t border-hairline pt-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-ink-strong">{t.yours}</span>
            {request.customerRating ? <Stars value={request.customerRating} /> : null}
          </div>
          {request.customerRatingText && (
            <p className="mt-2 text-xs leading-relaxed text-ink-muted" dir="auto">{request.customerRatingText}</p>
          )}
          <p className="mt-1 text-[11px] text-ink-muted">
            {t.confirmedOn(formatDate(request.customerConfirmedResolutionAt))}
          </p>
        </div>
      ) : canConfirm ? (
        <form onSubmit={onConfirm} className="border-t border-hairline pt-4">
          <p className="text-xs font-semibold text-ink-strong">{t.ask}</p>
          <div className="mt-2 flex items-center gap-1" role="radiogroup" aria-label={t.group}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={t.stars(n)}
                onClick={() => setRating(n)}
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(0)}
                className="p-0.5"
                disabled={working}
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
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={1000}
            rows={2}
            placeholder={t.note}
            className="mt-3 w-full rounded-xl border border-hairline bg-surface px-3 py-2 text-sm focus:border-navy/50 focus:outline-none focus:ring-2 focus:ring-navy/15"
            disabled={working}
          />
          <button
            type="submit"
            disabled={working}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-navy px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-navy/90 disabled:opacity-60"
          >
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            {t.confirm}
          </button>
        </form>
      ) : null}
    </section>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-ink-muted">{label}</p>
      <p className="mt-0.5 font-semibold text-ink-strong" dir="auto">{value}</p>
    </div>
  );
}
