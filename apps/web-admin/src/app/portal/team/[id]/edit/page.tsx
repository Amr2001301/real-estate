import { notFound } from 'next/navigation';
import { api, safe } from '@/lib/api';
import type { BrokerUser } from '@/lib/types';
import { PremiumPageHero } from '@/components/premium';
import { getLocale } from '@/lib/locale';
import { portalMoneyTeamT } from '@/messages/portal/money-team';
import { TeamMemberForm } from '../../_form';
import { updateTeamMemberAction } from '../../actions';
import { BrokerUserStatusBadge } from '@/components/badges';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export default async function EditTeamMemberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getLocale();
  const m = portalMoneyTeamT(locale);
  const t = m.team.edit;
  const res = await safe(api.get<BrokerUser>(`/portal/team/${id}`));
  if (res.error || !res.data) notFound();
  const member = res.data;

  // Bind the brokerUserId into the action — the form component itself only
  // knows the (prev, formData) signature.
  const action = updateTeamMemberAction.bind(null, id);

  return (
    <div className="space-y-5">
      <PremiumPageHero
        title={t.title(member.user.fullName)}
        description={t.description}
        breadcrumbs={[
          { label: m.common.breadcrumbPortal, href: '/portal' },
          { label: m.team.breadcrumb, href: '/portal/team' },
          { label: member.user.fullName },
        ]}
        meta={<BrokerUserStatusBadge status={member.status} locale={locale} />}
      />
      <TeamMemberForm action={action} initial={member} submitLabel={t.submit} isEdit locale={locale} />
    </div>
  );
}
