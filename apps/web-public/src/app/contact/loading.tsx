import { Section } from '@/components/ui/Section';
import { PageHero } from '@/components/layout/PageHero';
import { Skeleton, SkeletonForm } from '@/components/ui/skeleton';

export default function ContactLoading() {
  return (
    <>
      <PageHero
        eyebrow="تواصل معنا"
        title="اترك لنا رسالة، وسنتولى الباقي"
        subtitle="فريقنا جاهز لمساعدتك في اختيار المشروع أو الوحدة الأنسب لاحتياجك."
      />
      <Section tone="canvas">
        <span className="sr-only">جارٍ التحميل…</span>
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Lead form */}
          <div className="rounded-3xl border border-hairline bg-surface p-6 shadow-soft sm:p-8 lg:col-span-2">
            <SkeletonForm fields={4} />
          </div>
          {/* Support cards */}
          <div className="space-y-6 lg:col-span-1">
            <Skeleton className="h-48 rounded-3xl" />
            <Skeleton className="h-28 rounded-3xl" />
            <Skeleton className="h-28 rounded-3xl" />
          </div>
        </div>
      </Section>
    </>
  );
}
