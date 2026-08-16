import { buildMetadata } from '@/lib/seo';
import { getLocale } from '@/lib/locale';
import { siteT } from '@/messages/site';
import { Section } from '@/components/ui/Section';
import { Container } from '@/components/ui/Container';
import { PremiumCard } from '@/components/ui/PremiumCard';
import { PageHero } from '@/components/layout/PageHero';
import { InlineNotice } from '@/components/states/InlineNotice';

export const metadata = buildMetadata({
  title: 'سياسة الخصوصية',
  description: 'سياسة الخصوصية لمنصة ديفورا العقارية.',
  // Placeholder content — keep out of search indexes until the final legal text lands.
  robots: { index: false, follow: false },
});

export default async function PrivacyPage() {
  const locale = await getLocale();
  const m = siteT(locale);

  return (
    <>
      <PageHero
        eyebrow={m.privacy.eyebrow}
        title={m.privacy.title}
        subtitle="نوضح هنا كيف نتعامل مع بياناتك. هذه نسخة مبدئية وسيتم تحديثها بالنص النهائي قريبًا."
      />

      <Section tone="canvas">
        <Container>
          <div className="mx-auto max-w-3xl">
            <InlineNotice tone="info">
              {m.privacy.notice}
            </InlineNotice>

            <PremiumCard className="mt-6 space-y-5 p-8 leading-relaxed text-ink-muted sm:p-10">
              {m.privacy.sections.map((section, i) => (
                i === 0 ? (
                  <p key={i}>{section.body}</p>
                ) : (
                  <div key={i}>
                    <h2 className="text-lg font-semibold text-ink-strong">{section.title}</h2>
                    <p className="mt-2">{section.body}</p>
                  </div>
                )
              ))}
            </PremiumCard>
          </div>
        </Container>
      </Section>
    </>
  );
}
