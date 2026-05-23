import { ArrowLeft, MessageCircle, ShieldCheck, Scale, Headset, Building2, Home, Users } from 'lucide-react';
import { routes } from '@/lib/routes';
import { formatNumber } from '@/lib/format';
import { Container } from '@/components/ui/Container';
import { ButtonLink } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Reveal } from '@/components/motion/Reveal';

const CHIPS = [
  { icon: ShieldCheck, label: 'مشاريع مختارة بعناية' },
  { icon: Scale, label: 'مقارنة سهلة قبل القرار' },
  { icon: Headset, label: 'مستشارون يرافقونك' },
] as const;

// Faint architectural "blueprint" grid — adds brand texture over the gradient.
const BLUEPRINT = {
  backgroundImage:
    'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
  backgroundSize: '64px 64px',
} as const;

interface HeroProps {
  image?: string | null;
  projectsCount?: number | null;
  unitsCount?: number | null;
}

export function Hero({ image, projectsCount, unitsCount }: HeroProps) {
  // Glass stat cards fill the otherwise-empty side. Counts are real (from the
  // fetched feeds); the consultations card is text-only — no fabricated number.
  const stats: Array<{ icon: typeof Building2; value: string; label: string }> = [
    { icon: Building2, value: projectsCount != null ? formatNumber(projectsCount) : '—', label: 'مشاريع مختارة' },
    { icon: Home, value: unitsCount != null ? formatNumber(unitsCount) : '—', label: 'وحدات متاحة' },
    { icon: Users, value: 'بدعم متخصص', label: 'استشارات عقارية' },
  ];

  return (
    // Compact hero: ~420px mobile → ~500px desktop (not full-screen).
    <section className="relative flex min-h-[420px] items-center overflow-hidden bg-navy sm:min-h-[460px] lg:min-h-[500px]">
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(130% 130% at 82% 0%, #24426A 0%, #14273F 52%, #0B1726 100%)' }}
        aria-hidden
      />
      {/* Real-estate photo from existing media (slightly more visible) */}
      {image && (
        <div
          className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-45 motion-safe:animate-ken-burns"
          style={{ backgroundImage: `url(${image})` }}
          aria-hidden
        />
      )}
      <div className="pointer-events-none absolute inset-0 opacity-40" style={BLUEPRINT} aria-hidden />
      {/* Navy overlay — heaviest at the RTL start (right) for legible text, lets architecture show toward the left */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'linear-gradient(to left, rgba(11,23,38,0.90) 0%, rgba(15,30,51,0.72) 46%, rgba(11,23,38,0.38) 100%)' }}
        aria-hidden
      />
      <div className="pointer-events-none absolute -left-24 top-1/4 h-80 w-80 rounded-full bg-gold-400/12 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-navy to-transparent" aria-hidden />

      <Container className="relative pb-20 pt-24 sm:pt-28">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          {/* Content (RTL start = right) */}
          <div className="max-w-xl">
            <Reveal>
              <Badge tone="gold">دار الفخامة</Badge>
            </Reveal>
            <Reveal delay={80}>
              <h1 className="mt-4 text-3xl font-bold leading-[1.18] text-white sm:text-4xl lg:text-[3.25rem]">
                استثمر في عقار مختار بعناية
              </h1>
            </Reveal>
            <Reveal delay={160}>
              <p className="mt-3 text-lg leading-relaxed text-white/75">
                مشاريع ووحدات سكنية وتجارية في مواقع مدروسة تناسب السكن والاستثمار.
              </p>
            </Reveal>
            {/* Trust chips kept above the CTA so the overlapping search panel never covers them. */}
            <Reveal delay={240}>
              <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
                {CHIPS.map(({ icon: Icon, label }) => (
                  <li key={label} className="inline-flex items-center gap-2 text-sm text-white/70">
                    <Icon className="h-4 w-4 text-gold-300" aria-hidden />
                    {label}
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={320}>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <ButtonLink href={routes.units} variant="gold" size="lg">
                  استكشف الوحدات
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
          </div>

          {/* Subtle glass stat block (RTL end = left). Desktop only — supporting proof, not a second hero. */}
          <Reveal delay={200} className="hidden lg:block">
            <div className="ms-auto grid w-full max-w-[18rem] gap-3">
              {stats.map(({ icon: Icon, value, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.07] px-4 py-3 backdrop-blur-sm"
                >
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-gold-200">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <div className="font-display text-lg font-semibold leading-none text-white">{value}</div>
                    <div className="mt-0.5 text-xs text-white/65">{label}</div>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
