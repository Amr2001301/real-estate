import { SecurityPage } from '@/components/security/security-page';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/** «الأمان والأجهزة» — the signed-in user's devices and password. */
export default function DashboardSecurityPage() {
  return <SecurityPage home="/dashboard" />;
}
