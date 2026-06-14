import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface CodeTextProps {
  value?: ReactNode;
  children?: ReactNode;
  className?: string;
}

/**
 * Renders LTR reference codes (unit codes, serial numbers, API refs) safely
 * inside an RTL table cell. Uses unicode-bidi: isolate so the surrounding
 * RTL context cannot bleed into the code string or flip neutral characters.
 */
export function CodeText({ value, children, className }: CodeTextProps) {
  return (
    <span
      dir="ltr"
      className={cn('font-mono whitespace-nowrap', className)}
      style={{ unicodeBidi: 'isolate' }}
    >
      {value ?? children}
    </span>
  );
}
