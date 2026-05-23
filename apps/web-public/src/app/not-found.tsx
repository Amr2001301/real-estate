import { buildMetadata } from '@/lib/seo';
import { routes } from '@/lib/routes';
import { Container } from '@/components/ui/Container';
import { ButtonLink } from '@/components/ui/Button';
import { Divider } from '@/components/ui/Divider';

export const metadata = buildMetadata({ title: 'الصفحة غير موجودة', robots: { index: false, follow: false } });

export default function NotFound() {
  return (
    <Container className="flex min-h-[78vh] flex-col items-center justify-center py-24 text-center">
      <span className="font-display text-hero leading-none text-gold-300">٤٠٤</span>
      <Divider accent className="my-8" />
      <h1 className="text-display-2 text-navy">لم نتمكن من العثور على هذه الصفحة</h1>
      <p className="mt-3 max-w-md text-ink-muted">
        ربما تم نقل الصفحة أو لم تعد متاحة. لكن لا تقلق — هناك الكثير لاستكشافه.
      </p>
      <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
        <ButtonLink href={routes.home} variant="primary" size="lg">
          العودة إلى الرئيسية
        </ButtonLink>
        <ButtonLink href={routes.projects} variant="outline" size="lg">
          تصفح المشاريع
        </ButtonLink>
      </div>
    </Container>
  );
}
