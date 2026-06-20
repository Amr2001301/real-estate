import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface Props {
  primary: ReactNode;
  secondary?: ReactNode;
  helper?: ReactNode;
  sticky?: boolean;
  className?: string;
}

export function FormFooter({ primary, secondary, helper, sticky, className }: Props) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 py-3.5',
        sticky &&
          'sticky bottom-0 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 bg-canvas/92 backdrop-blur-xl border-t border-hairline shadow-[0_-4px_24px_-6px_rgb(15_30_51_/_0.07)]',
        className,
      )}
    >
      <div className="flex items-center gap-3 text-slate-500">
        {secondary}
        {helper && (
          <span className="text-xs font-medium leading-relaxed">{helper}</span>
        )}
      </div>
      <div className="flex items-center justify-end gap-2.5">{primary}</div>
    </div>
  );
}
