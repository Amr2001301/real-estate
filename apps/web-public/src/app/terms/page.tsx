import { buildMetadata } from '@/lib/seo';
import { Section } from '@/components/ui/Section';
import { Container } from '@/components/ui/Container';
import { PremiumCard } from '@/components/ui/PremiumCard';
import { PageHero } from '@/components/layout/PageHero';
import { InlineNotice } from '@/components/states/InlineNotice';

export const metadata = buildMetadata({
  title: 'الشروط والأحكام',
  description: 'الشروط والأحكام لاستخدام منصة ديفورا العقارية.',
  // Placeholder content — keep out of search indexes until the final legal text lands.
  robots: { index: false, follow: false },
});

export default function TermsPage() {
  return (
    <>
      <PageHero
        eyebrow="الشروط والأحكام"
        title="شروط استخدام المنصة"
        subtitle="تنظّم هذه الشروط استخدامك للموقع. هذه نسخة مبدئية وسيتم تحديثها بالنص النهائي قريبًا."
      />

      <Section tone="canvas">
        <Container>
          <div className="mx-auto max-w-3xl">
            <InlineNotice tone="info">
              هذا المحتوى مبدئي لأغراض العرض، وسيتم استبداله بالنص القانوني النهائي لاحقًا.
            </InlineNotice>

            <PremiumCard className="mt-6 space-y-5 p-8 leading-relaxed text-ink-muted sm:p-10">
              <p>
                باستخدامك لموقع ديفورا فإنك توافق على الالتزام بهذه الشروط والأحكام. يرجى قراءتها
                بعناية.
              </p>
              <div>
                <h2 className="text-lg font-semibold text-ink-strong">استخدام الموقع</h2>
                <p className="mt-2">
                  يُتاح الموقع لأغراض استعراض المشاريع والوحدات والتواصل مع فريقنا. تلتزم باستخدامه
                  بصورة نظامية وعدم إساءة استخدام الخدمات المتاحة.
                </p>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-ink-strong">دقة المعلومات</h2>
                <p className="mt-2">
                  نسعى لعرض معلومات دقيقة عن المشاريع والوحدات، إلا أن التفاصيل النهائية تُعتمد عند
                  التعاقد الرسمي مع الشركة.
                </p>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-ink-strong">تحديث الشروط</h2>
                <p className="mt-2">
                  قد نقوم بتحديث هذه الشروط من وقت لآخر، وسيتم نشر النسخة المحدّثة على هذه الصفحة.
                </p>
              </div>
            </PremiumCard>
          </div>
        </Container>
      </Section>
    </>
  );
}
