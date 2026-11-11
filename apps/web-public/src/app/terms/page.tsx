import { pageMeta } from '@/lib/page-meta';
import { getLocale } from '@/lib/locale';
import { siteT } from '@/messages/site';
import { LegalPage } from '@/components/content/LegalPage';

export async function generateMetadata() {
  return pageMeta('terms', { robots: { index: false, follow: false } });
}

export default async function TermsPage() {
  const locale = await getLocale();
  const m = siteT(locale);

  const [first, ...rest] = m.terms.sections;
  return (
    <LegalPage
      homeLabel={m.unitDetail.breadHome}
      title={m.terms.title}
      subtitle={m.terms.subtitle}
      notice={m.terms.notice}
      intro={first?.body}
      sections={rest}
      tocLabel={locale === 'en' ? 'Contents' : 'المحتويات'}
      locale={locale}
    />
  );
}
