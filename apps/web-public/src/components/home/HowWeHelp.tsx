import { Search, Scale, CalendarCheck, KeyRound } from 'lucide-react';
import { Section, SectionHeading } from '@/components/ui/Section';
import { Stagger } from '@/components/motion/Stagger';

const STEPS = [
  { icon: Search, title: 'استكشف', body: 'تصفّح المشاريع والوحدات المختارة بما يناسب أسلوب حياتك.' },
  { icon: Scale, title: 'قارن', body: 'وازن بين الخيارات بسهولة لتحديد الأنسب لاحتياجك وميزانيتك.' },
  { icon: CalendarCheck, title: 'احجز زيارة', body: 'اطلب زيارة أو استشارة، وسيتواصل معك أحد مستشارينا.' },
  { icon: KeyRound, title: 'اتخذ قرارك', body: 'نرافقك حتى تطمئن إلى اختيارك النهائي بثقة.' },
] as const;

export function HowWeHelp() {
  return (
    <Section tone="canvas">
      <SectionHeading
        align="center"
        eyebrow="كيف نساعدك"
        title="رحلتك معنا في خطوات واضحة"
        description="مسار بسيط وراقٍ يأخذك من الاستكشاف إلى القرار بثقة."
        className="mx-auto"
      />
      <Stagger className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4" childClassName="h-full" step={80}>
        {STEPS.map(({ icon: Icon, title, body }, i) => (
          <div key={title} className="relative flex h-full flex-col rounded-3xl border border-hairline bg-surface p-7 shadow-soft">
            <span className="absolute left-6 top-6 font-display text-4xl leading-none text-gold-100">
              {['١', '٢', '٣', '٤'][i]}
            </span>
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-navy text-gold-200">
              <Icon className="h-6 w-6" aria-hidden />
            </span>
            <h3 className="mt-6 text-lg text-navy">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">{body}</p>
          </div>
        ))}
      </Stagger>
    </Section>
  );
}
