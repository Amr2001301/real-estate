import { getLetterhead } from '@/lib/letterhead';
import { getLocale } from '@/lib/locale';
import { getCustomerFields } from '@/lib/customer-fields-server';
import { PremiumPageHero } from '@/components/premium';
import { companyNameOf } from '@/components/print/PrintDocument';
import { printSettingsT } from '../../messages';
import { EditorGuide } from '../../_components/editor-guide';
import { TemplateEditor } from '../../_components/template-editor';

export const dynamic = 'force-dynamic';

export default async function NewTemplatePage() {
  const [letterhead, locale, fields] = await Promise.all([getLetterhead(), getLocale(), getCustomerFields()]);
  const m = printSettingsT(locale);
  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      <PremiumPageHero
        title={m.editor.newTitle}
        breadcrumbs={[{ label: m.breadcrumbAdmin }, { label: m.editor.back, href: '/dashboard/company/print?tab=wording' }, { label: m.editor.newTitle }]}
      />
      <EditorGuide steps={m.guide.wording} testId="editor-guide" />
      <TemplateEditor template={null} m={m} locale={locale} currency={letterhead.currency} company={companyNameOf(letterhead, locale)} fields={fields} />
    </div>
  );
}
