import type { Route } from 'next';
import { routes } from '@/lib/routes';
import { Section } from '@/components/ui/Section';
import { Container } from '@/components/ui/Container';
import { ButtonLink } from '@/components/ui/Button';
import { Reveal } from '@/components/motion/Reveal';

export function HomeBanner() {
  return (
    <Section tone="canvas" contained={false} className="py-10 sm:py-12 lg:py-14">
      <Container>
        <Reveal>
          <div className="relative overflow-hidden rounded-4xl bg-navy px-8 py-12 shadow-card sm:px-12 sm:py-14">
            <div
              className="pointer-events-none absolute inset-0"
              style={{ background: 'radial-gradient(120% 160% at 85% 0%, #24426A 0%, #14273F 60%, #0B1726 100%)' }}
              aria-hidden
            />
            <span className="pointer-events-none absolute -left-16 bottom-0 h-56 w-56 rounded-full bg-gold-400/12 blur-3xl" aria-hidden />
            <span className="pointer-events-none absolute right-1/4 top-0 h-40 w-40 rounded-full bg-gold-400/8 blur-2xl" aria-hidden />
            <div className="relative flex flex-col items-start gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-xl">
                <span className="text-sm font-medium tracking-wide text-gold-300">ابدأ الآن</span>
                <h2 className="mt-2 text-3xl font-bold text-white lg:text-4xl">ابدأ رحلتك العقارية بثقة</h2>
                <p className="mt-3 leading-relaxed text-white/75">
                  اختر من مشاريع ووحدات مختارة بعناية، وتواصل مع مستشار يساعدك في القرار المناسب.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <ButtonLink href={routes.contact as Route} variant="gold" size="lg">
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
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}
