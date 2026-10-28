import { SecurityPage } from '@/components/security/security-page';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/** «الأمان والأجهزة» in the broker portal. */
export default function PortalSecurityPage() {
  return <SecurityPage home="/portal" />;
}
