import Link from 'next/link';
import Image from 'next/image';
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
      <Image
        src="/brand/devora-logo.png"
        alt="Devora"
        width={40}
        height={40}
        priority
        className="h-10 w-10 rounded-lg object-cover shadow-md ring-1 ring-inset ring-white/10"
      />
      {!compact && (
        <span className="flex flex-col leading-tight">
          <span
            className={cn(
              'text-[15px] font-bold tracking-tight',
              isDark ? 'text-white' : 'text-slate-900',
            )}
          >
            ديفورا
          </span>
          <span
            className={cn(
              'text-[11px] mt-0.5',
              isDark ? 'text-sidebar-text-muted/80' : 'text-slate-500',
            )}
          >
            بوابة المسؤولين
          </span>
        </span>
      )}
    </Link>
  );
}
