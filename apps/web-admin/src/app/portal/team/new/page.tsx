import { PremiumPageHero } from '@/components/premium';
import { TeamMemberForm } from '../_form';
import { createTeamMemberAction } from '../actions';

export default function NewTeamMemberPage() {
  return (
    <div className="space-y-5">
      <PremiumPageHero
        title="إضافة عضو جديد"
        description="ادعُ عضوًا جديدًا للانضمام لفريق الوسيط. سيستلم بريدًا/إشعارًا للتفعيل."
        breadcrumbs={[
          { label: 'البوابة', href: '/portal' },
          { label: 'فريق العمل', href: '/portal/team' },
          { label: 'إضافة عضو' },
        ]}
      />
      <TeamMemberForm action={createTeamMemberAction} submitLabel="إرسال الدعوة" />
    </div>
  );
}
