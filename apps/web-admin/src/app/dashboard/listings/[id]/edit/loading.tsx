import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** «تعديل الوحدة» while it loads: the hero, then the numbered sections beside their summary card. */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 0, h: 141 },
  { t: 'grid', cls: 'grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_300px]', cols: [{ h: [250, 330, 360] }, { s: 'hidden lg:block', h: [560] }] },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
