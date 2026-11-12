import type { Route } from 'next';
import Link from 'next/link';
import { CalendarClock, Wallet } from 'lucide-react';
import { cn } from '@/lib/cn';
import { routes } from '@/lib/routes';
import type { Locale } from '@/lib/locale';
import { siteT } from '@/messages/site';

/**
 * «المدفوعات»: the instalment schedule and the recorded payments are one
 * place for the owner — two tabs, not two sidebar entries (owner, 2026-11-12).
 */
export function PaymentsTabs({ active, locale = 'ar' }: { active: 'schedule' | 'paid'; locale?: Locale }) {
  const m = siteT(locale).accountPages.payments;
  const tabs = [
    { key: 'schedule' as const, href: routes.accountInstallments, label: m.tabSchedule, icon: CalendarClock },
    { key: 'paid' as const, href: routes.accountDeposits, label: m.tabPaid, icon: Wallet },
  ];
  return (
    <nav className="-mt-4 mb-8 flex gap-1 rounded-2xl border border-hairline bg-surface p-1" aria-label={m.title} data-testid="payments-tabs">
      {tabs.map(({ key, href, label, icon: Icon }) => (
        <Link
          key={key}
          href={href as Route}
          aria-current={active === key ? 'page' : undefined}
          className={cn(
            'inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors',
            active === key ? 'bg-navy text-white shadow-sm' : 'text-ink-muted hover:bg-surface-soft hover:text-ink-strong',
          )}
        >
          <Icon className="h-4 w-4" aria-hidden />
          {label}
        </Link>
      ))}
    </nav>
  );
}
