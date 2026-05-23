import { cn } from '@/lib/cn';

interface ContainerProps {
  className?: string;
  children: React.ReactNode;
}

/** Centered max-width content wrapper with responsive gutters. */
export function Container({ className, children }: ContainerProps) {
  return (
    <div className={cn('mx-auto w-full max-w-container px-5 sm:px-8 lg:px-12', className)}>
      {children}
    </div>
  );
}
