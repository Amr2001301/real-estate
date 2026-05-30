import { BookmarkCheck, Building2, Home, Clock, User2 } from 'lucide-react';
import { formatPrice, pickAr, unitTypeLabel } from '@/lib/format';
import type { MeReservation, MeReservationBookingPaymentStatus } from '@/lib/api-types';
import { PremiumCard } from '@/components/ui/PremiumCard';
import { StatusBadge } from '@/components/account/StatusBadge';

const BOOKING_PAYMENT_LABELS: Record<
  MeReservationBookingPaymentStatus,
  { label: string; tone: 'success' | 'accent' | 'muted' | 'neutral' }
> = {
  UNPAID: { label: 'لم تُسدَّد', tone: 'muted' },
  PENDING: { label: 'قيد التأكيد', tone: 'accent' },
  PAID: { label: 'مدفوعة', tone: 'success' },
  WAIVED: { label: 'مُعفاة', tone: 'neutral' },
};

const PAYMENT_TONE_CLASS: Record<'success' | 'accent' | 'muted' | 'neutral', string> = {
  success: 'bg-success/10 text-success',
  accent: 'bg-gold-100 text-gold-600',
  muted: 'bg-surface-soft text-ink-muted',
  neutral: 'bg-navy/[0.06] text-ink-strong',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('ar', { dateStyle: 'medium' }).format(new Date(iso));
  } catch {
    return '—';
  }
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-ink-muted">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-ink-strong" dir="auto">
        {value}
      </div>
    </div>
  );
}

export function ReservationCard({ reservation }: { reservation: MeReservation }) {
  const project = reservation.unit?.building?.phase?.project ?? null;
  const projectName = project ? pickAr(project.name) : '';
  const unitLabel = reservation.unit
    ? `${unitTypeLabel(reservation.unit.type)} · ${reservation.unit.code}`
    : '';
  const subtitle = [projectName, unitLabel].filter(Boolean).join(' — ');
  const payment = BOOKING_PAYMENT_LABELS[reservation.bookingPaymentStatus];

  return (
    <PremiumCard className="p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-100 text-gold-600">
            <BookmarkCheck className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 className="line-clamp-1 text-base font-semibold text-ink-strong">
              حجز رقم {reservation.reservationNumber ?? '—'}
            </h3>
            {subtitle && (
              <p className="mt-0.5 line-clamp-1 flex items-center gap-1.5 text-xs text-ink-muted">
                {reservation.unit ? (
                  <Home className="h-3.5 w-3.5 shrink-0 text-gold-500" aria-hidden />
                ) : (
                  <Building2 className="h-3.5 w-3.5 shrink-0 text-gold-500" aria-hidden />
                )}
                <span className="line-clamp-1">{subtitle}</span>
              </p>
            )}
          </div>
        </div>
        <StatusBadge status={reservation.status} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 border-t border-hairline pt-4 sm:grid-cols-3">
        <Fact label="مبلغ الحجز" value={formatPrice(reservation.bookingAmount)} />
        <div>
          <div className="text-xs text-ink-muted">حالة الدفع</div>
          <span
            className={`mt-0.5 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${PAYMENT_TONE_CLASS[payment.tone]}`}
          >
            {payment.label}
          </span>
        </div>
        <Fact
          label="ينتهي في"
          value={formatDate(reservation.expiresAt)}
        />
        {reservation.bookingPaidAt && (
          <Fact label="تاريخ السداد" value={formatDate(reservation.bookingPaidAt)} />
        )}
        {reservation.sales && (
          <div className="sm:col-span-2">
            <div className="text-xs text-ink-muted">المسؤول المختص</div>
            <div className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-ink-strong">
              <User2 className="h-4 w-4 text-gold-500" aria-hidden />
              {reservation.sales.fullName}
            </div>
          </div>
        )}
      </div>

      <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-ink-muted">
        <Clock className="h-3.5 w-3.5 text-gold-500" aria-hidden />
        أُنشئ في {formatDate(reservation.createdAt)}
      </p>
    </PremiumCard>
  );
}
