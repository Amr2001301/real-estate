import { PageHeader } from '@/components/ui/page-header';
import BrokerForm from '../_form';

export default function NewBrokerPage() {
  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        title="إضافة وسيط جديد"
        description="سجّل بيانات شركة الوساطة العقارية. يمكنك إضافة الموظفين وصلاحيات الوصول للمشاريع بعد الإنشاء."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/dashboard' },
          { label: 'الوسطاء', href: '/dashboard/brokers' },
          { label: 'وسيط جديد' },
        ]}
      />
      <BrokerForm />
    </div>
  );
}
