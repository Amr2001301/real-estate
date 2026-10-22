import { getLetterhead } from '@/lib/letterhead';
import { getLocale } from '@/lib/locale';
import { PremiumPageHero } from '@/components/premium';
import { companyNameOf } from '@/components/print/PrintDocument';
import { printSettingsT } from '../../messages';
import { TemplateEditor } from '../../_components/template-editor';

export const dynamic = 'force-dynamic';

export default async function NewTemplatePage() {
  const [letterhead, locale] = await Promise.all([getLetterhead(), getLocale()]);
  const m = printSettingsT(locale);
  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      <PremiumPageHero
        title={m.editor.newTitle}
        breadcrumbs={[{ label: m.breadcrumbAdmin }, { label: m.editor.back, href: '/dashboard/company/print' }, { label: m.editor.newTitle }]}
      />
      <TemplateEditor template={null} m={m} locale={locale} currency={letterhead.currency} company={companyNameOf(letterhead, locale)} />
    </div>
  );
}
