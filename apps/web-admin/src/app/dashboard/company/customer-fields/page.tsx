import { redirect } from 'next/navigation';
import { getLocale } from '@/lib/locale';
import { getSession } from '@/lib/session';
import { getCustomerFields } from '@/lib/customer-fields-server';
import { PremiumPageHero } from '@/components/premium';
import { CustomerFieldsManager } from './_components/customer-fields-manager';

export const dynamic = 'force-dynamic';

const T = {
  ar: {
    title: 'خانات العميل الإضافية',
    description: 'أضف خانات خاصة بشركتك لبيانات العميل — مثل اسم الزوجة أو رقم الجواز — يملؤها موظفوك وتُطبع في العقود.',
    admin: 'الإدارة',
  },
  en: {
    title: 'Extra customer fields',
    description: 'Add fields of your own to customer data — like spouse name or passport number — that your staff fill and your contracts print.',
    admin: 'Administration',
  },
};

export default async function CustomerFieldsPage() {
  const [session, locale, fields] = await Promise.all([getSession(), getLocale(), getCustomerFields()]);
  if (session?.role !== 'ADMIN') redirect('/dashboard' as never);
  const t = T[locale === 'en' ? 'en' : 'ar'];
  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      <PremiumPageHero title={t.title} description={t.description} breadcrumbs={[{ label: t.admin }, { label: t.title }]} />
      <CustomerFieldsManager fields={fields} locale={locale} />
    </div>
  );
}
