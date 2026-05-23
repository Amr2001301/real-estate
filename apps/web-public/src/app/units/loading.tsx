import { Section } from '@/components/ui/Section';
import { PageHero } from '@/components/layout/PageHero';

function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-3xl border border-hairline bg-surface shadow-soft">
      <div className="aspect-[4/3] w-full bg-surface-soft" />
      <div className="space-y-3 p-7">
        <div className="h-3 w-1/3 rounded-full bg-surface-soft" />
        <div className="h-7 w-1/2 rounded-full bg-surface-soft" />
        <div className="mt-5 h-3 w-2/3 rounded-full bg-surface-soft" />
      </div>
    </div>
  );
}

export default function UnitsLoading() {
  return (
    <>
      <PageHero
        eyebrow="الوحدات السكنية"
        title="وحدات فاخرة جاهزة لاختيارك"
        subtitle="اكتشف مجموعة مختارة من الشقق والفيلات المصممة لتناسب أسلوب حياتك واستثمارك."
      />
      <Section tone="canvas">
        <div className="h-40 rounded-3xl border border-hairline bg-surface shadow-soft" />
        <div className="mt-12 grid animate-pulse gap-7 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </Section>
    </>
  );
}
