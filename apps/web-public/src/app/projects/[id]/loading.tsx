import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Skeleton, SkeletonText } from '@/components/ui/skeleton';

export default function ProjectDetailLoading() {
  return (
    <>
      <span className="sr-only">جارٍ التحميل…</span>
      <section className="bg-canvas pt-24 sm:pt-28">
        <Container>
          <Skeleton className="aspect-[16/10] w-full rounded-4xl sm:aspect-[16/9]" />
        </Container>
      </section>
      <Section tone="canvas" className="pt-14 sm:pt-16">
        <div className="grid gap-12 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Skeleton className="h-4 w-1/4 rounded-full" />
            <Skeleton className="h-8 w-1/2 rounded-full" />
            <SkeletonText lines={2} />
            <div className="grid grid-cols-2 gap-4 pt-6 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-3xl" />
              ))}
            </div>
          </div>
          {/* Inquiry card */}
          <Skeleton className="h-80 rounded-3xl lg:col-span-1" />
        </div>
      </Section>
    </>
  );
}
