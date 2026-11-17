import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/cn';

interface Props {
  className?: string;
  href?: string;
  compact?: boolean;
  /** "dark" = on navy sidebar; "light" = on white surfaces (login). */
  theme?: 'dark' | 'light';
  /** Line under the name (defaults to the admin portal's). */
  subtitle?: string;
}

export function Brand({
  className,
  href = '/dashboard',
  compact = false,
  theme = 'dark',
  subtitle = 'بوابة المسؤولين',
}: Props) {
  const isDark = theme === 'dark';

  return (
    <Link
      href={href as never}
      className={cn(
        'inline-flex items-center gap-3 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 rounded-xl',
        className,
      )}
    >
      <Image
        src="/brand/devora-logo.png"
        alt="Devora"
        width={40}
        height={40}
        priority
        className="h-[42px] w-[42px] rounded-[13px] object-cover ring-1 ring-inset ring-[#E2C792]/25"
      />
      {!compact && (
        <span className="flex flex-col leading-tight">
          <span
            className={cn(
              'font-[Inter,system-ui,sans-serif] text-[14px] font-medium tracking-[0.32em]',
              isDark ? 'text-[#F7F3EA]' : 'text-slate-900',
            )}
          >
            DEVORA
          </span>
          <span
            className={cn(
              'text-[11.5px] mt-[3px]',
              isDark ? 'text-[#9A9486]' : 'text-slate-500',
            )}
          >
            {subtitle}
          </span>
        </span>
      )}
    </Link>
  );
}
