import { cn } from '@/lib/cn';
import { getLocale } from '@/lib/locale';
import { accountT } from '@/messages/account';

type Tone = 'neutral' | 'accent' | 'success' | 'error' | 'muted';

const TONE_CLASS: Record<Tone, string> = {
  neutral: 'bg-navy/[0.06] text-ink-strong',
  accent: 'bg-gold-100 text-gold-600',
  success: 'bg-success/10 text-success',
  error: 'bg-error/10 text-error',
  muted: 'bg-surface-soft text-ink-muted',
};

/** Tones per status; the wording comes from messages/account.ts. Unknown values show the raw value. */
const STATUS_TONE: Record<string, Tone> = {
  NEW: 'neutral', UNDER_REVIEW: 'accent', CONVERTED: 'success', REJECTED: 'error',
  PENDING: 'neutral', APPROVED: 'success', SCHEDULED: 'accent', COMPLETED: 'success',
  OPEN: 'neutral', ASSIGNED: 'accent', IN_PROGRESS: 'accent', RESOLVED: 'success', CLOSED: 'muted',
  LOW: 'muted', MEDIUM: 'neutral', HIGH: 'accent', URGENT: 'error',
  CANCELLED: 'muted', EXPIRED: 'muted',
};

export async function StatusBadge({
  status,
  label,
  className,
}: {
  status: string;
  /** Optional Arabic label override — lets callers reuse the tone-mapping
   *  while supplying context-specific wording (e.g. an appointment SCHEDULED
   *  reads "بانتظار تأكيدك" to the customer, not the generic "محدد"). */
  label?: string;
  className?: string;
}) {
  const t = accountT(await getLocale());
  const entry = { label: t.status[status] ?? status, tone: STATUS_TONE[status] ?? ('neutral' as Tone) };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium',
        TONE_CLASS[entry.tone],
        className,
      )}
    >
      {label ?? entry.label}
    </span>
  );
}
