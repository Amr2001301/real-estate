import { pageMeta } from '@/lib/page-meta';
import { getLocale } from '@/lib/locale';
import { siteT } from '@/messages/site';
import { LegalPage } from '@/components/content/LegalPage';

export async function generateMetadata() {
  return pageMeta('privacy', { robots: { index: false, follow: false } });
}

export default async function PrivacyPage() {
  const locale = await getLocale();
  const m = siteT(locale);

  const [first, ...rest] = m.privacy.sections;
  return (
    <LegalPage
      homeLabel={m.unitDetail.breadHome}
      title={m.privacy.title}
      subtitle={m.privacy.subtitle}
      notice={m.privacy.notice}
      intro={first?.body}
      sections={rest}
      tocLabel={locale === 'en' ? 'Contents' : 'المحتويات'}
      locale={locale}
    />
  );
}
