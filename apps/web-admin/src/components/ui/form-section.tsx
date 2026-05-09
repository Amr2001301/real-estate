import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Card } from './card';

interface Props {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  /** Aside slot rendered under the description (right column on desktop). */
  aside?: ReactNode;
}

export function FormSection({ title, description, children, aside, className }: Props) {
  return (
    <section
      className={cn(
        'grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-8',
        className,
      )}
    >
      <div className="lg:col-span-1">
        <h2 className="text-base font-semibold text-slate-900 tracking-tight">
          {title}
        </h2>
        {description && (
          <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">
            {description}
          </p>
        )}
        {aside && <div className="mt-3">{aside}</div>}
      </div>
      <Card className="lg:col-span-2 p-5 sm:p-6">
        <div className="flex flex-col gap-5">{children}</div>
      </Card>
    </section>
  );
}
