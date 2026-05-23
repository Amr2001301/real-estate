import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';

export default function ProjectDetailLoading() {
  return (
    <>
      <section className="bg-canvas pt-24 sm:pt-28">
        <Container>
          <div className="aspect-[16/10] w-full animate-pulse rounded-4xl bg-surface-soft sm:aspect-[16/9]" />
        </Container>
      </section>
      <Section tone="canvas" className="pt-14 sm:pt-16">
        <div className="grid animate-pulse gap-12 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="h-4 w-1/4 rounded-full bg-surface-soft" />
            <div className="h-8 w-1/2 rounded-full bg-surface-soft" />
            <div className="h-3 w-full rounded-full bg-surface-soft" />
            <div className="h-3 w-5/6 rounded-full bg-surface-soft" />
            <div className="grid grid-cols-2 gap-4 pt-6 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-28 rounded-3xl bg-surface-soft" />
              ))}
            </div>
          </div>
          <div className="h-80 rounded-3xl bg-surface-soft lg:col-span-1" />
        </div>
      </Section>
    </>
  );
}
