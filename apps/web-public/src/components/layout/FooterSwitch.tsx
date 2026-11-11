'use client';

import { usePathname } from 'next/navigation';

/**
 * Pages where the visitor is doing one task — signing in, their own account,
 * signing a contract — end with a slim footer (copyright and the policies)
 * instead of the full one with its call to action and site links.
 */
const SLIM = [/^\/login/, /^\/register/, /^\/forgot-password/, /^\/reset-password/, /^\/verify-email/, /^\/account/, /^\/sign\//];

export function FooterSwitch({ full, slim }: { full: React.ReactNode; slim: React.ReactNode }) {
  const path = usePathname() ?? '/';
  return <>{SLIM.some((re) => re.test(path)) ? slim : full}</>;
}
