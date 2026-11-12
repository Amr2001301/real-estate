import { redirect } from 'next/navigation';
import { Price } from '@/components/currency/CurrencyProvider';
import { Wallet } from 'lucide-react';
import { pageMeta } from '@/lib/page-meta';
import { routes } from '@/lib/routes';
import { getLocale } from '@/lib/locale';
import { siteT } from '@/messages/site';
import { authFetch, AuthError } from '@/lib/api-auth';
import { formatNumber } from '@/lib/format';
import type { MeDepositsResponse } from '@/lib/api-types';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { DepositCard } from '@/components/account/DepositCard';
import { SubmitProofTrigger } from '@/components/account/SubmitProofTrigger';
import { AccountPageHeader } from '@/components/account/AccountPageHeader';
import { PaymentsTabs } from '@/components/account/PaymentsTabs';

export async function generateMetadata() {
  return pageMeta('deposits', { robots: { index: false, follow: false } });
}

function TotalItem({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-hairline bg-surface-soft/60 p-2 text-center">
      <div className="text-[10px] font-medium text-ink-muted">{label}</div>
      <div className="mt-1 text-xs font-bold text-ink" dir="auto">
        {value ? <Price value={value} /> : '—'}
      </div>
    </div>
  );
}

export default async function AccountDepositsPage() {
  const locale = await getLocale();
  const m = siteT(locale).accountPages.deposits;

  const pm = siteT(locale).accountPages.payments;
  // One «المدفوعات» page with two tabs (owner, 2026-11-12): this is «الدفعات المسجّلة».
  const header = (
    <>
      <AccountPageHeader title={pm.title} description={pm.description} />
      <PaymentsTabs active="paid" locale={locale} />
    </>
  );

  let result: MeDepositsResponse;
  try {
    // Fixed list endpoint (no page params); render all rows + totals.
    result = await authFetch<MeDepositsResponse>('/me/deposits');
  } catch (e) {
    if (e instanceof AuthError) redirect('/login');
    return (
      <div className="space-y-8">
        {header}
        <ErrorState
          title={m.errorTitle}
          message={m.errorMsg}
          className="mx-auto max-w-2xl"
        />
      </div>
    );
  }

  const deposits = result.data;
  const totals = result.totals;

  return (
    <div className="space-y-8">
      {header}

      <SubmitProofTrigger />

      {deposits.length === 0 ? (
        <EmptyState
          title={m.emptyTitle}
          message={m.emptyMsg}
          icon={<Wallet className="h-6 w-6" aria-hidden />}
          action={
            <ButtonLink href={routes.account} variant="outline" size="md">
              {m.backToDashboard}
            </ButtonLink>
          }
        />
      ) : (
        <>
          {/* Totals summary (real figures only) */}
          {totals && (
            <div className="grid grid-cols-1 items-center gap-6 rounded-2xl border border-hairline bg-surface p-6 shadow-sm md:grid-cols-3">
              {/* Main metric — far right */}
              <div>
                <div className="text-[11px] font-medium text-ink-muted">{m.totalPayments}</div>
                <div className="mt-1 font-display text-2xl font-black tracking-tight text-ink-strong" dir="auto">
                  <Price value={totals.totalAmount} />
                </div>
                <span className="mt-1 inline-block rounded-md bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
                  {formatNumber(totals.count, locale)} {m.depositLabel}
                </span>
              </div>

              {/* Breakdown — left two-thirds, separated by a desktop divider */}
              <div className="md:col-span-2 md:border-s md:border-hairline md:ps-6">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <TotalItem label={m.catBooking} value={totals.bookingAmount} />
                  <TotalItem label={m.catFirst} value={totals.downPayment} />
                  <TotalItem label={m.catInstallment} value={totals.installment} />
                  <TotalItem label={m.catFinal} value={totals.finalPayment} />
                  {/* So the boxes add up to the total when fees were paid. */}
                  {Number(totals.fees ?? 0) > 0 && <TotalItem label={m.catFees} value={totals.fees!} />}
                </div>
              </div>
            </div>
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
