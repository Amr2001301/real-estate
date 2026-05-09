import { PageHeader } from '@/components/ui/page-header';
import ProjectForm from '../_form';

export default function NewProjectPage() {
  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        title="إضافة مشروع جديد"
        description="قم بتعبئة التفاصيل المعمارية والمكانية للمشروع الجديد. سيتم مراجعة البيانات قبل النشر النهائي في المحفظة الاستثمارية."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'المشاريع', href: '/dashboard/projects' },
          { label: 'مشروع جديد' },
        ]}
      />
      <ProjectForm />
    </div>
  );
}
