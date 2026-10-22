import { notFound } from 'next/navigation';
import { api, safe } from '@/lib/api';
import { getLetterhead } from '@/lib/letterhead';
import { getLocale } from '@/lib/locale';
import type { DocumentTemplate } from '@/lib/print-settings';
import { PremiumPageHero } from '@/components/premium';
import { companyNameOf } from '@/components/print/PrintDocument';
import { printSettingsT } from '../../messages';
import { TemplateEditor } from '../../_components/template-editor';

export const dynamic = 'force-dynamic';

export default async function EditTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [res, letterhead, locale] = await Promise.all([
    safe(api.get<DocumentTemplate>(`/document-templates/${id}`)),
    getLetterhead(),
    getLocale(),
  ]);
  if (!res.data) notFound();
  const m = printSettingsT(locale);
  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      <PremiumPageHero
        title={res.data.name}
        description={m.editor.editTitle}
        breadcrumbs={[{ label: m.breadcrumbAdmin }, { label: m.editor.back, href: '/dashboard/company/print' }, { label: res.data.name }]}
      />
      <TemplateEditor template={res.data} m={m} locale={locale} currency={letterhead.currency} company={companyNameOf(letterhead, locale)} />
    </div>
  );
}
