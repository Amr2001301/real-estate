import { Section } from '@/components/ui/Section';
import { PageHero } from '@/components/layout/PageHero';
import { Skeleton, SkeletonCard } from '@/components/ui/skeleton';

export default function ProjectsLoading() {
  return (
    <>
      <PageHero
        eyebrow="مشاريع مختارة"
        title="اكتشف مشاريعنا الاستثنائية"
        subtitle="مجموعة منتقاة من المشاريع السكنية والتجارية المصممة لأسلوب حياة أرقى."
      />
      <Section tone="canvas">
        <span className="sr-only">جارٍ التحميل…</span>
        {/* Filter bar */}
        <Skeleton className="h-24 w-full rounded-3xl" />
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
