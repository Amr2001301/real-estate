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
        'flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 py-4',
        sticky &&
          'sticky bottom-0 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 bg-canvas/85 backdrop-blur-md border-t border-hairline',
        className,
      )}
    >
      <div className="flex items-center gap-3 text-sm text-slate-500">
        {secondary}
        {helper && <span className="text-xs">{helper}</span>}
      </div>
      <div className="flex items-center justify-end gap-2">{primary}</div>
    </div>
  );
}
