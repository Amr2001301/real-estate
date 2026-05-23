import { TrendingUp, LineChart, Building } from 'lucide-react';
import { Section, SectionHeading } from '@/components/ui/Section';
import { Badge } from '@/components/ui/Badge';
import { IconCircle } from '@/components/ui/IconCircle';
import { Reveal } from '@/components/motion/Reveal';

const PILLARS = [
  { icon: Building, title: 'تقدم المشروع', body: 'تابع مراحل الإنشاء أولًا بأول.' },
  { icon: LineChart, title: 'مؤشر القيمة التقديرية', body: 'نظرة تقديرية على تطور قيمة وحدتك.' },
  { icon: TrendingUp, title: 'رحلة استثمارك', body: 'صورة واضحة لمسار استثمارك بمرور الوقت.' },
] as const;

/**
 * Marketing teaser for the Phase-2 investment-tracker. No live data, no
 * profit guarantees — copy uses non-binding-estimate wording deliberately.
 */
export function GrowthTeaser() {
  return (
    <Section tone="canvas">
      <div className="overflow-hidden rounded-4xl border border-hairline bg-surface-soft">
        <div className="grid items-center gap-10 p-9 sm:p-12 lg:grid-cols-2">
          <Reveal>
            <div>
              <Badge tone="navy">قريبًا</Badge>
              <SectionHeading
                className="mt-4"
                eyebrow="رحلة استثمارك"
                title="تابع رحلة استثمارك بعد الشراء"
                description="في المراحل القادمة، سيتمكن العملاء من متابعة تقدم المشروع ومؤشرات القيمة التقديرية لوحداتهم."
              />
              <p className="mt-4 text-sm text-ink-muted">
                * القيم المعروضة تقديرية وغير ملزمة، وتُعرض لأغراض المتابعة فقط.
              </p>
            </div>
          </Reveal>

          <Reveal delay={120}>
            <div className="space-y-4">
              {PILLARS.map(({ icon: Icon, title, body }) => (
                <div key={title} className="flex items-start gap-4 rounded-3xl border border-hairline bg-surface p-5 shadow-soft">
                  <IconCircle tone="gold">
                    <Icon className="h-6 w-6" aria-hidden />
                  </IconCircle>
                  <div>
                    <h3 className="text-base text-navy">{title}</h3>
                    <p className="mt-1 text-sm text-ink-muted">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </Section>
  );
}
