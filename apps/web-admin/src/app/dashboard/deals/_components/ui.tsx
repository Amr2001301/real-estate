import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { Locale } from '@/lib/locale';
import { dealsT, type ClaimStatus, type DealStatus } from '@/components/deals/messages';

export type Tone = 'green' | 'amber' | 'rose' | 'slate' | 'gold' | 'navy';

export function Pill({ tone, children, className }: { tone: Tone; children: React.ReactNode; className?: string }) {
  const cls = {
    green: 'bg-success-50 text-success-700 border-success-100',
    amber: 'bg-amber-500/10 text-amber-700 border-amber-500/25',
    rose: 'bg-danger-50 text-danger-700 border-danger-100',
    slate: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
    gold: 'bg-[#D8B66A]/12 text-brand-700 border-[#D8B66A]/35',
    navy: 'bg-[#0E1626] text-[#F4ECD8] border-[#0E1626] dark:bg-[#D8B66A]/15 dark:text-[#E6C77E] dark:border-[#D8B66A]/35',
  }[tone];
  return <span className={cn('inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11.5px] font-bold', cls, className)}>{children}</span>;
}

export const CLAIM_TONE: Record<ClaimStatus, Tone> = { PENDING: 'slate', SUBMITTED: 'gold', PARTIALLY_PAID: 'amber', PAID: 'green', REJECTED: 'rose' };
export const DEAL_TONE: Record<DealStatus, Tone> = { CLOSED: 'green', CANCELLED: 'slate' };

export function Panel({ icon, title, sub, action, children, className, testId }: {
  icon: React.ReactNode;
  title: string;
  sub?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <section className={cn('rounded-[22px] border border-hairline bg-surface p-5 sm:p-6', className)} data-testid={testId}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#D8B66A]/45 bg-[#0E1626] text-[#E6C77E] [&_svg]:h-[18px] [&_svg]:w-[18px]">
            {icon}
          </span>
          <div className="min-w-0">
            <h2 className="font-heading text-[17px] font-bold text-slate-900">{title}</h2>
            {sub && <p className="mt-0.5 text-[12.5px] text-slate-500">{sub}</p>}
          </div>
        </div>
        {action}
      </header>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function ErrorLine({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <p role="alert" className="flex items-start gap-2 rounded-xl bg-danger-500/10 px-3 py-2 text-[12.5px] font-medium text-danger-700">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
    </p>
  );
}

/** A thin gold bar: how much of a commission is collected. */
export function CollectedBar({ value, total, className }: { value: number; total: number; className?: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <span className={cn('block h-1.5 w-full overflow-hidden rounded-full bg-slate-500/15', className)} aria-hidden>
      <span className={cn('block h-full rounded-full', pct >= 100 ? 'bg-success-500' : 'bg-[#C79A3B]')} style={{ width: `${pct}%` }} />
    </span>
  );
}

export type DealsTab = 'deals' | 'claims' | 'payouts' | 'rules';

/** The section's tabs: deals, then the money pages (claims for the admin only). */
export function DealsTabs({ active, locale, isAdmin }: { active: DealsTab; locale: Locale; isAdmin: boolean }) {
  const t = dealsT(locale).tabs;
  const tabs: Array<{ key: DealsTab; href: string; label: string }> = [
    { key: 'deals', href: '/dashboard/deals', label: t.deals },
    ...(isAdmin ? [{ key: 'claims' as const, href: '/dashboard/deals/claims', label: t.claims }] : []),
    { key: 'payouts', href: '/dashboard/deals/payouts', label: isAdmin ? t.payouts : t.myPayouts },
    { key: 'rules', href: '/dashboard/deals/rules', label: t.rules },
  ];
  return (
    <nav aria-label={dealsT(locale).list.title} className="-mx-1 flex gap-1 overflow-x-auto border-b border-hairline px-1">
      {tabs.map((tab) => {
        const on = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={tab.href as never}
            aria-current={on ? 'page' : undefined}
            data-testid={`deals-tab-${tab.key}`}
            className={cn(
              'relative shrink-0 px-4 pb-3 pt-1 text-[13.5px] font-bold transition-colors',
              on ? 'text-slate-900' : 'text-slate-500 hover:text-slate-800',
            )}
          >
            {tab.label}
            {on && <span className="absolute inset-x-3 -bottom-px h-[2px] rounded-full bg-[#C79A3B]" />}
          </Link>
        );
      })}
    </nav>
  );
}
