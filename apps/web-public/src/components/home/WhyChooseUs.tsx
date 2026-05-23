import { Gem, Users, Scale, Sparkles, Layers, Bell } from 'lucide-react';
import { Section, SectionHeading } from '@/components/ui/Section';
import { IconCircle } from '@/components/ui/IconCircle';
import { Divider } from '@/components/ui/Divider';
import { Stagger } from '@/components/motion/Stagger';

const VALUES = [
  { icon: Gem, title: 'مشاريع منتقاة بعناية', body: 'نختار لك وجهات سكنية وتجارية تجمع بين الموقع المميز والجودة العالية.' },
  { icon: Layers, title: 'فرص استثمارية متنوعة', body: 'خيارات سكنية وتجارية وإدارية تناسب مختلف الأهداف والميزانيات.' },
  { icon: Scale, title: 'مقارنة ذكية للوحدات', body: 'قارن بين الوحدات بسهولة لتختار ما يناسب احتياجك بثقة.' },
  { icon: Users, title: 'دعم من مستشارين', body: 'فريق متخصص يرافقك في كل خطوة لاتخاذ القرار الأنسب.' },
  { icon: Sparkles, title: 'تجربة تصفّح راقية', body: 'منصة عصرية تجعل رحلتك العقارية سلسة وممتعة من البداية للنهاية.' },
  { icon: Bell, title: 'متابعة سريعة لاهتماماتك', body: 'نتواصل معك بسرعة لتنسيق الزيارات والإجابة عن استفساراتك.' },
] as const;

export function WhyChooseUs() {
  return (
    <Section tone="canvas">
      <SectionHeading
        align="center"
        eyebrow="لماذا دار الفخامة"
        title="تجربة عقارية مصممة لتمنحك الثقة"
        description="نهتم بأدق التفاصيل لنجعل اختيارك لمنزلك أو استثمارك القادم تجربة مطمئنة وراقية."
        className="mx-auto"
      />
      <Stagger className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3" childClassName="h-full" step={70}>
        {VALUES.map(({ icon: Icon, title, body }) => (
          <div key={title} className="flex h-full flex-col items-start rounded-3xl border border-hairline bg-surface p-7 shadow-soft">
            <IconCircle tone="gold">
              <Icon className="h-6 w-6" aria-hidden />
            </IconCircle>
            <h3 className="mt-6 text-lg text-navy">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">{body}</p>
            <Divider accent className="mt-6" />
          </div>
        ))}
      </Stagger>
    </Section>
  );
}
