import Link from 'next/link';
import type { Route } from 'next';
import { CalendarCheck, Heart, Headset, BellRing, ShieldCheck } from 'lucide-react';
import { SITE } from '@/lib/seo';
import { Container } from '@/components/ui/Container';
import { Reveal } from '@/components/motion/Reveal';

interface AuthShellProps {
  eyebrow?: string;
  title: string;
  subtitle: string;
  switchPrompt: string;
  switchLabel: string;
  switchHref: string;
  children: React.ReactNode;
}

// Faint dot texture so the navy panel reads with depth, not as a flat block.
const DOTS = {
  backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)',
  backgroundSize: '22px 22px',
} as const;

// Generic account benefits — true for any logged-in customer, no invented claims.
const BENEFITS = [
  { icon: CalendarCheck, text: 'متابعة طلباتك وزياراتك في مكان واحد' },
  { icon: Heart, text: 'حفظ وحداتك ومشاريعك المفضّلة' },
  { icon: Headset, text: 'تواصل أسرع مع مستشارك العقاري' },
  { icon: BellRing, text: 'إشعارات بأحدث العروض والإتاحات' },
] as const;

/** Premium split layout: a value-prop navy panel + a clean auth card. */
export function AuthShell({
  eyebrow = SITE.name,
  title,
  subtitle,
  switchPrompt,
  switchLabel,
  switchHref,
  children,
}: AuthShellProps) {
  return (
    <section className="bg-canvas pb-16 pt-28 sm:pt-32">
      <Container>
        <div className="grid items-stretch gap-8 lg:grid-cols-2">
          {/* Cinematic value-prop panel */}
          <div className="relative hidden overflow-hidden rounded-4xl shadow-card lg:block">
            <div
              className="absolute inset-0"
              style={{ background: 'radial-gradient(130% 130% at 80% 0%, #24426A 0%, #14273F 55%, #0B1726 100%)' }}
              aria-hidden
            />
            <span className="pointer-events-none absolute inset-0" style={DOTS} aria-hidden />
            <span className="pointer-events-none absolute -left-24 top-1/4 h-80 w-80 rounded-full bg-gold-400/12 blur-3xl" aria-hidden />

            <div className="relative flex h-full flex-col justify-between gap-12 p-10 xl:p-12">
              {/* Brand mark */}
              <span className="inline-flex items-center gap-2 text-sm font-semibold tracking-wide text-gold-200">
                <span className="h-2 w-2 rounded-full bg-gold-400" aria-hidden />
                {eyebrow}
              </span>

              <Reveal>
                <div>
                  <h2 className="text-display-2 text-white">{title}</h2>
                  <span aria-hidden className="mt-5 block h-1 w-16 rounded-full bg-gold-400" />
                  <p className="mt-5 max-w-md leading-relaxed text-white/75">{subtitle}</p>

                  <ul className="mt-8 space-y-3.5">
                    {BENEFITS.map(({ icon: Icon, text }) => (
                      <li key={text} className="flex items-center gap-3 text-[15px] text-white/85">
                        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.08] text-gold-200 ring-1 ring-white/10">
                          <Icon className="h-[18px] w-[18px]" aria-hidden />
                        </span>
                        {text}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>

              <div className="flex items-center gap-2 border-t border-white/10 pt-5 text-xs text-white/55">
                <ShieldCheck className="h-4 w-4 text-gold-200" aria-hidden />
                بياناتك محمية ولن تُشارك مع أي جهة خارجية.
              </div>
            </div>
          </div>

          {/* Form card */}
          <div className="flex flex-col justify-center">
            <div className="mx-auto w-full max-w-md">
              {/* Mobile heading (panel is hidden on small screens) */}
              <div className="mb-8 lg:hidden">
                <span className="inline-flex items-center gap-2 text-sm font-semibold tracking-wide text-gold-500">
                  <span className="h-2 w-2 rounded-full bg-gold-400" aria-hidden />
                  {eyebrow}
                </span>
                <h1 className="mt-3 text-display-2 text-ink-strong">{title}</h1>
                <p className="mt-3 text-ink-muted">{subtitle}</p>
              </div>

              {children}

              <p className="mt-8 text-center text-sm text-ink-muted">
                {switchPrompt}{' '}
                <Link
                  href={switchHref as Route}
                  className="font-semibold text-ink-strong underline-offset-4 hover:text-gold-600 hover:underline"
                >
                  {switchLabel}
                </Link>
              </p>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
