import { AuthShell } from '@/components/auth/auth-shell';
import SuperAdminLoginForm from './form';

export default function SuperAdminLoginPage() {
  return (
    <AuthShell eyebrow="مالك المنصة" title="دخول المنصة" subtitle="هذه الصفحة مخصصة لمديري المنصة فقط.">
      <SuperAdminLoginForm />
    </AuthShell>
  );
}
