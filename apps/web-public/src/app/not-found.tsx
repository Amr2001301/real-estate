import { buildMetadata } from '@/lib/seo';
import { routes } from '@/lib/routes';
import { getLocale } from '@/lib/locale';
import { siteT } from '@/messages/site';
import { Container } from '@/components/ui/Container';
import { ButtonLink } from '@/components/ui/Button';
import { Divider } from '@/components/ui/Divider';

export const metadata = buildMetadata({ title: 'الصفحة غير موجودة', robots: { index: false, follow: false } });

export default async function NotFound() {
  const locale = await getLocale();
  const m = siteT(locale);

  return (
    <Container className="flex min-h-[78vh] flex-col items-center justify-center py-24 text-center">
      <span className="font-display text-hero leading-none text-gold-300">{m.notFound.code}</span>
      <Divider accent className="my-8" />
      <h1 className="text-display-2 text-ink-strong">{m.notFound.title}</h1>
      <p className="mt-3 max-w-md text-ink-muted">
        {m.notFound.message}
      </p>
      <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
        <ButtonLink href={routes.home} variant="primary" size="lg">
          {m.notFound.backHome}
        </ButtonLink>
        <ButtonLink href={routes.projects} variant="outline" size="lg">
          {m.notFound.browseProjects}
        </ButtonLink>
      </div>
    </Container>
  );
}
