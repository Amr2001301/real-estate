import Link from 'next/link';
import type { Route } from 'next';
import { SITE } from '@/lib/seo';
import { Container } from '@/components/ui/Container';
import { Divider } from '@/components/ui/Divider';
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

/** Premium split layout: cinematic navy panel + clean auth card. */
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
    <section className="bg-canvas pb-20 pt-28 sm:pt-32">
      <Container>
        <div className="grid items-stretch gap-8 lg:grid-cols-2">
          {/* Cinematic panel */}
          <div className="relative hidden overflow-hidden rounded-4xl lg:block">
            <div
              className="absolute inset-0 motion-safe:animate-ken-burns"
              style={{ background: 'radial-gradient(130% 130% at 80% 0%, #24426A 0%, #14273F 55%, #0B1726 100%)' }}
              aria-hidden
            />
            <span className="pointer-events-none absolute -left-24 top-1/4 h-80 w-80 rounded-full bg-gold-400/12 blur-3xl" aria-hidden />
            <div className="relative flex h-full flex-col justify-end p-12">
              <Reveal>
                <span className="text-sm font-medium tracking-wide text-gold-200">{eyebrow}</span>
                <Divider accent className="my-5" />
                <h2 className="text-display-2 text-white">{title}</h2>
                <p className="mt-4 max-w-md leading-relaxed text-white/75">{subtitle}</p>
              </Reveal>
            </div>
          </div>

          {/* Form card */}
          <div className="flex flex-col justify-center">
            <div className="mx-auto w-full max-w-md">
              {/* Mobile heading (panel is hidden on small screens) */}
              <div className="mb-8 lg:hidden">
                <span className="text-sm font-medium tracking-wide text-gold-500">{eyebrow}</span>
                <h1 className="mt-2 text-display-2 text-navy">{title}</h1>
                <p className="mt-3 text-ink-muted">{subtitle}</p>
              </div>

              {children}

              <p className="mt-8 text-center text-sm text-ink-muted">
                {switchPrompt}{' '}
                <Link href={switchHref as Route} className="font-medium text-navy underline-offset-4 hover:text-gold-600 hover:underline">
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
