import { ArrowLeft, Building2, Home, MessageCircle } from 'lucide-react';
import { buildMetadata } from '@/lib/seo';
import { routes } from '@/lib/routes';
import { Container } from '@/components/ui/Container';
import { Section, SectionHeading } from '@/components/ui/Section';
import { ButtonLink } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PremiumCard } from '@/components/ui/PremiumCard';
import { IconCircle } from '@/components/ui/IconCircle';
import { Divider } from '@/components/ui/Divider';
import { Reveal } from '@/components/motion/Reveal';
import { Stagger } from '@/components/motion/Stagger';

export const metadata = buildMetadata();

// W2 placeholder homepage — proves the shell, tokens, and motion work. The real
// editorial homepage (hero, featured projects/units, etc.) lands in W3.
const QUICK_LINKS = [
  { href: routes.projects, icon: Building2, title: 'المشاريع', body: 'وجهات سكنية مختارة بعناية.' },
  { href: routes.units, icon: Home, title: 'الوحدات', body: 'وحدات فاخرة تناسب أسلوب حياتك.' },
  { href: routes.contact, icon: MessageCircle, title: 'تواصل معنا', body: 'فريقنا جاهز لمساعدتك.' },
] as const;

export default function HomePage() {
  return (
    <>
      {/* Cinematic hero band */}
      <section className="relative flex min-h-[88vh] items-center overflow-hidden bg-navy">
        <div
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            background:
              'radial-gradient(120% 120% at 80% 0%, #1C3050 0%, #0F1E33 55%, #0B1726 100%)',
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -left-24 top-1/3 h-96 w-96 rounded-full bg-gold-400/10 blur-3xl"
          aria-hidden
        />
        <Container className="relative">
          <div className="max-w-3xl pt-24">
            <Reveal>
              <Badge tone="gold">تجربة عقارية فاخرة</Badge>
            </Reveal>
            <Reveal delay={80}>
              <h1 className="mt-6 text-hero text-white">تجربة عقارية فاخرة تبدأ من هنا</h1>
            </Reveal>
            <Reveal delay={160}>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/75">
                اكتشف مشاريع ووحدات مختارة بعناية لأسلوب حياة أرقى.
              </p>
            </Reveal>
            <Reveal delay={240}>
              <div className="mt-10 flex flex-wrap items-center gap-4">
                <ButtonLink href={routes.projects} variant="gold" size="lg">
                  استكشف المشاريع
                  <ArrowLeft className="h-5 w-5" aria-hidden />
                </ButtonLink>
                <ButtonLink href={routes.units} variant="outline" size="lg" className="border-white/25 text-white hover:border-white/50 hover:bg-white/5">
                  تصفح الوحدات
                </ButtonLink>
              </div>
            </Reveal>
          </div>
        </Container>
      </section>

      {/* Quick links — proves cards, icons, stagger */}
      <Section tone="canvas">
        <SectionHeading
          eyebrow="ابدأ رحلتك"
          title="كل ما تحتاجه في مكان واحد"
          description="منصة عقارية متكاملة تجمع المشاريع والوحدات وفريق دعم متفانٍ."
        />
        <Stagger className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3" step={90}>
          {QUICK_LINKS.map(({ href, icon: Icon, title, body }) => (
            <PremiumCard key={href} interactive className="p-8">
              <IconCircle tone="gold">
                <Icon className="h-6 w-6" aria-hidden />
              </IconCircle>
              <h3 className="mt-6 text-xl text-navy">{title}</h3>
              <p className="mt-2 text-ink-muted">{body}</p>
              <Divider accent className="mt-6" />
            </PremiumCard>
          ))}
        </Stagger>
      </Section>

      {/* Dark CTA moment */}
      <Section tone="navy">
        <div className="flex flex-col items-center text-center">
          <SectionHeading
            invert
            align="center"
            eyebrow="جاهز للبدء؟"
            title="دعنا نساعدك في إيجاد منزل أحلامك"
          />
          <div className="mt-8">
            <ButtonLink href={routes.contact} variant="gold" size="lg">
              تواصل معنا الآن
            </ButtonLink>
          </div>
        </div>
      </Section>
    </>
  );
}
