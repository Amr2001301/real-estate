import { notFound } from 'next/navigation';
import { api, safe } from '@/lib/api';
import type { BrokerUser } from '@/lib/types';
import { PageHeader } from '@/components/ui/page-header';
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
  const res = await safe(api.get<BrokerUser>(`/portal/team/${id}`));
  if (res.error || !res.data) notFound();
  const member = res.data;

  // Bind the brokerUserId into the action — the form component itself only
  // knows the (prev, formData) signature.
  const action = updateTeamMemberAction.bind(null, id);

  return (
    <div className="space-y-5">
      <PageHeader
        title={`تعديل: ${member.user.fullName}`}
        description="حدِّث بيانات العضو وصلاحياته. التغييرات على «جهة الاتصال الرئيسية» تُلغي تلقائيًا الاختيار السابق."
        breadcrumbs={[
          { label: 'البوابة', href: '/portal' },
          { label: 'فريق العمل', href: '/portal/team' },
          { label: member.user.fullName },
        ]}
        meta={<BrokerUserStatusBadge status={member.status} />}
      />
      <TeamMemberForm action={action} initial={member} submitLabel="حفظ التغييرات" isEdit />
    </div>
  );
}
