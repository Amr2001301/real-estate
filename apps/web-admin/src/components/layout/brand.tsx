import Link from 'next/link';
import { Building2 } from 'lucide-react';
import { cn } from '@/lib/cn';

interface Props {
  className?: string;
  href?: string;
  compact?: boolean;
  /** "dark" = on navy sidebar; "light" = on white surfaces (login). */
  theme?: 'dark' | 'light';
}

export function Brand({
  className,
  href = '/dashboard',
  compact = false,
  theme = 'dark',
}: Props) {
  const isDark = theme === 'dark';

  return (
    <Link
      href={href as never}
      className={cn(
        'inline-flex items-center gap-3 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 rounded-lg',
        className,
      )}
    >
      <span
        className={cn(
          'inline-flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-md',
          'bg-gradient-to-br from-brand-400 via-brand-500 to-brand-700',
          'ring-1 ring-inset ring-white/10',
        )}
      >
        <Building2 className="h-[20px] w-[20px]" strokeWidth={2} />
      </span>
      {!compact && (
        <span className="flex flex-col leading-tight">
          <span
            className={cn(
              'text-[15px] font-bold tracking-tight',
              isDark ? 'text-white' : 'text-slate-900',
            )}
          >
            إدارة العقارات
          </span>
          <span
            className={cn(
              'text-[11px] mt-0.5',
              isDark ? 'text-sidebar-text-muted' : 'text-slate-500',
            )}
          >
            بوابة المسؤولين
          </span>
        </span>
      )}
    </Link>
  );
}
