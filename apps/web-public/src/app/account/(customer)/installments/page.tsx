import { redirect } from 'next/navigation';
import type { Route } from 'next';
import Link from 'next/link';
import { CalendarClock, CheckCircle2, Clock, AlertCircle, Building2, Home, FileText, Upload } from 'lucide-react';
import { buildMetadata } from '@/lib/seo';
import { routes } from '@/lib/routes';
import { authFetch, AuthError } from '@/lib/api-auth';
import { pickAr, unitTypeLabel, formatPrice } from '@/lib/format';
import type { Paginated, MeInstallment } from '@/lib/api-types';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { AccountPageHeader } from '@/components/account/AccountPageHeader';
import { AccountCard, AccountCardIcon, type AccountCardAccent } from '@/components/account/AccountCard';
import { cn } from '@/lib/cn';

export const metadata = buildMetadata({
  title: 'الأقساط',
  description: 'جدول أقساط عقودك في ديفورا.',
  robots: { index: false, follow: false },
});

const STATUS_LABELS: Record<MeInstallment['status'], { label: string; tone: 'success' | 'accent' | 'muted' | 'error' }> = {
  PENDING: { label: 'قيد الاستحقاق', tone: 'accent' },
  PAID: { label: 'مدفوع', tone: 'success' },
  OVERDUE: { label: 'متأخر', tone: 'error' },
};

const STATUS_TONE_CLS: Record<'success' | 'accent' | 'muted' | 'error', string> = {
  success: 'bg-success/10 text-success',
  accent: 'bg-gold-100 text-gold-600',
  muted: 'bg-surface-soft text-ink-muted',
  error: 'bg-error/10 text-error',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('ar', { dateStyle: 'medium' }).format(new Date(iso));
  } catch {
    return '—';
  }
}

function statusIcon(status: MeInstallment['status']) {
  if (status === 'PAID') return CheckCircle2;
  if (status === 'OVERDUE') return AlertCircle;
  return Clock;
}

export default async function AccountInstallmentsPage() {
  let result: Paginated<MeInstallment>;
  try {
    result = await authFetch<Paginated<MeInstallment>>('/me/installments?page=1&pageSize=200');
  } catch (e) {
    if (e instanceof AuthError) redirect('/login');
    return (
      <div className="space-y-8">
        <Header />
        <ErrorState
          title="تعذّر تحميل الأقساط حاليًا"
          message="يرجى المحاولة مرة أخرى بعد لحظات."
          className="mx-auto max-w-2xl"
        />
      </div>
    );
  }

  const installments = result.data;

  return (
    <div className="space-y-8">
      <Header />

      {installments.length === 0 ? (
        <EmptyState
          title="لا توجد أقساط بعد"
          message="ستظهر هنا أقساط عقدك مع تاريخ كل قسط وحالته."
          icon={<CalendarClock className="h-6 w-6" aria-hidden />}
          action={
            <ButtonLink href={routes.accountContracts} variant="outline" size="md">
              عرض عقودي
            </ButtonLink>
          }
        />
      ) : (
        <div className="space-y-4">
          {installments.map((inst) => (
            <InstallmentRow key={inst.id} installment={inst} />
          ))}
        </div>
      )}
    </div>
  );
}

function Header() {
  return (
    <AccountPageHeader
      title="جدول الأقساط"
      description="مواعيد دفع الأقساط، الحالة، وإمكانية إرسال إثبات الدفع للأقساط غير المدفوعة."
    />
  );
}

function InstallmentRow({ installment }: { installment: MeInstallment }) {
  const contract = installment.plan?.contract ?? null;
  const project = contract?.unit?.building?.phase?.project ?? null;
  const projectName = project ? pickAr(project.name) : '';
  const unitLabel = contract?.unit
    ? `${unitTypeLabel(contract.unit.type)} · ${contract.unit.code}`
    : '';
  const subtitle = [projectName, unitLabel].filter(Boolean).join(' — ');
  const { label, tone } = STATUS_LABELS[installment.status];
  const Icon = statusIcon(installment.status);
  const canSubmit = installment.status !== 'PAID';
  const accent: AccountCardAccent =
    installment.status === 'PAID' ? 'success' : installment.status === 'OVERDUE' ? 'error' : 'gold';

  return (
    <AccountCard accent={accent}>
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        {/* Identity */}
        <div className="flex min-w-0 items-center gap-3">
          <AccountCardIcon>
            <CalendarClock className="h-5 w-5" aria-hidden />
          </AccountCardIcon>
          <div className="min-w-0">
            <p className="text-xs text-ink-muted">قسط مستحق {formatDate(installment.dueDate)}</p>
            {subtitle && (
              <h3 className="mt-0.5 line-clamp-1 flex items-center gap-1.5 text-sm font-semibold text-ink-strong">
                {contract?.unit ? (
                  <Home className="h-3.5 w-3.5 shrink-0 text-gold-500" aria-hidden />
                ) : (
                  <Building2 className="h-3.5 w-3.5 shrink-0 text-gold-500" aria-hidden />
                )}
                <span className="line-clamp-1">{subtitle}</span>
              </h3>
            )}
          </div>
        </div>

        {/* Amount + status — the financial hero */}
        <div className="ps-14 text-start sm:ps-0 sm:text-end">
          <div className="font-display text-2xl font-bold leading-none text-ink-strong">
            {formatPrice(installment.amount)}
          </div>
          <span
            className={cn(
              'mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
              STATUS_TONE_CLS[tone],
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {label}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-hairline px-5 py-3 text-xs text-ink-muted">
        {installment.paidAt ? (
          <span>تاريخ السداد: {formatDate(installment.paidAt)}</span>
        ) : (
          <span>لم يُسدّد بعد</span>
        )}
        <div className="flex items-center gap-2">
          {contract && (
            <Link
              href={`${routes.accountContracts}` as Route}
              className="inline-flex items-center gap-1 font-medium text-gold-600 hover:text-gold-500"
            >
              <FileText className="h-3.5 w-3.5" aria-hidden />
              العقد {contract.contractNumber ?? '—'}
            </Link>
          )}
          {canSubmit && (
            <Link
              href={
                {
                  pathname: routes.accountDeposits,
                  query: { submit: 'proof', installmentId: installment.id, amount: installment.amount },
                } as unknown as Route
              }
              className="inline-flex items-center gap-1 rounded-full bg-navy px-3 py-1.5 font-medium text-white transition-colors hover:bg-navy-700"
            >
              <Upload className="h-3.5 w-3.5" aria-hidden />
              إرسال إثبات الدفع
            </Link>
          )}
        </div>
      </div>
    </AccountCard>
  );
}
