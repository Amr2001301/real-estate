import Image from 'next/image';
import type { BrandingData } from '@/lib/branding';
import { companyMarkKind } from '@/lib/company-mark';
import { initials } from '@/lib/initials';
import { cn } from '@/lib/cn';

const PLATFORM_LOGO = '/brand/devora-logo.png';

/**
 * The mark beside a company's name. A company with a logo shows it; one without
 * shows its initials in its own colour — never the platform's mark (QA F-005).
 * The platform logo appears only when there is no company at all.
 */
export function CompanyMark({
  branding,
  name,
  size,
  className,
  priority,
}: {
  branding?: BrandingData;
  name: string;
  size: number;
  className?: string;
  priority?: boolean;
}) {
  const box = { width: size, height: size };
  const kind = companyMarkKind(branding);
  if (kind === 'logo' && branding?.logoUrl) {
    return (
      <Image
        src={branding.logoUrl}
        alt={name}
        {...box}
        priority={priority}
        // The company's logo is served from object storage (any host): not through the image optimizer.
        unoptimized
        className={cn('rounded-md object-cover', className)}
      />
    );
  }
  if (kind === 'initials') {
    return (
      <span
        role="img"
        aria-label={name}
        style={box}
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-md bg-gold-500 text-[0.8em] font-bold text-white',
          className,
        )}
      >
        {initials(name, { fallback: '•' })}
      </span>
    );
  }
  return (
    <Image src={PLATFORM_LOGO} alt={name} {...box} priority={priority} unoptimized className={cn('rounded-md object-cover', className)} />
  );
}
