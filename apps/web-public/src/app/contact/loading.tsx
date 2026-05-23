import { Section } from '@/components/ui/Section';
import { PageHero } from '@/components/layout/PageHero';

export default function ContactLoading() {
  return (
    <>
      <PageHero
        eyebrow="تواصل معنا"
        title="اترك لنا رسالة، وسنتولى الباقي"
        subtitle="فريقنا جاهز لمساعدتك في اختيار المشروع أو الوحدة الأنسب لاحتياجك."
      />
      <Section tone="canvas">
        <div className="grid animate-pulse gap-8 lg:grid-cols-3">
          <div className="h-[32rem] rounded-3xl bg-surface-soft lg:col-span-2" />
          <div className="space-y-6 lg:col-span-1">
            <div className="h-48 rounded-3xl bg-surface-soft" />
            <div className="h-28 rounded-3xl bg-surface-soft" />
            <div className="h-28 rounded-3xl bg-surface-soft" />
          </div>
        </div>
      </Section>
    </>
  );
}
