import { redirect } from 'next/navigation';
import { getLocale } from '@/lib/locale';
import { getSession } from '@/lib/session';
import { getCustomerFields } from '@/lib/customer-fields-server';
import { PremiumPageHero } from '@/components/premium';
import { CustomerFieldsManager } from './_components/customer-fields-manager';

export const dynamic = 'force-dynamic';

const T = {
  ar: {
    title: 'بيانات العملاء الإضافية',
    description: 'خانات تضيفها شركتك لبيانات كل عميل، يملؤها الموظف وتُطبع في الاستمارات والعقود.',
    admin: 'الإدارة',
  },
  en: {
    title: 'Extra customer data',
    description: 'Fields your company adds to every customer’s data; staff fill them and they print on your forms and contracts.',
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
