import { routes } from '@/lib/routes';
import { Section, SectionHeading } from '@/components/ui/Section';
import { ButtonLink } from '@/components/ui/Button';
import { Reveal } from '@/components/motion/Reveal';

export function LeadCtaBand() {
  return (
    <Section tone="navy">
      <Reveal>
        <div className="flex flex-col items-center text-center">
          <SectionHeading
            invert
            align="center"
            eyebrow="ابدأ الآن"
            title="ابدأ رحلتك نحو منزل الأحلام اليوم"
            description="فريق مستشارينا جاهز لمساعدتك في اختيار الوحدة أو المشروع الأنسب لك."
          />
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <ButtonLink href={routes.contact} variant="gold" size="lg">
              تواصل مع مستشار
            </ButtonLink>
            <ButtonLink
              href={routes.units}
              variant="outline"
              size="lg"
              className="border-white/25 text-white hover:border-white/50 hover:bg-white/5"
            >
              تصفح الوحدات
            </ButtonLink>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}
