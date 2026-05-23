import { ArrowLeft, MessageCircle } from 'lucide-react';
import { routes } from '@/lib/routes';
import { formatNumber } from '@/lib/format';
import { Container } from '@/components/ui/Container';
import { ButtonLink } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Reveal } from '@/components/motion/Reveal';

interface HeroProps {
  projectsCount: number | null;
  unitsCount: number | null;
}

export function Hero({ projectsCount, unitsCount }: HeroProps) {
  const stats: Array<{ value: string; label: string }> = [
    { value: projectsCount !== null ? formatNumber(projectsCount) : '—', label: 'مشاريع مختارة' },
    { value: unitsCount !== null ? formatNumber(unitsCount) : '—', label: 'وحدات متاحة' },
    { value: '٢٤/٧', label: 'دعم واستشارات' },
  ];

  return (
    <section className="relative flex min-h-[92vh] items-center overflow-hidden bg-navy">
      {/* Cinematic gradient backdrop with a slow Ken-Burns drift. */}
      <div
        className="pointer-events-none absolute inset-0 motion-safe:animate-ken-burns"
        style={{
          background:
            'radial-gradient(130% 130% at 80% 0%, #24426A 0%, #14273F 50%, #0B1726 100%)',
        }}
        aria-hidden
      />
      <div className="pointer-events-none absolute -left-32 top-1/4 h-[28rem] w-[28rem] rounded-full bg-gold-400/12 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-canvas/95 to-transparent" aria-hidden />

      <Container className="relative pb-28 pt-32">
        <div className="max-w-3xl">
          <Reveal>
            <Badge tone="gold">فن العيش الراقي</Badge>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="mt-6 text-hero text-white">فن العيش الراقي يبدأ من اختيارك الصحيح</h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/75">
              اكتشف مشاريع ووحدات مختارة بعناية لتناسب أسلوب حياتك واستثمارك.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <ButtonLink href={routes.projects} variant="gold" size="lg">
                استكشف المشاريع
                <ArrowLeft className="h-5 w-5" aria-hidden />
              </ButtonLink>
              <ButtonLink
                href={routes.contact}
                variant="outline"
                size="lg"
                className="border-white/25 text-white hover:border-white/50 hover:bg-white/5"
              >
                <MessageCircle className="h-5 w-5" aria-hidden />
                تحدث مع مستشار
              </ButtonLink>
            </div>
          </Reveal>

          <Reveal delay={320}>
            <dl className="mt-14 flex flex-wrap gap-x-12 gap-y-6 border-t border-white/10 pt-8">
              {stats.map((s) => (
                <div key={s.label}>
                  <dt className="font-display text-3xl text-gold-200">{s.value}</dt>
                  <dd className="mt-1 text-sm text-white/65">{s.label}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
