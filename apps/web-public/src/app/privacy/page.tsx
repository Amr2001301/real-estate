import { buildMetadata } from '@/lib/seo';
import { Section } from '@/components/ui/Section';
import { Container } from '@/components/ui/Container';
import { PremiumCard } from '@/components/ui/PremiumCard';
import { PageHero } from '@/components/layout/PageHero';
import { InlineNotice } from '@/components/states/InlineNotice';

export const metadata = buildMetadata({
  title: 'سياسة الخصوصية',
  description: 'سياسة الخصوصية لمنصة دار الفخامة العقارية.',
  // Placeholder content — keep out of search indexes until the final legal text lands.
  robots: { index: false, follow: false },
});

export default function PrivacyPage() {
  return (
    <>
      <PageHero
        eyebrow="سياسة الخصوصية"
        title="خصوصيتك تهمنا"
        subtitle="نوضح هنا كيف نتعامل مع بياناتك. هذه نسخة مبدئية وسيتم تحديثها بالنص النهائي قريبًا."
      />

      <Section tone="canvas">
        <Container>
          <div className="mx-auto max-w-3xl">
            <InlineNotice tone="info">
              هذا المحتوى مبدئي لأغراض العرض، وسيتم استبداله بالنص القانوني النهائي لاحقًا.
            </InlineNotice>

            <PremiumCard className="mt-6 space-y-5 p-8 leading-relaxed text-ink-muted sm:p-10">
              <p>
                تحترم دار الفخامة خصوصية زوّارها وعملائها، وتلتزم بحماية البيانات الشخصية التي تتم
                مشاركتها معنا عبر الموقع.
              </p>
              <div>
                <h2 className="text-lg font-semibold text-ink-strong">البيانات التي نجمعها</h2>
                <p className="mt-2">
                  قد نجمع بيانات أساسية مثل الاسم ورقم الهاتف والبريد الإلكتروني عند تعبئة نماذج
                  التواصل أو طلب المعلومات أو حجز الزيارات.
                </p>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-ink-strong">كيف نستخدم بياناتك</h2>
                <p className="mt-2">
                  نستخدم البيانات للرد على استفساراتك وتنسيق الزيارات وتحسين خدماتنا، ولا نشاركها مع
                  أطراف خارجية إلا بالقدر اللازم لتقديم الخدمة.
                </p>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-ink-strong">التواصل معنا</h2>
                <p className="mt-2">
                  لأي استفسار يتعلق بالخصوصية، يمكنك التواصل معنا عبر صفحة «تواصل معنا».
                </p>
              </div>
            </PremiumCard>
          </div>
        </Container>
      </Section>
    </>
  );
}
