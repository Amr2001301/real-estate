import type { BrandingData } from './branding';

/**
 * What stands beside a company's name: its logo, else its initials — and the
 * platform's own mark only when there is no company at all (QA F-005: a company
 * with no logo showed the platform's).
 */
export type CompanyMarkKind = 'logo' | 'initials' | 'platform';

export function companyMarkKind(branding: BrandingData | undefined): CompanyMarkKind {
  if (branding?.logoUrl) return 'logo';
  return branding ? 'initials' : 'platform';
}
