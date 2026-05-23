import { Section } from '@/components/ui/Section';
import { PageHero } from '@/components/layout/PageHero';

export default function CompareLoading() {
  return (
    <>
      <PageHero
        eyebrow="مقارنة الوحدات"
        title="قارن اختياراتك بثقة"
        subtitle="اجمع أهم التفاصيل في مكان واحد لتختار الوحدة الأقرب لأسلوب حياتك واستثمارك."
      />
      <Section tone="canvas">
        <div className="grid animate-pulse gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-3xl border border-hairline bg-surface shadow-soft">
              <div className="aspect-[4/3] w-full bg-surface-soft" />
              <div className="space-y-3 p-5">
                <div className="h-3 w-1/2 rounded-full bg-surface-soft" />
                <div className="h-6 w-1/3 rounded-full bg-surface-soft" />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-10 h-80 animate-pulse rounded-3xl bg-surface-soft" />
      </Section>
    </>
  );
}
