import { redirect } from 'next/navigation';
import { Wallet, CalendarClock } from 'lucide-react';
import { buildMetadata } from '@/lib/seo';
import { routes } from '@/lib/routes';
import { authFetch, AuthError } from '@/lib/api-auth';
import { formatPrice, formatNumber } from '@/lib/format';
import type { MeDepositsResponse } from '@/lib/api-types';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { PremiumCard } from '@/components/ui/PremiumCard';
import { DepositCard } from '@/components/account/DepositCard';
import { SubmitProofTrigger } from '@/components/account/SubmitProofTrigger';
import { AccountPageHeader } from '@/components/account/AccountPageHeader';

export const metadata = buildMetadata({
  title: 'الدفعات',
  description: 'سجل دفعاتك في ديفورا.',
  robots: { index: false, follow: false },
});

function Header() {
  return (
    <AccountPageHeader
      eyebrow="ملكيتك"
      title="الدفعات"
      description="سجل دفعاتك المسجّلة لدى الشركة (للعرض فقط)."
    />
  );
}

function TotalItem({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div>
      <div className="text-xs text-ink-muted">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-ink-strong">{value ? formatPrice(value) : '—'}</div>
    </div>
  );
}

export default async function AccountDepositsPage() {
  let result: MeDepositsResponse;
  try {
    // Fixed list endpoint (no page params); render all rows + totals.
    result = await authFetch<MeDepositsResponse>('/me/deposits');
  } catch (e) {
    if (e instanceof AuthError) redirect('/login');
    return (
      <div className="space-y-8">
        <Header />
        <ErrorState
          title="تعذّر تحميل الدفعات حاليًا"
          message="يرجى المحاولة مرة أخرى بعد لحظات."
          className="mx-auto max-w-2xl"
        />
      </div>
    );
  }

  const deposits = result.data;
  const totals = result.totals;

  return (
    <div className="space-y-8">
      <Header />

      <SubmitProofTrigger />

      {/* P11 — installments shortcut so customers can pick a due installment
          and submit a proof without leaving the deposits surface. */}
      <PremiumCard className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-ink-strong">
            <CalendarClock className="h-4 w-4 text-gold-500" aria-hidden />
            <span>اعرض جدول الأقساط وأرسل إثبات الدفع للقسط المستحق.</span>
          </div>
          <ButtonLink href={routes.accountInstallments} variant="outline" size="sm">
            الأقساط
          </ButtonLink>
        </div>
      </PremiumCard>

      {deposits.length === 0 ? (
        <EmptyState
          title="لا توجد دفعات بعد"
          message="ستظهر هنا الدفعات التي يسجّلها فريقنا، مع إمكانية تحميل الإيصالات عند توفرها."
          icon={<Wallet className="h-6 w-6" aria-hidden />}
          action={
            <ButtonLink href={routes.account} variant="outline" size="md">
              العودة إلى لوحة الحساب
            </ButtonLink>
          }
        />
      ) : (
        <>
          {/* Totals summary (real figures only) */}
          {totals && (
            <PremiumCard className="p-6">
              <div className="flex flex-wrap items-end justify-between gap-6">
                <div>
                  <div className="text-sm text-ink-muted">إجمالي المدفوعات</div>
                  <div className="font-display text-3xl font-bold text-ink-strong">{formatPrice(totals.totalAmount)}</div>
                  <div className="mt-1 text-xs text-ink-muted">{formatNumber(totals.count)} دفعة</div>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
                  <TotalItem label="دفعات الحجز" value={totals.bookingAmount} />
                  <TotalItem label="الدفعات الأولى" value={totals.downPayment} />
                  <TotalItem label="الأقساط" value={totals.installment} />
                  <TotalItem label="الدفعات النهائية" value={totals.finalPayment} />
                </div>
              </div>
            </PremiumCard>
          )}

          {/* Payment history */}
          <div className="space-y-4">
            {deposits.map((deposit) => (
              <DepositCard key={deposit.id} deposit={deposit} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
