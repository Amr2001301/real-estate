import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/units/reprice while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 0, h: 114 },
  { t: 'card', h: 388, list: false },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
