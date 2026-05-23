import { Scale, Check } from 'lucide-react';
import { routes } from '@/lib/routes';
import { Section, SectionHeading } from '@/components/ui/Section';
import { ButtonLink } from '@/components/ui/Button';
import { PremiumCard } from '@/components/ui/PremiumCard';
import { IconCircle } from '@/components/ui/IconCircle';
import { Reveal } from '@/components/motion/Reveal';

const ROWS = ['السعر', 'المساحة', 'غرف النوم', 'دورات المياه', 'الطابق', 'المشروع'];

export function CompareTeaser() {
  return (
    <Section tone="surface">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <Reveal>
          <div>
            <IconCircle tone="navy" className="mb-6">
              <Scale className="h-6 w-6" aria-hidden />
            </IconCircle>
            <SectionHeading
              eyebrow="أداة المقارنة"
              title="قارن بين الوحدات بثقة"
              description="اختر حتى ٣ وحدات وقارن بينها جنبًا إلى جنب — السعر، المساحة، الغرف، والمزيد — لتتخذ قرارك بوضوح تام."
            />
            <div className="mt-8">
              <ButtonLink href={routes.units} variant="primary" size="lg">
                ابدأ المقارنة
              </ButtonLink>
            </div>
          </div>
        </Reveal>

        <Reveal delay={120}>
          {/* Visual mock — not functional in W3 (comparison logic lands in W6). */}
          <PremiumCard className="overflow-hidden p-7">
            <div className="grid grid-cols-3 gap-3 text-center text-xs font-medium text-ink-muted">
              <span className="text-start">المقارنة</span>
              <span className="rounded-xl bg-surface-soft py-2 text-navy">وحدة ١</span>
              <span className="rounded-xl bg-gold-100 py-2 text-gold-600">وحدة ٢</span>
            </div>
            <div className="mt-3 space-y-2">
              {ROWS.map((row) => (
                <div key={row} className="grid grid-cols-3 items-center gap-3 rounded-xl border border-hairline px-3 py-2.5 text-sm">
                  <span className="text-start text-ink-muted">{row}</span>
                  <span className="flex justify-center text-navy/40">
                    <Check className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="flex justify-center text-gold-500">
                    <Check className="h-4 w-4" aria-hidden />
                  </span>
                </div>
              ))}
            </div>
          </PremiumCard>
        </Reveal>
      </div>
    </Section>
  );
}
