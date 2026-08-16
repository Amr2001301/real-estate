import Link from 'next/link';
import { cn } from '@/lib/cn';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';

export function ReportsTabs({ active, locale = 'ar' }: { active: 'sales' | 'financial'; locale?: Locale }) {
  const m = uiT(locale).pages.reports;
  const TABS = [
    { key: 'sales' as const, href: '/dashboard/reports', label: m.tabSalesLabel },
    { key: 'financial' as const, href: '/dashboard/reports/financial', label: m.tabFinancialLabel },
  ];

  return (
    <div className="flex gap-0 border-b border-hairline">
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href as never}
          className={cn(
            'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors duration-150',
            active === tab.key
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300',
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
