import { redirect } from 'next/navigation';
import type { Route } from 'next';
import Link from 'next/link';
import { CalendarClock, CheckCircle2, Clock, AlertCircle, Building2, Home, Upload } from 'lucide-react';
import { buildMetadata } from '@/lib/seo';
import { routes } from '@/lib/routes';
import { authFetch, AuthError } from '@/lib/api-auth';
import { pickAr, unitTypeLabel, formatPrice } from '@/lib/format';
import type { Paginated, MeInstallment } from '@/lib/api-types';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { AccountPageHeader } from '@/components/account/AccountPageHeader';
import { AccountCard, type AccountCardAccent } from '@/components/account/AccountCard';
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
  success: 'bg-success/10 text-success ring-1 ring-success/20',
  accent: 'bg-gold-100 text-gold-600 ring-1 ring-gold-200/70',
  muted: 'bg-surface-soft text-ink-muted',
  error: 'bg-error/10 text-error ring-1 ring-error/20',
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
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
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
    <AccountCard accent={accent} interactive className="flex h-full flex-col p-5">
      {/* ── Top row: status pill (start) ⟷ contract code tag (end) ── */}
      <div className="flex items-center justify-between gap-3">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold',
            STATUS_TONE_CLS[tone],
          )}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden />
          {label}
        </span>
        {contract?.contractNumber && (
          <span className="rounded-md bg-surface-soft px-2 py-0.5 font-mono text-[11px] font-bold text-ink-muted">
            {contract.contractNumber}
          </span>
        )}
      </div>

      {/* ── Hero centerpiece: amount + property ── */}
      <div className="my-4 flex flex-col items-center justify-center rounded-xl border border-hairline/70 bg-surface-soft/50 p-4 text-center">
        <div className="font-display text-xl font-black tracking-tight text-ink-strong" dir="auto">
          {formatPrice(installment.amount)}
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-ink">
          {contract?.unit ? (
            <Home className="h-3.5 w-3.5 shrink-0 text-gold-500" aria-hidden />
          ) : (
            <Building2 className="h-3.5 w-3.5 shrink-0 text-gold-500" aria-hidden />
          )}
          <span className="line-clamp-1">{subtitle || 'وحدة'}</span>
        </p>
      </div>

      {/* ── Timeline metadata ── */}
      <div className="mt-auto grid grid-cols-2 gap-2 border-t border-hairline/70 pt-3 text-[11px] text-ink-muted">
        <span dir="auto">الاستحقاق: {formatDate(installment.dueDate)}</span>
        <span className="text-end" dir="auto">
          {installment.paidAt ? `السداد: ${formatDate(installment.paidAt)}` : 'الحالة: لم يُسدّد'}
        </span>
      </div>

      {/* ── Action ── */}
      {canSubmit ? (
        <Link
          href={
            {
              pathname: routes.accountDeposits,
              query: { submit: 'proof', installmentId: installment.id, amount: installment.amount },
            } as unknown as Route
          }
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-navy py-2.5 text-xs font-medium text-white transition-all hover:bg-navy-700"
        >
          <Upload className="h-3.5 w-3.5" aria-hidden />
          إرسال إثبات الدفع
        </Link>
      ) : (
        <span className="mt-3 flex w-full items-center justify-center gap-1 rounded-xl bg-success/[0.06] py-2 text-xs font-semibold text-success">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          تم السداد والتحقق
        </span>
      )}
    </AccountCard>
  );
}
