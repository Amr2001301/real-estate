import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { getLocale } from '@/lib/locale';
import { getSession } from '@/lib/session';
import { uiT } from '@/messages/ui';
import ClientForm from '../_form';

export const dynamic = 'force-dynamic';

export default async function NewClientPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const [sp, session] = await Promise.all([searchParams, getSession()]);
  // Only an admin creates users; a rep adds a client through the lead form.
  if (session?.role !== 'ADMIN') redirect('/dashboard/leads/new' as never);
  const role: 'CLIENT' | 'CUSTOMER' = sp.role === 'CUSTOMER' ? 'CUSTOMER' : 'CLIENT';
  const locale = await getLocale();
  const m = uiT(locale);
  const n = m.pages.clientsNew;

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        title={n.title}
        description={n.description}
        breadcrumbs={[
          { label: m.common.breadcrumbHome, href: '/dashboard' },
          { label: m.nav.items.clients, href: `/dashboard/clients?role=${role}` },
          { label: n.breadcrumb },
        ]}
      />
      <ClientForm defaultRole={role} locale={locale} />
    </div>
  );
}
