import { Gem, Users, Scale, Sparkles } from 'lucide-react';
import { Section, SectionHeading } from '@/components/ui/Section';
import { IconCircle } from '@/components/ui/IconCircle';
import { Divider } from '@/components/ui/Divider';
import { Stagger } from '@/components/motion/Stagger';

const VALUES = [
  { icon: Gem, title: 'مشاريع منتقاة بعناية', body: 'نختار لك وجهات سكنية تجمع بين الموقع المميز والجودة العالية.' },
  { icon: Users, title: 'مستشارون متخصصون', body: 'فريق خبير يرافقك في كل خطوة لاتخاذ القرار الأنسب لك.' },
  { icon: Scale, title: 'مقارنة ذكية للوحدات', body: 'قارن بين الوحدات بسهولة لتختار ما يناسب احتياجك وميزانيتك.' },
  { icon: Sparkles, title: 'تجربة رقمية راقية', body: 'منصة عصرية تجعل رحلتك العقارية سلسة وممتعة من البداية للنهاية.' },
] as const;

export function WhyChooseUs() {
  return (
    <Section tone="canvas">
      <SectionHeading
        align="center"
        eyebrow="لماذا نحن"
        title="تجربة عقارية مصممة لتمنحك الثقة"
        description="نهتم بأدق التفاصيل لنجعل اختيارك لمنزلك القادم تجربة مطمئنة وراقية."
        className="mx-auto"
      />
      <Stagger className="mt-14 grid gap-7 sm:grid-cols-2 lg:grid-cols-4" step={80}>
        {VALUES.map(({ icon: Icon, title, body }) => (
          <div key={title} className="flex flex-col items-start rounded-3xl border border-hairline bg-surface p-7 shadow-soft">
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
