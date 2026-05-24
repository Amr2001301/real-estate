import Link from 'next/link';
import type { Route } from 'next';
import { Home, Briefcase, Store, Stethoscope, Hotel, ArrowLeft } from 'lucide-react';
import { routes } from '@/lib/routes';
import { Section } from '@/components/ui/Section';
import { Stagger } from '@/components/motion/Stagger';

// UI-level routing into real browsing experiences. Categories with no exact
// backend filter (طبي / فندقي) route to the general units listing — never
// fabricated. Projects live in the next section, so no "مشاريع مميزة" here.
const CATEGORIES: Array<{ icon: typeof Home; title: string; sub: string; href: string }> = [
  { icon: Home, title: 'سكني', sub: 'شقق ومساكن', href: routes.units },
  { icon: Briefcase, title: 'إداري', sub: 'مكاتب وأعمال', href: `${routes.units}?type=office` },
  { icon: Store, title: 'تجاري', sub: 'محلات ومعارض', href: `${routes.units}?type=retail` },
  { icon: Stethoscope, title: 'طبي', sub: 'عيادات ومراكز', href: routes.units },
  { icon: Hotel, title: 'فندقي', sub: 'ضيافة وتشغيل', href: routes.units },
];

// Warm gold corner glow inside each card so they never read as empty boxes.
const GLOW = { background: 'radial-gradient(circle at 100% 0%, rgba(200,162,75,0.16), transparent 58%)' } as const;

export function InvestmentCategories() {
  return (
    <Section tone="canvas" className="py-10 sm:py-12 lg:py-14">
      {/* Contained editorial module on a warm surface */}
      <div className="rounded-3xl border border-hairline bg-surface-soft p-6 shadow-card sm:p-8 lg:p-10">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold text-navy lg:text-4xl">اختر مجال استثمارك</h2>
          <p className="mt-2 text-ink-muted">حلول عقارية تناسب السكن، الاستثمار، والتشغيل.</p>
        </div>

        <Stagger
          className="mt-7 grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-5"
          childClassName="h-full"
          step={60}
        >
          {CATEGORIES.map(({ icon: Icon, title, sub, href }) => (
            <Link
              key={title}
              href={href as Route}
              className="group relative flex h-40 items-center justify-center overflow-hidden rounded-2xl border border-hairline bg-surface p-5 text-center shadow-soft transition-all duration-300 ease-smooth hover:-translate-y-1.5 hover:border-gold-300 hover:shadow-[0_0_0_3px_rgba(200,162,75,0.18),0_18px_48px_-16px_rgba(15,30,51,0.22)] sm:h-44"
            >
              <span className="pointer-events-none absolute inset-0" style={GLOW} aria-hidden />
              {/* Four neatly stacked, centred elements */}
              <div className="relative flex flex-col items-center gap-2.5">
                <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-gold-100 to-gold-200 text-gold-600 ring-1 ring-gold-200/70 transition-all duration-300 group-hover:scale-105 group-hover:from-gold-300 group-hover:to-gold-500 group-hover:text-navy group-hover:ring-gold-400">
                  <Icon className="h-7 w-7" aria-hidden />
                </span>
                <h3 className="text-lg font-bold leading-none text-navy">{title}</h3>
                <p className="text-xs text-ink-muted">{sub}</p>
                <span className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-ink-muted transition-colors group-hover:text-gold-600">
                  تصفّح
                  <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-1" aria-hidden />
                </span>
              </div>
            </Link>
          ))}
        </Stagger>
      </div>
    </Section>
  );
}
