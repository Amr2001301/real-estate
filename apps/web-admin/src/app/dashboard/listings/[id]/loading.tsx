import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** A listing while it loads: the hero, the photos and details beside the price, place, owner and agent. */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 3, h: 170 },
  { t: 'grid', cls: 'grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start', cols: [{ s: 'lg:col-span-2', h: [470, 260] }, { h: [200, 120, 150, 110] }] },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
