import { Phone, CheckCircle2 } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { Badge } from '@/components/ui/Badge';
import { ContactForm } from '@/components/contact/ContactForm';

const POINTS = [
  'مستشار مختص يرافقك في كل خطوة',
  'ترشيحات تناسب احتياجك وميزانيتك',
  'تنسيق زيارات ومتابعة سريعة',
] as const;

// Subtle navy dot texture over the warm panel — keeps the gold from reading flat.
const DOTS = {
  backgroundImage: 'radial-gradient(rgba(15,30,51,0.06) 1px, transparent 1px)',
  backgroundSize: '20px 20px',
} as const;

/** Premium lead-capture band — warm gold panel with an elevated white form card. */
export function HomeContact() {
  return (
    <section className="py-12 lg:py-16">
      <Container>
        <div className="relative overflow-hidden rounded-3xl border border-gold-200/60 bg-gradient-to-bl from-gold-100 via-gold-50 to-surface-soft px-5 py-8 shadow-card sm:px-8 sm:py-10 lg:px-12 lg:py-12">
          {/* Texture + warm glow */}
          <span aria-hidden className="pointer-events-none absolute inset-0" style={DOTS} />
          <span aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gold-200/40 blur-3xl" />

          <div className="relative grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
            {/* Copy — right in RTL */}
            <div>
              <Badge tone="navy">للتواصل</Badge>
              <h2 className="mt-4 text-3xl font-bold leading-tight text-navy lg:text-4xl">تواصل معنا</h2>
              <p className="mt-3 text-lg font-medium text-navy/80 sm:text-xl">
                اكتشف خطوتك التالية في عالم العقارات
              </p>
              <p className="mt-3 max-w-md leading-relaxed text-ink-muted">
                اترك بياناتك وسيتواصل معك أحد مستشارينا لمساعدتك في اختيار الأنسب لك.
              </p>

              <ul className="mt-6 space-y-2.5">
                {POINTS.map((p) => (
                  <li key={p} className="flex items-center gap-2.5 text-navy">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-gold-600" aria-hidden />
                    <span className="text-sm sm:text-base">{p}</span>
                  </li>
                ))}
              </ul>

              <a
                href="tel:+966110000000"
                dir="ltr"
                className="mt-7 inline-flex items-center gap-2 font-display text-2xl text-navy transition-colors hover:text-gold-600"
              >
                <Phone className="h-5 w-5 text-gold-500" aria-hidden />
                +966 11 000 0000
              </a>
            </div>

            {/* Elevated white form card — left in RTL. Reuses the real lead form. */}
            <div>
              <ContactForm initialMode="info" context={{}} />
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
