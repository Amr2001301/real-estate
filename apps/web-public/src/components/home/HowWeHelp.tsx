import { Search, Scale, CalendarCheck, KeyRound } from 'lucide-react';
import { Section } from '@/components/ui/Section';
import { Stagger } from '@/components/motion/Stagger';

const STEPS = [
  { icon: Search, num: '١', title: 'استكشف', body: 'تصفّح المشاريع والوحدات المناسبة لأسلوب حياتك.' },
  { icon: Scale, num: '٢', title: 'قارن', body: 'وازن بين الخيارات بسهولة حسب احتياجك وميزانيتك.' },
  { icon: CalendarCheck, num: '٣', title: 'احجز زيارة', body: 'اطلب زيارة أو استشارة وسيتواصل معك أحد مستشارينا.' },
  { icon: KeyRound, num: '٤', title: 'اتخذ قرارك', body: 'نرافقك حتى تطمئن إلى اختيارك النهائي بثقة.' },
] as const;

export function HowWeHelp() {
  return (
    <Section tone="canvas" className="pt-8 pb-12 sm:pt-10 lg:pt-12 lg:pb-14">
      {/* Tight, centered header */}
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-block rounded-full bg-gold-100/70 px-3 py-1 text-sm font-semibold text-gold-600 sm:text-base">
          كيف نساعدك
        </span>
        <h2 className="mt-3 text-2xl font-bold leading-tight text-navy sm:text-3xl lg:text-[2.35rem]">رحلتك العقارية في ٤ خطوات</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted sm:text-base">
          من الاستكشاف حتى القرار، كل خطوة واضحة وسهلة.
        </p>
      </div>

      {/* Steps — with a faint desktop-only journey line behind them */}
      <div className="relative mt-8">
        <span
          aria-hidden
          className="absolute inset-x-8 top-12 hidden h-px bg-gradient-to-l from-transparent via-gold-200/60 to-transparent lg:block"
        />
        <Stagger
          className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4"
          childClassName="h-full"
          step={80}
        >
          {STEPS.map(({ icon: Icon, num, title, body }) => (
            <div
              key={title}
              className="group relative flex h-full min-h-[150px] flex-col overflow-hidden rounded-2xl border border-hairline bg-surface px-6 py-5 shadow-soft transition-all duration-300 ease-smooth hover:-translate-y-1 hover:border-gold-300 hover:shadow-lift"
            >
              {/* Subtle gold step number — corner watermark, never dominant */}
              <span
                aria-hidden
                className="pointer-events-none absolute end-5 top-4 font-display text-3xl font-bold leading-none text-gold-300/50"
              >
                {num}
              </span>
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-navy text-gold-200 transition-colors group-hover:bg-navy-700">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="mt-4 text-base font-semibold text-navy">{title}</h3>
              <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-ink-muted">{body}</p>
            </div>
          ))}
        </Stagger>
      </div>
    </Section>
  );
}
