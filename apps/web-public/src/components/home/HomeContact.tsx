import { Phone, CheckCircle2 } from 'lucide-react';
import { Section } from '@/components/ui/Section';
import { Container } from '@/components/ui/Container';
import { Divider } from '@/components/ui/Divider';
import { ContactForm } from '@/components/contact/ContactForm';

const POINTS = [
  'مستشار مختص يرافقك في كل خطوة',
  'ترشيحات تناسب احتياجك وميزانيتك',
  'تنسيق زيارات ومتابعة سريعة',
] as const;

/** Premium lead-capture band on the homepage. Reuses the real contact form. */
export function HomeContact() {
  return (
    <Section tone="soft" contained={false} className="overflow-hidden">
      <Container>
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
          {/* Copy */}
          <div>
            <span className="text-sm font-medium tracking-wide text-gold-500">تواصل معنا</span>
            <Divider accent className="my-4" />
            <h2 className="text-3xl font-bold text-navy lg:text-4xl">اطلب استشارة عقارية مجانية</h2>
            <p className="mt-4 max-w-lg text-lg leading-relaxed text-ink-muted">
              اترك بياناتك وأخبرنا عن اهتمامك، وسيتواصل معك أحد مستشارينا لمساعدتك على اختيار الأنسب لك.
            </p>
            <ul className="mt-7 space-y-3">
              {POINTS.map((p) => (
                <li key={p} className="flex items-center gap-3 text-navy">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-hidden />
                  {p}
                </li>
              ))}
            </ul>
            <a
              href="tel:+966110000000"
              dir="ltr"
              className="mt-8 inline-flex items-center gap-2 font-display text-2xl text-navy transition-colors hover:text-gold-600"
            >
              <Phone className="h-5 w-5 text-gold-500" aria-hidden />
              +966 11 000 0000
            </a>
          </div>

          {/* Real lead form (info mode) */}
          <div>
            <ContactForm initialMode="info" context={{}} />
          </div>
        </div>
      </Container>
    </Section>
  );
}
