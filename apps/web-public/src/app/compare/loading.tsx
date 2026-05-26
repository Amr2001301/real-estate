import { Section } from '@/components/ui/Section';
import { PageHero } from '@/components/layout/PageHero';
import { Skeleton, SkeletonCard } from '@/components/ui/skeleton';

export default function CompareLoading() {
  return (
    <>
      <PageHero
        eyebrow="مقارنة الوحدات"
        title="قارن اختياراتك بثقة"
        subtitle="اجمع أهم التفاصيل في مكان واحد لتختار الوحدة الأقرب لأسلوب حياتك واستثمارك."
      />
      <Section tone="canvas">
        <span className="sr-only">جارٍ التحميل…</span>
        {/* Selected unit cards */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        {/* Comparison table */}
        <Skeleton className="mt-10 h-80 w-full rounded-3xl" />
      </Section>
    </>
  );
}
