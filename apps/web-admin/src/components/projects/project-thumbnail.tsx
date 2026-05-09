import { Building2 } from 'lucide-react';
import { cn } from '@/lib/cn';

type Size = 'sm' | 'md' | 'lg';

const SIZE: Record<Size, string> = {
  sm: 'h-10 w-10 rounded-lg',
  md: 'h-14 w-14 rounded-xl',
  lg: 'h-20 w-20 rounded-xl',
};

interface Props {
  src?: string | null;
  alt?: string;
  size?: Size;
  className?: string;
}

export function ProjectThumbnail({ src, alt = '', size = 'md', className }: Props) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden ring-1 ring-inset ring-hairline bg-gradient-to-br from-sidebar-bg-elev to-sidebar-bg',
        SIZE[size],
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <Building2 className="h-1/2 w-1/2 text-brand-300" strokeWidth={1.75} />
      )}
    </span>
  );
}
