import { cn } from '@/lib/cn';

type Tone = 'neutral' | 'accent' | 'success' | 'error' | 'muted';

const TONE_CLASS: Record<Tone, string> = {
  neutral: 'bg-navy/[0.06] text-ink-strong',
  accent: 'bg-gold-100 text-gold-600',
  success: 'bg-success/10 text-success',
  error: 'bg-error/10 text-error',
  muted: 'bg-surface-soft text-ink-muted',
};

/**
 * Arabic labels + tones for both the VisitRequestStatus (request lifecycle)
 * and VisitStatus (scheduling) enums. Unknown values fall back to a neutral
 * pill showing the raw value rather than throwing.
 */
const STATUS_MAP: Record<string, { label: string; tone: Tone }> = {
  // VisitRequestStatus
  NEW: { label: 'جديد', tone: 'neutral' },
  UNDER_REVIEW: { label: 'قيد المراجعة', tone: 'accent' },
  CONVERTED: { label: 'تم التحويل', tone: 'success' },
  REJECTED: { label: 'مرفوض', tone: 'error' },
  // VisitStatus
  PENDING: { label: 'قيد الانتظار', tone: 'neutral' },
  APPROVED: { label: 'تمت الموافقة', tone: 'success' },
  SCHEDULED: { label: 'محدد', tone: 'accent' },
  COMPLETED: { label: 'مكتمل', tone: 'success' },
  // Shared
  CANCELLED: { label: 'ملغى', tone: 'muted' },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const entry = STATUS_MAP[status] ?? { label: status, tone: 'neutral' as Tone };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium',
        TONE_CLASS[entry.tone],
        className,
      )}
    >
      {entry.label}
    </span>
  );
}
