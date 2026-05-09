import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZE: Record<Size, string> = {
  xs: 'h-6 w-6 text-2xs',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-lg',
};

export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  name?: string;
  src?: string;
  size?: Size;
}

const PALETTE = [
  'bg-brand-100 text-brand-700',
  'bg-info-100 text-info-700',
  'bg-accent-100 text-accent-700',
  'bg-purple-100 text-purple-700',
  'bg-success-100 text-success-700',
  'bg-warning-100 text-warning-700',
];

function initials(name?: string): string {
  if (!name) return '·';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '·';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function paletteFor(name?: string): string {
  if (!name) return PALETTE[0]!;
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length]!;
}

export const Avatar = forwardRef<HTMLSpanElement, AvatarProps>(function Avatar(
  { name, src, size = 'md', className, ...rest },
  ref,
) {
  const base = cn(
    'inline-flex items-center justify-center font-semibold rounded-full shrink-0 select-none',
    'ring-1 ring-inset ring-white/40',
    SIZE[size],
    !src && paletteFor(name),
    className,
  );

  if (src) {
    return (
      <span ref={ref} className={cn(base, 'overflow-hidden')} {...rest}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={name ?? ''} className="h-full w-full object-cover" />
      </span>
    );
  }

  return (
    <span ref={ref} className={base} {...rest}>
      {initials(name)}
    </span>
  );
});
