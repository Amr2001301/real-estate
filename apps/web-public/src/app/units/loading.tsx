import { Section } from '@/components/ui/Section';
import { PageHero } from '@/components/layout/PageHero';
import { Skeleton, SkeletonCard } from '@/components/ui/skeleton';

export default function UnitsLoading() {
  return (
    <>
      <PageHero
        eyebrow="الوحدات السكنية"
        title="وحدات فاخرة جاهزة لاختيارك"
        subtitle="اكتشف مجموعة مختارة من الشقق والفيلات المصممة لتناسب أسلوب حياتك واستثمارك."
      />
      <Section tone="canvas">
        <span className="sr-only">جارٍ التحميل…</span>
        {/* Filter bar (taller — more controls) */}
        <Skeleton className="h-40 w-full rounded-3xl" />
        {/* Card grid */}
        <div className="mt-12 grid gap-7 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </Section>
    </>
  );
}
