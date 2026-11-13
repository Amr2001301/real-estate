import { PageSkeleton, type SkeletonPart } from '@/components/ui/skeletons';

/** /dashboard/brokers/[id]/users while it loads — its own layout, read off the page (see PageSkeleton). */
const PARTS: SkeletonPart[] = [
  { t: 'hero', a: 0, h: 114 },
  { t: 'filter' },
  { t: 'card', h: 159, list: true },
];

export default function Loading() {
  return <PageSkeleton parts={PARTS} />;
}
