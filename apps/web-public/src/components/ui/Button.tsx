import Link from 'next/link';
import type { Route } from 'next';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'gold' | 'outline' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  // Refined dark navy CTA — the primary conversion button.
  primary:
    'bg-navy text-white shadow-soft hover:bg-navy-700 active:bg-navy-700',
  // Gold accent — used sparingly for premium emphasis.
  gold: 'bg-gold-400 text-navy shadow-soft hover:bg-gold-300 active:bg-gold-500',
  outline:
    'border border-hairline/20 text-ink-strong bg-transparent hover:border-hairline/40 hover:bg-navy/[0.03]',
  ghost: 'text-ink-strong hover:bg-navy/[0.05]',
};

const SIZES: Record<Size, string> = {
  sm: 'h-10 px-4 text-sm',
  md: 'h-12 px-6 text-[15px]',
  lg: 'h-14 px-8 text-base',
};

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-full font-medium tracking-tight transition-all duration-200 ease-smooth focus-visible:ring-2 focus-visible:ring-gold-400/50 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';

interface CommonProps {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: React.ReactNode;
}

type ButtonAsButton = CommonProps &
  React.ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };

type ButtonAsLink = CommonProps & { href: Route | string };

export function Button({ variant = 'primary', size = 'md', className, children, ...rest }: ButtonAsButton) {
  return (
    <button className={cn(BASE, VARIANTS[variant], SIZES[size], className)} {...rest}>
      {children}
    </button>
  );
}

export function ButtonLink({ variant = 'primary', size = 'md', className, children, href }: ButtonAsLink) {
  return (
    <Link href={href as Route} className={cn(BASE, VARIANTS[variant], SIZES[size], className)}>
      {children}
    </Link>
  );
}
