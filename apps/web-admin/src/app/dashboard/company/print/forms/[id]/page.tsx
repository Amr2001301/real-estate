import { notFound } from 'next/navigation';
import { api, safe } from '@/lib/api';
import { getLetterhead } from '@/lib/letterhead';
import { getLocale } from '@/lib/locale';
import { getCustomerFields } from '@/lib/customer-fields-server';
import type { FormLayout } from '@/lib/form-layout';
import { PremiumPageHero } from '@/components/premium';
import { companyNameOf } from '@/components/print/PrintDocument';
import { printSettingsT } from '../../messages';
import { FormDesigner } from '../_components/form-designer';

export const dynamic = 'force-dynamic';

export default async function EditFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [res, letterhead, locale, customFields] = await Promise.all([
    safe(api.get<FormLayout>(`/form-layouts/${id}`)),
    getLetterhead(),
    getLocale(),
    getCustomerFields(),
  ]);
  if (!res.data) notFound();
  const m = printSettingsT(locale);
  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      <PremiumPageHero
        title={res.data.name}
        description={m.forms.hint}
        breadcrumbs={[{ label: m.breadcrumbAdmin }, { label: m.title, href: '/dashboard/company/print' }, { label: res.data.name }]}
      />
      <FormDesigner layout={res.data} customFields={customFields} locale={locale} currency={letterhead.currency} company={companyNameOf(letterhead, locale)} />
    </div>
  );
}
