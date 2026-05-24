import { Check, Headset } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { Badge } from '@/components/ui/Badge';
import { ContactForm } from '@/components/contact/ContactForm';

const POINTS = [
  'ترشيحات مناسبة حسب نوع العقار',
  'مقارنة واضحة بين الوحدات والمشاريع',
  'متابعة معك حتى اختيار القرار الأنسب',
] as const;

// Subtle navy dot texture over the warm panel — keeps the gold from reading flat.
const DOTS = {
  backgroundImage: 'radial-gradient(rgba(15,30,51,0.06) 1px, transparent 1px)',
  backgroundSize: '20px 20px',
} as const;

/** Premium lead-capture band — warm gold panel with an elevated white form card. */
export function HomeContact() {
  return (
    <section className="py-10 sm:py-12 lg:py-14">
      <Container>
        <div className="relative overflow-hidden rounded-3xl border border-gold-200/60 bg-gradient-to-bl from-gold-100 via-gold-50 to-surface-soft px-5 py-8 shadow-card sm:px-8 sm:py-10 lg:px-12 lg:py-12">
          {/* Texture + warm glow */}
          <span aria-hidden className="pointer-events-none absolute inset-0" style={DOTS} />
          <span aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gold-200/40 blur-3xl" />

          <div className="relative grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
            {/* Copy — right in RTL */}
            <div>
              <Badge tone="navy">استشارة مجانية</Badge>
              <h2 className="mt-4 text-3xl font-bold leading-tight text-navy lg:text-4xl">
                خلّينا نرشح لك{' '}
                <span className="relative inline-block whitespace-nowrap">
                  العقار الأنسب
                  <span aria-hidden className="absolute inset-x-0 -bottom-1 h-2.5 rounded-full bg-gold-300/80 sm:h-3" />
                </span>
              </h2>
              <p className="mt-4 max-w-md text-base leading-relaxed text-ink-muted sm:text-lg">
                اترك بياناتك، وسيساعدك مستشار عقاري في اختيار مشروع أو وحدة تناسب احتياجك وميزانيتك.
              </p>

              <ul className="mt-7 space-y-3">
                {POINTS.map((p) => (
                  <li key={p} className="flex items-center gap-3 text-navy">
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold-100 text-gold-600 ring-1 ring-gold-200/70">
                      <Check className="h-3.5 w-3.5" aria-hidden />
                    </span>
                    <span className="text-sm sm:text-base">{p}</span>
                  </li>
                ))}
              </ul>

              <a
                href="tel:+966110000000"
                className="mt-9 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-navy px-6 text-[15px] font-medium text-white shadow-soft transition-all hover:-translate-y-0.5 hover:bg-navy-700"
              >
                <Headset className="h-5 w-5 text-gold-300" aria-hidden />
                تواصل مع مستشار
              </a>
            </div>

            {/* Elevated white form card — left in RTL. Reuses the real lead form.
                Homepage locks to a single consultation mode (no tabs, no visit booking). */}
            <div>
              <ContactForm initialMode="info" context={{}} showTabs={false} eyebrow="طلب استشارة" />
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
