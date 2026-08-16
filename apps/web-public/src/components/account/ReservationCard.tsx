import { BookmarkCheck, Building2, Home, Clock, User2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatPrice, pickAr, unitTypeLabel } from '@/lib/format';
import type { MeReservation, MeReservationBookingPaymentStatus } from '@/lib/api-types';
import { getLocale } from '@/lib/locale';
import { AccountCard, AccountCardIcon, type AccountCardAccent } from '@/components/account/AccountCard';
import { StatusBadge } from '@/components/account/StatusBadge';
import { BookingPaymentProof } from '@/components/account/BookingPaymentProof';

// P8 — customer-facing payment-status copy. Aligned with the rename of the
// admin action from "تأكيد سداد" → "تأكيد استلام": the admin records that
// they received the money, the customer sees the verification status.
//
// Customer-uploaded payment proof is NOT yet implemented (see
// docs/p8-gaps.md). Today PENDING is only set by the admin choosing the
// PENDING state explicitly; once a customer receipt-upload flow exists,
// PENDING should auto-fire when proof is uploaded but not yet verified.
const BOOKING_PAYMENT_LABELS: Record<
  MeReservationBookingPaymentStatus,
  { label: string; tone: 'success' | 'accent' | 'muted' | 'neutral' }
> = {
  UNPAID: { label: 'غير مدفوع', tone: 'muted' },
  PENDING: { label: 'بانتظار المراجعة', tone: 'accent' },
  PAID: { label: 'مدفوع — تم التحقق', tone: 'success' },
  WAIVED: { label: 'مُعفى', tone: 'neutral' },
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

/** A single data block in the 3-up row. A hairline separator on the start edge
 *  (md+) gives each number room to breathe; the first block omits it. */
function Block({
  label,
  separator,
  children,
}: {
  label: string;
  separator?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('min-w-0', separator && 'md:border-s md:border-hairline/70 md:ps-6')}>
      <div className="mb-1 text-xs font-medium tracking-wide text-ink-muted">{label}</div>
      {children}
    </div>
  );
}

export async function ReservationCard({ reservation }: { reservation: MeReservation }) {
  const locale = await getLocale();
  const project = reservation.unit?.building?.phase?.project ?? null;
  const projectName = project ? pickAr(project.name) : '';
  const unitLabel = reservation.unit
    ? `${unitTypeLabel(reservation.unit.type)} · ${reservation.unit.code}`
    : '';
  const subtitle = [projectName, unitLabel].filter(Boolean).join(' — ');
  const payment = BOOKING_PAYMENT_LABELS[reservation.bookingPaymentStatus];

  // Gap 3 — booking-amount payment proof entry point. Show only on active
  // reservations (PENDING/APPROVED) with a positive booking amount that isn't
  // already paid/waived or awaiting review. A rejected proof surfaces the
  // reason and a resubmit CTA.
  const bookingDeposit = reservation.bookingDeposit ?? null;
  const isActive = reservation.status === 'PENDING' || reservation.status === 'APPROVED';
  const hasBookingDue = Number(reservation.bookingAmount) > 0;
  const rejected = bookingDeposit?.reviewStatus === 'REJECTED';
  const awaitingReview =
    reservation.bookingPaymentStatus === 'PENDING' ||
    bookingDeposit?.reviewStatus === 'PENDING_REVIEW';
  const canSubmitProof =
    isActive &&
    hasBookingDue &&
    reservation.bookingPaymentStatus !== 'PAID' &&
    reservation.bookingPaymentStatus !== 'WAIVED' &&
    !awaitingReview;

  const accent: AccountCardAccent =
    reservation.status === 'CONVERTED'
      ? 'success'
      : reservation.status === 'CANCELLED' || reservation.status === 'EXPIRED' || reservation.status === 'REJECTED'
        ? 'muted'
        : 'gold';

  return (
    <AccountCard accent={accent} className="p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <AccountCardIcon>
            <BookmarkCheck className="h-5 w-5" aria-hidden />
          </AccountCardIcon>
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

      {/* ── Three balanced data blocks with breathing-room separators ── */}
      <div className="mt-5 grid grid-cols-1 gap-6 border-t border-hairline pt-5 sm:grid-cols-3 sm:items-center sm:gap-0">
        <Block label="مبلغ الحجز">
          <div className="text-sm font-semibold text-ink-strong" dir="auto">
            {formatPrice(reservation.bookingAmount)}
          </div>
        </Block>
        <Block label="حالة الدفع" separator>
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium',
              PAYMENT_TONE_CLASS[payment.tone],
            )}
          >
            {payment.label}
          </span>
        </Block>
        <Block label="ينتهي في" separator>
          <div className="text-sm font-semibold text-ink-strong" dir="auto">
            {formatDate(reservation.expiresAt)}
          </div>
        </Block>
      </div>

      {/* ── Footer metadata: specialist + paid date (start) ⟷ created (end) ── */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-hairline pt-3.5 text-xs text-ink-muted">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5">
          {reservation.sales && (
            <span className="inline-flex items-center gap-1.5">
              <User2 className="h-3.5 w-3.5 shrink-0 text-gold-500" strokeWidth={1.5} aria-hidden />
              المسؤول المختص:
              <span className="font-semibold text-ink-strong">{reservation.sales.fullName}</span>
            </span>
          )}
          {reservation.bookingPaidAt && (
            <span className="inline-flex items-center gap-1.5">
              تاريخ السداد:
              <span className="font-semibold text-ink-strong" dir="auto">
                {formatDate(reservation.bookingPaidAt)}
              </span>
            </span>
          )}
        </div>
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <Clock className="h-3.5 w-3.5 shrink-0 text-gold-500" strokeWidth={1.5} aria-hidden />
          أُنشئ في {formatDate(reservation.createdAt)}
        </span>
      </div>

      {canSubmitProof && (
        <BookingPaymentProof
          reservationId={reservation.id}
          bookingAmount={reservation.bookingAmount}
          rejected={rejected}
          rejectionReason={bookingDeposit?.rejectionReason}
          locale={locale}
        />
      )}
    </AccountCard>
  );
}
