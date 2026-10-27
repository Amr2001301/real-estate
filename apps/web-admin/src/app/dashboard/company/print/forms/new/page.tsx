import { getLetterhead } from '@/lib/letterhead';
import { getLocale } from '@/lib/locale';
import { getCustomerFields } from '@/lib/customer-fields-server';
import { PremiumPageHero } from '@/components/premium';
import { companyNameOf } from '@/components/print/PrintDocument';
import { printSettingsT } from '../../messages';
import { EditorGuide } from '../../_components/editor-guide';
import { FormDesigner } from '../_components/form-designer';

export const dynamic = 'force-dynamic';

export default async function NewFormPage({ searchParams }: { searchParams: Promise<{ doc?: string }> }) {
  const [{ doc }, letterhead, locale, customFields] = await Promise.all([searchParams, getLetterhead(), getLocale(), getCustomerFields()]);
  const m = printSettingsT(locale);
  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      <PremiumPageHero
        title={m.forms.newTitle}
        description={m.forms.hint}
        breadcrumbs={[{ label: m.breadcrumbAdmin }, { label: m.title, href: '/dashboard/company/print?tab=forms' }, { label: m.forms.newTitle }]}
      />
      <EditorGuide steps={m.guide.form} testId="editor-guide" />
      <FormDesigner
        layout={null}
        initialDocument={doc === 'RECEIPT' || doc === 'CONTRACT' ? doc : 'RESERVATION'}
        customFields={customFields}
        locale={locale} currency={letterhead.currency} company={companyNameOf(letterhead, locale)} />
    </div>
  );
}
