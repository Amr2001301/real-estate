import { cn } from '@/lib/cn';

interface FormErrorProps {
  children?: React.ReactNode;
  className?: string;
}

/** Inline field-level validation message. Renders nothing when empty. */
export function FormError({ children, className }: FormErrorProps) {
  if (!children) return null;
  return (
    <p role="alert" className={cn('text-sm text-error', className)}>
      {children}
    </p>
  );
}
