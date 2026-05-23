import { Section, SectionHeading } from '@/components/ui/Section';
import { Accordion, type AccordionItem } from '@/components/ui/Accordion';

// Generic, process-oriented answers — no prices, guarantees, or invented facts.
const FAQ: AccordionItem[] = [
  {
    question: 'كيف أبدأ البحث عن عقار مناسب؟',
    answer: 'تصفّح المشاريع والوحدات، واستخدم خيارات التصفية حسب المدينة والنوع والسعر للوصول السريع إلى ما يناسبك.',
  },
  {
    question: 'هل يمكنني المقارنة بين أكثر من وحدة؟',
    answer: 'نعم، يمكنك إضافة حتى ٣ وحدات إلى المقارنة لاستعراض المواصفات والأسعار جنبًا إلى جنب قبل اتخاذ قرارك.',
  },
  {
    question: 'كيف أحجز زيارة لمشروع أو وحدة؟',
    answer: 'من صفحة المشروع أو الوحدة اختر «طلب زيارة»، وسيتواصل معك أحد مستشارينا لتأكيد الموعد المناسب.',
  },
  {
    question: 'كيف أتواصل مع مستشار عقاري؟',
    answer: 'عبر نموذج «اطلب استشارة» في الصفحة أو صفحة «تواصل معنا»، وسنعاود التواصل معك في أقرب وقت.',
  },
];

export function HomeFaq() {
  return (
    <Section tone="soft">
      <div className="mx-auto max-w-3xl">
        <SectionHeading align="center" eyebrow="إجابات سريعة" title="أسئلة شائعة" className="mx-auto" />
        <div className="mt-8">
          <Accordion items={FAQ} defaultOpenFirst />
        </div>
      </div>
    </Section>
  );
}
