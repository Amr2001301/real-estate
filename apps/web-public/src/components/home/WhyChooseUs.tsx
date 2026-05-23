import { Gem, Layers, Scale, Users, Sparkles, Bell } from 'lucide-react';
import { Section } from '@/components/ui/Section';
import { Divider } from '@/components/ui/Divider';
import { Stagger } from '@/components/motion/Stagger';

const VALUES = [
  { icon: Gem, title: 'مشاريع منتقاة بعناية', body: 'وجهات مختارة تجمع بين الموقع، الجودة، والقيمة.' },
  { icon: Layers, title: 'فرص استثمارية متنوعة', body: 'خيارات سكنية وتجارية وإدارية تناسب أهدافك.' },
  { icon: Scale, title: 'مقارنة ذكية للوحدات', body: 'قارن بسهولة لتصل للاختيار الأنسب.' },
  { icon: Users, title: 'دعم من مستشارين', body: 'فريق يساعدك في كل خطوة قبل القرار.' },
  { icon: Sparkles, title: 'تجربة تصفّح راقية', body: 'واجهة واضحة تجعل البحث أسرع وأسهل.' },
  { icon: Bell, title: 'متابعة سريعة', body: 'تنسيق الزيارات والرد على استفساراتك بوضوح.' },
] as const;

export function WhyChooseUs() {
  return (
    <Section tone="canvas" className="pt-8 pb-8 sm:pt-10 sm:pb-10 lg:pt-12 lg:pb-10">
      {/* Two-level heading — gold pill eyebrow + title + one-line subtitle */}
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-block rounded-full bg-gold-100/70 px-3 py-1 text-sm font-semibold text-gold-600 sm:text-base">
          لماذا دار الفخامة
        </span>
        <h2 className="mt-4 text-3xl font-bold text-navy lg:text-4xl">تجربة عقارية تمنحك الثقة</h2>
        <p className="mt-2 text-ink-muted">اختيارات منتقاة، مقارنة واضحة، ومتابعة تساعدك قبل القرار.</p>
      </div>

      <Stagger className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" childClassName="h-full" step={70}>
        {VALUES.map(({ icon: Icon, title, body }) => (
          <div
            key={title}
            className="group flex h-full flex-col rounded-2xl border border-hairline bg-surface p-4 shadow-soft transition-all duration-300 ease-smooth hover:-translate-y-1 hover:border-gold-300 hover:shadow-lift"
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gold-100 text-gold-600 transition-colors group-hover:bg-gold-400 group-hover:text-navy">
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <h3 className="mt-2.5 text-base font-semibold text-navy">{title}</h3>
            <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-ink-muted">{body}</p>
            <Divider accent className="mt-2.5" />
          </div>
        ))}
      </Stagger>
    </Section>
  );
}
