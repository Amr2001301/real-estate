import Link from 'next/link';
import { cn } from '@/lib/cn';
import type { Locale } from '@/lib/locale';
import { uiT } from '@/messages/ui';

export function ReportsTabs({ active, locale = 'ar', showSales = true, showFinancial = true }: { active: 'sales' | 'financial'; locale?: Locale; showSales?: boolean; showFinancial?: boolean }) {
  const m = uiT(locale).pages.reports;
  const TABS = [
    { key: 'sales' as const, href: '/dashboard/reports', label: m.tabSalesLabel },
    { key: 'financial' as const, href: '/dashboard/reports/financial', label: m.tabFinancialLabel },
  ].filter((t) => (t.key === 'sales' ? showSales : showFinancial));

  return (
    <div className="flex gap-8 border-b border-hairline">
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href as never}
          className={cn(
            // U5: thin tabs, a gold underline on the active one.
            'font-heading pb-3 text-[17px] font-bold border-b-2 -mb-px transition-colors duration-150',
            active === tab.key
              ? 'border-[#C79A3B] text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800',
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
